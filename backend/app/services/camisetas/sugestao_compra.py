# app/services/camisetas/sugestao_compra.py
"""Quanto comprar de tecido e de aviamento para os pedidos que vão entrar em produção.

Tecido e aviamento têm recortes diferentes porque o consumo acontece em momentos
diferentes no sistema:

- `abrir_op()` já subtrai o peso da malha do rolo na **criação** da OP;
- `enviar_remessa()` só baixa os aviamentos no **envio à facção**.

Por isso o tecido conta apenas pedidos que ainda não têm OP, e o aviamento conta as
peças que ainda não foram enviadas. Contar de outro jeito pede compra em dobro.
"""
from dataclasses import dataclass
from datetime import date
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.camisetas import (
    CamisetaCosturaFaccao,
    CamisetaFichaTecnica,
    CamisetaInsumo,
    CamisetaModelo,
    CamisetaOrdemProducao,
    CamisetaPedido,
)
from app.models.camisetas_cadastros import CamisetaCor
from app.services.camisetas.estoque import TIPO_TECIDO_PRINCIPAL, calcular_necessidades

DUAS_CASAS = Decimal("0.01")
TRES_CASAS = Decimal("0.001")
ZERO = Decimal("0")
CEM = Decimal("100")
CATEGORIA_TECIDO = "ROLO_TECIDO"
STATUS_A_PRODUZIR = ("Aguardando Produção", "Em Produção")
ORIGEM_CUSTO_MEDIO = "custo médio"
ORIGEM_FICHA = "estimado na ficha"
ORIGEM_SEM_PRECO = "sem preço"
# Unidades contadas em peças inteiras: não se compra 214,5 etiquetas. kg e metros são
# vendidos fracionados, e unidade desconhecida fica fracionada por segurança — arredondar
# um metro para cima é inofensivo, arredondar um quilo de malha não é.
UNIDADES_DISCRETAS = ("un", "uni", "unid", "unidade", "unidades", "peca", "peça", "pecas", "peças")


@dataclass(frozen=True)
class LinhaSugestao:
    """Uma linha de compra: o que falta de um insumo e quanto isso deve custar."""
    id_insumo: int
    codigo: str
    descricao: str
    unidade: str
    nome_cor: Optional[str]
    necessario: Decimal
    saldo_atual: Decimal
    estoque_minimo: Decimal
    comprar: Decimal
    preco_referencia: Decimal
    origem_preco: str
    custo_estimado: Decimal
    pecas: int
    embalagens: int          # quantas embalagens fechadas do fornecedor
    sobra: Decimal           # o que sobra depois de atender a necessidade


@dataclass(frozen=True)
class PedidoConsiderado:
    codigo_pedido: str
    nome_cliente: str
    status_pedido: str
    prazo_entrega: Optional[date]
    pecas: int
    conta_tecido: bool
    pecas_pendentes_aviamento: int


@dataclass(frozen=True)
class SugestaoCompra:
    tecidos: list[LinhaSugestao]
    aviamentos: list[LinhaSugestao]
    total_estimado: Decimal
    pedidos_considerados: list[PedidoConsiderado]
    alertas: list[str]


def _dec(valor) -> Decimal:
    return Decimal(str(valor or 0))


def _pecas_do_pedido(pedido: CamisetaPedido) -> int:
    if pedido.itens:
        return sum(q.quantidade for item in pedido.itens for q in item.quantidades)
    return int(pedido.quantidade_total or 0)


def _itens_com_cor(pedido: CamisetaPedido) -> list[tuple[int, Optional[int], int]]:
    """(modelo, cor, peças) por item. Pedido legado, sem itens, vira um item sem cor."""
    if not pedido.itens:
        return [(pedido.id_modelo, None, _pecas_do_pedido(pedido))]
    return [
        (item.id_modelo, item.id_cor, sum(q.quantidade for q in item.quantidades))
        for item in pedido.itens
    ]


def _pedidos_a_produzir(db: Session) -> list[CamisetaPedido]:
    return (
        db.query(CamisetaPedido)
        .filter(CamisetaPedido.status_pedido.in_(STATUS_A_PRODUZIR))
        .order_by(CamisetaPedido.prazo_entrega, CamisetaPedido.id_pedido)
        .all()
    )


def _pedidos_com_op(db: Session, ids: list[int]) -> set[int]:
    linhas = (
        db.query(CamisetaOrdemProducao.id_pedido)
        .filter(CamisetaOrdemProducao.id_pedido.in_(ids))
        .distinct()
        .all()
    )
    return {id_pedido for (id_pedido,) in linhas}


