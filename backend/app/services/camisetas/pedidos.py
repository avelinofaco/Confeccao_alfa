# app/services/camisetas/pedidos.py
"""Regras dos pedidos de camisetas: criação com itens, edição de itens, entrega e estorno por SKU."""
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaPedido, get_utc_now
from app.models.camisetas_sku import CamisetaMovimentoEstoque, CamisetaVariacao
from app.schemas.camisetas import CamisetaPedidoCreate, CamisetaPedidoEntregar, CamisetaPedidoResponse
from app.schemas.camisetas_sku import PedidoItensEntrada
from app.services.camisetas.clientes import resolver_cliente
from app.services.camisetas.pedido_itens import (
    CAMPOS_GRADE_LEGADA,
    itens_do_corpo_antigo,
    montar_itens,
    resposta_do_item,
    total_do_item,
)
from app.services.camisetas.sku import ESTORNO_ENTREGA, SAIDA_ENTREGA, buscar_variacao, movimentar
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
        token_aprovacao=pedido.token_aprovacao,
        status_aprovacao_cliente=pedido.status_aprovacao_cliente or "Pendente",
        observacao_cliente=pedido.observacao_cliente,
        aprovado_pelo_cliente_em=pedido.aprovado_pelo_cliente_em,
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


@dataclass(frozen=True)
class Baixa:
    """O que a entrega tira de um SKU."""
    sku: str
    variacao: Optional[CamisetaVariacao]
    necessario: int

    @property
    def disponivel(self) -> int:
        return self.variacao.saldo if self.variacao is not None else 0

    def para_falta(self) -> dict:
        return {
            "id_variacao": self.variacao.id_variacao if self.variacao is not None else None,
            "sku": self.sku, "necessario": self.necessario, "disponivel": self.disponivel,
        }


def _baixas_do_pedido(db: Session, pedido: CamisetaPedido) -> list[Baixa]:
    agrupado: dict[tuple[int, int, int], Baixa] = {}
    for item in pedido.itens:
        for qtd in sorted(item.quantidades, key=lambda q: q.tamanho.ordem):
            chave = (item.id_modelo, item.id_cor, qtd.id_tamanho)
            existente = agrupado.get(chave)
            if existente is None:
                agrupado[chave] = Baixa(
                    sku=f"{item.modelo.nome_modelo} · {item.cor.nome} · {qtd.tamanho.rotulo}",
                    variacao=buscar_variacao(db, item.id_modelo, item.id_cor, qtd.id_tamanho),
                    necessario=qtd.quantidade,
                )
            else:
                agrupado[chave] = Baixa(
                    sku=existente.sku,
                    variacao=existente.variacao,
                    necessario=existente.necessario + qtd.quantidade,
                )
    return list(agrupado.values())


def _validar_para_entrega(pedido: CamisetaPedido, data_entrega: date, hoje: date) -> None:
    if pedido.status_pedido == STATUS_ENTREGUE:
        raise ErroNegocio(400, "Este pedido já foi registrado como Entregue anteriormente.")
    if data_entrega > hoje:
        raise ErroNegocio(400, "A data da entrega não pode ser futura.")
    if not pedido.itens:
        raise ErroNegocio(400, "O pedido não tem itens para entregar.")
    sem_cor = [item.modelo.nome_modelo for item in pedido.itens if item.id_cor is None]
    if sem_cor:
        raise ErroNegocio(400, f"Defina a cor dos itens antes de entregar: {', '.join(sem_cor)}.")


def _nota_de_entrega(data_entrega: date, dados: CamisetaPedidoEntregar) -> str:
    recebedor = f" | Recebido por: {dados.recebedor}" if dados.recebedor else ""
    obs_extra = f" | Obs: {dados.observacoes}" if dados.observacoes else ""
    return f"\n[ENTREGA REALIZADA em {data_entrega.strftime('%d/%m/%Y')}{recebedor}{obs_extra}]"


def registrar_entrega(db: Session, id_pedido: int, dados: CamisetaPedidoEntregar, hoje: date) -> CamisetaPedido:
    """Confere o saldo de cada SKU do pedido, baixa tudo e grava a data real da entrega."""
    pedido = obter_pedido(db, id_pedido)
    data_entrega = dados.data_entrega or hoje
    _validar_para_entrega(pedido, data_entrega, hoje)
    baixas = _baixas_do_pedido(db, pedido)
    faltas = [b.para_falta() for b in baixas if b.disponivel < b.necessario]
    if faltas:
        raise ErroNegocio(409, "Estoque pronto insuficiente para este pedido.", {"faltas": faltas})
    for baixa in baixas:
        movimentar(db, baixa.variacao, -baixa.necessario, SAIDA_ENTREGA,
                   motivo=f"Entrega do pedido {pedido.codigo_pedido}", id_pedido=pedido.id_pedido)
    pedido.observacoes = (pedido.observacoes or "") + _nota_de_entrega(data_entrega, dados)
    pedido.status_pedido = STATUS_ENTREGUE
    pedido.data_entrega_realizada = data_entrega
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return pedido


def estornar_entrega(db: Session, pedido: CamisetaPedido) -> None:
    """Devolve o que as saídas deste pedido tiraram. Pedidos entregues antes da Fase 1B não têm saídas: nada muda."""
    liquido: dict[int, int] = {}
    movimentos = db.query(CamisetaMovimentoEstoque).filter(
        CamisetaMovimentoEstoque.id_pedido == pedido.id_pedido,
        CamisetaMovimentoEstoque.tipo.in_((SAIDA_ENTREGA, ESTORNO_ENTREGA)),
    ).all()
    for movimento in movimentos:
        liquido[movimento.id_variacao] = liquido.get(movimento.id_variacao, 0) + movimento.quantidade
    for id_variacao, quantidade in liquido.items():
        if quantidade < 0:
            movimentar(db, db.get(CamisetaVariacao, id_variacao), -quantidade, ESTORNO_ENTREGA,
                       motivo=f"Entrega do pedido {pedido.codigo_pedido} revertida", id_pedido=pedido.id_pedido)


def atualizar_status(db: Session, id_pedido: int, novo_status: str) -> CamisetaPedido:
    pedido = obter_pedido(db, id_pedido)
    if novo_status not in STATUS_VALIDOS:
        raise ErroNegocio(400, f"Status inválido: '{novo_status}'. Use um destes: {', '.join(STATUS_VALIDOS)}.")
    if novo_status == STATUS_ENTREGUE and pedido.status_pedido != STATUS_ENTREGUE:
        raise ErroNegocio(
            400, "Para marcar o pedido como Entregue, use 'Registrar entrega': ela confere o estoque pronto antes da baixa.")
    if pedido.status_pedido == STATUS_ENTREGUE and novo_status != STATUS_ENTREGUE:
        estornar_entrega(db, pedido)
        pedido.data_entrega_realizada = None
    pedido.status_pedido = novo_status
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return pedido
