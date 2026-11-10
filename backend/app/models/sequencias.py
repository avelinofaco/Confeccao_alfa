# app/models/sequencias.py
from sqlalchemy import Column, Integer, String

from app.database import Base


class SequenciaDocumento(Base):
    """Último número usado por tipo de documento e ano (ex.: PED/2026 → 41)."""

    __tablename__ = "sequencias_documentos"

    prefixo = Column(String(10), primary_key=True)
    ano = Column(Integer, primary_key=True)
    ultimo_numero = Column(Integer, nullable=False, default=0)