def _pecas_enviadas(db: Session, ids: list[int]) -> dict[tuple[int, int], int]:
    """Peças já enviadas à facção, por (pedido, modelo) — essas já consumiram aviamento."""
    linhas = (
        db.query(
            CamisetaOrdemProducao.id_pedido,
            CamisetaOrdemProducao.id_modelo,
            func.coalesce(func.sum(CamisetaCosturaFaccao.quantidade_enviada), 0),
        )
        .join(CamisetaCosturaFaccao, CamisetaCosturaFaccao.id_op == CamisetaOrdemProducao.id_op)
        .filter(CamisetaOrdemProducao.id_pedido.in_(ids))
        .group_by(CamisetaOrdemProducao.id_pedido, CamisetaOrdemProducao.id_modelo)
        .all()
    )
    return {(pedido, modelo): int(qtd or 0) for pedido, modelo, qtd in linhas}


def _kg_por_peca_historico(db: Session) -> dict[int, Decimal]:
    """kg de malha por peça a partir do rendimento real das OPs já cortadas.

    O rendimento real embute a perda do enfesto, então quem usa este número não
    aplica margem de segurança por cima.
    """
    linhas = (
        db.query(CamisetaOrdemProducao.id_modelo, func.avg(CamisetaOrdemProducao.rendimento_real_pecas_kg))
        .filter(CamisetaOrdemProducao.rendimento_real_pecas_kg > 0)
        .group_by(CamisetaOrdemProducao.id_modelo)
        .all()
    )
    return {
        id_modelo: Decimal("1") / _dec(rendimento)
        for id_modelo, rendimento in linhas
        if _dec(rendimento) > ZERO
    }


def _precos_da_ficha(db: Session) -> dict[int, Decimal]:
    """Custo estimado por insumo na ficha técnica, usado quando não há custo médio."""
    linhas = (
        db.query(CamisetaFichaTecnica.id_insumo, func.max(CamisetaFichaTecnica.custo_unitario_estimado))
        .filter(CamisetaFichaTecnica.id_insumo.isnot(None))
        .group_by(CamisetaFichaTecnica.id_insumo)
        .all()
    )
    return {id_insumo: _dec(preco) for id_insumo, preco in linhas}


def _rolo_da_cor(db: Session, id_cor: int) -> Optional[CamisetaInsumo]:
    """O rolo de malha daquela cor; havendo mais de um, o de maior saldo."""
    return (
        db.query(CamisetaInsumo)
        .filter(CamisetaInsumo.categoria == CATEGORIA_TECIDO, CamisetaInsumo.id_cor == id_cor)
        .order_by(CamisetaInsumo.saldo_atual.desc())
        .first()
    )


def _arredondar_compra(quantidade: Decimal, unidade: Optional[str],
                       embalagem: Optional[Decimal] = None) -> Decimal:
    """Quantidade pedida ao fornecedor, na granularidade em que o insumo é vendido.

    Com embalagem fechada cadastrada, sobe para o próximo múltiplo dela: não se compra meia
    caixa de etiquetas. Sem embalagem, insumo contado em peças sobe para o inteiro seguinte
    — 215 etiquetas em vez de 214,5.

    Arredonda para cima nos dois casos porque faltar aviamento para a produção custa muito
    mais que sobrar material na prateleira.
    """
    if quantidade <= ZERO:
        return ZERO.quantize(TRES_CASAS)

    pacote = _dec(embalagem)
    if pacote > ZERO:
        pacotes = (quantidade / pacote).quantize(Decimal("1"), rounding=ROUND_CEILING)
        return (pacotes * pacote).quantize(TRES_CASAS, rounding=ROUND_HALF_UP)

    if str(unidade or "").strip().lower() in UNIDADES_DISCRETAS:
        return quantidade.quantize(Decimal("1"), rounding=ROUND_CEILING)
    return quantidade.quantize(TRES_CASAS, rounding=ROUND_HALF_UP)


def _embalagem_do_insumo(insumo: CamisetaInsumo) -> Decimal:
    """Rolo de malha não tem peso fixo na vida real, então a embalagem não vale para tecido.

    Se alguém preencher o campo num ROLO_TECIDO, a sugestão ignora em vez de pedir um peso
    redondo que o fornecedor não garante.
    """
    if insumo.categoria == CATEGORIA_TECIDO:
        return ZERO
    return _dec(insumo.embalagem_compra)


