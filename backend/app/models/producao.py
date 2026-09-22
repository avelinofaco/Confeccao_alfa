from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.estoque import get_utc_now # Reutilizando a função de data

class OrdemProducao(Base):
    __tablename__ = "ordens_producao"

    id_op = Column(Integer, primary_key=True, index=True)
    codigo_op = Column(String(20), unique=True, nullable=False, index=True) # Ex: OP#101
    id_produto = Column(Integer, ForeignKey("produtos.id_produto", ondelete="RESTRICT"), nullable=False)
    
    # Dados de Envio
    peso_malha_enviado = Column(Numeric(10, 3), nullable=False)
    
    # Dados de Retorno (Podem ser nulos no momento do envio)
    quantidade_pecas_cortadas = Column(Integer, nullable=True)
    rendimento_real = Column(Numeric(10, 2), nullable=True)
    
    status_op = Column(String(50), default="Enviado para Corte") # Controle de fluxo
    
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relacionamento com o Produto
    produto = relationship("Produto")