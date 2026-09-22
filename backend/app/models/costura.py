# app/models/costura.py

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.estoque import get_utc_now # Importando a função de data segura

class MovimentacaoCostura(Base):
    __tablename__ = "movimentacoes_costura"

    id_movimentacao = Column(Integer, primary_key=True, index=True)
    id_op = Column(Integer, ForeignKey("ordens_producao.id_op", ondelete="RESTRICT"), nullable=False)
    destino_costura = Column(String(100), nullable=False) # Ex: 'Confecção - Maria'
    
    # Dados de Envio
    quantidade_enviada = Column(Integer, nullable=False)
    margem_seguranca_insumos = Column(Numeric(10, 3), default=0.000)
    data_envio = Column(DateTime(timezone=True), default=get_utc_now)
    
    # Dados de Retorno
    quantidade_recebida = Column(Integer, nullable=True)
    perda_pecas = Column(Integer, nullable=True)
    data_retorno = Column(DateTime(timezone=True), nullable=True)
    
    status_movimentacao = Column(String(50), default="Enviado") # 'Enviado', 'Retornado'

    # Relacionamento com a OP
    op = relationship("OrdemProducao")

class EstoqueProdutoPronto(Base):
    __tablename__ = "estoque_produtos_prontos"

    id_estoque_pronto = Column(Integer, primary_key=True, index=True)
    id_produto = Column(Integer, ForeignKey("produtos.id_produto", ondelete="RESTRICT"), unique=True, nullable=False)
    quantidade_total = Column(Integer, default=0)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relacionamento com Produto
    produto = relationship("Produto")