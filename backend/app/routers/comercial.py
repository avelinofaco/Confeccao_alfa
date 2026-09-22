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
    
    # 1. Valida se já não existe um pedido com esse código
    db_pedido = db.query(models_comercial.PedidoComercial).filter(models_comercial.PedidoComercial.codigo_pedido == pedido.codigo_pedido).first()
    if db_pedido:
        raise HTTPException(status_code=400, detail="Já existe um pedido com este código.")

    # 2. Valida se o produto solicitado existe na Ficha Técnica
    produto = db.query(models_ficha.Produto).filter(models_ficha.Produto.id_produto == pedido.id_produto).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado na base de dados.")

    # 3. Salva o pedido
    novo_pedido = models_comercial.PedidoComercial(**pedido.model_dump())
    
    db.add(novo_pedido)
    db.commit()
    db.refresh(novo_pedido)
    
    return novo_pedido


# 3. Rota para ATUALIZAR O STATUS do pedido
@router.put("/pedidos/{id}/status")
def atualizar_status_pedido(id: int, status_data: schemas.StatusPedidoUpdate, db: Session = Depends(get_db)):
    """Muda apenas o status do pedido (ex: para 'Entregue')."""
    pedido = db.query(models_comercial.PedidoComercial).filter(models_comercial.PedidoComercial.id_pedido == id).first()
    
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    
    # Atualiza a coluna usando o dado validado pelo seu Schema
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
    """Deleta um pedido permanentemente do sistema."""
    # Busca pelo id_pedido correto no banco
    pedido = db.query(models_comercial.PedidoComercial).filter(models_comercial.PedidoComercial.id_pedido == id).first()
    
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado.")
    
    db.delete(pedido)
    db.commit()
    
    return {"mensagem": "Pedido excluído com sucesso!"}