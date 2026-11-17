# app/models/contexto.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base
from app.models.estoque import get_utc_now

class ContextoProduto(Base):
    """
    Define a família da peça e parametriza o fluxo produtivo:
    Ex: 'CAMISETA', 'CALCINHA', 'JEANS', 'FITNESS', 'GERAL'
    """
    __tablename__ = "contextos_produto"

    id_contexto = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(50), unique=True, nullable=False, index=True) # Ex: 'CAMISETA', 'CALCINHA'
    nome = Column(String(100), nullable=False) # Ex: 'Camisetas & Básicos', 'Moda Íntima / Calcinhas'
    descricao = Column(String(255), nullable=True)
    unidade_principal = Column(String(30), default="UNIDADE") # 'kg', 'metros', 'unidade'
    
    # Feature Flags para o contexto da peça
    habilita_grade_tamanhos = Column(Boolean, default=True) # Grade P, M, G, GG ou 36 ao 48
    habilita_lavanderia = Column(Boolean, default=False) # Etapa crítica em jeans
    habilita_estamparia = Column(Boolean, default=False) # Etapa crítica em camisetas
    habilita_controle_elasticos = Column(Boolean, default=False) # Tensão e consumo de elásticos em lingerie
    habilita_rendimento_peso = Column(Boolean, default=True) # Se mede rendimento de corte por peças/kg ou peças/metro

    # Schemas JSON com campos dinâmicos para Ficha Técnica e OP
    schema_campos_customizados = Column(JSON, default=list)

    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relacionamentos
    etapas = relationship(
        "WorkflowEtapa", 
        back_populates="contexto", 
        cascade="all, delete-orphan", 
        order_by="WorkflowEtapa.ordem_etapa"
    )
    produtos = relationship("Produto", back_populates="contexto")


class WorkflowEtapa(Base):
    """
    Etapas sequenciais da esteira produtiva configurada para este contexto:
    Ex: 1. Corte -> 2. Estamparia -> 3. Costura -> 4. Embalagem
    """
    __tablename__ = "workflow_etapas"

    id_etapa = Column(Integer, primary_key=True, index=True)
    id_contexto = Column(Integer, ForeignKey("contextos_produto.id_contexto", ondelete="CASCADE"), nullable=False)
    
    codigo_etapa = Column(String(50), nullable=False) # 'corte', 'estamparia', 'costura', 'lavanderia', 'acabamento'
    nome_etapa = Column(String(100), nullable=False) # Ex: 'Aplicação de Elásticos e Viés'
    ordem_etapa = Column(Integer, default=1, nullable=False)
    
    tipo_operacao = Column(String(50), default="INTERNA") # 'INTERNA' ou 'EXTERNA' (Facção/Parceiro)
    permite_perda = Column(Boolean, default=True)
    descricao_instrucao = Column(String(255), nullable=True) # Instruções operacionais para os operadores
    
    # Metadados de inputs específicos desta etapa (ex: tensão do elástico, operador, lote de lavagem)
    campos_etapa = Column(JSON, default=list)

    criado_em = Column(DateTime(timezone=True), default=get_utc_now)

    # Relacionamentos
    contexto = relationship("ContextoProduto", back_populates="etapas")
    apontamentos = relationship("ApontamentoEtapaWorkflow", back_populates="etapa")


class ApontamentoEtapaWorkflow(Base):
    """
    Histórico de execução de cada etapa de uma Ordem de Produção (OP)
    """
    __tablename__ = "apontamentos_etapa_workflow"

    id_apontamento = Column(Integer, primary_key=True, index=True)
    id_op = Column(Integer, ForeignKey("ordens_producao.id_op", ondelete="CASCADE"), nullable=False)
    id_etapa = Column(Integer, ForeignKey("workflow_etapas.id_etapa", ondelete="RESTRICT"), nullable=False)
    
    status_etapa = Column(String(50), default="Pendente") # 'Pendente', 'Em Andamento', 'Concluido'
    
    quantidade_entrada = Column(Integer, nullable=True)
    quantidade_concluida = Column(Integer, nullable=True)
    quantidade_perda = Column(Integer, default=0)
    
    responsavel_oficina = Column(String(150), nullable=True) # Funcionário ou nome da facção externa
    observacoes = Column(Text, nullable=True)
    
    # Dados dinâmicos preenchidos na execução da etapa
    dados_customizados = Column(JSON, default=dict)
    
    data_inicio = Column(DateTime(timezone=True), default=get_utc_now)
    data_fim = Column(DateTime(timezone=True), nullable=True)

    # Relacionamentos
    op = relationship("OrdemProducao", back_populates="historico_workflow")
    etapa = relationship("WorkflowEtapa", back_populates="apontamentos")
