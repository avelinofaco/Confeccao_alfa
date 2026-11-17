# app/services/camisetas/financeiro.py
"""Apuração financeira mensal, despesas operacionais categorizadas, contas a pagar/receber e DRE.

Faturamento = pedidos com data de entrega no mês.
Gasto com materiais = notas fiscais (entradas de insumo) lançadas no mês.
Despesas operacionais = despesas categorizadas do mês + outros custos avulsos do mês.
Lucro = faturamento − gasto − despesas operacionais.
"""
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.core.erros import ErroNegocio
from app.models.camisetas import (
    CamisetaDespesa,
    CamisetaEntradaInsumo,
    CamisetaPedido,
    CamisetaRegistroFinanceiro,
)
from app.schemas.camisetas import (
    CamisetaDespesaCreate,
    CamisetaDespesaPagar,
    CamisetaDespesaResponse,
    CamisetaDreMensalResponse,
    CamisetaPedidoFinanceiroItem,
    CamisetaPedidoPagamentoUpdate,
)

PADRAO_MES_ANO = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
DUAS_CASAS = Decimal("0.01")
ZERO = Decimal("0.00")
NOMES_MESES = (
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
)
CATEGORIAS_DESPESA = (
    "FACCAO",
    "ESTAMPARIA",
    "ALUGUEL",
    "ENERGIA_AGUA",
    "FOLHA",
    "IMPOSTOS",
    "FRETE",
    "OUTROS",
)
STATUS_PAGAMENTO_VALIDOS = ("Pendente", "Pago")


class MesAnoInvalido(ValueError):
    """Mês fora do formato AAAA-MM."""


@dataclass(frozen=True)
class ApuracaoMensal:
    mes_ano: str
    mes_nome: str
    faturamento: Decimal
    gasto_materiais: Decimal
    outros_custos: Decimal
    lucro: Decimal
    qtd_pedidos_entregues: int
    qtd_entradas: int
    id_registro: Optional[int]
    observacoes: Optional[str]
    criado_em: Optional[datetime]
    qtd_despesas: int = 0
    total_despesas_lancadas: Decimal = ZERO
    despesas_pagas: Decimal = ZERO
    despesas_pendentes: Decimal = ZERO
    outros_custos_avulsos: Decimal = ZERO
    receita_recebida: Decimal = ZERO
    receita_a_receber: Decimal = ZERO
    despesas_por_categoria: dict[str, Decimal] = field(default_factory=dict)

    @property
    def tem_dados_reais(self) -> bool:
        return self.qtd_pedidos_entregues > 0 or self.qtd_entradas > 0 or self.qtd_despesas > 0


def validar_mes_ano(mes_ano: str) -> tuple[int, int]:
    if not mes_ano or not PADRAO_MES_ANO.match(mes_ano):
        raise MesAnoInvalido(f"Mês inválido: '{mes_ano}'. Use o formato AAAA-MM, ex.: 2026-10.")
    ano, mes = mes_ano.split("-")
    return int(ano), int(mes)


def _primeiro_dia_do_mes_seguinte(ano: int, mes: int) -> tuple[int, int]:
    return (ano + 1, 1) if mes == 12 else (ano, mes + 1)


def _limites_em_datas(ano: int, mes: int) -> tuple[date, date]:
    ano_fim, mes_fim = _primeiro_dia_do_mes_seguinte(ano, mes)
    return date(ano, mes, 1), date(ano_fim, mes_fim, 1)


def _limites_em_utc(ano: int, mes: int) -> tuple[datetime, datetime]:
    """Início e fim do mês no fuso do negócio, convertidos para UTC (como as datas são gravadas)."""
    ano_fim, mes_fim = _primeiro_dia_do_mes_seguinte(ano, mes)
    inicio = datetime(ano, mes, 1, tzinfo=FUSO_HORARIO).astimezone(timezone.utc)
    fim = datetime(ano_fim, mes_fim, 1, tzinfo=FUSO_HORARIO).astimezone(timezone.utc)
    return inicio, fim


def _decimal(valor) -> Decimal:
    return Decimal(str(valor or 0)).quantize(DUAS_CASAS, rounding=ROUND_HALF_UP)


def _hoje() -> date:
    return datetime.now(FUSO_HORARIO).date()


