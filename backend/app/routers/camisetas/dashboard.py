# app/routers/camisetas/dashboard.py
"""Indicadores do Dashboard do segmento Camisetas (somente dados reais)."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.database import get_db
from app.models.camisetas import (
    CamisetaCosturaFaccao,
    CamisetaInsumo,
    CamisetaOrdemProducao,
    CamisetaPedido,
    CamisetaProdutoAcabado,
)
from app.schemas.camisetas import (
    CamisetaCardDestaque,
    CamisetaDashboardCompletoResponse,
    CamisetaItemFinanceiroMensal,
)
from app.services.camisetas.financeiro import apurar_ano
from app.services.camisetas.pedidos import STATUS_ENTREGUE

router = APIRouter()
DUAS_CASAS = Decimal("0.01")


def _tecido_de_maior_rendimento(db: Session) -> tuple[Optional[str], Optional[Decimal]]:
    linha = (
        db.query(
            CamisetaInsumo.tipo_malha_ou_aviamento.label("nome_tecido"),
            func.avg(CamisetaOrdemProducao.rendimento_real_pecas_kg).label("media_rendimento"),
        )
        .join(CamisetaOrdemProducao, CamisetaOrdemProducao.id_insumo_tecido == CamisetaInsumo.id_insumo)
        .filter(
            CamisetaOrdemProducao.rendimento_real_pecas_kg.isnot(None),
            CamisetaOrdemProducao.rendimento_real_pecas_kg > 0,
        )
        .group_by(CamisetaInsumo.tipo_malha_ou_aviamento)
        .order_by(desc("media_rendimento"))
        .first()
    )
    if not linha or not linha.nome_tecido or linha.media_rendimento is None:
        return None, None
    return str(linha.nome_tecido), Decimal(str(linha.media_rendimento)).quantize(DUAS_CASAS)


def _soma(db: Session, coluna, *filtros) -> int:
    return int(db.query(func.coalesce(func.sum(coluna), 0)).filter(*filtros).scalar() or 0)


@router.get("/dashboard/", response_model=CamisetaDashboardCompletoResponse)
def obter_metricas_dashboard(db: Session = Depends(get_db)):
    total_cortado = _soma(db, CamisetaOrdemProducao.pecas_reais_cortadas)
    total_costurado = _soma(db, CamisetaCosturaFaccao.saldo_aprovado)
    total_entregue = _soma(db, CamisetaPedido.quantidade_total, CamisetaPedido.status_pedido == STATUS_ENTREGUE)
    total_estoque_pronto = _soma(db, CamisetaProdutoAcabado.quantidade_total)
    criticos = db.query(CamisetaInsumo).filter(CamisetaInsumo.saldo_atual <= CamisetaInsumo.estoque_minimo).count()

    # Regra mantida: a produção total é abatida pelas peças já entregues aos clientes.
    producao_liquida = max(0, max(total_cortado, total_costurado) - total_entregue)
    tecido_top, rendimento_top = _tecido_de_maior_rendimento(db)

    ano_atual = datetime.now(FUSO_HORARIO).year
    grafico = [
        CamisetaItemFinanceiroMensal(
            mes_ano=a.mes_ano,
            mes_nome=a.mes_nome,
            materiais_gastos=a.gasto_materiais,
            lucro_liquido=a.lucro,
            faturamento=a.faturamento,
        )
        for a in apurar_ano(db, ano_atual)
    ]

    return CamisetaDashboardCompletoResponse(
        cards=CamisetaCardDestaque(
            producao_total_acumulada=producao_liquida,
            estoque_critico_quantidade=criticos,
            tecido_maior_rendimento=tecido_top,
            rendimento_medio_tecido=rendimento_top,
            estoque_pronto_total=total_estoque_pronto,
            total_entregue_acumulado=total_entregue,
        ),
        grafico_financeiro_12_meses=grafico,
    )
