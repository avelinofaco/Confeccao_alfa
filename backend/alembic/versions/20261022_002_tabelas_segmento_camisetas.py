"""tabelas_segmento_camisetas

Revision ID: 20261022_002_camisetas
Revises: 20261022_001_antiga
Create Date: 2026-10-22 10:30:00.000000

Criação das tabelas especialistas do Segmento de Camisetas (Confecção Alfa),
com nomes em português e suporte ao fluxo completo das 7 telas operacionais.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '20261022_002_camisetas'
down_revision: Union[str, None] = '20261022_001_antiga'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabela de Modelos de Camisetas
    op.create_table(
        'camisetas_modelos',
        sa.Column('id_modelo', sa.Integer(), nullable=False),
        sa.Column('nome_modelo', sa.String(length=150), nullable=False),
        sa.Column('grade_disponivel', sa.String(length=100), default='P, M, G, GG'),
        sa.Column('consumo_tecido_kg', sa.Numeric(precision=10, scale=4), nullable=False, default=0.1800),
        sa.Column('descricao', sa.String(length=255), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id_modelo')
    )
    op.create_index(op.f('ix_camisetas_modelos_id_modelo'), 'camisetas_modelos', ['id_modelo'], unique=False)
    op.create_index(op.f('ix_camisetas_modelos_nome_modelo'), 'camisetas_modelos', ['nome_modelo'], unique=True)

    # 2. Tabela de Insumos Especialistas de Camisetas (Malhas e Aviamentos)
    op.create_table(
        'camisetas_insumos',
        sa.Column('id_insumo', sa.Integer(), nullable=False),
        sa.Column('codigo', sa.String(length=30), nullable=False),
        sa.Column('categoria', sa.String(length=30), nullable=False), # 'ROLO_TECIDO' ou 'AVIAMENTO'
        sa.Column('tipo_malha_ou_aviamento', sa.String(length=150), nullable=False),
        sa.Column('cor', sa.String(length=80), nullable=True),
        sa.Column('unidade_medida', sa.String(length=15), nullable=False), # 'kg', 'unidades', 'metros'
        sa.Column('saldo_atual', sa.Numeric(precision=12, scale=3), default=0.000),
        sa.Column('estoque_minimo', sa.Numeric(precision=12, scale=3), default=10.000),
        sa.Column('preco_custo_medio', sa.Numeric(precision=12, scale=2), default=0.00),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id_insumo')
    )
    op.create_index(op.f('ix_camisetas_insumos_codigo'), 'camisetas_insumos', ['codigo'], unique=True)
    op.create_index(op.f('ix_camisetas_insumos_id_insumo'), 'camisetas_insumos', ['id_insumo'], unique=False)

    # 3. Tabela de Ficha Técnica Digital de Camisetas
    op.create_table(
        'camisetas_fichas_tecnicas',
        sa.Column('id_ficha', sa.Integer(), nullable=False),
        sa.Column('id_modelo', sa.Integer(), nullable=False),
        sa.Column('id_insumo', sa.Integer(), nullable=True),
        sa.Column('tipo_insumo', sa.String(length=50), nullable=False),
        sa.Column('descricao_insumo', sa.String(length=150), nullable=False),
        sa.Column('consumo_unitario', sa.Numeric(precision=10, scale=4), nullable=False),
        sa.Column('unidade_medida', sa.String(length=20), nullable=False),
        sa.Column('custo_unitario_estimado', sa.Numeric(precision=10, scale=2), default=0.00),
        sa.ForeignKeyConstraint(['id_insumo'], ['camisetas_insumos.id_insumo'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['id_modelo'], ['camisetas_modelos.id_modelo'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_ficha')
    )
    op.create_index(op.f('ix_camisetas_fichas_tecnicas_id_ficha'), 'camisetas_fichas_tecnicas', ['id_ficha'], unique=False)

    # 4. Tabela de Entradas de Estoque de Camisetas (Compras e NFs)
    op.create_table(
        'camisetas_entradas_insumos',
        sa.Column('id_entrada', sa.Integer(), nullable=False),
        sa.Column('id_insumo', sa.Integer(), nullable=False),
        sa.Column('numero_nota_fiscal', sa.String(length=60), nullable=True),
        sa.Column('fornecedor', sa.String(length=150), nullable=True),
        sa.Column('quantidade', sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column('valor_total', sa.Numeric(precision=12, scale=2), default=0.00),
        sa.Column('data_entrada', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['id_insumo'], ['camisetas_insumos.id_insumo'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_entrada')
    )
    op.create_index(op.f('ix_camisetas_entradas_insumos_id_entrada'), 'camisetas_entradas_insumos', ['id_entrada'], unique=False)

    # 5. Tabela de Pedidos do Cliente (Comercial de Camisetas)
    op.create_table(
        'camisetas_pedidos',
        sa.Column('id_pedido', sa.Integer(), nullable=False),
        sa.Column('codigo_pedido', sa.String(length=30), nullable=False),
        sa.Column('nome_cliente', sa.String(length=150), nullable=False),
        sa.Column('id_modelo', sa.Integer(), nullable=False),
        sa.Column('grade_p', sa.Integer(), default=0),
        sa.Column('grade_m', sa.Integer(), default=0),
        sa.Column('grade_g', sa.Integer(), default=0),
        sa.Column('grade_gg', sa.Integer(), default=0),
        sa.Column('quantidade_total', sa.Integer(), nullable=False),
        sa.Column('prazo_entrega', sa.Date(), nullable=False),
        sa.Column('valor_total', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status_pedido', sa.String(length=50), default='Aguardando Produção'),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['id_modelo'], ['camisetas_modelos.id_modelo'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_pedido')
    )
    op.create_index(op.f('ix_camisetas_pedidos_codigo_pedido'), 'camisetas_pedidos', ['codigo_pedido'], unique=True)
    op.create_index(op.f('ix_camisetas_pedidos_id_pedido'), 'camisetas_pedidos', ['id_pedido'], unique=False)

    # 6. Tabela de Ordens de Produção e Corte (PCP Camisetas)
    op.create_table(
        'camisetas_ordens_producao',
        sa.Column('id_op', sa.Integer(), nullable=False),
        sa.Column('codigo_op', sa.String(length=30), nullable=False),
        sa.Column('id_modelo', sa.Integer(), nullable=False),
        sa.Column('id_insumo_tecido', sa.Integer(), nullable=True),
        sa.Column('peso_malha_enviado_kg', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('pecas_planejadas', sa.Integer(), nullable=True),
        sa.Column('pecas_reais_cortadas', sa.Integer(), nullable=True),
        sa.Column('rendimento_real_pecas_kg', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('status_op', sa.String(length=50), default='Em Aberto'),
        sa.Column('data_corte', sa.DateTime(timezone=True), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['id_insumo_tecido'], ['camisetas_insumos.id_insumo'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['id_modelo'], ['camisetas_modelos.id_modelo'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_op')
    )
    op.create_index(op.f('ix_camisetas_ordens_producao_codigo_op'), 'camisetas_ordens_producao', ['codigo_op'], unique=True)
    op.create_index(op.f('ix_camisetas_ordens_producao_id_op'), 'camisetas_ordens_producao', ['id_op'], unique=False)

    # 7. Tabela de Costura e Facções Terceirizadas de Camisetas
    op.create_table(
        'camisetas_costura_faccoes',
        sa.Column('id_costura', sa.Integer(), nullable=False),
        sa.Column('id_op', sa.Integer(), nullable=False),
        sa.Column('nome_faccao', sa.String(length=150), nullable=False),
        sa.Column('quantidade_enviada', sa.Integer(), nullable=False),
        sa.Column('margem_seguranca_aviamentos_percentual', sa.Numeric(precision=5, scale=2), default=3.00),
        sa.Column('quantidade_retornada', sa.Integer(), nullable=True),
        sa.Column('perdas_pecas', sa.Integer(), nullable=True),
        sa.Column('saldo_aprovado', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=50), default='Em Costura Externa'),
        sa.Column('data_envio', sa.DateTime(timezone=True), nullable=True),
        sa.Column('data_retorno', sa.DateTime(timezone=True), nullable=True),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['id_op'], ['camisetas_ordens_producao.id_op'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_costura')
    )
    op.create_index(op.f('ix_camisetas_costura_faccoes_id_costura'), 'camisetas_costura_faccoes', ['id_costura'], unique=False)

    # 8. Tabela de Estoque de Camisetas Prontas (Produtos Acabados)
    op.create_table(
        'camisetas_produtos_acabados',
        sa.Column('id_estoque_acabado', sa.Integer(), nullable=False),
        sa.Column('id_modelo', sa.Integer(), nullable=False),
        sa.Column('grade_p', sa.Integer(), default=0),
        sa.Column('grade_m', sa.Integer(), default=0),
        sa.Column('grade_g', sa.Integer(), default=0),
        sa.Column('grade_gg', sa.Integer(), default=0),
        sa.Column('quantidade_total', sa.Integer(), default=0),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['id_modelo'], ['camisetas_modelos.id_modelo'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_estoque_acabado'),
        sa.UniqueConstraint('id_modelo')
    )
    op.create_index(op.f('ix_camisetas_produtos_acabados_id_estoque_acabado'), 'camisetas_produtos_acabados', ['id_estoque_acabado'], unique=False)

    # 9. Tabela de Registros Financeiros (Custos e Lucratividade - Gráfico do Dashboard)
    op.create_table(
        'camisetas_registros_financeiros',
        sa.Column('id_registro', sa.Integer(), nullable=False),
        sa.Column('mes_ano', sa.String(length=15), nullable=False), # Ex: '2026-10' ou 'Out/2026'
        sa.Column('valor_gasto_materiais', sa.Numeric(precision=14, scale=2), default=0.00), # Saídas
        sa.Column('faturamento_receita', sa.Numeric(precision=14, scale=2), default=0.00),
        sa.Column('outros_custos_operacionais', sa.Numeric(precision=14, scale=2), default=0.00),
        sa.Column('lucro_liquido', sa.Numeric(precision=14, scale=2), default=0.00), # Entradas líquidas
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id_registro')
    )
    op.create_index(op.f('ix_camisetas_registros_financeiros_id_registro'), 'camisetas_registros_financeiros', ['id_registro'], unique=False)
    op.create_index(op.f('ix_camisetas_registros_financeiros_mes_ano'), 'camisetas_registros_financeiros', ['mes_ano'], unique=False)


def downgrade() -> None:
    op.drop_table('camisetas_registros_financeiros')
    op.drop_table('camisetas_produtos_acabados')
    op.drop_table('camisetas_costura_faccoes')
    op.drop_table('camisetas_ordens_producao')
    op.drop_table('camisetas_pedidos')
    op.drop_table('camisetas_entradas_insumos')
    op.drop_table('camisetas_fichas_tecnicas')
    op.drop_table('camisetas_insumos')
    op.drop_table('camisetas_modelos')