def apurar_mes(db: Session, mes_ano: str) -> ApuracaoMensal:
    ano, mes = validar_mes_ano(mes_ano)

    data_inicio, data_fim = _limites_em_datas(ano, mes)
    pedidos_mes = (
        db.query(CamisetaPedido)
        .filter(
            CamisetaPedido.data_entrega_realizada >= data_inicio,
            CamisetaPedido.data_entrega_realizada < data_fim,
        )
        .all()
    )
    faturamento_dec = sum((_decimal(p.valor_total) for p in pedidos_mes), ZERO)
    receita_recebida = sum(
        (_decimal(p.valor_total) for p in pedidos_mes if p.status_pagamento == "Pago"),
        ZERO,
    )
    receita_a_receber = faturamento_dec - receita_recebida
    qtd_pedidos = len(pedidos_mes)

    utc_inicio, utc_fim = _limites_em_utc(ano, mes)
    gasto, qtd_entradas = db.query(
        func.coalesce(func.sum(CamisetaEntradaInsumo.valor_total), 0),
        func.count(CamisetaEntradaInsumo.id_entrada),
    ).filter(
        CamisetaEntradaInsumo.data_entrada >= utc_inicio,
        CamisetaEntradaInsumo.data_entrada < utc_fim,
    ).one()

    despesas_mes = (
        db.query(CamisetaDespesa)
        .filter(CamisetaDespesa.mes_ano == mes_ano)
        .all()
    )
    total_despesas_lancadas = sum((_decimal(d.valor) for d in despesas_mes), ZERO)
    despesas_pagas = sum(
        (_decimal(d.valor) for d in despesas_mes if d.status_pagamento == "Pago"),
        ZERO,
    )
    despesas_pendentes = total_despesas_lancadas - despesas_pagas
    por_categoria: dict[str, Decimal] = {}
    for d in despesas_mes:
        por_categoria[d.categoria] = por_categoria.get(d.categoria, ZERO) + _decimal(d.valor)

    registro = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=mes_ano).first()
    outros_avulsos = _decimal(registro.outros_custos_operacionais) if registro else ZERO
    outros_total = outros_avulsos + total_despesas_lancadas
    gasto_dec = _decimal(gasto)

    return ApuracaoMensal(
        mes_ano=mes_ano,
        mes_nome=NOMES_MESES[mes - 1],
        faturamento=faturamento_dec,
        gasto_materiais=gasto_dec,
        outros_custos=outros_total,
        lucro=faturamento_dec - gasto_dec - outros_total,
        qtd_pedidos_entregues=int(qtd_pedidos or 0),
        qtd_entradas=int(qtd_entradas or 0),
        id_registro=registro.id_registro if registro else None,
        observacoes=registro.observacoes if registro else None,
        criado_em=registro.criado_em if registro else None,
        qtd_despesas=len(despesas_mes),
        total_despesas_lancadas=total_despesas_lancadas,
        despesas_pagas=despesas_pagas,
        despesas_pendentes=despesas_pendentes,
        outros_custos_avulsos=outros_avulsos,
        receita_recebida=receita_recebida,
        receita_a_receber=receita_a_receber,
        despesas_por_categoria=por_categoria,
    )


def apurar_ano(db: Session, ano: int) -> list[ApuracaoMensal]:
    return [apurar_mes(db, f"{ano}-{mes:02d}") for mes in range(1, 13)]


def listar_despesas(db: Session, mes_ano: str) -> list[CamisetaDespesa]:
    validar_mes_ano(mes_ano)
    return (
        db.query(CamisetaDespesa)
        .filter(CamisetaDespesa.mes_ano == mes_ano)
        .order_by(CamisetaDespesa.id_despesa.desc())
        .all()
    )


def criar_despesa(db: Session, dados: CamisetaDespesaCreate) -> CamisetaDespesa:
    validar_mes_ano(dados.mes_ano)
    categoria = (dados.categoria or "").strip().upper()
    if categoria not in CATEGORIAS_DESPESA:
        raise ErroNegocio(
            400,
            f"Categoria de despesa inválida: '{dados.categoria}'. Use uma destas: {', '.join(CATEGORIAS_DESPESA)}.",
        )
    descricao = " ".join((dados.descricao or "").split())
    if not descricao:
        raise ErroNegocio(400, "Informe a descrição da despesa.")
    if dados.status_pagamento not in STATUS_PAGAMENTO_VALIDOS:
        raise ErroNegocio(400, "Status de pagamento inválido: use 'Pago' ou 'Pendente'.")
    data_pag = dados.data_pagamento
    if dados.status_pagamento == "Pago" and data_pag is None:
        data_pag = _hoje()
    if dados.status_pagamento == "Pendente":
        data_pag = None

    despesa = CamisetaDespesa(
        mes_ano=dados.mes_ano,
        categoria=categoria,
        descricao=descricao,
        valor=_decimal(dados.valor),
        data_vencimento=dados.data_vencimento,
        data_pagamento=data_pag,
        status_pagamento=dados.status_pagamento,
    )
    db.add(despesa)
    db.commit()
    db.refresh(despesa)
    return despesa


