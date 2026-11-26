"""Alinha o Alembic ao fluxo multi-contexto: workflows dinâmicos e campos de contexto.

Revision ID: 20261126_013_fluxo_multi_contexto
Revises: 20261117_012_financeiro_despesas_recebimentos
Create Date: 2026-11-26

Esta é uma migração de **acerto de contas**, não de feature nova. Os modelos do commit
b1c8ea8 ("fluxo generico multi-contexto") entraram sem migração, e o `Base.metadata
.create_all()` do `main.py` vinha criando as três tabelas novas no banco a cada boot.
Resultado: `alembic check` acusava 3 tabelas, 22 colunas, 2 chaves estrangeiras e uma
mudança de nulidade fora do controle do Alembic.

Por isso **toda operação aqui é guardada**: o banco de produção já tem parte destes
objetos (as tabelas, criadas pelo `create_all`) e não tem outra parte (as colunas novas em
tabelas que já existiam — `create_all` cria tabelas que faltam, nunca adiciona coluna a
tabela existente). O estado real varia conforme quando cada tabela nasceu, então cada
passo checa antes de agir e a migração pode rodar duas vezes sem erro.

As alterações em tabela existente usam `batch_alter_table` porque o SQLite — usado pelos
testes — não suporta ALTER de constraint nem de coluna; em PostgreSQL o batch emite ALTER
normal.
"""
from alembic import op
import sqlalchemy as sa

revision = "20261126_013_fluxo_multi_contexto"
down_revision = "20261117_012_financeiro_despesas_recebimentos"
branch_labels = None
depends_on = None

FK_OP_ETAPA = "fk_ordens_producao_etapa_atual"
FK_PRODUTO_CONTEXTO = "fk_produtos_contexto"