def _montar_linha(insumo: CamisetaInsumo, necessario: Decimal, pecas: int,
                  nome_cor: Optional[str], preco_ficha: Decimal) -> LinhaSugestao:
    saldo = _dec(insumo.saldo_atual)
    minimo = _dec(insumo.estoque_minimo)
    nec = necessario.quantize(TRES_CASAS, rounding=ROUND_HALF_UP)
    falta = max(ZERO, nec - saldo + minimo)
    embalagem = _embalagem_do_insumo(insumo)
    comprar = _arredondar_compra(falta, insumo.unidade_medida, embalagem)
    embalagens = int(comprar / embalagem) if embalagem > ZERO and comprar > ZERO else 0
    sobra = (comprar - falta).quantize(TRES_CASAS, rounding=ROUND_HALF_UP) if comprar > ZERO else ZERO

    custo_medio = _dec(insumo.preco_custo_medio)
    if custo_medio > ZERO:
        preco, origem = custo_medio, ORIGEM_CUSTO_MEDIO
    elif preco_ficha > ZERO:
        preco, origem = preco_ficha, ORIGEM_FICHA
    else:
        preco, origem = ZERO, ORIGEM_SEM_PRECO

    return LinhaSugestao(
        id_insumo=insumo.id_insumo,
        codigo=insumo.codigo,
        descricao=insumo.tipo_malha_ou_aviamento,
        unidade=insumo.unidade_medida,
        nome_cor=nome_cor,
        necessario=nec,
        saldo_atual=saldo.quantize(TRES_CASAS),
        estoque_minimo=minimo.quantize(TRES_CASAS),
        comprar=comprar,
        preco_referencia=preco.quantize(DUAS_CASAS, rounding=ROUND_HALF_UP),
        origem_preco=origem,
        custo_estimado=(comprar * preco).quantize(DUAS_CASAS, rounding=ROUND_HALF_UP),
        pecas=pecas,
        embalagens=embalagens,
        sobra=sobra,
    )


def _linhas_de_tecido(db: Session, pedidos: list[CamisetaPedido], com_op: set[int],
                      kg_historico: dict[int, Decimal], margem: Decimal,
                      precos_ficha: dict[int, Decimal]) -> tuple[list[LinhaSugestao], list[str]]:
    multiplicador = Decimal("1") + margem / CEM
    kg_por_cor: dict[int, Decimal] = {}
    pecas_por_cor: dict[int, int] = {}
    sem_cor: list[str] = []
    sem_historico: dict[int, str] = {}

    for pedido in pedidos:
        if pedido.id_pedido in com_op:
            continue  # a OP desse pedido já tirou a malha do rolo
        for id_modelo, id_cor, pecas in _itens_com_cor(pedido):
            if pecas <= 0:
                continue
            if id_cor is None:
                sem_cor.append(f"{pedido.codigo_pedido} ({pecas} peça(s))")
                continue
            modelo = db.get(CamisetaModelo, id_modelo)
            kg_peca = kg_historico.get(id_modelo)
            if kg_peca is None:
                kg_peca = _dec(modelo.consumo_tecido_kg) * multiplicador
                sem_historico[id_modelo] = modelo.nome_modelo
            kg_por_cor[id_cor] = kg_por_cor.get(id_cor, ZERO) + kg_peca * pecas
            pecas_por_cor[id_cor] = pecas_por_cor.get(id_cor, 0) + pecas

    linhas: list[LinhaSugestao] = []
    alertas: list[str] = []
    for id_cor, kg in sorted(kg_por_cor.items()):
        cor = db.get(CamisetaCor, id_cor)
        nome_cor = cor.nome if cor else None
        rolo = _rolo_da_cor(db, id_cor)
        if rolo is None:
            alertas.append(
                f"A cor {nome_cor} precisa de {kg.quantize(TRES_CASAS)} kg de malha, "
                f"mas não há rolo de tecido cadastrado nessa cor."
            )
            continue
        linhas.append(_montar_linha(rolo, kg, pecas_por_cor[id_cor], nome_cor,
                                    precos_ficha.get(rolo.id_insumo, ZERO)))

    if sem_cor:
        alertas.append(
            "Sem cor definida, não há como sugerir malha para: " + ", ".join(sem_cor) + "."
        )
    for nome in sorted(sem_historico.values()):
        alertas.append(
            f"O modelo {nome} ainda não tem OP cortada: os kg vêm do consumo cadastrado "
            f"(com {margem}% de margem), não do rendimento real do enfesto."
        )
    return linhas, alertas


