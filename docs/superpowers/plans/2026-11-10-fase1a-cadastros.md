# Fase 1A — Cadastros (Clientes, Cores e Grades) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clientes escolhidos (não digitados) no pedido, cores padronizadas ligadas às malhas e grades de tamanho configuráveis por modelo, com migração dos dados do piloto.

**Architecture:** Três cadastros novos em `app/models/camisetas_cadastros.py` com regras em `app/services/` (erros de negócio levantados como `ErroNegocio` e convertidos em HTTP por um único handler). Os endpoints existentes de pedido, modelo e insumo ganham campos opcionais e respostas montadas por funções de serviço. No frontend, componentes reutilizáveis em `src/components/cadastros/` (formulário de cliente, seletor com busca, painéis de cores e grades).

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, Pydantic 2, Alembic, pytest; React 19 + Vite 8, axios, lucide-react, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-10-fase1a-cadastros-design.md`

## Global Constraints

- Trabalhar no branch `feat/camisetas-cadastros` (já criado a partir de `feat/camisetas-fundacao`). Nunca commitar na `main`.
- Mensagens de commit `<tipo>: <descrição>` terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (segundo `-m`).
- **Nunca rodar nada contra o banco de produção.** Testes usam SQLite em memória (`tests/conftest.py`); execução local usa `DATABASE_URL=sqlite:///./dev.db`. O `frontend-alfa/.env` aponta a API para `http://localhost:8001`.
- Comandos de backend dentro de `backend/` com `venv/bin/python -m ...`.
- Migração nova: revisão `20261110_005_cadastros` (revisa `20261110_004_data_entrega`), **somente aditiva**, com `downgrade`.
- Tabelas novas com prefixo `camisetas_`: `camisetas_clientes`, `camisetas_cores`, `camisetas_grades`, `camisetas_grade_tamanhos`.
- Moda Íntima congelada: não alterar seus arquivos.
- Nenhuma URL existente muda; `POST /pedidos/`, `/modelos/` e `/insumos/` só ganham campos opcionais. `nome_cliente` e `grade_disponivel` continuam preenchidos.
- Mensagens em português claro. Erros de regra: 400 dado inválido · 404 não encontrado · 409 conflito · 422 formato.
- Frontend: `npm run build` sem erros e `npx oxlint` sem **erros**; não introduzir imports sem uso nos arquivos tocados. Avisos e confirmações sempre por `useToast`/`useConfirm` (nunca `alert`/`confirm`).
- Cobertura ≥ 80% em `app/services/`.
- Menu: 1. Dashboard · 2. Pedidos do Cliente · 3. Clientes · 4. Ficha Técnica · 5. Estoque de Insumos · 6. Corte & Rendimento · 7. Costura & Facções · 8. Financeiro (títulos das páginas acompanham).

### Roteiro de verificação local

```bash
cd backend && rm -f dev.db && DATABASE_URL=sqlite:///./dev.db venv/bin/python -m uvicorn app.main:app --port 8001   # terminal 1
curl -s -X POST http://localhost:8001/camisetas/seed-inicial                                                        # terminal 2
cd frontend-alfa && npm run dev -- --port 5173                                                                       # terminal 3
# Navegador automatizado: node ~/.claude/skills/browser-automation/browser.mjs <url> --script <arquivo.mjs>
```

---

### Task 1: Modelos dos cadastros e migração dos dados do piloto

**Files:**
- Create: `backend/app/models/camisetas_cadastros.py`
- Modify: `backend/app/models/camisetas.py` (colunas `id_grade`, `id_cor`, `id_cliente` + relacionamentos; import no fim)
- Modify: `backend/alembic/env.py:15`
- Create: `backend/alembic/versions/20261110_005_cadastros.py`
- Modify: `backend/tests/test_migracoes.py`

**Interfaces:**
- Produces: classes `CamisetaCliente(id_cliente, tipo, nome, nome_busca, documento, telefone_whatsapp, email, cidade, uf, endereco, observacoes, ativo, criado_em, atualizado_em, pedidos)`, `CamisetaCor(id_cor, nome, hex, ativo)`, `CamisetaGrade(id_grade, nome, ativo, tamanhos)`, `CamisetaGradeTamanho(id_tamanho, id_grade, rotulo, ordem, grade)`; relacionamentos `CamisetaModelo.grade`, `CamisetaInsumo.cor_camiseta`, `CamisetaPedido.cliente`. `nome_busca` = nome sem acentos, espaços colapsados, minúsculo.

- [ ] **Step 1: Teste de migração que falha**

Acrescentar ao final de `backend/tests/test_migracoes.py`:

```python
def test_migracao_cadastros_cria_clientes_e_grades(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261110_004_data_entrega", url=url)
    engine = sa.create_engine(url)
    with engine.begin() as conexao:
        conexao.execute(sa.text(
            "INSERT INTO camisetas_modelos (id_modelo, nome_modelo, consumo_tecido_kg, grade_disponivel) VALUES "
            "(1, 'Básica', 0.18, 'P, M, G, GG'), (2, 'Longa', 0.2, 'P, M, G, GG, XG'), (3, 'Polo', 0.2, NULL)"
        ))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_pedidos (id_pedido, codigo_pedido, nome_cliente, id_modelo, quantidade_total, "
            "prazo_entrega, valor_total) VALUES "
            "(1, 'A', 'Loja Beta', 1, 10, '2026-10-01', 100), "
            "(2, 'B', ' loja  beta ', 1, 10, '2026-10-01', 100), "
            "(3, 'C', 'Ateliê Sol', 1, 10, '2026-10-01', 100)"
        ))
    rodar_alembic("upgrade", "head", url=url)
    with engine.connect() as conexao:
        clientes = conexao.execute(sa.text(
            "SELECT nome, nome_busca FROM camisetas_clientes ORDER BY id_cliente")).all()
        pedidos = dict(conexao.execute(sa.text("SELECT id_pedido, id_cliente FROM camisetas_pedidos")).all())
        grades = dict(conexao.execute(sa.text("SELECT nome, id_grade FROM camisetas_grades")).all())
        modelos = dict(conexao.execute(sa.text("SELECT id_modelo, id_grade FROM camisetas_modelos")).all())
        tamanhos_xg = [linha[0] for linha in conexao.execute(sa.text(
            "SELECT t.rotulo FROM camisetas_grade_tamanhos t JOIN camisetas_grades g ON g.id_grade = t.id_grade "
            "WHERE g.nome = 'Grade (P, M, G, GG, XG)' ORDER BY t.ordem")).all()]
    engine.dispose()
    assert [tuple(c) for c in clientes] == [("Loja Beta", "loja beta"), ("Ateliê Sol", "atelie sol")]
    assert pedidos[1] == pedidos[2] != pedidos[3]
    assert set(grades) == {"Adulto (P, M, G, GG)", "Grade (P, M, G, GG, XG)"}
    assert modelos[1] == modelos[3] == grades["Adulto (P, M, G, GG)"]
    assert modelos[2] == grades["Grade (P, M, G, GG, XG)"]
    assert tamanhos_xg == ["P", "M", "G", "GG", "XG"]
    rodar_alembic("downgrade", "20261110_004_data_entrega", url=url)
    assert "camisetas_clientes" not in tabelas(url)
```

Run: `cd backend && venv/bin/python -m pytest tests/test_migracoes.py -v`
Expected: FAIL no teste novo (`no such table: camisetas_clientes`).

- [ ] **Step 2: Modelos**

`backend/app/models/camisetas_cadastros.py`:

```python
# app/models/camisetas_cadastros.py
"""Cadastros do segmento Camisetas: clientes, cores e grades de tamanhos."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.estoque import get_utc_now


class CamisetaCliente(Base):
    __tablename__ = "camisetas_clientes"

    id_cliente = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(2), nullable=True)  # 'PF' | 'PJ'
    nome = Column(String(150), nullable=False)
    nome_busca = Column(String(150), nullable=False, index=True)  # sem acento, minúsculo, espaços colapsados
    documento = Column(String(14), nullable=True, unique=True)  # só dígitos
    telefone_whatsapp = Column(String(20), nullable=True)  # só dígitos
    email = Column(String(150), nullable=True)
    cidade = Column(String(100), nullable=True)
    uf = Column(String(2), nullable=True)
    endereco = Column(String(255), nullable=True)
    observacoes = Column(Text, nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)

    pedidos = relationship("CamisetaPedido", back_populates="cliente")


class CamisetaCor(Base):
    __tablename__ = "camisetas_cores"

    id_cor = Column(Integer, primary_key=True, index=True)
    nome = Column(String(60), nullable=False, unique=True)
    hex = Column(String(7), nullable=False)
    ativo = Column(Boolean, nullable=False, default=True)


class CamisetaGrade(Base):
    __tablename__ = "camisetas_grades"

    id_grade = Column(Integer, primary_key=True, index=True)
    nome = Column(String(80), nullable=False, unique=True)
    ativo = Column(Boolean, nullable=False, default=True)

    tamanhos = relationship(
        "CamisetaGradeTamanho",
        back_populates="grade",
        cascade="all, delete-orphan",
        order_by="CamisetaGradeTamanho.ordem",
    )


class CamisetaGradeTamanho(Base):
    __tablename__ = "camisetas_grade_tamanhos"
    __table_args__ = (UniqueConstraint("id_grade", "rotulo", name="uk_grade_rotulo"),)

    id_tamanho = Column(Integer, primary_key=True, index=True)
    id_grade = Column(Integer, ForeignKey("camisetas_grades.id_grade", ondelete="CASCADE"), nullable=False)
    rotulo = Column(String(10), nullable=False)
    ordem = Column(Integer, nullable=False)

    grade = relationship("CamisetaGrade", back_populates="tamanhos")
```

Em `backend/app/models/camisetas.py`:
- na classe `CamisetaModelo`, logo após `descricao = Column(...)`:

```python
    id_grade = Column(Integer, ForeignKey("camisetas_grades.id_grade", ondelete="SET NULL"), nullable=True)
```

  e logo após `ordens = relationship(...)`:

```python
    grade = relationship("CamisetaGrade")
```

- na classe `CamisetaInsumo`, logo após `preco_custo_medio = Column(...)`:

```python
    id_cor = Column(Integer, ForeignKey("camisetas_cores.id_cor", ondelete="SET NULL"), nullable=True)  # cor de camiseta que a malha produz
```

  e logo após `entradas = relationship(...)`:

```python
    cor_camiseta = relationship("CamisetaCor")
```

- na classe `CamisetaPedido`, logo após `nome_cliente = Column(...)`:

```python
    id_cliente = Column(Integer, ForeignKey("camisetas_clientes.id_cliente", ondelete="RESTRICT"), nullable=True)
```

  e logo após `modelo = relationship("CamisetaModelo", back_populates="pedidos")`:

```python
    cliente = relationship("CamisetaCliente", back_populates="pedidos")
```

- no fim do arquivo:

```python


# Registra as classes usadas nos relacionamentos por nome (cliente, cor, grade).
from app.models import camisetas_cadastros  # noqa: E402,F401
```

Em `backend/alembic/env.py`, linha 15, acrescentar `camisetas_cadastros` ao final do import:

```python
from app.models import usuarios, estoque, ficha_tecnica, producao, costura, comercial, equipe, camisetas, sequencias, camisetas_cadastros
```

- [ ] **Step 3: Migração**

`backend/alembic/versions/20261110_005_cadastros.py`:

```python
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
            id_grade = conexao.execute(grades.insert().values(nome=nome, ativo=True)).inserted_primary_key[0]
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
            ids_por_nome[chave] = conexao.execute(clientes.insert().values(
                nome=" ".join(nome.split()), nome_busca=chave, ativo=True, criado_em=agora, atualizado_em=agora,
            )).inserted_primary_key[0]
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
```

- [ ] **Step 4: Rodar tudo**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam (os testes de migração anteriores sobem até `head` e descem; o novo passa).

- [ ] **Step 5: Commit**

```bash
git add backend/app/models backend/alembic backend/tests/test_migracoes.py
git commit -m "feat: modelos e migração dos cadastros de clientes, cores e grades" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Erros de negócio e validação de CPF/CNPJ

**Files:**
- Create: `backend/app/core/erros.py`
- Modify: `backend/app/main.py` (handler)
- Create: `backend/app/services/documentos.py`
- Test: `backend/tests/test_documentos.py`

**Interfaces:**
- Produces: `ErroNegocio(status_code: int, mensagem: str)` (vira `{"detail": mensagem}` com o status); `somente_digitos(valor) -> str`; `cpf_valido(digitos: str) -> bool`; `cnpj_valido(digitos: str) -> bool`; `normalizar_documento(valor) -> tuple[str | None, str | None]` (dígitos e `'PF'|'PJ'`; levanta `ErroNegocio(400)`); `normalizar_nome(texto) -> str`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_documentos.py`:

```python
import pytest

from app.core.erros import ErroNegocio
from app.services.documentos import cnpj_valido, cpf_valido, normalizar_documento, normalizar_nome


def test_cpf_valido_com_mascara():
    assert normalizar_documento("529.982.247-25") == ("52998224725", "PF")


def test_cnpj_valido_com_mascara():
    assert normalizar_documento("11.222.333/0001-81") == ("11222333000181", "PJ")


@pytest.mark.parametrize("digitos", ["52998224724", "11111111111", "123"])
def test_cpf_invalido(digitos):
    assert cpf_valido(digitos) is False


@pytest.mark.parametrize("digitos", ["11222333000182", "00000000000000"])
def test_cnpj_invalido(digitos):
    assert cnpj_valido(digitos) is False


@pytest.mark.parametrize("valor, mensagem", [
    ("529.982.247-24", "CPF inválido"),
    ("11.222.333/0001-82", "CNPJ inválido"),
    ("12345", "11 dígitos"),
])
def test_documento_invalido_levanta_erro_400(valor, mensagem):
    with pytest.raises(ErroNegocio) as erro:
        normalizar_documento(valor)
    assert erro.value.status_code == 400
    assert mensagem in erro.value.mensagem


@pytest.mark.parametrize("vazio", [None, "", "  ", "--"])
def test_documento_vazio_vira_none(vazio):
    assert normalizar_documento(vazio) == (None, None)


def test_normalizar_nome_tira_acento_espaco_e_maiuscula():
    assert normalizar_nome("  Ateliê   SOL ") == "atelie sol"
```

Run: `cd backend && venv/bin/python -m pytest tests/test_documentos.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.erros'`.

- [ ] **Step 2: Implementar**

`backend/app/core/erros.py`:

```python
# app/core/erros.py
"""Erro de regra de negócio levantado pelos serviços e convertido em resposta HTTP."""


class ErroNegocio(Exception):
    def __init__(self, status_code: int, mensagem: str):
        super().__init__(mensagem)
        self.status_code = status_code
        self.mensagem = mensagem
```

`backend/app/services/documentos.py`:

```python
# app/services/documentos.py
"""Validação de CPF/CNPJ (dígitos verificadores) e normalização de textos para busca."""
import re
import unicodedata
from typing import Optional

from app.core.erros import ErroNegocio

PESOS_CNPJ = (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)


def somente_digitos(valor: Optional[str]) -> str:
    return re.sub(r"\D", "", valor or "")


def _digito_verificador(digitos: str, pesos) -> int:
    resto = sum(int(d) * p for d, p in zip(digitos, pesos)) % 11
    return 0 if resto < 2 else 11 - resto


def cpf_valido(digitos: str) -> bool:
    if len(digitos) != 11 or len(set(digitos)) == 1:
        return False
    d1 = _digito_verificador(digitos[:9], range(10, 1, -1))
    d2 = _digito_verificador(digitos[:9] + str(d1), range(11, 1, -1))
    return digitos[-2:] == f"{d1}{d2}"


def cnpj_valido(digitos: str) -> bool:
    if len(digitos) != 14 or len(set(digitos)) == 1:
        return False
    d1 = _digito_verificador(digitos[:12], PESOS_CNPJ)
    d2 = _digito_verificador(digitos[:12] + str(d1), (6,) + PESOS_CNPJ)
    return digitos[-2:] == f"{d1}{d2}"


def normalizar_documento(valor: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Devolve (só dígitos, 'PF'|'PJ'), ou (None, None) se vazio. Documento inválido → ErroNegocio(400)."""
    digitos = somente_digitos(valor)
    if not digitos:
        return None, None
    if len(digitos) == 11:
        if not cpf_valido(digitos):
            raise ErroNegocio(400, "CPF inválido. Confira os números digitados.")
        return digitos, "PF"
    if len(digitos) == 14:
        if not cnpj_valido(digitos):
            raise ErroNegocio(400, "CNPJ inválido. Confira os números digitados.")
        return digitos, "PJ"
    raise ErroNegocio(400, "O documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).")


def normalizar_nome(texto: Optional[str]) -> str:
    """Nome para busca e comparação: sem acentos, minúsculo e com espaços simples."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto or "") if not unicodedata.combining(c))
    return " ".join(sem_acento.split()).casefold()
```

Em `backend/app/main.py`, trocar `from fastapi import FastAPI` por:

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
```

acrescentar `from app.core.erros import ErroNegocio` aos imports e, logo após `app = FastAPI(...)`:

```python


@app.exception_handler(ErroNegocio)
async def tratar_erro_negocio(_request: Request, erro: ErroNegocio):
    return JSONResponse(status_code=erro.status_code, content={"detail": erro.mensagem})
