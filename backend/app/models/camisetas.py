# app/models/camisetas.py
"""
Modelos de dados exclusivos para o Segmento de Camisetas da Confecção Alfa.
Todos os nomes de tabelas, colunas e relacionamentos estruturados em português.
"""

from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Date, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import secrets
from app.database import Base

def get_utc_now():
    return datetime.now(timezone.utc)


def gerar_token_portal() -> str:
    return secrets.token_urlsafe(24)

class CamisetaModelo(Base):
    __tablename__ = "camisetas_modelos"

    id_modelo = Column(Integer, primary_key=True, index=True)
    nome_modelo = Column(String(150), unique=True, nullable=False, index=True) # Ex: Camiseta Básica Gola Redonda
    grade_disponivel = Column(String(100), default="P, M, G, GG")
    consumo_tecido_kg = Column(Numeric(10, 4), default=0.1800, nullable=False) # Ex: 0.180 kg/peça (180g)
    preco_venda_lisa = Column(Numeric(12, 2), default=0.00, nullable=False)
    acrescimo_estampa = Column(Numeric(12, 2), default=0.00, nullable=False)
    descricao = Column(String(255), nullable=True)
    id_grade = Column(Integer, ForeignKey("camisetas_grades.id_grade", ondelete="SET NULL"), nullable=True)
    
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Relacionamentos
    fichas_tecnicas = relationship("CamisetaFichaTecnica", back_populates="modelo", cascade="all, delete-orphan")
    pedidos = relationship("CamisetaPedido", back_populates="modelo")
    ordens = relationship("CamisetaOrdemProducao", back_populates="modelo")
    grade = relationship("CamisetaGrade")


class CamisetaInsumo(Base):
    __tablename__ = "camisetas_insumos"

    id_insumo = Column(Integer, primary_key=True, index=True)
    codigo = Column(String(30), unique=True, nullable=False, index=True) # Ex: MALHA-01, AV-01
    categoria = Column(String(30), nullable=False) # 'ROLO_TECIDO' ou 'AVIAMENTO'
    tipo_malha_ou_aviamento = Column(String(150), nullable=False) # Ex: Meia Malha 30.1 Penteada, Etiqueta Cetim, Linha 120
    cor = Column(String(80), nullable=True) # Ex: Preto, Branco, Mescla, Azul Marinho
    unidade_medida = Column(String(15), nullable=False) # 'kg', 'unidades', 'metros'
    saldo_atual = Column(Numeric(12, 3), default=0.000)
    estoque_minimo = Column(Numeric(12, 3), default=10.000)
    preco_custo_medio = Column(Numeric(12, 2), default=0.00)
    id_cor = Column(Integer, ForeignKey("camisetas_cores.id_cor", ondelete="SET NULL"), nullable=True)  # cor de camiseta que a malha produz

    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    # Entradas de materiais vinculadas
    entradas = relationship("CamisetaEntradaInsumo", back_populates="insumo")
    cor_camiseta = relationship("CamisetaCor")


class CamisetaFichaTecnica(Base):
    __tablename__ = "camisetas_fichas_tecnicas"

    id_ficha = Column(Integer, primary_key=True, index=True)
    id_modelo = Column(Integer, ForeignKey("camisetas_modelos.id_modelo", ondelete="CASCADE"), nullable=False)
    id_insumo = Column(Integer, ForeignKey("camisetas_insumos.id_insumo", ondelete="SET NULL"), nullable=True)
    
    tipo_insumo = Column(String(50), nullable=False) # 'Tecido Principal', 'Ribana', 'Linha', 'Etiqueta', 'Tag'
    descricao_insumo = Column(String(150), nullable=False) # Ex: Meia Malha 30.1 100% Algodão
    consumo_unitario = Column(Numeric(10, 4), nullable=False) # Ex: 0.180 (kg), 1 (unidade etiqueta)
    unidade_medida = Column(String(20), nullable=False) # 'kg', 'unidades', 'metros'
    custo_unitario_estimado = Column(Numeric(10, 2), default=0.00)

    modelo = relationship("CamisetaModelo", back_populates="fichas_tecnicas")
    insumo = relationship("CamisetaInsumo")


