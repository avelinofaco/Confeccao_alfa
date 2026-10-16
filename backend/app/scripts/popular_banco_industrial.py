"""
Script para popular o banco de dados PostgreSQL com dados industriais realistas
para todos os contextos de confecção:
- Camisetas & Malharia
- Moda Íntima / Lingerie / Calcinhas
- Jeanswear & Sarja

Inclui:
- Contextos e Workflows de Etapas
- Insumos completos com cores, custos unitários, fornecedores e estoques de segurança
- Entradas de estoque auditadas
- Modelos de produto com Fichas Técnicas exatas (gasto por peça) e tempos padrão cronometrados
- Ordens de Produção (OPs) ativas com matriz 2D de grade (Cores x Tamanhos), enfesto e descanso
- Apontamentos de workflow com rastreabilidade
- Movimentações de costura (remessas e retornos com perdas)
- Colaboradores e folha de presença da equipe
- Pedidos comerciais vinculados
- Estoque de produtos acabados
"""

import sys
import os
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal

# Adiciona o diretório do backend ao sys.path para importação dos módulos
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.database import SessionLocal, engine
from app.models import (
    ContextoProduto,
    WorkflowEtapa,
    ApontamentoEtapaWorkflow,
    Insumo,
    EntradaEstoque,
    Produto,
    FichaTecnicaInsumo,
    OrdemProducao,
    MovimentacaoCostura,
    EstoqueProdutoPronto,
    PedidoComercial,
    Colaborador,
    PresencaEquipe,
    Usuario
)
from app.core.security import obter_hash_senha

def get_utc_now():
    return datetime.now(timezone.utc)