COLUNAS_NOVAS = {
    "insumos": [
        sa.Column("cor", sa.String(length=50), nullable=True),
        sa.Column("custo_unitario", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("fornecedor", sa.String(length=100), nullable=True),
        sa.Column("lote_fornecedor", sa.String(length=50), nullable=True),
    ],
    "ordens_producao": [
        sa.Column("id_etapa_atual", sa.Integer(), nullable=True),
        sa.Column("dados_contexto", sa.JSON(), nullable=True),
        sa.Column("grade_distribuicao", sa.JSON(), nullable=True),
        sa.Column("dados_enfesto", sa.JSON(), nullable=True),
        sa.Column("horas_descanso_cumpridas", sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column("status_descanso", sa.String(length=30), nullable=True),
    ],
    "produtos": [
        sa.Column("referencia_codigo", sa.String(length=50), nullable=True),
        sa.Column("descricao_detalhada", sa.String(length=255), nullable=True),
        sa.Column("grade_tamanhos_disponiveis", sa.JSON(), nullable=True),
        sa.Column("cores_disponiveis", sa.JSON(), nullable=True),
        sa.Column("tempo_padrao_total_minutos", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("custo_estimado_total", sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column("id_contexto", sa.Integer(), nullable=True),
    ],
    "usuarios": [
        sa.Column("onboarding_concluido", sa.Boolean(), nullable=True),
        sa.Column("contexto_preferido", sa.String(length=50), nullable=True),
        sa.Column("preferencias_modulos", sa.JSON(), nullable=True),
    ],
}


def _inspetor():
    return sa.inspect(op.get_bind())


def _tabelas():
    return set(_inspetor().get_table_names())


def _colunas(tabela: str) -> set:
    insp = _inspetor()
    if tabela not in set(insp.get_table_names()):
        return set()
    return {coluna["name"] for coluna in insp.get_columns(tabela)}


def _tem_fk(tabela: str, nome: str, coluna: str) -> bool:
    """Procura pelo nome e, para quem já criou a FK sem nome, pela coluna que ela cobre."""
    insp = _inspetor()
    if tabela not in set(insp.get_table_names()):
        return False
    for fk in insp.get_foreign_keys(tabela):
        if fk.get("name") == nome or coluna in (fk.get("constrained_columns") or []):
            return True
    return False


def _coluna_aceita_nulo(tabela: str, coluna: str) -> bool:
    for existente in _inspetor().get_columns(tabela):
        if existente["name"] == coluna:
            return bool(existente.get("nullable"))
    return True


def _criar_tabelas_do_workflow(tabelas: set) -> None:
    if "contextos_produto" not in tabelas:
        op.create_table(
            "contextos_produto",
            sa.Column("id_contexto", sa.Integer(), nullable=False),
            sa.Column("codigo", sa.String(length=50), nullable=False),
            sa.Column("nome", sa.String(length=100), nullable=False),
            sa.Column("descricao", sa.String(length=255), nullable=True),
            sa.Column("unidade_principal", sa.String(length=30), nullable=True),
            sa.Column("habilita_grade_tamanhos", sa.Boolean(), nullable=True),
            sa.Column("habilita_lavanderia", sa.Boolean(), nullable=True),
            sa.Column("habilita_estamparia", sa.Boolean(), nullable=True),
            sa.Column("habilita_controle_elasticos", sa.Boolean(), nullable=True),
            sa.Column("habilita_rendimento_peso", sa.Boolean(), nullable=True),
            sa.Column("schema_campos_customizados", sa.JSON(), nullable=True),
            sa.Column("criado_em", sa.DateTime(timezone=True), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint("id_contexto"),
        )
        op.create_index(op.f("ix_contextos_produto_codigo"), "contextos_produto", ["codigo"], unique=True)
        op.create_index(op.f("ix_contextos_produto_id_contexto"), "contextos_produto", ["id_contexto"], unique=False)

    if "workflow_etapas" not in tabelas:
        op.create_table(
            "workflow_etapas",
            sa.Column("id_etapa", sa.Integer(), nullable=False),
            sa.Column("id_contexto", sa.Integer(), nullable=False),
            sa.Column("codigo_etapa", sa.String(length=50), nullable=False),
            sa.Column("nome_etapa", sa.String(length=100), nullable=False),
            sa.Column("ordem_etapa", sa.Integer(), nullable=False),
            sa.Column("tipo_operacao", sa.String(length=50), nullable=True),
            sa.Column("permite_perda", sa.Boolean(), nullable=True),
            sa.Column("descricao_instrucao", sa.String(length=255), nullable=True),
            sa.Column("campos_etapa", sa.JSON(), nullable=True),
            sa.Column("criado_em", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["id_contexto"], ["contextos_produto.id_contexto"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id_etapa"),
        )
        op.create_index(op.f("ix_workflow_etapas_id_etapa"), "workflow_etapas", ["id_etapa"], unique=False)

    if "apontamentos_etapa_workflow" not in tabelas:
        op.create_table(
            "apontamentos_etapa_workflow",
            sa.Column("id_apontamento", sa.Integer(), nullable=False),
            sa.Column("id_op", sa.Integer(), nullable=False),
            sa.Column("id_etapa", sa.Integer(), nullable=False),
            sa.Column("status_etapa", sa.String(length=50), nullable=True),
            sa.Column("quantidade_entrada", sa.Integer(), nullable=True),
            sa.Column("quantidade_concluida", sa.Integer(), nullable=True),
            sa.Column("quantidade_perda", sa.Integer(), nullable=True),
            sa.Column("responsavel_oficina", sa.String(length=150), nullable=True),
            sa.Column("observacoes", sa.Text(), nullable=True),
            sa.Column("dados_customizados", sa.JSON(), nullable=True),
            sa.Column("data_inicio", sa.DateTime(timezone=True), nullable=True),
            sa.Column("data_fim", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["id_etapa"], ["workflow_etapas.id_etapa"], ondelete="RESTRICT"),
            sa.ForeignKeyConstraint(["id_op"], ["ordens_producao.id_op"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id_apontamento"),
        )
        op.create_index(
            op.f("ix_apontamentos_etapa_workflow_id_apontamento"),
            "apontamentos_etapa_workflow", ["id_apontamento"], unique=False,
        )


def _adicionar_colunas_que_faltam(tabelas: set) -> None:
    """Todas as colunas entram como nulas: a tabela pode já ter linhas em produção."""
    for tabela, colunas in COLUNAS_NOVAS.items():
        if tabela not in tabelas:
            continue
        existentes = _colunas(tabela)
        for coluna in colunas:
            if coluna.name not in existentes:
                op.add_column(tabela, coluna.copy())


def upgrade() -> None:
    tabelas = _tabelas()
    _criar_tabelas_do_workflow(tabelas)
    _adicionar_colunas_que_faltam(_tabelas())

    tabelas = _tabelas()

    if "ordens_producao" in tabelas:
        precisa_fk = (
            "id_etapa_atual" in _colunas("ordens_producao")
            and "workflow_etapas" in tabelas
            and not _tem_fk("ordens_producao", FK_OP_ETAPA, "id_etapa_atual")
        )
        solta_nulo = not _coluna_aceita_nulo("ordens_producao", "peso_malha_enviado")
        if precisa_fk or solta_nulo:
            with op.batch_alter_table("ordens_producao") as lote:
                if solta_nulo:
                    # O modelo passou a aceitar OP sem peso de malha (contexto que não pesa enfesto).
                    lote.alter_column(
                        "peso_malha_enviado",
                        existing_type=sa.Numeric(precision=10, scale=3),
                        nullable=True,
                    )
                if precisa_fk:
                    lote.create_foreign_key(
                        FK_OP_ETAPA, "workflow_etapas", ["id_etapa_atual"], ["id_etapa"], ondelete="SET NULL",
                    )

    if (
        "produtos" in tabelas
        and "id_contexto" in _colunas("produtos")
        and "contextos_produto" in tabelas
        and not _tem_fk("produtos", FK_PRODUTO_CONTEXTO, "id_contexto")
    ):
        with op.batch_alter_table("produtos") as lote:
            lote.create_foreign_key(
                FK_PRODUTO_CONTEXTO, "contextos_produto", ["id_contexto"], ["id_contexto"], ondelete="SET NULL",
            )


def downgrade() -> None:
    """Desfaz o alinhamento. Atenção: as colunas removidas levam embora o que foi gravado nelas."""
    tabelas = _tabelas()

    if "produtos" in tabelas and _tem_fk("produtos", FK_PRODUTO_CONTEXTO, "id_contexto"):
        with op.batch_alter_table("produtos") as lote:
            lote.drop_constraint(FK_PRODUTO_CONTEXTO, type_="foreignkey")

    if "ordens_producao" in tabelas and _tem_fk("ordens_producao", FK_OP_ETAPA, "id_etapa_atual"):
        with op.batch_alter_table("ordens_producao") as lote:
            lote.drop_constraint(FK_OP_ETAPA, type_="foreignkey")

    for tabela, colunas in COLUNAS_NOVAS.items():
        if tabela not in tabelas:
            continue
        existentes = _colunas(tabela)
        for coluna in reversed(colunas):
            if coluna.name in existentes:
                op.drop_column(tabela, coluna.name)

    for tabela in ("apontamentos_etapa_workflow", "workflow_etapas", "contextos_produto"):
        if tabela in tabelas:
            op.drop_table(tabela)
