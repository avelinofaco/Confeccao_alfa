"""precificação por modelo, estampa e item do pedido (segmento camisetas)

Revision ID: 20261116_010_precificacao
Revises: 20261116_009_portal_cliente
Create Date: 2026-11-16 18:19:00.000000

Adiciona preco_venda_lisa e acrescimo_estampa em camisetas_modelos e preco_unitario em camisetas_pedido_itens.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261116_010_precificacao"
down_revision: Union[str, None] = "20261116_009_portal_cliente"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "camisetas_modelos",
        sa.Column("preco_venda_lisa", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
    )
    op.add_column(
        "camisetas_modelos",
        sa.Column("acrescimo_estampa", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
    )
    op.add_column(
        "camisetas_pedido_itens",
        sa.Column("preco_unitario", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
    )


def downgrade() -> None:
    with op.batch_alter_table("camisetas_pedido_itens") as lote:
        lote.drop_column("preco_unitario")
    with op.batch_alter_table("camisetas_modelos") as lote:
        lote.drop_column("acrescimo_estampa")
        lote.drop_column("preco_venda_lisa")
