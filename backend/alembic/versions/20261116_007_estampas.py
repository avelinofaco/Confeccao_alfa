"""banco de estampas (segmento camisetas)

Revision ID: 20261116_007_estampas
Revises: 20261110_006_estoque_sku
Create Date: 2026-11-16 14:05:00.000000

Cria a tabela camisetas_estampas para o catálogo visual de estampas com imagem no banco.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261116_007_estampas"
down_revision: Union[str, None] = "20261110_006_estoque_sku"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "camisetas_estampas",
        sa.Column("id_estampa", sa.Integer(), primary_key=True),
        sa.Column("codigo", sa.String(length=30), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("nome_busca", sa.String(length=120), nullable=False),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("imagem_bytes", sa.LargeBinary(), nullable=False),
        sa.Column("imagem_mime", sa.String(length=40), nullable=False),
        sa.Column("tamanho_bytes", sa.Integer(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_camisetas_estampas_nome_busca", "camisetas_estampas", ["nome_busca"])


def downgrade() -> None:
    op.drop_index("ix_camisetas_estampas_nome_busca", table_name="camisetas_estampas")
    op.drop_table("camisetas_estampas")