def popular_banco():
    db = SessionLocal()
    print("==================================================")
    print(" INICIANDO POVOAMENTO INDUSTRIAL DA BASE DE DADOS ")
    print("==================================================")

    try:
        # ----------------------------------------------------
        # 1. USUÁRIOS DO SISTEMA
        # ----------------------------------------------------
        print("\n[1/9] Verificando Usuários...")
        admin = db.query(Usuario).filter(Usuario.login == "admin").first()
        if not admin:
            admin = Usuario(
                login="admin",
                senha_hash=obter_hash_senha("admin123"),
                nome_usuario="Administrador Geral",
                perfil="ADMIN",
                ativo=True,
                onboarding_concluido=True,
                contexto_preferido="CAMISETA",
                preferencias_modulos={"estoque": True, "producao": True, "costura": True, "comercial": True, "equipe": True}
            )
            db.add(admin)
            db.flush()
            print("  -> Usuário 'admin' criado com sucesso.")
        else:
            print("  -> Usuário 'admin' já existe.")

        operador = db.query(Usuario).filter(Usuario.login == "gestor@confeccao.com").first()
        if not operador:
            operador = Usuario(
                login="gestor@confeccao.com",
                senha_hash=obter_hash_senha("gestor123"),
                nome_usuario="Gestora Ana Paula",
                perfil="Gestor",
                ativo=True,
                onboarding_concluido=False, # Perfeito para testar o fluxo de onboarding no login!
                contexto_preferido=None,
                preferencias_modulos={}
            )
            db.add(operador)
            db.flush()
            print("  -> Usuário de teste 'gestor@confeccao.com' (Onboarding pendente) criado.")

        # ----------------------------------------------------
        # 2. CONTEXTOS E WORKFLOWS INDUSTRIAIS
        # ----------------------------------------------------
        print("\n[2/9] Validando Contextos de Produção e Etapas...")
        ctx_map = {}
        for codigo, nome, desc, unidade, grade, lav, est, ela, rend, campos, etapas_def in [
            (
                "CAMISETA",
                "Camisetas & Básicos",
                "Fluxo para malharia circular, corte por rendimento em kg, estamparia silk/DTF e costura overloque/galoneira.",
                "kg",
                True, False, True, False, True,
                [
                    {"id": "gramatura_g_m2", "label": "Gramatura da Malha (g/m²)", "type": "number", "placeholder": "Ex: 160", "required": False},
                    {"id": "largura_tubular_cm", "label": "Largura Ramada/Tubular (cm)", "type": "number", "placeholder": "Ex: 90", "required": False},
                    {"id": "tipo_encolhimento", "label": "Taxa de Encolhimento Esperada (%)", "type": "text", "placeholder": "Ex: 4% comprimento / 3% largura", "required": False}
                ],
                [
                    ("corte", "Corte de Malha & Encaixe", 1, "CORTE", True, "Enfesto e corte respeitando descanso da malha."),
                    ("estamparia", "Estamparia / Silk Screen", 2, "EXTERNO", True, "Localização e silk frente/costas."),
                    ("costura", "Costura (Overloque / Galoneira)", 3, "COSTURA", True, "Fechamento de ombro, gola em ribana e bainhas."),
                    ("acabamento", "Revisão, Passadoria & Embalagem", 4, "ACABAMENTO", False, "Limpeza de fios, dobra e embalagem individual.")
                ]
            ),
            (
                "CALCINHA",
                "Moda Íntima / Calcinhas",
                "Fluxo delicado para microfibras, rendas e elásticos aplicados com catraca/3 pontos. Medição métrica e por unidade.",
                "metros",
                True, False, False, True, False,
                [
                    {"id": "largura_renda_cm", "label": "Largura da Renda Elástica (cm)", "type": "number", "placeholder": "Ex: 18", "required": False},
                    {"id": "tipo_elastico_cintura", "label": "Modelo do Elástico da Cintura", "type": "text", "placeholder": "Ex: Bico Primavera 12mm", "required": False},
                    {"id": "tensao_catraca", "label": "Ajuste de Tensão da Catraca", "type": "text", "placeholder": "Ex: P=0.85, M=0.88, G=0.92", "required": False}
                ],
                [
                    ("corte_delicado", "Corte de Alta Precisão (Serra Fita/Laser)", 1, "CORTE", True, "Enfesto baixo com peso moderado para evitar estiramento."),
                    ("fundilho", "Preparação & Embutimento do Fundilho", 2, "COSTURA", False, "Aplicação de forro 100% algodão anti-alérgico."),
                    ("aplicacao_elastico", "Aplicação de Elásticos & Bicos (3 Pontos / Catraca)", 3, "COSTURA", True, "Aplicação com regulagem precisa de tensão nas pernas e cintura."),
                    ("travete_laco", "Travetes de Reforço & Aplicação de Laço", 4, "COSTURA", False, "Travetamento nas extremidades e fixação de lacinho de cetim."),
                    ("embalagem_cabide", "Controle de Qualidade & Embalagem em Cabide", 5, "ACABAMENTO", False, "Revisão minuciosa de costura e ensacamento em cabides.")
                ]
            ),
            (
                "JEANS",
                "Jeans & Sarja",
                "Fluxo pesado para denim e brim, enfesto espesso, pespontos com linha grossa e processo externo de lavanderia.",
                "metros",
                True, True, False, False, False,
                [
                    {"id": "peso_oz", "label": "Peso do Denim (Oz)", "type": "number", "placeholder": "Ex: 12", "required": False},
                    {"id": "composicao_elastano", "label": "% Elastano", "type": "number", "placeholder": "Ex: 2", "required": False},
                    {"id": "receita_lavanderia", "label": "Processo de Lavanderia", "type": "text", "placeholder": "Ex: Stone Wash com puídos e used leve", "required": False}
                ],
                [
                    ("corte_pesado", "Corte em Enfesto Pesado", 1, "CORTE", True, "Enfesto alto (40 a 60 folhas) cortado com serra fita vertical."),
                    ("costura_pesada", "Costura Pesada (Fechamento & Pespontos)", 2, "COSTURA", True, "Montagem com fechadeira de braço e pespontadeiras 2 agulhas."),
                    ("lavanderia_industrial", "Lavanderia Industrial Externa", 3, "EXTERNO", True, "Processamento de alvejamento, amaciamento e efeitos de lavagem."),
                    ("acabamento_metais", "Pregar Botões, Rebites & Caseado", 4, "ACABAMENTO", False, "Prensa de rebites de reforço, botões flexíveis e caseado mecânico."),
                    ("revisao_passadoria", "Revisão Final, Passadoria a Vapor & Tags", 5, "ACABAMENTO", False, "Retirada de sobras, passadoria pesada e colocação de tags de marca.")
                ]
            )
        ]:
            ctx = db.query(ContextoProduto).filter(ContextoProduto.codigo == codigo).first()
            if not ctx:
                ctx = ContextoProduto(
                    codigo=codigo,
                    nome=nome,
                    descricao=desc,
                    unidade_principal=unidade,
                    habilita_grade_tamanhos=grade,
                    habilita_lavanderia=lav,
                    habilita_estamparia=est,
                    habilita_controle_elasticos=ela,
                    habilita_rendimento_peso=rend,
                    schema_campos_customizados=campos
                )
                db.add(ctx)
                db.flush()
                print(f"  -> Contexto criado: {nome}")
            else:
                ctx_map[codigo] = ctx
                continue

            ctx_map[codigo] = ctx
            # Cria etapas
            for cod_e, nome_e, ordem_e, tipo_o, perm_p, desc_i in etapas_def:
                et = WorkflowEtapa(
                    id_contexto=ctx.id_contexto,
                    codigo_etapa=cod_e,
                    nome_etapa=nome_e,
                    ordem_etapa=ordem_e,
                    tipo_operacao=tipo_o,
                    permite_perda=perm_p,
                    descricao_instrucao=desc_i
                )
                db.add(et)
            db.flush()

        # Recarrega mapa de contextos
        for codigo in ["CAMISETA", "CALCINHA", "JEANS"]:
            ctx_map[codigo] = db.query(ContextoProduto).filter(ContextoProduto.codigo == codigo).first()

        # ----------------------------------------------------
        # 3. MATÉRIAS-PRIMAS E INSUMOS (Com custos e estoque)
        # ----------------------------------------------------
        print("\n[3/9] Povoando Insumos Industriais...")
        lista_insumos = [
            # MALHAS E TECIDOS PARA CAMISETAS
            ("MAL-ALG-01", "MALHA", "Malha 100% Algodão Penteada 30.1", "kg", Decimal("480.000"), Decimal("100.000"), "Preto Reativo", Decimal("38.50"), "Tecelagem Santaconstancia", "L-2026-881"),
            ("MAL-ALG-02", "MALHA", "Malha 100% Algodão Penteada 30.1", "kg", Decimal("390.000"), Decimal("80.000"), "Branco Óptico", Decimal("36.90"), "Tecelagem Santaconstancia", "L-2026-882"),
            ("MAL-ALG-03", "MALHA", "Malha 100% Algodão Penteada 30.1", "kg", Decimal("310.000"), Decimal("50.000"), "Cinza Mescla", Decimal("39.20"), "Tecelagem Santaconstancia", "L-2026-885"),
            ("RIB-1X1-01", "MALHA", "Ribana 1x1 com Elastano (Gola)", "kg", Decimal("95.000"), Decimal("25.000"), "Preto Reativo", Decimal("42.00"), "Malharia Menegotti", "R-9021"),
            ("RIB-1X1-02", "MALHA", "Ribana 1x1 com Elastano (Gola)", "kg", Decimal("80.000"), Decimal("20.000"), "Branco Óptico", Decimal("41.00"), "Malharia Menegotti", "R-9022"),
            ("LIN-120-PT", "AVIAMENTO", "Linha 120 Costura Poliéster 5000m", "un", Decimal("75.000"), Decimal("15.000"), "Preto", Decimal("14.50"), "Coats Corrente", "CC-441"),
            
            # MATERIAIS PARA LINGERIE / CALCINHAS
            ("MIC-POL-ROM", "MALHA", "Microfibra Poliamida 85% Elastano 15%", "metros", Decimal("950.000"), Decimal("200.000"), "Romance Rosa", Decimal("22.80"), "Rosset Têxtil", "RO-772"),
            ("MIC-POL-PTO", "MALHA", "Microfibra Poliamida 85% Elastano 15%", "metros", Decimal("820.000"), Decimal("150.000"), "Preto Clássico", Decimal("22.80"), "Rosset Têxtil", "RO-773"),
            ("MIC-POL-NUD", "MALHA", "Microfibra Poliamida 85% Elastano 15%", "metros", Decimal("740.000"), Decimal("150.000"), "Nude Bege", Decimal("22.80"), "Rosset Têxtil", "RO-774"),
            ("FOR-ALG-100", "MALHA", "Forro Malha 100% Algodão Tubular", "metros", Decimal("320.000"), Decimal("60.000"), "Cru Natural", Decimal("12.00"), "Dohler Têxtil", "DH-102"),
            ("ELA-BIC-12", "AVIAMENTO", "Elástico Bico de Renda Primavera 12mm", "metros", Decimal("2600.000"), Decimal("500.000"), "Romance Rosa", Decimal("0.65"), "Zanotti Elásticos", "ZAN-3310"),
            ("ELA-DEB-16", "AVIAMENTO", "Elástico Dobrável Sanduíche 16mm", "metros", Decimal("3500.000"), Decimal("600.000"), "Preto Clássico", Decimal("0.85"), "Zanotti Elásticos", "ZAN-3312"),
            ("LAC-CET-01", "AVIAMENTO", "Lacinho de Cetim Mini com Ponto de Luz", "un", Decimal("4800.000"), Decimal("800.000"), "Sortidas", Decimal("0.28"), "Haco Etiquetas", "HC-99"),

            # MATERIAIS PARA JEANSWEAR
            ("TEC-JNS-12", "MALHA", "Tecido Denim Índigo 12oz com Elastano", "metros", Decimal("1400.000"), Decimal("300.000"), "Azul Índigo Deep", Decimal("34.00"), "Vicunha Têxtil", "VIC-8801"),
            ("FOR-BRM-01", "MALHA", "Forro de Bolso Brim 100% Algodão", "metros", Decimal("420.000"), Decimal("80.000"), "Cru", Decimal("11.50"), "Cedro Têxtil", "CED-502"),
            ("ZIP-MET-15", "AVIAMENTO", "Zíper de Latão Ouro Velho 15cm Trava", "un", Decimal("1950.000"), Decimal("300.000"), "Ouro Velho", Decimal("2.40"), "YKK do Brasil", "YKK-15-OV"),
            ("BOT-MET-17", "AVIAMENTO", "Botão Jeans Flexível Metal 17mm", "un", Decimal("3800.000"), Decimal("500.000"), "Níquel Escovado", Decimal("0.75"), "Eberle Metalúrgica", "EB-17"),
            ("REB-MET-09", "AVIAMENTO", "Rebites Industriais Jeans com Contra-pino", "un", Decimal("8500.000"), Decimal("1000.000"), "Cobre Envelhecido", Decimal("0.18"), "Eberle Metalúrgica", "EB-REB"),

            # ETIQUETAS E ACABAMENTOS GERAIS
            ("ETQ-COM-01", "AVIAMENTO", "Etiqueta Composição Cetim com Cód. Barras", "un", Decimal("6500.000"), Decimal("1000.000"), "Branco", Decimal("0.15"), "Haco Etiquetas", "HC-CET"),
            ("ETQ-TRM-01", "AVIAMENTO", "Etiqueta Termocolante de Marca", "un", Decimal("5200.000"), Decimal("1000.000"), "Prata / Preto", Decimal("0.35"), "Haco Etiquetas", "HC-TRM")
        ]

        insumos_db = {}
        for cod, cat, tip, unid, qtd, est_min, cor, custo, forn, lote in lista_insumos:
            ins = db.query(Insumo).filter(Insumo.codigo == cod).first()
            if not ins:
                ins = Insumo(
                    codigo=cod,
                    categoria=cat,
                    tipo=tip,
                    quantidade_atual=qtd,
                    unidade_medida=unid,
                    estoque_minimo_seguranca=est_min,
                    cor=cor,
                    custo_unitario=custo,
                    fornecedor=forn,
                    lote_fornecedor=lote
                )
                db.add(ins)
                db.flush()
                # Adiciona registro de entrada inicial para rastreamento
                entrada = EntradaEstoque(
                    id_insumo=ins.id_insumo,
                    quantidade_recebida=qtd,
                    data_entrada=get_utc_now() - timedelta(days=15)
                )
                db.add(entrada)
                print(f"  -> Insumo criado: [{cod}] {tip} ({cor})")
            else:
                # Atualiza com as novas informações se estavam nulas
                ins.cor = cor
                ins.custo_unitario = custo
                ins.fornecedor = forn
                ins.lote_fornecedor = lote
                ins.quantidade_atual = qtd
            insumos_db[cod] = ins

        db.flush()

        # ----------------------------------------------------
        # 4. PRODUTOS E FICHAS TÉCNICAS INDUSTRIAIS
        # ----------------------------------------------------
        print("\n[4/9] Povoando Modelos de Produto e Fichas Técnicas...")
        produtos_def = [
            (
                "Camiseta Classic T-Shirt Algodão Penteado",
                "CAM-301-CLS",
                ctx_map["CAMISETA"].id_contexto,
                "Camiseta manga curta masculina com reforço de gola ombro a ombro, costuras duplas e malha penteada 30.1.",
                ["P", "M", "G", "GG", "XG"],
                ["Preto Reativo", "Branco Óptico", "Cinza Mescla"],
                Decimal("8.50"),
                Decimal("18.40"),
                [
                    ("MAL-ALG-01", Decimal("0.2200")), # 220g de malha por camiseta
                    ("RIB-1X1-01", Decimal("0.0250")), # 25g de ribana na gola
                    ("LIN-120-PT", Decimal("0.0200")), # Fração de carretel
                    ("ETQ-COM-01", Decimal("1.0000")), # 1 etiqueta de composição
                    ("ETQ-TRM-01", Decimal("1.0000"))  # 1 etiqueta termocolante
                ]
            ),
            (
                "Calcinha Confort Fio Duplo Microfibra",
                "CAL-FIO-02",
                ctx_map["CALCINHA"].id_contexto,
                "Calcinha feminina em microfibra macia de poliamida, laterais confort sem costura nas pernas e forro anti-alérgico.",
                ["P", "M", "G", "GG"],
                ["Romance Rosa", "Preto Clássico", "Nude Bege"],
                Decimal("5.20"),
                Decimal("8.90"),
                [
                    ("MIC-POL-ROM", Decimal("0.3500")), # 35cm de microfibra
                    ("FOR-ALG-100", Decimal("0.0800")), # 8cm de forro de algodão
                    ("ELA-BIC-12",  Decimal("0.8500")), # 85cm de elástico bico
                    ("ELA-DEB-16",  Decimal("0.7000")), # 70cm de elástico dobrável
                    ("LAC-CET-01",  Decimal("1.0000")), # 1 lacinho
                    ("ETQ-COM-01",  Decimal("1.0000"))
                ]
            ),
            (
                "Calça Jeans Slim Fit Índigo 12oz",
                "JNS-SLM-501",
                ctx_map["JEANS"].id_contexto,
                "Calça jeans masculina 5 pockets em denim 12oz com 2% elastano, pespontos contrastantes ocre e lavagem stone wash.",
                ["38", "40", "42", "44", "46", "48"],
                ["Azul Índigo Deep"],
                Decimal("24.00"),
                Decimal("56.80"),
                [
                    ("TEC-JNS-12", Decimal("1.4000")), # 1.4m de denim
                    ("FOR-BRM-01", Decimal("0.2500")), # 25cm de brim de bolso
                    ("ZIP-MET-15", Decimal("1.0000")), # 1 zíper metálico
                    ("BOT-MET-17", Decimal("1.0000")), # 1 botão de cós
                    ("REB-MET-09", Decimal("6.0000")), # 6 rebites de reforço
                    ("ETQ-COM-01", Decimal("1.0000"))
                ]
            )
        ]

        produtos_db = {}
        for nome_m, ref, id_ctx, desc, grade, cores, tempo, custo, comp in produtos_def:
            prod = db.query(Produto).filter(Produto.nome_modelo == nome_m).first()
            if not prod:
                prod = Produto(
                    nome_modelo=nome_m,
                    referencia_codigo=ref,
                    id_contexto=id_ctx,
                    descricao_detalhada=desc,
                    grade_tamanhos_disponiveis=grade,
                    cores_disponiveis=cores,
                    tempo_padrao_total_minutos=tempo,
                    custo_estimado_total=custo
                )
                db.add(prod)
                db.flush()
                print(f"  -> Modelo cadastrado: {nome_m} (Ref: {ref})")
            else:
                prod.referencia_codigo = ref
                prod.id_contexto = id_ctx
                prod.descricao_detalhada = desc
                prod.grade_tamanhos_disponiveis = grade
                prod.cores_disponiveis = cores
                prod.tempo_padrao_total_minutos = tempo
                prod.custo_estimado_total = custo

            # Cadastra composição da Ficha Técnica
            for cod_ins, gasto in comp:
                if cod_ins in insumos_db:
                    ins_obj = insumos_db[cod_ins]
                    ficha_item = db.query(FichaTecnicaInsumo).filter(
                        FichaTecnicaInsumo.id_produto == prod.id_produto,
                        FichaTecnicaInsumo.id_insumo == ins_obj.id_insumo
                    ).first()
                    if not ficha_item:
                        ficha_item = FichaTecnicaInsumo(
                            id_produto=prod.id_produto,
                            id_insumo=ins_obj.id_insumo,
                            gasto_por_unidade=gasto
                        )
                        db.add(ficha_item)
            produtos_db[ref] = prod

        db.flush()

        # ----------------------------------------------------
        # 5. ORDENS DE PRODUÇÃO (OPs) COM MATRIZ 2D E ENFESTO
        # ----------------------------------------------------
        print("\n[5/9] Povoando Ordens de Produção (OPs) Multi-Contexto...")
        ops_def = [
            # OP 101 - Camiseta (Corte Finalizado)
            (
                "OP#101",
                produtos_db["CAM-301-CLS"].id_produto,
                Decimal("132.000"), # 132 kg de malha enviados
                600,                # 600 peças cortadas
                Decimal("4.55"),    # Rendimento: 4.55 peças por kg
                "Corte Finalizado",
                "costura",
                {
                    "Preto Reativo": {"P": 40, "M": 60, "G": 60, "GG": 40},
                    "Branco Óptico": {"P": 40, "M": 60, "G": 60, "GG": 40},
                    "Cinza Mescla": {"P": 40, "M": 60, "G": 60, "GG": 40}
                },
                {
                    "comprimento_enfesto_m": 4.80,
                    "camadas_enfesto": 50,
                    "aproveitamento_risco_pct": 89.5,
                    "perda_extremidade_cm": 3.0,
                    "cortador": "Carlos Eduardo"
                },
                Decimal("24.00"),
                "Liberado",
                {"gramatura_g_m2": 160, "largura_tubular_cm": 90, "lote_corte": "CT-2026-01"}
            ),
            # OP 102 - Calcinha (Em Costura / Elásticos)
            (
                "OP#102",
                produtos_db["CAL-FIO-02"].id_produto,
                Decimal("0.000"), # Microfibra em metros, não em kg
                1200,
                None,
                "Em Costura",
                "aplicacao_elastico",
                {
                    "Romance Rosa": {"P": 100, "M": 150, "G": 100, "GG": 50},
                    "Preto Clássico": {"P": 100, "M": 150, "G": 100, "GG": 50},
                    "Nude Bege": {"P": 100, "M": 150, "G": 100, "GG": 50}
                },
                {
                    "metragem_total_tecido_m": 420.0,
                    "camadas_enfesto": 35,
                    "tipo_corte": "Serra Fita de Precisão",
                    "operador": "Francisco das Chagas"
                },
                Decimal("12.00"),
                "Dispensado",
                {"largura_renda_cm": 18, "tipo_elastico_cintura": "Bico Primavera 12mm", "tensao_catraca": "P=0.85, M=0.88, G=0.92"}
            ),
            # OP 103 - Jeanswear (Em Lavanderia Industrial Externa)
            (
                "OP#103",
                produtos_db["JNS-SLM-501"].id_produto,
                Decimal("0.000"),
                350,
                None,
                "Em Lavanderia",
                "lavanderia_industrial",
                {
                    "Azul Índigo Deep": {"38": 50, "40": 100, "42": 100, "44": 70, "46": 30}
                },
                {
                    "comprimento_enfesto_m": 7.20,
                    "camadas_enfesto": 45,
                    "metragem_denim_consumida_m": 490.0,
                    "tipo_enfesto": "Zig-zag mecânico pesado"
                },
                Decimal("48.00"),
                "Liberado",
                {"peso_oz": 12, "composicao_elastano": 2, "receita_lavanderia": "Stone Wash com puídos e used leve"}
            ),
            # OP 104 - Camiseta (Em Estamparia Silk Screen)
            (
                "OP#104",
                produtos_db["CAM-301-CLS"].id_produto,
                Decimal("99.000"),
                450,
                Decimal("4.54"),
                "Em Estamparia",
                "estamparia",
                {
                    "Preto Reativo": {"M": 75, "G": 75, "GG": 75},
                    "Branco Óptico": {"M": 75, "G": 75, "GG": 75}
                },
                {
                    "comprimento_enfesto_m": 4.50,
                    "camadas_enfesto": 40,
                    "aproveitamento_risco_pct": 90.2
                },
                Decimal("24.00"),
                "Liberado",
                {"gramatura_g_m2": 160, "largura_tubular_cm": 90}
            )
        ]

        ops_db = {}
        for cod_op, id_prod, peso, pecas, rend, status, cod_etapa, grade, enfesto, descanso, st_desc, ctx_dados in ops_def:
            op = db.query(OrdemProducao).filter(OrdemProducao.codigo_op == cod_op).first()
            # Busca ID da etapa
            etapa_obj = db.query(WorkflowEtapa).filter(WorkflowEtapa.codigo_etapa == cod_etapa).first()
            id_etapa = etapa_obj.id_etapa if etapa_obj else None

            if not op:
                op = OrdemProducao(
                    codigo_op=cod_op,
                    id_produto=id_prod,
                    peso_malha_enviado=peso,
                    quantidade_pecas_cortadas=pecas,
                    rendimento_real=rend,
                    status_op=status,
                    id_etapa_atual=id_etapa,
                    grade_distribuicao=grade,
                    dados_enfesto=enfesto,
                    horas_descanso_cumpridas=descanso,
                    status_descanso=st_desc,
                    dados_contexto=ctx_dados,
                    criado_em=get_utc_now() - timedelta(days=6)
                )
                db.add(op)
                db.flush()
                print(f"  -> OP criada: {cod_op} ({status} - {pecas} pçs)")
            else:
                op.peso_malha_enviado = peso
                op.quantidade_pecas_cortadas = pecas
                op.rendimento_real = rend
                op.status_op = status
                op.id_etapa_atual = id_etapa
                op.grade_distribuicao = grade
                op.dados_enfesto = enfesto
                op.horas_descanso_cumpridas = descanso
                op.status_descanso = st_desc
                op.dados_contexto = ctx_dados
            ops_db[cod_op] = op

        db.flush()

        # ----------------------------------------------------
        # 6. APONTAMENTOS DE WORKFLOW (Rastreabilidade das OPs)
        # ----------------------------------------------------
        print("\n[6/9] Registrando Apontamentos de Histórico de Workflow...")
        # Histórico da OP#101: Corte -> Concluído
        et_corte = db.query(WorkflowEtapa).filter(WorkflowEtapa.codigo_etapa == "corte").first()
        if et_corte and ops_db.get("OP#101"):
            op101 = ops_db["OP#101"]
            apt = db.query(ApontamentoEtapaWorkflow).filter(
                ApontamentoEtapaWorkflow.id_op == op101.id_op,
                ApontamentoEtapaWorkflow.id_etapa == et_corte.id_etapa
            ).first()
            if not apt:
                db.add(ApontamentoEtapaWorkflow(
                    id_op=op101.id_op,
                    id_etapa=et_corte.id_etapa,
                    status_etapa="Concluido",
                    responsavel_oficina="Carlos Eduardo (Cortador)",
                    quantidade_entrada=600,
                    quantidade_concluida=600,
                    quantidade_perda=0,
                    observacoes="Enfesto de 50 folhas cortado sem defeitos. Risco com 89.5% de aproveitamento.",
                    dados_customizados={"aproveitamento_pct": 89.5, "tempo_gasto_min": 140},
                    data_inicio=get_utc_now() - timedelta(days=5, hours=4),
                    data_fim=get_utc_now() - timedelta(days=5)
                ))

        # Histórico da OP#102: Corte Delicado (Aprovado) -> Fundilho (Aprovado)
        et_corte_del = db.query(WorkflowEtapa).filter(WorkflowEtapa.codigo_etapa == "corte_delicado").first()
        et_fundilho = db.query(WorkflowEtapa).filter(WorkflowEtapa.codigo_etapa == "fundilho").first()
        if ops_db.get("OP#102"):
            op102 = ops_db["OP#102"]
            if et_corte_del:
                db.add(ApontamentoEtapaWorkflow(
                    id_op=op102.id_op,
                    id_etapa=et_corte_del.id_etapa,
                    status_etapa="Concluido",
                    responsavel_oficina="Francisco das Chagas",
                    quantidade_entrada=1200,
                    quantidade_concluida=1200,
                    quantidade_perda=0,
                    observacoes="Microfibra cortada em serra fita com molde de alumínio. Precisão milimétrica.",
                    data_inicio=get_utc_now() - timedelta(days=4, hours=3),
                    data_fim=get_utc_now() - timedelta(days=4)
                ))
            if et_fundilho:
                db.add(ApontamentoEtapaWorkflow(
                    id_op=op102.id_op,
                    id_etapa=et_fundilho.id_etapa,
                    status_etapa="Concluido",
                    responsavel_oficina="Maria de Fátima (Pilotista)",
                    quantidade_entrada=1200,
                    quantidade_concluida=1198,
                    quantidade_perda=2,
                    observacoes="Embutimento do forro de algodão concluído. 2 unidades refugadas por desfiamento.",
                    data_inicio=get_utc_now() - timedelta(days=3, hours=5),
                    data_fim=get_utc_now() - timedelta(days=3)
                ))

        # Histórico da OP#103: Corte Pesado -> Costura Pesada
        et_corte_pes = db.query(WorkflowEtapa).filter(WorkflowEtapa.codigo_etapa == "corte_pesado").first()
        et_costura_pes = db.query(WorkflowEtapa).filter(WorkflowEtapa.codigo_etapa == "costura_pesada").first()
        if ops_db.get("OP#103"):
            op103 = ops_db["OP#103"]
            if et_corte_pes:
                db.add(ApontamentoEtapaWorkflow(
                    id_op=op103.id_op,
                    id_etapa=et_corte_pes.id_etapa,
                    status_etapa="Concluido",
                    responsavel_oficina="Equipe de Corte Pesado",
                    quantidade_entrada=350,
                    quantidade_concluida=350,
                    quantidade_perda=0,
                    observacoes="45 camadas de denim 12oz cortadas com lâmina afiada.",
                    data_inicio=get_utc_now() - timedelta(days=6, hours=4),
                    data_fim=get_utc_now() - timedelta(days=6)
                ))
            if et_costura_pes:
                db.add(ApontamentoEtapaWorkflow(
                    id_op=op103.id_op,
                    id_etapa=et_costura_pes.id_etapa,
                    status_etapa="Concluido",
                    responsavel_oficina="Oficina Parceira Denim Master",
                    quantidade_entrada=350,
                    quantidade_concluida=348,
                    quantidade_perda=2,
                    observacoes="Fechamento de pernas e aplicação de bolsos traseiros. Enviado para a lavanderia.",
                    data_inicio=get_utc_now() - timedelta(days=2, hours=8),
                    data_fim=get_utc_now() - timedelta(days=2)
                ))

        db.flush()

        # ----------------------------------------------------
        # 7. MOVIMENTAÇÕES DE COSTURA & ESTOQUE PRONTO
        # ----------------------------------------------------
        print("\n[7/9] Povoando Movimentações de Costura e Facções...")
        if ops_db.get("OP#101"):
            op101 = ops_db["OP#101"]
            mov1 = db.query(MovimentacaoCostura).filter(MovimentacaoCostura.id_op == op101.id_op).first()
            if not mov1:
                mov1 = MovimentacaoCostura(
                    id_op=op101.id_op,
                    destino_costura="Facção Silva & Filhos (Costura Externa)",
                    quantidade_enviada=600,
                    margem_seguranca_insumos=Decimal("0.000"),
                    quantidade_recebida=594,
                    perda_pecas=6,
                    data_envio=get_utc_now() - timedelta(days=4),
                    data_retorno=get_utc_now() - timedelta(days=1),
                    status_movimentacao="Retornado"
                )
                db.add(mov1)
                print("  -> Movimentação de retorno OP#101 registrada (594 pçs prontas, 6 perdas).")

        if ops_db.get("OP#102"):
            op102 = ops_db["OP#102"]
            mov2 = db.query(MovimentacaoCostura).filter(MovimentacaoCostura.id_op == op102.id_op).first()
            if not mov2:
                mov2 = MovimentacaoCostura(
                    id_op=op102.id_op,
                    destino_costura="Oficina Especializada D. Regina Lingerie",
                    quantidade_enviada=1200,
                    margem_seguranca_insumos=Decimal("45.000"), # 45m extras de elástico de reserva
                    quantidade_recebida=None,
                    perda_pecas=None,
                    data_envio=get_utc_now() - timedelta(days=2),
                    status_movimentacao="Enviado"
                )
                db.add(mov2)
                print("  -> Movimentação de envio OP#102 registrada (1200 pçs para costura de elásticos).")

        # Estoque de Produtos Prontos
        for prod_key, qtd_est in [("CAM-301-CLS", 350), ("CAL-FIO-02", 220), ("JNS-SLM-501", 80)]:
            prod_obj = produtos_db.get(prod_key)
            if prod_obj:
                est_pronto = db.query(EstoqueProdutoPronto).filter(EstoqueProdutoPronto.id_produto == prod_obj.id_produto).first()
                if not est_pronto:
                    est_pronto = EstoqueProdutoPronto(
                        id_produto=prod_obj.id_produto,
                        quantidade_total=qtd_est,
                        atualizado_em=get_utc_now()
                    )
                    db.add(est_pronto)
                else:
                    est_pronto.quantidade_total = qtd_est

        db.flush()

        # ----------------------------------------------------
        # 8. COLABORADORES E PRESENÇAS DIÁRIAS DA EQUIPE
        # ----------------------------------------------------
        print("\n[8/9] Povoando Equipe de Chão de Fábrica e Presenças...")
        equipe_def = [
            ("Carlos Eduardo da Silva", "(85)9 98841-2031", True),
            ("Maria de Fátima Oliveira", "(85)9 97723-5510", True),
            ("Francisco das Chagas Neto", "(85)9 96512-8877", True),
            ("Regina Célia dos Santos", "(85)9 99120-4432", True),
            ("Ana Paula Costa Vieira", "(85)9 98114-9900", True),
            ("Juliana Mendes Barreto", "(85)9 97230-1122", True)
        ]

        colabs_db = []
        for nome_c, tel, atv in equipe_def:
            colab = db.query(Colaborador).filter(Colaborador.nome_completo == nome_c).first()
            if not colab:
                colab = Colaborador(
                    nome_completo=nome_c,
                    telefone_whatsapp=tel,
                    ativo=atv
                )
                db.add(colab)
                db.flush()
                print(f"  -> Colaborador cadastrado: {nome_c}")
            colabs_db.append(colab)

        # Registra presença para os últimos 5 dias
        hoje = date.today()
        for i in range(5):
            dia = hoje - timedelta(days=i)
            # Pula domingos (dia.weekday() == 6)
            if dia.weekday() == 6:
                continue
            for idx, c in enumerate(colabs_db):
                p_exist = db.query(PresencaEquipe).filter(
                    PresencaEquipe.id_colaborador == c.id_colaborador,
                    PresencaEquipe.data_referencia == dia
                ).first()
                if not p_exist:
                    # Gera uma falta pontual realista para um colaborador
                    presente = not (idx == 2 and i == 1)
                    db.add(PresencaEquipe(
                        id_colaborador=c.id_colaborador,
                        data_referencia=dia,
                        presente=presente
                    ))

        db.flush()

        # ----------------------------------------------------
        # 9. PEDIDOS COMERCIAIS REALISTAS
        # ----------------------------------------------------
        print("\n[9/9] Povoando Pedidos Comerciais...")
        pedidos_def = [
            (
                "#PED-201",
                "Magazine Estilo Urbano Ltda",
                produtos_db["CAM-301-CLS"].id_produto,
                300,
                hoje + timedelta(days=5),
                Decimal("11700.00"),
                "Grade dividida entre Preto (150) e Branco (150). Embalagem individual com cabide.",
                "Pronto para Entrega"
            ),
            (
                "#PED-202",
                "Boutique Bella Donna Moda Íntima",
                produtos_db["CAL-FIO-02"].id_produto,
                600,
                hoje + timedelta(days=8),
                Decimal("10800.00"),
                "Priorizar cores Romance e Nude nos tamanhos M e G. Tags com preço de revenda sugerido.",
                "Em Produção"
            ),
            (
                "#PED-203",
                "Streetwear & Jeans Distribuidora",
                produtos_db["JNS-SLM-501"].id_produto,
                200,
                hoje + timedelta(days=14),
                Decimal("23800.00"),
                "Lavagem stone wash padrão exportação com costuras duplas ocre.",
                "Em Produção"
            ),
            (
                "#PED-204",
                "Rede de Lojas Mar e Sol",
                produtos_db["CAM-301-CLS"].id_produto,
                450,
                hoje + timedelta(days=20),
                Decimal("17550.00"),
                "Camisetas com estampa frontal em 2 cores (Silk Screen da OP#104).",
                "Aguardando Produção"
            )
        ]

        for cod_p, cliente, id_prod, qtd, data_ent, val, obs, st in pedidos_def:
            ped = db.query(PedidoComercial).filter(PedidoComercial.codigo_pedido == cod_p).first()
            if not ped:
                ped = PedidoComercial(
                    codigo_pedido=cod_p,
                    nome_cliente=cliente,
                    id_produto=id_prod,
                    quantidade_pecas=qtd,
                    data_entrega_desejada=data_ent,
                    valor_total=val,
                    observacoes=obs,
                    status_pedido=st
                )
                db.add(ped)
                print(f"  -> Pedido cadastrado: {cod_p} - {cliente} (R$ {val})")

        db.commit()
        print("\n==================================================")
        print(" SUCESSO: BANCO DE DADOS POVOADO COM EXCELÊNCIA! ")
        print("==================================================")

    except Exception as e:
        db.rollback()
        print(f"\n[ERRO CRÍTICO] Falha ao popular o banco: {str(e)}")
        import traceback
        traceback.print_exc()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    popular_banco()
