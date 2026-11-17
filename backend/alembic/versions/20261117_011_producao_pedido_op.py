"""vínculo pedido -> ordem de produção (segmento camisetas)

Revision ID: 20261117_011_producao_pedido_op
Revises: 20261116_010_precificacao
Create Date: 2026-11-17 09:48:00.000000

Adiciona id_pedido em camisetas_ordens_producao (FK camisetas_pedidos ON DELETE SET NULL).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261117_011_producao_pedido_op"
down_revision: Union[str, None] = "20261116_010_precificacao"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("camisetas_ordens_producao") as lote:
        lote.add_column(sa.Column("id_pedido", sa.Integer(), nullable=True))
        lote.create_foreign_key(
            "fk_ordens_producao_pedido",
            "camisetas_pedidos",
            ["id_pedido"],
            ["id_pedido"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("camisetas_ordens_producao") as lote:
        lote.drop_constraint("fk_ordens_producao_pedido", type_="foreignkey")
        lote.drop_column("id_pedido")
