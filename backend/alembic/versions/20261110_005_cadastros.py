"""cadastros de camisetas: clientes, cores e grades

Revision ID: 20261110_005_cadastros
Revises: 20261110_004_data_entrega
Create Date: 2026-11-10 14:00:00.000000

Cria clientes, cores e grades; liga pedidos, insumos e modelos. Migra os dados do piloto:
um cliente por nome distinto dos pedidos e uma grade por texto distinto de grade_disponivel.
"""
import unicodedata
from datetime import datetime, timezone
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261110_005_cadastros"
down_revision: Union[str, None] = "20261110_004_data_entrega"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GRADE_PADRAO_TEXTO = "P, M, G, GG"
GRADE_PADRAO_NOME = "Adulto (P, M, G, GG)"
TAMANHO_MAX = 10

modelos = sa.table(
    "camisetas_modelos",
    sa.column("id_modelo", sa.Integer), sa.column("grade_disponivel", sa.String), sa.column("id_grade", sa.Integer),
)
grades = sa.table("camisetas_grades", sa.column("id_grade", sa.Integer), sa.column("nome", sa.String), sa.column("ativo", sa.Boolean))
tamanhos = sa.table(
    "camisetas_grade_tamanhos",
    sa.column("id_grade", sa.Integer), sa.column("rotulo", sa.String), sa.column("ordem", sa.Integer),
)
pedidos = sa.table(
    "camisetas_pedidos",
    sa.column("id_pedido", sa.Integer), sa.column("nome_cliente", sa.String), sa.column("id_cliente", sa.Integer),
)
clientes = sa.table(
    "camisetas_clientes",
    sa.column("id_cliente", sa.Integer), sa.column("nome", sa.String), sa.column("nome_busca", sa.String),
    sa.column("ativo", sa.Boolean), sa.column("criado_em", sa.DateTime(timezone=True)),
    sa.column("atualizado_em", sa.DateTime(timezone=True)),
)


def normalizar_nome(texto):
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto or "") if not unicodedata.combining(c))
    return " ".join(sem_acento.split()).casefold()


def rotulos_do_texto(texto):
    rotulos = [r.strip()[:TAMANHO_MAX] for r in (texto or "").split(",") if r.strip()]
    return list(dict.fromkeys(rotulos)) or ["P", "M", "G", "GG"]


def _criar_tabelas():
    op.create_table(
        "camisetas_clientes",
        sa.Column("id_cliente", sa.Integer(), primary_key=True),
        sa.Column("tipo", sa.String(length=2), nullable=True),
        sa.Column("nome", sa.String(length=150), nullable=False),
        sa.Column("nome_busca", sa.String(length=150), nullable=False),
        sa.Column("documento", sa.String(length=14), nullable=True, unique=True),
        sa.Column("telefone_whatsapp", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=150), nullable=True),
        sa.Column("cidade", sa.String(length=100), nullable=True),
        sa.Column("uf", sa.String(length=2), nullable=True),
        sa.Column("endereco", sa.String(length=255), nullable=True),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_camisetas_clientes_nome_busca", "camisetas_clientes", ["nome_busca"])
    op.create_table(
        "camisetas_cores",
        sa.Column("id_cor", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(length=60), nullable=False, unique=True),
        sa.Column("hex", sa.String(length=7), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "camisetas_grades",
        sa.Column("id_grade", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(length=80), nullable=False, unique=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "camisetas_grade_tamanhos",
        sa.Column("id_tamanho", sa.Integer(), primary_key=True),
        sa.Column("id_grade", sa.Integer(), sa.ForeignKey("camisetas_grades.id_grade", ondelete="CASCADE"), nullable=False),
        sa.Column("rotulo", sa.String(length=10), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False),
        sa.UniqueConstraint("id_grade", "rotulo", name="uk_grade_rotulo"),
    )


def _ligar_tabelas():
    with op.batch_alter_table("camisetas_pedidos") as lote:
        lote.add_column(sa.Column("id_cliente", sa.Integer(), nullable=True))
        lote.create_foreign_key("fk_pedidos_cliente", "camisetas_clientes", ["id_cliente"], ["id_cliente"], ondelete="RESTRICT")
    with op.batch_alter_table("camisetas_insumos") as lote:
        lote.add_column(sa.Column("id_cor", sa.Integer(), nullable=True))
        lote.create_foreign_key("fk_insumos_cor", "camisetas_cores", ["id_cor"], ["id_cor"], ondelete="SET NULL")
    with op.batch_alter_table("camisetas_modelos") as lote:
        lote.add_column(sa.Column("id_grade", sa.Integer(), nullable=True))
        lote.create_foreign_key("fk_modelos_grade", "camisetas_grades", ["id_grade"], ["id_grade"], ondelete="SET NULL")


def _migrar_grades(conexao):
    ids_por_texto = {}
    for id_modelo, texto in conexao.execute(sa.select(modelos.c.id_modelo, modelos.c.grade_disponivel)).all():
        rotulos = rotulos_do_texto(texto)
        chave = ", ".join(rotulos)
        if chave not in ids_por_texto:
            nome = GRADE_PADRAO_NOME if chave == GRADE_PADRAO_TEXTO else f"Grade ({chave})"
            id_grade = conexao.execute(
                grades.insert().values(nome=nome, ativo=True).returning(grades.c.id_grade)
            ).scalar_one()
            conexao.execute(tamanhos.insert(), [
                {"id_grade": id_grade, "rotulo": rotulo, "ordem": ordem} for ordem, rotulo in enumerate(rotulos, start=1)
            ])
            ids_por_texto[chave] = id_grade
        conexao.execute(
            modelos.update().where(modelos.c.id_modelo == id_modelo)
            .values(id_grade=ids_por_texto[chave], grade_disponivel=chave)
        )


def _migrar_clientes(conexao):
    ids_por_nome = {}
    linhas = conexao.execute(sa.select(pedidos.c.id_pedido, pedidos.c.nome_cliente).order_by(pedidos.c.id_pedido)).all()
    for id_pedido, nome in linhas:
        chave = normalizar_nome(nome)
        if not chave:
            continue
        if chave not in ids_por_nome:
            agora = datetime.now(timezone.utc)
            ids_por_nome[chave] = conexao.execute(
                clientes.insert().values(
                    nome=" ".join(nome.split()), nome_busca=chave, ativo=True, criado_em=agora, atualizado_em=agora,
                ).returning(clientes.c.id_cliente)
            ).scalar_one()
        conexao.execute(pedidos.update().where(pedidos.c.id_pedido == id_pedido).values(id_cliente=ids_por_nome[chave]))


def upgrade() -> None:
    _criar_tabelas()
    _ligar_tabelas()
    conexao = op.get_bind()
    _migrar_grades(conexao)
    _migrar_clientes(conexao)


def downgrade() -> None:
    with op.batch_alter_table("camisetas_modelos") as lote:
        lote.drop_constraint("fk_modelos_grade", type_="foreignkey")
        lote.drop_column("id_grade")
    with op.batch_alter_table("camisetas_insumos") as lote:
        lote.drop_constraint("fk_insumos_cor", type_="foreignkey")
        lote.drop_column("id_cor")
    with op.batch_alter_table("camisetas_pedidos") as lote:
        lote.drop_constraint("fk_pedidos_cliente", type_="foreignkey")
        lote.drop_column("id_cliente")
    op.drop_table("camisetas_grade_tamanhos")
    op.drop_table("camisetas_grades")
    op.drop_table("camisetas_cores")
    op.drop_index("ix_camisetas_clientes_nome_busca", table_name="camisetas_clientes")
    op.drop_table("camisetas_clientes")
