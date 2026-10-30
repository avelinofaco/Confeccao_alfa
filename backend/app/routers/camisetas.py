# app/routers/camisetas.py
"""
Rotas e regras de negócio para o Segmento de Camisetas da Confecção Alfa.
Contempla os 7 fluxos e telas detalhados pelo usuário.
"""

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

router = APIRouter(prefix="/camisetas", tags=["Segmento Camisetas"])

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


# ----------------- 2. CADASTRO DE PEDIDOS DO CLIENTE (RF02) -----------------
@router.get("/pedidos/", response_model=List[CamisetaPedidoResponse])
def listar_pedidos(db: Session = Depends(get_db)):
    pedidos = db.query(CamisetaPedido).order_by(CamisetaPedido.id_pedido.desc()).all()
    resultado = []
    for p in pedidos:
        resultado.append(CamisetaPedidoResponse(
            id_pedido=p.id_pedido,
            codigo_pedido=p.codigo_pedido,
            nome_cliente=p.nome_cliente,
            id_modelo=p.id_modelo,
            nome_modelo=p.modelo.nome_modelo if p.modelo else "Modelo Geral",
            grade_p=p.grade_p,
            grade_m=p.grade_m,
            grade_g=p.grade_g,
            grade_gg=p.grade_gg,
            quantidade_total=p.quantidade_total,
            prazo_entrega=p.prazo_entrega,
            valor_total=p.valor_total,
            status_pedido=p.status_pedido,
            observacoes=p.observacoes,
            criado_em=p.criado_em
        ))
    return resultado

@router.post("/pedidos/", response_model=CamisetaPedidoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_pedido(pedido_in: CamisetaPedidoCreate, db: Session = Depends(get_db)):
    # Validação IHC (Usabilidade e Prevenção de Erros): Prazo não pode ser anterior a hoje
    if pedido_in.prazo_entrega < date.today():
        raise HTTPException(
            status_code=400, 
            detail="O prazo de entrega desejado não pode ser anterior à data de hoje. Selecione hoje ou uma data futura."
        )

    # Valida modelo existente
    modelo = db.query(CamisetaModelo).filter_by(id_modelo=pedido_in.id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo de camiseta informado não encontrado")

    # Calcula automaticamente a quantidade total pela grade
    qtd_total = pedido_in.grade_p + pedido_in.grade_m + pedido_in.grade_g + pedido_in.grade_gg
    if qtd_total <= 0:
        raise HTTPException(status_code=400, detail="A soma das grades (P, M, G, GG) deve ser maior que zero")

    novo_pedido = CamisetaPedido(
        codigo_pedido=pedido_in.codigo_pedido,
        nome_cliente=pedido_in.nome_cliente,
        id_modelo=pedido_in.id_modelo,
        grade_p=pedido_in.grade_p,
        grade_m=pedido_in.grade_m,
        grade_g=pedido_in.grade_g,
        grade_gg=pedido_in.grade_gg,
        quantidade_total=qtd_total,
        prazo_entrega=pedido_in.prazo_entrega,
        valor_total=pedido_in.valor_total,
        status_pedido="Aguardando Produção", # Regra de negócio obrigatória
        observacoes=pedido_in.observacoes
    )
    db.add(novo_pedido)
    db.commit()
    db.refresh(novo_pedido)

    return CamisetaPedidoResponse(
        id_pedido=novo_pedido.id_pedido,
        codigo_pedido=novo_pedido.codigo_pedido,
        nome_cliente=novo_pedido.nome_cliente,
        id_modelo=novo_pedido.id_modelo,
        nome_modelo=modelo.nome_modelo,
        grade_p=novo_pedido.grade_p,
        grade_m=novo_pedido.grade_m,
        grade_g=novo_pedido.grade_g,
        grade_gg=novo_pedido.grade_gg,
        quantidade_total=novo_pedido.quantidade_total,
        prazo_entrega=novo_pedido.prazo_entrega,
        valor_total=novo_pedido.valor_total,
        status_pedido=novo_pedido.status_pedido,
        observacoes=novo_pedido.observacoes,
        criado_em=novo_pedido.criado_em
    )

@router.put("/pedidos/{id_pedido}/status", response_model=CamisetaPedidoResponse)
def atualizar_status_pedido(id_pedido: int, status_in: CamisetaPedidoStatusUpdate, db: Session = Depends(get_db)):
    pedido = db.query(CamisetaPedido).filter_by(id_pedido=id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    status_anterior = pedido.status_pedido
    novo_status = status_in.status_pedido

    # Se está marcando como Entregue e antes não era:
    if novo_status == "Entregue" and status_anterior != "Entregue":
        estoque_acabado = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=pedido.id_modelo).first()
        if not estoque_acabado:
            estoque_acabado = CamisetaProdutoAcabado(
                id_modelo=pedido.id_modelo,
                grade_p=0, grade_m=0, grade_g=0, grade_gg=0,
                quantidade_total=0,
                atualizado_em=get_utc_now()
            )
            db.add(estoque_acabado)
            db.flush()
        
        # Baixa do Estoque Pronto
        estoque_acabado.quantidade_total = max(0, (estoque_acabado.quantidade_total or 0) - pedido.quantidade_total)
        estoque_acabado.grade_p = max(0, (estoque_acabado.grade_p or 0) - (pedido.grade_p or 0))
        estoque_acabado.grade_m = max(0, (estoque_acabado.grade_m or 0) - (pedido.grade_m or 0))
        estoque_acabado.grade_g = max(0, (estoque_acabado.grade_g or 0) - (pedido.grade_g or 0))
        estoque_acabado.grade_gg = max(0, (estoque_acabado.grade_gg or 0) - (pedido.grade_gg or 0))
        estoque_acabado.atualizado_em = get_utc_now()

    # Se estava Entregue e foi revertido para outro status:
    elif status_anterior == "Entregue" and novo_status != "Entregue":
        estoque_acabado = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=pedido.id_modelo).first()
        if estoque_acabado:
            estoque_acabado.quantidade_total = (estoque_acabado.quantidade_total or 0) + pedido.quantidade_total
            estoque_acabado.grade_p = (estoque_acabado.grade_p or 0) + (pedido.grade_p or 0)
            estoque_acabado.grade_m = (estoque_acabado.grade_m or 0) + (pedido.grade_m or 0)
            estoque_acabado.grade_g = (estoque_acabado.grade_g or 0) + (pedido.grade_g or 0)
            estoque_acabado.grade_gg = (estoque_acabado.grade_gg or 0) + (pedido.grade_gg or 0)
            estoque_acabado.atualizado_em = get_utc_now()

    pedido.status_pedido = novo_status
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)

    return CamisetaPedidoResponse(
        id_pedido=pedido.id_pedido,
        codigo_pedido=pedido.codigo_pedido,
        nome_cliente=pedido.nome_cliente,
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
        criado_em=pedido.criado_em
    )

