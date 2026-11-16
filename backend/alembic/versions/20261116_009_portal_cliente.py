"""portal do cliente: aprovação por link e pedido pelo celular (segmento camisetas)

Revision ID: 20261116_009_portal_cliente
Revises: 20261116_008_pedido_item_estampa
Create Date: 2026-11-16 17:51:00.000000

Adiciona token_aprovacao, status_aprovacao_cliente, observacao_cliente e aprovado_pelo_cliente_em
em camisetas_pedidos e token_portal em camisetas_clientes, preenchendo tokens nos registros existentes.
"""
import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261116_009_portal_cliente"
down_revision: Union[str, None] = "20261116_008_pedido_item_estampa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

pedidos = sa.table(
    "camisetas_pedidos",
    sa.column("id_pedido", sa.Integer),
    sa.column("token_aprovacao", sa.String),
)
clientes = sa.table(
    "camisetas_clientes",
    sa.column("id_cliente", sa.Integer),
    sa.column("token_portal", sa.String),
)


def upgrade() -> None:
    op.add_column("camisetas_pedidos", sa.Column("token_aprovacao", sa.String(length=64), nullable=True))
    op.add_column(
        "camisetas_pedidos",
        sa.Column("status_aprovacao_cliente", sa.String(length=30), nullable=False, server_default="Pendente"),
    )
    op.add_column("camisetas_pedidos", sa.Column("observacao_cliente", sa.Text(), nullable=True))
    op.add_column("camisetas_pedidos", sa.Column("aprovado_pelo_cliente_em", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_camisetas_pedidos_token_aprovacao", "camisetas_pedidos", ["token_aprovacao"], unique=True)

    op.add_column("camisetas_clientes", sa.Column("token_portal", sa.String(length=64), nullable=True))
    op.create_index("ix_camisetas_clientes_token_portal", "camisetas_clientes", ["token_portal"], unique=True)

    conexao = op.get_bind()
    for (id_pedido,) in conexao.execute(sa.select(pedidos.c.id_pedido).where(pedidos.c.token_aprovacao.is_(None))).all():
        conexao.execute(
            pedidos.update()
            .where(pedidos.c.id_pedido == id_pedido)
            .values(token_aprovacao=secrets.token_urlsafe(24))
        )
    for (id_cliente,) in conexao.execute(sa.select(clientes.c.id_cliente).where(clientes.c.token_portal.is_(None))).all():
        conexao.execute(
            clientes.update()
            .where(clientes.c.id_cliente == id_cliente)
            .values(token_portal=secrets.token_urlsafe(24))
        )


def downgrade() -> None:
    with op.batch_alter_table("camisetas_clientes") as lote:
        lote.drop_index("ix_camisetas_clientes_token_portal")
        lote.drop_column("token_portal")
    with op.batch_alter_table("camisetas_pedidos") as lote:
        lote.drop_index("ix_camisetas_pedidos_token_aprovacao")
        lote.drop_column("aprovado_pelo_cliente_em")
        lote.drop_column("observacao_cliente")
        lote.drop_column("status_aprovacao_cliente")
        lote.drop_column("token_aprovacao")
