# app/routers/contexto.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models import contexto as models_contexto
from app.models import ficha_tecnica as models_ficha
from app.models import producao as models_prod
from app.schemas import contexto as schemas_contexto

router = APIRouter(
    prefix="/contextos",
    tags=["Contextos e Workflows de Produção"]
)

def get_utc_now():
    return datetime.now(timezone.utc)

# ========================================================
# CRUD DE CONTEXTOS DE PRODUTO
# ========================================================
@router.get("/", response_model=List[schemas_contexto.ContextoProdutoDetalhadoResponse])
def listar_contextos(db: Session = Depends(get_db)):
    """Lista todos os contextos/famílias de confecção cadastrados com suas respectivas etapas."""
    return db.query(models_contexto.ContextoProduto).all()

@router.get("/{id_contexto}", response_model=schemas_contexto.ContextoProdutoDetalhadoResponse)
def buscar_contexto(id_contexto: int, db: Session = Depends(get_db)):
    """Busca os detalhes de um contexto específico, seus schemas e etapas."""
    ctx = db.query(models_contexto.ContextoProduto).filter(
        models_contexto.ContextoProduto.id_contexto == id_contexto
    ).first()
    if not ctx:
        raise HTTPException(status_code=404, detail="Contexto não encontrado.")
    return ctx

