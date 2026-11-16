# app/models/camisetas_estampas.py
"""Catálogo visual de estampas do segmento Camisetas."""
from sqlalchemy import Boolean, Column, DateTime, Integer, LargeBinary, String, Text

from app.database import Base
from app.models.estoque import get_utc_now


class CamisetaEstampa(Base):
    """Arte cadastrada no Banco de Estampas, com a imagem guardada no próprio banco."""
    __tablename__ = "camisetas_estampas"

    id_estampa = Column(Integer, primary_key=True)
    codigo = Column(String(30), nullable=False, unique=True)
    nome = Column(String(120), nullable=False)
    nome_busca = Column(String(120), nullable=False, index=True)
    observacoes = Column(Text, nullable=True)
    imagem_bytes = Column(LargeBinary, nullable=False)
    imagem_mime = Column(String(40), nullable=False)
    tamanho_bytes = Column(Integer, nullable=False)
    ativo = Column(Boolean, nullable=False, default=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)
