# app/models/estoque.py

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

# Função auxiliar para gerar o horário atual com fuso horário UTC
def get_utc_now():
    return datetime.now(timezone.utc)

class Insumo(Base):
    __tablename__ = "insumos"

    id_insumo = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(20), unique=True, nullable=False, index=True)
    categoria = Column(String(30), nullable=False) # 'MALHA' ou 'AVIAMENTO'
    tipo = Column(String(100), nullable=False)
    quantidade_atual = Column(Numeric(10, 3), default=0.000)
    unidade_medida = Column(String(10), nullable=False) # 'kg' ou 'metros'
    estoque_minimo_seguranca = Column(Numeric(10, 3), default=0.000)
    
    # Atualizado para timezone-aware
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relacionamento com as entradas
    entradas = relationship("EntradaEstoque", back_populates="insumo")


class EntradaEstoque(Base):
    __tablename__ = "entradas_estoque"

    id_entrada = Column(Integer, primary_key=True, index=True)
    id_insumo = Column(Integer, ForeignKey("insumos.id_insumo", ondelete="RESTRICT"), nullable=False)
    quantidade_recebida = Column(Numeric(10, 3), nullable=False)
    
    # Atualizado para timezone-aware
    data_entrada = Column(DateTime(timezone=True), default=get_utc_now)

    # Relacionamento de volta para Insumo
    insumo = relationship("Insumo", back_populates="entradas")
    