def quitar_despesa(db: Session, id_despesa: int, dados: CamisetaDespesaPagar) -> CamisetaDespesa:
    despesa = db.get(CamisetaDespesa, id_despesa)
    if despesa is None:
        raise ErroNegocio(404, "Despesa não encontrada.")
    despesa.status_pagamento = "Pago"
    despesa.data_pagamento = dados.data_pagamento or _hoje()
    db.commit()
    db.refresh(despesa)
    return despesa


def excluir_despesa(db: Session, id_despesa: int) -> None:
    despesa = db.get(CamisetaDespesa, id_despesa)
    if despesa is None:
        raise ErroNegocio(404, "Despesa não encontrada.")
    db.delete(despesa)
    db.commit()


def atualizar_pagamento_pedido(
    db: Session, id_pedido: int, dados: CamisetaPedidoPagamentoUpdate
) -> CamisetaPedidoFinanceiroItem:
    pedido = db.get(CamisetaPedido, id_pedido)
    if pedido is None:
        raise ErroNegocio(404, "Pedido não encontrado.")
    if dados.status_pagamento not in STATUS_PAGAMENTO_VALIDOS:
        raise ErroNegocio(400, "Status de pagamento inválido: use 'Pago' ou 'Pendente'.")
    pedido.status_pagamento = dados.status_pagamento
    if dados.status_pagamento == "Pago":
        pedido.data_pagamento = dados.data_pagamento or _hoje()
    else:
        pedido.data_pagamento = None
    db.commit()
    db.refresh(pedido)
    return CamisetaPedidoFinanceiroItem(
        id_pedido=pedido.id_pedido,
        codigo_pedido=pedido.codigo_pedido,
        nome_cliente=pedido.nome_cliente,
        valor_total=_decimal(pedido.valor_total),
        data_entrega_realizada=pedido.data_entrega_realizada,
        status_pagamento=pedido.status_pagamento,
        data_pagamento=pedido.data_pagamento,
    )


def apurar_dre_mensal(db: Session, mes_ano: str) -> CamisetaDreMensalResponse:
    ano, mes = validar_mes_ano(mes_ano)
    apuracao = apurar_mes(db, mes_ano)
    despesas = listar_despesas(db, mes_ano)
    data_inicio, data_fim = _limites_em_datas(ano, mes)
    pedidos = (
        db.query(CamisetaPedido)
        .filter(
            CamisetaPedido.data_entrega_realizada >= data_inicio,
            CamisetaPedido.data_entrega_realizada < data_fim,
        )
        .order_by(CamisetaPedido.data_entrega_realizada.desc(), CamisetaPedido.id_pedido.desc())
        .all()
    )
    margem_bruta = apuracao.faturamento - apuracao.gasto_materiais
    margem_liq_pct = (
        ((apuracao.lucro / apuracao.faturamento) * Decimal("100")).quantize(DUAS_CASAS, rounding=ROUND_HALF_UP)
        if apuracao.faturamento > ZERO
        else ZERO
    )
    return CamisetaDreMensalResponse(
        mes_ano=mes_ano,
        faturamento_entregas=apuracao.faturamento,
        receita_recebida=apuracao.receita_recebida,
        receita_a_receber=apuracao.receita_a_receber,
        gasto_materiais=apuracao.gasto_materiais,
        margem_bruta=margem_bruta,
        total_despesas_lancadas=apuracao.total_despesas_lancadas,
        despesas_pagas=apuracao.despesas_pagas,
        despesas_pendentes=apuracao.despesas_pendentes,
        outros_custos_avulsos=apuracao.outros_custos_avulsos,
        total_despesas_operacionais=apuracao.outros_custos,
        lucro_liquido=apuracao.lucro,
        margem_liquida_percentual=margem_liq_pct,
        despesas_por_categoria=apuracao.despesas_por_categoria,
        despesas=[CamisetaDespesaResponse.model_validate(d) for d in despesas],
        pedidos_do_mes=[
            CamisetaPedidoFinanceiroItem(
                id_pedido=p.id_pedido,
                codigo_pedido=p.codigo_pedido,
                nome_cliente=p.nome_cliente,
                valor_total=_decimal(p.valor_total),
                data_entrega_realizada=p.data_entrega_realizada,
                status_pagamento=p.status_pagamento or "Pendente",
                data_pagamento=p.data_pagamento,
            )
            for p in pedidos
        ],
    )