```

- [ ] **Step 3: Rodar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam.

- [ ] **Step 4: Commit**

```bash
git add backend/app/core/erros.py backend/app/main.py backend/app/services/documentos.py backend/tests/test_documentos.py
git commit -m "feat: validação de CPF/CNPJ e erros de negócio padronizados" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Cadastro de clientes e ligação com o pedido

**Files:**
- Create: `backend/app/schemas/camisetas_cadastros.py`
- Create: `backend/app/services/camisetas/clientes.py`
- Create: `backend/app/routers/camisetas/clientes.py`
- Modify: `backend/app/routers/camisetas/__init__.py`
- Modify: `backend/app/schemas/camisetas.py` (`CamisetaPedidoCreate`, `CamisetaPedidoResponse`)
- Modify: `backend/app/services/camisetas/pedidos.py` (`montar_resposta_pedido`)
- Modify: `backend/app/routers/camisetas/pedidos.py` (`cadastrar_pedido`)
- Modify: `backend/tests/fabricas.py`, `backend/tests/test_rotas_camisetas.py`
- Test: `backend/tests/test_clientes.py`

**Interfaces:**
- Consumes: `ErroNegocio`, `normalizar_documento`, `normalizar_nome`, `somente_digitos` (Task 2); `CamisetaCliente` (Task 1).
- Produces: schemas `ClienteEntrada`, `ClienteResponse`; serviço `listar_clientes(db, busca=None, incluir_inativos=False, limite=50) -> list[ClienteResponse]`, `obter_cliente(db, id_cliente) -> CamisetaCliente`, `resposta_do_cliente(db, cliente) -> ClienteResponse`, `criar_cliente(db, dados)`, `atualizar_cliente(db, id_cliente, dados)`, `excluir_cliente(db, id_cliente)`, `resolver_cliente(db, id_cliente, nome_cliente) -> CamisetaCliente`; fábricas `criar_cliente(db, nome="Loja Beta", documento=None, telefone=None, ativo=True)` e `criar_pedido(..., cliente=None)`.

- [ ] **Step 1: Fábricas**

Em `backend/tests/fabricas.py`:
- acrescentar aos imports:

```python
from app.models.camisetas_cadastros import CamisetaCliente, CamisetaCor
from app.services.documentos import normalizar_nome
```

- na função `criar_pedido`, acrescentar o parâmetro `cliente=None` ao final da assinatura e trocar `nome_cliente="Cliente Teste",` por:

```python
        nome_cliente=cliente.nome if cliente else "Cliente Teste",
        id_cliente=cliente.id_cliente if cliente else None,
```

- acrescentar ao final:

```python
def criar_cliente(db, nome="Loja Beta", documento=None, telefone=None, ativo=True):
    return _salvar(db, CamisetaCliente(
        nome=nome,
        nome_busca=normalizar_nome(nome),
        documento=documento,
        telefone_whatsapp=telefone,
        ativo=ativo,
    ))


def criar_cor(db, nome="Preto", hex="#1F1F1F", ativo=True):
    return _salvar(db, CamisetaCor(nome=nome, hex=hex, ativo=ativo))
```

- [ ] **Step 2: Testes que falham**

`backend/tests/test_clientes.py`:

```python
from datetime import date, timedelta
from decimal import Decimal

from tests.fabricas import criar_cliente, criar_modelo, criar_pedido

CNPJ_VALIDO = "11.222.333/0001-81"


def test_cria_cliente_com_documento_normalizado(client):
    resposta = client.post("/camisetas/clientes/", json={
        "nome": "  Ateliê   Sol ", "documento": "529.982.247-25", "telefone_whatsapp": "(85) 9 9999-0000", "uf": "ce",
    })
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert (corpo["nome"], corpo["documento"], corpo["tipo"]) == ("Ateliê Sol", "52998224725", "PF")
    assert corpo["telefone_whatsapp"] == "85999990000"
    assert corpo["uf"] == "CE"


def test_documento_invalido_retorna_400(client):
    resposta = client.post("/camisetas/clientes/", json={"nome": "Loja", "documento": "11.222.333/0001-82"})
    assert resposta.status_code == 400
    assert "CNPJ inválido" in resposta.json()["detail"]


def test_documento_duplicado_retorna_409_com_nome(client, db):
    criar_cliente(db, nome="Loja Beta", documento="11222333000181")
    resposta = client.post("/camisetas/clientes/", json={"nome": "Outra", "documento": CNPJ_VALIDO})
    assert resposta.status_code == 409
    assert "Loja Beta" in resposta.json()["detail"]


def test_busca_sem_acento_por_documento_e_telefone(client, db):
    criar_cliente(db, nome="Ateliê Sol", telefone="85999990000")
    criar_cliente(db, nome="Loja Beta", documento="11222333000181")
    assert [c["nome"] for c in client.get("/camisetas/clientes/?busca=atelie").json()] == ["Ateliê Sol"]
    assert [c["nome"] for c in client.get("/camisetas/clientes/?busca=99990").json()] == ["Ateliê Sol"]
    assert [c["nome"] for c in client.get("/camisetas/clientes/?busca=11.222").json()] == ["Loja Beta"]


def test_inativos_ficam_fora_da_lista_por_padrao(client, db):
    criar_cliente(db, nome="Ativo")
    criar_cliente(db, nome="Inativo", ativo=False)
    assert [c["nome"] for c in client.get("/camisetas/clientes/").json()] == ["Ativo"]
    assert len(client.get("/camisetas/clientes/?incluir_inativos=true").json()) == 2


def test_resumo_de_pedidos_do_cliente(client, db):
    cliente = criar_cliente(db)
    modelo = criar_modelo(db)
    criar_pedido(db, modelo, codigo="A", valor="100.00", cliente=cliente)
    criar_pedido(db, modelo, codigo="B", valor="250.50", cliente=cliente)
    corpo = client.get(f"/camisetas/clientes/{cliente.id_cliente}").json()
    assert corpo["qtd_pedidos"] == 2
    assert Decimal(corpo["valor_total_pedidos"]) == Decimal("350.50")
    assert corpo["ultimo_pedido_em"] is not None


def test_excluir_cliente_com_pedidos_retorna_409(client, db):
    cliente = criar_cliente(db)
    criar_pedido(db, criar_modelo(db), cliente=cliente)
    resposta = client.delete(f"/camisetas/clientes/{cliente.id_cliente}")
    assert resposta.status_code == 409
    assert "inative" in resposta.json()["detail"]


def test_excluir_cliente_sem_pedidos(client, db):
    cliente = criar_cliente(db)
    assert client.delete(f"/camisetas/clientes/{cliente.id_cliente}").status_code == 204
    assert client.get(f"/camisetas/clientes/{cliente.id_cliente}").status_code == 404


def test_inativar_cliente(client, db):
    cliente = criar_cliente(db, nome="Loja Beta")
    resposta = client.put(f"/camisetas/clientes/{cliente.id_cliente}", json={"nome": "Loja Beta", "ativo": False})
    assert resposta.status_code == 200
    assert resposta.json()["ativo"] is False


def _pedido(**extra):
    return {
        "id_modelo": extra.pop("id_modelo"), "grade_p": 5, "grade_m": 5, "grade_g": 0, "grade_gg": 0,
        "prazo_entrega": (date.today() + timedelta(days=5)).isoformat(), "valor_total": "300.00", **extra,
    }


def test_pedido_com_id_cliente_usa_nome_do_cadastro(client, db):
    cliente = criar_cliente(db, nome="Loja Beta")
    modelo = criar_modelo(db)
    corpo = client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo, id_cliente=cliente.id_cliente)).json()
    assert (corpo["id_cliente"], corpo["nome_cliente"]) == (cliente.id_cliente, "Loja Beta")


def test_pedido_com_cliente_inativo_retorna_400(client, db):
    cliente = criar_cliente(db, ativo=False)
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo, id_cliente=cliente.id_cliente))
    assert resposta.status_code == 400


def test_pedido_so_com_nome_reaproveita_cliente_existente(client, db):
    cliente = criar_cliente(db, nome="Loja Beta")
    modelo = criar_modelo(db)
    corpo = client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo, nome_cliente=" LOJA  beta")).json()
    assert corpo["id_cliente"] == cliente.id_cliente


def test_pedido_so_com_nome_novo_cria_cliente(client, db):
    modelo = criar_modelo(db)
    corpo = client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo, nome_cliente="Cliente Novo")).json()
    assert corpo["id_cliente"] is not None
    assert client.get("/camisetas/clientes/?busca=cliente novo").json()[0]["nome"] == "Cliente Novo"


def test_pedido_sem_cliente_retorna_400(client, db):
    modelo = criar_modelo(db)
    assert client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo)).status_code == 400
```

Em `backend/tests/test_rotas_camisetas.py`, acrescentar ao conjunto `ROTAS_ESPERADAS`:

```python
    ("GET", "/camisetas/clientes/"),
    ("POST", "/camisetas/clientes/"),
    ("GET", "/camisetas/clientes/{id_cliente}"),
    ("PUT", "/camisetas/clientes/{id_cliente}"),
    ("DELETE", "/camisetas/clientes/{id_cliente}"),
```

Run: `cd backend && venv/bin/python -m pytest tests/test_clientes.py tests/test_rotas_camisetas.py -v`
Expected: FAIL (rotas inexistentes: 404/405 e diferença de rotas).

- [ ] **Step 3: Schemas**

`backend/app/schemas/camisetas_cadastros.py`:

```python
# app/schemas/camisetas_cadastros.py
"""Schemas dos cadastros do segmento Camisetas: clientes, cores e grades."""
from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ClienteEntrada(BaseModel):
    """Usado para criar e para atualizar (PUT substitui todos os campos)."""
    tipo: Optional[Literal["PF", "PJ"]] = None
    nome: str = Field(..., min_length=2, max_length=150)
    documento: Optional[str] = Field(None, max_length=20)
    telefone_whatsapp: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=150)
    cidade: Optional[str] = Field(None, max_length=100)
    uf: Optional[str] = Field(None, max_length=2)
    endereco: Optional[str] = Field(None, max_length=255)
    observacoes: Optional[str] = None
    ativo: bool = True


class ClienteResponse(BaseModel):
    id_cliente: int
    tipo: Optional[str] = None
    nome: str
    documento: Optional[str] = None
    telefone_whatsapp: Optional[str] = None
    email: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    endereco: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: bool
    qtd_pedidos: int = 0
    ultimo_pedido_em: Optional[datetime] = None
    valor_total_pedidos: Decimal = Decimal("0.00")
    criado_em: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
```

Em `backend/app/schemas/camisetas.py`, na classe `CamisetaPedidoCreate`, trocar `nome_cliente: str` por:

```python
    nome_cliente: Optional[str] = None  # usado só se id_cliente não vier (frontend antigo)
    id_cliente: Optional[int] = None
```

e, em `CamisetaPedidoResponse`, logo após `nome_cliente: str`, acrescentar:

```python
    id_cliente: Optional[int] = None
```

- [ ] **Step 4: Serviço de clientes**

`backend/app/services/camisetas/clientes.py`:

```python
# app/services/camisetas/clientes.py
"""Regras do cadastro de clientes e da ligação pedido → cliente."""
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaPedido
from app.models.camisetas_cadastros import CamisetaCliente
from app.schemas.camisetas_cadastros import ClienteEntrada, ClienteResponse
from app.services.documentos import normalizar_documento, normalizar_nome, somente_digitos

LIMITE_PADRAO = 50
MINIMO_DIGITOS_BUSCA = 3
DUAS_CASAS = Decimal("0.01")


def _texto(valor: Optional[str]) -> Optional[str]:
    limpo = " ".join((valor or "").split())
    return limpo or None


def _resumos(db: Session, ids: list[int]) -> dict:
    if not ids:
        return {}
    linhas = (
        db.query(
            CamisetaPedido.id_cliente,
            func.count(CamisetaPedido.id_pedido),
            func.max(CamisetaPedido.criado_em),
            func.coalesce(func.sum(CamisetaPedido.valor_total), 0),
        )
        .filter(CamisetaPedido.id_cliente.in_(ids))
        .group_by(CamisetaPedido.id_cliente)
        .all()
    )
    return {id_cliente: (qtd, ultimo, total) for id_cliente, qtd, ultimo, total in linhas}


def montar_resposta_cliente(cliente: CamisetaCliente, resumo=None) -> ClienteResponse:
    qtd, ultimo, total = resumo or (0, None, 0)
    return ClienteResponse(
        id_cliente=cliente.id_cliente,
        tipo=cliente.tipo,
        nome=cliente.nome,
        documento=cliente.documento,
        telefone_whatsapp=cliente.telefone_whatsapp,
        email=cliente.email,
        cidade=cliente.cidade,
        uf=cliente.uf,
        endereco=cliente.endereco,
        observacoes=cliente.observacoes,
        ativo=cliente.ativo,
        qtd_pedidos=int(qtd or 0),
        ultimo_pedido_em=ultimo,
        valor_total_pedidos=Decimal(str(total or 0)).quantize(DUAS_CASAS),
        criado_em=cliente.criado_em,
    )


def resposta_do_cliente(db: Session, cliente: CamisetaCliente) -> ClienteResponse:
    return montar_resposta_cliente(cliente, _resumos(db, [cliente.id_cliente]).get(cliente.id_cliente))


def listar_clientes(db: Session, busca: Optional[str] = None, incluir_inativos: bool = False,
                    limite: int = LIMITE_PADRAO) -> list[ClienteResponse]:
    consulta = db.query(CamisetaCliente)
    if not incluir_inativos:
        consulta = consulta.filter(CamisetaCliente.ativo.is_(True))
    termo = normalizar_nome(busca)
    if termo:
        condicoes = [CamisetaCliente.nome_busca.contains(termo)]
        digitos = somente_digitos(busca)
        if len(digitos) >= MINIMO_DIGITOS_BUSCA:
            condicoes += [CamisetaCliente.documento.contains(digitos), CamisetaCliente.telefone_whatsapp.contains(digitos)]
        consulta = consulta.filter(or_(*condicoes))
    clientes = consulta.order_by(CamisetaCliente.nome_busca).limit(limite).all()
    resumos = _resumos(db, [c.id_cliente for c in clientes])
    return [montar_resposta_cliente(c, resumos.get(c.id_cliente)) for c in clientes]


def obter_cliente(db: Session, id_cliente: int) -> CamisetaCliente:
    cliente = db.get(CamisetaCliente, id_cliente)
    if cliente is None:
        raise ErroNegocio(404, "Cliente não encontrado.")
    return cliente


def _aplicar_dados(db: Session, cliente: CamisetaCliente, dados: ClienteEntrada) -> None:
    nome = _texto(dados.nome) or ""
    if len(nome) < 2:
        raise ErroNegocio(400, "Informe o nome do cliente (pelo menos 2 letras).")
    documento, tipo_documento = normalizar_documento(dados.documento)
    if documento:
        dono = (
            db.query(CamisetaCliente)
            .filter(CamisetaCliente.documento == documento, CamisetaCliente.id_cliente != cliente.id_cliente)
            .first()
        )
        if dono:
            raise ErroNegocio(409, f"Este documento já está cadastrado para {dono.nome}.")
    cliente.nome = nome
    cliente.nome_busca = normalizar_nome(nome)
    cliente.documento = documento
    cliente.tipo = tipo_documento or dados.tipo
    cliente.telefone_whatsapp = somente_digitos(dados.telefone_whatsapp) or None
    cliente.email = _texto(dados.email)
    cliente.cidade = _texto(dados.cidade)
    cliente.uf = (_texto(dados.uf) or "").upper() or None
    cliente.endereco = _texto(dados.endereco)
    cliente.observacoes = (dados.observacoes or "").strip() or None
    cliente.ativo = dados.ativo


def criar_cliente(db: Session, dados: ClienteEntrada) -> CamisetaCliente:
    cliente = CamisetaCliente()
    _aplicar_dados(db, cliente, dados)
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def atualizar_cliente(db: Session, id_cliente: int, dados: ClienteEntrada) -> CamisetaCliente:
    cliente = obter_cliente(db, id_cliente)
    _aplicar_dados(db, cliente, dados)
    db.commit()
    db.refresh(cliente)
    return cliente


def excluir_cliente(db: Session, id_cliente: int) -> None:
    cliente = obter_cliente(db, id_cliente)
    if db.query(CamisetaPedido.id_pedido).filter_by(id_cliente=id_cliente).first() is not None:
        raise ErroNegocio(409, "Este cliente tem pedidos; inative-o em vez de excluir.")
    db.delete(cliente)
    db.commit()


def resolver_cliente(db: Session, id_cliente: Optional[int], nome_cliente: Optional[str]) -> CamisetaCliente:
    """Cliente do pedido: pelo id (deve estar ativo) ou pelo nome (encontra ou cria). Não faz commit."""
    if id_cliente is not None:
        cliente = obter_cliente(db, id_cliente)
        if not cliente.ativo:
            raise ErroNegocio(400, "Cliente inativo. Reative o cadastro para criar pedidos.")
        return cliente
    chave = normalizar_nome(nome_cliente)
    if not chave:
        raise ErroNegocio(400, "Informe o cliente do pedido.")
    existente = db.query(CamisetaCliente).filter_by(nome_busca=chave).first()
    if existente:
        return existente
    cliente = CamisetaCliente(nome=_texto(nome_cliente), nome_busca=chave, ativo=True)
    db.add(cliente)
    db.flush()
    return cliente
```