@router.post("/pedidos/{id_pedido}/entregar", response_model=CamisetaPedidoResponse)
def registrar_entrega_pedido(id_pedido: int, dados_entrega: CamisetaPedidoEntregar, db: Session = Depends(get_db)):
    """
    Registra formalmente a entrega ao cliente:
    - Status marcado como 'Entregue'
    - Baixa no Estoque de Peças Prontas (CamisetaProdutoAcabado)
    - Card de Produção Total do Dashboard diminui automaticamente
    - Registra comprovante auditável nas observações
    """
    pedido = db.query(CamisetaPedido).filter_by(id_pedido=id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if pedido.status_pedido == "Entregue":
        raise HTTPException(status_code=400, detail="Este pedido já foi registrado como Entregue anteriormente.")

    # 1. Validação estrita de estoque suficiente antes de entregar (IHC / Integridade)
    estoque_acabado = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=pedido.id_modelo).first()
    saldo_disponivel = estoque_acabado.quantidade_total if estoque_acabado else 0
    if saldo_disponivel < pedido.quantidade_total:
        raise HTTPException(
            status_code=400,
            detail=f"Estoque pronto insuficiente para entrega! Disponível em estoque: {saldo_disponivel} peças. Quantidade do pedido a entregar: {pedido.quantidade_total} peças."
        )

    if not estoque_acabado:
        estoque_acabado = CamisetaProdutoAcabado(
            id_modelo=pedido.id_modelo,
            grade_p=0, grade_m=0, grade_g=0, grade_gg=0,
            quantidade_total=0,
            atualizado_em=get_utc_now()
        )
        db.add(estoque_acabado)
        db.flush()

    estoque_acabado.quantidade_total = max(0, (estoque_acabado.quantidade_total or 0) - pedido.quantidade_total)
    estoque_acabado.grade_p = max(0, (estoque_acabado.grade_p or 0) - (pedido.grade_p or 0))
    estoque_acabado.grade_m = max(0, (estoque_acabado.grade_m or 0) - (pedido.grade_m or 0))
    estoque_acabado.grade_g = max(0, (estoque_acabado.grade_g or 0) - (pedido.grade_g or 0))
    estoque_acabado.grade_gg = max(0, (estoque_acabado.grade_gg or 0) - (pedido.grade_gg or 0))
    estoque_acabado.atualizado_em = get_utc_now()

    # 2. Registra comprovante amigável
    data_formatada = (dados_entrega.data_entrega or date.today()).strftime("%d/%m/%Y")
    rec_info = f" | Recebido por: {dados_entrega.recebedor}" if dados_entrega.recebedor else ""
    obs_extra = f" | Obs: {dados_entrega.observacoes}" if dados_entrega.observacoes else ""
    nota_entrega = f"\n[ENTREGA REALIZADA em {data_formatada}{rec_info}{obs_extra}]"
    
    pedido.observacoes = (pedido.observacoes or "") + nota_entrega
    pedido.status_pedido = "Entregue"
    pedido.atualizado_em = get_utc_now()
    
    db.commit()
    db.refresh(pedido)

    return CamisetaPedidoResponse(
        id_pedido=pedido.id_pedido,
        codigo_pedido=pedido.codigo_pedido,
        nome_cliente=pedido.nome_cliente,
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
        criado_em=pedido.criado_em
    )

