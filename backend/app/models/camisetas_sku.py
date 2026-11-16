# app/models/camisetas_sku.py
"""Produção e estoque por SKU (modelo + cor + tamanho) do segmento Camisetas."""
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.estoque import get_utc_now


class CamisetaVariacao(Base):
    """O SKU: um modelo numa cor e num tamanho, com o saldo de peças prontas."""
    __tablename__ = "camisetas_variacoes"
    __table_args__ = (
        UniqueConstraint("id_modelo", "id_cor", "id_tamanho", name="uk_variacao_sku"),
        CheckConstraint("saldo >= 0", name="ck_variacao_saldo_nao_negativo"),
    )

    id_variacao = Column(Integer, primary_key=True)
    id_modelo = Column(Integer, ForeignKey("camisetas_modelos.id_modelo", ondelete="RESTRICT"), nullable=False)
    id_cor = Column(Integer, ForeignKey("camisetas_cores.id_cor", ondelete="RESTRICT"), nullable=False)
    id_tamanho = Column(Integer, ForeignKey("camisetas_grade_tamanhos.id_tamanho", ondelete="RESTRICT"), nullable=False)
    saldo = Column(Integer, nullable=False, default=0)
    estoque_minimo = Column(Integer, nullable=False, default=0)

    modelo = relationship("CamisetaModelo")
    cor = relationship("CamisetaCor")
    tamanho = relationship("CamisetaGradeTamanho")


class CamisetaMovimentoEstoque(Base):
    """Cada entrada ou saída de peças prontas, com o saldo que ficou depois dela."""
    __tablename__ = "camisetas_movimentos_estoque"

    id_movimento = Column(Integer, primary_key=True)
    id_variacao = Column(Integer, ForeignKey("camisetas_variacoes.id_variacao", ondelete="RESTRICT"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)
    quantidade = Column(Integer, nullable=False)  # com sinal; nunca zero
    saldo_apos = Column(Integer, nullable=False)
    motivo = Column(String(255), nullable=True)
    id_pedido = Column(Integer, ForeignKey("camisetas_pedidos.id_pedido", ondelete="SET NULL"), nullable=True, index=True)
    id_costura = Column(Integer, ForeignKey("camisetas_costura_faccoes.id_costura", ondelete="SET NULL"), nullable=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)

    variacao = relationship("CamisetaVariacao")
    pedido = relationship("CamisetaPedido")
    remessa = relationship("CamisetaCosturaFaccao")


class CamisetaOpCor(Base):
    """Uma cor do enfesto da OP, com o rolo de malha e o peso usados."""
    __tablename__ = "camisetas_op_cores"
    __table_args__ = (UniqueConstraint("id_op", "id_cor", name="uk_op_cor"),)

    id_op_cor = Column(Integer, primary_key=True)
    id_op = Column(Integer, ForeignKey("camisetas_ordens_producao.id_op", ondelete="CASCADE"), nullable=False)
    id_cor = Column(Integer, ForeignKey("camisetas_cores.id_cor", ondelete="RESTRICT"), nullable=False)
    id_insumo_tecido = Column(Integer, ForeignKey("camisetas_insumos.id_insumo", ondelete="SET NULL"), nullable=True)
    peso_kg = Column(Numeric(10, 3), nullable=False)

    op = relationship("CamisetaOrdemProducao", back_populates="cores")
    cor = relationship("CamisetaCor")
    tecido = relationship("CamisetaInsumo")


class CamisetaOpCorte(Base):
    """Peças cortadas de um SKU numa OP."""
    __tablename__ = "camisetas_op_cortes"
    __table_args__ = (UniqueConstraint("id_op", "id_variacao", name="uk_op_corte"),)

    id_corte = Column(Integer, primary_key=True)
    id_op = Column(Integer, ForeignKey("camisetas_ordens_producao.id_op", ondelete="CASCADE"), nullable=False)
    id_variacao = Column(Integer, ForeignKey("camisetas_variacoes.id_variacao", ondelete="RESTRICT"), nullable=False)
    quantidade = Column(Integer, nullable=False)

    op = relationship("CamisetaOrdemProducao", back_populates="cortes")
    variacao = relationship("CamisetaVariacao")


class CamisetaRemessaItem(Base):
    """Peças de um SKU enviadas a uma facção e quantas voltaram."""
    __tablename__ = "camisetas_remessa_itens"
    __table_args__ = (UniqueConstraint("id_costura", "id_variacao", name="uk_remessa_item"),)

    id_item = Column(Integer, primary_key=True)
    id_costura = Column(Integer, ForeignKey("camisetas_costura_faccoes.id_costura", ondelete="CASCADE"), nullable=False)
    id_variacao = Column(Integer, ForeignKey("camisetas_variacoes.id_variacao", ondelete="RESTRICT"), nullable=False)
    qtd_enviada = Column(Integer, nullable=False)
    qtd_retornada = Column(Integer, nullable=True)

    remessa = relationship("CamisetaCosturaFaccao", back_populates="itens")
    variacao = relationship("CamisetaVariacao")


class CamisetaPedidoItem(Base):
    """Um item do pedido: modelo + cor (+ estampa e posição opcionais), com quantidades por tamanho."""
    __tablename__ = "camisetas_pedido_itens"

    id_item = Column(Integer, primary_key=True)
    id_pedido = Column(Integer, ForeignKey("camisetas_pedidos.id_pedido", ondelete="CASCADE"), nullable=False, index=True)
    id_modelo = Column(Integer, ForeignKey("camisetas_modelos.id_modelo", ondelete="RESTRICT"), nullable=False)
    id_cor = Column(Integer, ForeignKey("camisetas_cores.id_cor", ondelete="RESTRICT"), nullable=True)  # nulo = cor não informada
    id_estampa = Column(Integer, ForeignKey("camisetas_estampas.id_estampa", ondelete="RESTRICT"), nullable=True)
    posicao_estampa = Column(String(40), nullable=True)

    pedido = relationship("CamisetaPedido", back_populates="itens")
    modelo = relationship("CamisetaModelo")
    cor = relationship("CamisetaCor")
    estampa = relationship("CamisetaEstampa")
    quantidades = relationship("CamisetaPedidoItemQtd", back_populates="item", cascade="all, delete-orphan")


class CamisetaPedidoItemQtd(Base):
    __tablename__ = "camisetas_pedido_item_qtds"

    id_item = Column(Integer, ForeignKey("camisetas_pedido_itens.id_item", ondelete="CASCADE"), primary_key=True)
    id_tamanho = Column(Integer, ForeignKey("camisetas_grade_tamanhos.id_tamanho", ondelete="RESTRICT"), primary_key=True)
    quantidade = Column(Integer, nullable=False)

    item = relationship("CamisetaPedidoItem", back_populates="quantidades")
    tamanho = relationship("CamisetaGradeTamanho")