class CamisetaEntradaInsumo(Base):
    __tablename__ = "camisetas_entradas_insumos"

    id_entrada = Column(Integer, primary_key=True, index=True)
    id_insumo = Column(Integer, ForeignKey("camisetas_insumos.id_insumo", ondelete="RESTRICT"), nullable=False)
    numero_nota_fiscal = Column(String(60), nullable=True)
    fornecedor = Column(String(150), nullable=True)
    quantidade = Column(Numeric(12, 3), nullable=False)
    valor_total = Column(Numeric(12, 2), default=0.00)
    data_entrada = Column(DateTime(timezone=True), default=get_utc_now)

    insumo = relationship("CamisetaInsumo", back_populates="entradas")


class CamisetaPedido(Base):
    __tablename__ = "camisetas_pedidos"

    id_pedido = Column(Integer, primary_key=True, index=True)
    codigo_pedido = Column(String(30), unique=True, nullable=False, index=True) # Ex: PED-01
    nome_cliente = Column(String(150), nullable=False)
    id_cliente = Column(Integer, ForeignKey("camisetas_clientes.id_cliente", ondelete="RESTRICT"), nullable=True)
    id_modelo = Column(Integer, ForeignKey("camisetas_modelos.id_modelo", ondelete="RESTRICT"), nullable=False)
    
    grade_p = Column(Integer, default=0)
    grade_m = Column(Integer, default=0)
    grade_g = Column(Integer, default=0)
    grade_gg = Column(Integer, default=0)
    quantidade_total = Column(Integer, nullable=False) # Soma automática de P + M + G + GG
    
    prazo_entrega = Column(Date, nullable=False)
    valor_total = Column(Numeric(12, 2), nullable=False)
    status_pedido = Column(String(50), default="Aguardando Produção")
    observacoes = Column(Text, nullable=True)
    data_entrega_realizada = Column(Date, nullable=True)  # preenchida ao registrar a entrega
    token_aprovacao = Column(String(64), nullable=True, unique=True, index=True, default=gerar_token_portal)
    status_aprovacao_cliente = Column(String(30), nullable=False, default="Pendente")
    observacao_cliente = Column(Text, nullable=True)
    aprovado_pelo_cliente_em = Column(DateTime(timezone=True), nullable=True)

    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    modelo = relationship("CamisetaModelo", back_populates="pedidos")
    cliente = relationship("CamisetaCliente", back_populates="pedidos")
    itens = relationship("CamisetaPedidoItem", back_populates="pedido", cascade="all, delete-orphan", order_by="CamisetaPedidoItem.id_item")


class CamisetaOrdemProducao(Base):
    __tablename__ = "camisetas_ordens_producao"

    id_op = Column(Integer, primary_key=True, index=True)
    codigo_op = Column(String(30), unique=True, nullable=False, index=True) # Ex: OP-CAM-101
    id_modelo = Column(Integer, ForeignKey("camisetas_modelos.id_modelo", ondelete="RESTRICT"), nullable=False)
    id_insumo_tecido = Column(Integer, ForeignKey("camisetas_insumos.id_insumo", ondelete="SET NULL"), nullable=True)
    id_pedido = Column(Integer, ForeignKey("camisetas_pedidos.id_pedido", ondelete="SET NULL"), nullable=True)
    
    peso_malha_enviado_kg = Column(Numeric(10, 3), nullable=False)
    pecas_planejadas = Column(Integer, nullable=True)
    pecas_reais_cortadas = Column(Integer, nullable=True)
    rendimento_real_pecas_kg = Column(Numeric(10, 2), nullable=True) # peças_cortadas / peso_malha_enviado_kg
    
    status_op = Column(String(50), default="Em Aberto") # 'Em Aberto', 'Cortado', 'Enviado Facção', 'Finalizado'
    data_corte = Column(DateTime(timezone=True), nullable=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)

    modelo = relationship("CamisetaModelo", back_populates="ordens")
    tecido = relationship("CamisetaInsumo")
    pedido = relationship("CamisetaPedido")
    movimentacoes_costura = relationship("CamisetaCosturaFaccao", back_populates="op")
    cores = relationship("CamisetaOpCor", back_populates="op", cascade="all, delete-orphan", order_by="CamisetaOpCor.id_op_cor")
    cortes = relationship("CamisetaOpCorte", back_populates="op", cascade="all, delete-orphan", order_by="CamisetaOpCorte.id_corte")