@router.delete("/pedidos/{id_pedido}")
def excluir_pedido_camiseta(id_pedido: int, db: Session = Depends(get_db)):
    """Exclui permanentemente um pedido comercial. Impede exclusão se já estiver entregue."""
    pedido = db.query(CamisetaPedido).filter_by(id_pedido=id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if (pedido.status_pedido or "").lower() == "entregue":
        raise HTTPException(
            status_code=400, 
            detail="Não é permitido excluir um pedido que já foi formalizado como Entregue ao cliente."
        )
    
    codigo = pedido.codigo_pedido
    db.delete(pedido)
    db.commit()
    return {"mensagem": f"Pedido {codigo} excluído com sucesso!"}

@router.get("/estoque-acabado/", response_model=List[CamisetaProdutoAcabadoResponse])
def listar_estoque_acabado(db: Session = Depends(get_db)):
    acabados = db.query(CamisetaProdutoAcabado).all()
    resultado = []
    for ac in acabados:
        resultado.append(CamisetaProdutoAcabadoResponse(
            id_estoque_acabado=ac.id_estoque_acabado,
            id_modelo=ac.id_modelo,
            nome_modelo=ac.modelo.nome_modelo if ac.modelo else "Modelo Geral",
            grade_p=ac.grade_p or 0,
            grade_m=ac.grade_m or 0,
            grade_g=ac.grade_g or 0,
            grade_gg=ac.grade_gg or 0,
            quantidade_total=ac.quantidade_total or 0,
            atualizado_em=ac.atualizado_em
        ))
    return resultado


# ----------------- 3. GESTÃO DE ESTOQUE DE INSUMOS (RF03) -----------------
@router.get("/insumos/", response_model=List[CamisetaInsumoResponse])
def listar_insumos(categoria: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(CamisetaInsumo)
    if categoria:
        cat_u = categoria.upper()
        if cat_u in ["AVIAMENTO", "LINHA", "ETIQUETA", "TAG"]:
            query = query.filter(CamisetaInsumo.categoria.in_(["AVIAMENTO", "LINHA", "ETIQUETA", "TAG", "OUTRO_AVIAMENTO"]))
        else:
            query = query.filter(CamisetaInsumo.categoria == cat_u)
    return query.order_by(CamisetaInsumo.codigo.asc()).all()

@router.post("/insumos/", response_model=CamisetaInsumoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_insumo(insumo_in: CamisetaInsumoCreate, db: Session = Depends(get_db)):
    # Geração automática de código caso não enviado
    codigo_final = (insumo_in.codigo or "").strip()
    if not codigo_final:
        cat = (insumo_in.categoria or "ROLO_TECIDO").upper()
        if cat == "ROLO_TECIDO":
            prefixo = "MALHA-"
        elif cat == "LINHA":
            prefixo = "AV-LINHA-"
        elif cat == "TAG":
            prefixo = "AV-TAG-"
        elif cat == "ETIQUETA":
            prefixo = "AV-ETIQ-"
        else:
            prefixo = "AV-"

        existentes = db.query(CamisetaInsumo).all()
        numeros = []
        for it in existentes:
            cod = (it.codigo or "").upper()
            if cod.startswith(prefixo):
                nums = re.findall(r'\d+', cod)
                if nums:
                    numeros.append(int(nums[-1]))
        proximo = (max(numeros) + 1) if numeros else 1
        codigo_final = f"{prefixo}{proximo:02d}"

    # Valida código duplicado
    existente = db.query(CamisetaInsumo).filter_by(codigo=codigo_final).first()
    if existente:
        raise HTTPException(status_code=400, detail="Já existe um insumo cadastrado com este código")

    novo_insumo = CamisetaInsumo(
        codigo=codigo_final,
        categoria=insumo_in.categoria.upper(),
        tipo_malha_ou_aviamento=insumo_in.tipo_malha_ou_aviamento,
        cor=insumo_in.cor,
        unidade_medida=insumo_in.unidade_medida.lower(),
        saldo_atual=insumo_in.saldo_atual,
        estoque_minimo=insumo_in.estoque_minimo,
        preco_custo_medio=insumo_in.preco_custo_medio
    )
    db.add(novo_insumo)
    db.commit()
    db.refresh(novo_insumo)
    return novo_insumo

@router.post("/insumos/entrada/", response_model=CamisetaEntradaInsumoResponse, status_code=status.HTTP_201_CREATED)
def registrar_entrada_estoque(entrada_in: CamisetaEntradaInsumoCreate, db: Session = Depends(get_db)):
    """Botão de lançamento rápido para registrar compras e notas fiscais com atualização de saldo imediata."""
    insumo = db.query(CamisetaInsumo).filter_by(id_insumo=entrada_in.id_insumo).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo não encontrado")

    if entrada_in.quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")

    nova_entrada = CamisetaEntradaInsumo(
        id_insumo=entrada_in.id_insumo,
        numero_nota_fiscal=entrada_in.numero_nota_fiscal,
        fornecedor=entrada_in.fornecedor,
        quantidade=entrada_in.quantidade,
        valor_total=entrada_in.valor_total,
        data_entrada=get_utc_now()
    )
    db.add(nova_entrada)

    # Injeção automática no saldo atual do insumo
    insumo.saldo_atual = (insumo.saldo_atual or Decimal("0")) + entrada_in.quantidade
    insumo.atualizado_em = get_utc_now()

    db.commit()
    db.refresh(nova_entrada)
    return nova_entrada


# ----------------- 4. MODELOS & FICHA TÉCNICA DIGITAL (RF04) -----------------
@router.get("/modelos/", response_model=List[CamisetaModeloResponse])
def listar_modelos(db: Session = Depends(get_db)):
    return db.query(CamisetaModelo).order_by(CamisetaModelo.nome_modelo.asc()).all()

@router.post("/modelos/", response_model=CamisetaModeloResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_modelo(modelo_in: CamisetaModeloCreate, db: Session = Depends(get_db)):
    existente = db.query(CamisetaModelo).filter_by(nome_modelo=modelo_in.nome_modelo).first()
    if existente:
        raise HTTPException(status_code=400, detail="Modelo com esse nome já cadastrado")

    novo_mod = CamisetaModelo(
        nome_modelo=modelo_in.nome_modelo,
        grade_disponivel=modelo_in.grade_disponivel,
        consumo_tecido_kg=modelo_in.consumo_tecido_kg,
        descricao=modelo_in.descricao
    )
    db.add(novo_mod)
    db.commit()
    db.refresh(novo_mod)
    return novo_mod

@router.get("/fichas/", response_model=List[CamisetaFichaTecnicaResponse])
def listar_fichas(id_modelo: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(CamisetaFichaTecnica)
    if id_modelo:
        query = query.filter_by(id_modelo=id_modelo)
    return query.all()

@router.post("/fichas/", response_model=CamisetaFichaTecnicaResponse, status_code=status.HTTP_201_CREATED)
def adicionar_item_ficha(ficha_in: CamisetaFichaTecnicaCreate, db: Session = Depends(get_db)):
    modelo = db.query(CamisetaModelo).filter_by(id_modelo=ficha_in.id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo de camiseta não encontrado")

    item = CamisetaFichaTecnica(
        id_modelo=ficha_in.id_modelo,
        id_insumo=ficha_in.id_insumo,
        tipo_insumo=ficha_in.tipo_insumo,
        descricao_insumo=ficha_in.descricao_insumo,
        consumo_unitario=ficha_in.consumo_unitario,
        unidade_medida=ficha_in.unidade_medida,
        custo_unitario_estimado=ficha_in.custo_unitario_estimado
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/fichas/{id_ficha}", status_code=status.HTTP_204_NO_CONTENT)
def remover_item_ficha(id_ficha: int, db: Session = Depends(get_db)):
    item = db.query(CamisetaFichaTecnica).filter_by(id_ficha=id_ficha).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item da ficha técnica não encontrado")
    db.delete(item)
    db.commit()
    return None


# ----------------- 5. CORTE E RENDIMENTO - PCP (RF05) -----------------
@router.get("/ordens/", response_model=List[CamisetaOrdemProducaoResponse])
def listar_ordens_corte(db: Session = Depends(get_db)):
    ops = db.query(CamisetaOrdemProducao).order_by(CamisetaOrdemProducao.id_op.desc()).all()
    resultado = []
    for op in ops:
        total_enviado_costura = sum(r.quantidade_enviada or 0 for r in (op.movimentacoes_costura or []))
        pecas_reais = op.pecas_reais_cortadas or 0
        saldo_disp = max(0, pecas_reais - total_enviado_costura)
        # Normaliza o status da OP para terminologia industrial limpa
        status_exibicao = op.status_op or "Aguardando Corte"
        if "Envio Parcial" in status_exibicao or "Facção" in status_exibicao or "Oficina" in status_exibicao:
            status_exibicao = "Em Costura"

        resultado.append(CamisetaOrdemProducaoResponse(
            id_op=op.id_op,
            codigo_op=op.codigo_op,
            id_modelo=op.id_modelo,
            nome_modelo=op.modelo.nome_modelo if op.modelo else "Modelo",
            id_insumo_tecido=op.id_insumo_tecido,
            nome_tecido=op.tecido.tipo_malha_ou_aviamento if op.tecido else "Malha Geral",
            peso_malha_enviado_kg=op.peso_malha_enviado_kg,
            pecas_planejadas=op.pecas_planejadas,
            pecas_reais_cortadas=op.pecas_reais_cortadas,
            rendimento_real_pecas_kg=op.rendimento_real_pecas_kg,
            status_op=status_exibicao,
            data_corte=op.data_corte,
            criado_em=op.criado_em,
            quantidade_enviada_costura=total_enviado_costura,
            saldo_disponivel_envio=saldo_disp
        ))
    return resultado

@router.post("/ordens/", response_model=CamisetaOrdemProducaoResponse, status_code=status.HTTP_201_CREATED)
def abrir_ordem_corte(op_in: CamisetaOrdemProducaoCreate, db: Session = Depends(get_db)):
    """
    Passo a passo PCP:
    1. Operador seleciona modelo e informa peso total de malha enviado para a mesa (kg).
    2. O sistema realiza a explosão e baixa automática do insumo no estoque de tecido.
    """
    modelo = db.query(CamisetaModelo).filter_by(id_modelo=op_in.id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo não encontrado")

    if op_in.peso_malha_enviado_kg <= 0:
        raise HTTPException(status_code=400, detail="Peso de malha enviado deve ser maior que zero")

    # Baixa automática no estoque de insumo com validação rigorosa de saldo
    tecido_insumo = None
    if op_in.id_insumo_tecido:
        tecido_insumo = db.query(CamisetaInsumo).filter_by(id_insumo=op_in.id_insumo_tecido).first()
        if tecido_insumo:
            saldo_disp = tecido_insumo.saldo_atual or Decimal("0")
            if saldo_disp < op_in.peso_malha_enviado_kg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Estoque insuficiente de malha. O rolo [{tecido_insumo.codigo}] possui apenas {float(saldo_disp):.3f} kg em estoque, mas você tentou enviar {float(op_in.peso_malha_enviado_kg):.3f} kg para a mesa."
                )
            tecido_insumo.saldo_atual = saldo_disp - op_in.peso_malha_enviado_kg
            tecido_insumo.atualizado_em = get_utc_now()

    # Cálculo estimado de peças planejadas baseado no consumo teórico do modelo
    pecas_plan = int(op_in.peso_malha_enviado_kg / modelo.consumo_tecido_kg) if modelo.consumo_tecido_kg > 0 else 0

    nova_op = CamisetaOrdemProducao(
        codigo_op=op_in.codigo_op,
        id_modelo=op_in.id_modelo,
        id_insumo_tecido=op_in.id_insumo_tecido,
        peso_malha_enviado_kg=op_in.peso_malha_enviado_kg,
        pecas_planejadas=pecas_plan,
        status_op="Enfestado na Mesa"
    )
    db.add(nova_op)
    db.commit()
    db.refresh(nova_op)

    return CamisetaOrdemProducaoResponse(
        id_op=nova_op.id_op,
        codigo_op=nova_op.codigo_op,
        id_modelo=nova_op.id_modelo,
        nome_modelo=modelo.nome_modelo,
        id_insumo_tecido=nova_op.id_insumo_tecido,
        nome_tecido=tecido_insumo.tipo_malha_ou_aviamento if tecido_insumo else "Malha",
        peso_malha_enviado_kg=nova_op.peso_malha_enviado_kg,
        pecas_planejadas=nova_op.pecas_planejadas,
        pecas_reais_cortadas=None,
        rendimento_real_pecas_kg=None,
        status_op=nova_op.status_op,
        data_corte=None,
        criado_em=nova_op.criado_em
    )

@router.put("/ordens/{id_op}/finalizar-corte", response_model=CamisetaOrdemProducaoResponse)
def finalizar_corte_op(id_op: int, corte_in: CamisetaOrdemProducaoFinalizarCorte, db: Session = Depends(get_db)):
    """
    Após o enfesto e o corte, o operador registra a quantidade real de peças obtidas.
    O sistema calcula instantaneamente o Rendimento Real (peças/kg).
    """
    op = db.query(CamisetaOrdemProducao).filter_by(id_op=id_op).first()
    if not op:
        raise HTTPException(status_code=404, detail="Ordem de produção não encontrada")

    if corte_in.pecas_reais_cortadas <= 0:
        raise HTTPException(status_code=400, detail="Quantidade de peças cortadas deve ser maior que zero")

    op.pecas_reais_cortadas = corte_in.pecas_reais_cortadas
    op.data_corte = get_utc_now()
    op.status_op = "Cortado (Pronto para Costura)"

    # Cálculo instantâneo do rendimento real: peças / kg
    if op.peso_malha_enviado_kg and op.peso_malha_enviado_kg > 0:
        op.rendimento_real_pecas_kg = Decimal(str(round(op.pecas_reais_cortadas / float(op.peso_malha_enviado_kg), 2)))

    db.commit()
    db.refresh(op)

    return CamisetaOrdemProducaoResponse(
        id_op=op.id_op,
        codigo_op=op.codigo_op,
        id_modelo=op.id_modelo,
        nome_modelo=op.modelo.nome_modelo if op.modelo else "Modelo",
        id_insumo_tecido=op.id_insumo_tecido,
        nome_tecido=op.tecido.tipo_malha_ou_aviamento if op.tecido else "Malha",
        peso_malha_enviado_kg=op.peso_malha_enviado_kg,
        pecas_planejadas=op.pecas_planejadas,
        pecas_reais_cortadas=op.pecas_reais_cortadas,
        rendimento_real_pecas_kg=op.rendimento_real_pecas_kg,
        status_op=op.status_op,
        data_corte=op.data_corte,
        criado_em=op.criado_em
    )


# ----------------- 6. REGISTRO FINANCEIRO (RF06) -----------------
def apurar_dados_mes_sistema(db: Session, mes_ano: str):
    """
    Calcula gastos de matérias-primas e vendas a clientes do mês informado ('YYYY-MM').
    Computa o valor total de todas as malhas e aviamentos cadastrados em estoque (saldo_atual * preco_custo_medio)
    mais as entradas e notas fiscais de compras registradas.
    Retorna: (gasto_materiais, faturamento_vendas, qtd_entradas, qtd_pedidos)
    """
    try:
        partes = mes_ano.split("-")
        ano = int(partes[0])
        mes = int(partes[1])
        if mes == 12:
            inicio_prox = datetime(ano + 1, 1, 1)
        else:
            inicio_prox = datetime(ano, mes + 1, 1)
        inicio_mes = datetime(ano, mes, 1)
    except Exception:
        return Decimal("0.00"), Decimal("0.00"), 0, 0

    # 1. Valor total de insumos cadastrados no estoque (saldo atual * custo médio)
    # Atende ao requisito: considera todas as malhas e aviamentos cadastrados
    # (Ex: 150 kg de Algodão Menegotti 26.1 a R$ 48/kg = R$ 7.200,00, etc.)
    insumos = db.query(CamisetaInsumo).all()
    valor_insumos_cadastrados = Decimal("0.00")
    for ins in insumos:
        saldo = Decimal(str(ins.saldo_atual or 0))
        custo = Decimal(str(ins.preco_custo_medio or 0))
        valor_insumos_cadastrados += (saldo * custo)

    # 2. Entradas e notas fiscais de compras no estoque no período informado
    entradas = db.query(CamisetaEntradaInsumo).all()
    total_compras_periodo = Decimal("0.00")
    qtd_entradas = 0
    for ent in entradas:
        dt = ent.data_entrada
        if dt:
            d = dt.replace(tzinfo=None) if hasattr(dt, 'tzinfo') and dt.tzinfo else dt
            if inicio_mes <= d < inicio_prox:
                total_compras_periodo += (ent.valor_total or Decimal("0.00"))
                qtd_entradas += 1

    # Gasto total com matérias-primas: soma dos insumos em estoque + compras avulsas
    gasto_materiais = valor_insumos_cadastrados + total_compras_periodo
    total_itens_estoque = len(insumos) + qtd_entradas

    # 3. Vendas reais para clientes (Pedidos de camisetas faturados ou cadastrados)
    pedidos = db.query(CamisetaPedido).all()
    vendas_clientes = Decimal("0.00")
    qtd_pedidos = 0
    for ped in pedidos:
        dt = ped.criado_em
        if dt:
            d = dt.replace(tzinfo=None) if hasattr(dt, 'tzinfo') and dt.tzinfo else dt
            if inicio_mes <= d < inicio_prox:
                vendas_clientes += (ped.valor_total or Decimal("0.00"))
                qtd_pedidos += 1

    return gasto_materiais, vendas_clientes, total_itens_estoque, qtd_pedidos


@router.get("/financeiro/apuracao-mensal/", response_model=CamisetaApuracaoMensalResponse)
def apurar_financeiro_mensal_sistema(mes_ano: str = Query(..., description="Mês no formato YYYY-MM, ex: 2026-10"), db: Session = Depends(get_db)):
    """
    Consulta os gastos reais em compras de matérias-primas e o faturamento real com pedidos
    aos clientes cadastrados no sistema para o mês de referência solicitado.
    """
    gasto_materiais, vendas_clientes, qtd_entradas, qtd_pedidos = apurar_dados_mes_sistema(db, mes_ano)
    
    # Busca se já tem registro com outros custos cadastrados
    reg_salvo = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=mes_ano).first()
    outros_custos = reg_salvo.outros_custos_operacionais if reg_salvo else Decimal("0.00")
    
    tem_dados_reais = (qtd_entradas > 0 or qtd_pedidos > 0)
    
    # Se não tiver entradas nem pedidos para aquele mês e houver registro anterior, mantém para referência
    if not tem_dados_reais and reg_salvo:
        return CamisetaApuracaoMensalResponse(
            mes_ano=mes_ano,
            tem_dados_reais=False,
            gasto_materiais_real=reg_salvo.valor_gasto_materiais,
            faturamento_vendas_real=reg_salvo.faturamento_receita,
            outros_custos=outros_custos,
            lucro_apurado=reg_salvo.lucro_liquido,
            qtd_entradas_estoque=0,
            qtd_pedidos_vendas=0
        )

    lucro_apurado = vendas_clientes - gasto_materiais - outros_custos

    return CamisetaApuracaoMensalResponse(
        mes_ano=mes_ano,
        tem_dados_reais=tem_dados_reais,
        gasto_materiais_real=gasto_materiais,
        faturamento_vendas_real=vendas_clientes,
        outros_custos=outros_custos,
        lucro_apurado=lucro_apurado,
        qtd_entradas_estoque=qtd_entradas,
        qtd_pedidos_vendas=qtd_pedidos
    )


@router.post("/financeiro/sincronizar-automatico/", response_model=List[CamisetaRegistroFinanceiroResponse])
def sincronizar_financeiro_automatico(db: Session = Depends(get_db)):
    """
    Sincroniza automaticamente os meses que possuem vendas aos clientes e compras no estoque,
    além do mês corrente, mantendo o histórico demonstrativo dos demais meses.
    """
    mes_atual = datetime.now().strftime("%Y-%m")

    # Dados padrão de demonstração para manter o histórico dos 12 meses de 2026
    dados_padrao_meses = {
        "2026-01": (Decimal("15000.00"), Decimal("40000.00"), Decimal("25000.00")),
        "2026-02": (Decimal("16500.00"), Decimal("42000.00"), Decimal("25500.00")),
        "2026-03": (Decimal("19200.00"), Decimal("45000.00"), Decimal("25800.00")),
        "2026-04": (Decimal("21000.00"), Decimal("49000.00"), Decimal("28000.00")),
        "2026-05": (Decimal("22500.00"), Decimal("52000.00"), Decimal("29500.00")),
        "2026-06": (Decimal("19800.00"), Decimal("47000.00"), Decimal("27200.00")),
        "2026-07": (Decimal("20400.00"), Decimal("48000.00"), Decimal("27600.00")),
        "2026-08": (Decimal("23100.00"), Decimal("54000.00"), Decimal("30900.00")),
        "2026-09": (Decimal("22000.00"), Decimal("51000.00"), Decimal("29000.00")),
        "2026-10": (Decimal("23540.35"), Decimal("56464.00"), Decimal("32923.65")),
        "2026-11": (Decimal("24000.00"), Decimal("56000.00"), Decimal("32000.00")),
        "2026-12": (Decimal("28000.00"), Decimal("65000.00"), Decimal("37000.00")),
    }

    # Restaura/garante os 12 meses de 2026
    for m, (gast_def, fat_def, luc_def) in dados_padrao_meses.items():
        reg = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=m).first()
        if not reg:
            reg = CamisetaRegistroFinanceiro(
                mes_ano=m,
                valor_gasto_materiais=gast_def,
                faturamento_receita=fat_def,
                outros_custos_operacionais=Decimal("0.00"),
                lucro_liquido=luc_def,
                observacoes="Lançamento consolidado do período"
            )
            db.add(reg)
        elif m != mes_atual:
            # Mantém histórico demonstrativo para meses anteriores
            reg.valor_gasto_materiais = gast_def
            reg.faturamento_receita = fat_def
            reg.lucro_liquido = luc_def
            reg.observacoes = "Lançamento consolidado do período"

    # Agora sincroniza o mês atual com as movimentações reais de vendas e estoque cadastrado
    gasto_mat, vendas_cli, total_itens, qtd_ped = apurar_dados_mes_sistema(db, mes_atual)
    reg_atual = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=mes_atual).first()
    if reg_atual:
        reg_atual.valor_gasto_materiais = gasto_mat
        reg_atual.faturamento_receita = vendas_cli
        outros = reg_atual.outros_custos_operacionais or Decimal("0.00")
        reg_atual.lucro_liquido = vendas_cli - gasto_mat - outros
        reg_atual.observacoes = f"Sincronizado automaticamente: {qtd_ped} pedido(s) de clientes e {total_itens} insumo(s)/compras de estoque."
    
    db.commit()
    # Limpa eventuais meses residuais 2025 para manter foco nos 12 meses
    db.query(CamisetaRegistroFinanceiro).filter(CamisetaRegistroFinanceiro.mes_ano.like("2025-%")).delete(synchronize_session=False)
    db.commit()

    return db.query(CamisetaRegistroFinanceiro).order_by(CamisetaRegistroFinanceiro.mes_ano.desc()).all()


@router.get("/financeiro/", response_model=List[CamisetaRegistroFinanceiroResponse])
def listar_registros_financeiros(db: Session = Depends(get_db)):
    # Se houver movimentações do mês corrente não consolidadas, apura automaticamente
    mes_atual = datetime.now().strftime("%Y-%m")
    gasto_mat, vendas_cli, qtd_ent, qtd_ped = apurar_dados_mes_sistema(db, mes_atual)
    if qtd_ent > 0 or qtd_ped > 0:
        reg = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=mes_atual).first()
        if reg:
            reg.valor_gasto_materiais = gasto_mat
            reg.faturamento_receita = vendas_cli
            outros = reg.outros_custos_operacionais or Decimal("0.00")
            reg.lucro_liquido = vendas_cli - gasto_mat - outros
            db.commit()
        else:
            reg = CamisetaRegistroFinanceiro(
                mes_ano=mes_atual,
                valor_gasto_materiais=gasto_mat,
                faturamento_receita=vendas_cli,
                outros_custos_operacionais=Decimal("0.00"),
                lucro_liquido=vendas_cli - gasto_mat,
                observacoes=f"Apuração automática: {qtd_ped} pedido(s) e {qtd_ent} entrada(s) no estoque."
            )
            db.add(reg)
            db.commit()

    return db.query(CamisetaRegistroFinanceiro).order_by(CamisetaRegistroFinanceiro.mes_ano.desc()).all()

@router.post("/financeiro/", response_model=CamisetaRegistroFinanceiroResponse, status_code=status.HTTP_201_CREATED)
def registrar_financeiro_mensal(reg_in: CamisetaRegistroFinanceiroCreate, db: Session = Depends(get_db)):
    """
    Lança custos operacionais, gastos com compras de malhas/aviamentos e receitas.
    Calcula lucro líquido e alimenta o gráfico de barras dos últimos 12 meses do Dashboard.
    """
    lucro = reg_in.lucro_liquido
    if lucro == Decimal("0.00") and reg_in.faturamento_receita > 0:
        # Cálculo automático se não foi especificado manualmente
        lucro = reg_in.faturamento_receita - reg_in.valor_gasto_materiais - reg_in.outros_custos_operacionais

    # Verifica se já existe registro para esse mês/ano, se sim atualiza
    existente = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=reg_in.mes_ano).first()
    if existente:
        existente.valor_gasto_materiais = reg_in.valor_gasto_materiais
        existente.faturamento_receita = reg_in.faturamento_receita
        existente.outros_custos_operacionais = reg_in.outros_custos_operacionais
        existente.lucro_liquido = lucro
        existente.observacoes = reg_in.observacoes
        db.commit()
        db.refresh(existente)
        return existente

    novo_reg = CamisetaRegistroFinanceiro(
        mes_ano=reg_in.mes_ano,
        valor_gasto_materiais=reg_in.valor_gasto_materiais,
        faturamento_receita=reg_in.faturamento_receita,
        outros_custos_operacionais=reg_in.outros_custos_operacionais,
        lucro_liquido=lucro,
        observacoes=reg_in.observacoes
    )
    db.add(novo_reg)
    db.commit()
    db.refresh(novo_reg)
    return novo_reg


# ----------------- 7. COSTURA E TERCEIRIZAÇÃO - FACÇÕES (RF07) -----------------
@router.get("/costura/", response_model=List[CamisetaCosturaFaccaoResponse])
def listar_remessas_costura(db: Session = Depends(get_db)):
    remessas = db.query(CamisetaCosturaFaccao).order_by(CamisetaCosturaFaccao.id_costura.desc()).all()
    resultado = []
    for r in remessas:
        resultado.append(CamisetaCosturaFaccaoResponse(
            id_costura=r.id_costura,
            id_op=r.id_op,
            codigo_op=r.op.codigo_op if r.op else "OP",
            nome_modelo=r.op.modelo.nome_modelo if r.op and r.op.modelo else "Modelo",
            nome_faccao=r.nome_faccao,
            quantidade_enviada=r.quantidade_enviada,
            margem_seguranca_aviamentos_percentual=r.margem_seguranca_aviamentos_percentual,
            quantidade_retornada=r.quantidade_retornada,
            perdas_pecas=r.perdas_pecas,
            saldo_aprovado=r.saldo_aprovado,
            status=r.status,
            data_envio=r.data_envio,
            data_retorno=r.data_retorno,
            observacoes=r.observacoes
        ))
    return resultado

@router.post("/costura/enviar", response_model=CamisetaCosturaFaccaoResponse, status_code=status.HTTP_201_CREATED)
def enviar_para_faccao(envio_in: CamisetaCosturaFaccaoEnviar, db: Session = Depends(get_db)):
    """
    Envio: Seleciona a OP cortada, define a facção parceira de destino e aplica margens de segurança de aviamentos.
    """
    op = db.query(CamisetaOrdemProducao).filter_by(id_op=envio_in.id_op).first()
    if not op:
        raise HTTPException(status_code=404, detail="Ordem de corte não encontrada")

    if envio_in.quantidade_enviada <= 0:
        raise HTTPException(status_code=400, detail="Quantidade enviada deve ser maior que zero")

    # Calcula saldo de corte disponível
    total_ja_enviado = sum(r.quantidade_enviada or 0 for r in (op.movimentacoes_costura or []))
    pecas_cortadas = op.pecas_reais_cortadas or 0
    saldo_disponivel = max(0, pecas_cortadas - total_ja_enviado)

    if envio_in.quantidade_enviada > saldo_disponivel:
        raise HTTPException(
            status_code=400,
            detail=f"Quantidade a enviar ({envio_in.quantidade_enviada}) ultrapassa o saldo de painéis cortados disponíveis nesta OP ({saldo_disponivel})."
        )

    remessa = CamisetaCosturaFaccao(
        id_op=envio_in.id_op,
        nome_faccao=envio_in.nome_faccao,
        quantidade_enviada=envio_in.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=envio_in.margem_seguranca_aviamentos_percentual,
        status="Em Costura Externa",
        data_envio=get_utc_now(),
        observacoes=envio_in.observacoes
    )

    # O status geral da OP passa a ser 'Em Costura', mantendo a rastreabilidade detalhada na remessa
    op.status_op = "Em Costura"

    # Desconto dos aviamentos com os 3% (ou margem informada) de todos os aviamentos
    margem_perc = Decimal(str(envio_in.margem_seguranca_aviamentos_percentual if envio_in.margem_seguranca_aviamentos_percentual is not None else 3.00))
    multiplicador_margem = Decimal("1") + (margem_perc / Decimal("100"))
    qtd_enviada_dec = Decimal(str(envio_in.quantidade_enviada))

    itens_ficha = db.query(CamisetaFichaTecnica).filter_by(id_modelo=op.id_modelo).all()
    itens_aviamentos = [it for it in itens_ficha if (it.tipo_insumo != 'Tecido Principal')]

    if itens_aviamentos:
        for it in itens_aviamentos:
            qtd_consumo = Decimal(str(it.consumo_unitario)) * qtd_enviada_dec * multiplicador_margem
            if it.id_insumo:
                insumo = db.query(CamisetaInsumo).filter_by(id_insumo=it.id_insumo).first()
                if insumo:
                    insumo.saldo_atual = (insumo.saldo_atual or Decimal("0")) - qtd_consumo
                    insumo.atualizado_em = get_utc_now()
    else:
        aviamentos_cadastrados = db.query(CamisetaInsumo).filter_by(categoria='AVIAMENTO').all()
        for av in aviamentos_cadastrados:
            nome_ou_cod = (av.tipo_malha_ou_aviamento + " " + av.codigo).lower()
            if "linha" in nome_ou_cod or "fio" in nome_ou_cod or "carretel" in nome_ou_cod or "tubo" in nome_ou_cod:
                taxa_base = Decimal("0.02")
            else:
                taxa_base = Decimal("1.0")
            qtd_consumo = taxa_base * qtd_enviada_dec * multiplicador_margem
            av.saldo_atual = (av.saldo_atual or Decimal("0")) - qtd_consumo
            av.atualizado_em = get_utc_now()

    db.add(remessa)
    db.commit()
    db.refresh(remessa)

    return CamisetaCosturaFaccaoResponse(
        id_costura=remessa.id_costura,
        id_op=remessa.id_op,
        codigo_op=op.codigo_op,
        nome_modelo=op.modelo.nome_modelo if op.modelo else "Modelo",
        nome_faccao=remessa.nome_faccao,
        quantidade_enviada=remessa.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=remessa.margem_seguranca_aviamentos_percentual,
        quantidade_retornada=None,
        perdas_pecas=None,
        saldo_aprovado=None,
        status=remessa.status,
        data_envio=remessa.data_envio,
        data_retorno=None,
        observacoes=remessa.observacoes
    )

@router.put("/costura/{id_costura}/retornar", response_model=CamisetaCosturaFaccaoResponse)
def registrar_retorno_faccao(id_costura: int, retorno_in: CamisetaCosturaFaccaoRetornar, db: Session = Depends(get_db)):
    """
    Retorno:
    1. Registra a quantidade física de camisetas costuradas que retornaram à fábrica.
    2. Apura eventuais perdas de lote (peças avariadas ou extraviadas = enviada - retornada).
    3. Injeta o saldo aprovado de camisetas prontas no Estoque de Produtos Acabados para expedição.
    """
    remessa = db.query(CamisetaCosturaFaccao).filter_by(id_costura=id_costura).first()
    if not remessa:
        raise HTTPException(status_code=404, detail="Remessa de costura não encontrada")

    if retorno_in.quantidade_retornada < 0:
        raise HTTPException(status_code=400, detail="Quantidade retornada não pode ser negativa")

    remessa.quantidade_retornada = retorno_in.quantidade_retornada
    remessa.data_retorno = get_utc_now()
    remessa.status = "Retornado e Conferido"

    # Apura perdas
    perdas = remessa.quantidade_enviada - retorno_in.quantidade_retornada
    remessa.perdas_pecas = max(perdas, 0)
    remessa.saldo_aprovado = retorno_in.quantidade_retornada
    if retorno_in.observacoes:
        remessa.observacoes = (remessa.observacoes or "") + " | Retorno: " + retorno_in.observacoes

    # Injeta saldo aprovado no Estoque de Produtos Acabados
    if remessa.op and remessa.op.id_modelo:
        id_mod = remessa.op.id_modelo
        estoque_acabado = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=id_mod).first()
        if not estoque_acabado:
            estoque_acabado = CamisetaProdutoAcabado(
                id_modelo=id_mod,
                quantidade_total=remessa.saldo_aprovado,
                atualizado_em=get_utc_now()
            )
            db.add(estoque_acabado)
        else:
            estoque_acabado.quantidade_total = (estoque_acabado.quantidade_total or 0) + remessa.saldo_aprovado
            estoque_acabado.atualizado_em = get_utc_now()

    if remessa.op:
        remessa.op.status_op = "Costura Finalizada"

    db.commit()
    db.refresh(remessa)

    return CamisetaCosturaFaccaoResponse(
        id_costura=remessa.id_costura,
        id_op=remessa.id_op,
        codigo_op=remessa.op.codigo_op if remessa.op else "OP",
        nome_modelo=remessa.op.modelo.nome_modelo if remessa.op and remessa.op.modelo else "Modelo",
        nome_faccao=remessa.nome_faccao,
        quantidade_enviada=remessa.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=remessa.margem_seguranca_aviamentos_percentual,
        quantidade_retornada=remessa.quantidade_retornada,
        perdas_pecas=remessa.perdas_pecas,
        saldo_aprovado=remessa.saldo_aprovado,
        status=remessa.status,
        data_envio=remessa.data_envio,
        data_retorno=remessa.data_retorno,
        observacoes=remessa.observacoes
    )
