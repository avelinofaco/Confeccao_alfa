# app/routers/camisetas/pedidos.py
"""Pedidos de clientes e estoque de produtos acabados (segmento Camisetas)."""
from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.database import get_db
from app.models.camisetas import CamisetaModelo, CamisetaPedido, CamisetaProdutoAcabado, get_utc_now
from app.schemas.camisetas import (
    CamisetaPedidoCreate,
    CamisetaPedidoEntregar,
    CamisetaPedidoResponse,
    CamisetaPedidoStatusUpdate,
    CamisetaProdutoAcabadoResponse,
)
from app.services.camisetas.estoque import (
    baixar_estoque_acabado,
    devolver_estoque_acabado,
    obter_ou_criar_estoque_acabado,
)
from app.services.camisetas.pedidos import (
    STATUS_ENTREGUE,
    STATUS_INICIAL,
    STATUS_VALIDOS,
    montar_resposta_pedido,
)
from app.services.sequencias import proximo_codigo

router = APIRouter()


def hoje_local() -> date:
    return datetime.now(FUSO_HORARIO).date()


def buscar_pedido(db: Session, id_pedido: int) -> CamisetaPedido:
    pedido = db.query(CamisetaPedido).filter_by(id_pedido=id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return pedido


@router.get("/pedidos/", response_model=List[CamisetaPedidoResponse])
def listar_pedidos(db: Session = Depends(get_db)):
    pedidos = db.query(CamisetaPedido).order_by(CamisetaPedido.id_pedido.desc()).all()
    return [montar_resposta_pedido(p) for p in pedidos]


@router.post("/pedidos/", response_model=CamisetaPedidoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_pedido(pedido_in: CamisetaPedidoCreate, db: Session = Depends(get_db)):
    if pedido_in.prazo_entrega < hoje_local():
        raise HTTPException(
            status_code=400,
            detail="O prazo de entrega desejado não pode ser anterior à data de hoje. Selecione hoje ou uma data futura.",
        )
    modelo = db.query(CamisetaModelo).filter_by(id_modelo=pedido_in.id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo de camiseta informado não encontrado")

    qtd_total = pedido_in.grade_p + pedido_in.grade_m + pedido_in.grade_g + pedido_in.grade_gg
    if qtd_total <= 0:
        raise HTTPException(status_code=400, detail="A soma das grades (P, M, G, GG) deve ser maior que zero")

    novo_pedido = CamisetaPedido(
        codigo_pedido=proximo_codigo(db, "PED"),
        nome_cliente=pedido_in.nome_cliente,
        id_modelo=pedido_in.id_modelo,
        grade_p=pedido_in.grade_p,
        grade_m=pedido_in.grade_m,
        grade_g=pedido_in.grade_g,
        grade_gg=pedido_in.grade_gg,
        quantidade_total=qtd_total,
        prazo_entrega=pedido_in.prazo_entrega,
        valor_total=pedido_in.valor_total,
        status_pedido=STATUS_INICIAL,
        observacoes=pedido_in.observacoes,
    )
    db.add(novo_pedido)
    db.commit()
    db.refresh(novo_pedido)
    return montar_resposta_pedido(novo_pedido)


@router.put("/pedidos/{id_pedido}/status", response_model=CamisetaPedidoResponse)
def atualizar_status_pedido(id_pedido: int, status_in: CamisetaPedidoStatusUpdate, db: Session = Depends(get_db)):
    pedido = buscar_pedido(db, id_pedido)
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
    pedido = buscar_pedido(db, id_pedido)
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
    """Exclui um pedido. Impede exclusão de pedido já entregue."""
    pedido = buscar_pedido(db, id_pedido)
    if (pedido.status_pedido or "").lower() == STATUS_ENTREGUE.lower():
        raise HTTPException(
            status_code=400,
            detail="Não é permitido excluir um pedido que já foi formalizado como Entregue ao cliente.",
        )
    codigo = pedido.codigo_pedido
    db.delete(pedido)
    db.commit()
    return {"mensagem": f"Pedido {codigo} excluído com sucesso!"}


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
