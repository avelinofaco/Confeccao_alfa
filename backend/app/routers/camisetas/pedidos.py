# app/routers/camisetas/pedidos.py
"""Pedidos de clientes do segmento Camisetas (a lógica fica em services/camisetas/pedidos.py)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.camisetas import CamisetaPedido, CamisetaProdutoAcabado
from app.schemas.camisetas import (
    CamisetaPedidoCreate,
    CamisetaPedidoEntregar,
    CamisetaPedidoResponse,
    CamisetaPedidoStatusUpdate,
    CamisetaProdutoAcabadoResponse,
)
from app.schemas.camisetas_sku import PedidoItensEntrada
from app.services.camisetas.pedidos import (
    atualizar_status,
    criar_pedido,
    excluir_pedido,
    hoje_local,
    montar_resposta_pedido,
    registrar_entrega,
    substituir_itens,
)

router = APIRouter()


@router.get("/pedidos/", response_model=List[CamisetaPedidoResponse])
def listar_pedidos(db: Session = Depends(get_db)):
    pedidos = db.query(CamisetaPedido).order_by(CamisetaPedido.id_pedido.desc()).all()
    return [montar_resposta_pedido(p) for p in pedidos]


@router.post("/pedidos/", response_model=CamisetaPedidoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_pedido(pedido_in: CamisetaPedidoCreate, db: Session = Depends(get_db)):
    """Cria o pedido com itens (modelo + cor + quantidade por tamanho)."""
    return montar_resposta_pedido(criar_pedido(db, pedido_in, hoje_local()))


@router.put("/pedidos/{id_pedido}/itens", response_model=CamisetaPedidoResponse)
def editar_itens_pedido(id_pedido: int, dados: PedidoItensEntrada, db: Session = Depends(get_db)):
    """Substitui os itens de um pedido ainda não entregue (é assim que um pedido antigo recebe a cor)."""
    return montar_resposta_pedido(substituir_itens(db, id_pedido, dados))


@router.put("/pedidos/{id_pedido}/status", response_model=CamisetaPedidoResponse)
def atualizar_status_pedido(id_pedido: int, status_in: CamisetaPedidoStatusUpdate, db: Session = Depends(get_db)):
    """Muda o status; sair de Entregue devolve as peças ao estoque de cada SKU."""
    return montar_resposta_pedido(atualizar_status(db, id_pedido, status_in.status_pedido))


@router.post("/pedidos/{id_pedido}/entregar", response_model=CamisetaPedidoResponse)
def registrar_entrega_pedido(id_pedido: int, dados_entrega: CamisetaPedidoEntregar, db: Session = Depends(get_db)):
    """Registra a entrega: confere e baixa o estoque de cada SKU e grava a data real da entrega."""
    return montar_resposta_pedido(registrar_entrega(db, id_pedido, dados_entrega, hoje_local()))


@router.delete("/pedidos/{id_pedido}")
def excluir_pedido_camiseta(id_pedido: int, db: Session = Depends(get_db)):
    """Exclui um pedido (com seus itens). Pedido entregue não pode ser excluído."""
    return {"mensagem": f"Pedido {excluir_pedido(db, id_pedido)} excluído com sucesso!"}


@router.get("/estoque-acabado/", response_model=List[CamisetaProdutoAcabadoResponse])
def listar_estoque_acabado(db: Session = Depends(get_db)):
    """Tabela antiga (antes da Fase 1B), mantida só como histórico."""
    return [
        CamisetaProdutoAcabadoResponse(
            id_estoque_acabado=ac.id_estoque_acabado,
            id_modelo=ac.id_modelo,
            nome_modelo=ac.modelo.nome_modelo if ac.modelo else "Modelo Geral",
            grade_p=ac.grade_p or 0,
            grade_m=ac.grade_m or 0,
            grade_g=ac.grade_g or 0,
            grade_gg=ac.grade_gg or 0,
            quantidade_total=ac.quantidade_total or 0,
            atualizado_em=ac.atualizado_em,
        )
        for ac in db.query(CamisetaProdutoAcabado).all()
    ]
