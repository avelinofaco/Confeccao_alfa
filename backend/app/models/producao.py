from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.estoque import get_utc_now # Reutilizando a função de data

class OrdemProducao(Base):
    __tablename__ = "ordens_producao"

    id_op = Column(Integer, primary_key=True, index=True)
    codigo_op = Column(String(20), unique=True, nullable=False, index=True) # Ex: OP#101
    id_produto = Column(Integer, ForeignKey("produtos.id_produto", ondelete="RESTRICT"), nullable=False)
    
    # Dados de Envio Tradicionais (Mantidos para retrocompatibilidade)
    peso_malha_enviado = Column(Numeric(10, 3), nullable=True, default=0.000)
    
    # Dados de Retorno (Podem ser nulos no momento do envio)
    quantidade_pecas_cortadas = Column(Integer, nullable=True)
    rendimento_real = Column(Numeric(10, 2), nullable=True)
    
    status_op = Column(String(50), default="Enviado para Corte") # Controle de fluxo
    
    # Suporte a Workflow Dinâmico e Multi-Contexto
    id_etapa_atual = Column(Integer, ForeignKey("workflow_etapas.id_etapa", ondelete="SET NULL"), nullable=True)
    dados_contexto = Column(JSON, nullable=True, default=dict) # Dados extras: grade, metragem microfibra, etc.

    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relacionamentos
    produto = relationship("Produto")
    etapa_atual = relationship("WorkflowEtapa")
    historico_workflow = relationship("ApontamentoEtapaWorkflow", back_populates="op", cascade="all, delete-orphan")