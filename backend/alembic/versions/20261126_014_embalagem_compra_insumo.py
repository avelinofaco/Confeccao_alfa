"""Embalagem fechada do fornecedor no insumo de camisetas.

Revision ID: 20261126_014_embalagem_compra_insumo
Revises: 20261126_013_fluxo_multi_contexto
Create Date: 2026-11-26

Quantidade da embalagem que o fornecedor vende fechada — caixa de 1000 etiquetas, rolo de
100 metros de viés. A sugestão de compra usa isso para pedir múltiplos da embalagem em vez
de uma quantidade que ninguém vende.

Coluna nula: a tabela já tem dados em produção, e insumo sem embalagem cadastrada segue
com a compra fracionada, como antes. Guardada, pelo mesmo motivo da 013 — o
`Base.metadata.create_all()` do `main.py` pode já ter criado a coluna num banco cuja tabela
nasceu depois do modelo mudar.
"""
from alembic import op
import sqlalchemy as sa

revision = "20261126_014_embalagem_compra_insumo"
down_revision = "20261126_013_fluxo_multi_contexto"
branch_labels = None
depends_on = None

TABELA = "camisetas_insumos"
COLUNA = "embalagem_compra"


def _colunas() -> set:
    insp = sa.inspect(op.get_bind())
    if TABELA not in set(insp.get_table_names()):
        return set()
    return {coluna["name"] for coluna in insp.get_columns(TABELA)}


def upgrade() -> None:
    if COLUNA not in _colunas():
        op.add_column(TABELA, sa.Column(COLUNA, sa.Numeric(precision=12, scale=3), nullable=True))


def downgrade() -> None:
    if COLUNA in _colunas():
        op.drop_column(TABELA, COLUNA)
