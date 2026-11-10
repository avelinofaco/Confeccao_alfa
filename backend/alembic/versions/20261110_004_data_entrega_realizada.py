"""data_entrega_realizada nos pedidos de camisetas

Revision ID: 20261110_004_data_entrega
Revises: 20261110_003_sequencias
Create Date: 2026-11-10 11:00:00.000000

Acrescenta a data real da entrega e a preenche nos pedidos já entregues, a partir
da nota "[ENTREGA REALIZADA em dd/mm/aaaa" das observações (ou de atualizado_em).
"""
import re
from datetime import date, datetime
from typing import Optional, Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261110_004_data_entrega"
down_revision: Union[str, None] = "20261110_003_sequencias"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PADRAO_ENTREGA = re.compile(r"\[ENTREGA REALIZADA em (\d{2})/(\d{2})/(\d{4})")

pedidos = sa.table(
    "camisetas_pedidos",
    sa.column("id_pedido", sa.Integer),
    sa.column("status_pedido", sa.String),
    sa.column("observacoes", sa.Text),
    sa.column("atualizado_em", sa.DateTime(timezone=True)),
    sa.column("data_entrega_realizada", sa.Date),
)


def extrair_data_entrega(observacoes: Optional[str], atualizado_em: Optional[datetime]) -> Optional[date]:
    """Usa a última nota de entrega das observações; senão, a data de atualização."""
    ocorrencias = PADRAO_ENTREGA.findall(observacoes or "")
    if ocorrencias:
        dia, mes, ano = ocorrencias[-1]
        return date(int(ano), int(mes), int(dia))
    return atualizado_em.date() if atualizado_em else None


def upgrade() -> None:
    with op.batch_alter_table("camisetas_pedidos") as lote:
        lote.add_column(sa.Column("data_entrega_realizada", sa.Date(), nullable=True))

    conexao = op.get_bind()
    entregues = conexao.execute(
        sa.select(pedidos.c.id_pedido, pedidos.c.observacoes, pedidos.c.atualizado_em)
        .where(pedidos.c.status_pedido == "Entregue")
    ).all()
    for id_pedido, observacoes, atualizado_em in entregues:
        data_entrega = extrair_data_entrega(observacoes, atualizado_em)
        if data_entrega:
            conexao.execute(
                pedidos.update()
                .where(pedidos.c.id_pedido == id_pedido)
                .values(data_entrega_realizada=data_entrega)
            )


def downgrade() -> None:
    with op.batch_alter_table("camisetas_pedidos") as lote:
        lote.drop_column("data_entrega_realizada")
