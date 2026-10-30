"""versao_antiga_moda_intima

Revision ID: 20261022_001_antiga
Revises: 
Create Date: 2026-10-22 10:00:00.000000

Versão antiga/original do banco de dados da Confecção Alfa (Moda Íntima),
sem as alterações que haviam sido adicionadas para camisetas.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# Identificadores de revisão do Alembic
revision: str = '20261022_001_antiga'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabela de Usuários
    op.create_table(
        'usuarios',
        sa.Column('id_usuario', sa.Integer(), nullable=False),
        sa.Column('login', sa.String(length=100), nullable=False),
        sa.Column('senha_hash', sa.String(length=255), nullable=False),
        sa.Column('nome_usuario', sa.String(length=150), nullable=False),
        sa.Column('perfil', sa.String(length=50), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id_usuario')
    )
    op.create_index(op.f('ix_usuarios_id_usuario'), 'usuarios', ['id_usuario'], unique=False)
    op.create_index(op.f('ix_usuarios_login'), 'usuarios', ['login'], unique=True)

    # 2. Tabela de Insumos (Malhas e Aviamentos de Moda Íntima)
    op.create_table(
        'insumos',
        sa.Column('id_insumo', sa.Integer(), nullable=False),
        sa.Column('codigo', sa.String(length=20), nullable=False),
        sa.Column('categoria', sa.String(length=30), nullable=False),
        sa.Column('tipo', sa.String(length=100), nullable=False),
        sa.Column('quantidade_atual', sa.Numeric(precision=10, scale=3), nullable=True),
        sa.Column('unidade_medida', sa.String(length=10), nullable=False),
        sa.Column('estoque_minimo_seguranca', sa.Numeric(precision=10, scale=3), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id_insumo')
    )
    op.create_index(op.f('ix_insumos_codigo'), 'insumos', ['codigo'], unique=True)
    op.create_index(op.f('ix_insumos_id_insumo'), 'insumos', ['id_insumo'], unique=False)

    # 3. Tabela de Entradas de Estoque
    op.create_table(
        'entradas_estoque',
        sa.Column('id_entrada', sa.Integer(), nullable=False),
        sa.Column('id_insumo', sa.Integer(), nullable=False),
        sa.Column('quantidade_recebida', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('data_entrada', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['id_insumo'], ['insumos.id_insumo'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_entrada')
    )
    op.create_index(op.f('ix_entradas_estoque_id_entrada'), 'entradas_estoque', ['id_entrada'], unique=False)

    # 4. Tabela de Produtos (Modelos de Moda Íntima)
    op.create_table(
        'produtos',
        sa.Column('id_produto', sa.Integer(), nullable=False),
        sa.Column('nome_modelo', sa.String(length=150), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id_produto')
    )
    op.create_index(op.f('ix_produtos_id_produto'), 'produtos', ['id_produto'], unique=False)
    op.create_index(op.f('ix_produtos_nome_modelo'), 'produtos', ['nome_modelo'], unique=True)

    # 5. Tabela de Ficha Técnica (Consumo de Insumos da Lingerie)
    op.create_table(
        'ficha_tecnica_insumos',
        sa.Column('id_ficha_tecnica', sa.Integer(), nullable=False),
        sa.Column('id_produto', sa.Integer(), nullable=False),
        sa.Column('id_insumo', sa.Integer(), nullable=False),
        sa.Column('gasto_por_unidade', sa.Numeric(precision=10, scale=4), nullable=False),
        sa.ForeignKeyConstraint(['id_insumo'], ['insumos.id_insumo'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['id_produto'], ['produtos.id_produto'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_ficha_tecnica'),
        sa.UniqueConstraint('id_produto', 'id_insumo', name='uk_produto_insumo')
    )
    op.create_index(op.f('ix_ficha_tecnica_insumos_id_ficha_tecnica'), 'ficha_tecnica_insumos', ['id_ficha_tecnica'], unique=False)

    # 6. Tabela de Ordens de Produção (Corte & Rendimento Moda Íntima)
    op.create_table(
        'ordens_producao',
        sa.Column('id_op', sa.Integer(), nullable=False),
        sa.Column('codigo_op', sa.String(length=20), nullable=False),
        sa.Column('id_produto', sa.Integer(), nullable=False),
        sa.Column('peso_malha_enviado', sa.Numeric(precision=10, scale=3), nullable=False),
        sa.Column('quantidade_pecas_cortadas', sa.Integer(), nullable=True),
        sa.Column('rendimento_real', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('status_op', sa.String(length=50), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['id_produto'], ['produtos.id_produto'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_op')
    )
    op.create_index(op.f('ix_ordens_producao_codigo_op'), 'ordens_producao', ['codigo_op'], unique=True)
    op.create_index(op.f('ix_ordens_producao_id_op'), 'ordens_producao', ['id_op'], unique=False)

    # 7. Tabela de Movimentações de Costura (Facções Externas)
    op.create_table(
        'movimentacoes_costura',
        sa.Column('id_movimentacao', sa.Integer(), nullable=False),
        sa.Column('id_op', sa.Integer(), nullable=False),
        sa.Column('destino_costura', sa.String(length=100), nullable=False),
        sa.Column('quantidade_enviada', sa.Integer(), nullable=False),
        sa.Column('margem_seguranca_insumos', sa.Numeric(precision=10, scale=3), nullable=True),
        sa.Column('data_envio', sa.DateTime(timezone=True), nullable=True),
        sa.Column('quantidade_recebida', sa.Integer(), nullable=True),
        sa.Column('perda_pecas', sa.Integer(), nullable=True),
        sa.Column('data_retorno', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status_movimentacao', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['id_op'], ['ordens_producao.id_op'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_movimentacao')
    )
    op.create_index(op.f('ix_movimentacoes_costura_id_movimentacao'), 'movimentacoes_costura', ['id_movimentacao'], unique=False)

    # 8. Tabela de Estoque de Produtos Prontos
    op.create_table(
        'estoque_produtos_prontos',
        sa.Column('id_estoque_pronto', sa.Integer(), nullable=False),
        sa.Column('id_produto', sa.Integer(), nullable=False),
        sa.Column('quantidade_total', sa.Integer(), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['id_produto'], ['produtos.id_produto'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_estoque_pronto'),
        sa.UniqueConstraint('id_produto')
    )
    op.create_index(op.f('ix_estoque_produtos_prontos_id_estoque_pronto'), 'estoque_produtos_prontos', ['id_estoque_pronto'], unique=False)

    # 9. Tabela de Pedidos Comerciais
    op.create_table(
        'pedidos_comercial',
        sa.Column('id_pedido', sa.Integer(), nullable=False),
        sa.Column('codigo_pedido', sa.String(length=20), nullable=False),
        sa.Column('nome_cliente', sa.String(length=150), nullable=False),
        sa.Column('id_produto', sa.Integer(), nullable=False),
        sa.Column('quantidade_pecas', sa.Integer(), nullable=False),
        sa.Column('data_entrega_desejada', sa.Date(), nullable=False),
        sa.Column('valor_total', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('status_pedido', sa.String(length=50), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['id_produto'], ['produtos.id_produto'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id_pedido')
    )
    op.create_index(op.f('ix_pedidos_comercial_codigo_pedido'), 'pedidos_comercial', ['codigo_pedido'], unique=True)
    op.create_index(op.f('ix_pedidos_comercial_id_pedido'), 'pedidos_comercial', ['id_pedido'], unique=False)

    # 10. Tabela de Colaboradores
    op.create_table(
        'colaboradores',
        sa.Column('id_colaborador', sa.Integer(), nullable=False),
        sa.Column('nome_completo', sa.String(length=150), nullable=False),
        sa.Column('telefone_whatsapp', sa.String(length=20), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.Column('atualizado_em', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id_colaborador')
    )
    op.create_index(op.f('ix_colaboradores_id_colaborador'), 'colaboradores', ['id_colaborador'], unique=False)

    # 11. Tabela de Presenças da Equipe
    op.create_table(
        'presencas_equipe',
        sa.Column('id_presenca', sa.Integer(), nullable=False),
        sa.Column('id_colaborador', sa.Integer(), nullable=False),
        sa.Column('data_referencia', sa.Date(), nullable=False),
        sa.Column('presente', sa.Boolean(), nullable=True),
        sa.Column('criado_em', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['id_colaborador'], ['colaboradores.id_colaborador'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id_presenca'),
        sa.UniqueConstraint('id_colaborador', 'data_referencia', name='uk_colaborador_data')
    )
    op.create_index(op.f('ix_presencas_equipe_id_presenca'), 'presencas_equipe', ['id_presenca'], unique=False)


def downgrade() -> None:
    op.drop_table('presencas_equipe')
    op.drop_table('colaboradores')
    op.drop_table('pedidos_comercial')
    op.drop_table('estoque_produtos_prontos')
    op.drop_table('movimentacoes_costura')
    op.drop_table('ordens_producao')
    op.drop_table('ficha_tecnica_insumos')
    op.drop_table('produtos')
    op.drop_table('entradas_estoque')
    op.drop_table('insumos')
    op.drop_table('usuarios')
