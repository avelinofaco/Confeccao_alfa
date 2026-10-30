# app/routers/comercial.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import comercial as models_comercial
from app.models import ficha_tecnica as models_ficha
from app.schemas import comercial as schemas

router = APIRouter(prefix="/comercial", tags=["Comercial e Vendas"])


@router.post("/pedidos", response_model=schemas.PedidoResponse, status_code=status.HTTP_201_CREATED)
def registrar_pedido(pedido: schemas.PedidoCreate, db: Session = Depends(get_db)):
    """Registra um novo pedido feito pelo cliente."""
    dados_pedido = pedido.model_dump()
    
    # 1. Se o código não for informado, gerar automaticamente pelo banco
    if not dados_pedido.get("codigo_pedido"):
        ultimo = db.query(models_comercial.PedidoComercial).order_by(models_comercial.PedidoComercial.id_pedido.desc()).first()
        next_id = (ultimo.id_pedido + 1) if ultimo else 1
        dados_pedido["codigo_pedido"] = f"PED-{next_id:04d}"
    else:
        # Valida se já não existe um pedido com esse código
        db_pedido = db.query(models_comercial.PedidoComercial).filter(models_comercial.PedidoComercial.codigo_pedido == dados_pedido["codigo_pedido"]).first()
        if db_pedido:
            raise HTTPException(status_code=400, detail="Já existe um pedido com este código.")

    # 2. Valida se o produto solicitado existe na Ficha Técnica
    produto = db.query(models_ficha.Produto).filter(models_ficha.Produto.id_produto == pedido.id_produto).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado na base de dados.")

    # 3. Salva o pedido
    novo_pedido = models_comercial.PedidoComercial(**dados_pedido)
    
    db.add(novo_pedido)
    db.commit()
    db.refresh(novo_pedido)
    
    return novo_pedido


# 3. Rota para ATUALIZAR O STATUS do pedido
@router.put("/pedidos/{id}/status")
def atualizar_status_pedido(id: int, status_data: schemas.StatusPedidoUpdate, db: Session = Depends(get_db)):
    """Muda o status do pedido (ex: para 'Entregue') validando estoque disponível no Dashboard."""
    pedido = db.query(models_comercial.PedidoComercial).filter(models_comercial.PedidoComercial.id_pedido == id).first()
    
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    
    # Se estiver marcando como entregue, valida se há saldo suficiente de peças prontas
    novo_status = (status_data.status_pedido or "").strip()
    status_atual = (pedido.status_pedido or "").strip().lower()
    
    if novo_status.lower() == "entregue" and status_atual != "entregue":
        from sqlalchemy import func
        from app.models import costura as models_costura
        
        # Total de peças prontas retornadas da costura
        total_produzido = db.query(func.coalesce(func.sum(models_costura.MovimentacaoCostura.quantidade_recebida), 0)).filter(
            (models_costura.MovimentacaoCostura.status_movimentacao == 'Retornado') | 
            (models_costura.MovimentacaoCostura.quantidade_recebida > 0)
        ).scalar() or 0
        
        # Total de peças já entregues em outros pedidos
        total_ja_entregue = db.query(func.coalesce(func.sum(models_comercial.PedidoComercial.quantidade_pecas), 0)).filter(
            func.lower(models_comercial.PedidoComercial.status_pedido) == 'entregue',
            models_comercial.PedidoComercial.id_pedido != id
        ).scalar() or 0
        
        saldo_estoque_pronto = max(0, total_produzido - total_ja_entregue)
        qtd_necessaria = pedido.quantidade_pecas or 0
        
        if qtd_necessaria > saldo_estoque_pronto:
            raise HTTPException(
                status_code=400,
                detail=f"Estoque insuficiente de peças no Dashboard! Disponível: {saldo_estoque_pronto} un. Necessário para este pedido: {qtd_necessaria} un."
            )
    
    pedido.status_pedido = status_data.status_pedido
    db.commit()
    db.refresh(pedido)
    return pedido


@router.get("/pedidos", response_model=List[schemas.PedidoResponse])
def listar_pedidos(db: Session = Depends(get_db)):
    """Lista todos os pedidos cadastrados (usado para montar a tabela no Front-end)."""
    return db.query(models_comercial.PedidoComercial).all()


@router.delete("/pedidos/{id}")
def deletar_pedido(id: int, db: Session = Depends(get_db)):
    """Deleta um pedido permanentemente do sistema. Impede exclusão se já estiver entregue."""
    pedido = db.query(models_comercial.PedidoComercial).filter(models_comercial.PedidoComercial.id_pedido == id).first()
    
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    
    if (pedido.status_pedido or "").strip().lower() == "entregue":
        raise HTTPException(
            status_code=400, 
            detail="Não é permitido excluir um pedido que já foi formalizado como Entregue ao cliente."
        )
    
    db.delete(pedido)
    db.commit()
    
    return {"mensagem": "Pedido excluído com sucesso!"}