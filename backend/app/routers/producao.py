# app/routers/producao.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from decimal import Decimal
from typing import List

from app.database import get_db
from app.models import producao as models_prod
from app.models import ficha_tecnica as models_ficha
from app.schemas import producao as schemas
from app.models import comercial as models_comercial

router = APIRouter(
    prefix="/producao",
    tags=["Corte e Produção"]
)

@router.get("/ordens", response_model=List[schemas.OPResponse])
def listar_ops(db: Session = Depends(get_db)):
    """Lista todas as Ordens de Produção."""
    return db.query(models_prod.OrdemProducao).all()

@router.post("/ordens", response_model=schemas.OPResponse, status_code=status.HTTP_201_CREATED)
def enviar_para_corte(op: schemas.OPCreate, db: Session = Depends(get_db)):
    """Registra o envio de malha para o cortador e cria a OP."""
    
    # Verifica se a OP já existe
    db_op = db.query(models_prod.OrdemProducao).filter(models_prod.OrdemProducao.codigo_op == op.codigo_op).first()
    if db_op:
        raise HTTPException(status_code=400, detail="Já existe uma OP cadastrada com este código.")

    # Verifica se o produto/modelo existe
    produto = db.query(models_ficha.Produto).filter(models_ficha.Produto.id_produto == op.id_produto).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")

    nova_op = models_prod.OrdemProducao(
        **op.model_dump(),
        status_op="Enviado para Corte"
    )
    
    db.add(nova_op)
    # ========================================================
    # NOVA REGRA: MUDANÇA AUTOMÁTICA DE STATUS COMERCIAL
    # ========================================================
    pedidos_aguardando = db.query(models_comercial.PedidoComercial).filter(
        models_comercial.PedidoComercial.id_produto == op.id_produto,
        models_comercial.PedidoComercial.status_pedido == "Aguardando Produção"
    ).all()

    for pedido in pedidos_aguardando:
        pedido.status_pedido = "Em Produção"
        db.add(pedido) # Salva a alteração
    # ========================================================
    
    db.commit()
    db.refresh(nova_op)
    
    return nova_op

@router.put("/ordens/{id_op}/retorno-corte", response_model=schemas.OPResponse)
def registrar_retorno_corte(id_op: int, retorno: schemas.OPRetornoCorte, db: Session = Depends(get_db)):
    """Registra as peças cortadas e calcula automaticamente o rendimento (eficiência)."""
    
    op = db.query(models_prod.OrdemProducao).filter(models_prod.OrdemProducao.id_op == id_op).first()
    if not op:
        raise HTTPException(status_code=404, detail="Ordem de Produção não encontrada.")

    # Evita que a gestora registre o retorno de uma OP que já foi para a costura
    if op.status_op != "Enviado para Corte":
        raise HTTPException(status_code=400, detail="Esta OP já teve o retorno registrado ou não está na fase de corte.")

    # Atualiza as peças
    op.quantidade_pecas_cortadas = retorno.quantidade_pecas_cortadas
    
    # REGRA DE NEGÓCIO: Cálculo do rendimento real (Peças / Kg)
    rendimento = Decimal(retorno.quantidade_pecas_cortadas) / op.peso_malha_enviado
    op.rendimento_real = round(rendimento, 2) # Arredonda para 2 casas decimais (ex: 44.44)
    
    # Atualiza o status
    op.status_op = "Corte Finalizado"

    db.commit()
    db.refresh(op)
    
    return op