def _pecas_pendentes_por_modelo(pedidos: list[CamisetaPedido],
                                enviadas: dict[tuple[int, int], int]) -> dict[int, int]:
    pendentes: dict[int, int] = {}
    for pedido in pedidos:
        for id_modelo, pecas in _pecas_por_modelo(pedido).items():
            falta = max(0, pecas - enviadas.get((pedido.id_pedido, id_modelo), 0))
            if falta > 0:
                pendentes[id_modelo] = pendentes.get(id_modelo, 0) + falta
    return pendentes


def _pecas_por_modelo(pedido: CamisetaPedido) -> dict[int, int]:
    por_modelo: dict[int, int] = {}
    for id_modelo, _cor, pecas in _itens_com_cor(pedido):
        por_modelo[id_modelo] = por_modelo.get(id_modelo, 0) + pecas
    return por_modelo


def _linhas_de_aviamento(db: Session, pendentes: dict[int, int], margem: Decimal,
                         precos_ficha: dict[int, Decimal]) -> tuple[list[LinhaSugestao], list[str]]:
    quantidade_por_insumo: dict[int, Decimal] = {}
    pecas_por_insumo: dict[int, int] = {}
    insumos: dict[int, CamisetaInsumo] = {}

    for id_modelo, pecas in pendentes.items():
        itens_ficha = (
            db.query(CamisetaFichaTecnica)
            .filter(
                CamisetaFichaTecnica.id_modelo == id_modelo,
                CamisetaFichaTecnica.tipo_insumo != TIPO_TECIDO_PRINCIPAL,
            )
            .all()
        )
        for necessidade in calcular_necessidades(itens_ficha, pecas, margem):
            chave = necessidade.insumo.id_insumo
            insumos[chave] = necessidade.insumo
            quantidade_por_insumo[chave] = quantidade_por_insumo.get(chave, ZERO) + necessidade.quantidade
            pecas_por_insumo[chave] = pecas_por_insumo.get(chave, 0) + pecas

    linhas = [
        _montar_linha(insumos[chave], quantidade, pecas_por_insumo[chave], None,
                      precos_ficha.get(chave, ZERO))
        for chave, quantidade in sorted(quantidade_por_insumo.items())
    ]
    return linhas, []


def _alertas_de_preco(linhas: list[LinhaSugestao]) -> list[str]:
    sem_preco = [linha.codigo for linha in linhas if linha.origem_preco == ORIGEM_SEM_PRECO]
    if not sem_preco:
        return []
    return [
        "Sem preço de referência (nem custo médio, nem estimado na ficha) para: "
        + ", ".join(sorted(sem_preco))
        + ". O custo estimado desses itens está zerado."
    ]


def sugerir_compra(db: Session, margem_percentual: Decimal) -> SugestaoCompra:
    """Sugestão de compra consolidada dos pedidos que vão entrar em produção."""
    margem = _dec(margem_percentual)
    pedidos = _pedidos_a_produzir(db)
    if not pedidos:
        return SugestaoCompra([], [], ZERO.quantize(DUAS_CASAS), [], [])

    ids = [p.id_pedido for p in pedidos]
    com_op = _pedidos_com_op(db, ids)
    enviadas = _pecas_enviadas(db, ids)
    precos_ficha = _precos_da_ficha(db)
    pendentes = _pecas_pendentes_por_modelo(pedidos, enviadas)

    tecidos, alertas_tecido = _linhas_de_tecido(
        db, pedidos, com_op, _kg_por_peca_historico(db), margem, precos_ficha
    )
    aviamentos, alertas_aviamento = _linhas_de_aviamento(db, pendentes, margem, precos_ficha)

    considerados = [
        PedidoConsiderado(
            codigo_pedido=pedido.codigo_pedido,
            nome_cliente=pedido.nome_cliente,
            status_pedido=pedido.status_pedido,
            prazo_entrega=pedido.prazo_entrega,
            pecas=_pecas_do_pedido(pedido),
            conta_tecido=pedido.id_pedido not in com_op,
            pecas_pendentes_aviamento=sum(
                max(0, pecas - enviadas.get((pedido.id_pedido, id_modelo), 0))
                for id_modelo, pecas in _pecas_por_modelo(pedido).items()
            ),
        )
        for pedido in pedidos
    ]

    linhas = tecidos + aviamentos
    total = sum((linha.custo_estimado for linha in linhas), ZERO)
    return SugestaoCompra(
        tecidos=tecidos,
        aviamentos=aviamentos,
        total_estimado=total.quantize(DUAS_CASAS, rounding=ROUND_HALF_UP),
        pedidos_considerados=considerados,
        alertas=alertas_tecido + alertas_aviamento + _alertas_de_preco(linhas),
    )