@router.post("/", response_model=schemas_contexto.ContextoProdutoDetalhadoResponse, status_code=status.HTTP_201_CREATED)
def criar_contexto(dados: schemas_contexto.ContextoProdutoCreate, db: Session = Depends(get_db)):
    """Cria um novo contexto/família de produtos (ex: Camisetas, Calcinhas, Jeans)."""
    existente = db.query(models_contexto.ContextoProduto).filter(
        models_contexto.ContextoProduto.codigo == dados.codigo.upper().strip()
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Já existe um contexto com este código.")

    novo_ctx = models_contexto.ContextoProduto(
        codigo=dados.codigo.upper().strip(),
        nome=dados.nome.strip(),
        descricao=dados.descricao,
        unidade_principal=dados.unidade_principal,
        habilita_grade_tamanhos=dados.habilita_grade_tamanhos,
        habilita_lavanderia=dados.habilita_lavanderia,
        habilita_estamparia=dados.habilita_estamparia,
        habilita_controle_elasticos=dados.habilita_controle_elasticos,
        habilita_rendimento_peso=dados.habilita_rendimento_peso,
        schema_campos_customizados=dados.schema_campos_customizados or []
    )
    db.add(novo_ctx)
    db.commit()
    db.refresh(novo_ctx)

    # Se foram passadas etapas iniciais, cria-as
    if dados.etapas_iniciais:
        for idx, etapa_in in enumerate(dados.etapas_iniciais):
            etapa_obj = models_contexto.WorkflowEtapa(
                id_contexto=novo_ctx.id_contexto,
                codigo_etapa=etapa_in.codigo_etapa.lower().strip(),
                nome_etapa=etapa_in.nome_etapa.strip(),
                ordem_etapa=etapa_in.ordem_etapa or (idx + 1),
                tipo_operacao=etapa_in.tipo_operacao or "INTERNA",
                permite_perda=etapa_in.permite_perda,
                descricao_instrucao=etapa_in.descricao_instrucao,
                campos_etapa=etapa_in.campos_etapa or []
            )
            db.add(etapa_obj)
        db.commit()
        db.refresh(novo_ctx)

    return novo_ctx

@router.put("/{id_contexto}", response_model=schemas_contexto.ContextoProdutoDetalhadoResponse)
def atualizar_contexto(id_contexto: int, dados: schemas_contexto.ContextoProdutoUpdate, db: Session = Depends(get_db)):
    """Atualiza configurações, feature flags ou schemas de um contexto."""
    ctx = db.query(models_contexto.ContextoProduto).filter(
        models_contexto.ContextoProduto.id_contexto == id_contexto
    ).first()
    if not ctx:
        raise HTTPException(status_code=404, detail="Contexto não encontrado.")

    dados_dict = dados.model_dump(exclude_unset=True)
    for chave, valor in dados_dict.items():
        setattr(ctx, chave, valor)

    ctx.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(ctx)
    return ctx

@router.delete("/{id_contexto}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_contexto(id_contexto: int, db: Session = Depends(get_db)):
    """Remove um contexto e suas etapas."""
    ctx = db.query(models_contexto.ContextoProduto).filter(
        models_contexto.ContextoProduto.id_contexto == id_contexto
    ).first()
    if not ctx:
        raise HTTPException(status_code=404, detail="Contexto não encontrado.")
    
    # Desvincula produtos que apontavam para este contexto
    db.query(models_ficha.Produto).filter(
        models_ficha.Produto.id_contexto == id_contexto
    ).update({"id_contexto": None})

    db.delete(ctx)
    db.commit()
    return None

# ========================================================
# CRUD DE ETAPAS DO WORKFLOW
# ========================================================
@router.post("/{id_contexto}/etapas", response_model=schemas_contexto.WorkflowEtapaResponse, status_code=status.HTTP_201_CREATED)
def adicionar_etapa_workflow(id_contexto: int, etapa: schemas_contexto.WorkflowEtapaCreate, db: Session = Depends(get_db)):
    """Adiciona uma nova etapa ao fluxo de produção do contexto."""
    ctx = db.query(models_contexto.ContextoProduto).filter(
        models_contexto.ContextoProduto.id_contexto == id_contexto
    ).first()
    if not ctx:
        raise HTTPException(status_code=404, detail="Contexto não encontrado.")

    nova_etapa = models_contexto.WorkflowEtapa(
        id_contexto=id_contexto,
        codigo_etapa=etapa.codigo_etapa.lower().strip(),
        nome_etapa=etapa.nome_etapa.strip(),
        ordem_etapa=etapa.ordem_etapa,
        tipo_operacao=etapa.tipo_operacao or "INTERNA",
        permite_perda=etapa.permite_perda,
        descricao_instrucao=etapa.descricao_instrucao,
        campos_etapa=etapa.campos_etapa or []
    )
    db.add(nova_etapa)
    db.commit()
    db.refresh(nova_etapa)
    return nova_etapa

@router.put("/{id_contexto}/etapas/{id_etapa}", response_model=schemas_contexto.WorkflowEtapaResponse)
def atualizar_etapa_workflow(id_contexto: int, id_etapa: int, dados: schemas_contexto.WorkflowEtapaUpdate, db: Session = Depends(get_db)):
    """Atualiza as propriedades ou ordem de uma etapa do workflow."""
    etapa = db.query(models_contexto.WorkflowEtapa).filter(
        models_contexto.WorkflowEtapa.id_etapa == id_etapa,
        models_contexto.WorkflowEtapa.id_contexto == id_contexto
    ).first()
    if not etapa:
        raise HTTPException(status_code=404, detail="Etapa do workflow não encontrada.")

    dados_dict = dados.model_dump(exclude_unset=True)
    for chave, valor in dados_dict.items():
        setattr(etapa, chave, valor)

    db.commit()
    db.refresh(etapa)
    return etapa

@router.delete("/{id_contexto}/etapas/{id_etapa}", status_code=status.HTTP_204_NO_CONTENT)
def remover_etapa_workflow(id_contexto: int, id_etapa: int, db: Session = Depends(get_db)):
    """Remove uma etapa do workflow."""
    etapa = db.query(models_contexto.WorkflowEtapa).filter(
        models_contexto.WorkflowEtapa.id_etapa == id_etapa,
        models_contexto.WorkflowEtapa.id_contexto == id_contexto
    ).first()
    if not etapa:
        raise HTTPException(status_code=404, detail="Etapa do workflow não encontrada.")

    db.delete(etapa)
    db.commit()
    return None

# ========================================================
# SEMEAR CONTEXTOS E FLUXOS PADRÃO DA INDÚSTRIA
# ========================================================
@router.post("/semear-padroes", response_model=List[schemas_contexto.ContextoProdutoDetalhadoResponse])
def semear_contextos_padrao(db: Session = Depends(get_db)):
    """
    Inicializa os contextos e workflows padrões da indústria da confecção:
    1. Camisetas & Básicos
    2. Moda Íntima / Calcinhas
    3. Jeans & Sarja
    4. Moda Praia & Fitness
    """
    padroes = [
        {
            "codigo": "CAMISETA",
            "nome": "Camisetas & Básicos",
            "descricao": "Vestuário casual em malharia circular. Foco em peso (kg), rendimento de corte e estamparia.",
            "unidade_principal": "kg",
            "habilita_grade_tamanhos": True,
            "habilita_estamparia": True,
            "habilita_lavanderia": False,
            "habilita_controle_elasticos": False,
            "habilita_rendimento_peso": True,
            "schema_campos_customizados": [
                {
                    "nome": "tipo_malha",
                    "label": "Tipo de Malha",
                    "tipo": "select",
                    "opcoes": ["Meia Malha 30.1 Penteada", "Malha Fria (PV)", "Piquet PA", "Moletom 3 Cabos", "Dry Fit Poliéster"],
                    "required": True
                },
                {
                    "nome": "tipo_estampa",
                    "label": "Processo de Estampa",
                    "tipo": "select",
                    "opcoes": ["Sem Estampa (Liso)", "Silk Screen Base D'água", "Sublimação Total", "Bordado Peito", "Transfer DTF"],
                    "required": False
                },
                {
                    "nome": "tipo_gola",
                    "label": "Tipo de Gola",
                    "tipo": "select",
                    "opcoes": ["Gola Redonda Ribana 1x1", "Gola V", "Gola Polo com Peitilho", "Gola Alta Ribana"],
                    "required": False
                }
            ],
            "etapas": [
                {"codigo": "corte", "nome": "Corte de Malha & Encaixe", "ordem": 1, "tipo": "INTERNA", "instrucao": "Pesar o rolo de malha e medir rendimento peças/kg."},
                {"codigo": "estamparia", "nome": "Estamparia / Silk Screen", "ordem": 2, "tipo": "EXTERNA", "instrucao": "Envio para oficina de silk. Rastrear peças cortadas enviadas."},
                {"codigo": "costura", "nome": "Costura (Overloque / Galoneira)", "ordem": 3, "tipo": "INTERNA", "instrucao": "Fechamento de ombro, gola e barra."},
                {"codigo": "acabamento", "nome": "Revisão, Passadoria & Embalagem", "ordem": 4, "tipo": "INTERNA", "instrucao": "Limpeza de fios, dobragem e colocação de tag/sacola."}
            ]
        },
        {
            "codigo": "CALCINHA",
            "nome": "Moda Íntima / Calcinhas",
            "descricao": "Lingerie delicada. Rastreio em metros de elástico/renda, fundilho 100% algodão e tensão de catraca.",
            "unidade_principal": "metros",
            "habilita_grade_tamanhos": True,
            "habilita_estamparia": False,
            "habilita_lavanderia": False,
            "habilita_controle_elasticos": True,
            "habilita_rendimento_peso": False,
            "schema_campos_customizados": [
                {
                    "nome": "tecido_principal",
                    "label": "Tecido Principal",
                    "tipo": "select",
                    "opcoes": ["Microfibra Poliamida 88/12", "Renda com Elastano", "Algodão Cotton 96/4", "Tule Ilusion"],
                    "required": True
                },
                {
                    "nome": "tipo_elastico",
                    "label": "Tipo de Elástico na Cintura",
                    "tipo": "select",
                    "opcoes": ["Elástico Bico Primavera", "Viés Mexican Dobrável", "Elástico Embutido Cru", "Cós de Renda Larga"],
                    "required": True
                },
                {
                    "nome": "tensao_catraca",
                    "label": "Tensão da Catraca de Elástico",
                    "tipo": "text",
                    "placeholder": "Ex: Nível 3.5 suave / 4.0 firme",
                    "required": False
                },
                {
                    "nome": "tecido_fundilho",
                    "label": "Tecido do Fundilho Higiênico",
                    "tipo": "select",
                    "opcoes": ["100% Algodão Malha 30.1", "Algodão com Tratamento Antibacteriano"],
                    "default": "100% Algodão Malha 30.1",
                    "required": True
                }
            ],
            "etapas": [
                {"codigo": "corte_delicado", "nome": "Corte de Alta Precisão (Serra Fita/Laser)", "ordem": 1, "tipo": "INTERNA", "instrucao": "Corte delicado com moldes e enfesto baixo."},
                {"codigo": "fundilho", "nome": "Preparação & Embutimento do Fundilho", "ordem": 2, "tipo": "INTERNA", "instrucao": "Costurar fundilho de algodão na frente e costas."},
                {"codigo": "aplicacao_elastico", "nome": "Aplicação de Elásticos & Bicos (3 Pontos / Catraca)", "ordem": 3, "tipo": "INTERNA", "instrucao": "Pesponto com catraca tensora para não ondular a peça."},
                {"codigo": "travete_laco", "nome": "Travetes de Reforço & Aplicação de Laço", "ordem": 4, "tipo": "INTERNA", "instrucao": "Travete na lateral e aplicação do lacinho de cetim frontal."},
                {"codigo": "embalagem_cabide", "nome": "Controle de Qualidade & Embalagem em Cabide", "ordem": 5, "tipo": "INTERNA", "instrucao": "Inspeção de costura e encaixe no cabide de lingerie."}
            ]
        },
        {
            "codigo": "JEANS",
            "nome": "Jeans & Sarja",
            "descricao": "Denim pesado e sarjas. Foco em costura reforçada, etapas de lavanderia industrial e metais.",
            "unidade_principal": "metros",
            "habilita_grade_tamanhos": True,
            "habilita_estamparia": False,
            "habilita_lavanderia": True,
            "habilita_controle_elasticos": False,
            "habilita_rendimento_peso": False,
            "schema_campos_customizados": [
                {
                    "nome": "gramatura_denim",
                    "label": "Gramatura do Denim (oz)",
                    "tipo": "select",
                    "opcoes": ["8.5 oz (Leve)", "10.0 oz (Médio)", "12.0 oz (Pesado)", "14.0 oz (Super Pesado)"],
                    "required": True
                },
                {
                    "nome": "tipo_lavagem",
                    "label": "Processo de Lavanderia",
                    "tipo": "select",
                    "opcoes": ["Amaciado Ecológico", "Stone Wash + Enzimas", "Destroyer com Puídos Manuais", "Super Bleach Claro", "Resinado / Marmorizado"],
                    "required": True
                },
                {
                    "nome": "cor_linha_pesponto",
                    "label": "Cor da Linha do Pesponto",
                    "tipo": "select",
                    "opcoes": ["Linha Ocre / Amarela Tradicional", "Linha Marrom Tabaco", "Linha Tom sobre Tom", "Linha Prata"],
                    "required": False
                }
            ],
            "etapas": [
                {"codigo": "corte_pesado", "nome": "Corte em Enfesto Pesado", "ordem": 1, "tipo": "INTERNA", "instrucao": "Faca reta vertical para enfesto grosso de denim."},
                {"codigo": "costura_pesada", "nome": "Costura Pesada (Fechamento & Pespontos)", "ordem": 2, "tipo": "EXTERNA", "instrucao": "Pespontadeiras 2 agulhas, máquina de cós e travete nos passantes."},
                {"codigo": "lavanderia_industrial", "nome": "Lavanderia Industrial Externa", "ordem": 3, "tipo": "EXTERNA", "instrucao": "Remessa para lavanderia parceira para efeitos de lavagem e encolhimento."},
                {"codigo": "acabamento_metais", "nome": "Pregar Botões, Rebites & Caseado", "ordem": 4, "tipo": "INTERNA", "instrucao": "Fixação de metais em prensa pneumática e caseamento."},
                {"codigo": "revisao_passadoria", "nome": "Revisão Final, Passadoria a Vapor & Tags", "ordem": 5, "tipo": "INTERNA", "instrucao": "Revisão de pontos, colocação de tag de couro traseiro e dobra."}
            ]
        }
    ]

    for p in padroes:
        ctx_existente = db.query(models_contexto.ContextoProduto).filter(
            models_contexto.ContextoProduto.codigo == p["codigo"]
        ).first()

        if not ctx_existente:
            novo_ctx = models_contexto.ContextoProduto(
                codigo=p["codigo"],
                nome=p["nome"],
                descricao=p["descricao"],
                unidade_principal=p["unidade_principal"],
                habilita_grade_tamanhos=p["habilita_grade_tamanhos"],
                habilita_lavanderia=p["habilita_lavanderia"],
                habilita_estamparia=p["habilita_estamparia"],
                habilita_controle_elasticos=p["habilita_controle_elasticos"],
                habilita_rendimento_peso=p["habilita_rendimento_peso"],
                schema_campos_customizados=p["schema_campos_customizados"]
            )
            db.add(novo_ctx)
            db.commit()
            db.refresh(novo_ctx)

            for et in p["etapas"]:
                etapa_obj = models_contexto.WorkflowEtapa(
                    id_contexto=novo_ctx.id_contexto,
                    codigo_etapa=et["codigo"],
                    nome_etapa=et["nome"],
                    ordem_etapa=et["ordem"],
                    tipo_operacao=et["tipo"],
                    descricao_instrucao=et["instrucao"],
                    permite_perda=True,
                    campos_etapa=[]
                )
                db.add(etapa_obj)
            db.commit()

    return db.query(models_contexto.ContextoProduto).all()

# ========================================================
# FLUXO DA ORDEM DE PRODUÇÃO (AVANÇO DE ETAPAS NA ESTEIRA)
# ========================================================
@router.get("/ordens/{id_op}/status-workflow", response_model=schemas_contexto.StatusWorkflowOPResponse)
def obter_status_workflow_op(id_op: int, db: Session = Depends(get_db)):
    """Retorna a posição da OP na esteira do seu contexto, etapa atual e histórico."""
    op = db.query(models_prod.OrdemProducao).filter(models_prod.OrdemProducao.id_op == id_op).first()
    if not op:
        raise HTTPException(status_code=404, detail="Ordem de Produção não encontrada.")

    produto = db.query(models_ficha.Produto).filter(models_ficha.Produto.id_produto == op.id_produto).first()
    contexto = produto.contexto if produto else None
    
    todas_etapas = []
    if contexto:
        todas_etapas = contexto.etapas

    etapa_atual = op.etapa_atual
    if not etapa_atual and todas_etapas:
        etapa_atual = todas_etapas[0]

    apontamentos = db.query(models_contexto.ApontamentoEtapaWorkflow).filter(
        models_contexto.ApontamentoEtapaWorkflow.id_op == id_op
    ).order_by(models_contexto.ApontamentoEtapaWorkflow.id_apontamento).all()

    return schemas_contexto.StatusWorkflowOPResponse(
        id_op=op.id_op,
        codigo_op=op.codigo_op,
        nome_produto=produto.nome_modelo if produto else "Produto",
        contexto=contexto,
        etapa_atual=etapa_atual,
        todas_etapas=todas_etapas,
        apontamentos=apontamentos,
        status_op=op.status_op
    )

@router.post("/ordens/{id_op}/avancar-etapa", response_model=schemas_contexto.StatusWorkflowOPResponse)
def avancar_etapa_op(id_op: int, requisicao: schemas_contexto.AvancoWorkflowRequest, db: Session = Depends(get_db)):
    """
    Avança a OP para a próxima etapa configurada no pipeline do seu contexto.
    Registra quantidade concluída, perdas de produção, responsável e campos extras.
    """
    op = db.query(models_prod.OrdemProducao).filter(models_prod.OrdemProducao.id_op == id_op).first()
    if not op:
        raise HTTPException(status_code=404, detail="Ordem de Produção não encontrada.")

    produto = db.query(models_ficha.Produto).filter(models_ficha.Produto.id_produto == op.id_produto).first()
    if not produto or not produto.contexto:
        raise HTTPException(status_code=400, detail="Este produto não possui um fluxo/contexto associado.")

    etapas = produto.contexto.etapas
    if not etapas:
        raise HTTPException(status_code=400, detail="O contexto do produto não possui etapas configuradas.")

    # Se a OP ainda não tem etapa atual, começa na primeira
    etapa_atual = op.etapa_atual or etapas[0]

    # Registra o apontamento da etapa que está sendo finalizada
    apontamento = models_contexto.ApontamentoEtapaWorkflow(
        id_op=op.id_op,
        id_etapa=etapa_atual.id_etapa,
        status_etapa="Concluido",
        quantidade_concluida=requisicao.quantidade_concluida,
        quantidade_perda=requisicao.quantidade_perda or 0,
        responsavel_oficina=requisicao.responsavel_oficina,
        observacoes=requisicao.observacoes,
        dados_customizados=requisicao.dados_customizados or {},
        data_fim=get_utc_now()
    )
    db.add(apontamento)

    # Acha a próxima etapa pelo índice
    idx_atual = -1
    for i, e in enumerate(etapas):
        if e.id_etapa == etapa_atual.id_etapa:
            idx_atual = i
            break

    if idx_atual >= 0 and idx_atual + 1 < len(etapas):
        proxima_etapa = etapas[idx_atual + 1]
        op.id_etapa_atual = proxima_etapa.id_etapa
        op.status_op = f"Em {proxima_etapa.nome_etapa}"
    else:
        # Chegou ao fim do pipeline
        op.id_etapa_atual = None
        op.status_op = "Produção Finalizada"

    db.commit()
    db.refresh(op)

    return obter_status_workflow_op(id_op=id_op, db=db)