class CamisetaCosturaFaccao(Base):
    __tablename__ = "camisetas_costura_faccoes"

    id_costura = Column(Integer, primary_key=True, index=True)
    id_op = Column(Integer, ForeignKey("camisetas_ordens_producao.id_op", ondelete="RESTRICT"), nullable=False)
    nome_faccao = Column(String(150), nullable=False) # Nome da oficina ou facção terceirizada
    
    quantidade_enviada = Column(Integer, nullable=False) # Painéis cortados enviados
    margem_seguranca_aviamentos_percentual = Column(Numeric(5, 2), default=3.00) # Ex: 3.00%
    
    quantidade_retornada = Column(Integer, nullable=True) # Camisetas costuradas que voltaram
    perdas_pecas = Column(Integer, nullable=True) # Calculado: enviada - retornada
    saldo_aprovado = Column(Integer, nullable=True) # Peças prontas e aprovadas
    
    status = Column(String(50), default="Em Costura Externa") # 'Em Costura Externa', 'Retornado e Conferido', 'Finalizado'
    data_envio = Column(DateTime(timezone=True), default=get_utc_now)
    data_retorno = Column(DateTime(timezone=True), nullable=True)
    observacoes = Column(Text, nullable=True)

    op = relationship("CamisetaOrdemProducao", back_populates="movimentacoes_costura")
    itens = relationship("CamisetaRemessaItem", back_populates="remessa", cascade="all, delete-orphan", order_by="CamisetaRemessaItem.id_item")


class CamisetaProdutoAcabado(Base):
    __tablename__ = "camisetas_produtos_acabados"

    id_estoque_acabado = Column(Integer, primary_key=True, index=True)
    id_modelo = Column(Integer, ForeignKey("camisetas_modelos.id_modelo", ondelete="RESTRICT"), unique=True, nullable=False)
    grade_p = Column(Integer, default=0)
    grade_m = Column(Integer, default=0)
    grade_g = Column(Integer, default=0)
    grade_gg = Column(Integer, default=0)
    quantidade_total = Column(Integer, default=0)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    modelo = relationship("CamisetaModelo")


class CamisetaRegistroFinanceiro(Base):
    __tablename__ = "camisetas_registros_financeiros"

    id_registro = Column(Integer, primary_key=True, index=True)
    mes_ano = Column(String(15), nullable=False, index=True) # Ex: '2026-10' ou 'Out/2026'
    valor_gasto_materiais = Column(Numeric(14, 2), default=0.00) # Saídas têxteis e aviamentos
    faturamento_receita = Column(Numeric(14, 2), default=0.00) # Faturamento bruto com vendas
    outros_custos_operacionais = Column(Numeric(14, 2), default=0.00) # Facções, energia, etc.
    lucro_liquido = Column(Numeric(14, 2), default=0.00) # Entradas líquidas (faturamento - gastos)
    observacoes = Column(Text, nullable=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)


# Registra as classes usadas nos relacionamentos por nome (cliente, cor, grade, SKU).
from app.models import camisetas_cadastros, camisetas_sku  # noqa: E402,F401
