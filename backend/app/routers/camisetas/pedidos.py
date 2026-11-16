# app/routers/camisetas/pedidos.py
"""Pedidos de clientes e estoque de produtos acabados (segmento Camisetas)."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.camisetas import CamisetaPedido, CamisetaProdutoAcabado, get_utc_now
from app.schemas.camisetas import (
    CamisetaPedidoCreate,
    CamisetaPedidoEntregar,
    CamisetaPedidoResponse,
    CamisetaPedidoStatusUpdate,
    CamisetaProdutoAcabadoResponse,
)
from app.schemas.camisetas_sku import PedidoItensEntrada
from app.services.camisetas.estoque import (
    baixar_estoque_acabado,
    devolver_estoque_acabado,
    obter_ou_criar_estoque_acabado,
)
from app.services.camisetas.pedidos import (
    STATUS_ENTREGUE,
    STATUS_VALIDOS,
    criar_pedido,
    excluir_pedido,
    hoje_local,
    montar_resposta_pedido,
    obter_pedido,
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
    pedido = obter_pedido(db, id_pedido)
    novo_status = status_in.status_pedido

    if novo_status not in STATUS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Status inválido: '{novo_status}'. Use um destes: {', '.join(STATUS_VALIDOS)}.",
        )
    if novo_status == STATUS_ENTREGUE and pedido.status_pedido != STATUS_ENTREGUE:
        raise HTTPException(
            status_code=400,
            detail="Para marcar o pedido como Entregue, use 'Registrar entrega': ela confere o estoque pronto antes da baixa.",
        )
    if pedido.status_pedido == STATUS_ENTREGUE and novo_status != STATUS_ENTREGUE:
        devolver_estoque_acabado(obter_ou_criar_estoque_acabado(db, pedido.id_modelo), pedido)
        pedido.data_entrega_realizada = None

    pedido.status_pedido = novo_status
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return montar_resposta_pedido(pedido)


@router.post("/pedidos/{id_pedido}/entregar", response_model=CamisetaPedidoResponse)
def registrar_entrega_pedido(id_pedido: int, dados_entrega: CamisetaPedidoEntregar, db: Session = Depends(get_db)):
    """Registra a entrega: confere e baixa o estoque pronto e grava a data real da entrega."""
    pedido = obter_pedido(db, id_pedido)
    if pedido.status_pedido == STATUS_ENTREGUE:
        raise HTTPException(status_code=400, detail="Este pedido já foi registrado como Entregue anteriormente.")

    data_entrega = dados_entrega.data_entrega or hoje_local()
    if data_entrega > hoje_local():
        raise HTTPException(status_code=400, detail="A data da entrega não pode ser futura.")

    estoque = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=pedido.id_modelo).first()
    disponivel = (estoque.quantidade_total or 0) if estoque else 0
    if disponivel < pedido.quantidade_total:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Estoque pronto insuficiente para entrega! Disponível em estoque: {disponivel} peças. "
                f"Quantidade do pedido a entregar: {pedido.quantidade_total} peças."
            ),
        )

    baixar_estoque_acabado(estoque, pedido)
    recebedor = f" | Recebido por: {dados_entrega.recebedor}" if dados_entrega.recebedor else ""
    obs_extra = f" | Obs: {dados_entrega.observacoes}" if dados_entrega.observacoes else ""
    nota = f"\n[ENTREGA REALIZADA em {data_entrega.strftime('%d/%m/%Y')}{recebedor}{obs_extra}]"

    pedido.observacoes = (pedido.observacoes or "") + nota
    pedido.status_pedido = STATUS_ENTREGUE
    pedido.data_entrega_realizada = data_entrega
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return montar_resposta_pedido(pedido)


@router.delete("/pedidos/{id_pedido}")
def excluir_pedido_camiseta(id_pedido: int, db: Session = Depends(get_db)):
    """Exclui um pedido (com seus itens). Pedido entregue não pode ser excluído."""
    return {"mensagem": f"Pedido {excluir_pedido(db, id_pedido)} excluído com sucesso!"}


@router.get("/estoque-acabado/", response_model=List[CamisetaProdutoAcabadoResponse])
def listar_estoque_acabado(db: Session = Depends(get_db)):
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
