"""sequencias_documentos

Revision ID: 20261110_003_sequencias
Revises: 20261022_002_camisetas
Create Date: 2026-11-10 10:00:00.000000

Tabela de numeração sequencial de documentos (PED-AAAA-NNNN, OP-AAAA-NNNN).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261110_003_sequencias"
down_revision: Union[str, None] = "20261022_002_camisetas"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sequencias_documentos",
        sa.Column("prefixo", sa.String(length=10), nullable=False),
        sa.Column("ano", sa.Integer(), nullable=False),
        sa.Column("ultimo_numero", sa.Integer(), nullable=False, server_default="0"),
        sa.PrimaryKeyConstraint("prefixo", "ano"),
    )


def downgrade() -> None:
    op.drop_table("sequencias_documentos")
