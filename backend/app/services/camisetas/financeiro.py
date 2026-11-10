# app/services/camisetas/financeiro.py
"""Apuração financeira mensal calculada a partir das movimentações reais.

Faturamento = pedidos com data de entrega no mês.
Gasto com materiais = notas fiscais (entradas de insumo) lançadas no mês.
Outros custos = lançamento manual do mês. Lucro = faturamento − gasto − outros.
"""
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.models.camisetas import CamisetaEntradaInsumo, CamisetaPedido, CamisetaRegistroFinanceiro

PADRAO_MES_ANO = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
DUAS_CASAS = Decimal("0.01")
NOMES_MESES = (
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
)


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

    @property
    def tem_dados_reais(self) -> bool:
        return self.qtd_pedidos_entregues > 0 or self.qtd_entradas > 0


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
    return Decimal(str(valor or 0)).quantize(DUAS_CASAS)


def apurar_mes(db: Session, mes_ano: str) -> ApuracaoMensal:
    ano, mes = validar_mes_ano(mes_ano)

    data_inicio, data_fim = _limites_em_datas(ano, mes)
    faturamento, qtd_pedidos = db.query(
        func.coalesce(func.sum(CamisetaPedido.valor_total), 0),
        func.count(CamisetaPedido.id_pedido),
    ).filter(
        CamisetaPedido.data_entrega_realizada >= data_inicio,
        CamisetaPedido.data_entrega_realizada < data_fim,
    ).one()

    utc_inicio, utc_fim = _limites_em_utc(ano, mes)
    gasto, qtd_entradas = db.query(
        func.coalesce(func.sum(CamisetaEntradaInsumo.valor_total), 0),
        func.count(CamisetaEntradaInsumo.id_entrada),
    ).filter(
        CamisetaEntradaInsumo.data_entrada >= utc_inicio,
        CamisetaEntradaInsumo.data_entrada < utc_fim,
    ).one()

    registro = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=mes_ano).first()
    outros = _decimal(registro.outros_custos_operacionais) if registro else _decimal(0)
    faturamento_dec = _decimal(faturamento)
    gasto_dec = _decimal(gasto)

    return ApuracaoMensal(
        mes_ano=mes_ano,
        mes_nome=NOMES_MESES[mes - 1],
        faturamento=faturamento_dec,
        gasto_materiais=gasto_dec,
        outros_custos=outros,
        lucro=faturamento_dec - gasto_dec - outros,
        qtd_pedidos_entregues=int(qtd_pedidos or 0),
        qtd_entradas=int(qtd_entradas or 0),
        id_registro=registro.id_registro if registro else None,
        observacoes=registro.observacoes if registro else None,
        criado_em=registro.criado_em if registro else None,
    )


def apurar_ano(db: Session, ano: int) -> list[ApuracaoMensal]:
    return [apurar_mes(db, f"{ano}-{mes:02d}") for mes in range(1, 13)]
