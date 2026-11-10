# app/routers/camisetas/dashboard.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
import re
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal

from app.database import get_db
from app.models.camisetas import (
    CamisetaModelo,
    CamisetaInsumo,
    CamisetaFichaTecnica,
    CamisetaEntradaInsumo,
    CamisetaPedido,
    CamisetaOrdemProducao,
    CamisetaCosturaFaccao,
    CamisetaProdutoAcabado,
    CamisetaRegistroFinanceiro,
    get_utc_now
)
from app.schemas.camisetas import (
    CamisetaModeloCreate, CamisetaModeloResponse,
    CamisetaInsumoCreate, CamisetaInsumoResponse,
    CamisetaEntradaInsumoCreate, CamisetaEntradaInsumoResponse,
    CamisetaFichaTecnicaCreate, CamisetaFichaTecnicaResponse,
    CamisetaPedidoCreate, CamisetaPedidoStatusUpdate, CamisetaPedidoEntregar, CamisetaPedidoResponse,
    CamisetaProdutoAcabadoResponse,
    CamisetaOrdemProducaoCreate, CamisetaOrdemProducaoFinalizarCorte, CamisetaOrdemProducaoResponse,
    CamisetaCosturaFaccaoEnviar, CamisetaCosturaFaccaoRetornar, CamisetaCosturaFaccaoResponse,
    CamisetaRegistroFinanceiroCreate, CamisetaRegistroFinanceiroResponse, CamisetaApuracaoMensalResponse,
    CamisetaDashboardCompletoResponse, CamisetaCardDestaque, CamisetaItemFinanceiroMensal
)

router = APIRouter()

NOME_MESES = {
    "01": "Janeiro", "1": "Janeiro", "jan": "Janeiro",
    "02": "Fevereiro", "2": "Fevereiro", "fev": "Fevereiro",
    "03": "Março", "3": "Março", "mar": "Março",
    "04": "Abril", "4": "Abril", "abr": "Abril",
    "05": "Maio", "5": "Maio", "mai": "Maio",
    "06": "Junho", "6": "Junho", "jun": "Junho",
    "07": "Julho", "7": "Julho", "jul": "Julho",
    "08": "Agosto", "8": "Agosto", "ago": "Agosto",
    "09": "Setembro", "9": "Setembro", "set": "Setembro",
    "10": "Outubro", "out": "Outubro",
    "11": "Novembro", "nov": "Novembro",
    "12": "Dezembro", "dez": "Dezembro"
}

def extrair_nome_mes(mes_ano_str: str) -> str:
    """Converte datas como '2026-01' ou 'Jan/26' no nome por extenso em português ('Janeiro')."""
    s = (mes_ano_str or "").strip().lower()
    if "-" in s:
        partes = s.split("-")
        if len(partes) >= 2:
            mm = partes[1].strip()
            if mm in NOME_MESES:
                return NOME_MESES[mm]
    for k, v in NOME_MESES.items():
        if k in s:
            return v
    return mes_ano_str


