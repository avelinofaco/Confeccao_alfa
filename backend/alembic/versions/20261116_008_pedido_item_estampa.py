"""estampa e posição nos itens do pedido (segmento camisetas)

Revision ID: 20261116_008_pedido_item_estampa
Revises: 20261116_007_estampas
Create Date: 2026-11-16 17:34:00.000000

Adiciona id_estampa e posicao_estampa em camisetas_pedido_itens.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261116_008_pedido_item_estampa"
down_revision: Union[str, None] = "20261116_007_estampas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("camisetas_pedido_itens") as lote:
        lote.add_column(sa.Column("id_estampa", sa.Integer(), nullable=True))
        lote.add_column(sa.Column("posicao_estampa", sa.String(length=40), nullable=True))
        lote.create_foreign_key(
            "fk_pedido_itens_estampa",
            "camisetas_estampas",
            ["id_estampa"],
            ["id_estampa"],
            ondelete="RESTRICT",
        )


def downgrade() -> None:
    with op.batch_alter_table("camisetas_pedido_itens") as lote:
        lote.drop_constraint("fk_pedido_itens_estampa", type_="foreignkey")
        lote.drop_column("posicao_estampa")
        lote.drop_column("id_estampa")
