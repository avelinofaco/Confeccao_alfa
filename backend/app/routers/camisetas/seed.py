# app/routers/camisetas/seed.py
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

# ----------------- SEED INICIAL AUTOMÁTICO SE BANCO ESTIVER VAZIO -----------------
@router.post("/seed-inicial", summary="Popula dados iniciais de demonstração para o segmento de Camisetas")
def seed_camisetas(db: Session = Depends(get_db)):
    """Garante dados ricos para o operador testar imediatamente as 7 telas."""
    # 1. Modelos
    if db.query(CamisetaModelo).count() == 0:
        modelo1 = CamisetaModelo(
            nome_modelo="Camiseta Básica Gola Redonda",
            grade_disponivel="P, M, G, GG",
            consumo_tecido_kg=Decimal("0.1800"),
            descricao="Camiseta padrão 100% algodão meia malha 30.1 penteada"
        )
        modelo2 = CamisetaModelo(
            nome_modelo="Camiseta Gola V Slim",
            grade_disponivel="P, M, G, GG",
            consumo_tecido_kg=Decimal("0.1750"),
            descricao="Modelagem ajustada com gola V em ribana 1x1"
        )
        modelo3 = CamisetaModelo(
            nome_modelo="Camiseta Streetwear Oversized",
            grade_disponivel="P, M, G, GG",
            consumo_tecido_kg=Decimal("0.2400"),
            descricao="Gramatura pesada 220g com corte amplo estilo urbano"
        )
        db.add_all([modelo1, modelo2, modelo3])
        db.commit()

    # 2. Insumos (Rolos de Tecido e Aviamentos)
    if db.query(CamisetaInsumo).count() == 0:
        insumos = [
            # Rolos de Tecido (Malhas em kg)
            CamisetaInsumo(
                codigo="MALHA-01",
                categoria="ROLO_TECIDO",
                tipo_malha_ou_aviamento="Meia Malha 30.1 Penteada",
                cor="Preto Reativo",
                unidade_medida="kg",
                saldo_atual=Decimal("380.500"),
                estoque_minimo=Decimal("50.000"),
                preco_custo_medio=Decimal("42.50")
            ),
            CamisetaInsumo(
                codigo="MALHA-02",
                categoria="ROLO_TECIDO",
                tipo_malha_ou_aviamento="Meia Malha 30.1 Penteada",
                cor="Branco Alvejado",
                unidade_medida="kg",
                saldo_atual=Decimal("29.000"), # Em estoque crítico proposital para alerta
                estoque_minimo=Decimal("60.000"),
                preco_custo_medio=Decimal("39.90")
            ),
            CamisetaInsumo(
                codigo="MALHA-03",
                categoria="ROLO_TECIDO",
                tipo_malha_ou_aviamento="Algodão Menegotti 26.1",
                cor="Azul Marinho",
                unidade_medida="kg",
                saldo_atual=Decimal("150.000"),
                estoque_minimo=Decimal("40.000"),
                preco_custo_medio=Decimal("48.00")
            ),
            # Aviamentos (linhas, etiquetas, tags)
            CamisetaInsumo(
                codigo="AV-LINHA-01",
                categoria="AVIAMENTO",
                tipo_malha_ou_aviamento="Carretel Linha 120 Poliéster",
                cor="Preto",
                unidade_medida="unidades",
                saldo_atual=Decimal("85.000"),
                estoque_minimo=Decimal("20.000"),
                preco_custo_medio=Decimal("7.80")
            ),
            CamisetaInsumo(
                codigo="AV-ETIQ-01",
                categoria="AVIAMENTO",
                tipo_malha_ou_aviamento="Etiqueta Composição Cetim P/M/G",
                cor="Branca",
                unidade_medida="unidades",
                saldo_atual=Decimal("350.000"), # Crítico (mínimo 500)
                estoque_minimo=Decimal("500.000"),
                preco_custo_medio=Decimal("0.12")
            ),
            CamisetaInsumo(
                codigo="AV-TAG-01",
                categoria="AVIAMENTO",
                tipo_malha_ou_aviamento="Tag Marca Alfa Premium",
                cor="Preto Fosco",
                unidade_medida="unidades",
                saldo_atual=Decimal("1200.000"),
                estoque_minimo=Decimal("300.000"),
                preco_custo_medio=Decimal("0.35")
            )
        ]
        db.add_all(insumos)
        db.commit()

    # 3. Fichas Técnicas
    if db.query(CamisetaFichaTecnica).count() == 0:
        m1 = db.query(CamisetaModelo).first()
        ins_tecido = db.query(CamisetaInsumo).filter_by(codigo="MALHA-01").first()
        ins_linha = db.query(CamisetaInsumo).filter_by(codigo="AV-LINHA-01").first()
        ins_etiq = db.query(CamisetaInsumo).filter_by(codigo="AV-ETIQ-01").first()
        ins_tag = db.query(CamisetaInsumo).filter_by(codigo="AV-TAG-01").first()

        if m1 and ins_tecido:
            fichas = [
                CamisetaFichaTecnica(
                    id_modelo=m1.id_modelo,
                    id_insumo=ins_tecido.id_insumo,
                    tipo_insumo="Tecido Principal",
                    descricao_insumo=f"{ins_tecido.tipo_malha_ou_aviamento} ({ins_tecido.cor})",
                    consumo_unitario=Decimal("0.1800"),
                    unidade_medida="kg",
                    custo_unitario_estimado=Decimal("7.65")
                ),
                CamisetaFichaTecnica(
                    id_modelo=m1.id_modelo,
                    id_insumo=ins_linha.id_insumo if ins_linha else None,
                    tipo_insumo="Linha de Costura",
                    descricao_insumo="Carretel Linha 120 (fração)",
                    consumo_unitario=Decimal("0.0200"),
                    unidade_medida="unidades",
                    custo_unitario_estimado=Decimal("0.16")
                ),
                CamisetaFichaTecnica(
                    id_modelo=m1.id_modelo,
                    id_insumo=ins_etiq.id_insumo if ins_etiq else None,
                    tipo_insumo="Etiqueta",
                    descricao_insumo="Etiqueta Composição Cetim",
                    consumo_unitario=Decimal("1.0000"),
                    unidade_medida="unidades",
                    custo_unitario_estimado=Decimal("0.12")
                ),
                CamisetaFichaTecnica(
                    id_modelo=m1.id_modelo,
                    id_insumo=ins_tag.id_insumo if ins_tag else None,
                    tipo_insumo="Tag",
                    descricao_insumo="Tag Marca Alfa Premium",
                    consumo_unitario=Decimal("1.0000"),
                    unidade_medida="unidades",
                    custo_unitario_estimado=Decimal("0.35")
                )
            ]
            db.add_all(fichas)
            db.commit()

    # 4. Pedidos Comerciais
    if db.query(CamisetaPedido).count() == 0:
        m1 = db.query(CamisetaModelo).first()
        if m1:
            ped1 = CamisetaPedido(
                codigo_pedido="PED-001",
                nome_cliente="Lojas Alpha Wear",
                id_modelo=m1.id_modelo,
                grade_p=25,
                grade_m=50,
                grade_g=50,
                grade_gg=25,
                quantidade_total=150,
                prazo_entrega=datetime.now().date() + timedelta(days=15),
                valor_total=Decimal("4500.00"),
                status_pedido="Aguardando Produção",
                observacoes="Camisetas pretas básicas com silk discreto na nuca"
            )
            ped2 = CamisetaPedido(
                codigo_pedido="PED-002",
                nome_cliente="Confecções Brasil Moda",
                id_modelo=m1.id_modelo,
                grade_p=40,
                grade_m=80,
                grade_g=60,
                grade_gg=20,
                quantidade_total=200,
                prazo_entrega=datetime.now().date() + timedelta(days=20),
                valor_total=Decimal("6200.00"),
                status_pedido="Aguardando Produção",
                observacoes="Lote promocional"
            )
            db.add_all([ped1, ped2])
            db.commit()

    # 5. OPs de Corte e Rendimento
    if db.query(CamisetaOrdemProducao).count() == 0:
        m1 = db.query(CamisetaModelo).first()
        ins_tecido = db.query(CamisetaInsumo).filter_by(categoria="ROLO_TECIDO").first()
        if m1 and ins_tecido:
            op1 = CamisetaOrdemProducao(
                codigo_op="OP-CAM-101",
                id_modelo=m1.id_modelo,
                id_insumo_tecido=ins_tecido.id_insumo,
                peso_malha_enviado_kg=Decimal("45.000"),
                pecas_planejadas=250,
                pecas_reais_cortadas=252,
                rendimento_real_pecas_kg=Decimal("5.60"), # 252 / 45 = 5.60 peças/kg
                status_op="Cortado",
                data_corte=datetime.now(timezone.utc) - timedelta(days=2)
            )
            db.add(op1)
            db.commit()

    # 5.1 Saldo inicial de Estoque de Produtos Acabados (peças prontas)
    if db.query(CamisetaProdutoAcabado).count() == 0:
        m1 = db.query(CamisetaModelo).first()
        if m1:
            estoque_ini = CamisetaProdutoAcabado(
                id_modelo=m1.id_modelo,
                grade_p=60,
                grade_m=120,
                grade_g=120,
                grade_gg=50,
                quantidade_total=350,
                atualizado_em=get_utc_now()
            )
            db.add(estoque_ini)
            db.commit()

    # 6. Registros Financeiros (12 meses em ordem crescente: Janeiro a Dezembro)
    if db.query(CamisetaRegistroFinanceiro).count() == 0:
        meses_dados = [
            ("2026-01", Decimal("15000.00"), Decimal("40000.00"), Decimal("25000.00")),
            ("2026-02", Decimal("16500.00"), Decimal("42000.00"), Decimal("25500.00")),
            ("2026-03", Decimal("19200.00"), Decimal("45000.00"), Decimal("25800.00")),
            ("2026-04", Decimal("21000.00"), Decimal("49000.00"), Decimal("28000.00")),
            ("2026-05", Decimal("22500.00"), Decimal("52000.00"), Decimal("29500.00")),
            ("2026-06", Decimal("19800.00"), Decimal("47000.00"), Decimal("27200.00")),
            ("2026-07", Decimal("20400.00"), Decimal("48000.00"), Decimal("27600.00")),
            ("2026-08", Decimal("23100.00"), Decimal("54000.00"), Decimal("30900.00")),
            ("2026-09", Decimal("22000.00"), Decimal("51000.00"), Decimal("29000.00")),
            ("2026-10", Decimal("25400.00"), Decimal("58000.00"), Decimal("32600.00")),
            ("2026-11", Decimal("24000.00"), Decimal("56000.00"), Decimal("32000.00")),
            ("2026-12", Decimal("28000.00"), Decimal("65000.00"), Decimal("37000.00")),
        ]
        for m, gast, fat, luc in meses_dados:
            reg = CamisetaRegistroFinanceiro(
                mes_ano=m,
                valor_gasto_materiais=gast,
                faturamento_receita=fat,
                lucro_liquido=luc,
                observacoes="Lançamento consolidado do período"
            )
            db.add(reg)
        db.commit()

    return {"mensagem": "Dados iniciais de demonstração do segmento Camisetas carregados com sucesso! 👕"}
