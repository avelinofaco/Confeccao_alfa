"""estoque e produção por SKU (modelo + cor + tamanho)

Revision ID: 20261110_006_estoque_sku
Revises: 20261110_005_cadastros
Create Date: 2026-11-10 18:00:00.000000

Cria SKUs, movimentações, cores e cortes da OP, itens de remessa e itens de pedido.
Cada pedido existente vira um item com "cor não informada" e as quantidades de P/M/G/GG ligadas aos
tamanhos da grade do modelo (o rótulo que faltar é acrescentado ao fim da grade e o texto
grade_disponivel do modelo é atualizado). OPs e remessas antigas não ganham linhas (ficam "legadas").
Também cria os índices de chave primária que a migração 005 deixou de criar (os modelos os declaram).
O downgrade não retira os rótulos acrescentados às grades.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20261110_006_estoque_sku"
down_revision: Union[str, None] = "20261110_005_cadastros"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

GRADE_PADRAO_NOME = "Adulto (P, M, G, GG)"
ROTULOS_LEGADOS = ("P", "M", "G", "GG")
INDICES_DA_1A = (
    ("ix_camisetas_clientes_id_cliente", "camisetas_clientes", "id_cliente"),
    ("ix_camisetas_cores_id_cor", "camisetas_cores", "id_cor"),
    ("ix_camisetas_grades_id_grade", "camisetas_grades", "id_grade"),
    ("ix_camisetas_grade_tamanhos_id_tamanho", "camisetas_grade_tamanhos", "id_tamanho"),
)

modelos = sa.table(
    "camisetas_modelos",
    sa.column("id_modelo", sa.Integer), sa.column("id_grade", sa.Integer), sa.column("grade_disponivel", sa.String),
)
grades = sa.table("camisetas_grades", sa.column("id_grade", sa.Integer), sa.column("nome", sa.String), sa.column("ativo", sa.Boolean))
tamanhos = sa.table(
    "camisetas_grade_tamanhos",
    sa.column("id_tamanho", sa.Integer), sa.column("id_grade", sa.Integer),
    sa.column("rotulo", sa.String), sa.column("ordem", sa.Integer),
)
pedidos = sa.table(
    "camisetas_pedidos",
    sa.column("id_pedido", sa.Integer), sa.column("id_modelo", sa.Integer),
    sa.column("grade_p", sa.Integer), sa.column("grade_m", sa.Integer),
    sa.column("grade_g", sa.Integer), sa.column("grade_gg", sa.Integer),
)
itens = sa.table(
    "camisetas_pedido_itens",
    sa.column("id_item", sa.Integer), sa.column("id_pedido", sa.Integer),
    sa.column("id_modelo", sa.Integer), sa.column("id_cor", sa.Integer),
)
quantidades = sa.table(
    "camisetas_pedido_item_qtds",
    sa.column("id_item", sa.Integer), sa.column("id_tamanho", sa.Integer), sa.column("quantidade", sa.Integer),
)


def _fk(alvo, ondelete):
    return sa.ForeignKey(alvo, ondelete=ondelete)


def _criar_tabelas():
    op.create_table(
        "camisetas_variacoes",
        sa.Column("id_variacao", sa.Integer(), primary_key=True),
        sa.Column("id_modelo", sa.Integer(), _fk("camisetas_modelos.id_modelo", "RESTRICT"), nullable=False),
        sa.Column("id_cor", sa.Integer(), _fk("camisetas_cores.id_cor", "RESTRICT"), nullable=False),
        sa.Column("id_tamanho", sa.Integer(), _fk("camisetas_grade_tamanhos.id_tamanho", "RESTRICT"), nullable=False),
        sa.Column("saldo", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estoque_minimo", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("id_modelo", "id_cor", "id_tamanho", name="uk_variacao_sku"),
        sa.CheckConstraint("saldo >= 0", name="ck_variacao_saldo_nao_negativo"),
    )
    op.create_table(
        "camisetas_movimentos_estoque",
        sa.Column("id_movimento", sa.Integer(), primary_key=True),
        sa.Column("id_variacao", sa.Integer(), _fk("camisetas_variacoes.id_variacao", "RESTRICT"), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("quantidade", sa.Integer(), nullable=False),
        sa.Column("saldo_apos", sa.Integer(), nullable=False),
        sa.Column("motivo", sa.String(length=255), nullable=True),
        sa.Column("id_pedido", sa.Integer(), _fk("camisetas_pedidos.id_pedido", "SET NULL"), nullable=True),
        sa.Column("id_costura", sa.Integer(), _fk("camisetas_costura_faccoes.id_costura", "SET NULL"), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_camisetas_movimentos_estoque_id_variacao", "camisetas_movimentos_estoque", ["id_variacao"])
    op.create_index("ix_camisetas_movimentos_estoque_id_pedido", "camisetas_movimentos_estoque", ["id_pedido"])
    op.create_table(
        "camisetas_op_cores",
        sa.Column("id_op_cor", sa.Integer(), primary_key=True),
        sa.Column("id_op", sa.Integer(), _fk("camisetas_ordens_producao.id_op", "CASCADE"), nullable=False),
        sa.Column("id_cor", sa.Integer(), _fk("camisetas_cores.id_cor", "RESTRICT"), nullable=False),
        sa.Column("id_insumo_tecido", sa.Integer(), _fk("camisetas_insumos.id_insumo", "SET NULL"), nullable=True),
        sa.Column("peso_kg", sa.Numeric(10, 3), nullable=False),
        sa.UniqueConstraint("id_op", "id_cor", name="uk_op_cor"),
    )
    op.create_table(
        "camisetas_op_cortes",
        sa.Column("id_corte", sa.Integer(), primary_key=True),
        sa.Column("id_op", sa.Integer(), _fk("camisetas_ordens_producao.id_op", "CASCADE"), nullable=False),
        sa.Column("id_variacao", sa.Integer(), _fk("camisetas_variacoes.id_variacao", "RESTRICT"), nullable=False),
        sa.Column("quantidade", sa.Integer(), nullable=False),
        sa.UniqueConstraint("id_op", "id_variacao", name="uk_op_corte"),
    )
    op.create_table(
        "camisetas_remessa_itens",
        sa.Column("id_item", sa.Integer(), primary_key=True),
        sa.Column("id_costura", sa.Integer(), _fk("camisetas_costura_faccoes.id_costura", "CASCADE"), nullable=False),
        sa.Column("id_variacao", sa.Integer(), _fk("camisetas_variacoes.id_variacao", "RESTRICT"), nullable=False),
        sa.Column("qtd_enviada", sa.Integer(), nullable=False),
        sa.Column("qtd_retornada", sa.Integer(), nullable=True),
        sa.UniqueConstraint("id_costura", "id_variacao", name="uk_remessa_item"),
    )
    op.create_table(
        "camisetas_pedido_itens",
        sa.Column("id_item", sa.Integer(), primary_key=True),
        sa.Column("id_pedido", sa.Integer(), _fk("camisetas_pedidos.id_pedido", "CASCADE"), nullable=False),
        sa.Column("id_modelo", sa.Integer(), _fk("camisetas_modelos.id_modelo", "RESTRICT"), nullable=False),
        sa.Column("id_cor", sa.Integer(), _fk("camisetas_cores.id_cor", "RESTRICT"), nullable=True),
    )
    op.create_index("ix_camisetas_pedido_itens_id_pedido", "camisetas_pedido_itens", ["id_pedido"])
    op.create_table(
        "camisetas_pedido_item_qtds",
        sa.Column("id_item", sa.Integer(), _fk("camisetas_pedido_itens.id_item", "CASCADE"), primary_key=True),
        sa.Column("id_tamanho", sa.Integer(), _fk("camisetas_grade_tamanhos.id_tamanho", "RESTRICT"), primary_key=True),
        sa.Column("quantidade", sa.Integer(), nullable=False),
    )


def _grade_do_modelo(conexao, id_modelo):
    id_grade = conexao.execute(sa.select(modelos.c.id_grade).where(modelos.c.id_modelo == id_modelo)).scalar_one_or_none()
    if id_grade is not None:
        return id_grade
    id_grade = conexao.execute(sa.select(grades.c.id_grade).where(grades.c.nome == GRADE_PADRAO_NOME)).scalar_one_or_none()
    if id_grade is None:
        id_grade = conexao.execute(
            grades.insert().values(nome=GRADE_PADRAO_NOME, ativo=True).returning(grades.c.id_grade)
        ).scalar_one()
        conexao.execute(tamanhos.insert(), [
            {"id_grade": id_grade, "rotulo": rotulo, "ordem": ordem} for ordem, rotulo in enumerate(ROTULOS_LEGADOS, start=1)
        ])
    conexao.execute(modelos.update().where(modelos.c.id_modelo == id_modelo).values(id_grade=id_grade))
    return id_grade


def _id_do_tamanho(conexao, id_grade, rotulo):
    linhas = conexao.execute(
        sa.select(tamanhos.c.id_tamanho, tamanhos.c.rotulo, tamanhos.c.ordem).where(tamanhos.c.id_grade == id_grade)
    ).all()
    for id_tamanho, existente, _ordem in linhas:
        if existente.casefold() == rotulo.casefold():
            return id_tamanho
    proxima = max((ordem for _, _, ordem in linhas), default=0) + 1
    return conexao.execute(
        tamanhos.insert().values(id_grade=id_grade, rotulo=rotulo, ordem=proxima).returning(tamanhos.c.id_tamanho)
    ).scalar_one()


def _migrar_pedidos(conexao):
    linhas = conexao.execute(sa.select(
        pedidos.c.id_pedido, pedidos.c.id_modelo,
        pedidos.c.grade_p, pedidos.c.grade_m, pedidos.c.grade_g, pedidos.c.grade_gg,
    ).order_by(pedidos.c.id_pedido)).all()
    for id_pedido, id_modelo, *valores in linhas:
        id_grade = _grade_do_modelo(conexao, id_modelo)
        id_item = conexao.execute(
            itens.insert().values(id_pedido=id_pedido, id_modelo=id_modelo, id_cor=None).returning(itens.c.id_item)
        ).scalar_one()
        for rotulo, valor in zip(ROTULOS_LEGADOS, valores):
            if valor and int(valor) > 0:
                conexao.execute(quantidades.insert().values(
                    id_item=id_item, id_tamanho=_id_do_tamanho(conexao, id_grade, rotulo), quantidade=int(valor),
                ))


def _sincronizar_textos_de_grade(conexao):
    for (id_grade,) in conexao.execute(sa.select(grades.c.id_grade)).all():
        rotulos = conexao.execute(
            sa.select(tamanhos.c.rotulo).where(tamanhos.c.id_grade == id_grade).order_by(tamanhos.c.ordem)
        ).scalars().all()
        conexao.execute(modelos.update().where(modelos.c.id_grade == id_grade).values(grade_disponivel=", ".join(rotulos)))


def upgrade() -> None:
    _criar_tabelas()
    for nome, tabela, coluna in INDICES_DA_1A:
        op.create_index(nome, tabela, [coluna])
    conexao = op.get_bind()
    _migrar_pedidos(conexao)
    _sincronizar_textos_de_grade(conexao)


def downgrade() -> None:
    for nome, tabela, _coluna in INDICES_DA_1A:
        op.drop_index(nome, table_name=tabela)
    op.drop_table("camisetas_pedido_item_qtds")
    op.drop_index("ix_camisetas_pedido_itens_id_pedido", table_name="camisetas_pedido_itens")
    op.drop_table("camisetas_pedido_itens")
    op.drop_table("camisetas_remessa_itens")
    op.drop_table("camisetas_op_cortes")
    op.drop_table("camisetas_op_cores")
    op.drop_index("ix_camisetas_movimentos_estoque_id_pedido", table_name="camisetas_movimentos_estoque")
    op.drop_index("ix_camisetas_movimentos_estoque_id_variacao", table_name="camisetas_movimentos_estoque")
    op.drop_table("camisetas_movimentos_estoque")
    op.drop_table("camisetas_variacoes")
