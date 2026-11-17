# app/models/ficha_tecnica.py

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.estoque import get_utc_now # Reutilizando a função de data

class Produto(Base):
    __tablename__ = "produtos"

    id_produto = Column(Integer, primary_key=True, index=True)
    nome_modelo = Column(String(150), unique=True, nullable=False, index=True)
    referencia_codigo = Column(String(50), nullable=True) # Ex: CAM-301-CLS
    descricao_detalhada = Column(String(255), nullable=True)
    grade_tamanhos_disponiveis = Column(JSON, nullable=True, default=list) # Ex: ["P", "M", "G", "GG"]
    cores_disponiveis = Column(JSON, nullable=True, default=list) # Ex: ["Preto", "Branco"]
    tempo_padrao_total_minutos = Column(Numeric(8, 2), nullable=True, default=0.00)
    custo_estimado_total = Column(Numeric(10, 2), nullable=True, default=0.00)

    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    id_contexto = Column(Integer, ForeignKey("contextos_produto.id_contexto", ondelete="SET NULL"), nullable=True)

    # Relacionamento com a composição (Ficha Técnica)
    # cascade="all, delete-orphan" garante que se apagarmos o produto, a ficha técnica dele é apagada
    composicao = relationship("FichaTecnicaInsumo", back_populates="produto", cascade="all, delete-orphan")
    contexto = relationship("ContextoProduto", back_populates="produtos")

    @property
    def nome_contexto(self):
        return self.contexto.nome if self.contexto else None

    @property
    def codigo_contexto(self):
        return self.contexto.codigo if self.contexto else None



class FichaTecnicaInsumo(Base):
    __tablename__ = "ficha_tecnica_insumos"

    id_ficha_tecnica = Column(Integer, primary_key=True, index=True)
    id_produto = Column(Integer, ForeignKey("produtos.id_produto", ondelete="CASCADE"), nullable=False)
    id_insumo = Column(Integer, ForeignKey("insumos.id_insumo", ondelete="RESTRICT"), nullable=False)
    
    # Gasto por unidade de peça (ex: 0.020 para kg, 1.5 para metros)
    gasto_por_unidade = Column(Numeric(10, 4), nullable=False)

    # Impede de cadastrar o mesmo insumo duas vezes no mesmo produto
    __table_args__ = (UniqueConstraint('id_produto', 'id_insumo', name='uk_produto_insumo'),)

    # Relacionamentos
    produto = relationship("Produto", back_populates="composicao")
    # Referência em texto para evitar importação circular com o model de estoque
    insumo = relationship("Insumo")