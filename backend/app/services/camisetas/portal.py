# app/services/camisetas/portal.py
"""Regras de negócio do Portal do Cliente (aprovação por link e pedido pelo celular)."""
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo, CamisetaPedido, get_utc_now
from app.models.camisetas_cadastros import CamisetaCliente
from app.schemas.portal_cliente import (
    CatalogoPortalClienteResponse,
    PedidoPortalClienteEntrada,
    RespostaAprovacaoEntrada,
)
from app.services.camisetas.cores import listar_cores
from app.services.camisetas.estampas import listar_estampas
from app.services.camisetas.modelos import montar_resposta_modelo
from app.services.camisetas.pedido_itens import CAMPOS_GRADE_LEGADA, montar_itens, total_do_item
from app.services.camisetas.pedidos import (
    MENSAGEM_PRAZO,
    STATUS_ENTREGUE,
    STATUS_INICIAL,
    hoje_local,
    montar_resposta_pedido,
)
from app.services.sequencias import proximo_codigo


def obter_pedido_por_token(db: Session, token: str) -> CamisetaPedido:
    limpo = (token or "").strip()
    if not limpo:
        raise ErroNegocio(404, "Link de pedido inválido ou expirado.")
    pedido = db.query(CamisetaPedido).filter(CamisetaPedido.token_aprovacao == limpo).first()
    if pedido is None:
        raise ErroNegocio(404, "Link de pedido não encontrado.")
    return pedido


def responder_aprovacao_pedido(
    db: Session,
    token: str,
    dados: RespostaAprovacaoEntrada,
) -> CamisetaPedido:
    pedido = obter_pedido_por_token(db, token)
    if pedido.status_pedido == STATUS_ENTREGUE:
        raise ErroNegocio(409, "Este pedido já foi entregue e não pode mais ser alterado.")
    obs = " ".join((dados.observacao_cliente or "").split()) or None
    if dados.decisao == "Ajuste Solicitado" and not obs:
        raise ErroNegocio(400, "Descreva o que precisa ser ajustado no pedido.")
    pedido.status_aprovacao_cliente = dados.decisao
    pedido.observacao_cliente = obs
    if dados.decisao == "Aprovado":
        pedido.aprovado_pelo_cliente_em = get_utc_now()
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return pedido


def _obter_cliente_por_token(db: Session, token: str) -> CamisetaCliente:
    limpo = (token or "").strip()
    if not limpo:
        raise ErroNegocio(404, "Link do portal inválido.")
    cliente = db.query(CamisetaCliente).filter(CamisetaCliente.token_portal == limpo).first()
    if cliente is None:
        raise ErroNegocio(404, "Link do portal não encontrado.")
    if not cliente.ativo:
        raise ErroNegocio(403, "Este acesso de cliente está inativo. Fale com a confecção.")
    return cliente


def obter_catalogo_cliente(db: Session, token: str) -> CatalogoPortalClienteResponse:
    cliente = _obter_cliente_por_token(db, token)
    modelos = [
        montar_resposta_modelo(m)
        for m in db.query(CamisetaModelo).order_by(CamisetaModelo.nome_modelo).all()
    ]
    cores = listar_cores(db, incluir_inativas=False)
    estampas = listar_estampas(db, incluir_inativas=False)
    pedidos_cliente = (
        db.query(CamisetaPedido)
        .filter(CamisetaPedido.id_cliente == cliente.id_cliente)
        .order_by(CamisetaPedido.id_pedido.desc())
        .limit(20)
        .all()
    )
    return CatalogoPortalClienteResponse(
        id_cliente=cliente.id_cliente,
        nome_cliente=cliente.nome,
        modelos=modelos,
        cores=cores,
        estampas=estampas,
        pedidos=[montar_resposta_pedido(p) for p in pedidos_cliente],
    )


def criar_pedido_pelo_portal(
    db: Session,
    token: str,
    dados: PedidoPortalClienteEntrada,
) -> CamisetaPedido:
    cliente = _obter_cliente_por_token(db, token)
    if dados.prazo_entrega < hoje_local():
        raise ErroNegocio(400, MENSAGEM_PRAZO)
    itens = montar_itens(db, dados.itens, exigir_cor=True)
    grade = {campo: 0 for campo in CAMPOS_GRADE_LEGADA}
    obs = " ".join((dados.observacoes or "").split()) or None
    pedido = CamisetaPedido(
        codigo_pedido=proximo_codigo(db, "PED"),
        nome_cliente=cliente.nome,
        id_cliente=cliente.id_cliente,
        id_modelo=itens[0].id_modelo,
        quantidade_total=sum(total_do_item(i) for i in itens),
        prazo_entrega=dados.prazo_entrega,
        valor_total=Decimal("0.00"),
        status_pedido=STATUS_INICIAL,
        observacoes=obs,
        status_aprovacao_cliente="Aprovado",
        aprovado_pelo_cliente_em=get_utc_now(),
        **grade,
    )
    pedido.itens = itens
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return pedido