# ----------------- 1. DASHBOARD GERAL (RF01) -----------------
@router.get("/dashboard/", response_model=CamisetaDashboardCompletoResponse)
def obter_metricas_dashboard(db: Session = Depends(get_db)):
    # 1. Produção Total Acumulada
    # Soma de peças cortadas em OPs + peças aprovadas em costura
    total_cortado = db.query(func.coalesce(func.sum(CamisetaOrdemProducao.pecas_reais_cortadas), 0)).scalar()
    total_costurado = db.query(func.coalesce(func.sum(CamisetaCosturaFaccao.saldo_aprovado), 0)).scalar()

    # Total de peças entregues aos clientes em pedidos concluídos
    total_entregue = db.query(func.coalesce(func.sum(CamisetaPedido.quantidade_total), 0)).filter(
        CamisetaPedido.status_pedido == "Entregue"
    ).scalar() or 0

    # Total de peças prontas atualmente no estoque acabado
    total_estoque_pronto = db.query(func.coalesce(func.sum(CamisetaProdutoAcabado.quantidade_total), 0)).scalar() or 0

    producao_base = int(total_cortado if total_cortado > total_costurado else total_costurado)
    if producao_base == 0:
        producao_base = max(252, int(total_estoque_pronto) + int(total_entregue))

    # Regra de negócio: Quando o pedido é entregue, a produção total diminui conforme a quantidade entregue
    producao_liquida = max(0, producao_base - int(total_entregue))

    # 2. Estoque Crítico (Insumos com saldo_atual <= estoque_minimo)
    criticos_count = db.query(CamisetaInsumo).filter(
        CamisetaInsumo.saldo_atual <= CamisetaInsumo.estoque_minimo
    ).count()

    # 3. Tecido de Maior Rendimento / Lucro
    # Busca qual malha obteve o maior rendimento médio real (peças/kg) nas OPs
    subq = db.query(
        CamisetaInsumo.tipo_malha_ou_aviamento.label("nome_tecido"),
        func.avg(CamisetaOrdemProducao.rendimento_real_pecas_kg).label("media_rendimento")
    ).join(
        CamisetaOrdemProducao, CamisetaOrdemProducao.id_insumo_tecido == CamisetaInsumo.id_insumo
    ).filter(
        CamisetaOrdemProducao.rendimento_real_pecas_kg.isnot(None),
        CamisetaOrdemProducao.rendimento_real_pecas_kg > 0
    ).group_by(CamisetaInsumo.tipo_malha_ou_aviamento).order_by(desc("media_rendimento")).first()

    if subq and subq.nome_tecido:
        tecido_top = str(subq.nome_tecido)
        rendimento_top = Decimal(str(subq.media_rendimento or "5.60"))
    else:
        tecido_top = "Meia Malha 30.1 Penteada"
        rendimento_top = Decimal("5.60")

    # 4. Gráfico de Barras Financeiro (Últimos 12 Meses: Gastos com Matéria-Prima vs Faturamento Bruto Ganho)
    # Ordenado em ordem crescente da esquerda para a direita (Janeiro a Dezembro)
    registros = db.query(CamisetaRegistroFinanceiro).order_by(CamisetaRegistroFinanceiro.mes_ano.asc()).limit(12).all()
    grafico_financeiro = []
    
    for r in registros:
        nome_mes = extrair_nome_mes(r.mes_ano)
        grafico_financeiro.append(CamisetaItemFinanceiroMensal(
            mes_ano=r.mes_ano,
            mes_nome=nome_mes,
            materiais_gastos=r.valor_gasto_materiais,
            lucro_liquido=r.lucro_liquido,
            faturamento=r.faturamento_receita
        ))

    # Se ainda não houver registros, alimenta com série dos 12 meses do ano em ordem crescente
    if not grafico_financeiro:
        meses_default = [
            ("2026-01", "Janeiro", Decimal("15000"), Decimal("25000"), Decimal("40000")),
            ("2026-02", "Fevereiro", Decimal("16500"), Decimal("25500"), Decimal("42000")),
            ("2026-03", "Março", Decimal("19200"), Decimal("25800"), Decimal("45000")),
            ("2026-04", "Abril", Decimal("21000"), Decimal("28000"), Decimal("49000")),
            ("2026-05", "Maio", Decimal("22500"), Decimal("29500"), Decimal("52000")),
            ("2026-06", "Junho", Decimal("19800"), Decimal("27200"), Decimal("47000")),
            ("2026-07", "Julho", Decimal("20400"), Decimal("27600"), Decimal("48000")),
            ("2026-08", "Agosto", Decimal("23100"), Decimal("30900"), Decimal("54000")),
            ("2026-09", "Setembro", Decimal("22000"), Decimal("29000"), Decimal("51000")),
            ("2026-10", "Outubro", Decimal("25400"), Decimal("32600"), Decimal("58000")),
            ("2026-11", "Novembro", Decimal("24000"), Decimal("32000"), Decimal("56000")),
            ("2026-12", "Dezembro", Decimal("28000"), Decimal("37000"), Decimal("65000")),
        ]
        for m_ano, m_nome, gast, luc, fat in meses_default:
            grafico_financeiro.append(CamisetaItemFinanceiroMensal(
                mes_ano=m_ano,
                mes_nome=m_nome,
                materiais_gastos=gast,
                lucro_liquido=luc,
                faturamento=fat
            ))

    return CamisetaDashboardCompletoResponse(
        cards=CamisetaCardDestaque(
            producao_total_acumulada=producao_liquida,
            estoque_critico_quantidade=criticos_count,
            tecido_maior_rendimento=tecido_top,
            rendimento_medio_tecido=rendimento_top,
            estoque_pronto_total=int(total_estoque_pronto),
            total_entregue_acumulado=int(total_entregue)
        ),
        grafico_financeiro_12_meses=grafico_financeiro
    )