- [ ] **Step 5: Router de clientes e ligação com o pedido**

`backend/app/routers/camisetas/clientes.py`:

```python
# app/routers/camisetas/clientes.py
"""Cadastro de clientes (segmento Camisetas)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas_cadastros import ClienteEntrada, ClienteResponse
from app.services.camisetas.clientes import (
    LIMITE_PADRAO,
    atualizar_cliente,
    criar_cliente,
    excluir_cliente,
    listar_clientes,
    obter_cliente,
    resposta_do_cliente,
)

router = APIRouter()


@router.get("/clientes/", response_model=List[ClienteResponse])
def listar(
    busca: Optional[str] = Query(None, max_length=100),
    incluir_inativos: bool = False,
    limite: int = Query(LIMITE_PADRAO, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return listar_clientes(db, busca, incluir_inativos, limite)


@router.post("/clientes/", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
def criar(dados: ClienteEntrada, db: Session = Depends(get_db)):
    return resposta_do_cliente(db, criar_cliente(db, dados))


@router.get("/clientes/{id_cliente}", response_model=ClienteResponse)
def detalhar(id_cliente: int, db: Session = Depends(get_db)):
    return resposta_do_cliente(db, obter_cliente(db, id_cliente))


@router.put("/clientes/{id_cliente}", response_model=ClienteResponse)
def atualizar(id_cliente: int, dados: ClienteEntrada, db: Session = Depends(get_db)):
    return resposta_do_cliente(db, atualizar_cliente(db, id_cliente, dados))


@router.delete("/clientes/{id_cliente}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(id_cliente: int, db: Session = Depends(get_db)):
    excluir_cliente(db, id_cliente)
```

Em `backend/app/routers/camisetas/__init__.py`, acrescentar `clientes` ao import e à tupla:

```python
from app.routers.camisetas import (
    clientes,
    costura,
    dashboard,
    financeiro,
    insumos,
    modelos,
    ordens,
    pedidos,
    seed,
)

router = APIRouter(prefix="/camisetas", tags=["Segmento Camisetas"])

for _modulo in (seed, dashboard, pedidos, clientes, insumos, modelos, ordens, financeiro, costura):
    router.include_router(_modulo.router)
```

Em `backend/app/services/camisetas/pedidos.py`, em `montar_resposta_pedido`, logo após `nome_cliente=pedido.nome_cliente,` acrescentar:

```python
        id_cliente=pedido.id_cliente,
```

Em `backend/app/routers/camisetas/pedidos.py`:
- acrescentar o import `from app.services.camisetas.clientes import resolver_cliente`;
- em `cadastrar_pedido`, logo antes de `novo_pedido = CamisetaPedido(`, acrescentar:

```python
    cliente = resolver_cliente(db, pedido_in.id_cliente, pedido_in.nome_cliente)
```

- e, dentro de `CamisetaPedido(...)`, trocar `nome_cliente=pedido_in.nome_cliente,` por:

```python
        nome_cliente=cliente.nome,
        id_cliente=cliente.id_cliente,
```

- [ ] **Step 6: Rodar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas backend/app/services/camisetas backend/app/routers/camisetas backend/tests
git commit -m "feat: cadastro de clientes com busca e ligação com o pedido" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Cadastro de cores e cor de camiseta nas malhas

**Files:**
- Modify: `backend/app/schemas/camisetas_cadastros.py` (cores)
- Create: `backend/app/services/camisetas/cores.py`
- Create: `backend/app/routers/camisetas/cores.py`
- Create: `backend/app/services/camisetas/insumos.py`
- Modify: `backend/app/schemas/camisetas.py` (insumo: `id_cor`, `CamisetaInsumoUpdate`, resposta)
- Modify: `backend/app/routers/camisetas/insumos.py` (listar, criar, novo PUT)
- Modify: `backend/app/routers/camisetas/__init__.py`, `backend/tests/test_rotas_camisetas.py`
- Test: `backend/tests/test_cores.py`

**Interfaces:**
- Consumes: `ErroNegocio`; `CamisetaCor`; fábricas `criar_cor`, `criar_insumo`.
- Produces: schemas `CorEntrada(nome, hex, ativo)`, `CorResponse(id_cor, nome, hex, ativo)`, `CamisetaInsumoUpdate(tipo_malha_ou_aviamento, cor, id_cor, unidade_medida, estoque_minimo)`; `CamisetaInsumoResponse` com `id_cor`, `nome_cor`, `hex_cor`; serviço `listar_cores(db, incluir_inativas=False)`, `obter_cor(db, id_cor)`, `criar_cor`, `atualizar_cor`, `excluir_cor`; `montar_resposta_insumo(insumo) -> CamisetaInsumoResponse`, `atualizar_insumo(db, id_insumo, dados) -> CamisetaInsumo`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_cores.py`:

```python
from decimal import Decimal

from tests.fabricas import criar_cor, criar_insumo


def test_cria_cor_e_padroniza_hex(client):
    resposta = client.post("/camisetas/cores/", json={"nome": "Cinza Mescla", "hex": "#b8b8b8"})
    assert resposta.status_code == 201
    assert resposta.json()["hex"] == "#B8B8B8"


def test_nome_repetido_sem_diferenciar_maiusculas_retorna_409(client, db):
    criar_cor(db, nome="Preto")
    assert client.post("/camisetas/cores/", json={"nome": "PRETO", "hex": "#000000"}).status_code == 409


def test_hex_invalido_retorna_422(client):
    assert client.post("/camisetas/cores/", json={"nome": "Azul", "hex": "azul"}).status_code == 422


def test_inativas_ficam_fora_por_padrao(client, db):
    criar_cor(db, nome="Preto")
    criar_cor(db, nome="Antiga", ativo=False)
    assert [c["nome"] for c in client.get("/camisetas/cores/").json()] == ["Preto"]
    assert len(client.get("/camisetas/cores/?incluir_inativas=true").json()) == 2


def test_atualiza_cor(client, db):
    cor = criar_cor(db, nome="Preto")
    resposta = client.put(f"/camisetas/cores/{cor.id_cor}", json={"nome": "Preto Ônix", "hex": "#111111", "ativo": False})
    assert (resposta.json()["nome"], resposta.json()["ativo"]) == ("Preto Ônix", False)


def test_excluir_cor_em_uso_retorna_409(client, db):
    cor = criar_cor(db)
    insumo = criar_insumo(db)
    insumo.id_cor = cor.id_cor
    db.commit()
    assert client.delete(f"/camisetas/cores/{cor.id_cor}").status_code == 409


def test_excluir_cor_livre(client, db):
    cor = criar_cor(db)
    assert client.delete(f"/camisetas/cores/{cor.id_cor}").status_code == 204


def test_insumo_criado_com_cor_mostra_nome_e_hex(client, db):
    cor = criar_cor(db, nome="Preto", hex="#1F1F1F")
    resposta = client.post("/camisetas/insumos/", json={
        "categoria": "ROLO_TECIDO", "tipo_malha_ou_aviamento": "Meia Malha", "unidade_medida": "kg", "id_cor": cor.id_cor,
    })
    assert resposta.status_code == 201
    assert (resposta.json()["nome_cor"], resposta.json()["hex_cor"]) == ("Preto", "#1F1F1F")
    assert client.get("/camisetas/insumos/").json()[0]["nome_cor"] == "Preto"


def test_insumo_com_cor_inexistente_retorna_404(client):
    resposta = client.post("/camisetas/insumos/", json={
        "categoria": "ROLO_TECIDO", "tipo_malha_ou_aviamento": "Meia Malha", "unidade_medida": "kg", "id_cor": 999,
    })
    assert resposta.status_code == 404


def test_editar_insumo_nao_altera_saldo_nem_custo(client, db):
    cor = criar_cor(db)
    insumo = criar_insumo(db, saldo="100.000", custo="40.00")
    resposta = client.put(f"/camisetas/insumos/{insumo.id_insumo}", json={
        "tipo_malha_ou_aviamento": "Meia Malha Penteada", "cor": "Preto Reativo", "id_cor": cor.id_cor,
        "unidade_medida": "kg", "estoque_minimo": "25", "saldo_atual": "9999", "preco_custo_medio": "1",
    })
    assert resposta.status_code == 200
    db.refresh(insumo)
    assert insumo.tipo_malha_ou_aviamento == "Meia Malha Penteada"
    assert insumo.estoque_minimo == Decimal("25.000")
    assert insumo.saldo_atual == Decimal("100.000")
    assert insumo.preco_custo_medio == Decimal("40.00")
```

Em `backend/tests/test_rotas_camisetas.py`, acrescentar:

```python
    ("GET", "/camisetas/cores/"),
    ("POST", "/camisetas/cores/"),
    ("PUT", "/camisetas/cores/{id_cor}"),
    ("DELETE", "/camisetas/cores/{id_cor}"),
    ("PUT", "/camisetas/insumos/{id_insumo}"),
```

Run: `cd backend && venv/bin/python -m pytest tests/test_cores.py tests/test_rotas_camisetas.py -v`
Expected: FAIL (rotas inexistentes).

- [ ] **Step 2: Schemas**

Acrescentar ao final de `backend/app/schemas/camisetas_cadastros.py`:

```python
PADRAO_HEX = r"^#[0-9A-Fa-f]{6}$"


class CorEntrada(BaseModel):
    nome: str = Field(..., min_length=1, max_length=60)
    hex: str = Field(..., pattern=PADRAO_HEX)
    ativo: bool = True


class CorResponse(BaseModel):
    id_cor: int
    nome: str
    hex: str
    ativo: bool
    model_config = ConfigDict(from_attributes=True)
```

Em `backend/app/schemas/camisetas.py`:
- em `CamisetaInsumoBase`, logo após `preco_custo_medio: Decimal = Decimal("0.00")`, acrescentar:

```python
    id_cor: Optional[int] = None  # cor de camiseta que esta malha produz
```

- em `CamisetaInsumoResponse`, logo após `id_insumo: int`, acrescentar:

```python
    nome_cor: Optional[str] = None
    hex_cor: Optional[str] = None
```

- logo após a classe `CamisetaInsumoResponse`, acrescentar:

```python
class CamisetaInsumoUpdate(BaseModel):
    """Só dados cadastrais: saldo e custo médio mudam por nota fiscal (e ajuste de inventário)."""
    tipo_malha_ou_aviamento: str = Field(..., min_length=1, max_length=150)
    cor: Optional[str] = Field(None, max_length=80)
    id_cor: Optional[int] = None
    unidade_medida: str = Field(..., min_length=1, max_length=15)
    estoque_minimo: Decimal = Field(..., ge=0)
```

- [ ] **Step 3: Serviços**

`backend/app/services/camisetas/cores.py`:

```python
# app/services/camisetas/cores.py
"""Cadastro de cores de camiseta."""
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaInsumo
from app.models.camisetas_cadastros import CamisetaCor
from app.schemas.camisetas_cadastros import CorEntrada


def listar_cores(db: Session, incluir_inativas: bool = False) -> list[CamisetaCor]:
    consulta = db.query(CamisetaCor)
    if not incluir_inativas:
        consulta = consulta.filter(CamisetaCor.ativo.is_(True))
    return consulta.order_by(CamisetaCor.nome).all()


def obter_cor(db: Session, id_cor: int) -> CamisetaCor:
    cor = db.get(CamisetaCor, id_cor)
    if cor is None:
        raise ErroNegocio(404, "Cor não encontrada.")
    return cor


def _aplicar(db: Session, cor: CamisetaCor, dados: CorEntrada) -> None:
    nome = " ".join(dados.nome.split())
    repetida = (
        db.query(CamisetaCor)
        .filter(func.lower(CamisetaCor.nome) == nome.lower(), CamisetaCor.id_cor != cor.id_cor)
        .first()
    )
    if repetida:
        raise ErroNegocio(409, f"Já existe a cor {repetida.nome}.")
    cor.nome = nome
    cor.hex = dados.hex.upper()
    cor.ativo = dados.ativo


def criar_cor(db: Session, dados: CorEntrada) -> CamisetaCor:
    cor = CamisetaCor()
    _aplicar(db, cor, dados)
    db.add(cor)
    db.commit()
    db.refresh(cor)
    return cor


def atualizar_cor(db: Session, id_cor: int, dados: CorEntrada) -> CamisetaCor:
    cor = obter_cor(db, id_cor)
    _aplicar(db, cor, dados)
    db.commit()
    db.refresh(cor)
    return cor


def excluir_cor(db: Session, id_cor: int) -> None:
    cor = obter_cor(db, id_cor)
    if db.query(CamisetaInsumo.id_insumo).filter_by(id_cor=id_cor).first() is not None:
        raise ErroNegocio(409, "Cor em uso por malhas do estoque; inative-a em vez de excluir.")
    db.delete(cor)
    db.commit()


def validar_cor_opcional(db: Session, id_cor: Optional[int]) -> None:
    if id_cor is not None:
        obter_cor(db, id_cor)
```

`backend/app/services/camisetas/insumos.py`:

```python
# app/services/camisetas/insumos.py
"""Montagem da resposta e edição cadastral de insumos."""
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaInsumo, get_utc_now
from app.schemas.camisetas import CamisetaInsumoResponse, CamisetaInsumoUpdate
from app.services.camisetas.cores import validar_cor_opcional


def montar_resposta_insumo(insumo: CamisetaInsumo) -> CamisetaInsumoResponse:
    cor = insumo.cor_camiseta
    return CamisetaInsumoResponse(
        id_insumo=insumo.id_insumo,
        codigo=insumo.codigo,
        categoria=insumo.categoria,
        tipo_malha_ou_aviamento=insumo.tipo_malha_ou_aviamento,
        cor=insumo.cor,
        unidade_medida=insumo.unidade_medida,
        saldo_atual=insumo.saldo_atual,
        estoque_minimo=insumo.estoque_minimo,
        preco_custo_medio=insumo.preco_custo_medio,
        id_cor=insumo.id_cor,
        nome_cor=cor.nome if cor else None,
        hex_cor=cor.hex if cor else None,
        criado_em=insumo.criado_em,
        atualizado_em=insumo.atualizado_em,
    )


def atualizar_insumo(db: Session, id_insumo: int, dados: CamisetaInsumoUpdate) -> CamisetaInsumo:
    insumo = db.get(CamisetaInsumo, id_insumo)
    if insumo is None:
        raise ErroNegocio(404, "Insumo não encontrado.")
    validar_cor_opcional(db, dados.id_cor)
    insumo.tipo_malha_ou_aviamento = " ".join(dados.tipo_malha_ou_aviamento.split())
    insumo.cor = " ".join((dados.cor or "").split()) or None
    insumo.id_cor = dados.id_cor
    insumo.unidade_medida = dados.unidade_medida.lower()
    insumo.estoque_minimo = dados.estoque_minimo
    insumo.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(insumo)
    return insumo
