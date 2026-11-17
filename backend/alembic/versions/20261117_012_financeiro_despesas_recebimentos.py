"""despesas categorizadas e status de pagamento de pedidos (segmento camisetas)

Revision ID: 20261117_012_financeiro_despesas_recebimentos
Revises: 20261117_011_producao_pedido_op
Create Date: 2026-11-17 10:15:00.000000

Cria a tabela camisetas_despesas e adiciona status_pagamento e data_pagamento em camisetas_pedidos.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261117_012_financeiro_despesas_recebimentos"
down_revision: Union[str, None] = "20261117_011_producao_pedido_op"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "camisetas_despesas",
        sa.Column("id_despesa", sa.Integer(), nullable=False),
        sa.Column("mes_ano", sa.String(length=7), nullable=False),
        sa.Column("categoria", sa.String(length=40), nullable=False),
        sa.Column("descricao", sa.String(length=255), nullable=False),
        sa.Column("valor", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("data_vencimento", sa.Date(), nullable=True),
        sa.Column("data_pagamento", sa.Date(), nullable=True),
        sa.Column("status_pagamento", sa.String(length=20), server_default="Pago", nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id_despesa"),
    )
    op.create_index(op.f("ix_camisetas_despesas_id_despesa"), "camisetas_despesas", ["id_despesa"], unique=False)
    op.create_index(op.f("ix_camisetas_despesas_mes_ano"), "camisetas_despesas", ["mes_ano"], unique=False)

    with op.batch_alter_table("camisetas_pedidos") as lote:
        lote.add_column(sa.Column("status_pagamento", sa.String(length=20), server_default="Pendente", nullable=False))
        lote.add_column(sa.Column("data_pagamento", sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("camisetas_pedidos") as lote:
        lote.drop_column("data_pagamento")
        lote.drop_column("status_pagamento")

    op.drop_index(op.f("ix_camisetas_despesas_mes_ano"), table_name="camisetas_despesas")
    op.drop_index(op.f("ix_camisetas_despesas_id_despesa"), table_name="camisetas_despesas")
    op.drop_table("camisetas_despesas")
