# app/services/camisetas/pedidos.py
"""Regras dos pedidos de camisetas: criação com itens, edição de itens e exclusão."""
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaPedido, get_utc_now
from app.schemas.camisetas import CamisetaPedidoCreate, CamisetaPedidoResponse
from app.schemas.camisetas_sku import PedidoItensEntrada
from app.services.camisetas.clientes import resolver_cliente
from app.services.camisetas.pedido_itens import (
    CAMPOS_GRADE_LEGADA,
    itens_do_corpo_antigo,
    montar_itens,
    resposta_do_item,
    total_do_item,
)
from app.services.sequencias import proximo_codigo

STATUS_INICIAL = "Aguardando Produção"
STATUS_ENTREGUE = "Entregue"
STATUS_VALIDOS = ("Aguardando Produção", "Em Produção", "Pronto no Estoque", "Entregue")
MENSAGEM_PRAZO = "O prazo de entrega desejado não pode ser anterior à data de hoje. Selecione hoje ou uma data futura."


def hoje_local() -> date:
    return datetime.now(FUSO_HORARIO).date()


def montar_resposta_pedido(pedido) -> CamisetaPedidoResponse:
    return CamisetaPedidoResponse(
        id_pedido=pedido.id_pedido,
        codigo_pedido=pedido.codigo_pedido,
        nome_cliente=pedido.nome_cliente,
        id_cliente=pedido.id_cliente,
        id_modelo=pedido.id_modelo,
        nome_modelo=pedido.modelo.nome_modelo if pedido.modelo else "Modelo",
        grade_p=pedido.grade_p,
        grade_m=pedido.grade_m,
        grade_g=pedido.grade_g,
        grade_gg=pedido.grade_gg,
        quantidade_total=pedido.quantidade_total,
        prazo_entrega=pedido.prazo_entrega,
        valor_total=pedido.valor_total,
        status_pedido=pedido.status_pedido,
        observacoes=pedido.observacoes,
        data_entrega_realizada=pedido.data_entrega_realizada,
        criado_em=pedido.criado_em,
        itens=[resposta_do_item(item) for item in pedido.itens],
    )


def obter_pedido(db: Session, id_pedido: int) -> CamisetaPedido:
    pedido = db.get(CamisetaPedido, id_pedido)
    if pedido is None:
        raise ErroNegocio(404, "Pedido não encontrado")
    return pedido


def _aplicar_itens(pedido: CamisetaPedido, itens) -> None:
    pedido.itens = itens
    pedido.id_modelo = itens[0].id_modelo
    pedido.quantidade_total = sum(total_do_item(item) for item in itens)


def criar_pedido(db: Session, dados: CamisetaPedidoCreate, hoje: date) -> CamisetaPedido:
    if dados.prazo_entrega < hoje:
        raise ErroNegocio(400, MENSAGEM_PRAZO)
    if dados.itens is not None:
        itens = montar_itens(db, dados.itens, exigir_cor=True)
        grade = {campo: 0 for campo in CAMPOS_GRADE_LEGADA}
    else:
        itens = montar_itens(db, itens_do_corpo_antigo(db, dados), exigir_cor=False)
        grade = {campo: getattr(dados, campo) for campo in CAMPOS_GRADE_LEGADA}
    cliente = resolver_cliente(db, dados.id_cliente, dados.nome_cliente)
    pedido = CamisetaPedido(
        codigo_pedido=proximo_codigo(db, "PED"), nome_cliente=cliente.nome, id_cliente=cliente.id_cliente,
        prazo_entrega=dados.prazo_entrega, valor_total=dados.valor_total, status_pedido=STATUS_INICIAL,
        observacoes=dados.observacoes, **grade,
    )
    _aplicar_itens(pedido, itens)
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return pedido


def substituir_itens(db: Session, id_pedido: int, dados: PedidoItensEntrada) -> CamisetaPedido:
    pedido = obter_pedido(db, id_pedido)
    if pedido.status_pedido == STATUS_ENTREGUE:
        raise ErroNegocio(409, "Pedido já entregue: os itens não podem mais ser alterados. Reverta a entrega antes.")
    _aplicar_itens(pedido, montar_itens(db, dados.itens, exigir_cor=True))
    for campo in CAMPOS_GRADE_LEGADA:
        setattr(pedido, campo, 0)
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return pedido


def excluir_pedido(db: Session, id_pedido: int) -> str:
    pedido = obter_pedido(db, id_pedido)
    if (pedido.status_pedido or "").lower() == STATUS_ENTREGUE.lower():
        raise ErroNegocio(400, "Não é permitido excluir um pedido que já foi formalizado como Entregue ao cliente.")
    codigo = pedido.codigo_pedido
    db.delete(pedido)
    db.commit()
    return codigo