```

- [ ] **Step 4: Routers**

`backend/app/routers/camisetas/cores.py`:

```python
# app/routers/camisetas/cores.py
"""Cadastro de cores (segmento Camisetas)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas_cadastros import CorEntrada, CorResponse
from app.services.camisetas.cores import atualizar_cor, criar_cor, excluir_cor, listar_cores

router = APIRouter()


@router.get("/cores/", response_model=List[CorResponse])
def listar(incluir_inativas: bool = False, db: Session = Depends(get_db)):
    return listar_cores(db, incluir_inativas)


@router.post("/cores/", response_model=CorResponse, status_code=status.HTTP_201_CREATED)
def criar(dados: CorEntrada, db: Session = Depends(get_db)):
    return criar_cor(db, dados)


@router.put("/cores/{id_cor}", response_model=CorResponse)
def atualizar(id_cor: int, dados: CorEntrada, db: Session = Depends(get_db)):
    return atualizar_cor(db, id_cor, dados)


@router.delete("/cores/{id_cor}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(id_cor: int, db: Session = Depends(get_db)):
    excluir_cor(db, id_cor)
```

Em `backend/app/routers/camisetas/__init__.py`, acrescentar `cores` ao import (em ordem alfabética, depois de `clientes`) e à tupla, depois de `clientes`.

Em `backend/app/routers/camisetas/insumos.py`:
- acrescentar aos imports:

```python
from app.schemas.camisetas import CamisetaInsumoUpdate
from app.services.camisetas.cores import validar_cor_opcional
from app.services.camisetas.insumos import atualizar_insumo, montar_resposta_insumo
```

- em `listar_insumos`, trocar `return query.order_by(CamisetaInsumo.codigo.asc()).all()` por:

```python
    return [montar_resposta_insumo(i) for i in query.order_by(CamisetaInsumo.codigo.asc()).all()]
```

- em `cadastrar_insumo`, logo no início da função, acrescentar `validar_cor_opcional(db, insumo_in.id_cor)`; dentro de `CamisetaInsumo(...)`, logo após `preco_custo_medio=insumo_in.preco_custo_medio`, acrescentar `, id_cor=insumo_in.id_cor` (com a vírgula na linha anterior); e trocar o `return novo_insumo` final por `return montar_resposta_insumo(novo_insumo)`.
- acrescentar ao final do arquivo:

```python


@router.put("/insumos/{id_insumo}", response_model=CamisetaInsumoResponse)
def editar_insumo(id_insumo: int, dados: CamisetaInsumoUpdate, db: Session = Depends(get_db)):
    """Edição cadastral: não altera saldo nem custo médio."""
    return montar_resposta_insumo(atualizar_insumo(db, id_insumo, dados))
```

- [ ] **Step 5: Rodar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas backend/app/services/camisetas backend/app/routers/camisetas backend/tests
git commit -m "feat: cadastro de cores e cor de camiseta ligada às malhas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Grades configuráveis e modelos usando grade

**Files:**
- Modify: `backend/app/schemas/camisetas_cadastros.py` (grades)
- Create: `backend/app/services/camisetas/grades.py`
- Create: `backend/app/services/camisetas/modelos.py`
- Create: `backend/app/routers/camisetas/grades.py`
- Modify: `backend/app/schemas/camisetas.py` (modelo: `id_grade`, `CamisetaModeloUpdate`, resposta)
- Modify: `backend/app/routers/camisetas/modelos.py` (listar, criar, novo PUT)
- Modify: `backend/app/routers/camisetas/seed.py` (grade padrão)
- Modify: `backend/app/routers/camisetas/__init__.py`, `backend/tests/test_rotas_camisetas.py`
- Test: `backend/tests/test_grades.py`

**Interfaces:**
- Consumes: `ErroNegocio`; `CamisetaGrade`, `CamisetaGradeTamanho`.
- Produces: schemas `GradeEntrada(nome, tamanhos: list[str], ativo)`, `GradeResponse(id_grade, nome, ativo, tamanhos, qtd_modelos)`, `CamisetaModeloUpdate(nome_modelo, consumo_tecido_kg, descricao, id_grade)`; `CamisetaModeloResponse` com `id_grade`, `nome_grade`, `tamanhos`; serviço grades: `GRADE_PADRAO_NOME`, `limpar_tamanhos(rotulos) -> list[str]`, `texto_grade(rotulos) -> str`, `rotulos_da_grade(grade) -> list[str]`, `aplicar_tamanhos(grade, rotulos) -> None`, `obter_grade(db, id_grade)`, `obter_grade_padrao(db)`, `listar_grades(db, incluir_inativas=False) -> list[GradeResponse]`, `criar_grade`, `atualizar_grade`, `excluir_grade`; serviço modelos: `montar_resposta_modelo(modelo)`, `definir_grade(db, modelo, id_grade)`, `criar_modelo(db, dados)`, `atualizar_modelo(db, id_modelo, dados)`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_grades.py`:

```python
import pytest

from app.core.erros import ErroNegocio
from app.models.camisetas_cadastros import CamisetaGrade
from app.services.camisetas.grades import aplicar_tamanhos, limpar_tamanhos, obter_grade_padrao
from tests.fabricas import criar_modelo


def test_limpar_tamanhos_apara_e_mantem_ordem():
    assert limpar_tamanhos([" PP", "P ", "  ", "M"]) == ["PP", "P", "M"]


@pytest.mark.parametrize("rotulos, mensagem", [
    ([], "pelo menos um tamanho"),
    (["  "], "pelo menos um tamanho"),
    (["P", "p"], "repetido"),
    (["EXTRAGRANDE1"], "10 caracteres"),
])
def test_limpar_tamanhos_recusa_lista_invalida(rotulos, mensagem):
    with pytest.raises(ErroNegocio) as erro:
        limpar_tamanhos(rotulos)
    assert erro.value.status_code == 400 and mensagem in erro.value.mensagem


def test_aplicar_tamanhos_mantem_os_que_continuam(db):
    grade = CamisetaGrade(nome="Teste")
    aplicar_tamanhos(grade, ["P", "M", "G"])
    db.add(grade)
    db.commit()
    id_m = next(t.id_tamanho for t in grade.tamanhos if t.rotulo == "M")
    aplicar_tamanhos(grade, ["M", "GG", "P"])
    db.commit()
    db.refresh(grade)
    assert [(t.rotulo, t.ordem) for t in grade.tamanhos] == [("M", 1), ("GG", 2), ("P", 3)]
    assert next(t.id_tamanho for t in grade.tamanhos if t.rotulo == "M") == id_m


def test_grade_padrao_e_criada_uma_vez(db):
    primeira = obter_grade_padrao(db)
    db.commit()
    assert obter_grade_padrao(db).id_grade == primeira.id_grade
    assert [t.rotulo for t in primeira.tamanhos] == ["P", "M", "G", "GG"]


def test_api_cria_e_lista_grade(client):
    resposta = client.post("/camisetas/grades/", json={"nome": "Infantil (2–16)", "tamanhos": ["2", "4", "6"]})
    assert resposta.status_code == 201
    assert client.get("/camisetas/grades/").json()[0]["tamanhos"] == ["2", "4", "6"]


def test_api_nome_repetido_retorna_409(client):
    client.post("/camisetas/grades/", json={"nome": "Adulto", "tamanhos": ["P"]})
    assert client.post("/camisetas/grades/", json={"nome": "adulto", "tamanhos": ["M"]}).status_code == 409


def test_api_editar_grade_regrava_texto_dos_modelos(client, db):
    grade = client.post("/camisetas/grades/", json={"nome": "Adulto", "tamanhos": ["P", "M"]}).json()
    modelo = client.post("/camisetas/modelos/", json={
        "nome_modelo": "Básica", "consumo_tecido_kg": "0.18", "id_grade": grade["id_grade"],
    }).json()
    client.put(f"/camisetas/grades/{grade['id_grade']}", json={"nome": "Adulto", "tamanhos": ["PP", "P", "M", "XG"]})
    modelos = {m["id_modelo"]: m for m in client.get("/camisetas/modelos/").json()}
    assert modelos[modelo["id_modelo"]]["grade_disponivel"] == "PP, P, M, XG"
    assert modelos[modelo["id_modelo"]]["tamanhos"] == ["PP", "P", "M", "XG"]
    assert client.get("/camisetas/grades/").json()[0]["qtd_modelos"] == 1


def test_api_excluir_grade_em_uso_retorna_409(client):
    grade = client.post("/camisetas/grades/", json={"nome": "Adulto", "tamanhos": ["P"]}).json()
    client.post("/camisetas/modelos/", json={"nome_modelo": "Básica", "consumo_tecido_kg": "0.18", "id_grade": grade["id_grade"]})
    assert client.delete(f"/camisetas/grades/{grade['id_grade']}").status_code == 409


def test_api_modelo_sem_grade_usa_a_padrao(client):
    corpo = client.post("/camisetas/modelos/", json={"nome_modelo": "Básica", "consumo_tecido_kg": "0.18"}).json()
    assert (corpo["nome_grade"], corpo["tamanhos"]) == ("Adulto (P, M, G, GG)", ["P", "M", "G", "GG"])


def test_api_editar_modelo_troca_grade(client, db):
    modelo = criar_modelo(db, nome="Básica")
    grade = client.post("/camisetas/grades/", json={"nome": "Babylook", "tamanhos": ["PP", "P", "M"]}).json()
    resposta = client.put(f"/camisetas/modelos/{modelo.id_modelo}", json={
        "nome_modelo": "Básica Babylook", "consumo_tecido_kg": "0.15", "id_grade": grade["id_grade"],
    })
    assert resposta.status_code == 200
    assert (resposta.json()["nome_modelo"], resposta.json()["grade_disponivel"]) == ("Básica Babylook", "PP, P, M")


def test_api_modelo_com_nome_repetido_retorna_409(client, db):
    criar_modelo(db, nome="Básica")
    assert client.post("/camisetas/modelos/", json={"nome_modelo": "Básica", "consumo_tecido_kg": "0.2"}).status_code == 409


def test_api_modelo_com_grade_inexistente_retorna_404(client):
    resposta = client.post("/camisetas/modelos/", json={"nome_modelo": "X", "consumo_tecido_kg": "0.2", "id_grade": 999})
    assert resposta.status_code == 404
```

Em `backend/tests/test_rotas_camisetas.py`, acrescentar:

```python
    ("GET", "/camisetas/grades/"),
    ("POST", "/camisetas/grades/"),
    ("PUT", "/camisetas/grades/{id_grade}"),
    ("DELETE", "/camisetas/grades/{id_grade}"),
    ("PUT", "/camisetas/modelos/{id_modelo}"),
```

Run: `cd backend && venv/bin/python -m pytest tests/test_grades.py tests/test_rotas_camisetas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.camisetas.grades'`.

- [ ] **Step 2: Schemas**

Acrescentar ao final de `backend/app/schemas/camisetas_cadastros.py`:

```python
class GradeEntrada(BaseModel):
    nome: str = Field(..., min_length=1, max_length=80)
    tamanhos: List[str] = Field(..., min_length=1)
    ativo: bool = True


class GradeResponse(BaseModel):
    id_grade: int
    nome: str
    ativo: bool
    tamanhos: List[str]
    qtd_modelos: int = 0
```

Em `backend/app/schemas/camisetas.py`:
- trocar a classe `CamisetaModeloCreate` por:

```python
class CamisetaModeloCreate(CamisetaModeloBase):
    id_grade: Optional[int] = None  # ausente → grade padrão "Adulto (P, M, G, GG)"


class CamisetaModeloUpdate(BaseModel):
    nome_modelo: str = Field(..., min_length=1, max_length=150)
    consumo_tecido_kg: Decimal = Field(..., gt=0)
    descricao: Optional[str] = None
    id_grade: Optional[int] = None  # ausente → mantém a grade atual
```

- em `CamisetaModeloResponse`, logo após `id_modelo: int`, acrescentar:

```python
    id_grade: Optional[int] = None
    nome_grade: Optional[str] = None
    tamanhos: List[str] = Field(default_factory=list)
```

- [ ] **Step 3: Serviços de grade e de modelo**

`backend/app/services/camisetas/grades.py`:

```python
# app/services/camisetas/grades.py
"""Grades de tamanhos: validação, ordem, sincronização com os modelos e grade padrão."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo
from app.models.camisetas_cadastros import CamisetaGrade, CamisetaGradeTamanho
from app.schemas.camisetas_cadastros import GradeEntrada, GradeResponse

GRADE_PADRAO_NOME = "Adulto (P, M, G, GG)"
TAMANHOS_PADRAO = ("P", "M", "G", "GG")
TAMANHO_MAX = 10


def limpar_tamanhos(rotulos) -> list[str]:
    limpos = [" ".join((r or "").split()) for r in rotulos]
    limpos = [r for r in limpos if r]
    if not limpos:
        raise ErroNegocio(400, "A grade precisa de pelo menos um tamanho.")
    longo = next((r for r in limpos if len(r) > TAMANHO_MAX), None)
    if longo:
        raise ErroNegocio(400, f"O tamanho '{longo}' passa de {TAMANHO_MAX} caracteres.")
    vistos = set()
    for rotulo in limpos:
        if rotulo.casefold() in vistos:
            raise ErroNegocio(400, f"Tamanho repetido na grade: {rotulo}.")
        vistos.add(rotulo.casefold())
    return limpos


def texto_grade(rotulos) -> str:
    return ", ".join(rotulos)


def rotulos_da_grade(grade: CamisetaGrade) -> list[str]:
    return [t.rotulo for t in sorted(grade.tamanhos, key=lambda t: t.ordem)]


def aplicar_tamanhos(grade: CamisetaGrade, rotulos: list[str]) -> None:
    """Mantém os tamanhos que continuam (preservando o id), cria os novos e remove os retirados."""
    existentes = {t.rotulo: t for t in grade.tamanhos}
    novos = []
    for ordem, rotulo in enumerate(rotulos, start=1):
        tamanho = existentes.pop(rotulo, None) or CamisetaGradeTamanho(rotulo=rotulo)
        tamanho.ordem = ordem
        novos.append(tamanho)
    grade.tamanhos = novos


def obter_grade(db: Session, id_grade: int) -> CamisetaGrade:
    grade = db.get(CamisetaGrade, id_grade)
    if grade is None:
        raise ErroNegocio(404, "Grade não encontrada.")
    return grade


def obter_grade_padrao(db: Session) -> CamisetaGrade:
    """Grade 'Adulto (P, M, G, GG)', criada se não existir. Não faz commit."""
    grade = db.query(CamisetaGrade).filter_by(nome=GRADE_PADRAO_NOME).first()
    if grade is None:
        grade = CamisetaGrade(nome=GRADE_PADRAO_NOME, ativo=True)
        aplicar_tamanhos(grade, list(TAMANHOS_PADRAO))
        db.add(grade)
        db.flush()
    return grade


def _contar_modelos(db: Session) -> dict:
    linhas = db.query(CamisetaModelo.id_grade, func.count(CamisetaModelo.id_modelo)).group_by(CamisetaModelo.id_grade).all()
    return dict(linhas)


def montar_resposta_grade(grade: CamisetaGrade, qtd_modelos: int = 0) -> GradeResponse:
    return GradeResponse(
        id_grade=grade.id_grade, nome=grade.nome, ativo=grade.ativo,
        tamanhos=rotulos_da_grade(grade), qtd_modelos=qtd_modelos,
    )


def listar_grades(db: Session, incluir_inativas: bool = False) -> list[GradeResponse]:
    consulta = db.query(CamisetaGrade)
    if not incluir_inativas:
        consulta = consulta.filter(CamisetaGrade.ativo.is_(True))
    contagem = _contar_modelos(db)
    return [montar_resposta_grade(g, contagem.get(g.id_grade, 0)) for g in consulta.order_by(CamisetaGrade.nome).all()]


def resposta_da_grade(db: Session, grade: CamisetaGrade) -> GradeResponse:
    return montar_resposta_grade(grade, _contar_modelos(db).get(grade.id_grade, 0))


def _validar_nome(db: Session, nome: str, id_grade=None) -> str:
    limpo = " ".join(nome.split())
    repetida = (
        db.query(CamisetaGrade)
        .filter(func.lower(CamisetaGrade.nome) == limpo.lower(), CamisetaGrade.id_grade != id_grade)
        .first()
    )
    if repetida:
        raise ErroNegocio(409, f"Já existe a grade {repetida.nome}.")
    return limpo


def _sincronizar_modelos(db: Session, grade: CamisetaGrade) -> None:
    texto = texto_grade(rotulos_da_grade(grade))
    for modelo in db.query(CamisetaModelo).filter_by(id_grade=grade.id_grade).all():
        modelo.grade_disponivel = texto


def criar_grade(db: Session, dados: GradeEntrada) -> CamisetaGrade:
    grade = CamisetaGrade(nome=_validar_nome(db, dados.nome), ativo=dados.ativo)
    aplicar_tamanhos(grade, limpar_tamanhos(dados.tamanhos))
    db.add(grade)
    db.commit()
    db.refresh(grade)
    return grade


def atualizar_grade(db: Session, id_grade: int, dados: GradeEntrada) -> CamisetaGrade:
    grade = obter_grade(db, id_grade)
    grade.nome = _validar_nome(db, dados.nome, id_grade)
    grade.ativo = dados.ativo
    aplicar_tamanhos(grade, limpar_tamanhos(dados.tamanhos))
    db.flush()
    _sincronizar_modelos(db, grade)
    db.commit()
    db.refresh(grade)
    return grade


def excluir_grade(db: Session, id_grade: int) -> None:
    grade = obter_grade(db, id_grade)
    if db.query(CamisetaModelo.id_modelo).filter_by(id_grade=id_grade).first() is not None:
        raise ErroNegocio(409, "Grade em uso por modelos; inative-a em vez de excluir.")
    db.delete(grade)
    db.commit()
```

`backend/app/services/camisetas/modelos.py`:

```python
# app/services/camisetas/modelos.py
"""Modelos de camiseta: criação, edição e grade."""
from typing import Optional

from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo
from app.schemas.camisetas import CamisetaModeloCreate, CamisetaModeloResponse, CamisetaModeloUpdate
from app.services.camisetas.grades import obter_grade, obter_grade_padrao, rotulos_da_grade, texto_grade


def montar_resposta_modelo(modelo: CamisetaModelo) -> CamisetaModeloResponse:
    grade = modelo.grade
    tamanhos = rotulos_da_grade(grade) if grade else [r.strip() for r in (modelo.grade_disponivel or "").split(",") if r.strip()]
    return CamisetaModeloResponse(
        id_modelo=modelo.id_modelo,
        nome_modelo=modelo.nome_modelo,
        grade_disponivel=modelo.grade_disponivel,
        consumo_tecido_kg=modelo.consumo_tecido_kg,
        descricao=modelo.descricao,
        criado_em=modelo.criado_em,
        atualizado_em=modelo.atualizado_em,
        id_grade=modelo.id_grade,
        nome_grade=grade.nome if grade else None,
        tamanhos=tamanhos,
    )


def definir_grade(db: Session, modelo: CamisetaModelo, id_grade: Optional[int]) -> None:
    grade = obter_grade(db, id_grade) if id_grade is not None else obter_grade_padrao(db)
    modelo.grade = grade
    modelo.grade_disponivel = texto_grade(rotulos_da_grade(grade))


def _validar_nome(db: Session, nome: str, id_modelo=None) -> str:
    limpo = " ".join(nome.split())
    repetido = (
        db.query(CamisetaModelo)
        .filter(CamisetaModelo.nome_modelo == limpo, CamisetaModelo.id_modelo != id_modelo)
        .first()
    )
    if repetido:
        raise ErroNegocio(409, "Já existe um modelo com esse nome.")
    return limpo


def criar_modelo(db: Session, dados: CamisetaModeloCreate) -> CamisetaModelo:
    modelo = CamisetaModelo(
        nome_modelo=_validar_nome(db, dados.nome_modelo),
        consumo_tecido_kg=dados.consumo_tecido_kg,
        descricao=dados.descricao,
    )
    definir_grade(db, modelo, dados.id_grade)
    db.add(modelo)
    db.commit()
    db.refresh(modelo)
    return modelo


