# app/routers/costura.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from decimal import Decimal
from app.database import get_db
from typing import List
from datetime import datetime

# 1. Importando os Models corretos de cada módulo
from app.models import costura as models_costura
from app.models import producao as models_prod
from app.models import ficha_tecnica as models_ficha
from app.models import estoque as models_estoque
from app.models import comercial as models_comercial

# 2. Importando o Schema correto deste módulo
from app.schemas import costura as schemas

router = APIRouter(prefix="/costura", tags=["Costura e Fechamento"])


@router.get("/movimentacoes", response_model=List[schemas.MovimentacaoCosturaResponse])
def listar_movimentacoes_costura(db: Session = Depends(get_db)):
    """Retorna o histórico de todas as movimentações de costura para popular a tabela."""
    movimentacoes = db.query(models_costura.MovimentacaoCostura).all()
    return movimentacoes

@router.post("/envios", response_model=schemas.MovimentacaoCosturaResponse, status_code=status.HTTP_201_CREATED)
def enviar_para_costura(envio: schemas.EnvioCosturaCreate, db: Session = Depends(get_db)):
    """Envia peças para a costureira e dá baixa automática nos insumos."""
    
    # Busca a OP na tabela de ordens de produção
    op = db.query(models_prod.OrdemProducao).filter(models_prod.OrdemProducao.id_op == envio.id_op).first()
    if not op or op.status_op != "Corte Finalizado":
        raise HTTPException(status_code=400, detail="OP inválida ou não finalizada no corte.")

    # Busca o Produto na Ficha Técnica para saber a 'receita'
    produto = db.query(models_ficha.Produto).filter(models_ficha.Produto.id_produto == op.id_produto).first()
    
    # REGRA DE NEGÓCIO: Cálculo e baixa de estoque
    for composicao in produto.composicao:
        insumo = db.query(models_estoque.Insumo).filter(models_estoque.Insumo.id_insumo == composicao.id_insumo).first()
        
        # (800 peças * 1.5m)
        consumo_total = (Decimal(op.quantidade_pecas_cortadas) * composicao.gasto_por_unidade)
        
        # CORREÇÃO: Se for medido em metros ('m') ou a categoria for aviamento, soma a margem extra
        if insumo.unidade_medida.lower() in ["m", "metros"] or "aviamento" in insumo.categoria.lower():
            consumo_total += envio.margem_seguranca_insumos

        if insumo.quantidade_atual < consumo_total:
            raise HTTPException(status_code=400, detail=f"Estoque insuficiente para {insumo.nome}.")
            
        insumo.quantidade_atual -= consumo_total # Dá a baixa no banco

    # Salva a movimentação de envio
    nova_movimentacao = models_costura.MovimentacaoCostura(
        **envio.model_dump(), 
        quantidade_enviada=op.quantidade_pecas_cortadas
    )
    
    # Atualiza o status da OP
    op.status_op = "Em Costura"
    
    db.add(nova_movimentacao)
    db.commit()
    db.refresh(nova_movimentacao)
    return nova_movimentacao


@router.put("/retorno/{id_movimentacao}", response_model=schemas.MovimentacaoCosturaResponse)
def registrar_retorno_costura(id_movimentacao: int, retorno: schemas.RetornoCosturaUpdate, db: Session = Depends(get_db)):
    """Registra o retorno, calcula perdas e adiciona ao estoque pronto."""
    
    mov = db.query(models_costura.MovimentacaoCostura).filter(models_costura.MovimentacaoCostura.id_movimentacao == id_movimentacao).first()
    
    if not mov:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada.")

    # REGRA DE NEGÓCIO: Não permitir que a quantidade recebida seja maior que a enviada
    if retorno.quantidade_recebida > mov.quantidade_enviada:
        raise HTTPException(
            status_code=400, 
            detail=f"Não é possível receber mais peças ({retorno.quantidade_recebida}) do que foi enviado ({mov.quantidade_enviada})."
        )
        
    # REGRA DE NEGÓCIO: Cálculo de perda (Ex: Enviou 800, recebeu 790 = Perda 10)
    mov.quantidade_recebida = retorno.quantidade_recebida
    mov.perda_pecas = mov.quantidade_enviada - retorno.quantidade_recebida
    mov.status_movimentacao = "Retornado"
    
    # Preenchendo a data de retorno automaticamente!
    mov.data_retorno = datetime.now()
    
    # Atualiza o estoque de produtos prontos para venda
    estoque_pronto = db.query(models_costura.EstoqueProdutoPronto).filter(models_costura.EstoqueProdutoPronto.id_produto == mov.op.id_produto).first()
    if estoque_pronto:
        estoque_pronto.quantidade_total += retorno.quantidade_recebida
    else:
        novo_estoque = models_costura.EstoqueProdutoPronto(id_produto=mov.op.id_produto, quantidade_total=retorno.quantidade_recebida)
        db.add(novo_estoque)
        estoque_pronto = novo_estoque

    # Puxa os pedidos ordenados pela data de entrega mais próxima
    pedidos_em_producao = db.query(models_comercial.PedidoComercial).filter(
        models_comercial.PedidoComercial.id_produto == mov.op.id_produto,
        models_comercial.PedidoComercial.status_pedido == "Em Produção"
    ).order_by(models_comercial.PedidoComercial.data_entrega_desejada.asc()).all()

    # Verifica logicamente se o estoque dá conta dos pedidos
    estoque_disponivel = estoque_pronto.quantidade_total
    
    for pedido in pedidos_em_producao:
        if estoque_disponivel >= pedido.quantidade_pecas:
            pedido.status_pedido = "Pronto para Entrega"
            db.add(pedido)
            # Deduz logicamente para verificar o próximo pedido
            estoque_disponivel -= pedido.quantidade_pecas 
 
    db.commit()
    db.refresh(mov)
    return mov