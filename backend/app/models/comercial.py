# app/models/comercial.py

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Date, Text
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.estoque import get_utc_now

class PedidoComercial(Base):
    __tablename__ = "pedidos_comercial"

    id_pedido = Column(Integer, primary_key=True, index=True)
    codigo_pedido = Column(String(20), unique=True, nullable=False, index=True) # Ex: '#PED-01'
    nome_cliente = Column(String(150), nullable=False) # Ex: 'Loja Beta'
    
    # FK vinculando o pedido ao modelo da Ficha Técnica
    id_produto = Column(Integer, ForeignKey("produtos.id_produto", ondelete="RESTRICT"), nullable=False)
    
    quantidade_pecas = Column(Integer, nullable=False)
    data_entrega_desejada = Column(Date, nullable=False)
    valor_total = Column(Numeric(12, 2), nullable=False) # R$ com 2 casas decimais
    observacoes = Column(Text, nullable=True) # Campo livre para detalhes como "elástico reforçado"
    
    status_pedido = Column(String(50), default="Aguardando Produção")
    
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relacionamento com Produto
    produto = relationship("Produto")