def atualizar_modelo(db: Session, id_modelo: int, dados: CamisetaModeloUpdate) -> CamisetaModelo:
    modelo = db.get(CamisetaModelo, id_modelo)
    if modelo is None:
        raise ErroNegocio(404, "Modelo não encontrado.")
    modelo.nome_modelo = _validar_nome(db, dados.nome_modelo, id_modelo)
    modelo.consumo_tecido_kg = dados.consumo_tecido_kg
    modelo.descricao = dados.descricao
    if dados.id_grade is not None or modelo.grade is None:
        definir_grade(db, modelo, dados.id_grade)
    db.commit()
    db.refresh(modelo)
    return modelo
```

- [ ] **Step 4: Routers e seed**

`backend/app/routers/camisetas/grades.py`:

```python
# app/routers/camisetas/grades.py
"""Grades de tamanhos (segmento Camisetas)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas_cadastros import GradeEntrada, GradeResponse
from app.services.camisetas.grades import atualizar_grade, criar_grade, excluir_grade, listar_grades, resposta_da_grade

router = APIRouter()


@router.get("/grades/", response_model=List[GradeResponse])
def listar(incluir_inativas: bool = False, db: Session = Depends(get_db)):
    return listar_grades(db, incluir_inativas)


@router.post("/grades/", response_model=GradeResponse, status_code=status.HTTP_201_CREATED)
def criar(dados: GradeEntrada, db: Session = Depends(get_db)):
    return resposta_da_grade(db, criar_grade(db, dados))


@router.put("/grades/{id_grade}", response_model=GradeResponse)
def atualizar(id_grade: int, dados: GradeEntrada, db: Session = Depends(get_db)):
    return resposta_da_grade(db, atualizar_grade(db, id_grade, dados))


@router.delete("/grades/{id_grade}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(id_grade: int, db: Session = Depends(get_db)):
    excluir_grade(db, id_grade)
```

Em `backend/app/routers/camisetas/__init__.py`, acrescentar `grades` ao import (depois de `financeiro`) e à tupla (depois de `cores`).

Em `backend/app/routers/camisetas/modelos.py`:
- acrescentar aos imports:

```python
from app.schemas.camisetas import CamisetaModeloUpdate
from app.services.camisetas.modelos import atualizar_modelo, criar_modelo, montar_resposta_modelo
```

- substituir as funções `listar_modelos` e `cadastrar_modelo` (com decoradores) por:

```python
@router.get("/modelos/", response_model=List[CamisetaModeloResponse])
def listar_modelos(db: Session = Depends(get_db)):
    modelos = db.query(CamisetaModelo).order_by(CamisetaModelo.nome_modelo.asc()).all()
    return [montar_resposta_modelo(m) for m in modelos]


@router.post("/modelos/", response_model=CamisetaModeloResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_modelo(modelo_in: CamisetaModeloCreate, db: Session = Depends(get_db)):
    return montar_resposta_modelo(criar_modelo(db, modelo_in))


@router.put("/modelos/{id_modelo}", response_model=CamisetaModeloResponse)
def editar_modelo(id_modelo: int, dados: CamisetaModeloUpdate, db: Session = Depends(get_db)):
    return montar_resposta_modelo(atualizar_modelo(db, id_modelo, dados))
```

Em `backend/app/routers/camisetas/seed.py`:
- acrescentar o import `from app.services.camisetas.modelos import definir_grade`;
- trocar as linhas `        db.add_all([modelo1, modelo2, modelo3])` + `        db.commit()` (bloco "1. Modelos") por:

```python
        for modelo in (modelo1, modelo2, modelo3):
            definir_grade(db, modelo, None)  # grade padrão "Adulto (P, M, G, GG)"
        db.add_all([modelo1, modelo2, modelo3])
        db.commit()
```

- [ ] **Step 5: Rodar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam.

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas backend/app/services/camisetas backend/app/routers/camisetas backend/tests
git commit -m "feat: grades de tamanhos configuráveis e edição de modelos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Formulário de cliente e página de Clientes

**Files:**
- Create: `frontend-alfa/src/utils/documentos.js`
- Create: `frontend-alfa/src/components/cadastros/cadastros.css`
- Create: `frontend-alfa/src/components/cadastros/FormCliente.jsx`
- Create: `frontend-alfa/src/pages/ClientesCamisetas.jsx`, `frontend-alfa/src/pages/ClientesCamisetas.css`
- Modify: `frontend-alfa/src/App.jsx` (rota), `frontend-alfa/src/components/Sidebar.jsx` (item e numeração)
- Modify: títulos de `FichaTecnicaCamisetas.jsx` (3.→4.), `EstoqueCamisetas.jsx` (4.→5.), `CorteRendimentoCamisetas.jsx` (5.→6.), `CosturaFaccoesCamisetas.jsx` (6.→7.), `RegistroFinanceiroCamisetas.jsx` (7.→8.)

**Interfaces:**
- Consumes: rotas de clientes (Task 3); `useToast`, `useConfirm`, `mensagemDeErro`.
- Produces: `somenteDigitos(valor) -> string`, `formatarDocumento(valor) -> string`, `formatarTelefone(valor) -> string`; componente `FormCliente({ cliente?, nomeInicial?, modoRapido?, onSalvo(cliente), onFechar() })`; classes CSS `cadastro-*` reutilizadas nas Tasks 7–9.

- [ ] **Step 1: Utilitários e estilos compartilhados**

`frontend-alfa/src/utils/documentos.js`:

```js
/** Remove tudo que não for dígito. */
export const somenteDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');

/** 52998224725 → 529.982.247-25 · 11222333000181 → 11.222.333/0001-81 (outros valores ficam como estão). */
export function formatarDocumento(valor) {
  const d = somenteDigitos(valor);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return valor ?? '';
}

/** 85999990000 → (85) 9 9999-0000 · 8533334444 → (85) 3333-4444. */
export function formatarTelefone(valor) {
  const d = somenteDigitos(valor);
  if (d.length === 11) return d.replace(/(\d{2})(\d)(\d{4})(\d{4})/, '($1) $2 $3-$4');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return valor ?? '';
}
```

`frontend-alfa/src/components/cadastros/cadastros.css`:

```css
/* Cadastros (clientes, cores, grades) — tokens do Ateliê Artesanal (index.css) */
.cadastro-modal-fundo {
  position: fixed;
  inset: 0;
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(44, 37, 35, 0.45);
}

.cadastro-modal {
  width: min(44rem, 100%);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  padding: 1.4rem 1.6rem;
  border-radius: 12px;
  border: 1px solid var(--border-artisan);
  background: var(--bg-artisan-surface);
  box-shadow: 0 24px 60px rgba(44, 37, 35, 0.25);
}

.cadastro-modal.compacto {
  width: min(28rem, 100%);
}

.cadastro-modal-cabecalho {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.cadastro-modal-cabecalho h2 {
  margin: 0;
  font-family: var(--font-serif-editorial);
  font-size: 1.25rem;
}

.cadastro-modal-rodape {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.2rem;
}

.cadastro-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.9rem 1rem;
}

.cadastro-campo {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.cadastro-campo-largo {
  grid-column: 1 / -1;
}

.cadastro-campo label {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--color-text-body);
}

.cadastro-campo input,
.cadastro-campo select,
.cadastro-campo textarea {
  font: inherit;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--border-artisan-strong);
  background: var(--bg-artisan-surface);
  color: var(--color-text-main);
}

.cadastro-campo input:focus-visible,
.cadastro-campo select:focus-visible,
.cadastro-campo textarea:focus-visible {
  outline: 3px solid var(--accent-artisan-indigo-border);
  outline-offset: 1px;
}

.cadastro-campo-check {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.cadastro-erro {
  margin: 0 0 1rem;
  padding: 0.7rem 0.9rem;
  border-radius: 8px;
  border: 1px dashed var(--accent-artisan-terracotta-border);
  background: var(--accent-artisan-terracotta-bg);
  color: var(--accent-artisan-terracotta);
  font-weight: 600;
  font-size: 0.9rem;
}

.cadastro-btn {
  font: inherit;
  font-weight: 700;
  padding: 0.6rem 1.1rem;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.cadastro-btn.primario {
  background: var(--accent-artisan-indigo);
  color: var(--bg-artisan-surface);
}

.cadastro-btn.secundario {
  background: var(--bg-artisan-subtle);
  border-color: var(--border-artisan-strong);
  color: var(--color-text-main);
}

.cadastro-btn.perigo-texto {
  background: transparent;
  color: var(--accent-artisan-terracotta);
  padding-inline: 0.5rem;
}

.cadastro-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.cadastro-btn:focus-visible,
.cadastro-btn-icone:focus-visible {
  outline: 3px solid var(--accent-artisan-indigo-border);
  outline-offset: 2px;
}

.cadastro-btn-icone {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.3rem;
  border-radius: 6px;
  display: inline-flex;
}

.cadastro-etiqueta {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  background: var(--bg-artisan-subtle);
  border: 1px dashed var(--border-artisan-strong);
  color: var(--color-text-body);
}

.cadastro-etiqueta.inativo {
  background: var(--accent-artisan-terracotta-bg);
  border-color: var(--accent-artisan-terracotta-border);
  color: var(--accent-artisan-terracotta);
}

.cadastro-amostra {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border-radius: 4px;
  border: 1px solid var(--border-artisan-strong);
  vertical-align: middle;
}
```

- [ ] **Step 2: Formulário de cliente**

`frontend-alfa/src/components/cadastros/FormCliente.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { formatarDocumento, formatarTelefone } from '../../utils/documentos';
import './cadastros.css';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE',
  'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const VAZIO = {
  tipo: 'PJ', nome: '', documento: '', telefone_whatsapp: '', email: '',
  cidade: '', uf: '', endereco: '', observacoes: '', ativo: true,
};

const paraFormulario = (cliente, nomeInicial) => {
  if (!cliente) return { ...VAZIO, nome: nomeInicial };
  const base = Object.fromEntries(Object.keys(VAZIO).map((chave) => [chave, cliente[chave] ?? VAZIO[chave]]));
  return {
    ...base,
    documento: formatarDocumento(cliente.documento),
    telefone_whatsapp: formatarTelefone(cliente.telefone_whatsapp),
  };
};

/**
 * Formulário de cliente em janela. `modoRapido` pede só nome e WhatsApp.
 * @param {{ cliente?: object|null, nomeInicial?: string, modoRapido?: boolean,
 *           onSalvo: (cliente: object) => void, onFechar: () => void }} props
 */
export function FormCliente({ cliente = null, nomeInicial = '', modoRapido = false, onSalvo, onFechar }) {
  const toast = useToast();
  const [dados, setDados] = useState(() => paraFormulario(cliente, nomeInicial));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const editando = Boolean(cliente?.id_cliente);

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const alterar = (campo, valor) => setDados((atual) => ({ ...atual, [campo]: valor }));
  const propsCampo = (campo) => ({
    id: `cliente-${campo}`,
    value: dados[campo],
    onChange: (e) => alterar(campo, e.target.value),
  });

  const salvar = async (e) => {
    e.preventDefault();
    if (dados.nome.trim().length < 2) {
      setErro('Informe o nome do cliente (pelo menos 2 letras).');
      return;
    }
    try {
      setSalvando(true);
      setErro('');
      const corpo = { ...dados, uf: dados.uf || null, tipo: dados.tipo || null };
      const { data } = editando
        ? await api.put(`/camisetas/clientes/${cliente.id_cliente}`, corpo)
        : await api.post('/camisetas/clientes/', corpo);
      toast.sucesso(editando ? `Cliente ${data.nome} atualizado.` : `Cliente ${data.nome} cadastrado.`);
      onSalvo(data);
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível salvar o cliente.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="cadastro-modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <form
        className={`cadastro-modal ${modoRapido ? 'compacto' : ''}`}
        onSubmit={salvar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-form-cliente"
        noValidate
      >
        <header className="cadastro-modal-cabecalho">
          <h2 id="titulo-form-cliente">{editando ? 'Editar cliente' : 'Novo cliente'}</h2>
          <button type="button" className="cadastro-btn-icone" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        {erro && <p className="cadastro-erro" role="alert">{erro}</p>}

        <div className="cadastro-grid">
          {!modoRapido && (
            <div className="cadastro-campo">
              <label htmlFor="cliente-tipo">Tipo</label>
              <select {...propsCampo('tipo')}>
                <option value="PJ">Empresa (CNPJ)</option>
                <option value="PF">Pessoa (CPF)</option>
              </select>
            </div>
          )}
          <div className="cadastro-campo cadastro-campo-largo">
            <label htmlFor="cliente-nome">{dados.tipo === 'PF' ? 'Nome *' : 'Nome / Razão social *'}</label>
            <input {...propsCampo('nome')} maxLength={150} autoFocus required />
          </div>
          {!modoRapido && (
            <div className="cadastro-campo">
              <label htmlFor="cliente-documento">{dados.tipo === 'PF' ? 'CPF' : 'CNPJ'}</label>
              <input
                {...propsCampo('documento')}
                inputMode="numeric"
                onBlur={() => alterar('documento', formatarDocumento(dados.documento))}
              />
            </div>
          )}
          <div className="cadastro-campo">
            <label htmlFor="cliente-telefone_whatsapp">WhatsApp</label>
            <input
              {...propsCampo('telefone_whatsapp')}
              inputMode="tel"
              placeholder="(85) 9 9999-9999"
              onBlur={() => alterar('telefone_whatsapp', formatarTelefone(dados.telefone_whatsapp))}
            />
          </div>
          {!modoRapido && (
            <>
              <div className="cadastro-campo">
                <label htmlFor="cliente-email">E-mail</label>
                <input {...propsCampo('email')} type="email" maxLength={150} />
              </div>
              <div className="cadastro-campo">
                <label htmlFor="cliente-cidade">Cidade</label>
                <input {...propsCampo('cidade')} maxLength={100} />
              </div>
              <div className="cadastro-campo">
                <label htmlFor="cliente-uf">UF</label>
                <select {...propsCampo('uf')}>
                  <option value="">—</option>
                  {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </div>
              <div className="cadastro-campo cadastro-campo-largo">
                <label htmlFor="cliente-endereco">Endereço</label>
                <input {...propsCampo('endereco')} maxLength={255} />
              </div>
              <div className="cadastro-campo cadastro-campo-largo">
                <label htmlFor="cliente-observacoes">Observações</label>
                <textarea {...propsCampo('observacoes')} rows={2} />
              </div>
              {editando && (
                <label className="cadastro-campo cadastro-campo-check" htmlFor="cliente-ativo">
                  <input
                    id="cliente-ativo"
                    type="checkbox"
                    checked={dados.ativo}
                    onChange={(e) => alterar('ativo', e.target.checked)}
                  />
                  Cliente ativo
                </label>
              )}
            </>
          )}
        </div>

        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar cliente'}
          </button>
        </footer>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Página de clientes**

`frontend-alfa/src/pages/ClientesCamisetas.jsx`:

```jsx
import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Pencil, Plus, Search, Trash2, Users } from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/feedback/useToast';
import { useConfirm } from '../components/feedback/useConfirm';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { FormCliente } from '../components/cadastros/FormCliente';
import { formatarDocumento, formatarTelefone } from '../utils/documentos';
import './ClientesCamisetas.css';

const ESPERA_BUSCA_MS = 250;
const CAMPOS_EDITAVEIS = ['tipo', 'nome', 'documento', 'telefone_whatsapp', 'email', 'cidade', 'uf', 'endereco', 'observacoes'];

const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);
const formatarData = (valor) => (valor ? new Date(valor).toLocaleDateString('pt-BR') : '—');
const dadosEditaveis = (cliente) => Object.fromEntries(CAMPOS_EDITAVEIS.map((c) => [c, cliente[c] ?? null]));

function ClientesCamisetas() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [emEdicao, setEmEdicao] = useState(null); // null = fechado · {} = novo · cliente = editar

  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const { data } = await api.get('/camisetas/clientes/', {
        params: { busca: busca.trim() || undefined, incluir_inativos: incluirInativos, limite: 200 },
      });
      setClientes(data);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar os clientes.'));
    } finally {
      setCarregando(false);
    }
  }, [busca, incluirInativos, toast]);

  useEffect(() => {
    const timer = setTimeout(carregar, ESPERA_BUSCA_MS);
    return () => clearTimeout(timer);
  }, [carregar]);

  const alterarAtivo = async (cliente, ativo) => {
    try {
      await api.put(`/camisetas/clientes/${cliente.id_cliente}`, { ...dadosEditaveis(cliente), ativo });
      toast.sucesso(ativo ? `${cliente.nome} reativado.` : `${cliente.nome} inativado.`);
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível alterar o cliente.'));
    }
  };

  const excluir = async (cliente) => {
    const confirmou = await confirmar({
      titulo: `Excluir ${cliente.nome}?`,
      mensagem: 'O cadastro será apagado definitivamente.',
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (!confirmou) return;
    try {
      await api.delete(`/camisetas/clientes/${cliente.id_cliente}`);
      toast.sucesso(`${cliente.nome} excluído.`);
      carregar();
    } catch (err) {
      if (err.response?.status !== 409) {
        toast.erro(mensagemDeErro(err, 'Não foi possível excluir o cliente.'));
        return;
      }
      const inativar = await confirmar({
        titulo: 'Cliente com pedidos',
        mensagem: `${cliente.nome} tem pedidos e não pode ser excluído. Inativar o cadastro? Ele deixa de aparecer na busca de novos pedidos.`,
        textoConfirmar: 'Inativar cliente',
      });
      if (inativar) alterarAtivo(cliente, false);
    }
  };

  const aoSalvar = () => {
    setEmEdicao(null);
    carregar();
  };

  return (
    <div className="clientes-container">
      <Sidebar />
      <main className="clientes-main">
        <header className="page-header">
          <h1><Users size={28} color="#2563eb" aria-hidden="true" /> 3. Clientes</h1>
          <p>Cadastre lojas, empresas e pessoas que compram da confecção. Nos pedidos, basta buscar pelo nome.</p>
        </header>

        <div className="clientes-barra">
          <label className="clientes-busca" htmlFor="busca-clientes">
            <Search size={16} aria-hidden="true" />
            <input
              id="busca-clientes"
              type="search"
              placeholder="Buscar por nome, CPF/CNPJ ou telefone"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </label>
          <label className="clientes-filtro" htmlFor="mostrar-inativos">
            <input
              id="mostrar-inativos"
              type="checkbox"
              checked={incluirInativos}
              onChange={(e) => setIncluirInativos(e.target.checked)}
            />
            Mostrar inativos
          </label>
          <button type="button" className="cadastro-btn primario" onClick={() => setEmEdicao({})}>
            <Plus size={16} aria-hidden="true" /> Novo cliente
          </button>
        </div>

        <div className="clientes-tabela-card">
          <table className="clientes-tabela">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>CPF / CNPJ</th>
                <th>WhatsApp</th>
                <th>Cidade</th>
                <th>Pedidos</th>
                <th>Último pedido</th>
                <th>Total em pedidos</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {clientes.length === 0 ? (
                <tr>
                  <td colSpan="8" className="clientes-vazio">
                    {carregando ? 'Carregando…' : 'Nenhum cliente encontrado. Use "Novo cliente" para cadastrar.'}
                  </td>
                </tr>
              ) : clientes.map((cliente) => (
                <tr key={cliente.id_cliente}>
                  <td>
                    <strong>{cliente.nome}</strong>
                    {!cliente.ativo && <span className="cadastro-etiqueta inativo">Inativo</span>}
                  </td>
                  <td>{formatarDocumento(cliente.documento) || '—'}</td>
                  <td>
                    {cliente.telefone_whatsapp ? (
                      <a
                        className="clientes-whatsapp"
                        href={`https://wa.me/55${cliente.telefone_whatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir conversa no WhatsApp"
                      >
                        <MessageCircle size={14} aria-hidden="true" /> {formatarTelefone(cliente.telefone_whatsapp)}
                      </a>
                    ) : '—'}
                  </td>
                  <td>{[cliente.cidade, cliente.uf].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{cliente.qtd_pedidos}</td>
                  <td>{formatarData(cliente.ultimo_pedido_em)}</td>
                  <td>{formatarMoeda(cliente.valor_total_pedidos)}</td>
                  <td className="clientes-acoes">
                    <button
                      type="button"
                      className="cadastro-btn-icone"
                      onClick={() => setEmEdicao(cliente)}
                      aria-label={`Editar ${cliente.nome}`}
                    >
                      <Pencil size={16} />
                    </button>
                    {cliente.ativo ? (
                      <button
                        type="button"
                        className="cadastro-btn-icone"
                        onClick={() => excluir(cliente)}
                        aria-label={`Excluir ${cliente.nome}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : (
                      <button type="button" className="cadastro-btn secundario" onClick={() => alterarAtivo(cliente, true)}>
                        Reativar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {emEdicao && (
          <FormCliente
            cliente={emEdicao.id_cliente ? emEdicao : null}
            onSalvo={aoSalvar}
            onFechar={() => setEmEdicao(null)}
          />
        )}
      </main>
    </div>
  );
}

export default ClientesCamisetas;
```

`frontend-alfa/src/pages/ClientesCamisetas.css`:

```css
.clientes-container {
  display: flex;
  min-height: 100vh;
  background-color: var(--bg-artisan-cream);
  color: var(--color-text-main);
  font-family: var(--font-sans-humanist);
}

.clientes-main {
  flex: 1;
  padding: 2.2rem 2.8rem;
  overflow-y: auto;
}

.clientes-main .page-header {
  margin-bottom: 1.6rem;
}

.clientes-main .page-header h1 {
  font-family: var(--font-serif-editorial);
  font-size: 1.95rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0 0 0.35rem;
}

.clientes-main .page-header p {
  color: var(--color-text-muted);
  margin: 0;
}

.clientes-barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem 1.2rem;
  margin-bottom: 1rem;
}

.clientes-busca {
  flex: 1 1 18rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 0.8rem;
  border-radius: 8px;
  border: 1px solid var(--border-artisan-strong);
  background: var(--bg-artisan-surface);
  color: var(--color-text-muted);
}

.clientes-busca input {
  flex: 1;
  border: none;
  outline: none;
  font: inherit;
  background: transparent;
  color: var(--color-text-main);
}

.clientes-busca:focus-within {
  outline: 3px solid var(--accent-artisan-indigo-border);
}

.clientes-filtro {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: var(--color-text-body);
}

.clientes-tabela-card {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid var(--border-artisan);
  background: var(--bg-artisan-surface);
}

.clientes-tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.92rem;
}

.clientes-tabela th {
  text-align: left;
  padding: 0.8rem 1rem;
  background: var(--bg-artisan-subtle);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.clientes-tabela td {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-artisan);
  vertical-align: middle;
}

.clientes-tabela td .cadastro-etiqueta {
  margin-left: 0.5rem;
}

.clientes-acoes {
  white-space: nowrap;
  text-align: right;
}

.clientes-whatsapp {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--accent-artisan-sage);
  font-weight: 600;
  text-decoration: none;
}

.clientes-vazio {
  text-align: center;
  padding: 2rem !important;
  color: var(--color-text-muted);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 768px) {
  .clientes-main {
    padding: 1.2rem 1rem;
  }
}
```

- [ ] **Step 4: Rota, menu e numeração**

Em `frontend-alfa/src/App.jsx`: acrescentar `import ClientesCamisetas from './pages/ClientesCamisetas';` junto aos imports das telas de camisetas e, logo após a rota `/camisetas/pedidos`, acrescentar:

```jsx
      <Route path="/camisetas/clientes" element={<ClientesCamisetas />} />
```

Em `frontend-alfa/src/components/Sidebar.jsx`:
- o ícone `Users` já está importado de `lucide-react` nesse arquivo;
- no bloco de Camisetas, logo após o botão `2. Pedidos do Cliente`, acrescentar:

```jsx
            <button
              className={`nav-item ${isActive('/camisetas/clientes') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/clientes')}
            >
              <Users size={19} />
              <span>3. Clientes</span>
            </button>
```

- renumerar os rótulos seguintes: `3. Ficha Técnica Digital` → `4. Ficha Técnica Digital`, `4. Estoque de Insumos` → `5. Estoque de Insumos`, `5. Corte & Rendimento` → `6. Corte & Rendimento`, `6. Costura & Facções` → `7. Costura & Facções`, `7. Registro Financeiro` → `8. Registro Financeiro`.

Renumerar os títulos das páginas (texto exato, inclusive comentários que repetem o título):
- `FichaTecnicaCamisetas.jsx`: `3. Tela de Ficha Técnica Digital` → `4. Tela de Ficha Técnica Digital`
- `EstoqueCamisetas.jsx`: `4. Gestão de Estoque de Insumos` → `5. Gestão de Estoque de Insumos`
- `CorteRendimentoCamisetas.jsx`: `5. Tela de Corte e Rendimento` → `6. Tela de Corte e Rendimento`
- `CosturaFaccoesCamisetas.jsx`: `6. Tela de Costura e Terceirização` → `7. Tela de Costura e Terceirização`
- `RegistroFinanceiroCamisetas.jsx`: `7. Tela de Registro Financeiro` → `8. Tela de Registro Financeiro`

- [ ] **Step 5: Verificar build e lint**

Run: `cd frontend-alfa && npm run build && npx oxlint src/pages/ClientesCamisetas.jsx src/components/cadastros src/utils src/components/Sidebar.jsx src/App.jsx`
Expected: build ok, oxlint sem erros.

- [ ] **Step 6: Verificação no navegador**

Com o Roteiro de verificação local, em `http://localhost:5173/camisetas/clientes`: a lista mostra os clientes migrados/seed; "Novo cliente" com CNPJ `11.222.333/0001-82` mostra "CNPJ inválido" dentro do formulário; com `11.222.333/0001-81` salva e aparece formatado; a busca "beta" filtra; excluir um cliente com pedidos oferece "Inativar cliente"; o menu mostra "3. Clientes".

- [ ] **Step 7: Commit**

```bash
git add frontend-alfa/src
git commit -m "feat: página de clientes e formulário de cadastro" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Seletor de cliente no pedido

**Files:**
- Create: `frontend-alfa/src/components/cadastros/SeletorCliente.jsx`
- Modify: `frontend-alfa/src/components/cadastros/cadastros.css` (estilos do seletor)
- Modify: `frontend-alfa/src/pages/PedidoCamisetas.jsx`

**Interfaces:**
- Consumes: `FormCliente`, `formatarDocumento` (Task 6); `GET /camisetas/clientes/?busca=&limite=` e `id_cliente` no `POST /camisetas/pedidos/` (Task 3).
- Produces: `SeletorCliente({ id, cliente, onChange(cliente|null) })`.

- [ ] **Step 1: Componente**

`frontend-alfa/src/components/cadastros/SeletorCliente.jsx`:

```jsx
import { useEffect, useId, useState } from 'react';
import { CheckCircle, UserPlus } from 'lucide-react';
import api from '../../services/api';
import { FormCliente } from './FormCliente';
import { formatarDocumento } from '../../utils/documentos';
import './cadastros.css';

const MINIMO_LETRAS = 2;
const ESPERA_MS = 250;
const MAX_SUGESTOES = 8;

/**
 * Campo de cliente com busca ao digitar (ARIA combobox) e cadastro rápido.
 * @param {{ id: string, cliente: {id_cliente:number, nome:string}|null, onChange: (cliente: object|null) => void }} props
 */
export function SeletorCliente({ id, cliente, onChange }) {
  const listaId = useId();
  const [texto, setTexto] = useState(cliente?.nome ?? '');
  const [sugestoes, setSugestoes] = useState([]);
  const [erroBusca, setErroBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [cadastrando, setCadastrando] = useState(false);

  useEffect(() => {
    setTexto(cliente?.nome ?? '');
  }, [cliente]);

  const termo = texto.trim();
  const buscando = aberto && termo.length >= MINIMO_LETRAS && termo !== cliente?.nome;

  useEffect(() => {
    if (!buscando) return undefined;
    let cancelado = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/camisetas/clientes/', { params: { busca: termo, limite: MAX_SUGESTOES } });
        if (!cancelado) {
          setSugestoes(data);
          setErroBusca('');
        }
      } catch {
        if (!cancelado) setErroBusca('Não foi possível buscar clientes agora.');
      }
    }, ESPERA_MS);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [buscando, termo]);

  const opcoes = buscando ? [...sugestoes, { novo: true }] : [];

  const escolher = (opcao) => {
    setAberto(false);
    setAtivo(-1);
    if (opcao.novo) {
      setCadastrando(true);
      return;
    }
    setTexto(opcao.nome);
    onChange(opcao);
  };

  const aoDigitar = (e) => {
    setTexto(e.target.value);
    setAberto(true);
    setAtivo(-1);
    if (cliente) onChange(null);
  };

  const aoTeclar = (e) => {
    if (!opcoes.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAtivo((atual) => (atual + 1) % opcoes.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((atual) => (atual <= 0 ? opcoes.length - 1 : atual - 1));
    } else if (e.key === 'Enter' && ativo >= 0) {
      e.preventDefault();
      escolher(opcoes[ativo]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  };

  return (
    <div className="seletor-cliente">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={opcoes.length > 0}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={ativo >= 0 ? `${listaId}-${ativo}` : undefined}
        autoComplete="off"
        placeholder="Digite o nome, CPF/CNPJ ou telefone do cliente"
        value={texto}
        onChange={aoDigitar}
        onFocus={() => setAberto(true)}
        onBlur={() => setAberto(false)}
        onKeyDown={aoTeclar}
      />
      {cliente && (
        <span className="seletor-cliente-ok">
          <CheckCircle size={14} aria-hidden="true" /> Cliente cadastrado
        </span>
      )}
      {opcoes.length > 0 && (
        <ul id={listaId} role="listbox" className="seletor-cliente-lista" onMouseDown={(e) => e.preventDefault()}>
          {erroBusca && <li className="seletor-cliente-erro" role="presentation">{erroBusca}</li>}
          {opcoes.map((opcao, indice) => (
            <li
              key={opcao.novo ? 'novo' : opcao.id_cliente}
              id={`${listaId}-${indice}`}
              role="option"
              aria-selected={indice === ativo}
              className={`seletor-cliente-opcao ${indice === ativo ? 'ativa' : ''} ${opcao.novo ? 'nova' : ''}`}
              onClick={() => escolher(opcao)}
            >
              {opcao.novo ? (
                <><UserPlus size={15} aria-hidden="true" /> Cadastrar “{termo}”</>
              ) : (
                <>
                  <strong>{opcao.nome}</strong>
                  <small>{[formatarDocumento(opcao.documento), opcao.cidade].filter(Boolean).join(' · ')}</small>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {cadastrando && (
        <FormCliente
          modoRapido
          nomeInicial={termo}
          onSalvo={(novo) => {
            setCadastrando(false);
            escolher(novo);
          }}
          onFechar={() => setCadastrando(false)}
        />
      )}
    </div>
  );
}
```

Acrescentar ao final de `frontend-alfa/src/components/cadastros/cadastros.css`:

```css
.seletor-cliente {
  position: relative;
}

.seletor-cliente input {
  width: 100%;
}

.seletor-cliente-ok {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.3rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--accent-artisan-sage);
}

.seletor-cliente-lista {
  position: absolute;
  z-index: 50;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 0.3rem;
  list-style: none;
  border-radius: 10px;
  border: 1px solid var(--border-artisan-strong);
  background: var(--bg-artisan-surface);
  box-shadow: 0 12px 30px rgba(44, 37, 35, 0.15);
  max-height: 18rem;
  overflow-y: auto;
}

.seletor-cliente-opcao {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.55rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
}

.seletor-cliente-opcao small {
  color: var(--color-text-muted);
}

.seletor-cliente-opcao.ativa,
.seletor-cliente-opcao:hover {
  background: var(--accent-artisan-indigo-bg);
}

.seletor-cliente-opcao.nova {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  color: var(--accent-artisan-indigo);
  border-top: 1px dashed var(--border-artisan);
}

.seletor-cliente-erro {
  padding: 0.5rem 0.7rem;
  color: var(--accent-artisan-terracotta);
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Pedido usa o seletor**

Em `frontend-alfa/src/pages/PedidoCamisetas.jsx`:
1. Acrescentar o import `import { SeletorCliente } from '../components/cadastros/SeletorCliente';`.
2. No estado inicial `formData` e no reset dentro de `handleSubmit`, trocar `nome_cliente: '',` por `cliente: null,`.
3. Em `handleSubmit`, trocar a primeira validação por:

```jsx
    if (!formData.cliente) {
      toast.aviso('Escolha o cliente do pedido (ou cadastre um novo pela própria busca).');
      return;
    }
    if (!formData.id_modelo || !formData.prazo_entrega || !formData.valor_total) {
      toast.aviso('Preencha todos os campos obrigatórios marcados com asterisco (*).');
      return;
    }
```

   e, no corpo do `api.post('/camisetas/pedidos/', {...})`, trocar `nome_cliente: formData.nome_cliente,` por `id_cliente: formData.cliente.id_cliente,`.
4. Trocar o bloco do campo de cliente:

```jsx
                <label htmlFor="campo-nome-cliente">Nome do Cliente / Lojista *</label>
                <input 
                  id="campo-nome-cliente"
                  type="text" 
                  placeholder="Ex: Boutique Centro ou Loja Alfa Wear"
                  value={formData.nome_cliente}
                  onChange={(e) => setFormData({ ...formData, nome_cliente: e.target.value })}
                  required
                />
```

   por:

```jsx
                <label htmlFor="campo-cliente">Cliente *</label>
                <SeletorCliente
                  id="campo-cliente"
                  cliente={formData.cliente}
                  onChange={(cliente) => setFormData((atual) => ({ ...atual, cliente }))}
                />
```

- [ ] **Step 3: Verificar build e lint**

Run: `cd frontend-alfa && npm run build && npx oxlint src/components/cadastros src/pages/PedidoCamisetas.jsx && grep -n "nome_cliente" src/pages/PedidoCamisetas.jsx`
Expected: build ok, oxlint sem erros; `grep` só encontra usos de leitura (`p.nome_cliente`, `pedidoParaEntrega.nome_cliente`, `ped.nome_cliente`), nenhum no formulário.

- [ ] **Step 4: Verificação no navegador**

Em `/camisetas/pedidos`: digitar "lo" mostra sugestões; setas + Enter selecionam e aparece "Cliente cadastrado"; digitar "Cliente Teste QA" e escolher "Cadastrar …" abre o formulário rápido já preenchido; salvar seleciona o cliente; salvar o pedido mostra o código e o pedido aparece na lista com o nome do cliente; tentar salvar sem cliente mostra o aviso.

- [ ] **Step 5: Commit**

```bash
git add frontend-alfa/src/components/cadastros frontend-alfa/src/pages/PedidoCamisetas.jsx
git commit -m "feat: cliente escolhido por busca no pedido com cadastro rápido" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Abas de Cores e Grades na Ficha Técnica e grade no modelo

**Files:**
- Create: `frontend-alfa/src/components/cadastros/PainelCores.jsx`
- Create: `frontend-alfa/src/components/cadastros/PainelGrades.jsx`
- Modify: `frontend-alfa/src/components/cadastros/cadastros.css` (painéis e abas)
- Modify: `frontend-alfa/src/pages/FichaTecnicaCamisetas.jsx`

**Interfaces:**
- Consumes: rotas de cores (Task 4), grades e `PUT /modelos/{id}` (Task 5); classes `cadastro-*` (Task 6).
- Produces: `PainelCores()`, `PainelGrades()` (sem props; carregam e salvam sozinhos).

- [ ] **Step 1: Painel de cores**

`frontend-alfa/src/components/cadastros/PainelCores.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react';
import { Palette, Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { useConfirm } from '../feedback/useConfirm';
import { mensagemDeErro } from '../feedback/mensagemErro';
import './cadastros.css';

const CORES_BASICAS = [
  { nome: 'Branco', hex: '#FFFFFF' },
  { nome: 'Preto', hex: '#1F1F1F' },
  { nome: 'Cinza Mescla', hex: '#B8B8B8' },
  { nome: 'Azul Marinho', hex: '#1F2A44' },
];
const FORM_VAZIO = { id_cor: null, nome: '', hex: '#1F1F1F', ativo: true };

export function PainelCores() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [cores, setCores] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/camisetas/cores/', { params: { incluir_inativas: true } });
      setCores(data);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar as cores.'));
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) {
      toast.aviso('Informe o nome da cor.');
      return;
    }
    try {
      setSalvando(true);
      const corpo = { nome: form.nome, hex: form.hex, ativo: form.ativo };
      if (form.id_cor) await api.put(`/camisetas/cores/${form.id_cor}`, corpo);
      else await api.post('/camisetas/cores/', corpo);
      toast.sucesso(`Cor ${form.nome.trim()} salva.`);
      setForm(FORM_VAZIO);
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível salvar a cor.'));
    } finally {
      setSalvando(false);
    }
  };

  const adicionarBasicas = async () => {
    const existentes = new Set(cores.map((c) => c.nome.toLowerCase()));
    const faltantes = CORES_BASICAS.filter((c) => !existentes.has(c.nome.toLowerCase()));
    if (faltantes.length === 0) {
      toast.info('As cores básicas já estão cadastradas.');
      return;
    }
    try {
      for (const cor of faltantes) {
        await api.post('/camisetas/cores/', cor);
      }
      toast.sucesso(`${faltantes.length} cor(es) básica(s) adicionada(s).`);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível adicionar todas as cores básicas.'));
    }
    carregar();
  };

  const excluir = async (cor) => {
    const confirmou = await confirmar({
      titulo: `Excluir a cor ${cor.nome}?`,
      mensagem: 'A cor deixa de existir no cadastro.',
      textoConfirmar: 'Excluir cor',
      perigo: true,
    });
    if (!confirmou) return;
    try {
      await api.delete(`/camisetas/cores/${cor.id_cor}`);
      toast.sucesso(`Cor ${cor.nome} excluída.`);
      setForm(FORM_VAZIO);
      carregar();
    } catch (err) {
      if (err.response?.status !== 409) {
        toast.erro(mensagemDeErro(err, 'Não foi possível excluir a cor.'));
        return;
      }
      const inativar = await confirmar({
        titulo: 'Cor em uso',
        mensagem: `${cor.nome} está ligada a malhas do estoque. Inativar a cor? Ela deixa de aparecer nas escolhas.`,
        textoConfirmar: 'Inativar cor',
      });
      if (!inativar) return;
      try {
        await api.put(`/camisetas/cores/${cor.id_cor}`, { nome: cor.nome, hex: cor.hex, ativo: false });
        toast.sucesso(`Cor ${cor.nome} inativada.`);
        carregar();
      } catch (erroInativar) {
        toast.erro(mensagemDeErro(erroInativar, 'Não foi possível inativar a cor.'));
      }
    }
  };

  return (
    <section className="painel-cadastro" aria-labelledby="titulo-painel-cores">
      <header className="painel-cadastro-cabecalho">
        <h2 id="titulo-painel-cores"><Palette size={20} aria-hidden="true" /> Cores das camisetas</h2>
        <button type="button" className="cadastro-btn secundario" onClick={adicionarBasicas}>
          <Plus size={16} aria-hidden="true" /> Adicionar cores básicas
        </button>
      </header>

      <form className="painel-cadastro-form" onSubmit={salvar}>
        <div className="cadastro-campo">
          <label htmlFor="cor-nome">{form.id_cor ? 'Editando cor' : 'Nova cor'}</label>
          <input
            id="cor-nome"
            value={form.nome}
            maxLength={60}
            placeholder="Ex: Verde Bandeira"
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
        </div>
        <div className="cadastro-campo">
          <label htmlFor="cor-hex">Amostra</label>
          <div className="painel-cor-amostra">
            <input
              id="cor-hex"
              type="color"
              value={form.hex}
              onChange={(e) => setForm({ ...form, hex: e.target.value.toUpperCase() })}
            />
            <code>{form.hex}</code>
          </div>
        </div>
        {form.id_cor && (
          <label className="cadastro-campo cadastro-campo-check" htmlFor="cor-ativa">
            <input id="cor-ativa" type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativa
          </label>
        )}
        <div className="painel-cadastro-form-acoes">
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>
            {form.id_cor ? 'Salvar alterações' : 'Adicionar cor'}
          </button>
          {form.id_cor && (
            <>
              <button type="button" className="cadastro-btn secundario" onClick={() => setForm(FORM_VAZIO)}>Cancelar</button>
              <button type="button" className="cadastro-btn perigo-texto" onClick={() => excluir(form)}>
                <Trash2 size={15} aria-hidden="true" /> Excluir
              </button>
            </>
          )}
        </div>
      </form>

      {cores.length === 0 ? (
        <p className="painel-cadastro-vazio">Nenhuma cor cadastrada. Use "Adicionar cores básicas" para começar.</p>
      ) : (
        <ul className="painel-cores-lista">
          {cores.map((cor) => (
            <li key={cor.id_cor}>
              <button
                type="button"
                className={`painel-cor-item ${cor.ativo ? '' : 'inativa'}`}
                onClick={() => setForm({ id_cor: cor.id_cor, nome: cor.nome, hex: cor.hex, ativo: cor.ativo })}
                aria-label={`Editar a cor ${cor.nome}`}
              >
                <span className="painel-cor-quadro" style={{ background: cor.hex }} aria-hidden="true" />
                <span>{cor.nome}</span>
                {!cor.ativo && <span className="cadastro-etiqueta inativo">Inativa</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Painel de grades**

`frontend-alfa/src/components/cadastros/PainelGrades.jsx`:

```jsx
import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Ruler, Trash2, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { useConfirm } from '../feedback/useConfirm';
import { mensagemDeErro } from '../feedback/mensagemErro';
import './cadastros.css';

const MODELOS_PRONTOS = [
  { nome: 'Adulto (PP–XGG)', tamanhos: ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'] },
  { nome: 'Infantil (2–16)', tamanhos: ['2', '4', '6', '8', '10', '12', '14', '16'] },
  { nome: 'Babylook (PP–GG)', tamanhos: ['PP', 'P', 'M', 'G', 'GG'] },
];
const FORM_VAZIO = { id_grade: null, nome: '', tamanhos: [], ativo: true };

const mover = (lista, indice, passo) => {
  const destino = indice + passo;
  if (destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
};

export function PainelGrades() {
  const toast = useToast();
  const confirmar = useConfirm();
  const [grades, setGrades] = useState([]);
  const [form, setForm] = useState(FORM_VAZIO);
  const [novoTamanho, setNovoTamanho] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/camisetas/grades/', { params: { incluir_inativas: true } });
      setGrades(data);
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar as grades.'));
    }
  }, [toast]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const adicionarTamanho = () => {
    const rotulo = novoTamanho.trim().toUpperCase();
    if (!rotulo) return;
    if (form.tamanhos.some((t) => t.toUpperCase() === rotulo)) {
      toast.aviso(`O tamanho ${rotulo} já está na grade.`);
      return;
    }
    setForm({ ...form, tamanhos: [...form.tamanhos, rotulo] });
    setNovoTamanho('');
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim() || form.tamanhos.length === 0) {
      toast.aviso('Dê um nome à grade e adicione pelo menos um tamanho.');
      return;
    }
    try {
      setSalvando(true);
      const corpo = { nome: form.nome, tamanhos: form.tamanhos, ativo: form.ativo };
      if (form.id_grade) await api.put(`/camisetas/grades/${form.id_grade}`, corpo);
      else await api.post('/camisetas/grades/', corpo);
      toast.sucesso(`Grade ${form.nome.trim()} salva.`);
      setForm(FORM_VAZIO);
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível salvar a grade.'));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (grade) => {
    const confirmou = await confirmar({
      titulo: `Excluir a grade ${grade.nome}?`,
      mensagem: grade.qtd_modelos > 0
        ? `Ela é usada por ${grade.qtd_modelos} modelo(s); troque a grade desses modelos antes, ou inative-a.`
        : 'A grade deixa de existir no cadastro.',
      textoConfirmar: 'Excluir grade',
      perigo: true,
    });
    if (!confirmou) return;
    try {
      await api.delete(`/camisetas/grades/${grade.id_grade}`);
      toast.sucesso(`Grade ${grade.nome} excluída.`);
      carregar();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível excluir a grade.'));
    }
  };

  return (
    <section className="painel-cadastro" aria-labelledby="titulo-painel-grades">
      <header className="painel-cadastro-cabecalho">
        <h2 id="titulo-painel-grades"><Ruler size={20} aria-hidden="true" /> Grades de tamanhos</h2>
        <div className="painel-modelos-prontos">
          <span>Começar de um modelo pronto:</span>
          {MODELOS_PRONTOS.map((modelo) => (
            <button
              key={modelo.nome}
              type="button"
              className="cadastro-btn secundario"
              onClick={() => setForm({ ...FORM_VAZIO, nome: modelo.nome, tamanhos: modelo.tamanhos })}
            >
              {modelo.nome}
            </button>
          ))}
        </div>
      </header>

      <form className="painel-cadastro-form" onSubmit={salvar}>
        <div className="cadastro-campo">
          <label htmlFor="grade-nome">{form.id_grade ? 'Editando grade' : 'Nova grade'}</label>
          <input
            id="grade-nome"
            value={form.nome}
            maxLength={80}
            placeholder="Ex: Adulto (PP–XGG)"
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
          />
        </div>
        <div className="cadastro-campo">
          <label htmlFor="grade-novo-tamanho">Adicionar tamanho</label>
          <div className="painel-grade-novo">
            <input
              id="grade-novo-tamanho"
              value={novoTamanho}
              maxLength={10}
              placeholder="Ex: XG"
              onChange={(e) => setNovoTamanho(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarTamanho(); } }}
            />
            <button type="button" className="cadastro-btn secundario" onClick={adicionarTamanho}>Adicionar</button>
          </div>
        </div>
        <ol className="painel-grade-tamanhos" aria-label="Tamanhos da grade, na ordem">
          {form.tamanhos.length === 0 && <li className="painel-cadastro-vazio">Nenhum tamanho ainda.</li>}
          {form.tamanhos.map((rotulo, indice) => (
            <li key={rotulo} className="painel-grade-tamanho">
              <strong>{rotulo}</strong>
              <button type="button" className="cadastro-btn-icone" aria-label={`Mover ${rotulo} para a esquerda`}
                onClick={() => setForm({ ...form, tamanhos: mover(form.tamanhos, indice, -1) })}>
                <ArrowUp size={14} />
              </button>
              <button type="button" className="cadastro-btn-icone" aria-label={`Mover ${rotulo} para a direita`}
                onClick={() => setForm({ ...form, tamanhos: mover(form.tamanhos, indice, 1) })}>
                <ArrowDown size={14} />
              </button>
              <button type="button" className="cadastro-btn-icone" aria-label={`Remover ${rotulo}`}
                onClick={() => setForm({ ...form, tamanhos: form.tamanhos.filter((t) => t !== rotulo) })}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ol>
        {form.id_grade && (
          <label className="cadastro-campo cadastro-campo-check" htmlFor="grade-ativa">
            <input id="grade-ativa" type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Ativa
          </label>
        )}
        <div className="painel-cadastro-form-acoes">
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>
            {form.id_grade ? 'Salvar alterações' : 'Salvar grade'}
          </button>
          {(form.id_grade || form.nome || form.tamanhos.length > 0) && (
            <button type="button" className="cadastro-btn secundario" onClick={() => setForm(FORM_VAZIO)}>Cancelar</button>
          )}
        </div>
      </form>

      <ul className="painel-grades-lista">
        {grades.map((grade) => (
          <li key={grade.id_grade} className="painel-grade-item">
            <div>
              <strong>{grade.nome}</strong>
              {!grade.ativo && <span className="cadastro-etiqueta inativo">Inativa</span>}
              <div className="painel-grade-etiquetas">
                {grade.tamanhos.map((t) => <span key={t} className="cadastro-etiqueta">{t}</span>)}
              </div>
              <small>{grade.qtd_modelos} modelo(s) usam esta grade</small>
            </div>
            <div className="painel-grade-acoes">
              <button type="button" className="cadastro-btn-icone" aria-label={`Editar ${grade.nome}`}
                onClick={() => setForm({ id_grade: grade.id_grade, nome: grade.nome, tamanhos: grade.tamanhos, ativo: grade.ativo })}>
                <Pencil size={16} />
              </button>
              <button type="button" className="cadastro-btn-icone" aria-label={`Excluir ${grade.nome}`} onClick={() => excluir(grade)}>
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Acrescentar ao final de `frontend-alfa/src/components/cadastros/cadastros.css`:

```css
.ficha-abas {
  display: flex;
  gap: 0.4rem;
  margin: 0 0 1.4rem;
  border-bottom: 1px solid var(--border-artisan);
}

.ficha-aba {
  font: inherit;
  font-weight: 700;
  padding: 0.7rem 1.1rem;
  border: none;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}

.ficha-aba[aria-selected="true"] {
  color: var(--accent-artisan-indigo);
  border-bottom-color: var(--accent-artisan-indigo);
}

.ficha-aba:focus-visible {
  outline: 3px solid var(--accent-artisan-indigo-border);
  outline-offset: -3px;
}

.painel-cadastro {
  padding: 1.4rem 1.6rem;
  border-radius: 12px;
  border: 1px solid var(--border-artisan);
  background: var(--bg-artisan-surface);
}

.painel-cadastro-cabecalho {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 1.2rem;
}

.painel-cadastro-cabecalho h2 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-family: var(--font-serif-editorial);
  font-size: 1.25rem;
}

.painel-cadastro-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.9rem 1rem;
  align-items: end;
  padding: 1rem;
  margin-bottom: 1.2rem;
  border-radius: 10px;
  background: var(--bg-artisan-subtle);
}

.painel-cadastro-form-acoes {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  grid-column: 1 / -1;
}

.painel-cadastro-vazio {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.painel-cor-amostra {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.painel-cor-amostra input[type="color"] {
  width: 3rem;
  height: 2.4rem;
  padding: 0.15rem;
  cursor: pointer;
}

.painel-cores-lista {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10rem, 1fr));
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.painel-cor-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.7rem;
  font: inherit;
  text-align: left;
  border-radius: 8px;
  border: 1px solid var(--border-artisan);
  background: var(--bg-artisan-surface);
  cursor: pointer;
}

.painel-cor-item:hover,
.painel-cor-item:focus-visible {
  border-color: var(--accent-artisan-indigo-border);
  outline: none;
}

.painel-cor-item.inativa {
  opacity: 0.6;
}

.painel-cor-quadro {
  width: 1.8rem;
  height: 1.8rem;
  flex-shrink: 0;
  border-radius: 6px;
  border: 1px solid var(--border-artisan-strong);
}

.painel-modelos-prontos {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.painel-grade-novo {
  display: flex;
  gap: 0.5rem;
}

.painel-grade-novo input {
  flex: 1;
}

.painel-grade-tamanhos {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.painel-grade-tamanho {
  display: inline-flex;
  align-items: center;
  gap: 0.1rem;
  padding: 0.25rem 0.3rem 0.25rem 0.7rem;
  border-radius: 999px;
  border: 1px dashed var(--border-artisan-strong);
  background: var(--bg-artisan-surface);
}

.painel-grades-lista {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.painel-grade-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-artisan);
}

.painel-grade-item small {
  color: var(--color-text-muted);
}

.painel-grade-etiquetas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0.4rem 0;
}

.painel-grade-acoes {
  display: flex;
  align-items: flex-start;
  gap: 0.2rem;
}
```

- [ ] **Step 3: Ficha Técnica com abas, seletor de grade e edição de modelo**

Em `frontend-alfa/src/pages/FichaTecnicaCamisetas.jsx`:

1. Imports: acrescentar

```jsx
import { PainelCores } from '../components/cadastros/PainelCores';
import { PainelGrades } from '../components/cadastros/PainelGrades';
```

2. Estado: logo após `const confirmar = useConfirm();`, acrescentar

```jsx
  const [abaFicha, setAbaFicha] = useState('modelos'); // 'modelos' | 'cores' | 'grades'
  const [grades, setGrades] = useState([]);
  const [idModeloEdicao, setIdModeloEdicao] = useState(null);
```

   e no `useState` do `formModelo` (e nos dois resets de `formModelo` dentro do arquivo), trocar `grade_disponivel: 'P, M, G, GG',` por `id_grade: '',`.

3. Em `carregarDados`, trocar a busca por:

```jsx
      const { dados, houveFalha } = await buscarEmParalelo(['/camisetas/modelos/', '/camisetas/insumos/', '/camisetas/grades/']);
      const [listaMods, listaInsumos, listaGrades] = dados;
      setGrades(listaGrades);
```

   (mantendo as linhas seguintes `setModelos(listaMods); setInsumosEstoque(listaInsumos); if (houveFalha) …`).

4. Substituir a função `handleSalvarModelo` inteira por:

```jsx
  const abrirNovoModelo = () => {
    setIdModeloEdicao(null);
    setFormModelo({ nome_modelo: '', id_grade: grades[0]?.id_grade ?? '', consumo_tecido_kg: '0.180', descricao: '' });
    setModalNovoModelo(true);
  };

  const abrirEdicaoModelo = (modelo) => {
    setIdModeloEdicao(modelo.id_modelo);
    setFormModelo({
      nome_modelo: modelo.nome_modelo,
      id_grade: modelo.id_grade ?? '',
      consumo_tecido_kg: String(modelo.consumo_tecido_kg),
      descricao: modelo.descricao || '',
    });
    setModalNovoModelo(true);
  };

  const handleSalvarModelo = async (e) => {
    e.preventDefault();
    if (!formModelo.nome_modelo || !formModelo.consumo_tecido_kg) {
      mostrarToast('erro', 'Informe o nome do modelo e o consumo de tecido.');
      return;
    }
    const corpo = {
      nome_modelo: formModelo.nome_modelo,
      consumo_tecido_kg: parseFloat(formModelo.consumo_tecido_kg),
      descricao: formModelo.descricao,
      id_grade: formModelo.id_grade ? Number(formModelo.id_grade) : null,
    };
    try {
      setSalvandoModelo(true);
      const res = idModeloEdicao
        ? await api.put(`/camisetas/modelos/${idModeloEdicao}`, corpo)
        : await api.post('/camisetas/modelos/', corpo);
      mostrarToast('sucesso', `Modelo "${res.data.nome_modelo}" ${idModeloEdicao ? 'atualizado' : 'cadastrado'}.`);
      setModalNovoModelo(false);
      setIdModeloEdicao(null);
      await carregarDados();
      selecionarModelo(res.data);
    } catch (err) {
      console.error('Erro ao salvar modelo:', err);
      mostrarToast('erro', err.response?.data?.detail || 'Erro ao salvar modelo.');
    } finally {
      setSalvandoModelo(false);
    }
  };
```

5. Barra de abas: logo após o `</header>` da página (antes de `{/* SEÇÃO HORIZONTAL DE MODELOS DE CAMISETAS ...`), acrescentar:

```jsx
        <div className="ficha-abas" role="tablist" aria-label="Cadastros de produto">
          {[['modelos', 'Modelos'], ['cores', 'Cores'], ['grades', 'Grades']].map(([chave, rotulo]) => (
            <button
              key={chave}
              type="button"
              role="tab"
              aria-selected={abaFicha === chave}
              className="ficha-aba"
              onClick={() => {
                setAbaFicha(chave);
                if (chave === 'modelos') carregarDados();
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {abaFicha === 'cores' && <PainelCores />}
        {abaFicha === 'grades' && <PainelGrades />}
```

   e envolver o conteúdo atual da aba Modelos — do comentário `{/* SEÇÃO HORIZONTAL DE MODELOS DE CAMISETAS ...` até a linha imediatamente anterior a `{modalNovoModelo && (` — em:

```jsx
        {abaFicha === 'modelos' && (
          <>
            {/* conteúdo atual, sem alterações */}
          </>
        )}
```

6. No botão "Cadastrar Novo Modelo", trocar `onClick={() => setModalNovoModelo(true)}` por `onClick={abrirNovoModelo}`. Logo antes do botão "Adicionar Insumo na Ficha" (dentro do mesmo contêiner), acrescentar:

```jsx
              <button
                type="button"
                className="btn-acao-rapida secundario"
                onClick={() => abrirEdicaoModelo(modeloAtivo)}
                title="Alterar nome, consumo de malha ou grade deste modelo"
              >
                <Pencil size={18} />
                <span>Editar modelo</span>
              </button>
```

   e acrescentar `Pencil` ao import de `lucide-react`.

7. Onde a grade é exibida, trocar `{mod.grade_disponivel || 'P, M, G, GG'}` por `{mod.tamanhos?.join(', ') || mod.grade_disponivel}` e `{modeloAtivo.grade_disponivel || 'P, M, G, GG'}` por `{modeloAtivo.nome_grade || modeloAtivo.grade_disponivel}`.

8. No modal de modelo: o título `Cadastrar Novo Modelo` (dentro do `<h3 id="titulo-modal-modelo">`) vira `{idModeloEdicao ? 'Editar Modelo' : 'Cadastrar Novo Modelo'}`; e trocar o bloco do campo de grade:

```jsx
                  <label htmlFor="modelo-grade">Grade Disponível</label>
                  <input 
                    id="modelo-grade"
                    type="text" 
                    placeholder="P, M, G, GG"
                    value={formModelo.grade_disponivel}
                    onChange={(e) => setFormModelo({ ...formModelo, grade_disponivel: e.target.value })}
                  />
                  <span className="form-help-hint">Tamanhos padrão produzidos</span>
```

   por:

```jsx
                  <label htmlFor="modelo-grade">Grade de tamanhos</label>
                  <select
                    id="modelo-grade"
                    value={formModelo.id_grade}
                    onChange={(e) => setFormModelo({ ...formModelo, id_grade: e.target.value })}
                  >
                    {grades.length === 0 && <option value="">Grade padrão (P, M, G, GG)</option>}
                    {grades.filter((g) => g.ativo).map((g) => (
                      <option key={g.id_grade} value={g.id_grade}>{g.nome}</option>
                    ))}
                  </select>
                  <span className="form-help-hint">
                    {grades.find((g) => String(g.id_grade) === String(formModelo.id_grade))?.tamanhos.join(' · ')
                      || 'Crie outras grades na aba Grades'}
                  </span>
```

- [ ] **Step 4: Verificar build e lint**

Run: `cd frontend-alfa && npm run build && npx oxlint src/components/cadastros src/pages/FichaTecnicaCamisetas.jsx && grep -n "grade_disponivel: '" src/pages/FichaTecnicaCamisetas.jsx`
Expected: build ok; oxlint sem erros; `grep` sem resultados.

- [ ] **Step 5: Verificação no navegador**

Em `/camisetas/ficha-tecnica`: abas Modelos | Cores | Grades. Cores: "Adicionar cores básicas" cria 4 e, clicado de novo, avisa que já existem. Grades: "Adulto (PP–XGG)" preenche o formulário; reordenar e salvar; a lista mostra as etiquetas. Modelos: "Editar modelo" troca a grade para a nova e o card passa a mostrar os tamanhos novos.

- [ ] **Step 6: Commit**

```bash
git add frontend-alfa/src/components/cadastros frontend-alfa/src/pages/FichaTecnicaCamisetas.jsx
git commit -m "feat: abas de cores e grades na ficha técnica e edição de modelo" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Cor de camiseta e edição cadastral no Estoque

**Files:**
- Create: `frontend-alfa/src/components/cadastros/ModalEditarInsumo.jsx`
- Modify: `frontend-alfa/src/pages/EstoqueCamisetas.jsx`

**Interfaces:**
- Consumes: `GET /camisetas/cores/`, `id_cor` no `POST /camisetas/insumos/`, `PUT /camisetas/insumos/{id}` (Task 4); classes `cadastro-*`.
- Produces: `ModalEditarInsumo({ insumo, cores, onSalvo(insumo), onFechar() })`.

- [ ] **Step 1: Modal de edição**

`frontend-alfa/src/components/cadastros/ModalEditarInsumo.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import './cadastros.css';

const UNIDADES = [['kg', 'Quilos (kg)'], ['unidades', 'Unidades'], ['metros', 'Metros']];

/**
 * Edição cadastral de insumo (saldo e custo médio não mudam aqui).
 * @param {{ insumo: object, cores: object[], onSalvo: (insumo: object) => void, onFechar: () => void }} props
 */
export function ModalEditarInsumo({ insumo, cores, onSalvo, onFechar }) {
  const toast = useToast();
  const [dados, setDados] = useState({
    tipo_malha_ou_aviamento: insumo.tipo_malha_ou_aviamento,
    cor: insumo.cor || '',
    id_cor: insumo.id_cor ?? '',
    unidade_medida: insumo.unidade_medida,
    estoque_minimo: String(insumo.estoque_minimo ?? 0),
  });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const ehRolo = insumo.categoria === 'ROLO_TECIDO';

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const alterar = (campo) => (e) => setDados({ ...dados, [campo]: e.target.value });

  const salvar = async (e) => {
    e.preventDefault();
    if (!dados.tipo_malha_ou_aviamento.trim()) {
      setErro('Informe a descrição do insumo.');
      return;
    }
    try {
      setSalvando(true);
      setErro('');
      const { data } = await api.put(`/camisetas/insumos/${insumo.id_insumo}`, {
        ...dados,
        id_cor: dados.id_cor ? Number(dados.id_cor) : null,
        estoque_minimo: Number(dados.estoque_minimo || 0),
      });
      toast.sucesso(`Insumo ${insumo.codigo} atualizado.`);
      onSalvo(data);
    } catch (err) {
      setErro(mensagemDeErro(err, 'Não foi possível salvar o insumo.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="cadastro-modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <form className="cadastro-modal compacto" onSubmit={salvar} role="dialog" aria-modal="true" aria-labelledby="titulo-editar-insumo" noValidate>
        <header className="cadastro-modal-cabecalho">
          <h2 id="titulo-editar-insumo">Editar {insumo.codigo}</h2>
          <button type="button" className="cadastro-btn-icone" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </header>
        {erro && <p className="cadastro-erro" role="alert">{erro}</p>}
        <div className="cadastro-grid">
          <div className="cadastro-campo cadastro-campo-largo">
            <label htmlFor="insumo-descricao">Descrição *</label>
            <input id="insumo-descricao" value={dados.tipo_malha_ou_aviamento} onChange={alterar('tipo_malha_ou_aviamento')} maxLength={150} autoFocus />
          </div>
          <div className="cadastro-campo">
            <label htmlFor="insumo-cor-texto">Cor / tingimento</label>
            <input id="insumo-cor-texto" value={dados.cor} onChange={alterar('cor')} maxLength={80} />
          </div>
          {ehRolo && (
            <div className="cadastro-campo">
              <label htmlFor="insumo-id-cor">Cor da camiseta que esta malha produz</label>
              <select id="insumo-id-cor" value={dados.id_cor} onChange={alterar('id_cor')}>
                <option value="">Não definida</option>
                {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
              </select>
            </div>
          )}
          <div className="cadastro-campo">
            <label htmlFor="insumo-unidade">Unidade</label>
            <select id="insumo-unidade" value={dados.unidade_medida} onChange={alterar('unidade_medida')}>
              {UNIDADES.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </div>
          <div className="cadastro-campo">
            <label htmlFor="insumo-minimo">Estoque mínimo</label>
            <input id="insumo-minimo" type="number" min="0" step="0.001" inputMode="decimal" value={dados.estoque_minimo} onChange={alterar('estoque_minimo')} />
          </div>
        </div>
        <p className="painel-cadastro-vazio">Saldo e custo médio mudam pelas notas fiscais (Lançamento / Entrada NF).</p>
        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
        </footer>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Estoque usa cores e o modal**

Em `frontend-alfa/src/pages/EstoqueCamisetas.jsx`:

1. Acrescentar os imports:

```jsx
import { ModalEditarInsumo } from '../components/cadastros/ModalEditarInsumo';
import '../components/cadastros/cadastros.css';
```

2. Estados novos, logo após `const toast = useToast();`:

```jsx
  const [cores, setCores] = useState([]);
  const [insumoEmEdicao, setInsumoEmEdicao] = useState(null);
```

3. Logo após a função `carregarInsumos`, acrescentar:

```jsx
  const carregarCores = async () => {
    try {
      const res = await api.get('/camisetas/cores/');
      setCores(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar cores:', err);
      mostrarToast('erro', 'Não foi possível carregar as cores das camisetas.');
    }
  };
```

   e chamar `carregarCores();` no mesmo `useEffect` de montagem que já chama `carregarInsumos();`.

4. No estado inicial `formNovoInsumo` e no reset dentro de `abrirModalNovoInsumo`, acrescentar `id_cor: '',` logo após `cor: '',`. No `api.post('/camisetas/insumos/', {...})` de `handleSalvarNovoInsumo`, acrescentar:

```jsx
        id_cor: formNovoInsumo.categoria === 'ROLO_TECIDO' && formNovoInsumo.id_cor ? Number(formNovoInsumo.id_cor) : null,
```

5. No modal de novo insumo, logo após o bloco do campo `novo-insumo-cor` (o `<div className="form-group">` que contém o `<input id="novo-insumo-cor" …>` e o hint "Cor padrão ou sem tingimento"), acrescentar:

```jsx
                  {formNovoInsumo.categoria === 'ROLO_TECIDO' && (
                    <div className="form-group">
                      <label htmlFor="novo-insumo-id-cor">Cor da camiseta que esta malha produz</label>
                      <select
                        id="novo-insumo-id-cor"
                        value={formNovoInsumo.id_cor}
                        onChange={(e) => setFormNovoInsumo({ ...formNovoInsumo, id_cor: e.target.value })}
                      >
                        <option value="">Não definida</option>
                        {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
                      </select>
                      <span className="form-help-hint">Usada para preencher a cor automaticamente na OP</span>
                    </div>
                  )}
```

6. Na tabela, trocar `<td>{item.cor || '—'}</td>` por:

```jsx
                        <td>
                          {item.hex_cor && <span className="cadastro-amostra" style={{ background: item.hex_cor }} title={item.nome_cor} />}{' '}
                          {item.cor || item.nome_cor || '—'}
                        </td>
```

7. Logo antes do botão `+ Entrada` (na mesma `<td>`), acrescentar:

```jsx
                          <button
                            className="btn-acao-rapida secundario"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', marginRight: '0.4rem' }}
                            onClick={() => setInsumoEmEdicao(item)}
                            title={`Editar cadastro de ${item.tipo_malha_ou_aviamento}`}
                          >
                            Editar
                          </button>
```

8. Logo antes de `</main>`, acrescentar:

```jsx
        {insumoEmEdicao && (
          <ModalEditarInsumo
            insumo={insumoEmEdicao}
            cores={cores}
            onSalvo={() => {
              setInsumoEmEdicao(null);
              carregarInsumos();
            }}
            onFechar={() => setInsumoEmEdicao(null)}
          />
        )}
```

- [ ] **Step 3: Verificar build e lint**

Run: `cd frontend-alfa && npm run build && npx oxlint src/components/cadastros/ModalEditarInsumo.jsx src/pages/EstoqueCamisetas.jsx`
Expected: build ok, oxlint sem erros.

- [ ] **Step 4: Verificação no navegador**

Com cores básicas criadas (Task 8): em `/camisetas/estoque`, "Editar" em MALHA-01 → escolher "Preto" em "Cor da camiseta…" → salvar → a coluna Cor mostra a amostra preta; o saldo e o custo continuam iguais. Cadastrar um rolo novo já com a cor da camiseta.

- [ ] **Step 5: Commit**

```bash
git add frontend-alfa/src/components/cadastros/ModalEditarInsumo.jsx frontend-alfa/src/pages/EstoqueCamisetas.jsx
git commit -m "feat: cor da camiseta nas malhas e edição cadastral de insumos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Verificação final

- [ ] **Step 1: Backend**

Run: `cd backend && venv/bin/python -m pytest --cov=app/services --cov-report=term-missing`
Expected: todos passam; `TOTAL` ≥ 80% (complete com testes nas linhas listadas em "Missing" se ficar abaixo).

- [ ] **Step 2: Frontend**

Run: `cd frontend-alfa && npm run build && npx oxlint && grep -rn "alert(\|window.confirm(" src/pages/*Camisetas*.jsx src/components/cadastros`
Expected: build ok, zero erros de lint, `grep` sem resultados.

- [ ] **Step 3: Critérios de aceite**

Percorrer a seção 6 da spec com o Roteiro de verificação local (banco novo + seed) e confirmar cada item, incluindo: pedido criado escolhendo cliente pela busca; cliente novo pelo cadastro rápido; CNPJ inválido recusado; exclusão de cliente com pedidos oferecendo inativação; grades e cores na Ficha; modelo com grade nova; malha ligada a cor sem mudar saldo/custo.

- [ ] **Step 4: Encerrar servidores locais e apagar `backend/dev.db`.**
