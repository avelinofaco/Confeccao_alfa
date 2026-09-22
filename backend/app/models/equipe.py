# app/models/equipe.py

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Date, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.estoque import get_utc_now

class Colaborador(Base):
    __tablename__ = "colaboradores"

    id_colaborador = Column(Integer, primary_key=True, index=True)
    nome_completo = Column(String(150), nullable=False)
    telefone_whatsapp = Column(String(20), nullable=True) # Ex: '(85) 9 9999-9999'
    ativo = Column(Boolean, default=True)
    
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relacionamento com as presenças
    presencas = relationship("PresencaEquipe", back_populates="colaborador", cascade="all, delete-orphan")

class PresencaEquipe(Base):
    __tablename__ = "presencas_equipe"

    id_presenca = Column(Integer, primary_key=True, index=True)
    id_colaborador = Column(Integer, ForeignKey("colaboradores.id_colaborador", ondelete="CASCADE"), nullable=False)
    data_referencia = Column(Date, nullable=False) # Apenas a data (ex: 2026-08-19)
    presente = Column(Boolean, default=False) # True = Presente, False = Falta
    
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)

    # Evita que o sistema registre duas presenças/faltas para a mesma pessoa no mesmo dia
    __table_args__ = (UniqueConstraint('id_colaborador', 'data_referencia', name='uk_colaborador_data'),)

    colaborador = relationship("Colaborador", back_populates="presencas")