# app/models/camisetas_cadastros.py
"""Cadastros do segmento Camisetas: clientes, cores e grades de tamanhos."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.camisetas import gerar_token_portal
from app.models.estoque import get_utc_now


class CamisetaCliente(Base):
    __tablename__ = "camisetas_clientes"

    id_cliente = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(2), nullable=True)  # 'PF' | 'PJ'
    nome = Column(String(150), nullable=False)
    nome_busca = Column(String(150), nullable=False, index=True)  # sem acento, minúsculo, espaços colapsados
    documento = Column(String(14), nullable=True, unique=True)  # só dígitos
    telefone_whatsapp = Column(String(20), nullable=True)  # só dígitos
    email = Column(String(150), nullable=True)
    cidade = Column(String(100), nullable=True)
    uf = Column(String(2), nullable=True)
    endereco = Column(String(255), nullable=True)
    observacoes = Column(Text, nullable=True)
    token_portal = Column(String(64), nullable=True, unique=True, index=True, default=gerar_token_portal)
    ativo = Column(Boolean, nullable=False, default=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    pedidos = relationship("CamisetaPedido", back_populates="cliente")


class CamisetaCor(Base):
    __tablename__ = "camisetas_cores"

    id_cor = Column(Integer, primary_key=True, index=True)
    nome = Column(String(60), nullable=False, unique=True)
    hex = Column(String(7), nullable=False)
    ativo = Column(Boolean, nullable=False, default=True)


class CamisetaGrade(Base):
    __tablename__ = "camisetas_grades"

    id_grade = Column(Integer, primary_key=True, index=True)
    nome = Column(String(80), nullable=False, unique=True)
    ativo = Column(Boolean, nullable=False, default=True)

    tamanhos = relationship(
        "CamisetaGradeTamanho",
        back_populates="grade",
        cascade="all, delete-orphan",
        order_by="CamisetaGradeTamanho.ordem",
    )


class CamisetaGradeTamanho(Base):
    __tablename__ = "camisetas_grade_tamanhos"
    __table_args__ = (UniqueConstraint("id_grade", "rotulo", name="uk_grade_rotulo"),)

    id_tamanho = Column(Integer, primary_key=True, index=True)
    id_grade = Column(Integer, ForeignKey("camisetas_grades.id_grade", ondelete="CASCADE"), nullable=False)
    rotulo = Column(String(10), nullable=False)
    ordem = Column(Integer, nullable=False)

    grade = relationship("CamisetaGrade", back_populates="tamanhos")
