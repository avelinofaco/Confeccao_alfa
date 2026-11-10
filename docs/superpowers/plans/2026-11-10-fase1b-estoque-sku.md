# Fase 1B — Produção e Estoque por Cor e Tamanho (SKU) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda quantidade do segmento Camisetas passa a andar por SKU (modelo + cor + tamanho): OP com várias cores e corte por cor × tamanho, facção enviando e devolvendo por SKU, estoque de Produtos Prontos com saldo, mínimo, inventário e histórico, e pedidos com itens entregues a partir do estoque de cada SKU.

**Architecture:** Sete tabelas novas em `app/models/camisetas_sku.py`. Toda alteração de saldo passa por `services/camisetas/sku.py::movimentar`, que grava a movimentação. As regras de OP, facção e pedido saem dos routers para serviços (`ordens.py`, `costura.py`, `pedidos.py`, `pedido_itens.py`, `produtos_prontos.py`); os routers ficam finos. Erros de regra usam `ErroNegocio`, que passa a aceitar dados extras (lista de faltas). No frontend, um componente de grade (`GradeQuantidades`) atende corte, envio, retorno, inventário e itens do pedido.

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, Pydantic 2, Alembic, pytest; React 19 + Vite 8, axios, lucide-react, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-10-fase1b-estoque-sku-design.md`

## Global Constraints

- Trabalhar no branch `feat/camisetas-estoque-sku` (já criado a partir de `feat/camisetas-fundacao`). Nunca commitar na `main`. Não fazer push.
- Mensagens de commit `<tipo>: <descrição>` com um segundo `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- **Nunca rodar nada contra o banco de produção.** Testes usam SQLite em memória (`tests/conftest.py`); execução local usa `DATABASE_URL=sqlite:///./dev.db`. O `frontend-alfa/.env` aponta a API para `http://localhost:8001`.
- Comandos de backend dentro de `backend/` com `venv/bin/python -m ...`.
- Migração nova: revisão `20261110_006_estoque_sku` (revisa `20261110_005_cadastros`), **somente aditiva**, com `downgrade`. Depois dela `alembic check` não pode acusar diferenças.
- Tabelas novas: `camisetas_variacoes`, `camisetas_movimentos_estoque`, `camisetas_op_cores`, `camisetas_op_cortes`, `camisetas_remessa_itens`, `camisetas_pedido_itens`, `camisetas_pedido_item_qtds`.
- `camisetas_produtos_acabados` deixa de ser usada (fica como histórico, `GET /estoque-acabado/` continua). Saldo por SKU começa em zero.
- Tipos de movimento: `INVENTARIO`, `AJUSTE`, `ENTRADA_PRODUCAO`, `SAIDA_ENTREGA`, `ESTORNO_ENTREGA`. Nenhuma operação deixa saldo negativo.
- URLs existentes não mudam; rotas novas: `GET /produtos-prontos/`, `POST /produtos-prontos/inventario`, `POST /produtos-prontos/ajustes`, `PUT /produtos-prontos/variacoes/{id_variacao}/minimo`, `GET /produtos-prontos/movimentos/`, `PUT /pedidos/{id_pedido}/itens` (todas sob `/camisetas`).
- Erros de regra: 400 dado inválido · 404 não encontrado · 409 conflito (inclui falta de estoque na entrega, com `detail = {mensagem, faltas}`) · 422 formato. Mensagens em português claro.
- Moda Íntima congelada: não alterar seus arquivos.
- Frontend: `npm run build` sem erros e `npx oxlint` sem **erros**; nada de imports sem uso nos arquivos tocados; avisos e confirmações por `useToast`/`useConfirm` (nunca `alert`/`confirm`); sem `console.log`.
- Cobertura ≥ 80% em `app/services/`. Arquivos-fonte abaixo de 800 linhas.
- Menu: 1. Dashboard · 2. Pedidos do Cliente · 3. Clientes · 4. Ficha Técnica · 5. Estoque de Insumos · 6. Corte & Rendimento · 7. Costura & Facções · **8. Produtos Prontos** · **9. Registro Financeiro** (títulos das páginas acompanham).
- Fora do escopo: entrega parcial (Fase 7), reserva e pedido → OP (Fase 6), estampas (Fase 3).

### Roteiro de verificação local

```bash
cd backend && rm -f dev.db && DATABASE_URL=sqlite:///./dev.db venv/bin/python -m alembic upgrade head \
  && DATABASE_URL=sqlite:///./dev.db venv/bin/python -m uvicorn app.main:app --port 8001          # terminal 1
curl -s -X POST http://localhost:8001/camisetas/seed-inicial                                        # terminal 2
cd frontend-alfa && npm run dev -- --port 5173 --strictPort                                         # terminal 3
# Navegador automatizado: node ~/.claude/skills/browser-automation/browser.mjs <url> --script <arquivo.mjs>
```

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/app/core/erros.py` | `ErroNegocio` aceita `dados` extras; `detalhe()` monta o `detail` |
| `backend/app/models/camisetas_sku.py` (novo) | as 7 tabelas novas |
| `backend/app/models/camisetas.py` | relacionamentos `op.cores`, `op.cortes`, `remessa.itens`, `pedido.itens`; índice de `mes_ano` |
| `backend/alembic/versions/20261110_006_estoque_sku.py` (novo) | cria as tabelas, converte pedidos em itens, alinha índices da 1A |
| `backend/app/schemas/camisetas_sku.py` (novo) | schemas de SKU, Produtos Prontos e itens de OP/remessa/pedido |
| `backend/app/services/camisetas/sku.py` (novo) | `obter_ou_criar_variacao`, `movimentar`, `descrever_variacao`, tamanhos do modelo |
| `backend/app/services/camisetas/produtos_prontos.py` (novo) | listagem, inventário, ajuste, mínimo, histórico |
| `backend/app/services/camisetas/ordens.py` (novo) | abrir OP com cores, registrar corte, resposta da OP |
| `backend/app/services/camisetas/costura.py` | envio e retorno por SKU, resposta da remessa |
| `backend/app/services/camisetas/pedido_itens.py` (novo) | validação/gravação/resposta dos itens do pedido |
| `backend/app/services/camisetas/pedidos.py` | criar, editar itens, entregar, estornar, status, excluir |
| `backend/app/routers/camisetas/produtos_prontos.py` (novo) | rotas de Produtos Prontos |
| `backend/app/routers/camisetas/{ordens,costura,pedidos}.py` | ficam finos, chamando os serviços |
| `frontend-alfa/src/components/producao/GradeQuantidades.jsx` (+ `producao.css`) | grade linhas × tamanhos com totais |
| `frontend-alfa/src/components/producao/ModalProducao.jsx` | moldura de modal (portal, Esc, clique fora) |
| `frontend-alfa/src/components/producao/{FormNovaOp,ModalCorteOp,FormEnvioFaccao,ModalRetornoFaccao}.jsx` | telas de corte e facção |
| `frontend-alfa/src/components/produtos/{PainelSku,HistoricoMovimentos,BarraInventario}.jsx` | Produtos Prontos |
| `frontend-alfa/src/components/pedidos/{ItensPedidoEditor,ModalItensPedido,ModalEntregaPedido}.jsx` | itens e entrega do pedido |
| `frontend-alfa/src/utils/{grade,producao,produtosProntos,pedidoItens}.js` | funções puras das telas |
| `frontend-alfa/src/pages/ProdutosProntosCamisetas.jsx` (+ `.css`) | página nova |

---

### Task 1: Tabelas por SKU, migração 006 e `ErroNegocio` com dados

**Files:**
- Modify: `backend/app/core/erros.py`, `backend/app/main.py:15-17`
- Create: `backend/app/models/camisetas_sku.py`
- Modify: `backend/app/models/camisetas.py` (relacionamentos e import final), `backend/alembic/env.py:17`
- Create: `backend/alembic/versions/20261110_006_estoque_sku.py`
- Test: `backend/tests/test_erros.py` (novo), `backend/tests/test_migracoes.py`

**Interfaces:**
- Produces: `ErroNegocio(status_code, mensagem, dados=None)` com `.detalhe() -> str | dict`; classes `CamisetaVariacao`, `CamisetaMovimentoEstoque`, `CamisetaOpCor`, `CamisetaOpCorte`, `CamisetaRemessaItem`, `CamisetaPedidoItem`, `CamisetaPedidoItemQtd`; relacionamentos `CamisetaOrdemProducao.cores`, `.cortes`, `CamisetaCosturaFaccao.itens`, `CamisetaPedido.itens`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_erros.py`:

```python
from app.core.erros import ErroNegocio


def test_erro_sem_dados_devolve_so_a_mensagem():
    assert ErroNegocio(400, "Dado inválido.").detalhe() == "Dado inválido."


def test_erro_com_dados_devolve_mensagem_e_dados():
    erro = ErroNegocio(409, "Falta estoque.", {"faltas": [{"sku": "X"}]})
    assert erro.detalhe() == {"mensagem": "Falta estoque.", "faltas": [{"sku": "X"}]}
```

Acrescentar ao fim de `backend/tests/test_migracoes.py`:

```python
def test_migracao_estoque_sku_converte_pedidos_em_itens(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261110_005_cadastros", url=url)
    engine = sa.create_engine(url)
    with engine.begin() as conexao:
        conexao.execute(sa.text("INSERT INTO camisetas_grades (id_grade, nome, ativo) VALUES (1, 'Curta', 1)"))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_grade_tamanhos (id_tamanho, id_grade, rotulo, ordem) VALUES (1, 1, 'P', 1), (2, 1, 'M', 2)"
        ))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_modelos (id_modelo, nome_modelo, consumo_tecido_kg, grade_disponivel, id_grade) "
            "VALUES (1, 'Básica', 0.18, 'P, M', 1)"
        ))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_pedidos (id_pedido, codigo_pedido, nome_cliente, id_modelo, grade_p, grade_m, grade_g, "
            "grade_gg, quantidade_total, prazo_entrega, valor_total) VALUES (1, 'A', 'C', 1, 5, 0, 3, 0, 8, '2026-10-01', 100)"
        ))
    rodar_alembic("upgrade", "head", url=url)
    with engine.connect() as conexao:
        item = conexao.execute(sa.text(
            "SELECT id_item, id_modelo, id_cor FROM camisetas_pedido_itens WHERE id_pedido = 1")).one()
        quantidades = conexao.execute(sa.text(
            "SELECT t.rotulo, q.quantidade FROM camisetas_pedido_item_qtds q "
            "JOIN camisetas_grade_tamanhos t ON t.id_tamanho = q.id_tamanho WHERE q.id_item = :i ORDER BY t.ordem"),
            {"i": item.id_item}).all()
        rotulos = [r[0] for r in conexao.execute(sa.text(
            "SELECT rotulo FROM camisetas_grade_tamanhos WHERE id_grade = 1 ORDER BY ordem")).all()]
        texto = conexao.execute(sa.text("SELECT grade_disponivel FROM camisetas_modelos WHERE id_modelo = 1")).scalar_one()
    engine.dispose()
    assert (item.id_modelo, item.id_cor) == (1, None)
    assert [tuple(q) for q in quantidades] == [("P", 5), ("G", 3)]
    assert rotulos == ["P", "M", "G"]
    assert texto == "P, M, G"
    rodar_alembic("downgrade", "20261110_005_cadastros", url=url)
    assert "camisetas_variacoes" not in tabelas(url)
    assert "camisetas_pedido_itens" not in tabelas(url)


def test_modelos_e_migracoes_estao_alinhados(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "head", url=url)
    rodar_alembic("check", url=url)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_erros.py tests/test_migracoes.py -q`
Expected: FAIL — `ErroNegocio` sem `detalhe`; revisão `20261110_005_cadastros` é a última (a tabela `camisetas_pedido_itens` não existe); `alembic check` acusa os índices `ix_camisetas_clientes_id_cliente`, `ix_camisetas_cores_id_cor`, `ix_camisetas_grade_tamanhos_id_tamanho`, `ix_camisetas_grades_id_grade` e o índice removido `ix_camisetas_registros_financeiros_mes_ano` (diferenças herdadas da 1A, corrigidas nesta tarefa).

- [ ] **Step 3: `ErroNegocio` com dados**

`backend/app/core/erros.py`:

```python
# app/core/erros.py
"""Erro de regra de negócio levantado pelos serviços e convertido em resposta HTTP."""
from typing import Optional


class ErroNegocio(Exception):
    def __init__(self, status_code: int, mensagem: str, dados: Optional[dict] = None):
        super().__init__(mensagem)
        self.status_code = status_code
        self.mensagem = mensagem
        self.dados = dados

    def detalhe(self):
        """Texto simples; com dados extras (ex.: lista de faltas), {mensagem, ...dados}."""
        if not self.dados:
            return self.mensagem
        return {"mensagem": self.mensagem, **self.dados}
```

Em `backend/app/main.py`, no handler: `content={"detail": erro.detalhe()}`.

- [ ] **Step 4: Modelos novos**

`backend/app/models/camisetas_sku.py`:

```python
# app/models/camisetas_sku.py
"""Produção e estoque por SKU (modelo + cor + tamanho) do segmento Camisetas."""
from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.estoque import get_utc_now


class CamisetaVariacao(Base):
    """O SKU: um modelo numa cor e num tamanho, com o saldo de peças prontas."""
    __tablename__ = "camisetas_variacoes"
    __table_args__ = (
        UniqueConstraint("id_modelo", "id_cor", "id_tamanho", name="uk_variacao_sku"),
        CheckConstraint("saldo >= 0", name="ck_variacao_saldo_nao_negativo"),
    )

    id_variacao = Column(Integer, primary_key=True)
    id_modelo = Column(Integer, ForeignKey("camisetas_modelos.id_modelo", ondelete="RESTRICT"), nullable=False)
    id_cor = Column(Integer, ForeignKey("camisetas_cores.id_cor", ondelete="RESTRICT"), nullable=False)
    id_tamanho = Column(Integer, ForeignKey("camisetas_grade_tamanhos.id_tamanho", ondelete="RESTRICT"), nullable=False)
    saldo = Column(Integer, nullable=False, default=0)
    estoque_minimo = Column(Integer, nullable=False, default=0)

    modelo = relationship("CamisetaModelo")
    cor = relationship("CamisetaCor")
    tamanho = relationship("CamisetaGradeTamanho")


class CamisetaMovimentoEstoque(Base):
    """Cada entrada ou saída de peças prontas, com o saldo que ficou depois dela."""
    __tablename__ = "camisetas_movimentos_estoque"

    id_movimento = Column(Integer, primary_key=True)
    id_variacao = Column(Integer, ForeignKey("camisetas_variacoes.id_variacao", ondelete="RESTRICT"), nullable=False, index=True)
    tipo = Column(String(20), nullable=False)
    quantidade = Column(Integer, nullable=False)  # com sinal; nunca zero
    saldo_apos = Column(Integer, nullable=False)
    motivo = Column(String(255), nullable=True)
    id_pedido = Column(Integer, ForeignKey("camisetas_pedidos.id_pedido", ondelete="SET NULL"), nullable=True, index=True)
    id_costura = Column(Integer, ForeignKey("camisetas_costura_faccoes.id_costura", ondelete="SET NULL"), nullable=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)

    variacao = relationship("CamisetaVariacao")
    pedido = relationship("CamisetaPedido")
    remessa = relationship("CamisetaCosturaFaccao")


class CamisetaOpCor(Base):
    """Uma cor do enfesto da OP, com o rolo de malha e o peso usados."""
    __tablename__ = "camisetas_op_cores"
    __table_args__ = (UniqueConstraint("id_op", "id_cor", name="uk_op_cor"),)

    id_op_cor = Column(Integer, primary_key=True)
    id_op = Column(Integer, ForeignKey("camisetas_ordens_producao.id_op", ondelete="CASCADE"), nullable=False)
    id_cor = Column(Integer, ForeignKey("camisetas_cores.id_cor", ondelete="RESTRICT"), nullable=False)
    id_insumo_tecido = Column(Integer, ForeignKey("camisetas_insumos.id_insumo", ondelete="SET NULL"), nullable=True)
    peso_kg = Column(Numeric(10, 3), nullable=False)

    op = relationship("CamisetaOrdemProducao", back_populates="cores")
    cor = relationship("CamisetaCor")
    tecido = relationship("CamisetaInsumo")


class CamisetaOpCorte(Base):
    """Peças cortadas de um SKU numa OP."""
    __tablename__ = "camisetas_op_cortes"
    __table_args__ = (UniqueConstraint("id_op", "id_variacao", name="uk_op_corte"),)

    id_corte = Column(Integer, primary_key=True)
    id_op = Column(Integer, ForeignKey("camisetas_ordens_producao.id_op", ondelete="CASCADE"), nullable=False)
    id_variacao = Column(Integer, ForeignKey("camisetas_variacoes.id_variacao", ondelete="RESTRICT"), nullable=False)
    quantidade = Column(Integer, nullable=False)

    op = relationship("CamisetaOrdemProducao", back_populates="cortes")
    variacao = relationship("CamisetaVariacao")


class CamisetaRemessaItem(Base):
    """Peças de um SKU enviadas a uma facção e quantas voltaram."""
    __tablename__ = "camisetas_remessa_itens"
    __table_args__ = (UniqueConstraint("id_costura", "id_variacao", name="uk_remessa_item"),)

    id_item = Column(Integer, primary_key=True)
    id_costura = Column(Integer, ForeignKey("camisetas_costura_faccoes.id_costura", ondelete="CASCADE"), nullable=False)
    id_variacao = Column(Integer, ForeignKey("camisetas_variacoes.id_variacao", ondelete="RESTRICT"), nullable=False)
    qtd_enviada = Column(Integer, nullable=False)
    qtd_retornada = Column(Integer, nullable=True)

    remessa = relationship("CamisetaCosturaFaccao", back_populates="itens")
    variacao = relationship("CamisetaVariacao")


class CamisetaPedidoItem(Base):
    """Um item do pedido: modelo + cor, com quantidades por tamanho."""
    __tablename__ = "camisetas_pedido_itens"

    id_item = Column(Integer, primary_key=True)
    id_pedido = Column(Integer, ForeignKey("camisetas_pedidos.id_pedido", ondelete="CASCADE"), nullable=False, index=True)
    id_modelo = Column(Integer, ForeignKey("camisetas_modelos.id_modelo", ondelete="RESTRICT"), nullable=False)
    id_cor = Column(Integer, ForeignKey("camisetas_cores.id_cor", ondelete="RESTRICT"), nullable=True)  # nulo = cor não informada

    pedido = relationship("CamisetaPedido", back_populates="itens")
    modelo = relationship("CamisetaModelo")
    cor = relationship("CamisetaCor")
    quantidades = relationship("CamisetaPedidoItemQtd", back_populates="item", cascade="all, delete-orphan")


class CamisetaPedidoItemQtd(Base):
    __tablename__ = "camisetas_pedido_item_qtds"

    id_item = Column(Integer, ForeignKey("camisetas_pedido_itens.id_item", ondelete="CASCADE"), primary_key=True)
    id_tamanho = Column(Integer, ForeignKey("camisetas_grade_tamanhos.id_tamanho", ondelete="RESTRICT"), primary_key=True)
    quantidade = Column(Integer, nullable=False)

    item = relationship("CamisetaPedidoItem", back_populates="quantidades")
    tamanho = relationship("CamisetaGradeTamanho")
```

Em `backend/app/models/camisetas.py`:
- `CamisetaOrdemProducao`, depois de `movimentacoes_costura`:
  ```python
      cores = relationship("CamisetaOpCor", back_populates="op", cascade="all, delete-orphan", order_by="CamisetaOpCor.id_op_cor")
      cortes = relationship("CamisetaOpCorte", back_populates="op", cascade="all, delete-orphan", order_by="CamisetaOpCorte.id_corte")
  ```
- `CamisetaCosturaFaccao`, depois de `op = ...`:
  ```python
      itens = relationship("CamisetaRemessaItem", back_populates="remessa", cascade="all, delete-orphan", order_by="CamisetaRemessaItem.id_item")
  ```
- `CamisetaPedido`, depois de `cliente = ...`:
  ```python
      itens = relationship("CamisetaPedidoItem", back_populates="pedido", cascade="all, delete-orphan", order_by="CamisetaPedidoItem.id_item")
  ```
- `CamisetaRegistroFinanceiro.mes_ano`: acrescentar `index=True` (o índice já existe no banco desde a migração 002; o modelo é que não o declarava).
- Última linha: `from app.models import camisetas_cadastros, camisetas_sku  # noqa: E402,F401`.

Em `backend/alembic/env.py:17`, acrescentar `camisetas_sku` ao fim do import de modelos.

- [ ] **Step 5: Migração 006**

`backend/alembic/versions/20261110_006_estoque_sku.py`:

```python
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
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_erros.py tests/test_migracoes.py -q`
Expected: PASS. Se `alembic check` ainda acusar diferença, ajustar o **modelo** ou a **migração 006** até bater (nunca editar as migrações 001–005).

Run: `cd backend && venv/bin/python -m pytest -q`
Expected: todos passam (nesta tarefa a remessa ainda responde as faltas de aviamento por `HTTPException`; a troca para `ErroNegocio` vem na Task 5).

- [ ] **Step 7: Commit**

```bash
git add backend/app/core/erros.py backend/app/main.py backend/app/models/camisetas_sku.py backend/app/models/camisetas.py \
  backend/alembic/env.py backend/alembic/versions/20261110_006_estoque_sku.py backend/tests/test_erros.py backend/tests/test_migracoes.py
git commit -m "feat: tabelas de estoque e produção por SKU (migração 006)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Serviço de SKU (variação e movimentação) e fábricas de teste

**Files:**
- Create: `backend/app/services/camisetas/sku.py`
- Modify: `backend/tests/fabricas.py`
- Test: `backend/tests/test_sku.py` (novo)

**Interfaces:**
- Consumes: modelos da Task 1; `obter_cor(db, id_cor)` de `services/camisetas/cores.py`.
- Produces (em `app.services.camisetas.sku`): constantes `INVENTARIO`, `AJUSTE`, `ENTRADA_PRODUCAO`, `SAIDA_ENTREGA`, `ESTORNO_ENTREGA`, `TIPOS_MOVIMENTO`; `obter_modelo(db, id_modelo) -> CamisetaModelo`; `tamanhos_do_modelo(modelo) -> list[CamisetaGradeTamanho]`; `tamanho_do_modelo(db, modelo, id_tamanho) -> CamisetaGradeTamanho`; `buscar_variacao(db, id_modelo, id_cor, id_tamanho) -> CamisetaVariacao | None`; `obter_ou_criar_variacao(db, modelo, id_cor, id_tamanho) -> CamisetaVariacao` (faz `flush`, não `commit`); `obter_variacao(db, id_variacao)`; `descrever_variacao(variacao) -> str` ("Modelo · Cor · Tamanho"); `movimentar(db, variacao, quantidade, tipo, motivo=None, id_pedido=None, id_costura=None) -> CamisetaMovimentoEstoque` (não faz commit).
- Produces (fábricas): `criar_grade(db, nome, rotulos)`, `criar_modelo(db, nome, consumo_kg, grade=None)` (sem `grade`, usa a grade padrão "Adulto (P, M, G, GG)"), `criar_modelo_com_grade(db, nome, rotulos)`, `tamanho(modelo, rotulo)`, `criar_variacao(db, modelo, cor, rotulo, saldo=0, minimo=0)`, `criar_insumo(..., cor=None)`, `criar_pedido_com_itens(db, modelo, cor, quantidades, codigo, status, data_entrega_realizada)`.

- [ ] **Step 1: Fábricas**

Em `backend/tests/fabricas.py`, acrescentar aos imports:

```python
from app.models.camisetas_cadastros import CamisetaCliente, CamisetaCor, CamisetaGrade, CamisetaGradeTamanho
from app.models.camisetas_sku import CamisetaPedidoItem, CamisetaPedidoItemQtd, CamisetaVariacao
from app.services.camisetas.grades import obter_grade_padrao
```

Substituir `criar_modelo` e `criar_insumo`, e acrescentar as novas:

```python
def criar_grade(db, nome="Adulto", rotulos=("P", "M", "G", "GG")):
    grade = CamisetaGrade(nome=nome, ativo=True)
    grade.tamanhos = [CamisetaGradeTamanho(rotulo=r, ordem=i) for i, r in enumerate(rotulos, start=1)]
    return _salvar(db, grade)


def criar_modelo(db, nome="Camiseta Básica", consumo_kg="0.1800", grade=None):
    grade = grade or obter_grade_padrao(db)
    return _salvar(db, CamisetaModelo(
        nome_modelo=nome, consumo_tecido_kg=Decimal(consumo_kg), id_grade=grade.id_grade,
        grade_disponivel=", ".join(t.rotulo for t in grade.tamanhos),
    ))


def criar_modelo_com_grade(db, nome="Camiseta Básica", rotulos=("P", "M", "G", "GG"), consumo_kg="0.1800"):
    return criar_modelo(db, nome=nome, consumo_kg=consumo_kg, grade=criar_grade(db, nome=f"Grade {nome}", rotulos=rotulos))


def tamanho(modelo, rotulo):
    return next(t for t in modelo.grade.tamanhos if t.rotulo == rotulo)


def criar_variacao(db, modelo, cor, rotulo, saldo=0, minimo=0):
    return _salvar(db, CamisetaVariacao(
        id_modelo=modelo.id_modelo, id_cor=cor.id_cor, id_tamanho=tamanho(modelo, rotulo).id_tamanho,
        saldo=saldo, estoque_minimo=minimo,
    ))


def criar_insumo(db, codigo="MALHA-01", categoria="ROLO_TECIDO", nome="Meia Malha 30.1",
                 unidade="kg", saldo="100.000", custo="40.00", minimo="10.000", cor=None):
    return _salvar(db, CamisetaInsumo(
        codigo=codigo,
        categoria=categoria,
        tipo_malha_ou_aviamento=nome,
        unidade_medida=unidade,
        saldo_atual=Decimal(saldo),
        estoque_minimo=Decimal(minimo),
        preco_custo_medio=Decimal(custo),
        id_cor=cor.id_cor if cor else None,
    ))


def criar_pedido_com_itens(db, modelo, cor, quantidades, codigo="PED-T-1", status="Aguardando Produção",
                           data_entrega_realizada=None):
    """Pedido com um item (modelo + cor) e quantidades por rótulo, ex.: {"P": 5, "M": 10}. `cor=None` = cor não informada."""
    pedido = CamisetaPedido(
        codigo_pedido=codigo, nome_cliente="Cliente Teste", id_modelo=modelo.id_modelo,
        grade_p=0, grade_m=0, grade_g=0, grade_gg=0, quantidade_total=sum(quantidades.values()),
        prazo_entrega=date.today() + timedelta(days=10), valor_total=Decimal("1000.00"),
        status_pedido=status, data_entrega_realizada=data_entrega_realizada,
    )
    pedido.itens = [CamisetaPedidoItem(
        id_modelo=modelo.id_modelo, id_cor=cor.id_cor if cor else None,
        quantidades=[CamisetaPedidoItemQtd(id_tamanho=tamanho(modelo, r).id_tamanho, quantidade=q) for r, q in quantidades.items()],
    )]
    return _salvar(db, pedido)
```

Run: `cd backend && venv/bin/python -m pytest -q`
Expected: PASS (o `criar_modelo` agora liga a grade padrão; se algum teste de grades contar grades, ajustar a expectativa do teste para incluir "Adulto (P, M, G, GG)").

- [ ] **Step 2: Testes que falham**

`backend/tests/test_sku.py`:

```python
import pytest

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo
from app.models.camisetas_sku import CamisetaMovimentoEstoque
from app.services.camisetas.sku import (
    ENTRADA_PRODUCAO,
    SAIDA_ENTREGA,
    descrever_variacao,
    movimentar,
    obter_ou_criar_variacao,
    tamanhos_do_modelo,
)
from tests.fabricas import criar_cor, criar_grade, criar_modelo, criar_variacao, tamanho


def test_obter_ou_criar_variacao_cria_uma_vez_so(db):
    modelo = criar_modelo(db)
    preto = criar_cor(db)
    primeira = obter_ou_criar_variacao(db, modelo, preto.id_cor, tamanho(modelo, "M").id_tamanho)
    segunda = obter_ou_criar_variacao(db, modelo, preto.id_cor, tamanho(modelo, "M").id_tamanho)
    assert primeira.id_variacao == segunda.id_variacao
    assert primeira.saldo == 0


def test_tamanho_de_outra_grade_e_recusado(db):
    modelo = criar_modelo(db)
    infantil = criar_grade(db, nome="Infantil", rotulos=("2", "4"))
    preto = criar_cor(db)
    with pytest.raises(ErroNegocio) as erro:
        obter_ou_criar_variacao(db, modelo, preto.id_cor, infantil.tamanhos[0].id_tamanho)
    assert erro.value.status_code == 400
    assert "O tamanho 2 não faz parte da grade do modelo Camiseta Básica" in erro.value.mensagem


def test_cor_inexistente_retorna_404(db):
    modelo = criar_modelo(db)
    with pytest.raises(ErroNegocio) as erro:
        obter_ou_criar_variacao(db, modelo, 999, tamanho(modelo, "P").id_tamanho)
    assert erro.value.status_code == 404


def test_modelo_sem_grade_e_recusado(db):
    modelo = CamisetaModelo(nome_modelo="Sem grade", consumo_tecido_kg=1)
    db.add(modelo)
    db.commit()
    with pytest.raises(ErroNegocio) as erro:
        tamanhos_do_modelo(modelo)
    assert "não tem grade" in erro.value.mensagem


def test_movimentar_soma_e_grava_o_saldo_depois(db):
    modelo = criar_modelo(db)
    variacao = criar_variacao(db, modelo, criar_cor(db), "M", saldo=5)
    movimento = movimentar(db, variacao, 10, ENTRADA_PRODUCAO, motivo="Retorno da facção")
    db.commit()
    assert variacao.saldo == 15
    assert (movimento.tipo, movimento.quantidade, movimento.saldo_apos, movimento.motivo) == (
        "ENTRADA_PRODUCAO", 10, 15, "Retorno da facção")


def test_movimentar_nunca_deixa_saldo_negativo(db):
    modelo = criar_modelo(db)
    variacao = criar_variacao(db, modelo, criar_cor(db), "M", saldo=3)
    with pytest.raises(ErroNegocio) as erro:
        movimentar(db, variacao, -4, SAIDA_ENTREGA)
    assert erro.value.status_code == 400
    assert "Camiseta Básica · Preto · M" in erro.value.mensagem
    assert variacao.saldo == 3
    assert db.query(CamisetaMovimentoEstoque).count() == 0


def test_movimentar_recusa_tipo_desconhecido_e_quantidade_zero(db):
    modelo = criar_modelo(db)
    variacao = criar_variacao(db, modelo, criar_cor(db), "M")
    with pytest.raises(ValueError):
        movimentar(db, variacao, 1, "QUALQUER")
    with pytest.raises(ValueError):
        movimentar(db, variacao, 0, ENTRADA_PRODUCAO)


def test_descrever_variacao(db):
    modelo = criar_modelo(db)
    assert descrever_variacao(criar_variacao(db, modelo, criar_cor(db), "GG")) == "Camiseta Básica · Preto · GG"
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_sku.py -q`
Expected: FAIL — `ModuleNotFoundError: app.services.camisetas.sku`.

- [ ] **Step 4: Implementar**

`backend/app/services/camisetas/sku.py`:

```python
# app/services/camisetas/sku.py
"""SKU (modelo + cor + tamanho): criação e a única porta de entrada para mudar o saldo de peças prontas."""
from typing import Optional

from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo, get_utc_now
from app.models.camisetas_cadastros import CamisetaGradeTamanho
from app.models.camisetas_sku import CamisetaMovimentoEstoque, CamisetaVariacao
from app.services.camisetas.cores import obter_cor

INVENTARIO = "INVENTARIO"
AJUSTE = "AJUSTE"
ENTRADA_PRODUCAO = "ENTRADA_PRODUCAO"
SAIDA_ENTREGA = "SAIDA_ENTREGA"
ESTORNO_ENTREGA = "ESTORNO_ENTREGA"
TIPOS_MOVIMENTO = (INVENTARIO, AJUSTE, ENTRADA_PRODUCAO, SAIDA_ENTREGA, ESTORNO_ENTREGA)


def obter_modelo(db: Session, id_modelo: int) -> CamisetaModelo:
    modelo = db.get(CamisetaModelo, id_modelo)
    if modelo is None:
        raise ErroNegocio(404, "Modelo não encontrado.")
    return modelo


def tamanhos_do_modelo(modelo: CamisetaModelo) -> list[CamisetaGradeTamanho]:
    if modelo.grade is None:
        raise ErroNegocio(400, f"O modelo {modelo.nome_modelo} não tem grade de tamanhos; defina uma na Ficha Técnica.")
    return sorted(modelo.grade.tamanhos, key=lambda t: t.ordem)


def tamanho_do_modelo(db: Session, modelo: CamisetaModelo, id_tamanho: int) -> CamisetaGradeTamanho:
    tamanho = next((t for t in tamanhos_do_modelo(modelo) if t.id_tamanho == id_tamanho), None)
    if tamanho is None:
        desconhecido = db.get(CamisetaGradeTamanho, id_tamanho)
        rotulo = desconhecido.rotulo if desconhecido else f"nº {id_tamanho}"
        raise ErroNegocio(400, f"O tamanho {rotulo} não faz parte da grade do modelo {modelo.nome_modelo}.")
    return tamanho


def buscar_variacao(db: Session, id_modelo: int, id_cor: int, id_tamanho: int) -> Optional[CamisetaVariacao]:
    return db.query(CamisetaVariacao).filter_by(id_modelo=id_modelo, id_cor=id_cor, id_tamanho=id_tamanho).first()


def obter_ou_criar_variacao(db: Session, modelo: CamisetaModelo, id_cor: int, id_tamanho: int) -> CamisetaVariacao:
    """Valida o tamanho (grade do modelo) e a cor; cria o SKU com saldo zero se ainda não existir. Não faz commit."""
    tamanho_do_modelo(db, modelo, id_tamanho)
    existente = buscar_variacao(db, modelo.id_modelo, id_cor, id_tamanho)
    if existente is not None:
        return existente
    obter_cor(db, id_cor)
    variacao = CamisetaVariacao(id_modelo=modelo.id_modelo, id_cor=id_cor, id_tamanho=id_tamanho, saldo=0, estoque_minimo=0)
    db.add(variacao)
    db.flush()
    return variacao


def obter_variacao(db: Session, id_variacao: int) -> CamisetaVariacao:
    variacao = db.get(CamisetaVariacao, id_variacao)
    if variacao is None:
        raise ErroNegocio(404, "Item de estoque não encontrado.")
    return variacao


def descrever_variacao(variacao: CamisetaVariacao) -> str:
    return f"{variacao.modelo.nome_modelo} · {variacao.cor.nome} · {variacao.tamanho.rotulo}"


def movimentar(db: Session, variacao: CamisetaVariacao, quantidade: int, tipo: str, motivo: Optional[str] = None,
               id_pedido: Optional[int] = None, id_costura: Optional[int] = None) -> CamisetaMovimentoEstoque:
    """Única forma de alterar o saldo: soma a quantidade (com sinal) e grava o movimento. Não faz commit."""
    if tipo not in TIPOS_MOVIMENTO:
        raise ValueError(f"Tipo de movimento desconhecido: {tipo}")
    if quantidade == 0:
        raise ValueError("Movimento com quantidade zero.")
    saldo_atual = variacao.saldo or 0
    novo_saldo = saldo_atual + quantidade
    if novo_saldo < 0:
        raise ErroNegocio(
            400,
            f"Saldo insuficiente de {descrever_variacao(variacao)}: há {saldo_atual} peça(s) e a operação tira {-quantidade}.",
        )
    variacao.saldo = novo_saldo
    movimento = CamisetaMovimentoEstoque(
        id_variacao=variacao.id_variacao, tipo=tipo, quantidade=quantidade, saldo_apos=novo_saldo,
        motivo=motivo, id_pedido=id_pedido, id_costura=id_costura, criado_em=get_utc_now(),
    )
    db.add(movimento)
    return movimento
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_sku.py -q && venv/bin/python -m pytest -q`
Expected: PASS em tudo.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/camisetas/sku.py backend/tests/fabricas.py backend/tests/test_sku.py
git commit -m "feat: serviço de SKU com movimentação de estoque" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Produtos Prontos (listagem, inventário, ajuste, mínimo, histórico)

**Files:**
- Create: `backend/app/schemas/camisetas_sku.py`, `backend/app/services/camisetas/produtos_prontos.py`, `backend/app/routers/camisetas/produtos_prontos.py`
- Modify: `backend/app/routers/camisetas/__init__.py`, `backend/tests/test_rotas_camisetas.py`
- Test: `backend/tests/test_produtos_prontos.py` (novo)

**Interfaces:**
- Consumes: tudo de `app.services.camisetas.sku` (Task 2).
- Produces: schemas `TamanhoResponse`, `CelulaSku`, `LinhaProdutoPronto`, `ContagemInventario`, `InventarioEntrada`, `InventarioResultado`, `AjusteEntrada`, `MinimoEntrada`, `VariacaoResponse`, `MovimentoResponse`; serviço `listar_produtos_prontos(db, id_modelo=None, id_cor=None, abaixo_minimo=False)`, `registrar_inventario(db, dados) -> InventarioResultado`, `registrar_ajuste(db, dados) -> VariacaoResponse`, `definir_minimo(db, id_variacao, estoque_minimo) -> VariacaoResponse`, `listar_movimentos(db, id_variacao=None, id_modelo=None, tipo=None, limite=100)`, `MOTIVO_INVENTARIO_PADRAO = "Inventário de abertura"`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_produtos_prontos.py`:

```python
from app.models.camisetas_sku import CamisetaMovimentoEstoque, CamisetaVariacao
from app.services.camisetas.sku import AJUSTE, INVENTARIO, movimentar
from tests.fabricas import criar_cor, criar_modelo, criar_variacao, tamanho

URL = "/camisetas/produtos-prontos"


def _contagem(modelo, cor, rotulo, quantidade):
    return {"id_modelo": modelo.id_modelo, "id_cor": cor.id_cor,
            "id_tamanho": tamanho(modelo, rotulo).id_tamanho, "quantidade_contada": quantidade}


def test_inventario_lanca_so_as_diferencas(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    criar_variacao(db, modelo, preto, "P", saldo=5)
    resposta = client.post(f"{URL}/inventario", json={"contagens": [
        _contagem(modelo, preto, "P", 5), _contagem(modelo, preto, "M", 12), _contagem(modelo, preto, "G", 0),
    ]})
    assert resposta.status_code == 200
    assert resposta.json() == {"skus_alterados": 1, "pecas_entrada": 12, "pecas_saida": 0}
    movimentos = db.query(CamisetaMovimentoEstoque).all()
    assert [(m.tipo, m.quantidade, m.saldo_apos, m.motivo) for m in movimentos] == [
        ("INVENTARIO", 12, 12, "Inventário de abertura")]
    assert db.query(CamisetaVariacao).count() == 2  # o G contado como zero não cria SKU


def test_inventario_reduz_quando_a_contagem_e_menor(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "M", saldo=10)
    resposta = client.post(f"{URL}/inventario", json={"motivo": "Contagem de novembro",
                                                     "contagens": [_contagem(modelo, preto, "M", 7)]})
    assert resposta.json() == {"skus_alterados": 1, "pecas_entrada": 0, "pecas_saida": 3}
    db.refresh(variacao)
    assert variacao.saldo == 7
    assert db.query(CamisetaMovimentoEstoque).one().motivo == "Contagem de novembro"


def test_inventario_com_contagem_repetida_retorna_400_e_nao_lanca(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    resposta = client.post(f"{URL}/inventario", json={"contagens": [
        _contagem(modelo, preto, "M", 3), _contagem(modelo, preto, "M", 4)]})
    assert resposta.status_code == 400
    assert db.query(CamisetaMovimentoEstoque).count() == 0


def test_listagem_agrupa_por_modelo_e_cor_com_todos_os_tamanhos(client, db):
    modelo, preto, branco = criar_modelo(db), criar_cor(db), criar_cor(db, "Branco", "#FFFFFF")
    criar_variacao(db, modelo, preto, "M", saldo=4)
    criar_variacao(db, modelo, branco, "G", saldo=2, minimo=5)
    linhas = client.get(f"{URL}/").json()
    assert [(l["nome_cor"], l["total"]) for l in linhas] == [("Branco", 2), ("Preto", 4)]
    assert [c["rotulo"] for c in linhas[0]["tamanhos"]] == ["P", "M", "G", "GG"]
    g_branco = linhas[0]["tamanhos"][2]
    assert (g_branco["saldo"], g_branco["estoque_minimo"], g_branco["abaixo_minimo"]) == (2, 5, True)
    assert linhas[1]["tamanhos"][0]["id_variacao"] is None


def test_filtro_abaixo_do_minimo(client, db):
    modelo, preto, branco = criar_modelo(db), criar_cor(db), criar_cor(db, "Branco", "#FFFFFF")
    criar_variacao(db, modelo, preto, "M", saldo=4)
    criar_variacao(db, modelo, branco, "G", saldo=2, minimo=5)
    linhas = client.get(f"{URL}/", params={"abaixo_minimo": True}).json()
    assert [l["nome_cor"] for l in linhas] == ["Branco"]


def test_ajuste_com_motivo(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "M", saldo=3)
    ok = client.post(f"{URL}/ajustes", json={"id_variacao": variacao.id_variacao, "quantidade": -2, "motivo": "Peça manchada"})
    assert ok.status_code == 200
    assert ok.json()["saldo"] == 1
    assert client.post(f"{URL}/ajustes", json={"id_variacao": variacao.id_variacao, "quantidade": -5,
                                               "motivo": "Perda"}).status_code == 400
    assert client.post(f"{URL}/ajustes", json={"id_variacao": variacao.id_variacao, "quantidade": 0,
                                               "motivo": "Nada"}).status_code == 400
    assert client.post(f"{URL}/ajustes", json={"id_variacao": variacao.id_variacao, "quantidade": 1,
                                               "motivo": "ab"}).status_code == 422


def test_definir_estoque_minimo(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "M")
    resposta = client.put(f"{URL}/variacoes/{variacao.id_variacao}/minimo", json={"estoque_minimo": 8})
    assert resposta.status_code == 200
    assert resposta.json()["estoque_minimo"] == 8
    assert client.put(f"{URL}/variacoes/{variacao.id_variacao}/minimo", json={"estoque_minimo": -1}).status_code == 422
    assert client.put(f"{URL}/variacoes/999/minimo", json={"estoque_minimo": 1}).status_code == 404


def test_historico_mais_recente_primeiro_e_filtros(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "M")
    movimentar(db, variacao, 10, INVENTARIO, motivo="Inventário de abertura")
    movimentar(db, variacao, -2, AJUSTE, motivo="Perda")
    db.commit()
    lista = client.get(f"{URL}/movimentos/", params={"id_variacao": variacao.id_variacao}).json()
    assert [(m["tipo"], m["quantidade"], m["saldo_apos"]) for m in lista] == [("AJUSTE", -2, 8), ("INVENTARIO", 10, 10)]
    assert lista[0]["sku"] == "Camiseta Básica · Preto · M"
    assert len(client.get(f"{URL}/movimentos/", params={"tipo": "AJUSTE"}).json()) == 1
    assert len(client.get(f"{URL}/movimentos/", params={"id_modelo": modelo.id_modelo}).json()) == 2
    assert client.get(f"{URL}/movimentos/", params={"tipo": "XPTO"}).status_code == 400
```

Em `backend/tests/test_rotas_camisetas.py`, acrescentar a `ROTAS_ESPERADAS`:

```python
    ("GET", "/camisetas/produtos-prontos/"),
    ("POST", "/camisetas/produtos-prontos/inventario"),
    ("POST", "/camisetas/produtos-prontos/ajustes"),
    ("PUT", "/camisetas/produtos-prontos/variacoes/{id_variacao}/minimo"),
    ("GET", "/camisetas/produtos-prontos/movimentos/"),
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_produtos_prontos.py tests/test_rotas_camisetas.py -q`
Expected: FAIL — rotas inexistentes (404) e conjunto de rotas diferente.

- [ ] **Step 3: Schemas**

`backend/app/schemas/camisetas_sku.py`:

```python
# app/schemas/camisetas_sku.py
"""Schemas de SKU, Produtos Prontos e itens por cor e tamanho (OP, remessa e pedido)."""
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class TamanhoResponse(BaseModel):
    id_tamanho: int
    rotulo: str


class CelulaSku(BaseModel):
    id_tamanho: int
    rotulo: str
    id_variacao: Optional[int] = None  # nulo = ainda não há SKU (saldo zero)
    saldo: int = 0
    estoque_minimo: int = 0
    abaixo_minimo: bool = False


class LinhaProdutoPronto(BaseModel):
    id_modelo: int
    nome_modelo: str
    id_cor: int
    nome_cor: str
    hex_cor: str
    tamanhos: List[CelulaSku]
    total: int


class ContagemInventario(BaseModel):
    id_modelo: int
    id_cor: int
    id_tamanho: int
    quantidade_contada: int = Field(..., ge=0)


class InventarioEntrada(BaseModel):
    motivo: Optional[str] = Field(None, max_length=255)
    contagens: List[ContagemInventario] = Field(..., min_length=1)


class InventarioResultado(BaseModel):
    skus_alterados: int
    pecas_entrada: int
    pecas_saida: int


class AjusteEntrada(BaseModel):
    id_variacao: int
    quantidade: int
    motivo: str = Field(..., min_length=3, max_length=255)


class MinimoEntrada(BaseModel):
    estoque_minimo: int = Field(..., ge=0)


class VariacaoResponse(BaseModel):
    id_variacao: int
    id_modelo: int
    id_cor: int
    id_tamanho: int
    sku: str
    saldo: int
    estoque_minimo: int


class MovimentoResponse(BaseModel):
    id_movimento: int
    id_variacao: int
    sku: str
    tipo: str
    quantidade: int
    saldo_apos: int
    motivo: Optional[str] = None
    referencia: Optional[str] = None  # código do pedido ou da OP da remessa
    criado_em: Optional[datetime] = None
```

- [ ] **Step 4: Serviço**

`backend/app/services/camisetas/produtos_prontos.py`:

```python
# app/services/camisetas/produtos_prontos.py
"""Produtos Prontos: saldos por modelo × cor × tamanho, inventário, ajuste, estoque mínimo e histórico."""
from typing import Optional

from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas_sku import CamisetaMovimentoEstoque, CamisetaVariacao
from app.schemas.camisetas_sku import (
    AjusteEntrada,
    CelulaSku,
    InventarioEntrada,
    InventarioResultado,
    LinhaProdutoPronto,
    MovimentoResponse,
    VariacaoResponse,
)
from app.services.camisetas.cores import obter_cor
from app.services.camisetas.sku import (
    AJUSTE,
    INVENTARIO,
    TIPOS_MOVIMENTO,
    buscar_variacao,
    descrever_variacao,
    movimentar,
    obter_modelo,
    obter_ou_criar_variacao,
    obter_variacao,
    tamanho_do_modelo,
    tamanhos_do_modelo,
)

MOTIVO_INVENTARIO_PADRAO = "Inventário de abertura"
LIMITE_MOVIMENTOS = 100


def esta_abaixo_do_minimo(variacao: CamisetaVariacao) -> bool:
    return variacao.estoque_minimo > 0 and variacao.saldo < variacao.estoque_minimo


def _celula(tamanho, variacao: Optional[CamisetaVariacao]) -> CelulaSku:
    if variacao is None:
        return CelulaSku(id_tamanho=tamanho.id_tamanho, rotulo=tamanho.rotulo)
    return CelulaSku(
        id_tamanho=tamanho.id_tamanho, rotulo=tamanho.rotulo, id_variacao=variacao.id_variacao,
        saldo=variacao.saldo, estoque_minimo=variacao.estoque_minimo, abaixo_minimo=esta_abaixo_do_minimo(variacao),
    )


def _montar_linha(variacoes: list[CamisetaVariacao]) -> LinhaProdutoPronto:
    modelo, cor = variacoes[0].modelo, variacoes[0].cor
    por_tamanho = {v.id_tamanho: v for v in variacoes}
    celulas = [_celula(t, por_tamanho.get(t.id_tamanho)) for t in tamanhos_do_modelo(modelo)]
    return LinhaProdutoPronto(
        id_modelo=modelo.id_modelo, nome_modelo=modelo.nome_modelo, id_cor=cor.id_cor, nome_cor=cor.nome,
        hex_cor=cor.hex, tamanhos=celulas, total=sum(c.saldo for c in celulas),
    )


def listar_produtos_prontos(db: Session, id_modelo: Optional[int] = None, id_cor: Optional[int] = None,
                            abaixo_minimo: bool = False) -> list[LinhaProdutoPronto]:
    consulta = db.query(CamisetaVariacao)
    if id_modelo is not None:
        consulta = consulta.filter(CamisetaVariacao.id_modelo == id_modelo)
    if id_cor is not None:
        consulta = consulta.filter(CamisetaVariacao.id_cor == id_cor)
    grupos: dict[tuple[int, int], list[CamisetaVariacao]] = {}
    for variacao in consulta.all():
        grupos.setdefault((variacao.id_modelo, variacao.id_cor), []).append(variacao)
    linhas = [_montar_linha(variacoes) for variacoes in grupos.values()]
    if abaixo_minimo:
        linhas = [linha for linha in linhas if any(c.abaixo_minimo for c in linha.tamanhos)]
    return sorted(linhas, key=lambda l: (l.nome_modelo.casefold(), l.nome_cor.casefold()))


def _validar_contagens(db: Session, dados: InventarioEntrada) -> list:
    """Confere tudo antes de lançar qualquer coisa (modelo, cor, tamanho e repetição)."""
    vistas = set()
    validadas = []
    for contagem in dados.contagens:
        chave = (contagem.id_modelo, contagem.id_cor, contagem.id_tamanho)
        if chave in vistas:
            raise ErroNegocio(400, "A mesma cor e tamanho aparece duas vezes na contagem.")
        vistas.add(chave)
        modelo = obter_modelo(db, contagem.id_modelo)
        tamanho_do_modelo(db, modelo, contagem.id_tamanho)
        obter_cor(db, contagem.id_cor)
        validadas.append((modelo, contagem))
    return validadas


def registrar_inventario(db: Session, dados: InventarioEntrada) -> InventarioResultado:
    motivo = " ".join((dados.motivo or "").split()) or MOTIVO_INVENTARIO_PADRAO
    entradas = saidas = alterados = 0
    for modelo, contagem in _validar_contagens(db, dados):
        existente = buscar_variacao(db, contagem.id_modelo, contagem.id_cor, contagem.id_tamanho)
        if existente is None and contagem.quantidade_contada == 0:
            continue
        variacao = existente or obter_ou_criar_variacao(db, modelo, contagem.id_cor, contagem.id_tamanho)
        diferenca = contagem.quantidade_contada - variacao.saldo
        if diferenca == 0:
            continue
        movimentar(db, variacao, diferenca, INVENTARIO, motivo=motivo)
        alterados += 1
        entradas += max(diferenca, 0)
        saidas += max(-diferenca, 0)
    db.commit()
    return InventarioResultado(skus_alterados=alterados, pecas_entrada=entradas, pecas_saida=saidas)


def resposta_da_variacao(variacao: CamisetaVariacao) -> VariacaoResponse:
    return VariacaoResponse(
        id_variacao=variacao.id_variacao, id_modelo=variacao.id_modelo, id_cor=variacao.id_cor,
        id_tamanho=variacao.id_tamanho, sku=descrever_variacao(variacao), saldo=variacao.saldo,
        estoque_minimo=variacao.estoque_minimo,
    )


def registrar_ajuste(db: Session, dados: AjusteEntrada) -> VariacaoResponse:
    if dados.quantidade == 0:
        raise ErroNegocio(400, "Informe quanto entra (+) ou sai (−); zero não muda o estoque.")
    motivo = " ".join(dados.motivo.split())
    if len(motivo) < 3:
        raise ErroNegocio(400, "Explique o motivo do ajuste (pelo menos 3 letras).")
    variacao = obter_variacao(db, dados.id_variacao)
    movimentar(db, variacao, dados.quantidade, AJUSTE, motivo=motivo)
    db.commit()
    return resposta_da_variacao(variacao)


def definir_minimo(db: Session, id_variacao: int, estoque_minimo: int) -> VariacaoResponse:
    variacao = obter_variacao(db, id_variacao)
    variacao.estoque_minimo = estoque_minimo
    db.commit()
    return resposta_da_variacao(variacao)


def _referencia(movimento: CamisetaMovimentoEstoque) -> Optional[str]:
    if movimento.pedido is not None:
        return movimento.pedido.codigo_pedido
    if movimento.remessa is not None and movimento.remessa.op is not None:
        return movimento.remessa.op.codigo_op
    return None


def listar_movimentos(db: Session, id_variacao: Optional[int] = None, id_modelo: Optional[int] = None,
                      tipo: Optional[str] = None, limite: int = LIMITE_MOVIMENTOS) -> list[MovimentoResponse]:
    if tipo is not None and tipo not in TIPOS_MOVIMENTO:
        raise ErroNegocio(400, f"Tipo de movimento inválido: {tipo}. Use um destes: {', '.join(TIPOS_MOVIMENTO)}.")
    consulta = db.query(CamisetaMovimentoEstoque)
    if id_variacao is not None:
        consulta = consulta.filter(CamisetaMovimentoEstoque.id_variacao == id_variacao)
    if id_modelo is not None:
        consulta = consulta.join(CamisetaVariacao).filter(CamisetaVariacao.id_modelo == id_modelo)
    if tipo is not None:
        consulta = consulta.filter(CamisetaMovimentoEstoque.tipo == tipo)
    movimentos = consulta.order_by(CamisetaMovimentoEstoque.id_movimento.desc()).limit(limite).all()
    return [
        MovimentoResponse(
            id_movimento=m.id_movimento, id_variacao=m.id_variacao, sku=descrever_variacao(m.variacao), tipo=m.tipo,
            quantidade=m.quantidade, saldo_apos=m.saldo_apos, motivo=m.motivo, referencia=_referencia(m),
            criado_em=m.criado_em,
        )
        for m in movimentos
    ]
```

- [ ] **Step 5: Router e registro**

`backend/app/routers/camisetas/produtos_prontos.py`:

```python
# app/routers/camisetas/produtos_prontos.py
"""Produtos Prontos: estoque de peças acabadas por modelo, cor e tamanho."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas_sku import (
    AjusteEntrada,
    InventarioEntrada,
    InventarioResultado,
    LinhaProdutoPronto,
    MinimoEntrada,
    MovimentoResponse,
    VariacaoResponse,
)
from app.services.camisetas import produtos_prontos as servico

router = APIRouter()


@router.get("/produtos-prontos/", response_model=List[LinhaProdutoPronto])
def listar_produtos_prontos(id_modelo: Optional[int] = None, id_cor: Optional[int] = None,
                            abaixo_minimo: bool = False, db: Session = Depends(get_db)):
    return servico.listar_produtos_prontos(db, id_modelo, id_cor, abaixo_minimo)


@router.post("/produtos-prontos/inventario", response_model=InventarioResultado)
def registrar_inventario(dados: InventarioEntrada, db: Session = Depends(get_db)):
    return servico.registrar_inventario(db, dados)


@router.post("/produtos-prontos/ajustes", response_model=VariacaoResponse)
def registrar_ajuste(dados: AjusteEntrada, db: Session = Depends(get_db)):
    return servico.registrar_ajuste(db, dados)


@router.put("/produtos-prontos/variacoes/{id_variacao}/minimo", response_model=VariacaoResponse)
def definir_minimo(id_variacao: int, dados: MinimoEntrada, db: Session = Depends(get_db)):
    return servico.definir_minimo(db, id_variacao, dados.estoque_minimo)


@router.get("/produtos-prontos/movimentos/", response_model=List[MovimentoResponse])
def listar_movimentos(id_variacao: Optional[int] = None, id_modelo: Optional[int] = None, tipo: Optional[str] = None,
                      limite: int = Query(servico.LIMITE_MOVIMENTOS, ge=1, le=500), db: Session = Depends(get_db)):
    return servico.listar_movimentos(db, id_variacao, id_modelo, tipo, limite)
```

Em `backend/app/routers/camisetas/__init__.py`: importar `produtos_prontos` e incluí-lo na tupla, depois de `pedidos`.

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_produtos_prontos.py tests/test_rotas_camisetas.py -q && venv/bin/python -m pytest -q`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/camisetas_sku.py backend/app/services/camisetas/produtos_prontos.py \
  backend/app/routers/camisetas/produtos_prontos.py backend/app/routers/camisetas/__init__.py \
  backend/tests/test_produtos_prontos.py backend/tests/test_rotas_camisetas.py
git commit -m "feat: produtos prontos com inventário, ajuste, mínimo e histórico" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: OP com várias cores e corte por cor × tamanho

**Files:**
- Modify: `backend/app/schemas/camisetas_sku.py`, `backend/app/schemas/camisetas.py:159-185`
- Create: `backend/app/services/camisetas/ordens.py`
- Modify: `backend/app/services/camisetas/costura.py` (duas funções de apoio), `backend/app/routers/camisetas/ordens.py` (reescrito, fino)
- Test: `backend/tests/test_ordens_sku.py` (novo), `backend/tests/test_sequencias.py:56-64`

**Interfaces:**
- Consumes: `obter_modelo`, `tamanhos_do_modelo`, `tamanho_do_modelo`, `obter_ou_criar_variacao` (Task 2); `obter_cor`.
- Produces: schemas `OpCorEntrada{id_cor, id_insumo_tecido, peso_kg>0}`, `CorteEntrada{id_cor, id_tamanho, quantidade>=0}`, `OpCorResponse`, `OpCorteResponse{id_variacao, id_cor, nome_cor, id_tamanho, rotulo, cortado, enviado, disponivel}`; `CamisetaOrdemProducaoCreate.cores`, `CamisetaOrdemProducaoFinalizarCorte.cortes`; `CamisetaOrdemProducaoResponse.legada/cores/cortes/tamanhos`. Serviço `abrir_op(db, dados)`, `registrar_corte(db, id_op, dados)`, `montar_resposta_op(op)`, `rendimento(pecas, peso) -> Decimal | None`. Em `services/camisetas/costura.py`: `total_enviado(op) -> int`, `quantidades_enviadas_por_sku(op) -> dict[int, int]`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_ordens_sku.py`:

```python
from decimal import Decimal

from app.models.camisetas import CamisetaOrdemProducao
from app.models.camisetas_sku import CamisetaOpCorte
from tests.fabricas import criar_cor, criar_grade, criar_insumo, criar_modelo, criar_op_cortada, criar_remessa, tamanho

URL = "/camisetas/ordens/"


def _cenario(db):
    modelo = criar_modelo(db)
    preto, branco = criar_cor(db), criar_cor(db, "Branco", "#FFFFFF")
    malha_preta = criar_insumo(db, codigo="MALHA-PRETA", saldo="30.000", cor=preto)
    malha_branca = criar_insumo(db, codigo="MALHA-BRANCA", saldo="20.000", cor=branco)
    return modelo, preto, branco, malha_preta, malha_branca


def _linha(cor, rolo, peso):
    return {"id_cor": cor.id_cor, "id_insumo_tecido": rolo.id_insumo, "peso_kg": peso}


def _abrir_duas_cores(client, db):
    modelo, preto, branco, mp, mb = _cenario(db)
    op = client.post(URL, json={"id_modelo": modelo.id_modelo, "cores": [
        _linha(preto, mp, "10.000"), _linha(branco, mb, "8.000")]}).json()
    return modelo, preto, branco, op


def _corte(cor, modelo, rotulo, quantidade):
    return {"id_cor": cor.id_cor, "id_tamanho": tamanho(modelo, rotulo).id_tamanho, "quantidade": quantidade}


def test_op_com_duas_cores_baixa_os_dois_rolos(client, db):
    modelo, preto, branco, mp, mb = _cenario(db)
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "cores": [
        _linha(preto, mp, "10.000"), _linha(branco, mb, "8.000")]})
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["legada"] is False
    assert Decimal(corpo["peso_malha_enviado_kg"]) == Decimal("18.000")
    assert corpo["pecas_planejadas"] == 100
    assert [c["nome_cor"] for c in corpo["cores"]] == ["Preto", "Branco"]
    assert [t["rotulo"] for t in corpo["tamanhos"]] == ["P", "M", "G", "GG"]
    db.refresh(mp)
    db.refresh(mb)
    assert (mp.saldo_atual, mb.saldo_atual) == (Decimal("20.000"), Decimal("12.000"))


def test_rolo_sem_saldo_recusa_e_nao_baixa(client, db):
    modelo, preto, _, mp, _ = _cenario(db)
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "cores": [_linha(preto, mp, "31.000")]})
    assert resposta.status_code == 400
    assert "MALHA-PRETA" in resposta.json()["detail"]
    db.refresh(mp)
    assert mp.saldo_atual == Decimal("30.000")


def test_cor_repetida_no_enfesto_retorna_400(client, db):
    modelo, preto, _, mp, _ = _cenario(db)
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "cores": [
        _linha(preto, mp, "5.000"), _linha(preto, mp, "5.000")]})
    assert resposta.status_code == 400


def test_corpo_antigo_usa_a_cor_ligada_ao_rolo(client, db):
    modelo, _, _, mp, _ = _cenario(db)
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "id_insumo_tecido": mp.id_insumo,
                                      "peso_malha_enviado_kg": "9.000"})
    assert resposta.status_code == 201
    assert resposta.json()["cores"][0]["nome_cor"] == "Preto"


def test_corpo_antigo_com_rolo_sem_cor_pede_a_cor(client, db):
    modelo = criar_modelo(db)
    rolo = criar_insumo(db, codigo="MALHA-X")
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "id_insumo_tecido": rolo.id_insumo,
                                      "peso_malha_enviado_kg": "9.000"})
    assert resposta.status_code == 400
    assert "Informe a cor" in resposta.json()["detail"]


def test_corte_por_sku_grava_linhas_e_rendimentos(client, db):
    modelo, preto, branco, op = _abrir_duas_cores(client, db)
    resposta = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [
        _corte(preto, modelo, "P", 20), _corte(preto, modelo, "M", 35),
        _corte(branco, modelo, "M", 44), _corte(branco, modelo, "G", 0)]})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["pecas_reais_cortadas"] == 99
    assert Decimal(corpo["rendimento_real_pecas_kg"]) == Decimal("5.50")
    por_cor = {c["nome_cor"]: c for c in corpo["cores"]}
    assert (por_cor["Preto"]["pecas_cortadas"], Decimal(por_cor["Preto"]["rendimento"])) == (55, Decimal("5.50"))
    assert (por_cor["Branco"]["pecas_cortadas"], Decimal(por_cor["Branco"]["rendimento"])) == (44, Decimal("5.50"))
    assert [(c["nome_cor"], c["rotulo"], c["cortado"], c["disponivel"]) for c in corpo["cortes"]] == [
        ("Branco", "M", 44, 44), ("Preto", "P", 20, 20), ("Preto", "M", 35, 35)]


def test_corte_com_cor_fora_da_op_ou_tamanho_fora_da_grade_retorna_400(client, db):
    modelo, preto, _, op = _abrir_duas_cores(client, db)
    azul = criar_cor(db, "Azul", "#0000FF")
    infantil = criar_grade(db, nome="Infantil", rotulos=("2",))
    cor_fora = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [_corte(azul, modelo, "P", 5)]})
    tamanho_fora = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [
        {"id_cor": preto.id_cor, "id_tamanho": infantil.tamanhos[0].id_tamanho, "quantidade": 5}]})
    assert (cor_fora.status_code, tamanho_fora.status_code) == (400, 400)


def test_corte_vazio_retorna_400(client, db):
    modelo, preto, _, op = _abrir_duas_cores(client, db)
    resposta = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [_corte(preto, modelo, "P", 0)]})
    assert resposta.status_code == 400


def test_refazer_corte_antes_do_envio_substitui_e_depois_do_envio_e_409(client, db):
    modelo, preto, _, op = _abrir_duas_cores(client, db)
    client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [_corte(preto, modelo, "P", 20)]})
    refeito = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [
        _corte(preto, modelo, "P", 18), _corte(preto, modelo, "M", 4)]})
    assert refeito.status_code == 200
    assert refeito.json()["pecas_reais_cortadas"] == 22
    assert db.query(CamisetaOpCorte).count() == 2
    criar_remessa(db, db.get(CamisetaOrdemProducao, op["id_op"]), quantidade=5)
    depois_do_envio = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [_corte(preto, modelo, "P", 1)]})
    assert depois_do_envio.status_code == 409


def test_op_legada_aceita_o_corpo_antigo(client, db):
    modelo = criar_modelo(db)
    op = criar_op_cortada(db, modelo, pecas=100, peso="20.000")
    resposta = client.put(f"{URL}{op.id_op}/finalizar-corte", json={"pecas_reais_cortadas": 120})
    assert resposta.status_code == 200
    assert resposta.json()["legada"] is True
    assert Decimal(resposta.json()["rendimento_real_pecas_kg"]) == Decimal("6.00")
```

Em `backend/tests/test_sequencias.py`, trocar o corpo de `test_api_gera_codigo_da_op` (importar `criar_cor`):

```python
def test_api_gera_codigo_da_op(client, db):
    modelo = criar_modelo(db)
    preto = criar_cor(db)
    tecido = criar_insumo(db, saldo="50.000", cor=preto)
    resposta = client.post("/camisetas/ordens/", json={
        "id_modelo": modelo.id_modelo,
        "cores": [{"id_cor": preto.id_cor, "id_insumo_tecido": tecido.id_insumo, "peso_kg": "10.000"}],
    })
    assert resposta.status_code == 201
    assert re.fullmatch(r"OP-\d{4}-0001", resposta.json()["codigo_op"])
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_ordens_sku.py tests/test_sequencias.py -q`
Expected: FAIL — resposta sem `legada`/`cores`; corpo com `cores` ignorado (422 por `peso_malha_enviado_kg` obrigatório).

- [ ] **Step 3: Schemas**

Acrescentar a `backend/app/schemas/camisetas_sku.py`:

```python
class OpCorEntrada(BaseModel):
    id_cor: int
    id_insumo_tecido: int
    peso_kg: Decimal = Field(..., gt=0)


class CorteEntrada(BaseModel):
    id_cor: int
    id_tamanho: int
    quantidade: int = Field(..., ge=0)


class OpCorResponse(BaseModel):
    id_cor: int
    nome_cor: str
    hex_cor: str
    id_insumo_tecido: Optional[int] = None
    codigo_tecido: Optional[str] = None
    nome_tecido: Optional[str] = None
    peso_kg: Decimal
    pecas_cortadas: int = 0
    rendimento: Optional[Decimal] = None


class OpCorteResponse(BaseModel):
    id_variacao: int
    id_cor: int
    nome_cor: str
    id_tamanho: int
    rotulo: str
    cortado: int
    enviado: int
    disponivel: int
```

Em `backend/app/schemas/camisetas.py`, importar de `app.schemas.camisetas_sku` (`CorteEntrada`, `OpCorEntrada`, `OpCorResponse`, `OpCorteResponse`, `TamanhoResponse`) e trocar os três schemas da OP:

```python
class CamisetaOrdemProducaoCreate(BaseModel):
    codigo_op: Optional[str] = None  # ignorado: o servidor gera OP-AAAA-NNNN
    id_modelo: int
    cores: Optional[List[OpCorEntrada]] = None  # uma linha por cor do enfesto
    id_insumo_tecido: Optional[int] = None  # corpo antigo: uma malha só (a cor vem do rolo)
    peso_malha_enviado_kg: Optional[Decimal] = None
    pecas_planejadas: Optional[int] = None

class CamisetaOrdemProducaoFinalizarCorte(BaseModel):
    cortes: Optional[List[CorteEntrada]] = None  # OP com cores
    pecas_reais_cortadas: Optional[int] = None  # só OP antiga (sem cores)

class CamisetaOrdemProducaoResponse(BaseModel):
    # todos os campos atuais continuam iguais (id_op … saldo_disponivel_envio); acrescentar ao fim:
    legada: bool = False
    cores: List[OpCorResponse] = Field(default_factory=list)
    cortes: List[OpCorteResponse] = Field(default_factory=list)
    tamanhos: List[TamanhoResponse] = Field(default_factory=list)
```

- [ ] **Step 4: Apoio em `services/camisetas/costura.py`**

Acrescentar depois de `status_op_apos_retorno`:

```python
def total_enviado(op) -> int:
    return sum(r.quantidade_enviada or 0 for r in op.movimentacoes_costura or [])


def quantidades_enviadas_por_sku(op) -> dict[int, int]:
    enviados: dict[int, int] = {}
    for remessa in op.movimentacoes_costura or []:
        for item in remessa.itens:
            enviados[item.id_variacao] = enviados.get(item.id_variacao, 0) + item.qtd_enviada
    return enviados
```

- [ ] **Step 5: Serviço de OP**

`backend/app/services/camisetas/ordens.py`:

```python
# app/services/camisetas/ordens.py
"""Ordens de produção: enfesto com várias cores, corte por cor × tamanho e resposta da OP."""
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaInsumo, CamisetaOrdemProducao, get_utc_now
from app.models.camisetas_sku import CamisetaOpCor, CamisetaOpCorte
from app.schemas.camisetas import (
    CamisetaOrdemProducaoCreate,
    CamisetaOrdemProducaoFinalizarCorte,
    CamisetaOrdemProducaoResponse,
)
from app.schemas.camisetas_sku import OpCorEntrada, OpCorResponse, OpCorteResponse, TamanhoResponse
from app.services.camisetas.cores import obter_cor
from app.services.camisetas.costura import quantidades_enviadas_por_sku, total_enviado
from app.services.camisetas.sku import obter_modelo, obter_ou_criar_variacao, tamanho_do_modelo, tamanhos_do_modelo
from app.services.sequencias import proximo_codigo

CATEGORIA_MALHA = "ROLO_TECIDO"
STATUS_OP_ENFESTADA = "Enfestado na Mesa"
STATUS_OP_CORTADA = "Cortado (Pronto para Costura)"
STATUS_OP_AGUARDANDO = "Aguardando Corte"
DUAS_CASAS = Decimal("0.01")
ZERO = Decimal("0")


def rendimento(pecas: int, peso) -> Optional[Decimal]:
    if not pecas or peso is None or Decimal(peso) <= ZERO:
        return None
    return (Decimal(pecas) / Decimal(peso)).quantize(DUAS_CASAS, rounding=ROUND_HALF_UP)


def obter_op(db: Session, id_op: int) -> CamisetaOrdemProducao:
    op = db.get(CamisetaOrdemProducao, id_op)
    if op is None:
        raise ErroNegocio(404, "Ordem de produção não encontrada")
    return op


def _linhas_do_corpo_antigo(db: Session, dados: CamisetaOrdemProducaoCreate) -> list[OpCorEntrada]:
    if dados.id_insumo_tecido is None or dados.peso_malha_enviado_kg is None:
        raise ErroNegocio(400, "Informe as cores do enfesto, com o rolo de malha e o peso de cada uma.")
    if dados.peso_malha_enviado_kg <= ZERO:
        raise ErroNegocio(400, "Peso de malha enviado deve ser maior que zero")
    rolo = db.get(CamisetaInsumo, dados.id_insumo_tecido)
    if rolo is None:
        raise ErroNegocio(404, "Rolo de malha não encontrado.")
    if rolo.id_cor is None:
        raise ErroNegocio(400, f"Informe a cor: o rolo {rolo.codigo} não está ligado a uma cor de camiseta.")
    return [OpCorEntrada(id_cor=rolo.id_cor, id_insumo_tecido=rolo.id_insumo, peso_kg=dados.peso_malha_enviado_kg)]


def _validar_linhas(db: Session, linhas: list[OpCorEntrada]) -> list[tuple[OpCorEntrada, CamisetaInsumo]]:
    """Cor existente e sem repetição; rolo de malha com saldo para o peso somado de todas as linhas que o usam."""
    if not linhas:
        raise ErroNegocio(400, "Informe pelo menos uma cor no enfesto.")
    cores_vistas = set()
    peso_por_rolo: dict[int, Decimal] = {}
    validadas = []
    for linha in linhas:
        cor = obter_cor(db, linha.id_cor)
        if linha.id_cor in cores_vistas:
            raise ErroNegocio(400, f"A cor {cor.nome} aparece duas vezes no enfesto.")
        cores_vistas.add(linha.id_cor)
        rolo = db.get(CamisetaInsumo, linha.id_insumo_tecido)
        if rolo is None or rolo.categoria != CATEGORIA_MALHA:
            raise ErroNegocio(400, f"Escolha um rolo de malha para a cor {cor.nome}.")
        peso_por_rolo[rolo.id_insumo] = peso_por_rolo.get(rolo.id_insumo, ZERO) + linha.peso_kg
        saldo = rolo.saldo_atual or ZERO
        if saldo < peso_por_rolo[rolo.id_insumo]:
            raise ErroNegocio(
                400,
                f"Estoque insuficiente de malha: o rolo {rolo.codigo} tem {saldo:.3f} kg "
                f"e o enfesto pede {peso_por_rolo[rolo.id_insumo]:.3f} kg.",
            )
        validadas.append((linha, rolo))
    return validadas


def abrir_op(db: Session, dados: CamisetaOrdemProducaoCreate) -> CamisetaOrdemProducao:
    modelo = obter_modelo(db, dados.id_modelo)
    tamanhos_do_modelo(modelo)  # sem grade não há como cortar por tamanho
    linhas = dados.cores if dados.cores is not None else _linhas_do_corpo_antigo(db, dados)
    validadas = _validar_linhas(db, linhas)
    peso_total = sum((linha.peso_kg for linha, _ in validadas), ZERO)
    consumo = modelo.consumo_tecido_kg or ZERO
    op = CamisetaOrdemProducao(
        codigo_op=proximo_codigo(db, "OP"),
        id_modelo=modelo.id_modelo,
        id_insumo_tecido=validadas[0][1].id_insumo,
        peso_malha_enviado_kg=peso_total,
        pecas_planejadas=int(peso_total / consumo) if consumo > ZERO else 0,
        status_op=STATUS_OP_ENFESTADA,
    )
    op.cores = [CamisetaOpCor(id_cor=linha.id_cor, id_insumo_tecido=rolo.id_insumo, peso_kg=linha.peso_kg)
                for linha, rolo in validadas]
    for linha, rolo in validadas:
        rolo.saldo_atual = (rolo.saldo_atual or ZERO) - linha.peso_kg
        rolo.atualizado_em = get_utc_now()
    db.add(op)
    db.commit()
    db.refresh(op)
    return op


def _corte_legado(op: CamisetaOrdemProducao, dados: CamisetaOrdemProducaoFinalizarCorte) -> None:
    if dados.pecas_reais_cortadas is None or dados.pecas_reais_cortadas <= 0:
        raise ErroNegocio(400, "Quantidade de peças cortadas deve ser maior que zero")
    op.pecas_reais_cortadas = dados.pecas_reais_cortadas


def _corte_por_sku(db: Session, op: CamisetaOrdemProducao, dados: CamisetaOrdemProducaoFinalizarCorte) -> None:
    if op.movimentacoes_costura:
        raise ErroNegocio(409, "Esta OP já enviou peças para a facção; o corte não pode mais ser alterado.")
    if not dados.cortes:
        raise ErroNegocio(400, "Informe as peças cortadas de cada cor e tamanho.")
    cores_da_op = {c.id_cor for c in op.cores}
    vistos = set()
    for corte in dados.cortes:
        if corte.id_cor not in cores_da_op:
            raise ErroNegocio(400, "Há uma cor no corte que não faz parte do enfesto desta OP.")
        tamanho_do_modelo(db, op.modelo, corte.id_tamanho)
        if (corte.id_cor, corte.id_tamanho) in vistos:
            raise ErroNegocio(400, "A mesma cor e tamanho aparece duas vezes no corte.")
        vistos.add((corte.id_cor, corte.id_tamanho))
    positivos = [c for c in dados.cortes if c.quantidade > 0]
    if not positivos:
        raise ErroNegocio(400, "Quantidade de peças cortadas deve ser maior que zero")
    variacoes = [(obter_ou_criar_variacao(db, op.modelo, c.id_cor, c.id_tamanho), c.quantidade) for c in positivos]
    op.cortes.clear()
    db.flush()  # apaga as linhas antigas antes de inserir as novas (restrição única id_op + id_variacao)
    op.cortes.extend(CamisetaOpCorte(id_variacao=v.id_variacao, quantidade=q) for v, q in variacoes)
    op.pecas_reais_cortadas = sum(q for _, q in variacoes)


def registrar_corte(db: Session, id_op: int, dados: CamisetaOrdemProducaoFinalizarCorte) -> CamisetaOrdemProducao:
    op = obter_op(db, id_op)
    if op.cores:
        _corte_por_sku(db, op, dados)
    else:
        _corte_legado(op, dados)
    op.data_corte = get_utc_now()
    op.status_op = STATUS_OP_CORTADA
    op.rendimento_real_pecas_kg = rendimento(op.pecas_reais_cortadas, op.peso_malha_enviado_kg)
    db.commit()
    db.refresh(op)
    return op


def status_exibicao(op: CamisetaOrdemProducao) -> str:
    status = op.status_op or STATUS_OP_AGUARDANDO
    if "Envio Parcial" in status or "Facção" in status or "Oficina" in status:
        return "Em Costura"
    return status


def _nome_tecido(op: CamisetaOrdemProducao) -> str:
    if op.cores:
        nomes = dict.fromkeys(c.tecido.tipo_malha_ou_aviamento for c in op.cores if c.tecido)
        return ", ".join(nomes) or "Malha"
    return op.tecido.tipo_malha_ou_aviamento if op.tecido else "Malha Geral"


def _resposta_das_cores(op: CamisetaOrdemProducao) -> list[OpCorResponse]:
    cortado_por_cor: dict[int, int] = {}
    for corte in op.cortes:
        cortado_por_cor[corte.variacao.id_cor] = cortado_por_cor.get(corte.variacao.id_cor, 0) + corte.quantidade
    return [
        OpCorResponse(
            id_cor=c.id_cor, nome_cor=c.cor.nome, hex_cor=c.cor.hex, id_insumo_tecido=c.id_insumo_tecido,
            codigo_tecido=c.tecido.codigo if c.tecido else None,
            nome_tecido=c.tecido.tipo_malha_ou_aviamento if c.tecido else None,
            peso_kg=c.peso_kg, pecas_cortadas=cortado_por_cor.get(c.id_cor, 0),
            rendimento=rendimento(cortado_por_cor.get(c.id_cor, 0), c.peso_kg),
        )
        for c in op.cores
    ]


def _resposta_dos_cortes(op: CamisetaOrdemProducao) -> list[OpCorteResponse]:
    enviados = quantidades_enviadas_por_sku(op)
    cortes = sorted(op.cortes, key=lambda c: (c.variacao.cor.nome.casefold(), c.variacao.tamanho.ordem))
    return [
        OpCorteResponse(
            id_variacao=c.id_variacao, id_cor=c.variacao.id_cor, nome_cor=c.variacao.cor.nome,
            id_tamanho=c.variacao.id_tamanho, rotulo=c.variacao.tamanho.rotulo, cortado=c.quantidade,
            enviado=enviados.get(c.id_variacao, 0), disponivel=max(0, c.quantidade - enviados.get(c.id_variacao, 0)),
        )
        for c in cortes
    ]


def montar_resposta_op(op: CamisetaOrdemProducao) -> CamisetaOrdemProducaoResponse:
    enviado = total_enviado(op)
    grade = op.modelo.grade if op.modelo else None
    tamanhos = sorted(grade.tamanhos, key=lambda t: t.ordem) if grade else []
    return CamisetaOrdemProducaoResponse(
        id_op=op.id_op,
        codigo_op=op.codigo_op,
        id_modelo=op.id_modelo,
        nome_modelo=op.modelo.nome_modelo if op.modelo else "Modelo",
        id_insumo_tecido=op.id_insumo_tecido,
        nome_tecido=_nome_tecido(op),
        peso_malha_enviado_kg=op.peso_malha_enviado_kg,
        pecas_planejadas=op.pecas_planejadas,
        pecas_reais_cortadas=op.pecas_reais_cortadas,
        rendimento_real_pecas_kg=op.rendimento_real_pecas_kg,
        status_op=status_exibicao(op),
        data_corte=op.data_corte,
        criado_em=op.criado_em,
        quantidade_enviada_costura=enviado,
        saldo_disponivel_envio=max(0, (op.pecas_reais_cortadas or 0) - enviado),
        legada=not op.cores,
        cores=_resposta_das_cores(op),
        cortes=_resposta_dos_cortes(op),
        tamanhos=[TamanhoResponse(id_tamanho=t.id_tamanho, rotulo=t.rotulo) for t in tamanhos],
    )
```

- [ ] **Step 6: Router fino**

`backend/app/routers/camisetas/ordens.py` (substitui o arquivo inteiro):

```python
# app/routers/camisetas/ordens.py
"""Ordens de produção: corte e rendimento (segmento Camisetas)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.camisetas import CamisetaOrdemProducao
from app.schemas.camisetas import (
    CamisetaOrdemProducaoCreate,
    CamisetaOrdemProducaoFinalizarCorte,
    CamisetaOrdemProducaoResponse,
)
from app.services.camisetas.ordens import abrir_op, montar_resposta_op, registrar_corte

router = APIRouter()


@router.get("/ordens/", response_model=List[CamisetaOrdemProducaoResponse])
def listar_ordens_corte(db: Session = Depends(get_db)):
    ops = db.query(CamisetaOrdemProducao).order_by(CamisetaOrdemProducao.id_op.desc()).all()
    return [montar_resposta_op(op) for op in ops]


@router.post("/ordens/", response_model=CamisetaOrdemProducaoResponse, status_code=status.HTTP_201_CREATED)
def abrir_ordem_corte(op_in: CamisetaOrdemProducaoCreate, db: Session = Depends(get_db)):
    """Abre a OP com uma linha por cor do enfesto e baixa o peso de cada rolo de malha."""
    return montar_resposta_op(abrir_op(db, op_in))


@router.put("/ordens/{id_op}/finalizar-corte", response_model=CamisetaOrdemProducaoResponse)
def finalizar_corte_op(id_op: int, corte_in: CamisetaOrdemProducaoFinalizarCorte, db: Session = Depends(get_db)):
    """Registra as peças cortadas por cor e tamanho (OP antiga: só o total) e calcula o rendimento."""
    return montar_resposta_op(registrar_corte(db, id_op, corte_in))
```

- [ ] **Step 7: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_ordens_sku.py tests/test_sequencias.py -q && venv/bin/python -m pytest -q`
Expected: PASS em tudo (dashboard continua achando o tecido pelo `id_insumo_tecido` da OP, que guarda o primeiro rolo).

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/camisetas_sku.py backend/app/schemas/camisetas.py backend/app/services/camisetas/ordens.py \
  backend/app/services/camisetas/costura.py backend/app/routers/camisetas/ordens.py \
  backend/tests/test_ordens_sku.py backend/tests/test_sequencias.py
git commit -m "feat: OP com várias cores e corte por cor e tamanho" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Facção enviando e devolvendo por SKU

**Files:**
- Modify: `backend/app/schemas/camisetas_sku.py`, `backend/app/schemas/camisetas.py:188-216`
- Modify: `backend/app/services/camisetas/costura.py`, `backend/app/routers/camisetas/costura.py` (reescrito, fino)
- Test: `backend/tests/test_costura_sku.py` (novo), `backend/tests/test_costura_retorno.py` (testes de API)

**Interfaces:**
- Consumes: `movimentar`, `ENTRADA_PRODUCAO`, `obter_ou_criar_variacao`, `tamanho_do_modelo`, `descrever_variacao` (Task 2); `total_enviado`, `quantidades_enviadas_por_sku` (Task 4); `ErroNegocio(..., dados)` (Task 1).
- Produces: schemas `ItemEnvioEntrada{id_variacao, quantidade>0}`, `ItemRetornoEntrada{id_cor, id_tamanho, quantidade>=0}`, `RemessaItemResponse`; `CamisetaCosturaFaccaoEnviar.itens` (com `quantidade_enviada` opcional), `CamisetaCosturaFaccaoRetornar.itens` (obrigatório), `CamisetaCosturaFaccaoResponse.id_modelo/legada/itens`. Serviço `enviar_remessa(db, dados) -> (remessa, avisos)`, `registrar_retorno(db, id_costura, dados) -> remessa`, `montar_resposta_remessa(remessa, avisos=None)`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_costura_sku.py`:

```python
from app.models.camisetas import CamisetaCosturaFaccao
from app.models.camisetas_sku import CamisetaMovimentoEstoque, CamisetaVariacao
from tests.fabricas import criar_cor, criar_insumo, criar_modelo, criar_op_cortada, criar_remessa, tamanho


def _op_cortada_por_sku(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    malha = criar_insumo(db, saldo="30.000", cor=preto)
    op = client.post("/camisetas/ordens/", json={"id_modelo": modelo.id_modelo, "cores": [
        {"id_cor": preto.id_cor, "id_insumo_tecido": malha.id_insumo, "peso_kg": "10.000"}]}).json()
    client.put(f"/camisetas/ordens/{op['id_op']}/finalizar-corte", json={"cortes": [
        {"id_cor": preto.id_cor, "id_tamanho": tamanho(modelo, "P").id_tamanho, "quantidade": 20},
        {"id_cor": preto.id_cor, "id_tamanho": tamanho(modelo, "M").id_tamanho, "quantidade": 30}]})
    return modelo, preto, client.get("/camisetas/ordens/").json()[0]


def _sku(op, rotulo):
    return next(c["id_variacao"] for c in op["cortes"] if c["rotulo"] == rotulo)


def _enviar(client, op, itens):
    return client.post("/camisetas/costura/enviar", json={"id_op": op["id_op"], "nome_faccao": "Facção Maria", "itens": itens})


def _retorno(modelo, cor, **quantidades):
    return [{"id_cor": cor.id_cor, "id_tamanho": tamanho(modelo, r).id_tamanho, "quantidade": q} for r, q in quantidades.items()]


def test_envio_por_sku_grava_itens_e_total(client, db):
    _, _, op = _op_cortada_por_sku(client, db)
    resposta = _enviar(client, op, [{"id_variacao": _sku(op, "P"), "quantidade": 20},
                                    {"id_variacao": _sku(op, "M"), "quantidade": 10}])
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert (corpo["quantidade_enviada"], corpo["legada"]) == (30, False)
    assert [(i["rotulo"], i["qtd_enviada"]) for i in corpo["itens"]] == [("P", 20), ("M", 10)]
    depois = client.get("/camisetas/ordens/").json()[0]
    assert {c["rotulo"]: c["disponivel"] for c in depois["cortes"]} == {"P": 0, "M": 20}


def test_envio_acima_do_disponivel_retorna_400_e_nao_cria_remessa(client, db):
    _, _, op = _op_cortada_por_sku(client, db)
    resposta = _enviar(client, op, [{"id_variacao": _sku(op, "P"), "quantidade": 21}])
    assert resposta.status_code == 400
    assert "Camiseta Básica · Preto · P" in resposta.json()["detail"]
    assert db.query(CamisetaCosturaFaccao).count() == 0


def test_envio_sem_itens_em_op_por_sku_retorna_400(client, db):
    _, _, op = _op_cortada_por_sku(client, db)
    resposta = client.post("/camisetas/costura/enviar", json={"id_op": op["id_op"], "nome_faccao": "X", "quantidade_enviada": 5})
    assert resposta.status_code == 400


def test_retorno_por_sku_lanca_entrada_e_perdas(client, db):
    modelo, preto, op = _op_cortada_por_sku(client, db)
    remessa = _enviar(client, op, [{"id_variacao": _sku(op, "P"), "quantidade": 20},
                                   {"id_variacao": _sku(op, "M"), "quantidade": 10}]).json()
    resposta = client.put(f"/camisetas/costura/{remessa['id_costura']}/retornar",
                          json={"itens": _retorno(modelo, preto, P=19, M=10)})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert (corpo["quantidade_retornada"], corpo["perdas_pecas"]) == (29, 1)
    assert {i["rotulo"]: i["qtd_retornada"] for i in corpo["itens"]} == {"P": 19, "M": 10}
    assert {v.tamanho.rotulo: v.saldo for v in db.query(CamisetaVariacao).all()} == {"P": 19, "M": 10}
    movimentos = db.query(CamisetaMovimentoEstoque).all()
    assert {(m.tipo, m.id_costura) for m in movimentos} == {("ENTRADA_PRODUCAO", remessa["id_costura"])}


def test_retorno_de_sku_nao_enviado_ou_acima_do_enviado_retorna_400(client, db):
    modelo, preto, op = _op_cortada_por_sku(client, db)
    remessa = _enviar(client, op, [{"id_variacao": _sku(op, "P"), "quantidade": 10}]).json()
    url = f"/camisetas/costura/{remessa['id_costura']}/retornar"
    assert client.put(url, json={"itens": _retorno(modelo, preto, M=1)}).status_code == 400
    assert client.put(url, json={"itens": _retorno(modelo, preto, P=11)}).status_code == 400


def test_remessa_antiga_aceita_distribuicao_livre_ate_o_total(client, db):
    modelo, preto, branco = criar_modelo(db), criar_cor(db), criar_cor(db, "Branco", "#FFFFFF")
    remessa = criar_remessa(db, criar_op_cortada(db, modelo, pecas=100), quantidade=50)
    url = f"/camisetas/costura/{remessa.id_costura}/retornar"
    acima = client.put(url, json={"itens": _retorno(modelo, preto, P=30) + _retorno(modelo, branco, M=21)})
    assert acima.status_code == 400
    ok = client.put(url, json={"itens": _retorno(modelo, preto, P=30) + _retorno(modelo, branco, M=18)})
    assert ok.status_code == 200
    assert (ok.json()["perdas_pecas"], ok.json()["legada"]) == (2, True)
    saldos = {(v.cor.nome, v.tamanho.rotulo): v.saldo for v in db.query(CamisetaVariacao).all()}
    assert saldos == {("Preto", "P"): 30, ("Branco", "M"): 18}


def test_retorno_no_formato_antigo_retorna_422(client, db):
    remessa = criar_remessa(db, criar_op_cortada(db, criar_modelo(db), pecas=100), quantidade=50)
    resposta = client.put(f"/camisetas/costura/{remessa.id_costura}/retornar", json={"quantidade_retornada": 48})
    assert resposta.status_code == 422
```

Em `backend/tests/test_costura_retorno.py`, trocar o import de `CamisetaProdutoAcabado` por `CamisetaVariacao` (de `app.models.camisetas_sku`), importar `criar_cor` e `tamanho` das fábricas e reescrever os três testes de API:

```python
def _itens(modelo, cor, rotulo, quantidade):
    return {"itens": [{"id_cor": cor.id_cor, "id_tamanho": tamanho(modelo, rotulo).id_tamanho, "quantidade": quantidade}]}


def test_api_retorno_duplicado_retorna_409_e_nao_duplica_estoque(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    rem = criar_remessa(db, criar_op_cortada(db, modelo, pecas=100), quantidade=50)
    primeira = client.put(f"/camisetas/costura/{rem.id_costura}/retornar", json=_itens(modelo, preto, "M", 48))
    segunda = client.put(f"/camisetas/costura/{rem.id_costura}/retornar", json=_itens(modelo, preto, "M", 48))
    assert primeira.status_code == 200
    assert primeira.json()["perdas_pecas"] == 2
    assert segunda.status_code == 409
    assert db.query(CamisetaVariacao).one().saldo == 48


def test_api_retorno_maior_que_o_enviado_retorna_400(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    rem = criar_remessa(db, criar_op_cortada(db, modelo, pecas=100), quantidade=50)
    resposta = client.put(f"/camisetas/costura/{rem.id_costura}/retornar", json=_itens(modelo, preto, "M", 60))
    assert resposta.status_code == 400


def test_api_op_so_finaliza_no_ultimo_retorno(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    op = criar_op_cortada(db, modelo, pecas=100)
    rem_a = criar_remessa(db, op, quantidade=60)
    rem_b = criar_remessa(db, op, quantidade=40)
    client.put(f"/camisetas/costura/{rem_a.id_costura}/retornar", json=_itens(modelo, preto, "M", 60))
    db.refresh(op)
    assert op.status_op == "Em Costura"
    client.put(f"/camisetas/costura/{rem_b.id_costura}/retornar", json=_itens(modelo, preto, "G", 40))
    db.refresh(op)
    assert op.status_op == "Costura Finalizada"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_costura_sku.py tests/test_costura_retorno.py -q`
Expected: FAIL — envio exige `quantidade_enviada`; retorno ainda lê `quantidade_retornada` e grava na tabela antiga.

- [ ] **Step 3: Schemas**

Acrescentar a `backend/app/schemas/camisetas_sku.py`:

```python
class ItemEnvioEntrada(BaseModel):
    id_variacao: int
    quantidade: int = Field(..., gt=0)


class ItemRetornoEntrada(BaseModel):
    id_cor: int
    id_tamanho: int
    quantidade: int = Field(..., ge=0)


class RemessaItemResponse(BaseModel):
    id_variacao: int
    id_cor: int
    nome_cor: str
    hex_cor: str
    id_tamanho: int
    rotulo: str
    qtd_enviada: int
    qtd_retornada: Optional[int] = None
```

Em `backend/app/schemas/camisetas.py` (importar `ItemEnvioEntrada`, `ItemRetornoEntrada`, `RemessaItemResponse`):

```python
class CamisetaCosturaFaccaoEnviar(BaseModel):
    id_op: int
    nome_faccao: str = Field(..., min_length=1, max_length=150)
    quantidade_enviada: Optional[int] = None  # só OP antiga (cortada sem cor e tamanho)
    itens: Optional[List[ItemEnvioEntrada]] = None  # OP cortada por SKU
    margem_seguranca_aviamentos_percentual: Decimal = Field(Decimal("3.00"), ge=0, le=100)
    observacoes: Optional[str] = None
    # Se o estoque registrado de aviamentos não cobrir o envio, o servidor responde 409 com as faltas;
    confirmar_saldo_insuficiente: bool = False

class CamisetaCosturaFaccaoRetornar(BaseModel):
    itens: List[ItemRetornoEntrada]  # por cor e tamanho; o que não vier conta como não devolvido
    observacoes: Optional[str] = None
```

E em `CamisetaCosturaFaccaoResponse`, acrescentar:

```python
    id_modelo: Optional[int] = None
    legada: bool = False
    itens: List[RemessaItemResponse] = Field(default_factory=list)
```

(Manter o comentário original de `confirmar_saldo_insuficiente`, se houver mais linhas.)

- [ ] **Step 4: Serviço**

Em `backend/app/services/camisetas/costura.py`, ajustar os imports e acrescentar o envio, o retorno e a resposta (os `STATUS_*`, `status_op_apos_retorno`, `total_enviado` e `quantidades_enviadas_por_sku` continuam):

```python
# app/services/camisetas/costura.py
"""Remessas para facções: envio e retorno por SKU, com o caminho antigo para OPs cortadas sem cor e tamanho."""
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaCosturaFaccao, CamisetaFichaTecnica, CamisetaOrdemProducao, get_utc_now
from app.models.camisetas_sku import CamisetaRemessaItem, CamisetaVariacao
from app.schemas.camisetas import (
    CamisetaCosturaFaccaoEnviar,
    CamisetaCosturaFaccaoResponse,
    CamisetaCosturaFaccaoRetornar,
)
from app.schemas.camisetas_sku import RemessaItemResponse
from app.services.camisetas.cores import obter_cor
from app.services.camisetas.estoque import (
    AVISO_SEM_AVIAMENTOS,
    TIPO_TECIDO_PRINCIPAL,
    aplicar_baixa,
    calcular_necessidades,
    listar_faltas,
)
from app.services.camisetas.sku import (
    ENTRADA_PRODUCAO,
    descrever_variacao,
    movimentar,
    obter_ou_criar_variacao,
    tamanho_do_modelo,
)

# ... STATUS_*, status_op_apos_retorno, total_enviado, quantidades_enviadas_por_sku (como estão) ...


def _envio_legado(op: CamisetaOrdemProducao, dados: CamisetaCosturaFaccaoEnviar) -> int:
    if dados.itens:
        raise ErroNegocio(400, "Esta OP foi cortada sem cor e tamanho; informe só a quantidade total.")
    quantidade = dados.quantidade_enviada or 0
    if quantidade <= 0:
        raise ErroNegocio(400, "Quantidade enviada deve ser maior que zero")
    saldo = max(0, (op.pecas_reais_cortadas or 0) - total_enviado(op))
    if quantidade > saldo:
        raise ErroNegocio(
            400, f"Quantidade a enviar ({quantidade}) ultrapassa o saldo de painéis cortados disponíveis nesta OP ({saldo}).")
    return quantidade


def _envio_por_sku(op: CamisetaOrdemProducao, dados: CamisetaCosturaFaccaoEnviar) -> list[tuple[CamisetaVariacao, int]]:
    if not dados.itens:
        raise ErroNegocio(400, "Informe quantas peças de cada cor e tamanho vão para a facção.")
    cortes = {c.id_variacao: c for c in op.cortes}
    enviados = quantidades_enviadas_por_sku(op)
    vistos = set()
    linhas = []
    for item in dados.itens:
        corte = cortes.get(item.id_variacao)
        if corte is None:
            raise ErroNegocio(400, "Há uma cor e tamanho no envio que não foi cortado nesta OP.")
        if item.id_variacao in vistos:
            raise ErroNegocio(400, "A mesma cor e tamanho aparece duas vezes no envio.")
        vistos.add(item.id_variacao)
        disponivel = corte.quantidade - enviados.get(item.id_variacao, 0)
        if item.quantidade > disponivel:
            raise ErroNegocio(
                400, f"{descrever_variacao(corte.variacao)}: só há {max(disponivel, 0)} peça(s) cortada(s) para enviar.")
        linhas.append((corte.variacao, item.quantidade))
    return linhas


def enviar_remessa(db: Session, dados: CamisetaCosturaFaccaoEnviar) -> tuple[CamisetaCosturaFaccao, list[str]]:
    """Envia peças cortadas à facção e baixa os aviamentos da ficha técnica (com margem)."""
    op = db.get(CamisetaOrdemProducao, dados.id_op)
    if op is None:
        raise ErroNegocio(404, "Ordem de corte não encontrada")
    linhas = _envio_por_sku(op, dados) if op.cortes else []
    quantidade = sum(q for _, q in linhas) if op.cortes else _envio_legado(op, dados)
    itens_ficha = db.query(CamisetaFichaTecnica).filter(
        CamisetaFichaTecnica.id_modelo == op.id_modelo,
        CamisetaFichaTecnica.tipo_insumo != TIPO_TECIDO_PRINCIPAL,
    ).all()
    necessidades = calcular_necessidades(itens_ficha, quantidade, dados.margem_seguranca_aviamentos_percentual)
    faltas = listar_faltas(necessidades)
    if faltas and not dados.confirmar_saldo_insuficiente:
        raise ErroNegocio(409, "Aviamentos insuficientes no estoque para este envio.",
                          {"faltas": [f.para_dict() for f in faltas]})
    remessa = CamisetaCosturaFaccao(
        id_op=op.id_op, nome_faccao=dados.nome_faccao, quantidade_enviada=quantidade,
        margem_seguranca_aviamentos_percentual=dados.margem_seguranca_aviamentos_percentual,
        status=STATUS_REMESSA_EM_COSTURA, data_envio=get_utc_now(), observacoes=dados.observacoes,
    )
    remessa.itens = [CamisetaRemessaItem(id_variacao=v.id_variacao, qtd_enviada=q) for v, q in linhas]
    db.add(remessa)
    op.status_op = STATUS_OP_EM_COSTURA
    aplicar_baixa(necessidades)
    db.commit()
    db.refresh(remessa)
    return remessa, ([] if necessidades else [AVISO_SEM_AVIAMENTOS])


def _sem_repeticao(itens) -> None:
    vistos = set()
    for item in itens:
        if (item.id_cor, item.id_tamanho) in vistos:
            raise ErroNegocio(400, "A mesma cor e tamanho aparece duas vezes no retorno.")
        vistos.add((item.id_cor, item.id_tamanho))


def _retorno_com_itens(remessa: CamisetaCosturaFaccao, itens) -> list[tuple[CamisetaRemessaItem, int]]:
    enviados = {(i.variacao.id_cor, i.variacao.id_tamanho): i for i in remessa.itens}
    retornos: dict[int, int] = {}
    for item in itens:
        enviado = enviados.get((item.id_cor, item.id_tamanho))
        if enviado is None:
            raise ErroNegocio(400, "Há uma cor e tamanho no retorno que não foi enviado nesta remessa.")
        if item.quantidade > enviado.qtd_enviada:
            raise ErroNegocio(
                400, f"{descrever_variacao(enviado.variacao)}: voltaram {item.quantidade}, mas foram enviadas {enviado.qtd_enviada}.")
        retornos[enviado.id_item] = item.quantidade
    return [(enviado, retornos.get(enviado.id_item, 0)) for enviado in remessa.itens]


def _retorno_legado(db: Session, remessa: CamisetaCosturaFaccao, itens) -> list[tuple[CamisetaVariacao, int]]:
    modelo = remessa.op.modelo
    for item in itens:  # valida tudo antes de criar SKUs
        tamanho_do_modelo(db, modelo, item.id_tamanho)
        obter_cor(db, item.id_cor)
    return [(obter_ou_criar_variacao(db, modelo, i.id_cor, i.id_tamanho), i.quantidade) for i in itens if i.quantidade > 0]


def _entradas_do_retorno(db: Session, remessa: CamisetaCosturaFaccao, itens) -> list[tuple[CamisetaVariacao, int]]:
    if not remessa.itens:
        return _retorno_legado(db, remessa, itens)
    pares = _retorno_com_itens(remessa, itens)
    for item, quantidade in pares:
        item.qtd_retornada = quantidade
    return [(item.variacao, quantidade) for item, quantidade in pares if quantidade > 0]


def registrar_retorno(db: Session, id_costura: int, dados: CamisetaCosturaFaccaoRetornar) -> CamisetaCosturaFaccao:
    """Confere o retorno por cor e tamanho, apura as perdas e lança as peças no estoque de cada SKU."""
    remessa = db.get(CamisetaCosturaFaccao, id_costura)
    if remessa is None:
        raise ErroNegocio(404, "Remessa de costura não encontrada")
    if remessa.status != STATUS_REMESSA_EM_COSTURA:
        raise ErroNegocio(409, "Esta remessa já teve o retorno registrado.")
    _sem_repeticao(dados.itens)
    retornado = sum(i.quantidade for i in dados.itens)
    if retornado > remessa.quantidade_enviada:
        raise ErroNegocio(400, f"O retorno ({retornado}) não pode ser maior que o enviado ({remessa.quantidade_enviada}).")
    for variacao, quantidade in _entradas_do_retorno(db, remessa, dados.itens):
        movimentar(db, variacao, quantidade, ENTRADA_PRODUCAO, motivo=f"Retorno da facção {remessa.nome_faccao}",
                   id_costura=remessa.id_costura)
    remessa.quantidade_retornada = retornado
    remessa.perdas_pecas = remessa.quantidade_enviada - retornado
    remessa.saldo_aprovado = retornado
    remessa.data_retorno = get_utc_now()
    remessa.status = STATUS_REMESSA_RETORNADA
    if dados.observacoes:
        remessa.observacoes = (remessa.observacoes or "") + " | Retorno: " + dados.observacoes
    db.flush()
    if remessa.op:
        remessa.op.status_op = status_op_apos_retorno(remessa.op.pecas_reais_cortadas or 0, remessa.op.movimentacoes_costura)
    db.commit()
    db.refresh(remessa)
    return remessa


def _resposta_dos_itens(remessa: CamisetaCosturaFaccao) -> list[RemessaItemResponse]:
    itens = sorted(remessa.itens, key=lambda i: (i.variacao.cor.nome.casefold(), i.variacao.tamanho.ordem))
    return [
        RemessaItemResponse(
            id_variacao=i.id_variacao, id_cor=i.variacao.id_cor, nome_cor=i.variacao.cor.nome, hex_cor=i.variacao.cor.hex,
            id_tamanho=i.variacao.id_tamanho, rotulo=i.variacao.tamanho.rotulo,
            qtd_enviada=i.qtd_enviada, qtd_retornada=i.qtd_retornada,
        )
        for i in itens
    ]
```

E em `montar_resposta_remessa`, acrescentar ao construtor:

```python
        id_modelo=op.id_modelo if op else None,
        legada=not remessa.itens,
        itens=_resposta_dos_itens(remessa),
```

- [ ] **Step 5: Router fino**

`backend/app/routers/camisetas/costura.py` (substitui o arquivo inteiro):

```python
# app/routers/camisetas/costura.py
"""Costura terceirizada: remessas para facções (segmento Camisetas)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.camisetas import CamisetaCosturaFaccao
from app.schemas.camisetas import (
    CamisetaCosturaFaccaoEnviar,
    CamisetaCosturaFaccaoResponse,
    CamisetaCosturaFaccaoRetornar,
)
from app.services.camisetas.costura import enviar_remessa, montar_resposta_remessa, registrar_retorno

router = APIRouter()


@router.get("/costura/", response_model=List[CamisetaCosturaFaccaoResponse])
def listar_remessas_costura(db: Session = Depends(get_db)):
    remessas = db.query(CamisetaCosturaFaccao).order_by(CamisetaCosturaFaccao.id_costura.desc()).all()
    return [montar_resposta_remessa(r) for r in remessas]


@router.post("/costura/enviar", response_model=CamisetaCosturaFaccaoResponse, status_code=status.HTTP_201_CREATED)
def enviar_para_faccao(envio_in: CamisetaCosturaFaccaoEnviar, db: Session = Depends(get_db)):
    """Envia peças cortadas (por cor e tamanho) para a facção e baixa os aviamentos da ficha técnica."""
    remessa, avisos = enviar_remessa(db, envio_in)
    return montar_resposta_remessa(remessa, avisos)


@router.put("/costura/{id_costura}/retornar", response_model=CamisetaCosturaFaccaoResponse)
def registrar_retorno_faccao(id_costura: int, retorno_in: CamisetaCosturaFaccaoRetornar, db: Session = Depends(get_db)):
    """Registra o retorno por cor e tamanho, apura perdas e lança as peças no estoque de Produtos Prontos."""
    return montar_resposta_remessa(registrar_retorno(db, id_costura, retorno_in))
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_costura_sku.py tests/test_costura_retorno.py tests/test_aviamentos.py -q && venv/bin/python -m pytest -q`
Expected: PASS em tudo (aviamentos: o 409 continua com `detail.faltas`, agora via `ErroNegocio`).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas backend/app/services/camisetas/costura.py backend/app/routers/camisetas/costura.py \
  backend/tests/test_costura_sku.py backend/tests/test_costura_retorno.py
git commit -m "feat: envio e retorno da facção por cor e tamanho" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pedido com itens (criar, editar itens, excluir)

**Files:**
- Modify: `backend/app/schemas/camisetas_sku.py`, `backend/app/schemas/camisetas.py:105-156`
- Create: `backend/app/services/camisetas/pedido_itens.py`
- Modify: `backend/app/services/camisetas/pedidos.py`, `backend/app/routers/camisetas/pedidos.py`
- Modify: `backend/tests/test_rotas_camisetas.py`
- Test: `backend/tests/test_pedido_itens.py` (novo)

**Interfaces:**
- Consumes: `obter_modelo`, `tamanhos_do_modelo`, `tamanho_do_modelo` (Task 2); `obter_cor`; `resolver_cliente`; `proximo_codigo`.
- Produces: schemas `QtdTamanhoEntrada`, `PedidoItemEntrada{id_modelo, id_cor?, quantidades}`, `PedidoItensEntrada{itens}`, `QtdTamanhoResponse`, `PedidoItemResponse`; `CamisetaPedidoCreate.itens` (com `id_modelo` opcional), `CamisetaPedidoResponse.itens`. Em `pedido_itens.py`: `CAMPOS_GRADE_LEGADA`, `montar_itens(db, entradas, exigir_cor) -> list[CamisetaPedidoItem]`, `itens_do_corpo_antigo(db, dados) -> list[PedidoItemEntrada]`, `total_do_item(item) -> int`, `resposta_do_item(item) -> PedidoItemResponse`. Em `pedidos.py`: `hoje_local()`, `obter_pedido(db, id)`, `criar_pedido(db, dados, hoje)`, `substituir_itens(db, id_pedido, dados)`, `excluir_pedido(db, id_pedido) -> str`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_pedido_itens.py`:

```python
from datetime import datetime

from app.core.config import FUSO_HORARIO
from app.models.camisetas_sku import CamisetaPedidoItem
from tests.fabricas import (
    criar_cliente,
    criar_cor,
    criar_grade,
    criar_modelo,
    criar_modelo_com_grade,
    criar_pedido,
    tamanho,
)

URL = "/camisetas/pedidos/"


def hoje():
    return datetime.now(FUSO_HORARIO).date()


def _item(modelo, cor, **quantidades):
    return {"id_modelo": modelo.id_modelo, "id_cor": cor.id_cor if cor else None,
            "quantidades": [{"id_tamanho": tamanho(modelo, r).id_tamanho, "quantidade": q} for r, q in quantidades.items()]}


def _pedido(cliente, itens):
    return {"id_cliente": cliente.id_cliente, "itens": itens, "prazo_entrega": hoje().isoformat(), "valor_total": "1500.00"}


def _antigo(cliente, modelo, **grade):
    return {"id_cliente": cliente.id_cliente, "id_modelo": modelo.id_modelo, **grade,
            "prazo_entrega": hoje().isoformat(), "valor_total": "100"}


def _cenario(db):
    return criar_modelo(db), criar_cor(db), criar_cor(db, "Branco", "#FFFFFF"), criar_cliente(db)


def test_pedido_com_dois_itens(client, db):
    modelo, preto, branco, cliente = _cenario(db)
    resposta = client.post(URL, json=_pedido(cliente, [_item(modelo, preto, P=10, M=20), _item(modelo, branco, G=5)]))
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert (corpo["quantidade_total"], corpo["id_modelo"], corpo["grade_p"]) == (35, modelo.id_modelo, 0)
    assert [(i["nome_cor"], i["total"]) for i in corpo["itens"]] == [("Preto", 30), ("Branco", 5)]
    assert [(q["rotulo"], q["quantidade"]) for q in corpo["itens"][0]["quantidades"]] == [("P", 10), ("M", 20)]


def test_item_repetido_retorna_400(client, db):
    modelo, preto, _, cliente = _cenario(db)
    resposta = client.post(URL, json=_pedido(cliente, [_item(modelo, preto, P=1), _item(modelo, preto, M=1)]))
    assert resposta.status_code == 400
    assert "repete modelo e cor" in resposta.json()["detail"]


def test_item_sem_cor_retorna_400(client, db):
    modelo, _, _, cliente = _cenario(db)
    resposta = client.post(URL, json=_pedido(cliente, [_item(modelo, None, P=1)]))
    assert resposta.status_code == 400
    assert "Escolha a cor do item 1" in resposta.json()["detail"]


def test_tamanho_fora_da_grade_retorna_400(client, db):
    modelo, preto, _, cliente = _cenario(db)
    infantil = criar_grade(db, nome="Infantil", rotulos=("2",))
    item = {"id_modelo": modelo.id_modelo, "id_cor": preto.id_cor,
            "quantidades": [{"id_tamanho": infantil.tamanhos[0].id_tamanho, "quantidade": 3}]}
    assert client.post(URL, json=_pedido(cliente, [item])).status_code == 400


def test_item_sem_quantidade_retorna_400(client, db):
    modelo, preto, _, cliente = _cenario(db)
    assert client.post(URL, json=_pedido(cliente, [_item(modelo, preto, P=0)])).status_code == 400


def test_cor_inativa_retorna_400(client, db):
    modelo, _, _, cliente = _cenario(db)
    cinza = criar_cor(db, "Cinza", "#888888", ativo=False)
    assert client.post(URL, json=_pedido(cliente, [_item(modelo, cinza, P=2)])).status_code == 400


def test_corpo_antigo_vira_item_sem_cor(client, db):
    modelo, _, _, cliente = _cenario(db)
    resposta = client.post(URL, json=_antigo(cliente, modelo, grade_p=5, grade_g=3))
    assert resposta.status_code == 201
    item = resposta.json()["itens"][0]
    assert item["id_cor"] is None
    assert [(q["rotulo"], q["quantidade"]) for q in item["quantidades"]] == [("P", 5), ("G", 3)]
    assert resposta.json()["grade_p"] == 5


def test_corpo_antigo_com_tamanho_que_a_grade_nao_tem_retorna_400(client, db):
    modelo = criar_modelo_com_grade(db, nome="Infantil", rotulos=("2", "4"))
    resposta = client.post(URL, json=_antigo(criar_cliente(db), modelo, grade_p=5))
    assert resposta.status_code == 400
    assert "não tem o tamanho P" in resposta.json()["detail"]


def test_editar_itens_define_a_cor_e_recalcula(client, db):
    modelo, preto, branco, cliente = _cenario(db)
    criado = client.post(URL, json=_antigo(cliente, modelo, grade_p=5, grade_g=3)).json()
    resposta = client.put(f"{URL}{criado['id_pedido']}/itens", json={"itens": [
        _item(modelo, preto, P=5, G=3), _item(modelo, branco, M=2)]})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["quantidade_total"] == 10
    assert [i["nome_cor"] for i in corpo["itens"]] == ["Preto", "Branco"]
    assert db.query(CamisetaPedidoItem).count() == 2


def test_editar_itens_sem_cor_retorna_400(client, db):
    modelo, _, _, cliente = _cenario(db)
    criado = client.post(URL, json=_antigo(cliente, modelo, grade_p=5)).json()
    resposta = client.put(f"{URL}{criado['id_pedido']}/itens", json={"itens": [_item(modelo, None, P=5)]})
    assert resposta.status_code == 400


def test_editar_itens_de_pedido_entregue_retorna_409(client, db):
    modelo, preto, _, _ = _cenario(db)
    pedido = criar_pedido(db, modelo, status="Entregue")
    resposta = client.put(f"{URL}{pedido.id_pedido}/itens", json={"itens": [_item(modelo, preto, P=1)]})
    assert resposta.status_code == 409


def test_excluir_pedido_remove_os_itens(client, db):
    modelo, preto, _, cliente = _cenario(db)
    criado = client.post(URL, json=_pedido(cliente, [_item(modelo, preto, P=1)])).json()
    assert client.delete(f"{URL}{criado['id_pedido']}").status_code == 200
    assert db.query(CamisetaPedidoItem).count() == 0
```

Em `backend/tests/test_rotas_camisetas.py`, acrescentar `("PUT", "/camisetas/pedidos/{id_pedido}/itens")`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_pedido_itens.py tests/test_rotas_camisetas.py -q`
Expected: FAIL — `id_modelo` obrigatório (422) e resposta sem `itens`.

- [ ] **Step 3: Schemas**

Acrescentar a `backend/app/schemas/camisetas_sku.py`:

```python
class QtdTamanhoEntrada(BaseModel):
    id_tamanho: int
    quantidade: int = Field(..., ge=0)


class PedidoItemEntrada(BaseModel):
    id_modelo: int
    id_cor: Optional[int] = None  # obrigatória nos pedidos novos (validado no serviço)
    quantidades: List[QtdTamanhoEntrada] = Field(..., min_length=1)


class PedidoItensEntrada(BaseModel):
    itens: List[PedidoItemEntrada] = Field(..., min_length=1)


class QtdTamanhoResponse(BaseModel):
    id_tamanho: int
    rotulo: str
    quantidade: int


class PedidoItemResponse(BaseModel):
    id_item: int
    id_modelo: int
    nome_modelo: str
    id_cor: Optional[int] = None
    nome_cor: Optional[str] = None
    hex_cor: Optional[str] = None
    quantidades: List[QtdTamanhoResponse]
    total: int
```

Em `backend/app/schemas/camisetas.py` (importar `PedidoItemEntrada`, `PedidoItemResponse`): em `CamisetaPedidoCreate`, `id_modelo: Optional[int] = None  # corpo antigo (com grade_p/m/g/gg)` e `itens: Optional[List[PedidoItemEntrada]] = None  # Fase 1B`; em `CamisetaPedidoResponse`, `itens: List[PedidoItemResponse] = Field(default_factory=list)`.

- [ ] **Step 4: Itens do pedido**

`backend/app/services/camisetas/pedido_itens.py`:

```python
# app/services/camisetas/pedido_itens.py
"""Itens do pedido (modelo + cor + quantidade por tamanho): validação, conversão do corpo antigo e resposta."""
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas_sku import CamisetaPedidoItem, CamisetaPedidoItemQtd
from app.schemas.camisetas_sku import PedidoItemEntrada, PedidoItemResponse, QtdTamanhoEntrada, QtdTamanhoResponse
from app.services.camisetas.cores import obter_cor
from app.services.camisetas.sku import obter_modelo, tamanho_do_modelo, tamanhos_do_modelo

ROTULOS_LEGADOS = (("P", "grade_p"), ("M", "grade_m"), ("G", "grade_g"), ("GG", "grade_gg"))
CAMPOS_GRADE_LEGADA = tuple(campo for _, campo in ROTULOS_LEGADOS)


def _validar_cor(db: Session, entrada: PedidoItemEntrada, numero: int, nome_modelo: str, exigir_cor: bool) -> None:
    if entrada.id_cor is None:
        if exigir_cor:
            raise ErroNegocio(400, f"Escolha a cor do item {numero} ({nome_modelo}).")
        return
    cor = obter_cor(db, entrada.id_cor)
    if not cor.ativo:
        raise ErroNegocio(400, f"A cor {cor.nome} está inativa; escolha outra para o item {numero}.")


def _quantidades(db: Session, modelo, entrada: PedidoItemEntrada, numero: int) -> list[CamisetaPedidoItemQtd]:
    vistos = set()
    linhas = []
    for qtd in entrada.quantidades:
        tamanho_do_modelo(db, modelo, qtd.id_tamanho)
        if qtd.id_tamanho in vistos:
            raise ErroNegocio(400, f"O item {numero} repete um tamanho.")
        vistos.add(qtd.id_tamanho)
        if qtd.quantidade > 0:
            linhas.append(CamisetaPedidoItemQtd(id_tamanho=qtd.id_tamanho, quantidade=qtd.quantidade))
    if not linhas:
        raise ErroNegocio(400, f"O item {numero} ({modelo.nome_modelo}) está sem quantidades.")
    return linhas


def montar_itens(db: Session, entradas: list[PedidoItemEntrada], exigir_cor: bool = True) -> list[CamisetaPedidoItem]:
    """Valida tudo antes de devolver: modelo, cor ativa, tamanhos da grade, sem itens repetidos e total > 0."""
    if not entradas:
        raise ErroNegocio(400, "O pedido precisa de pelo menos um item.")
    vistos = set()
    itens = []
    for numero, entrada in enumerate(entradas, start=1):
        modelo = obter_modelo(db, entrada.id_modelo)
        _validar_cor(db, entrada, numero, modelo.nome_modelo, exigir_cor)
        if (entrada.id_modelo, entrada.id_cor) in vistos:
            raise ErroNegocio(400, f"O item {numero} repete modelo e cor de outro item; junte as quantidades num item só.")
        vistos.add((entrada.id_modelo, entrada.id_cor))
        itens.append(CamisetaPedidoItem(
            id_modelo=modelo.id_modelo, id_cor=entrada.id_cor, quantidades=_quantidades(db, modelo, entrada, numero)))
    return itens


def itens_do_corpo_antigo(db: Session, dados) -> list[PedidoItemEntrada]:
    """Corpo antigo (id_modelo + grade_p/m/g/gg) vira um item com cor não informada."""
    if dados.id_modelo is None:
        raise ErroNegocio(400, "Informe os itens do pedido.")
    modelo = obter_modelo(db, dados.id_modelo)
    por_rotulo = {t.rotulo.casefold(): t for t in tamanhos_do_modelo(modelo)}
    quantidades = []
    for rotulo, campo in ROTULOS_LEGADOS:
        valor = getattr(dados, campo) or 0
        if valor <= 0:
            continue
        tamanho = por_rotulo.get(rotulo.casefold())
        if tamanho is None:
            raise ErroNegocio(400, f"O modelo {modelo.nome_modelo} não tem o tamanho {rotulo} na grade.")
        quantidades.append(QtdTamanhoEntrada(id_tamanho=tamanho.id_tamanho, quantidade=valor))
    if not quantidades:
        raise ErroNegocio(400, "A soma das grades (P, M, G, GG) deve ser maior que zero")
    return [PedidoItemEntrada(id_modelo=modelo.id_modelo, id_cor=None, quantidades=quantidades)]


def total_do_item(item: CamisetaPedidoItem) -> int:
    return sum(q.quantidade for q in item.quantidades)


def resposta_do_item(item: CamisetaPedidoItem) -> PedidoItemResponse:
    quantidades = sorted(item.quantidades, key=lambda q: q.tamanho.ordem)
    return PedidoItemResponse(
        id_item=item.id_item, id_modelo=item.id_modelo, nome_modelo=item.modelo.nome_modelo,
        id_cor=item.id_cor, nome_cor=item.cor.nome if item.cor else None, hex_cor=item.cor.hex if item.cor else None,
        quantidades=[QtdTamanhoResponse(id_tamanho=q.id_tamanho, rotulo=q.tamanho.rotulo, quantidade=q.quantidade)
                     for q in quantidades],
        total=total_do_item(item),
    )
```

- [ ] **Step 5: Serviço do pedido**

Em `backend/app/services/camisetas/pedidos.py` (substitui o arquivo; Task 7 acrescenta entrega e status):

```python
# app/services/camisetas/pedidos.py
"""Regras dos pedidos de camisetas: criação com itens, edição de itens e exclusão."""
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaPedido, get_utc_now
from app.schemas.camisetas import CamisetaPedidoCreate, CamisetaPedidoResponse
from app.schemas.camisetas_sku import PedidoItensEntrada
from app.services.camisetas.clientes import resolver_cliente
from app.services.camisetas.pedido_itens import (
    CAMPOS_GRADE_LEGADA,
    itens_do_corpo_antigo,
    montar_itens,
    resposta_do_item,
    total_do_item,
)
from app.services.sequencias import proximo_codigo

STATUS_INICIAL = "Aguardando Produção"
STATUS_ENTREGUE = "Entregue"
STATUS_VALIDOS = ("Aguardando Produção", "Em Produção", "Pronto no Estoque", "Entregue")
MENSAGEM_PRAZO = "O prazo de entrega desejado não pode ser anterior à data de hoje. Selecione hoje ou uma data futura."


def hoje_local() -> date:
    return datetime.now(FUSO_HORARIO).date()


def montar_resposta_pedido(pedido) -> CamisetaPedidoResponse:
    return CamisetaPedidoResponse(
        id_pedido=pedido.id_pedido,
        codigo_pedido=pedido.codigo_pedido,
        nome_cliente=pedido.nome_cliente,
        id_cliente=pedido.id_cliente,
        id_modelo=pedido.id_modelo,
        nome_modelo=pedido.modelo.nome_modelo if pedido.modelo else "Modelo",
        grade_p=pedido.grade_p,
        grade_m=pedido.grade_m,
        grade_g=pedido.grade_g,
        grade_gg=pedido.grade_gg,
        quantidade_total=pedido.quantidade_total,
        prazo_entrega=pedido.prazo_entrega,
        valor_total=pedido.valor_total,
        status_pedido=pedido.status_pedido,
        observacoes=pedido.observacoes,
        data_entrega_realizada=pedido.data_entrega_realizada,
        criado_em=pedido.criado_em,
        itens=[resposta_do_item(item) for item in pedido.itens],
    )


def obter_pedido(db: Session, id_pedido: int) -> CamisetaPedido:
    pedido = db.get(CamisetaPedido, id_pedido)
    if pedido is None:
        raise ErroNegocio(404, "Pedido não encontrado")
    return pedido


def _aplicar_itens(pedido: CamisetaPedido, itens) -> None:
    pedido.itens = itens
    pedido.id_modelo = itens[0].id_modelo
    pedido.quantidade_total = sum(total_do_item(item) for item in itens)


def criar_pedido(db: Session, dados: CamisetaPedidoCreate, hoje: date) -> CamisetaPedido:
    if dados.prazo_entrega < hoje:
        raise ErroNegocio(400, MENSAGEM_PRAZO)
    if dados.itens is not None:
        itens = montar_itens(db, dados.itens, exigir_cor=True)
        grade = {campo: 0 for campo in CAMPOS_GRADE_LEGADA}
    else:
        itens = montar_itens(db, itens_do_corpo_antigo(db, dados), exigir_cor=False)
        grade = {campo: getattr(dados, campo) for campo in CAMPOS_GRADE_LEGADA}
    cliente = resolver_cliente(db, dados.id_cliente, dados.nome_cliente)
    pedido = CamisetaPedido(
        codigo_pedido=proximo_codigo(db, "PED"), nome_cliente=cliente.nome, id_cliente=cliente.id_cliente,
        prazo_entrega=dados.prazo_entrega, valor_total=dados.valor_total, status_pedido=STATUS_INICIAL,
        observacoes=dados.observacoes, **grade,
    )
    _aplicar_itens(pedido, itens)
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return pedido


def substituir_itens(db: Session, id_pedido: int, dados: PedidoItensEntrada) -> CamisetaPedido:
    pedido = obter_pedido(db, id_pedido)
    if pedido.status_pedido == STATUS_ENTREGUE:
        raise ErroNegocio(409, "Pedido já entregue: os itens não podem mais ser alterados. Reverta a entrega antes.")
    _aplicar_itens(pedido, montar_itens(db, dados.itens, exigir_cor=True))
    for campo in CAMPOS_GRADE_LEGADA:
        setattr(pedido, campo, 0)
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return pedido


def excluir_pedido(db: Session, id_pedido: int) -> str:
    pedido = obter_pedido(db, id_pedido)
    if (pedido.status_pedido or "").lower() == STATUS_ENTREGUE.lower():
        raise ErroNegocio(400, "Não é permitido excluir um pedido que já foi formalizado como Entregue ao cliente.")
    codigo = pedido.codigo_pedido
    db.delete(pedido)
    db.commit()
    return codigo
```

- [ ] **Step 6: Router**

Em `backend/app/routers/camisetas/pedidos.py`:
- remover `hoje_local` e `buscar_pedido` locais; importar de `app.services.camisetas.pedidos` (`criar_pedido`, `excluir_pedido`, `hoje_local`, `obter_pedido`, `substituir_itens` além dos já usados) e `PedidoItensEntrada` de `app.schemas.camisetas_sku`;
- nas rotas de status e entrega, trocar `buscar_pedido(db, id_pedido)` por `obter_pedido(db, id_pedido)`;
- substituir `cadastrar_pedido` e `excluir_pedido_camiseta` e acrescentar a rota de itens:

```python
@router.post("/pedidos/", response_model=CamisetaPedidoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_pedido(pedido_in: CamisetaPedidoCreate, db: Session = Depends(get_db)):
    """Cria o pedido com itens (modelo + cor + quantidade por tamanho)."""
    return montar_resposta_pedido(criar_pedido(db, pedido_in, hoje_local()))


@router.put("/pedidos/{id_pedido}/itens", response_model=CamisetaPedidoResponse)
def editar_itens_pedido(id_pedido: int, dados: PedidoItensEntrada, db: Session = Depends(get_db)):
    """Substitui os itens de um pedido ainda não entregue (é assim que um pedido antigo recebe a cor)."""
    return montar_resposta_pedido(substituir_itens(db, id_pedido, dados))


@router.delete("/pedidos/{id_pedido}")
def excluir_pedido_camiseta(id_pedido: int, db: Session = Depends(get_db)):
    """Exclui um pedido (com seus itens). Pedido entregue não pode ser excluído."""
    return {"mensagem": f"Pedido {excluir_pedido(db, id_pedido)} excluído com sucesso!"}
```

Remover os imports que ficarem sem uso (`CamisetaModelo`, `FUSO_HORARIO`, `date`, `datetime`, `resolver_cliente`, `proximo_codigo`).

- [ ] **Step 7: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_pedido_itens.py tests/test_rotas_camisetas.py tests/test_clientes.py tests/test_sequencias.py -q && venv/bin/python -m pytest -q`
Expected: PASS em tudo.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas backend/app/services/camisetas/pedido_itens.py backend/app/services/camisetas/pedidos.py \
  backend/app/routers/camisetas/pedidos.py backend/tests/test_pedido_itens.py backend/tests/test_rotas_camisetas.py
git commit -m "feat: pedido com itens por modelo, cor e tamanho" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Entrega e estorno por SKU

**Files:**
- Modify: `backend/app/services/camisetas/pedidos.py`, `backend/app/routers/camisetas/pedidos.py` (versão final, fina)
- Modify: `backend/app/services/camisetas/estoque.py` (remove `CAMPOS_GRADE`, `obter_ou_criar_estoque_acabado`, `baixar_estoque_acabado`, `devolver_estoque_acabado`)
- Modify: `backend/tests/fabricas.py` (remove `criar_estoque_acabado`)
- Test: `backend/tests/test_pedidos.py` (reescrito)

**Interfaces:**
- Consumes: `buscar_variacao`, `movimentar`, `SAIDA_ENTREGA`, `ESTORNO_ENTREGA` (Task 2); `obter_pedido` (Task 6); `ErroNegocio(..., dados)` (Task 1).
- Produces: `registrar_entrega(db, id_pedido, dados, hoje) -> CamisetaPedido`, `estornar_entrega(db, pedido) -> None`, `atualizar_status(db, id_pedido, novo_status) -> CamisetaPedido`. Falta: `{"id_variacao": int | None, "sku": str, "necessario": int, "disponivel": int}`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_pedidos.py` (substitui o arquivo):

```python
from datetime import date, datetime, timedelta

from app.core.config import FUSO_HORARIO
from app.models.camisetas_sku import CamisetaMovimentoEstoque
from tests.fabricas import criar_cor, criar_modelo, criar_pedido, criar_pedido_com_itens, criar_variacao


def hoje():
    return datetime.now(FUSO_HORARIO).date()


def _cenario(db, saldo_p=10, saldo_m=5):
    modelo, preto = criar_modelo(db), criar_cor(db)
    p = criar_variacao(db, modelo, preto, "P", saldo=saldo_p)
    m = criar_variacao(db, modelo, preto, "M", saldo=saldo_m)
    return p, m, criar_pedido_com_itens(db, modelo, preto, {"P": 4, "M": 5})


def _entregar(client, pedido, **corpo):
    return client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json=corpo)


def _reverter(client, pedido):
    return client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Aguardando Produção"})


def test_mudar_para_entregue_pelo_status_e_bloqueado(client, db):
    pedido = criar_pedido(db, criar_modelo(db))
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Entregue"})
    assert resposta.status_code == 400
    assert "Registrar entrega" in resposta.json()["detail"]


def test_status_invalido_retorna_400(client, db):
    pedido = criar_pedido(db, criar_modelo(db))
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Qualquer"})
    assert resposta.status_code == 400


def test_entregar_grava_data_e_baixa_cada_sku(client, db):
    p, m, pedido = _cenario(db)
    ontem = hoje() - timedelta(days=1)
    resposta = _entregar(client, pedido, data_entrega=ontem.isoformat())
    assert resposta.status_code == 200
    assert resposta.json()["data_entrega_realizada"] == ontem.isoformat()
    db.refresh(p)
    db.refresh(m)
    assert (p.saldo, m.saldo) == (6, 0)
    movimentos = db.query(CamisetaMovimentoEstoque).order_by(CamisetaMovimentoEstoque.id_movimento).all()
    assert [(mv.tipo, mv.quantidade, mv.id_pedido) for mv in movimentos] == [
        ("SAIDA_ENTREGA", -4, pedido.id_pedido), ("SAIDA_ENTREGA", -5, pedido.id_pedido)]


def test_entregar_sem_data_usa_hoje(client, db):
    _, _, pedido = _cenario(db)
    assert _entregar(client, pedido).json()["data_entrega_realizada"] == hoje().isoformat()


def test_entregar_com_data_futura_retorna_400(client, db):
    _, _, pedido = _cenario(db)
    assert _entregar(client, pedido, data_entrega=(hoje() + timedelta(days=1)).isoformat()).status_code == 400


def test_entregar_com_falta_retorna_409_com_a_lista_e_nao_baixa(client, db):
    p, m, pedido = _cenario(db, saldo_m=2)
    resposta = _entregar(client, pedido)
    assert resposta.status_code == 409
    detalhe = resposta.json()["detail"]
    assert detalhe["mensagem"] == "Estoque pronto insuficiente para este pedido."
    assert detalhe["faltas"] == [
        {"id_variacao": m.id_variacao, "sku": "Camiseta Básica · Preto · M", "necessario": 5, "disponivel": 2}]
    db.refresh(p)
    assert p.saldo == 10
    assert db.query(CamisetaMovimentoEstoque).count() == 0


def test_sku_que_nunca_teve_estoque_aparece_na_falta(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    pedido = criar_pedido_com_itens(db, modelo, preto, {"GG": 3})
    faltas = _entregar(client, pedido).json()["detail"]["faltas"]
    assert faltas == [{"id_variacao": None, "sku": "Camiseta Básica · Preto · GG", "necessario": 3, "disponivel": 0}]


def test_entregar_item_sem_cor_retorna_400(client, db):
    pedido = criar_pedido_com_itens(db, criar_modelo(db), None, {"P": 2})
    resposta = _entregar(client, pedido)
    assert resposta.status_code == 400
    assert "Defina a cor" in resposta.json()["detail"]


def test_pedido_sem_itens_nao_pode_ser_entregue(client, db):
    assert _entregar(client, criar_pedido(db, criar_modelo(db))).status_code == 400


def test_reverter_entrega_devolve_ao_estoque_e_limpa_a_data(client, db):
    p, m, pedido = _cenario(db)
    _entregar(client, pedido)
    resposta = _reverter(client, pedido)
    assert resposta.status_code == 200
    assert resposta.json()["data_entrega_realizada"] is None
    db.refresh(p)
    db.refresh(m)
    assert (p.saldo, m.saldo) == (10, 5)
    estornos = db.query(CamisetaMovimentoEstoque).filter_by(tipo="ESTORNO_ENTREGA").all()
    assert sorted(e.quantidade for e in estornos) == [4, 5]


def test_entregar_de_novo_depois_de_reverter(client, db):
    p, m, pedido = _cenario(db)
    _entregar(client, pedido)
    _reverter(client, pedido)
    assert _entregar(client, pedido).status_code == 200
    db.refresh(p)
    db.refresh(m)
    assert (p.saldo, m.saldo) == (6, 0)


def test_reverter_pedido_entregue_antes_da_fase_1b_nao_mexe_no_estoque(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "P", saldo=7)
    pedido = criar_pedido_com_itens(db, modelo, None, {"P": 4}, status="Entregue", data_entrega_realizada=date(2026, 10, 5))
    assert _reverter(client, pedido).status_code == 200
    db.refresh(variacao)
    assert variacao.saldo == 7
    assert db.query(CamisetaMovimentoEstoque).count() == 0


def test_grade_negativa_e_recusada(client, db):
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json={
        "nome_cliente": "Loja", "id_modelo": modelo.id_modelo,
        "grade_p": -5, "grade_m": 10, "grade_g": 0, "grade_gg": 0,
        "prazo_entrega": (hoje() + timedelta(days=3)).isoformat(), "valor_total": "100",
    })
    assert resposta.status_code == 422
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_pedidos.py -q`
Expected: FAIL — a entrega ainda consulta `camisetas_produtos_acabados` (400 "Estoque pronto insuficiente…" em vez de baixar os SKUs).

- [ ] **Step 3: Entrega, estorno e status no serviço**

Acrescentar a `backend/app/services/camisetas/pedidos.py` (imports: `dataclass`, `Optional`, `CamisetaPedidoEntregar`, `CamisetaMovimentoEstoque`, `CamisetaVariacao`, e de `sku`: `ESTORNO_ENTREGA`, `SAIDA_ENTREGA`, `buscar_variacao`, `movimentar`):

```python
@dataclass(frozen=True)
class Baixa:
    """O que a entrega tira de um SKU."""
    sku: str
    variacao: Optional[CamisetaVariacao]
    necessario: int

    @property
    def disponivel(self) -> int:
        return self.variacao.saldo if self.variacao is not None else 0

    def para_falta(self) -> dict:
        return {
            "id_variacao": self.variacao.id_variacao if self.variacao is not None else None,
            "sku": self.sku, "necessario": self.necessario, "disponivel": self.disponivel,
        }


def _baixas_do_pedido(db: Session, pedido: CamisetaPedido) -> list[Baixa]:
    return [
        Baixa(
            sku=f"{item.modelo.nome_modelo} · {item.cor.nome} · {qtd.tamanho.rotulo}",
            variacao=buscar_variacao(db, item.id_modelo, item.id_cor, qtd.id_tamanho),
            necessario=qtd.quantidade,
        )
        for item in pedido.itens
        for qtd in sorted(item.quantidades, key=lambda q: q.tamanho.ordem)
    ]


def _validar_para_entrega(pedido: CamisetaPedido, data_entrega: date, hoje: date) -> None:
    if pedido.status_pedido == STATUS_ENTREGUE:
        raise ErroNegocio(400, "Este pedido já foi registrado como Entregue anteriormente.")
    if data_entrega > hoje:
        raise ErroNegocio(400, "A data da entrega não pode ser futura.")
    if not pedido.itens:
        raise ErroNegocio(400, "O pedido não tem itens para entregar.")
    sem_cor = [item.modelo.nome_modelo for item in pedido.itens if item.id_cor is None]
    if sem_cor:
        raise ErroNegocio(400, f"Defina a cor dos itens antes de entregar: {', '.join(sem_cor)}.")


def _nota_de_entrega(data_entrega: date, dados: CamisetaPedidoEntregar) -> str:
    recebedor = f" | Recebido por: {dados.recebedor}" if dados.recebedor else ""
    obs_extra = f" | Obs: {dados.observacoes}" if dados.observacoes else ""
    return f"\n[ENTREGA REALIZADA em {data_entrega.strftime('%d/%m/%Y')}{recebedor}{obs_extra}]"


def registrar_entrega(db: Session, id_pedido: int, dados: CamisetaPedidoEntregar, hoje: date) -> CamisetaPedido:
    """Confere o saldo de cada SKU do pedido, baixa tudo e grava a data real da entrega."""
    pedido = obter_pedido(db, id_pedido)
    data_entrega = dados.data_entrega or hoje
    _validar_para_entrega(pedido, data_entrega, hoje)
    baixas = _baixas_do_pedido(db, pedido)
    faltas = [b.para_falta() for b in baixas if b.disponivel < b.necessario]
    if faltas:
        raise ErroNegocio(409, "Estoque pronto insuficiente para este pedido.", {"faltas": faltas})
    for baixa in baixas:
        movimentar(db, baixa.variacao, -baixa.necessario, SAIDA_ENTREGA,
                   motivo=f"Entrega do pedido {pedido.codigo_pedido}", id_pedido=pedido.id_pedido)
    pedido.observacoes = (pedido.observacoes or "") + _nota_de_entrega(data_entrega, dados)
    pedido.status_pedido = STATUS_ENTREGUE
    pedido.data_entrega_realizada = data_entrega
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return pedido


def estornar_entrega(db: Session, pedido: CamisetaPedido) -> None:
    """Devolve o que as saídas deste pedido tiraram. Pedidos entregues antes da Fase 1B não têm saídas: nada muda."""
    liquido: dict[int, int] = {}
    movimentos = db.query(CamisetaMovimentoEstoque).filter(
        CamisetaMovimentoEstoque.id_pedido == pedido.id_pedido,
        CamisetaMovimentoEstoque.tipo.in_((SAIDA_ENTREGA, ESTORNO_ENTREGA)),
    ).all()
    for movimento in movimentos:
        liquido[movimento.id_variacao] = liquido.get(movimento.id_variacao, 0) + movimento.quantidade
    for id_variacao, quantidade in liquido.items():
        if quantidade < 0:
            movimentar(db, db.get(CamisetaVariacao, id_variacao), -quantidade, ESTORNO_ENTREGA,
                       motivo=f"Entrega do pedido {pedido.codigo_pedido} revertida", id_pedido=pedido.id_pedido)


def atualizar_status(db: Session, id_pedido: int, novo_status: str) -> CamisetaPedido:
    pedido = obter_pedido(db, id_pedido)
    if novo_status not in STATUS_VALIDOS:
        raise ErroNegocio(400, f"Status inválido: '{novo_status}'. Use um destes: {', '.join(STATUS_VALIDOS)}.")
    if novo_status == STATUS_ENTREGUE and pedido.status_pedido != STATUS_ENTREGUE:
        raise ErroNegocio(
            400, "Para marcar o pedido como Entregue, use 'Registrar entrega': ela confere o estoque pronto antes da baixa.")
    if pedido.status_pedido == STATUS_ENTREGUE and novo_status != STATUS_ENTREGUE:
        estornar_entrega(db, pedido)
        pedido.data_entrega_realizada = None
    pedido.status_pedido = novo_status
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return pedido
```

Atualizar a docstring do módulo para "criação com itens, edição de itens, entrega e estorno por SKU".

- [ ] **Step 4: Router final**

`backend/app/routers/camisetas/pedidos.py` (substitui o arquivo inteiro):

```python
# app/routers/camisetas/pedidos.py
"""Pedidos de clientes do segmento Camisetas (a lógica fica em services/camisetas/pedidos.py)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.camisetas import CamisetaPedido, CamisetaProdutoAcabado
from app.schemas.camisetas import (
    CamisetaPedidoCreate,
    CamisetaPedidoEntregar,
    CamisetaPedidoResponse,
    CamisetaPedidoStatusUpdate,
    CamisetaProdutoAcabadoResponse,
)
from app.schemas.camisetas_sku import PedidoItensEntrada
from app.services.camisetas.pedidos import (
    atualizar_status,
    criar_pedido,
    excluir_pedido,
    hoje_local,
    montar_resposta_pedido,
    registrar_entrega,
    substituir_itens,
)

router = APIRouter()


@router.get("/pedidos/", response_model=List[CamisetaPedidoResponse])
def listar_pedidos(db: Session = Depends(get_db)):
    pedidos = db.query(CamisetaPedido).order_by(CamisetaPedido.id_pedido.desc()).all()
    return [montar_resposta_pedido(p) for p in pedidos]


@router.post("/pedidos/", response_model=CamisetaPedidoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_pedido(pedido_in: CamisetaPedidoCreate, db: Session = Depends(get_db)):
    """Cria o pedido com itens (modelo + cor + quantidade por tamanho)."""
    return montar_resposta_pedido(criar_pedido(db, pedido_in, hoje_local()))


@router.put("/pedidos/{id_pedido}/itens", response_model=CamisetaPedidoResponse)
def editar_itens_pedido(id_pedido: int, dados: PedidoItensEntrada, db: Session = Depends(get_db)):
    """Substitui os itens de um pedido ainda não entregue (é assim que um pedido antigo recebe a cor)."""
    return montar_resposta_pedido(substituir_itens(db, id_pedido, dados))


@router.put("/pedidos/{id_pedido}/status", response_model=CamisetaPedidoResponse)
def atualizar_status_pedido(id_pedido: int, status_in: CamisetaPedidoStatusUpdate, db: Session = Depends(get_db)):
    """Muda o status; sair de Entregue devolve as peças ao estoque de cada SKU."""
    return montar_resposta_pedido(atualizar_status(db, id_pedido, status_in.status_pedido))


@router.post("/pedidos/{id_pedido}/entregar", response_model=CamisetaPedidoResponse)
def registrar_entrega_pedido(id_pedido: int, dados_entrega: CamisetaPedidoEntregar, db: Session = Depends(get_db)):
    """Registra a entrega: confere e baixa o estoque de cada SKU e grava a data real da entrega."""
    return montar_resposta_pedido(registrar_entrega(db, id_pedido, dados_entrega, hoje_local()))


@router.delete("/pedidos/{id_pedido}")
def excluir_pedido_camiseta(id_pedido: int, db: Session = Depends(get_db)):
    """Exclui um pedido (com seus itens). Pedido entregue não pode ser excluído."""
    return {"mensagem": f"Pedido {excluir_pedido(db, id_pedido)} excluído com sucesso!"}


@router.get("/estoque-acabado/", response_model=List[CamisetaProdutoAcabadoResponse])
def listar_estoque_acabado(db: Session = Depends(get_db)):
    """Tabela antiga (antes da Fase 1B), mantida só como histórico."""
    return [
        CamisetaProdutoAcabadoResponse(
            id_estoque_acabado=ac.id_estoque_acabado,
            id_modelo=ac.id_modelo,
            nome_modelo=ac.modelo.nome_modelo if ac.modelo else "Modelo Geral",
            grade_p=ac.grade_p or 0,
            grade_m=ac.grade_m or 0,
            grade_g=ac.grade_g or 0,
            grade_gg=ac.grade_gg or 0,
            quantidade_total=ac.quantidade_total or 0,
            atualizado_em=ac.atualizado_em,
        )
        for ac in db.query(CamisetaProdutoAcabado).all()
    ]
```

- [ ] **Step 5: Retirar o código da tabela antiga**

Em `backend/app/services/camisetas/estoque.py`, apagar `CAMPOS_GRADE`, `obter_ou_criar_estoque_acabado`, `baixar_estoque_acabado`, `devolver_estoque_acabado` e o import de `CamisetaProdutoAcabado`/`get_utc_now` que ficar sem uso. Em `backend/tests/fabricas.py`, apagar `criar_estoque_acabado` (e o import de `CamisetaProdutoAcabado`).

Run: `cd backend && grep -rn "estoque_acabado\|CAMPOS_GRADE" app tests | grep -v "listar_estoque_acabado\|estoque-acabado"`
Expected: nenhuma linha.

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_pedidos.py -q && venv/bin/python -m pytest -q`
Expected: PASS em tudo.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/camisetas/pedidos.py backend/app/services/camisetas/estoque.py \
  backend/app/routers/camisetas/pedidos.py backend/tests/test_pedidos.py backend/tests/fabricas.py
git commit -m "feat: entrega e estorno do pedido pelo estoque de cada SKU" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Proteções de grade e cor, tamanhos com id no modelo, dashboard e seed

**Files:**
- Modify: `backend/app/services/camisetas/grades.py`, `backend/app/services/camisetas/modelos.py`, `backend/app/services/camisetas/cores.py`
- Modify: `backend/app/schemas/camisetas.py` (`CamisetaModeloResponse.grade_tamanhos`)
- Modify: `backend/app/routers/camisetas/dashboard.py`, `backend/app/routers/camisetas/seed.py`
- Test: `backend/tests/test_grades.py`, `backend/tests/test_cores.py`, `backend/tests/test_dashboard.py`, `backend/tests/test_seed.py` (novo)

**Interfaces:**
- Consumes: modelos da Task 1; `registrar_inventario` (Task 3); `TamanhoResponse`.
- Produces: `CamisetaModeloResponse.grade_tamanhos: List[TamanhoResponse]` (usado por todas as telas da Fase 1B para montar as colunas de tamanho); 409 ao remover tamanho em uso, trocar grade de modelo em uso ou excluir cor em uso; seed com cores, pedidos com itens e estoque por inventário.

- [ ] **Step 1: Testes que falham**

Acrescentar a `backend/tests/test_grades.py` (importar `criar_cor`, `criar_pedido_com_itens`, `criar_variacao`, `tamanho` das fábricas):

```python
def _editar_grade(client, modelo, tamanhos):
    return client.put(f"/camisetas/grades/{modelo.id_grade}", json={"nome": "Adulto (P, M, G, GG)", "tamanhos": tamanhos})


def test_api_remover_tamanho_com_estoque_retorna_409(client, db):
    modelo = criar_modelo(db)
    criar_variacao(db, modelo, criar_cor(db), "GG", saldo=1)
    resposta = _editar_grade(client, modelo, ["P", "M", "G"])
    assert resposta.status_code == 409
    assert "O tamanho GG tem pedidos ou estoque" in resposta.json()["detail"]


def test_api_remover_tamanho_com_pedido_retorna_409(client, db):
    modelo = criar_modelo(db)
    criar_pedido_com_itens(db, modelo, None, {"P": 3})
    assert _editar_grade(client, modelo, ["M", "G", "GG"]).status_code == 409


def test_api_remover_tamanho_livre_continua_permitido(client, db):
    modelo = criar_modelo(db)
    criar_variacao(db, modelo, criar_cor(db), "P")
    assert _editar_grade(client, modelo, ["P", "M", "G"]).status_code == 200


def test_api_trocar_grade_de_modelo_em_uso_retorna_409(client, db):
    modelo = criar_modelo(db, nome="Básica")
    criar_variacao(db, modelo, criar_cor(db), "P")
    babylook = client.post("/camisetas/grades/", json={"nome": "Babylook", "tamanhos": ["PP", "P"]}).json()
    resposta = client.put(f"/camisetas/modelos/{modelo.id_modelo}", json={
        "nome_modelo": "Básica", "consumo_tecido_kg": "0.18", "id_grade": babylook["id_grade"]})
    assert resposta.status_code == 409


def test_api_modelo_traz_os_tamanhos_com_id(client, db):
    modelo = criar_modelo(db)
    corpo = client.get("/camisetas/modelos/").json()[0]
    assert [t["rotulo"] for t in corpo["grade_tamanhos"]] == ["P", "M", "G", "GG"]
    assert corpo["grade_tamanhos"][0]["id_tamanho"] == tamanho(modelo, "P").id_tamanho
```

Acrescentar a `backend/tests/test_cores.py` (importar `Decimal`, `CamisetaOpCor` de `app.models.camisetas_sku` e das fábricas `criar_modelo`, `criar_op_cortada`, `criar_pedido_com_itens`, `criar_variacao`):

```python
def test_api_excluir_cor_usada_por_estoque_pedido_ou_op_retorna_409(client, db):
    modelo = criar_modelo(db)
    preto, branco, azul = criar_cor(db), criar_cor(db, "Branco", "#FFFFFF"), criar_cor(db, "Azul", "#0000FF")
    criar_variacao(db, modelo, preto, "P")
    criar_pedido_com_itens(db, modelo, branco, {"P": 1})
    op = criar_op_cortada(db, modelo)
    db.add(CamisetaOpCor(id_op=op.id_op, id_cor=azul.id_cor, peso_kg=Decimal("1.000")))
    db.commit()
    for cor in (preto, branco, azul):
        resposta = client.delete(f"/camisetas/cores/{cor.id_cor}")
        assert resposta.status_code == 409
        assert "inative-a" in resposta.json()["detail"]
```

Acrescentar a `backend/tests/test_dashboard.py` (importar `criar_cor`, `criar_variacao`):

```python
def test_estoque_pronto_soma_os_skus(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    criar_variacao(db, modelo, preto, "P", saldo=7)
    criar_variacao(db, modelo, preto, "M", saldo=5)
    assert client.get("/camisetas/dashboard/").json()["cards"]["estoque_pronto_total"] == 12
```

`backend/tests/test_seed.py`:

```python
def test_seed_cria_cores_pedidos_com_itens_e_estoque_por_sku(client):
    assert client.post("/camisetas/seed-inicial").status_code == 200
    linhas = client.get("/camisetas/produtos-prontos/").json()
    assert [(l["nome_cor"], l["total"]) for l in linhas] == [("Preto", 350)]
    pedidos = client.get("/camisetas/pedidos/").json()
    assert sorted(p["itens"][0]["nome_cor"] for p in pedidos) == ["Branco", "Preto"]
    rolos = client.get("/camisetas/insumos/", params={"categoria": "ROLO_TECIDO"}).json()
    assert all(r["id_cor"] for r in rolos)
    movimentos = client.get("/camisetas/produtos-prontos/movimentos/").json()
    assert {m["motivo"] for m in movimentos} == {"Carga de demonstração"}
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_grades.py tests/test_cores.py tests/test_dashboard.py tests/test_seed.py -q`
Expected: FAIL — grades e modelos aceitam a mudança (200), cor é excluída (200), `grade_tamanhos` não existe, dashboard soma a tabela antiga, seed sem itens.

- [ ] **Step 3: Proteção de tamanhos na grade**

Em `backend/app/services/camisetas/grades.py` (importar `CamisetaPedidoItemQtd`, `CamisetaVariacao` de `app.models.camisetas_sku`):

```python
def _tamanho_em_uso(db: Session, id_tamanho: int) -> bool:
    return (
        db.query(CamisetaVariacao.id_variacao).filter_by(id_tamanho=id_tamanho).first() is not None
        or db.query(CamisetaPedidoItemQtd.id_item).filter_by(id_tamanho=id_tamanho).first() is not None
    )


def _proteger_tamanhos_em_uso(db: Session, grade: CamisetaGrade, rotulos: list[str]) -> None:
    for tamanho in grade.tamanhos:
        if tamanho.rotulo not in rotulos and _tamanho_em_uso(db, tamanho.id_tamanho):
            raise ErroNegocio(409, f"O tamanho {tamanho.rotulo} tem pedidos ou estoque e não pode sair da grade.")
```

E `atualizar_grade` passa a validar antes de alterar qualquer campo:

```python
def atualizar_grade(db: Session, id_grade: int, dados: GradeEntrada) -> CamisetaGrade:
    grade = obter_grade(db, id_grade)
    rotulos = limpar_tamanhos(dados.tamanhos)
    _proteger_tamanhos_em_uso(db, grade, rotulos)
    grade.nome = _validar_nome(db, dados.nome, id_grade)
    grade.ativo = dados.ativo
    aplicar_tamanhos(grade, rotulos)
    db.flush()
    _sincronizar_modelos(db, grade)
    db.commit()
    db.refresh(grade)
    return grade
```

- [ ] **Step 4: Modelo (troca de grade e tamanhos com id)**

Em `backend/app/schemas/camisetas.py`, `CamisetaModeloResponse` ganha `grade_tamanhos: List[TamanhoResponse] = Field(default_factory=list)`.

Em `backend/app/services/camisetas/modelos.py` (importar `CamisetaPedidoItem`, `CamisetaVariacao` e `TamanhoResponse`):

```python
def _modelo_em_uso(db: Session, id_modelo: int) -> bool:
    return (
        db.query(CamisetaVariacao.id_variacao).filter_by(id_modelo=id_modelo).first() is not None
        or db.query(CamisetaPedidoItem.id_item).filter_by(id_modelo=id_modelo).first() is not None
    )
```

- em `montar_resposta_modelo`, acrescentar
  `grade_tamanhos=[TamanhoResponse(id_tamanho=t.id_tamanho, rotulo=t.rotulo) for t in sorted(grade.tamanhos, key=lambda t: t.ordem)] if grade else []`;
- em `atualizar_modelo`, logo depois de buscar o modelo (antes de mudar qualquer campo):

```python
    trocando_grade = dados.id_grade is not None and dados.id_grade != modelo.id_grade
    if trocando_grade and _modelo_em_uso(db, id_modelo):
        raise ErroNegocio(
            409,
            f"O modelo {modelo.nome_modelo} já tem pedidos ou estoque por tamanho; a grade não pode ser trocada. "
            "Acrescente os tamanhos que faltam na grade atual.",
        )
```

- [ ] **Step 5: Cor em uso**

Em `backend/app/services/camisetas/cores.py` (importar `CamisetaOpCor`, `CamisetaPedidoItem`, `CamisetaVariacao`):

```python
MODELOS_QUE_USAM_COR = (CamisetaVariacao, CamisetaPedidoItem, CamisetaOpCor)


def excluir_cor(db: Session, id_cor: int) -> None:
    cor = obter_cor(db, id_cor)
    if db.query(CamisetaInsumo.id_insumo).filter_by(id_cor=id_cor).first() is not None:
        raise ErroNegocio(409, "Cor em uso por malhas do estoque; inative-a em vez de excluir.")
    if any(db.query(modelo).filter_by(id_cor=id_cor).first() is not None for modelo in MODELOS_QUE_USAM_COR):
        raise ErroNegocio(409, "Cor em uso por estoque pronto, pedidos ou produção; inative-a em vez de excluir.")
    db.delete(cor)
    db.commit()
```

- [ ] **Step 6: Dashboard**

Em `backend/app/routers/camisetas/dashboard.py`: trocar o import de `CamisetaProdutoAcabado` por `from app.models.camisetas_sku import CamisetaVariacao` e a linha do estoque por `total_estoque_pronto = _soma(db, CamisetaVariacao.saldo)`.

- [ ] **Step 7: Seed de demonstração**

Em `backend/app/routers/camisetas/seed.py`:
- imports: retirar `CamisetaProdutoAcabado`; acrescentar `CamisetaCor` (`app.models.camisetas_cadastros`), `CamisetaPedidoItem`, `CamisetaPedidoItemQtd`, `CamisetaVariacao` (`app.models.camisetas_sku`), `ContagemInventario`, `InventarioEntrada` (`app.schemas.camisetas_sku`) e `registrar_inventario` (`app.services.camisetas.produtos_prontos`);
- acrescentar, depois de `router = APIRouter()`:

```python
CORES_DEMONSTRACAO = (("Preto", "#1F1F1F"), ("Branco", "#FFFFFF"), ("Azul Marinho", "#1F2A44"))
COR_DOS_ROLOS = {"MALHA-01": "Preto", "MALHA-02": "Branco", "MALHA-03": "Azul Marinho"}
ROTULOS_DEMONSTRACAO = ("P", "M", "G", "GG")
ESTOQUE_DEMONSTRACAO = {"P": 60, "M": 120, "G": 120, "GG": 50}


def _semear_cores(db: Session) -> dict:
    """Cores de demonstração, ligadas aos rolos de malha que ainda não têm cor."""
    if db.query(CamisetaCor).count() == 0:
        db.add_all([CamisetaCor(nome=nome, hex=hex_cor, ativo=True) for nome, hex_cor in CORES_DEMONSTRACAO])
        db.flush()
    por_nome = {c.nome: c for c in db.query(CamisetaCor).all()}
    rolos = db.query(CamisetaInsumo).filter(
        CamisetaInsumo.codigo.in_(COR_DOS_ROLOS), CamisetaInsumo.id_cor.is_(None)).all()
    for rolo in rolos:
        cor = por_nome.get(COR_DOS_ROLOS[rolo.codigo])
        if cor is not None:
            rolo.id_cor = cor.id_cor
    db.commit()
    return por_nome


def _itens_demonstracao(modelo, cor, grade) -> list:
    if cor is None or modelo.grade is None:
        return []
    tamanhos = {t.rotulo: t.id_tamanho for t in modelo.grade.tamanhos}
    return [CamisetaPedidoItem(id_modelo=modelo.id_modelo, id_cor=cor.id_cor, quantidades=[
        CamisetaPedidoItemQtd(id_tamanho=tamanhos[rotulo], quantidade=qtd)
        for rotulo, qtd in zip(ROTULOS_DEMONSTRACAO, grade) if qtd > 0 and rotulo in tamanhos
    ])]


def _semear_estoque_pronto(db: Session, modelo, cor) -> None:
    if db.query(CamisetaVariacao).count() > 0 or modelo is None or cor is None or modelo.grade is None:
        return
    tamanhos = {t.rotulo: t.id_tamanho for t in modelo.grade.tamanhos}
    registrar_inventario(db, InventarioEntrada(motivo="Carga de demonstração", contagens=[
        ContagemInventario(id_modelo=modelo.id_modelo, id_cor=cor.id_cor, id_tamanho=tamanhos[rotulo], quantidade_contada=qtd)
        for rotulo, qtd in ESTOQUE_DEMONSTRACAO.items() if rotulo in tamanhos
    ]))
```

- no corpo de `seed_camisetas`: logo depois do passo "2. Insumos", chamar `cores = _semear_cores(db)`;
- no passo "4. Pedidos", em `ped1` e `ped2`: zerar `grade_p/m/g/gg` e acrescentar `itens=_itens_demonstracao(m1, cores.get("Preto"), (25, 50, 50, 25))` (ped1) e `itens=_itens_demonstracao(m1, cores.get("Branco"), (40, 80, 60, 20))` (ped2);
- substituir o bloco "5.1 Saldo inicial de Estoque de Produtos Acabados" inteiro por
  `_semear_estoque_pronto(db, db.query(CamisetaModelo).first(), cores.get("Preto"))`.

- [ ] **Step 8: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_grades.py tests/test_cores.py tests/test_dashboard.py tests/test_seed.py -q && venv/bin/python -m pytest -q`
Expected: PASS em tudo.

Run: `cd backend && venv/bin/python -m pytest --cov=app/services --cov-report=term-missing -q`
Expected: cobertura total de `app/services` ≥ 80%; se algum arquivo novo ficar abaixo de 80%, acrescentar o teste que falta (ex.: modelo inexistente no inventário → 404).

- [ ] **Step 9: Commit**

```bash
git add backend/app backend/tests
git commit -m "feat: proteções de grade e cor, tamanhos no modelo, dashboard e seed por SKU" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Grade de quantidades e página Produtos Prontos

**Files:**
- Create: `frontend-alfa/src/utils/grade.js`, `frontend-alfa/src/utils/produtosProntos.js`
- Create: `frontend-alfa/src/components/producao/GradeQuantidades.jsx`, `frontend-alfa/src/components/producao/ModalProducao.jsx`, `frontend-alfa/src/components/producao/producao.css`
- Create: `frontend-alfa/src/components/produtos/HistoricoMovimentos.jsx`, `PainelSku.jsx`, `BarraInventario.jsx`
- Create: `frontend-alfa/src/pages/ProdutosProntosCamisetas.jsx`, `frontend-alfa/src/pages/ProdutosProntosCamisetas.css`
- Modify: `frontend-alfa/src/App.jsx` (rota), `frontend-alfa/src/components/Sidebar.jsx` (itens 8 e 9), `frontend-alfa/src/pages/RegistroFinanceiroCamisetas.jsx:176` (título "9."), `frontend-alfa/src/index.css` (recebe `.sr-only`), `frontend-alfa/src/pages/ClientesCamisetas.css:128-135` (perde `.sr-only`)

**Interfaces:**
- Consumes: `GET /camisetas/produtos-prontos/`, `POST .../inventario`, `POST .../ajustes`, `PUT .../variacoes/{id}/minimo`, `GET .../movimentos/`, `GET /camisetas/modelos/` (com `grade_tamanhos`), `GET /camisetas/cores/`.
- Produces: `chaveCelula(linha, coluna)`, `somarValores(valores)`, `valoresParaLista(valores, {soPositivos})` → `[{linha, coluna, quantidade}]`; `<GradeQuantidades linhas colunas valores onChange? maximos? alertas? onCelulaClick? legenda idPrefixo />` (rótulo acessível de cada campo: "`<linha.rotulo>`, tamanho `<coluna.rotulo>`"); `<ModalProducao titulo idTitulo onFechar largo?>`.

- [ ] **Step 1: Funções puras da grade**

`frontend-alfa/src/utils/grade.js`:

```js
/** Chave de uma célula da grade: "linha:coluna" (ex.: "3:12" = cor 3, tamanho 12). */
export const chaveCelula = (linha, coluna) => `${linha}:${coluna}`;

/** Soma os valores numéricos de um mapa {chave: número | ""}. */
export const somarValores = (valores) =>
  Object.values(valores).reduce((total, valor) => total + (Number(valor) || 0), 0);

/**
 * Converte {"linha:coluna": quantidade} em [{ linha, coluna, quantidade }] (linha e coluna numéricas).
 * Com `soPositivos` (padrão), descarta zeros e campos vazios.
 */
export function valoresParaLista(valores, { soPositivos = true } = {}) {
  return Object.entries(valores)
    .map(([chave, quantidade]) => {
      const [linha, coluna] = chave.split(':');
      return { linha: Number(linha), coluna: Number(coluna), quantidade: Number(quantidade) || 0 };
    })
    .filter((item) => !soPositivos || item.quantidade > 0);
}
```

`frontend-alfa/src/utils/produtosProntos.js`:

```js
import { chaveCelula } from './grade';

const colunasDe = (tamanhos) => tamanhos.map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }));
const celulasDa = (linha) => linha.tamanhos.map((t) => ({ ...t, id_cor: linha.id_cor, chave: chaveCelula(linha.id_cor, t.id_tamanho) }));

/** Agrupa as linhas da API (uma por modelo × cor) em cartões por modelo, mantendo a ordem. */
export function agruparPorModelo(linhas) {
  return linhas.reduce((grupos, linha) => {
    const linhaGrade = { id: linha.id_cor, rotulo: linha.nome_cor, hex: linha.hex_cor };
    const existente = grupos.find((g) => g.id_modelo === linha.id_modelo);
    if (!existente) {
      return [...grupos, {
        id_modelo: linha.id_modelo, nome_modelo: linha.nome_modelo, colunas: colunasDe(linha.tamanhos),
        linhas: [linhaGrade], celulas: celulasDa(linha),
      }];
    }
    return grupos.map((g) => (g === existente
      ? { ...g, linhas: [...g.linhas, linhaGrade], celulas: [...g.celulas, ...celulasDa(linha)] }
      : g));
  }, []);
}

export const valoresDoGrupo = (grupo) => Object.fromEntries(grupo.celulas.map((c) => [c.chave, c.saldo]));
export const alertasDoGrupo = (grupo) => Object.fromEntries(grupo.celulas.map((c) => [c.chave, c.abaixo_minimo]));
export const celulaDoGrupo = (grupo, idCor, idTamanho) => grupo.celulas.find((c) => c.chave === chaveCelula(idCor, idTamanho));

/** Valores iniciais da contagem: o saldo atual de cada célula, separados por modelo. */
export const valoresIniciaisInventario = (grupos) => Object.fromEntries(grupos.map((g) => [g.id_modelo, valoresDoGrupo(g)]));

/** Inclui no inventário uma cor de um modelo (mesmo sem estoque ainda). */
export function acrescentarLinha(grupos, modelo, cor) {
  const linha = { id: cor.id_cor, rotulo: cor.nome, hex: cor.hex };
  const existente = grupos.find((g) => g.id_modelo === modelo.id_modelo);
  if (existente?.linhas.some((l) => l.id === cor.id_cor)) return grupos;
  if (existente) return grupos.map((g) => (g === existente ? { ...g, linhas: [...g.linhas, linha] } : g));
  return [...grupos, {
    id_modelo: modelo.id_modelo, nome_modelo: modelo.nome_modelo,
    colunas: colunasDe(modelo.grade_tamanhos || []), linhas: [linha], celulas: [],
  }];
}

/** Contagens para a API: só as células preenchidas (em branco = não contado). */
export function contagensDoInventario(grupos, valoresPorModelo) {
  return grupos.flatMap((grupo) => grupo.linhas.flatMap((linha) => grupo.colunas
    .map((coluna) => ({ coluna, texto: valoresPorModelo[grupo.id_modelo]?.[chaveCelula(linha.id, coluna.id)] }))
    .filter(({ texto }) => texto !== undefined && texto !== '')
    .map(({ coluna, texto }) => ({
      id_modelo: grupo.id_modelo, id_cor: linha.id, id_tamanho: coluna.id, quantidade_contada: Number(texto) || 0,
    }))));
}
```

- [ ] **Step 2: Componente de grade e moldura de modal**

`frontend-alfa/src/components/producao/GradeQuantidades.jsx`:

```jsx
import { chaveCelula } from '../../utils/grade';
import './producao.css';

const numero = (valor) => Number(valor) || 0;

function CelulaEditavel({ id, rotulo, valor, maximo, onAlterar }) {
  const excede = maximo !== undefined && numero(valor) > maximo;
  return (
    <td>
      <input
        id={id}
        type="number"
        min="0"
        max={maximo}
        inputMode="numeric"
        className={`grade-qtd-campo${excede ? ' excede' : ''}`}
        aria-label={rotulo}
        aria-invalid={excede || undefined}
        value={valor ?? ''}
        disabled={maximo === 0}
        onChange={(e) => onAlterar(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value, 10) || 0))}
      />
      {maximo > 0 && <small className="grade-qtd-maximo">de {maximo}</small>}
    </td>
  );
}

function CelulaLeitura({ rotulo, valor, alerta, onClick }) {
  const quantidade = numero(valor);
  return (
    <td className={alerta ? 'grade-qtd-alerta' : undefined}>
      {onClick ? (
        <button type="button" className="grade-qtd-celula" aria-label={`${rotulo}: ${quantidade} peças`} onClick={onClick}>
          {quantidade}
        </button>
      ) : quantidade}
    </td>
  );
}

/**
 * Grade de quantidades: linhas (cores) × colunas (tamanhos), com totais por linha e por coluna.
 * Editável quando recebe `onChange`; só leitura caso contrário (células clicáveis com `onCelulaClick`).
 * @param {{
 *   linhas: Array<{id: number|string, rotulo: string, hex?: string}>,
 *   colunas: Array<{id: number, rotulo: string}>,
 *   valores: Record<string, number|string>,
 *   onChange?: (valores: Record<string, number|string>) => void,
 *   maximos?: Record<string, number>,
 *   alertas?: Record<string, boolean>,
 *   onCelulaClick?: (linhaId: number|string, colunaId: number) => void,
 *   legenda: string,
 *   idPrefixo: string,
 * }} props
 */
export function GradeQuantidades({ linhas, colunas, valores, onChange, maximos = {}, alertas = {}, onCelulaClick, legenda, idPrefixo }) {
  const valorDe = (linha, coluna) => valores[chaveCelula(linha.id, coluna.id)];
  const totalLinha = (linha) => colunas.reduce((total, coluna) => total + numero(valorDe(linha, coluna)), 0);
  const totalColuna = (coluna) => linhas.reduce((total, linha) => total + numero(valorDe(linha, coluna)), 0);
  const alterar = (linha, coluna, valor) => onChange({ ...valores, [chaveCelula(linha.id, coluna.id)]: valor });

  return (
    <div className="grade-qtd-rolagem">
      <table className="grade-qtd">
        <caption className="sr-only">{legenda}</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Cor</span></th>
            {colunas.map((coluna) => <th key={coluna.id} scope="col">{coluna.rotulo}</th>)}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.id}>
              <th scope="row">
                {linha.hex && <span className="cadastro-amostra" style={{ background: linha.hex }} aria-hidden="true" />}
                {linha.rotulo}
              </th>
              {colunas.map((coluna) => {
                const chave = chaveCelula(linha.id, coluna.id);
                const rotulo = `${linha.rotulo}, tamanho ${coluna.rotulo}`;
                return onChange ? (
                  <CelulaEditavel key={coluna.id} id={`${idPrefixo}-${chave}`} rotulo={rotulo} valor={valores[chave]}
                    maximo={maximos[chave]} onAlterar={(valor) => alterar(linha, coluna, valor)} />
                ) : (
                  <CelulaLeitura key={coluna.id} rotulo={rotulo} valor={valores[chave]} alerta={alertas[chave]}
                    onClick={onCelulaClick ? () => onCelulaClick(linha.id, coluna.id) : undefined} />
                );
              })}
              <td className="grade-qtd-total">{totalLinha(linha)}</td>
            </tr>
          ))}
        </tbody>
        {linhas.length > 1 && (
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              {colunas.map((coluna) => <td key={coluna.id}>{totalColuna(coluna)}</td>)}
              <td className="grade-qtd-total">{linhas.reduce((total, linha) => total + totalLinha(linha), 0)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
```

`frontend-alfa/src/components/producao/ModalProducao.jsx`:

```jsx
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import '../cadastros/cadastros.css';
import './producao.css';

/** Moldura de modal das telas de produção: portal no body; Esc e clique fora fecham. */
export function ModalProducao({ titulo, idTitulo, onFechar, largo = false, children }) {
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  return createPortal(
    <div className="cadastro-modal-fundo" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className={`cadastro-modal${largo ? ' largo' : ''}`} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        <header className="cadastro-modal-cabecalho">
          <h2 id={idTitulo}>{titulo}</h2>
          <button type="button" className="cadastro-btn-icone" onClick={onFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
```

`frontend-alfa/src/components/producao/producao.css`:

```css
/* Produção e estoque por cor e tamanho — tokens do Ateliê Artesanal (index.css) */
.grade-qtd-rolagem { overflow-x: auto; margin: 0.6rem 0 0.9rem; }
.grade-qtd { border-collapse: collapse; min-width: 100%; font-variant-numeric: tabular-nums; }
.grade-qtd th, .grade-qtd td { padding: 0.4rem 0.55rem; border-bottom: 1px solid var(--border-artisan); text-align: center; }
.grade-qtd thead th {
  font-size: 0.76rem; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--color-text-muted); background: var(--bg-artisan-subtle);
}
.grade-qtd tbody th, .grade-qtd tfoot th { text-align: left; white-space: nowrap; font-weight: 600; }
.grade-qtd .cadastro-amostra { margin-right: 0.45rem; vertical-align: middle; }
.grade-qtd tfoot th, .grade-qtd tfoot td { font-weight: 700; background: var(--bg-artisan-subtle); }
.grade-qtd-total { font-weight: 700; color: var(--accent-artisan-indigo); }
.grade-qtd-campo {
  width: 4.4rem; padding: 0.35rem 0.4rem; border: 1px solid var(--border-artisan-strong); border-radius: 6px;
  text-align: center; font: inherit; background: var(--bg-artisan-surface);
}
.grade-qtd-campo:focus-visible { outline: 2px solid var(--accent-artisan-indigo); outline-offset: 1px; }
.grade-qtd-campo.excede { border-color: var(--accent-artisan-terracotta); background: var(--accent-artisan-terracotta-bg); }
.grade-qtd-campo:disabled { background: var(--bg-artisan-subtle); color: var(--color-text-subtle); }
.grade-qtd-maximo { display: block; margin-top: 0.15rem; font-size: 0.7rem; color: var(--color-text-subtle); }
.grade-qtd-celula {
  min-width: 2.8rem; padding: 0.25rem 0.5rem; border: 1px solid transparent; border-radius: 6px;
  background: none; font: inherit; color: inherit; cursor: pointer;
}
.grade-qtd-celula:hover, .grade-qtd-celula:focus-visible {
  border-color: var(--accent-artisan-indigo-border); background: var(--accent-artisan-indigo-bg); outline: none;
}
.grade-qtd-alerta, .grade-qtd-alerta .grade-qtd-celula { color: var(--accent-artisan-terracotta); font-weight: 700; }

.cadastro-modal.largo { width: min(60rem, 100%); }
.producao-resumo { margin: 0 0 0.8rem; color: var(--color-text-muted); }
.producao-aviso {
  margin: 0.4rem 0 0.8rem; padding: 0.6rem 0.8rem; border-radius: 8px;
  border: 1px solid var(--accent-artisan-amber-border); background: var(--accent-artisan-amber-bg); color: var(--accent-artisan-amber);
}
.producao-aviso li { margin-left: 1rem; }
.producao-lista { list-style: none; margin: 0.4rem 0 0; padding: 0; display: grid; gap: 0.3rem; font-size: 0.9rem; }
.producao-campo-modelo { max-width: 30rem; margin-bottom: 1rem; }
.producao-linhas-cor { display: grid; gap: 0.7rem; margin: 0 0 0.9rem; padding: 0.9rem 1rem; border: var(--border-stitch); border-radius: 10px; }
.producao-linhas-cor legend { padding: 0 0.4rem; font-weight: 700; }
.producao-linha-cor { display: grid; grid-template-columns: minmax(9rem, 1fr) minmax(14rem, 2fr) minmax(7rem, 1fr) auto; gap: 0.6rem; align-items: end; }
.producao-envio-grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
.op-cor-etiqueta { display: inline-flex; align-items: center; gap: 0.3rem; margin: 0 0.6rem 0.2rem 0; white-space: nowrap; }
.remessa-resumo { display: block; margin-top: 0.2rem; color: var(--color-text-muted); font-size: 0.78rem; }

@media (max-width: 720px) {
  .producao-linha-cor { grid-template-columns: 1fr; }
}
```

Mover `.sr-only` (o bloco inteiro de `ClientesCamisetas.css:128-135`) para o fim de `frontend-alfa/src/index.css`, apagando-o de `ClientesCamisetas.css`.

- [ ] **Step 3: Componentes de Produtos Prontos**

`frontend-alfa/src/components/produtos/HistoricoMovimentos.jsx`:

```jsx
import { useEffect, useState } from 'react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';

const ROTULOS_TIPO = {
  INVENTARIO: 'Inventário',
  AJUSTE: 'Ajuste',
  ENTRADA_PRODUCAO: 'Entrada da produção',
  SAIDA_ENTREGA: 'Saída (entrega)',
  ESTORNO_ENTREGA: 'Estorno de entrega',
};
const LIMITE_COMPACTO = 10;
const LIMITE_COMPLETO = 100;
const formatarDataHora = (valor) => (valor ? new Date(valor).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const comSinal = (n) => (n > 0 ? `+${n}` : String(n));

/** Histórico do estoque pronto: de um SKU (`idVariacao`) ou de tudo. Mudar `versao` recarrega. */
export function HistoricoMovimentos({ idVariacao, compacto = false, versao = 0 }) {
  const toast = useToast();
  const [tipo, setTipo] = useState('');
  const [movimentos, setMovimentos] = useState([]);

  useEffect(() => {
    let ativo = true;
    api.get('/camisetas/produtos-prontos/movimentos/', {
      params: { id_variacao: idVariacao, tipo: tipo || undefined, limite: compacto ? LIMITE_COMPACTO : LIMITE_COMPLETO },
    })
      .then(({ data }) => { if (ativo) setMovimentos(data); })
      .catch((err) => { if (ativo) toast.erro(mensagemDeErro(err, 'Não foi possível carregar o histórico.')); });
    return () => { ativo = false; };
  }, [idVariacao, tipo, compacto, versao, toast]);

  return (
    <div className="historico-movimentos">
      {!compacto && (
        <label className="historico-filtro" htmlFor="historico-tipo">
          Tipo
          <select id="historico-tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ROTULOS_TIPO).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </label>
      )}
      {movimentos.length === 0 ? (
        <p className="painel-cadastro-vazio">Nenhuma movimentação ainda.</p>
      ) : (
        <div className="grade-qtd-rolagem">
          <table className="historico-tabela">
            <thead>
              <tr>
                <th scope="col">Quando</th>
                {!idVariacao && <th scope="col">Item</th>}
                <th scope="col">Tipo</th>
                <th scope="col">Qtd.</th>
                <th scope="col">Saldo depois</th>
                <th scope="col">Motivo / referência</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map((m) => (
                <tr key={m.id_movimento}>
                  <td>{formatarDataHora(m.criado_em)}</td>
                  {!idVariacao && <td>{m.sku}</td>}
                  <td>{ROTULOS_TIPO[m.tipo] || m.tipo}</td>
                  <td className={m.quantidade < 0 ? 'historico-saida' : 'historico-entrada'}>{comSinal(m.quantidade)}</td>
                  <td>{m.saldo_apos}</td>
                  <td>{[m.motivo, m.referencia].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

`frontend-alfa/src/components/produtos/PainelSku.jsx`:

```jsx
import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { ModalProducao } from '../producao/ModalProducao';
import { HistoricoMovimentos } from './HistoricoMovimentos';

const MOTIVO_MINIMO = 3;

/** Ajuste, estoque mínimo e histórico de um SKU. `sku`: { id_variacao, nome, saldo, estoque_minimo }. */
export function PainelSku({ sku, onFechar, onAlterado }) {
  const toast = useToast();
  const [ajuste, setAjuste] = useState({ quantidade: '', motivo: '' });
  const [minimo, setMinimo] = useState(String(sku.estoque_minimo));
  const [salvando, setSalvando] = useState(false);

  const executar = async (acao, sucesso, falha) => {
    try {
      setSalvando(true);
      await acao();
      toast.sucesso(sucesso);
      onAlterado();
    } catch (err) {
      toast.erro(mensagemDeErro(err, falha));
    } finally {
      setSalvando(false);
    }
  };

  const salvarAjuste = (e) => {
    e.preventDefault();
    const quantidade = parseInt(ajuste.quantidade, 10);
    if (!quantidade) { toast.aviso('Informe quanto entra (ex.: 5) ou sai (ex.: -2).'); return; }
    if (ajuste.motivo.trim().length < MOTIVO_MINIMO) { toast.aviso('Explique o motivo do ajuste (pelo menos 3 letras).'); return; }
    executar(
      () => api.post('/camisetas/produtos-prontos/ajustes', { id_variacao: sku.id_variacao, quantidade, motivo: ajuste.motivo.trim() }),
      `Estoque de ${sku.nome} ajustado.`,
      'Não foi possível ajustar o estoque.',
    );
  };

  const salvarMinimo = (e) => {
    e.preventDefault();
    const valor = parseInt(minimo, 10);
    if (Number.isNaN(valor) || valor < 0) { toast.aviso('O estoque mínimo precisa ser zero ou mais.'); return; }
    executar(
      () => api.put(`/camisetas/produtos-prontos/variacoes/${sku.id_variacao}/minimo`, { estoque_minimo: valor }),
      `Estoque mínimo de ${sku.nome}: ${valor} peças.`,
      'Não foi possível salvar o estoque mínimo.',
    );
  };

  return (
    <ModalProducao titulo={sku.nome} idTitulo="titulo-painel-sku" onFechar={onFechar}>
      <p className="producao-resumo">
        Saldo atual: <strong>{sku.saldo} peças</strong>{sku.estoque_minimo > 0 && ` · mínimo ${sku.estoque_minimo}`}
      </p>
      <form className="painel-sku-bloco" onSubmit={salvarAjuste}>
        <h3>Ajustar estoque</h3>
        <div className="cadastro-grid">
          <div className="cadastro-campo">
            <label htmlFor="sku-ajuste-qtd">Quantidade (+ entra, − sai)</label>
            <input id="sku-ajuste-qtd" type="number" placeholder="Ex.: -2" value={ajuste.quantidade}
              onChange={(e) => setAjuste({ ...ajuste, quantidade: e.target.value })} />
          </div>
          <div className="cadastro-campo">
            <label htmlFor="sku-ajuste-motivo">Motivo do ajuste</label>
            <input id="sku-ajuste-motivo" maxLength={255} placeholder="Ex.: peça manchada" value={ajuste.motivo}
              onChange={(e) => setAjuste({ ...ajuste, motivo: e.target.value })} />
          </div>
        </div>
        <div className="painel-cadastro-form-acoes">
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>Salvar ajuste</button>
        </div>
      </form>
      <form className="painel-sku-bloco" onSubmit={salvarMinimo}>
        <h3>Estoque mínimo</h3>
        <div className="painel-grade-novo">
          <input id="sku-minimo" type="number" min="0" aria-label="Estoque mínimo em peças" value={minimo}
            onChange={(e) => setMinimo(e.target.value)} />
          <button type="submit" className="cadastro-btn secundario" disabled={salvando}>Salvar mínimo</button>
        </div>
      </form>
      <section className="painel-sku-bloco" aria-labelledby="titulo-historico-sku">
        <h3 id="titulo-historico-sku">Últimas movimentações</h3>
        <HistoricoMovimentos idVariacao={sku.id_variacao} compacto />
      </section>
    </ModalProducao>
  );
}
```

`frontend-alfa/src/components/produtos/BarraInventario.jsx`:

```jsx
import { useState } from 'react';
import { Plus } from 'lucide-react';

/** Controles do modo inventário: motivo, incluir modelo + cor sem estoque, salvar ou cancelar. */
export function BarraInventario({ modelos, cores, motivo, onMotivo, onIncluir, onSalvar, onCancelar, salvando }) {
  const [idModelo, setIdModelo] = useState('');
  const [idCor, setIdCor] = useState('');

  const incluir = () => {
    const modelo = modelos.find((m) => String(m.id_modelo) === idModelo);
    const cor = cores.find((c) => String(c.id_cor) === idCor);
    if (!modelo || !cor) return;
    onIncluir(modelo, cor);
    setIdCor('');
  };

  return (
    <section className="inventario-barra" aria-labelledby="titulo-inventario">
      <h2 id="titulo-inventario">Modo inventário</h2>
      <p>Digite a quantidade contada em cada célula. Deixe em branco o que não foi contado: o sistema lança só as diferenças.</p>
      <div className="inventario-campos">
        <div className="cadastro-campo">
          <label htmlFor="inventario-motivo">Motivo da contagem</label>
          <input id="inventario-motivo" maxLength={255} placeholder="Inventário de abertura" value={motivo}
            onChange={(e) => onMotivo(e.target.value)} />
        </div>
        <div className="cadastro-campo">
          <label htmlFor="inventario-modelo">Incluir modelo</label>
          <select id="inventario-modelo" value={idModelo} onChange={(e) => setIdModelo(e.target.value)}>
            <option value="">Selecione…</option>
            {modelos.map((m) => <option key={m.id_modelo} value={m.id_modelo}>{m.nome_modelo}</option>)}
          </select>
        </div>
        <div className="cadastro-campo">
          <label htmlFor="inventario-cor">na cor</label>
          <select id="inventario-cor" value={idCor} onChange={(e) => setIdCor(e.target.value)}>
            <option value="">Selecione…</option>
            {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
          </select>
        </div>
        <button type="button" className="cadastro-btn secundario" onClick={incluir} disabled={!idModelo || !idCor}>
          <Plus size={16} aria-hidden="true" /> Incluir
        </button>
      </div>
      <div className="inventario-acoes">
        <button type="button" className="cadastro-btn secundario" onClick={onCancelar} disabled={salvando}>Cancelar</button>
        <button type="button" className="cadastro-btn primario" onClick={onSalvar} disabled={salvando}>Salvar contagem</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Página**

`frontend-alfa/src/pages/ProdutosProntosCamisetas.jsx`:

```jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Boxes, ClipboardList, History } from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/feedback/useToast';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
import { GradeQuantidades } from '../components/producao/GradeQuantidades';
import { BarraInventario } from '../components/produtos/BarraInventario';
import { HistoricoMovimentos } from '../components/produtos/HistoricoMovimentos';
import { PainelSku } from '../components/produtos/PainelSku';
import {
  acrescentarLinha,
  agruparPorModelo,
  alertasDoGrupo,
  celulaDoGrupo,
  contagensDoInventario,
  valoresDoGrupo,
  valoresIniciaisInventario,
} from '../utils/produtosProntos';
import '../components/cadastros/cadastros.css';
import './ProdutosProntosCamisetas.css';

const FILTROS_INICIAIS = { id_modelo: '', id_cor: '', abaixo_minimo: false };

const urlDaListagem = (filtros) => {
  const consulta = new URLSearchParams();
  if (filtros.id_modelo) consulta.set('id_modelo', filtros.id_modelo);
  if (filtros.id_cor) consulta.set('id_cor', filtros.id_cor);
  if (filtros.abaixo_minimo) consulta.set('abaixo_minimo', 'true');
  const texto = consulta.toString();
  return `/camisetas/produtos-prontos/${texto ? `?${texto}` : ''}`;
};

function FiltrosProdutos({ filtros, onChange, modelos, cores, desativado }) {
  const alterar = (campo, valor) => onChange({ ...filtros, [campo]: valor });
  return (
    <div className="produtos-filtros">
      <label htmlFor="filtro-modelo">
        Modelo
        <select id="filtro-modelo" value={filtros.id_modelo} disabled={desativado} onChange={(e) => alterar('id_modelo', e.target.value)}>
          <option value="">Todos</option>
          {modelos.map((m) => <option key={m.id_modelo} value={m.id_modelo}>{m.nome_modelo}</option>)}
        </select>
      </label>
      <label htmlFor="filtro-cor">
        Cor
        <select id="filtro-cor" value={filtros.id_cor} disabled={desativado} onChange={(e) => alterar('id_cor', e.target.value)}>
          <option value="">Todas</option>
          {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
        </select>
      </label>
      <label className="produtos-filtro-check" htmlFor="filtro-minimo">
        <input id="filtro-minimo" type="checkbox" checked={filtros.abaixo_minimo} disabled={desativado}
          onChange={(e) => alterar('abaixo_minimo', e.target.checked)} />
        Só abaixo do mínimo
      </label>
    </div>
  );
}

function ProdutosProntosCamisetas() {
  const toast = useToast();
  const [linhas, setLinhas] = useState([]);
  const [modelos, setModelos] = useState([]);
  const [cores, setCores] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [inventario, setInventario] = useState(null); // null = fora do modo inventário · { grupos, valores, motivo }
  const [salvando, setSalvando] = useState(false);
  const [skuAberto, setSkuAberto] = useState(null);
  const [versaoHistorico, setVersaoHistorico] = useState(0);

  const carregar = useCallback(async () => {
    const { dados, houveFalha } = await buscarEmParalelo([urlDaListagem(filtros), '/camisetas/modelos/', '/camisetas/cores/']);
    const [listaLinhas, listaModelos, listaCores] = dados;
    setLinhas(listaLinhas);
    setModelos(listaModelos);
    setCores(listaCores);
    if (houveFalha) toast.erro('Não foi possível carregar todo o estoque pronto. Recarregue a página.');
  }, [filtros, toast]);

  useEffect(() => { carregar(); }, [carregar]);

  const grupos = useMemo(() => agruparPorModelo(linhas), [linhas]);
  const totalPecas = linhas.reduce((total, linha) => total + linha.total, 0);
  const gruposExibidos = inventario ? inventario.grupos : grupos;

  const recarregarTudo = () => {
    setVersaoHistorico((versao) => versao + 1);
    carregar();
  };

  const abrirSku = (grupo, idCor, idTamanho) => {
    const celula = celulaDoGrupo(grupo, idCor, idTamanho);
    if (!celula?.id_variacao) {
      toast.info('Ainda não há estoque desta cor e tamanho. Use “Fazer inventário” para lançar a contagem.');
      return;
    }
    const cor = grupo.linhas.find((linha) => linha.id === idCor);
    setSkuAberto({ ...celula, nome: `${grupo.nome_modelo} · ${cor?.rotulo} · ${celula.rotulo}` });
  };

  const salvarInventario = async () => {
    const contagens = contagensDoInventario(inventario.grupos, inventario.valores);
    if (contagens.length === 0) { toast.aviso('Nenhuma quantidade foi contada.'); return; }
    try {
      setSalvando(true);
      const { data } = await api.post('/camisetas/produtos-prontos/inventario', { motivo: inventario.motivo || undefined, contagens });
      toast.sucesso(data.skus_alterados === 0
        ? 'Contagem conferida: o estoque já estava certo.'
        : `Inventário salvo: ${data.skus_alterados} item(ns) ajustado(s) (+${data.pecas_entrada} / −${data.pecas_saida} peças).`);
      setInventario(null);
      recarregarTudo();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível salvar o inventário.'));
    } finally {
      setSalvando(false);
    }
  };

  const alterarInventario = (mudanca) => setInventario((atual) => ({ ...atual, ...mudanca(atual) }));

  return (
    <div className="produtos-container">
      <Sidebar />
      <main className="produtos-main">
        <header className="page-header">
          <h1><Boxes size={28} color="#2563eb" aria-hidden="true" /> 8. Produtos Prontos</h1>
          <p>Peças acabadas por modelo, cor e tamanho. Clique numa quantidade para ajustar, definir o mínimo ou ver o histórico.</p>
        </header>

        <div className="produtos-barra">
          <FiltrosProdutos filtros={filtros} onChange={setFiltros} modelos={modelos} cores={cores} desativado={Boolean(inventario)} />
          <span className="produtos-total" aria-live="polite"><strong>{totalPecas}</strong> peças prontas</span>
          {!inventario && (
            <button type="button" className="cadastro-btn primario"
              onClick={() => setInventario({ grupos, valores: valoresIniciaisInventario(grupos), motivo: '' })}>
              <ClipboardList size={16} aria-hidden="true" /> Fazer inventário
            </button>
          )}
        </div>

        {inventario && (
          <BarraInventario
            modelos={modelos}
            cores={cores}
            motivo={inventario.motivo}
            salvando={salvando}
            onMotivo={(motivo) => alterarInventario(() => ({ motivo }))}
            onIncluir={(modelo, cor) => alterarInventario((atual) => ({ grupos: acrescentarLinha(atual.grupos, modelo, cor) }))}
            onSalvar={salvarInventario}
            onCancelar={() => setInventario(null)}
          />
        )}

        {gruposExibidos.length === 0 && (
          <p className="produtos-vazio">
            {inventario
              ? 'Inclua um modelo e uma cor para começar a contagem.'
              : 'Nenhuma peça pronta ainda. Use “Fazer inventário” para lançar o estoque de abertura.'}
          </p>
        )}

        {gruposExibidos.map((grupo) => (
          <section key={grupo.id_modelo} className="produtos-card" aria-labelledby={`titulo-modelo-${grupo.id_modelo}`}>
            <h2 id={`titulo-modelo-${grupo.id_modelo}`}>{grupo.nome_modelo}</h2>
            {inventario ? (
              <GradeQuantidades
                idPrefixo={`inventario-${grupo.id_modelo}`}
                legenda={`Contagem de ${grupo.nome_modelo}`}
                linhas={grupo.linhas}
                colunas={grupo.colunas}
                valores={inventario.valores[grupo.id_modelo] || {}}
                onChange={(valores) => alterarInventario((atual) => ({ valores: { ...atual.valores, [grupo.id_modelo]: valores } }))}
              />
            ) : (
              <GradeQuantidades
                idPrefixo={`saldo-${grupo.id_modelo}`}
                legenda={`Saldo de ${grupo.nome_modelo} por cor e tamanho`}
                linhas={grupo.linhas}
                colunas={grupo.colunas}
                valores={valoresDoGrupo(grupo)}
                alertas={alertasDoGrupo(grupo)}
                onCelulaClick={(idCor, idTamanho) => abrirSku(grupo, idCor, idTamanho)}
              />
            )}
          </section>
        ))}

        <section className="produtos-card" aria-labelledby="titulo-historico">
          <h2 id="titulo-historico"><History size={18} aria-hidden="true" /> Histórico de movimentações</h2>
          <HistoricoMovimentos versao={versaoHistorico} />
        </section>

        {skuAberto && (
          <PainelSku
            sku={skuAberto}
            onFechar={() => setSkuAberto(null)}
            onAlterado={() => { setSkuAberto(null); recarregarTudo(); }}
          />
        )}
      </main>
    </div>
  );
}

export default ProdutosProntosCamisetas;
```

`frontend-alfa/src/pages/ProdutosProntosCamisetas.css`:

```css
.produtos-container { display: flex; min-height: 100vh; background: var(--bg-artisan-cream); color: var(--color-text-main); font-family: var(--font-sans-humanist); }
.produtos-main { flex: 1; padding: 2.2rem 2.8rem; overflow-y: auto; }
.produtos-main .page-header { margin-bottom: 1.4rem; }
.produtos-main .page-header h1 {
  display: flex; align-items: center; gap: 0.6rem; margin: 0 0 0.35rem;
  font-family: var(--font-serif-editorial); font-size: 1.95rem; font-weight: 600;
}
.produtos-main .page-header p { margin: 0; color: var(--color-text-muted); }
.produtos-barra { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.8rem 1.4rem; margin-bottom: 1.2rem; }
.produtos-filtros { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.8rem 1rem; }
.produtos-filtros label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; font-weight: 600; color: var(--color-text-muted); }
.produtos-filtros select { min-width: 12rem; padding: 0.45rem 0.6rem; border: 1px solid var(--border-artisan-strong); border-radius: 8px; font: inherit; background: var(--bg-artisan-surface); }
.produtos-filtros .produtos-filtro-check { flex-direction: row; align-items: center; gap: 0.4rem; padding-bottom: 0.5rem; }
.produtos-total { margin-left: auto; padding-bottom: 0.45rem; color: var(--color-text-muted); }
.produtos-total strong { font-family: var(--font-serif-editorial); font-size: 1.5rem; color: var(--accent-artisan-indigo); }
.produtos-card {
  margin-bottom: 1.2rem; padding: 1.1rem 1.3rem; border: 1px solid var(--border-artisan); border-radius: 12px;
  background: var(--bg-artisan-surface); box-shadow: 0 1px 2px rgba(44, 37, 35, 0.04);
}
.produtos-card h2 { display: flex; align-items: center; gap: 0.5rem; margin: 0 0 0.4rem; font-family: var(--font-serif-editorial); font-size: 1.2rem; }
.produtos-vazio { padding: 2rem; text-align: center; color: var(--color-text-muted); border: var(--border-stitch); border-radius: 12px; }
.inventario-barra {
  margin-bottom: 1.2rem; padding: 1rem 1.2rem; border-radius: 12px;
  border: 1px solid var(--accent-artisan-indigo-border); background: var(--accent-artisan-indigo-bg);
}
.inventario-barra h2 { margin: 0 0 0.3rem; font-family: var(--font-serif-editorial); font-size: 1.15rem; color: var(--accent-artisan-indigo); }
.inventario-barra p { margin: 0 0 0.8rem; color: var(--color-text-body); }
.inventario-campos { display: grid; grid-template-columns: 2fr 1.5fr 1fr auto; gap: 0.7rem; align-items: end; }
.inventario-acoes { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.9rem; }
.historico-filtro { display: inline-flex; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; font-weight: 600; }
.historico-tabela { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.historico-tabela th, .historico-tabela td { padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--border-artisan); text-align: left; }
.historico-tabela th { font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
.historico-entrada { color: var(--accent-artisan-sage); font-weight: 700; }
.historico-saida { color: var(--accent-artisan-terracotta); font-weight: 700; }
.painel-sku-bloco { padding: 0.9rem 0; border-top: 1px solid var(--border-artisan); }
.painel-sku-bloco h3 { margin: 0 0 0.6rem; font-size: 0.95rem; }

@media (max-width: 768px) {
  .produtos-main { padding: 1.2rem 1rem; }
  .inventario-campos { grid-template-columns: 1fr; }
  .produtos-total { margin-left: 0; }
}
```

- [ ] **Step 5: Rota, menu e título do Financeiro**

- `frontend-alfa/src/App.jsx`: `import ProdutosProntosCamisetas from './pages/ProdutosProntosCamisetas';` e `<Route path="/camisetas/produtos-prontos" element={<ProdutosProntosCamisetas />} />` junto das rotas de camisetas.
- `frontend-alfa/src/components/Sidebar.jsx`: importar `PackageCheck` de `lucide-react`; depois do botão "7. Costura & Facções", inserir (mesmo formato dos vizinhos):

```jsx
            <button
              className={`nav-item ${isActive('/camisetas/produtos-prontos') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/produtos-prontos')}
            >
              <PackageCheck size={19} />
              <span>8. Produtos Prontos</span>
            </button>
```

  e trocar `<span>8. Registro Financeiro</span>` por `<span>9. Registro Financeiro</span>`.
- `frontend-alfa/src/pages/RegistroFinanceiroCamisetas.jsx:176`: `8. Tela de Registro Financeiro` → `9. Tela de Registro Financeiro`.

- [ ] **Step 6: Build, lint e conferência no navegador**

Run: `cd frontend-alfa && npm run build && npx oxlint`
Expected: build sem erros; oxlint sem erros.

Subir o ambiente pelo roteiro de verificação local (banco novo + seed) e rodar o script `qa_produtos.mjs` (no scratchpad):

```js
// QA Tarefa 9 (Fase 1B): Produtos Prontos — rodar com a URL http://localhost:5173/camisetas/produtos-prontos
const PASTA = '/private/tmp/claude-501/-Users-laurindocostajunior-Documents-VScode-PlatConfec/c97f7374-3abc-47be-97f3-5917410155cf/scratchpad';

export default async function run(page) {
  const r = { dialogosNativos: [] };
  page.on('dialog', async (d) => { r.dialogosNativos.push(d.message()); await d.dismiss(); });
  const toasts = () => page.$$eval('.feedback-toast', (els) => els.map((e) => e.innerText.trim()));

  await page.getByRole('heading', { name: 'Camiseta Básica Gola Redonda' }).waitFor();
  r.menu = await page.$$eval('.sidebar-nav .nav-item span', (els) => els.map((e) => e.innerText));
  r.total = await page.textContent('.produtos-total');

  await page.getByRole('button', { name: 'Preto, tamanho M: 120 peças' }).click();
  await page.fill('#sku-ajuste-qtd', '-2');
  await page.fill('#sku-ajuste-motivo', 'Peça manchada');
  await page.getByRole('button', { name: 'Salvar ajuste' }).click();
  await page.getByRole('button', { name: 'Preto, tamanho M: 118 peças' }).waitFor();
  r.toastAjuste = (await toasts()).at(-1);

  await page.getByRole('button', { name: 'Fazer inventário' }).click();
  await page.getByLabel('Preto, tamanho GG').fill('48');
  await page.selectOption('#inventario-modelo', { index: 2 });
  await page.selectOption('#inventario-cor', { label: 'Branco' });
  await page.getByRole('button', { name: 'Incluir' }).click();
  await page.getByLabel('Branco, tamanho P').first().fill('10');
  await page.getByRole('button', { name: 'Salvar contagem' }).click();
  await page.getByRole('button', { name: 'Preto, tamanho GG: 48 peças' }).waitFor();
  r.toastInventario = (await toasts()).at(-1);
  r.linhasHistorico = await page.locator('.historico-tabela tbody tr').count();
  await page.screenshot({ path: `${PASTA}/produtos_prontos.png`, fullPage: true });
  return r;
}
```

Run: `node ~/.claude/skills/browser-automation/browser.mjs http://localhost:5173/camisetas/produtos-prontos --script <scratchpad>/qa_produtos.mjs`
Expected: menu com "8. Produtos Prontos" e "9. Registro Financeiro"; total "350 peças prontas"; ajuste e inventário refletidos na grade; histórico com pelo menos 7 linhas; nenhum diálogo nativo; nenhum erro de console. Abrir o PNG e conferir o visual (grade alinhada, sem texto cortado).

- [ ] **Step 7: Commit**

```bash
git add frontend-alfa/src
git commit -m "feat: página Produtos Prontos com grade por cor e tamanho, inventário e histórico" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Corte & Rendimento com várias cores

**Files:**
- Create: `frontend-alfa/src/utils/producao.js`, `frontend-alfa/src/components/producao/FormNovaOp.jsx`, `frontend-alfa/src/components/producao/ModalCorteOp.jsx`
- Modify: `frontend-alfa/src/pages/CorteRendimentoCamisetas.jsx`

**Interfaces:**
- Consumes: `GradeQuantidades`, `ModalProducao`, `chaveCelula`, `valoresParaLista` (Task 9); `POST /camisetas/ordens/` com `cores`; `PUT /camisetas/ordens/{id}/finalizar-corte` com `cortes`; resposta da OP com `legada`, `cores`, `cortes`, `tamanhos` (Task 4); rolos com `id_cor`/`nome_cor`.
- Produces: `formatarRendimento(pecas, pesoKg)`, `problemasDoEnfesto(linhas)`, `faltasDeMalha(linhas, tecidos)`, `resumoPorCor(itens, campo)`; `<FormNovaOp modelos tecidos cores onCriada />`; `<ModalCorteOp op onFechar onSalvo />`.

- [ ] **Step 1: Funções puras**

`frontend-alfa/src/utils/producao.js`:

```js
/** Rendimento em peças por kg ("5.50 peças/kg"), ou "—" sem dados. */
export function formatarRendimento(pecas, pesoKg) {
  const peso = Number(pesoKg);
  if (!pecas || !(peso > 0)) return '—';
  return `${(pecas / peso).toFixed(2)} peças/kg`;
}

/** Primeiro problema que impede abrir a OP (linha incompleta ou cor repetida), ou ''. */
export function problemasDoEnfesto(linhas) {
  const incompleta = linhas.findIndex((l) => !l.id_cor || !l.id_insumo_tecido || !(parseFloat(l.peso_kg) > 0));
  if (incompleta >= 0) return `Complete a linha ${incompleta + 1}: cor, rolo de malha e peso maior que zero.`;
  const cores = linhas.map((l) => String(l.id_cor));
  const repetida = cores.findIndex((cor, indice) => cores.indexOf(cor) !== indice);
  if (repetida >= 0) return `A cor da linha ${repetida + 1} já está em outra linha; junte o peso numa linha só.`;
  return '';
}

/** Rolos cujo saldo não cobre o peso somado das linhas que os usam (uma frase por rolo). */
export function faltasDeMalha(linhas, tecidos) {
  const pesoPorRolo = linhas.reduce((mapa, linha) => {
    if (!linha.id_insumo_tecido) return mapa;
    const chave = String(linha.id_insumo_tecido);
    return { ...mapa, [chave]: (mapa[chave] || 0) + (parseFloat(linha.peso_kg) || 0) };
  }, {});
  return Object.entries(pesoPorRolo)
    .map(([idRolo, peso]) => ({ rolo: tecidos.find((t) => String(t.id_insumo) === idRolo), peso }))
    .filter(({ rolo, peso }) => rolo && peso > parseFloat(rolo.saldo_atual || 0))
    .map(({ rolo, peso }) => `O rolo ${rolo.codigo} tem ${parseFloat(rolo.saldo_atual || 0).toFixed(3)} kg e o enfesto pede ${peso.toFixed(3)} kg.`);
}

/** "Preto: P20 M10 · Branco: G5" a partir dos itens de uma remessa. */
export function resumoPorCor(itens, campo = 'qtd_enviada') {
  const porCor = itens.reduce((mapa, item) => ({
    ...mapa, [item.nome_cor]: [...(mapa[item.nome_cor] || []), `${item.rotulo}${item[campo] ?? 0}`],
  }), {});
  return Object.entries(porCor).map(([cor, partes]) => `${cor}: ${partes.join(' ')}`).join(' · ');
}
```

- [ ] **Step 2: Formulário de nova OP**

`frontend-alfa/src/components/producao/FormNovaOp.jsx`:

```jsx
import { useRef, useState } from 'react';
import { Plus, Scale, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { faltasDeMalha, problemasDoEnfesto } from '../../utils/producao';
import '../cadastros/cadastros.css';
import './producao.css';

const linhaVazia = (chave) => ({ chave, id_cor: '', id_insumo_tecido: '', peso_kg: '' });
const rotuloRolo = (t) => `[${t.codigo}] ${t.tipo_malha_ou_aviamento}${t.nome_cor ? ` · ${t.nome_cor}` : ''} — ${parseFloat(t.saldo_atual || 0).toFixed(3)} kg`;

/** Abertura de OP: modelo + uma linha por cor do enfesto (cor, rolo de malha e peso). */
export function FormNovaOp({ modelos, tecidos, cores, onCriada }) {
  const toast = useToast();
  const proximaChave = useRef(1);
  const [idModelo, setIdModelo] = useState('');
  const [linhas, setLinhas] = useState(() => [linhaVazia(0)]);
  const [salvando, setSalvando] = useState(false);

  const modelo = modelos.find((m) => String(m.id_modelo) === String(idModelo));
  const pesoTotal = linhas.reduce((total, l) => total + (parseFloat(l.peso_kg) || 0), 0);
  const consumo = Number(modelo?.consumo_tecido_kg) || 0;
  const pecasPrevistas = consumo > 0 ? Math.floor(pesoTotal / consumo) : 0;
  const faltas = faltasDeMalha(linhas, tecidos);

  const novaLinha = () => {
    const linha = linhaVazia(proximaChave.current);
    proximaChave.current += 1;
    return linha;
  };

  const alterarLinha = (chave, campo, valor) => setLinhas((atuais) => atuais.map((linha) => {
    if (linha.chave !== chave) return linha;
    if (campo === 'id_insumo_tecido') {
      const rolo = tecidos.find((t) => String(t.id_insumo) === valor);
      return { ...linha, id_insumo_tecido: valor, id_cor: rolo?.id_cor ? String(rolo.id_cor) : linha.id_cor };
    }
    if (campo === 'id_cor') {
      const rolo = tecidos.find((t) => String(t.id_insumo) === linha.id_insumo_tecido);
      const roloDeOutraCor = Boolean(rolo?.id_cor) && String(rolo.id_cor) !== valor;
      return { ...linha, id_cor: valor, id_insumo_tecido: roloDeOutraCor ? '' : linha.id_insumo_tecido };
    }
    return { ...linha, [campo]: valor };
  }));

  const rolosDaCor = (idCor) => (idCor ? tecidos.filter((t) => !t.id_cor || String(t.id_cor) === String(idCor)) : tecidos);

  const enviar = async (e) => {
    e.preventDefault();
    const problema = idModelo ? problemasDoEnfesto(linhas) || faltas[0] : 'Escolha o modelo da OP.';
    if (problema) { toast.aviso(problema); return; }
    try {
      setSalvando(true);
      const { data } = await api.post('/camisetas/ordens/', {
        id_modelo: Number(idModelo),
        cores: linhas.map((l) => ({ id_cor: Number(l.id_cor), id_insumo_tecido: Number(l.id_insumo_tecido), peso_kg: parseFloat(l.peso_kg) })),
      });
      toast.sucesso(`OP ${data.codigo_op} aberta: ${pesoTotal.toFixed(3)} kg de malha baixados do estoque.`);
      setLinhas([novaLinha()]);
      onCriada();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível abrir a OP.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <div className="cadastro-campo producao-campo-modelo">
        <label htmlFor="op-modelo">Modelo de camiseta *</label>
        <select id="op-modelo" value={idModelo} onChange={(e) => setIdModelo(e.target.value)}>
          <option value="">Selecione o modelo…</option>
          {modelos.map((m) => <option key={m.id_modelo} value={m.id_modelo}>{m.nome_modelo} ({m.consumo_tecido_kg} kg/peça)</option>)}
        </select>
      </div>

      <fieldset className="producao-linhas-cor">
        <legend>Cores do enfesto</legend>
        {linhas.map((linha, indice) => (
          <div key={linha.chave} className="producao-linha-cor">
            <div className="cadastro-campo">
              <label htmlFor={`op-cor-${linha.chave}`}>Cor {indice + 1}</label>
              <select id={`op-cor-${linha.chave}`} value={linha.id_cor} onChange={(e) => alterarLinha(linha.chave, 'id_cor', e.target.value)}>
                <option value="">Selecione…</option>
                {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
              </select>
            </div>
            <div className="cadastro-campo">
              <label htmlFor={`op-rolo-${linha.chave}`}>Rolo de malha</label>
              <select id={`op-rolo-${linha.chave}`} value={linha.id_insumo_tecido}
                onChange={(e) => alterarLinha(linha.chave, 'id_insumo_tecido', e.target.value)}>
                <option value="">Selecione…</option>
                {rolosDaCor(linha.id_cor).map((t) => <option key={t.id_insumo} value={t.id_insumo}>{rotuloRolo(t)}</option>)}
              </select>
            </div>
            <div className="cadastro-campo">
              <label htmlFor={`op-peso-${linha.chave}`}>Peso (kg)</label>
              <input id={`op-peso-${linha.chave}`} type="number" step="0.001" min="0.001" placeholder="Ex.: 12.500"
                value={linha.peso_kg} onChange={(e) => alterarLinha(linha.chave, 'peso_kg', e.target.value)} />
            </div>
            <button type="button" className="cadastro-btn-icone" aria-label={`Remover cor ${indice + 1}`}
              disabled={linhas.length === 1} onClick={() => setLinhas((atuais) => atuais.filter((l) => l.chave !== linha.chave))}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div>
          <button type="button" className="cadastro-btn secundario" onClick={() => setLinhas((atuais) => [...atuais, novaLinha()])}>
            <Plus size={16} aria-hidden="true" /> Adicionar cor
          </button>
        </div>
      </fieldset>

      <p className="producao-resumo" aria-live="polite">
        Total na mesa: <strong>{pesoTotal.toFixed(3)} kg</strong> · previsão de <strong>{pecasPrevistas} peças</strong>
      </p>
      {faltas.length > 0 && <ul className="producao-aviso" role="alert">{faltas.map((f) => <li key={f}>{f}</li>)}</ul>}
      <button type="submit" className="btn-acao-rapida" disabled={salvando || faltas.length > 0}>
        <Scale size={18} aria-hidden="true" />
        <span>Abrir OP e baixar a malha</span>
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Modal de corte**

`frontend-alfa/src/components/producao/ModalCorteOp.jsx`:

```jsx
import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { chaveCelula, valoresParaLista } from '../../utils/grade';
import { formatarRendimento } from '../../utils/producao';
import { GradeQuantidades } from './GradeQuantidades';
import { ModalProducao } from './ModalProducao';

const valoresDoCorte = (op) => Object.fromEntries(op.cortes.map((c) => [chaveCelula(c.id_cor, c.id_tamanho), c.cortado]));

/** Registro do corte: grade cor × tamanho (OP antiga: só o total), com rendimento total e por cor. */
export function ModalCorteOp({ op, onFechar, onSalvo }) {
  const toast = useToast();
  const [valores, setValores] = useState(() => valoresDoCorte(op));
  const [totalLegado, setTotalLegado] = useState(String(op.pecas_reais_cortadas || op.pecas_planejadas || ''));
  const [salvando, setSalvando] = useState(false);
  const linhas = op.cores.map((c) => ({ id: c.id_cor, rotulo: c.nome_cor, hex: c.hex_cor }));
  const colunas = op.tamanhos.map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }));
  const totalDaCor = (idCor) => colunas.reduce((total, c) => total + (Number(valores[chaveCelula(idCor, c.id)]) || 0), 0);
  const total = op.legada ? Number(totalLegado) || 0 : op.cores.reduce((soma, c) => soma + totalDaCor(c.id_cor), 0);

  const salvar = async (e) => {
    e.preventDefault();
    if (total <= 0) { toast.aviso('Informe as peças cortadas.'); return; }
    const corpo = op.legada
      ? { pecas_reais_cortadas: total }
      : { cortes: valoresParaLista(valores, { soPositivos: false }).map(({ linha, coluna, quantidade }) => ({ id_cor: linha, id_tamanho: coluna, quantidade })) };
    try {
      setSalvando(true);
      await api.put(`/camisetas/ordens/${op.id_op}/finalizar-corte`, corpo);
      toast.sucesso(`Corte da ${op.codigo_op} registrado: ${total} peças (${formatarRendimento(total, op.peso_malha_enviado_kg)}).`);
      onSalvo();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível registrar o corte.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalProducao titulo={`Registrar corte · ${op.codigo_op}`} idTitulo="titulo-corte-op" onFechar={onFechar} largo={!op.legada}>
      <p className="producao-resumo">
        {op.nome_modelo} · {Number(op.peso_malha_enviado_kg).toFixed(3)} kg na mesa · previsão de {op.pecas_planejadas || 0} peças
      </p>
      <form onSubmit={salvar}>
        {op.legada ? (
          <div className="cadastro-campo">
            <label htmlFor="corte-total-legado">Peças cortadas (OP antiga, sem cor e tamanho)</label>
            <input id="corte-total-legado" type="number" min="1" value={totalLegado} onChange={(e) => setTotalLegado(e.target.value)} />
          </div>
        ) : (
          <GradeQuantidades idPrefixo="corte" legenda="Peças cortadas por cor e tamanho" linhas={linhas} colunas={colunas}
            valores={valores} onChange={setValores} />
        )}
        <ul className="producao-lista" aria-live="polite">
          <li>Total: <strong>{total} peças</strong> · {formatarRendimento(total, op.peso_malha_enviado_kg)}</li>
          {!op.legada && op.cores.map((c) => (
            <li key={c.id_cor}>
              <span className="cadastro-amostra" style={{ background: c.hex_cor }} aria-hidden="true" /> {c.nome_cor}:{' '}
              {totalDaCor(c.id_cor)} peças em {Number(c.peso_kg).toFixed(3)} kg · {formatarRendimento(totalDaCor(c.id_cor), c.peso_kg)}
            </li>
          ))}
        </ul>
        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>Salvar corte</button>
        </footer>
      </form>
    </ModalProducao>
  );
}
```

- [ ] **Step 4: Página de corte**

Em `frontend-alfa/src/pages/CorteRendimentoCamisetas.jsx`:
- imports: retirar `X`, `Scale` e `api`; acrescentar `FormNovaOp`, `ModalCorteOp` (de `../components/producao/...`); ao fim, retirar qualquer import que ficar sem uso (ex.: `mensagemDeErro`; o oxlint aponta);
- estado: retirar `modalFinalizarAberto`, `pecasReais` e `formOp`; acrescentar `const [cores, setCores] = useState([]);`;
- `carregarDados`: buscar também `'/camisetas/cores/'` (quarto item), chamar `setCores(listaCores)` e apagar os dois blocos que preenchiam `formOp`;
- apagar `tecidoSelecionado` … `pesoExcedeEstoque`, `handleCriarOp`, `abrirModalFinalizar` e `handleFinalizarCorte`;
- trocar o `<form onSubmit={handleCriarOp}> … </form>` por `<FormNovaOp modelos={modelos} tecidos={tecidos} cores={cores} onCriada={carregarDados} />`;
- na tabela, a coluna "Malha Utilizada" passa a mostrar as cores:

```jsx
                      <td>
                        {op.cores.length > 0 ? op.cores.map((c) => (
                          <span key={c.id_cor} className="op-cor-etiqueta">
                            <span className="cadastro-amostra" style={{ background: c.hex_cor }} aria-hidden="true" />
                            {c.nome_cor} · {Number(c.peso_kg).toFixed(1)} kg
                          </span>
                        )) : op.nome_tecido}
                      </td>
```

- os botões "Registrar Corte"/"Ajustar" chamam `setOpSelecionada(op)`; o "Ajustar" fica `disabled={!op.legada && op.quantidade_enviada_costura > 0}` com `title="Já houve envio à facção: o corte não pode mais mudar"` nesse caso;
- trocar o bloco do modal antigo por:

```jsx
        {opSelecionada && (
          <ModalCorteOp
            op={opSelecionada}
            onFechar={() => setOpSelecionada(null)}
            onSalvo={() => { setOpSelecionada(null); carregarDados(); }}
          />
        )}
```

- [ ] **Step 5: Build, lint e navegador**

Run: `cd frontend-alfa && npm run build && npx oxlint && wc -l src/pages/CorteRendimentoCamisetas.jsx`
Expected: sem erros; página com menos linhas que antes (436).

`qa_corte.mjs` (no scratchpad):

```js
// QA Tarefa 10 (Fase 1B): OP com duas cores e corte por cor × tamanho — URL http://localhost:5173/camisetas/corte-rendimento
const PASTA = '/private/tmp/claude-501/-Users-laurindocostajunior-Documents-VScode-PlatConfec/c97f7374-3abc-47be-97f3-5917410155cf/scratchpad';

export default async function run(page) {
  const r = { dialogosNativos: [] };
  page.on('dialog', async (d) => { r.dialogosNativos.push(d.message()); await d.dismiss(); });
  const toasts = () => page.$$eval('.feedback-toast', (els) => els.map((e) => e.innerText.trim()));

  await page.waitForSelector('#op-modelo option:nth-child(2)');
  await page.selectOption('#op-modelo', { index: 1 });
  await page.selectOption('#op-cor-0', { label: 'Preto' });
  await page.selectOption('#op-rolo-0', { index: 1 });
  await page.fill('#op-peso-0', '10');
  await page.getByRole('button', { name: 'Adicionar cor' }).click();
  await page.selectOption('#op-cor-1', { label: 'Branco' });
  await page.selectOption('#op-rolo-1', { index: 1 });
  await page.fill('#op-peso-1', '8');
  r.resumo = await page.textContent('.producao-resumo');
  await page.getByRole('button', { name: 'Abrir OP e baixar a malha' }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.feedback-toast')].some((t) => t.innerText.includes('aberta')));
  r.toastOp = (await toasts()).at(-1);

  await page.locator('.tabela-ops tbody tr').first().getByRole('button', { name: 'Registrar Corte' }).click();
  await page.getByLabel('Preto, tamanho P').fill('20');
  await page.getByLabel('Preto, tamanho M').fill('30');
  await page.getByLabel('Branco, tamanho M').fill('20');
  await page.getByLabel('Branco, tamanho G').fill('24');
  r.rendimentos = await page.$$eval('.producao-lista li', (lis) => lis.map((li) => li.innerText));
  await page.screenshot({ path: `${PASTA}/corte_modal.png` });
  await page.getByRole('button', { name: 'Salvar corte' }).click();
  await page.waitForSelector('.cadastro-modal', { state: 'detached' });
  r.toastCorte = (await toasts()).at(-1);
  r.primeiraOp = await page.locator('.tabela-ops tbody tr').first().innerText();
  await page.screenshot({ path: `${PASTA}/corte.png`, fullPage: true });
  return r;
}
```

Expected: OP aberta com 18 kg e previsão de 100 peças; corte de 94 peças com rendimento por cor (Preto 5.00, Branco 5.50); linha da OP mostra "Preto · 10.0 kg" e "Branco · 8.0 kg"; nenhum diálogo nativo nem erro de console. Conferir os PNGs.

- [ ] **Step 6: Commit**

```bash
git add frontend-alfa/src
git commit -m "feat: abertura de OP com várias cores e corte por cor e tamanho" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Costura & Facções por cor e tamanho

**Files:**
- Create: `frontend-alfa/src/components/producao/FormEnvioFaccao.jsx`, `frontend-alfa/src/components/producao/ModalRetornoFaccao.jsx`
- Modify: `frontend-alfa/src/pages/CosturaFaccoesCamisetas.jsx`

**Interfaces:**
- Consumes: `GradeQuantidades`, `ModalProducao`, `chaveCelula`, `somarValores`, `valoresParaLista` (Task 9); `resumoPorCor` (Task 10); `POST /camisetas/costura/enviar` com `itens` (ou `quantidade_enviada` na OP antiga); `PUT /camisetas/costura/{id}/retornar` com `itens`; remessa com `legada`, `id_modelo`, `itens` (Task 5); modelos com `grade_tamanhos`.
- Produces: `<FormEnvioFaccao ops onEnviado />` (ops = OPs com `saldo_disponivel_envio > 0`); `<ModalRetornoFaccao remessa modelo cores onFechar onSalvo />`.

- [ ] **Step 1: Formulário de envio**

`frontend-alfa/src/components/producao/FormEnvioFaccao.jsx`:

```jsx
import { useState } from 'react';
import { Send } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { useConfirm } from '../feedback/useConfirm';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { chaveCelula, somarValores, valoresParaLista } from '../../utils/grade';
import { GradeQuantidades } from './GradeQuantidades';

const MARGEM_PADRAO = '3.00';
const formatarNumero = (valor) => Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const descreverFalta = (falta) =>
  `${falta.descricao} (${falta.codigo}): precisa ${formatarNumero(falta.necessario)} ${falta.unidade}, tem ${formatarNumero(falta.disponivel)} ${falta.unidade}`;
const disponiveisDa = (op) => Object.fromEntries(op.cortes.map((c) => [chaveCelula(c.id_cor, c.id_tamanho), c.disponivel]));
const idVariacao = (op, idCor, idTamanho) => op.cortes.find((c) => c.id_cor === idCor && c.id_tamanho === idTamanho)?.id_variacao;

function totalDoEnvio(op, valores, totalLegado) {
  if (!op) return 0;
  return op.legada ? Number(totalLegado) || 0 : somarValores(valores);
}

/** Envio à facção: escolhe a OP e confere a grade cor × tamanho (OP antiga: só o total). */
export function FormEnvioFaccao({ ops, onEnviado }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [idOp, setIdOp] = useState('');
  const [faccao, setFaccao] = useState('');
  const [margem, setMargem] = useState(MARGEM_PADRAO);
  const [observacoes, setObservacoes] = useState('');
  const [valores, setValores] = useState({});
  const [totalLegado, setTotalLegado] = useState('');
  const [salvando, setSalvando] = useState(false);

  const op = ops.find((o) => String(o.id_op) === idOp);
  const total = totalDoEnvio(op, valores, totalLegado);
  const maximos = op && !op.legada ? disponiveisDa(op) : {};
  const excede = Object.entries(maximos).some(([chave, maximo]) => (Number(valores[chave]) || 0) > maximo);

  const escolherOp = (id) => {
    const alvo = ops.find((o) => String(o.id_op) === id);
    setIdOp(id);
    setValores(alvo && !alvo.legada ? disponiveisDa(alvo) : {});
    setTotalLegado(alvo ? String(alvo.saldo_disponivel_envio) : '');
  };

  const corpo = (confirmarSaldoInsuficiente) => ({
    id_op: op.id_op,
    nome_faccao: faccao.trim(),
    margem_seguranca_aviamentos_percentual: parseFloat(margem || MARGEM_PADRAO),
    observacoes,
    confirmar_saldo_insuficiente: confirmarSaldoInsuficiente,
    ...(op.legada
      ? { quantidade_enviada: total }
      : { itens: valoresParaLista(valores).map(({ linha, coluna, quantidade }) => ({ id_variacao: idVariacao(op, linha, coluna), quantidade })) }),
  });

  const enviarComConfirmacao = async () => {
    try {
      return await api.post('/camisetas/costura/enviar', corpo(false));
    } catch (err) {
      const faltas = err.response?.status === 409 ? err.response.data?.detail?.faltas : null;
      if (!faltas) throw err;
      const confirmou = await confirmar({
        titulo: 'Aviamentos insuficientes no estoque',
        mensagem: 'O estoque registrado não cobre este envio. Se o material existe na fábrica, envie mesmo assim: o saldo ficará negativo para você conferir o inventário depois.',
        detalhes: faltas.map(descreverFalta),
        textoConfirmar: 'Enviar mesmo assim',
        textoCancelar: 'Cancelar envio',
        perigo: true, // foco inicial em "Cancelar envio": Enter acidental não deixa estoque negativo
      });
      return confirmou ? api.post('/camisetas/costura/enviar', corpo(true)) : null;
    }
  };

  const limpar = () => {
    setIdOp('');
    setFaccao('');
    setObservacoes('');
    setValores({});
    setTotalLegado('');
  };

  const enviar = async (e) => {
    e.preventDefault();
    if (!op || !faccao.trim()) { toast.aviso('Escolha a OP e informe a facção parceira.'); return; }
    if (total <= 0) { toast.aviso('Informe quantas peças vão para a facção.'); return; }
    if (excede || (op.legada && total > op.saldo_disponivel_envio)) {
      toast.aviso('Há quantidades acima do que foi cortado e ainda não enviado.');
      return;
    }
    try {
      setSalvando(true);
      const resposta = await enviarComConfirmacao();
      if (!resposta) return;
      const avisos = resposta.data?.avisos || [];
      toast.sucesso(avisos.length > 0
        ? `Lote de ${total} peças enviado para ${faccao.trim()}.`
        : `Lote de ${total} peças enviado para ${faccao.trim()}. Aviamentos baixados com margem de ${formatarNumero(margem || MARGEM_PADRAO)}%.`);
      avisos.forEach((aviso) => toast.aviso(aviso));
      limpar();
      onEnviado();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Erro ao registrar a remessa de costura.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate>
      <div className="producao-envio-grade">
        <div className="form-group">
          <label htmlFor="envio-op">OP cortada *</label>
          <select id="envio-op" value={idOp} onChange={(e) => escolherOp(e.target.value)}>
            <option value="">{ops.length === 0 ? 'Nenhuma OP com peças para enviar' : 'Selecione a OP…'}</option>
            {ops.map((o) => (
              <option key={o.id_op} value={o.id_op}>[{o.codigo_op}] {o.nome_modelo} — {o.saldo_disponivel_envio} peças para enviar</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="envio-faccao">Facção parceira *</label>
          <input id="envio-faccao" type="text" placeholder="Ex.: Facção Estrela" value={faccao} onChange={(e) => setFaccao(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="envio-margem">Margem de aviamentos (%)</label>
          <input id="envio-margem" type="number" step="0.1" min="0" max="100" value={margem} onChange={(e) => setMargem(e.target.value)} />
        </div>
        {op?.legada && (
          <div className="form-group">
            <label htmlFor="envio-total">Peças enviadas (OP antiga)</label>
            <input id="envio-total" type="number" min="1" max={op.saldo_disponivel_envio} value={totalLegado}
              onChange={(e) => setTotalLegado(e.target.value)} />
          </div>
        )}
      </div>
      {op && !op.legada && (
        <GradeQuantidades
          idPrefixo="envio"
          legenda="Peças enviadas por cor e tamanho"
          linhas={op.cores.map((c) => ({ id: c.id_cor, rotulo: c.nome_cor, hex: c.hex_cor }))}
          colunas={op.tamanhos.map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }))}
          valores={valores}
          onChange={setValores}
          maximos={maximos}
        />
      )}
      <div className="form-group">
        <label htmlFor="envio-observacoes">Observações / instruções de costura</label>
        <textarea id="envio-observacoes" rows="2" placeholder="Ex.: gola com ribana 1x1, barra 2 agulhas…" value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)} />
      </div>
      <button type="submit" className="btn-acao-rapida" disabled={salvando}>
        <Send size={18} aria-hidden="true" />
        <span>Registrar remessa de {total} peças</span>
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Modal de retorno**

`frontend-alfa/src/components/producao/ModalRetornoFaccao.jsx`:

```jsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { chaveCelula, somarValores, valoresParaLista } from '../../utils/grade';
import { GradeQuantidades } from './GradeQuantidades';
import { ModalProducao } from './ModalProducao';

const enviadosDa = (remessa) => Object.fromEntries(remessa.itens.map((i) => [chaveCelula(i.id_cor, i.id_tamanho), i.qtd_enviada]));
const coresDosItens = (itens) => itens.reduce(
  (lista, i) => (lista.some((l) => l.id === i.id_cor) ? lista : [...lista, { id: i.id_cor, rotulo: i.nome_cor, hex: i.hex_cor }]), []);

function descreverPerda(perdas) {
  if (perdas > 0) return ` · perda de ${perdas}`;
  return perdas === 0 ? ' · sem perdas' : '';
}

/** Conferência do retorno da facção por cor e tamanho. Remessa antiga: escolhe as cores e distribui o total. */
export function ModalRetornoFaccao({ remessa, modelo, cores, onFechar, onSalvo }) {
  const toast = useToast();
  const [valores, setValores] = useState(() => enviadosDa(remessa));
  const [coresLivres, setCoresLivres] = useState([]);
  const [corParaIncluir, setCorParaIncluir] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  const tamanhos = (modelo?.grade_tamanhos || []).map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }));
  const linhas = remessa.legada ? coresLivres : coresDosItens(remessa.itens);
  const colunas = remessa.legada ? tamanhos : tamanhos.filter((t) => remessa.itens.some((i) => i.id_tamanho === t.id));
  const enviados = enviadosDa(remessa);
  const maximos = remessa.legada ? {} : Object.fromEntries(
    linhas.flatMap((l) => colunas.map((c) => [chaveCelula(l.id, c.id), enviados[chaveCelula(l.id, c.id)] ?? 0])));
  const retornado = somarValores(valores);
  const perdas = remessa.quantidade_enviada - retornado;

  const incluirCor = () => {
    const cor = cores.find((c) => String(c.id_cor) === corParaIncluir);
    if (!cor || coresLivres.some((l) => l.id === cor.id_cor)) return;
    setCoresLivres((atuais) => [...atuais, { id: cor.id_cor, rotulo: cor.nome, hex: cor.hex }]);
    setCorParaIncluir('');
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (retornado > remessa.quantidade_enviada) {
      toast.aviso(`Voltaram ${retornado} peças, mas foram enviadas ${remessa.quantidade_enviada}.`);
      return;
    }
    if (Object.entries(maximos).some(([chave, maximo]) => (Number(valores[chave]) || 0) > maximo)) {
      toast.aviso('Há cor e tamanho com mais peças do que foram enviadas.');
      return;
    }
    try {
      setSalvando(true);
      await api.put(`/camisetas/costura/${remessa.id_costura}/retornar`, {
        itens: valoresParaLista(valores).map(({ linha, coluna, quantidade }) => ({ id_cor: linha, id_tamanho: coluna, quantidade })),
        observacoes,
      });
      toast.sucesso(`Retorno conferido: ${retornado} peças lançadas em Produtos Prontos${perdas > 0 ? ` (${perdas} perdida(s))` : ''}.`);
      onSalvo();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Erro ao registrar o retorno da facção.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalProducao titulo="Conferir retorno da facção" idTitulo="titulo-retorno-faccao" onFechar={onFechar} largo>
      <p className="producao-resumo">
        {remessa.nome_faccao} · {remessa.codigo_op} · {remessa.nome_modelo} · {remessa.quantidade_enviada} peças enviadas
      </p>
      <form onSubmit={salvar}>
        {remessa.legada && (
          <>
            <p className="producao-aviso">Remessa anterior ao controle por cor e tamanho: informe como as peças voltaram.</p>
            <div className="painel-grade-novo">
              <select aria-label="Cor a incluir" value={corParaIncluir} onChange={(e) => setCorParaIncluir(e.target.value)}>
                <option value="">Incluir cor…</option>
                {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
              </select>
              <button type="button" className="cadastro-btn secundario" onClick={incluirCor} disabled={!corParaIncluir}>
                <Plus size={16} aria-hidden="true" /> Incluir
              </button>
            </div>
          </>
        )}
        {linhas.length > 0 && colunas.length > 0 && (
          <GradeQuantidades idPrefixo="retorno" legenda="Peças que voltaram por cor e tamanho" linhas={linhas} colunas={colunas}
            valores={valores} onChange={setValores} maximos={maximos} />
        )}
        <p className={perdas > 0 ? 'producao-aviso' : 'producao-resumo'} aria-live="polite">
          Voltaram <strong>{retornado}</strong> de {remessa.quantidade_enviada} peças{descreverPerda(perdas)}.
        </p>
        <div className="cadastro-campo">
          <label htmlFor="retorno-observacoes">Observações do controle de qualidade</label>
          <textarea id="retorno-observacoes" rows="2" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </div>
        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>Confirmar retorno</button>
        </footer>
      </form>
    </ModalProducao>
  );
}
```

- [ ] **Step 3: Página de costura**

Em `frontend-alfa/src/pages/CosturaFaccoesCamisetas.jsx`:
- imports: retirar `X`, `useConfirm` e `api`; acrescentar `FormEnvioFaccao`, `ModalRetornoFaccao` e `resumoPorCor` (`../utils/producao`); ao fim, retirar qualquer import que ficar sem uso (ex.: `mensagemDeErro`);
- apagar `FORM_ENVIO_VAZIO`, `formatarNumero`, `descreverFalta`, os estados `modalRetornoAberto`, `qtdRetornada`, `obsRetorno`, `formEnvio` e as funções `handleOpChange`, `enviarRemessa`, `handleEnviarFaccao`, `handleRegistrarRetorno`; acrescentar `const [modelos, setModelos] = useState([]);` e `const [cores, setCores] = useState([]);`;
- `carregarDados` passa a ser:

```jsx
  const carregarDados = async () => {
    setLoading(true);
    const { dados, houveFalha } = await buscarEmParalelo([
      '/camisetas/ordens/', '/camisetas/costura/', '/camisetas/modelos/', '/camisetas/cores/',
    ]);
    const [listaOps, listaRemessas, listaModelos, listaCores] = dados;
    setOpsCortadas(listaOps.filter((op) => (op.saldo_disponivel_envio || 0) > 0));
    setRemessas(listaRemessas);
    setModelos(listaModelos);
    setCores(listaCores);
    if (houveFalha) {
      toast.erro('Não foi possível carregar todas as OPs e remessas. Verifique a conexão e recarregue a página.');
    }
    setLoading(false);
  };
```

- trocar o `<form onSubmit={handleEnviarFaccao}> … </form>` por `<FormEnvioFaccao ops={opsCortadas} onEnviado={carregarDados} />`;
- na tabela, embaixo do nome do modelo: `{rem.itens.length > 0 && <small className="remessa-resumo">{resumoPorCor(rem.itens)}</small>}`; o botão "Conferir Retorno" chama `setRemessaSelecionada(rem)`; o texto "Injetado no Acabado ✓" vira "Lançado em Produtos Prontos ✓";
- trocar o modal antigo por:

```jsx
        {remessaSelecionada && (
          <ModalRetornoFaccao
            remessa={remessaSelecionada}
            modelo={modelos.find((m) => m.id_modelo === remessaSelecionada.id_modelo)}
            cores={cores}
            onFechar={() => setRemessaSelecionada(null)}
            onSalvo={() => { setRemessaSelecionada(null); carregarDados(); }}
          />
        )}
```

- [ ] **Step 4: Build, lint e navegador**

Run: `cd frontend-alfa && npm run build && npx oxlint && wc -l src/pages/CosturaFaccoesCamisetas.jsx`
Expected: sem erros; página menor que antes (486).

`qa_costura_sku.mjs` (no scratchpad; roda depois do `qa_corte.mjs`, no mesmo banco):

```js
// QA Tarefa 11 (Fase 1B): envio e retorno por cor e tamanho — URL http://localhost:5173/camisetas/costura-faccoes
const PASTA = '/private/tmp/claude-501/-Users-laurindocostajunior-Documents-VScode-PlatConfec/c97f7374-3abc-47be-97f3-5917410155cf/scratchpad';

export default async function run(page) {
  const r = { dialogosNativos: [] };
  page.on('dialog', async (d) => { r.dialogosNativos.push(d.message()); await d.dismiss(); });
  const toasts = () => page.$$eval('.feedback-toast', (els) => els.map((e) => e.innerText.trim()));

  await page.waitForSelector('#envio-op option:nth-child(2)');
  await page.selectOption('#envio-op', { index: 1 });
  await page.fill('#envio-faccao', 'Facção Estrela');
  await page.getByLabel('Branco, tamanho G').fill('20');
  await page.getByRole('button', { name: /Registrar remessa de 90 peças/ }).click();
  const confirmacao = page.getByRole('button', { name: 'Enviar mesmo assim' });
  if (await confirmacao.isVisible().catch(() => false)) await confirmacao.click();
  await page.waitForFunction(() => [...document.querySelectorAll('.feedback-toast')].some((t) => t.innerText.includes('enviado')));
  r.toastEnvio = (await toasts()).at(-1);
  r.primeiraRemessa = await page.locator('.tabela-remessas tbody tr').first().innerText();

  await page.locator('.tabela-remessas tbody tr').first().getByRole('button', { name: 'Conferir Retorno' }).click();
  await page.getByLabel('Preto, tamanho P').fill('19');
  r.perda = await page.locator('.cadastro-modal [aria-live="polite"]').innerText();
  await page.screenshot({ path: `${PASTA}/retorno_modal.png` });
  await page.getByRole('button', { name: 'Confirmar retorno' }).click();
  await page.waitForSelector('.cadastro-modal', { state: 'detached' });
  r.toastRetorno = (await toasts()).at(-1);

  await page.goto('http://localhost:5173/camisetas/produtos-prontos');
  await page.getByRole('heading', { name: 'Camiseta Básica Gola Redonda' }).waitFor();
  // .first(): o cartão da Básica vem antes do da Gola V (ordem alfabética), que também tem Branco
  r.saldoPretoP = await page.getByRole('button', { name: /^Preto, tamanho P:/ }).first().getAttribute('aria-label');
  r.saldoBrancoG = await page.getByRole('button', { name: /^Branco, tamanho G:/ }).first().getAttribute('aria-label');
  await page.screenshot({ path: `${PASTA}/costura_produtos.png`, fullPage: true });
  return r;
}
```

Expected: remessa de 90 peças (Branco G reduzido de 24 para 20) com resumo "Branco: M20 G20 · Preto: P20 M30"; retorno com perda de 1; em Produtos Prontos, "Preto, tamanho P: 79 peças" (60 do seed + 19) e "Branco, tamanho G: 20 peças"; nenhum diálogo nativo nem erro de console.

- [ ] **Step 5: Commit**

```bash
git add frontend-alfa/src
git commit -m "feat: envio e retorno da facção por cor e tamanho na tela de costura" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Pedidos com itens, "Definir cor" e entrega por SKU

**Files:**
- Create: `frontend-alfa/src/utils/pedidoItens.js`
- Create: `frontend-alfa/src/components/pedidos/ItensPedidoEditor.jsx`, `ModalItensPedido.jsx`, `ModalEntregaPedido.jsx`, `pedidos.css`
- Modify: `frontend-alfa/src/pages/PedidoCamisetas.jsx`

**Interfaces:**
- Consumes: `GradeQuantidades`, `ModalProducao`, `chaveCelula` (Task 9); `POST /camisetas/pedidos/` com `itens`; `PUT /camisetas/pedidos/{id}/itens`; `POST /camisetas/pedidos/{id}/entregar` (409 com `faltas`); pedidos com `itens`; `GET /camisetas/produtos-prontos/`; modelos com `grade_tamanhos`; `GET /camisetas/cores/` (só ativas).
- Produces: `itemVazio(chave, idModelo)`, `itemParaApi(item)`, `itemDaApi(item, chave)`, `totalDoItem(item)`, `problemaDosItens(itens)`, `resumoDoItem(item)`, `saldosDosProdutos(linhas)`, `linhasDaEntrega(pedido, saldos)`; `<ItensPedidoEditor itens onChange modelos cores idPrefixo />`; `<ModalItensPedido pedido modelos cores onFechar onSalvo />`; `<ModalEntregaPedido pedido saldos hoje onFechar onEntregue />`.

- [ ] **Step 1: Funções puras**

`frontend-alfa/src/utils/pedidoItens.js`:

```js
import { chaveCelula } from './grade';

export const LINHA_QTD = 'qtd';

/** Item vazio do editor; `chave` só identifica o item na tela. */
export const itemVazio = (chave, idModelo = '') => ({ chave, id_modelo: String(idModelo), id_cor: '', valores: {} });

export const colunasDoModelo = (modelo) => (modelo?.grade_tamanhos || []).map((t) => ({ id: t.id_tamanho, rotulo: t.rotulo }));

export const totalDoItem = (item) => Object.values(item.valores).reduce((total, valor) => total + (Number(valor) || 0), 0);

export const itemParaApi = (item) => ({
  id_modelo: Number(item.id_modelo),
  id_cor: item.id_cor ? Number(item.id_cor) : null,
  quantidades: Object.entries(item.valores)
    .map(([chave, valor]) => ({ id_tamanho: Number(chave.split(':')[1]), quantidade: Number(valor) || 0 }))
    .filter((q) => q.quantidade > 0),
});

export const itemDaApi = (item, chave) => ({
  chave,
  id_modelo: String(item.id_modelo),
  id_cor: item.id_cor ? String(item.id_cor) : '',
  valores: Object.fromEntries(item.quantidades.map((q) => [chaveCelula(LINHA_QTD, q.id_tamanho), q.quantidade])),
});

/** Primeiro problema que impede salvar os itens, ou '' quando está tudo certo. */
export function problemaDosItens(itens) {
  if (itens.length === 0) return 'Inclua pelo menos um item no pedido.';
  const semModelo = itens.findIndex((i) => !i.id_modelo);
  if (semModelo >= 0) return `Escolha o modelo do item ${semModelo + 1}.`;
  const semCor = itens.findIndex((i) => !i.id_cor);
  if (semCor >= 0) return `Escolha a cor do item ${semCor + 1}.`;
  const vazio = itens.findIndex((i) => totalDoItem(i) <= 0);
  if (vazio >= 0) return `Informe as quantidades do item ${vazio + 1}.`;
  const chaves = itens.map((i) => `${i.id_modelo}:${i.id_cor}`);
  const repetido = chaves.findIndex((chave, indice) => chaves.indexOf(chave) !== indice);
  if (repetido >= 0) return `O item ${repetido + 1} repete modelo e cor de outro item; junte as quantidades num item só.`;
  return '';
}

/** "Camiseta Básica · Preto: P10 M20" (sem cor: "cor não informada"). */
export const resumoDoItem = (item) =>
  `${item.nome_modelo} · ${item.nome_cor || 'cor não informada'}: ${item.quantidades.map((q) => `${q.rotulo}${q.quantidade}`).join(' ')}`;

const chaveSku = (idModelo, idCor, idTamanho) => `${idModelo}:${idCor}:${idTamanho}`;

/** Saldo de cada SKU a partir da listagem de Produtos Prontos. */
export const saldosDosProdutos = (linhas) => new Map(
  linhas.flatMap((linha) => linha.tamanhos.map((t) => [chaveSku(linha.id_modelo, linha.id_cor, t.id_tamanho), t.saldo])),
);

/** Conferência da entrega: necessário × disponível de cada SKU do pedido. */
export const linhasDaEntrega = (pedido, saldos) => pedido.itens.flatMap((item) => item.quantidades.map((q) => ({
  chave: `${item.id_item}-${q.id_tamanho}`,
  sku: `${item.nome_modelo} · ${item.nome_cor || 'cor não informada'} · ${q.rotulo}`,
  necessario: q.quantidade,
  disponivel: item.id_cor ? saldos.get(chaveSku(item.id_modelo, item.id_cor, q.id_tamanho)) ?? 0 : 0,
  semCor: !item.id_cor,
})));
```

- [ ] **Step 2: Editor de itens**

`frontend-alfa/src/components/pedidos/ItensPedidoEditor.jsx`:

```jsx
import { Plus, Trash2 } from 'lucide-react';
import { GradeQuantidades } from '../producao/GradeQuantidades';
import { LINHA_QTD, colunasDoModelo, itemVazio, totalDoItem } from '../../utils/pedidoItens';
import '../cadastros/cadastros.css';
import './pedidos.css';

/** Lista de itens do pedido: modelo, cor e quantidades por tamanho da grade do modelo. */
export function ItensPedidoEditor({ itens, onChange, modelos, cores, idPrefixo }) {
  const alterar = (chave, mudancas) => onChange(itens.map((item) => (item.chave === chave ? { ...item, ...mudancas } : item)));
  const adicionar = () => {
    const proxima = Math.max(0, ...itens.map((item) => item.chave)) + 1;
    onChange([...itens, itemVazio(proxima, itens.at(-1)?.id_modelo ?? '')]);
  };
  const totalGeral = itens.reduce((total, item) => total + totalDoItem(item), 0);

  return (
    <fieldset className="itens-pedido">
      <legend>Itens do pedido <span className="total-grade-badge">Total: {totalGeral} peças</span></legend>
      {itens.map((item, indice) => {
        const modelo = modelos.find((m) => String(m.id_modelo) === String(item.id_modelo));
        const cor = cores.find((c) => String(c.id_cor) === String(item.id_cor));
        const id = `${idPrefixo}-${item.chave}`;
        return (
          <div key={item.chave} className="item-pedido">
            <div className="item-pedido-cabecalho">
              <strong>Item {indice + 1}</strong>
              {itens.length > 1 && (
                <button type="button" className="cadastro-btn-icone" aria-label={`Remover item ${indice + 1}`}
                  onClick={() => onChange(itens.filter((i) => i.chave !== item.chave))}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <div className="item-pedido-campos">
              <div className="cadastro-campo">
                <label htmlFor={`${id}-modelo`}>Modelo *</label>
                <select id={`${id}-modelo`} value={item.id_modelo} onChange={(e) => alterar(item.chave, { id_modelo: e.target.value, valores: {} })}>
                  <option value="">Selecione…</option>
                  {modelos.map((m) => <option key={m.id_modelo} value={m.id_modelo}>{m.nome_modelo}</option>)}
                </select>
              </div>
              <div className="cadastro-campo">
                <label htmlFor={`${id}-cor`}>Cor *</label>
                <select id={`${id}-cor`} value={item.id_cor} onChange={(e) => alterar(item.chave, { id_cor: e.target.value })}>
                  <option value="">Selecione…</option>
                  {cores.map((c) => <option key={c.id_cor} value={c.id_cor}>{c.nome}</option>)}
                </select>
              </div>
            </div>
            {modelo ? (
              <GradeQuantidades
                idPrefixo={id}
                legenda={`Quantidades do item ${indice + 1} por tamanho`}
                linhas={[{ id: LINHA_QTD, rotulo: cor?.nome || `Item ${indice + 1}`, hex: cor?.hex }]}
                colunas={colunasDoModelo(modelo)}
                valores={item.valores}
                onChange={(valores) => alterar(item.chave, { valores })}
              />
            ) : (
              <p className="painel-cadastro-vazio">Escolha o modelo para ver a grade de tamanhos.</p>
            )}
          </div>
        );
      })}
      <button type="button" className="cadastro-btn secundario" onClick={adicionar}>
        <Plus size={16} aria-hidden="true" /> Adicionar item
      </button>
    </fieldset>
  );
}
```

`frontend-alfa/src/components/pedidos/pedidos.css`:

```css
/* Itens e entrega do pedido — tokens do Ateliê Artesanal (index.css) */
.itens-pedido { display: grid; gap: 0.9rem; margin: 0 0 1.2rem; padding: 1rem 1.1rem; border: var(--border-stitch); border-radius: 12px; }
.itens-pedido legend { display: flex; align-items: center; gap: 0.6rem; padding: 0 0.4rem; font-weight: 700; }
.item-pedido { padding: 0.8rem 0.9rem; border: 1px solid var(--border-artisan); border-radius: 10px; background: var(--bg-artisan-surface); }
.item-pedido-cabecalho { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.item-pedido-campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.7rem; }
.pedido-itens-resumo { margin: 0; padding: 0; list-style: none; font-size: 0.85rem; }
.pedido-itens-resumo .sem-cor { color: var(--accent-artisan-amber); font-weight: 600; }
.btn-link-itens {
  margin-top: 0.25rem; padding: 0; border: none; background: none; font: inherit; font-size: 0.8rem;
  color: var(--accent-artisan-indigo); text-decoration: underline; cursor: pointer;
}
.entrega-skus { width: 100%; margin-bottom: 1rem; border-collapse: collapse; font-size: 0.88rem; }
.entrega-skus th, .entrega-skus td { padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border-artisan); text-align: left; }
.entrega-skus th { font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
.entrega-falta td { color: var(--accent-artisan-terracotta); font-weight: 600; }
```

- [ ] **Step 3: Modais de itens e de entrega**

`frontend-alfa/src/components/pedidos/ModalItensPedido.jsx`:

```jsx
import { useState } from 'react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { ModalProducao } from '../producao/ModalProducao';
import { itemDaApi, itemParaApi, problemaDosItens } from '../../utils/pedidoItens';
import { ItensPedidoEditor } from './ItensPedidoEditor';

/** Edição dos itens de um pedido ainda não entregue (é aqui que o pedido antigo recebe a cor). */
export function ModalItensPedido({ pedido, modelos, cores, onFechar, onSalvo }) {
  const toast = useToast();
  const [itens, setItens] = useState(() => pedido.itens.map((item, indice) => itemDaApi(item, indice + 1)));
  const [salvando, setSalvando] = useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    const problema = problemaDosItens(itens);
    if (problema) { toast.aviso(problema); return; }
    try {
      setSalvando(true);
      await api.put(`/camisetas/pedidos/${pedido.id_pedido}/itens`, { itens: itens.map(itemParaApi) });
      toast.sucesso(`Itens do pedido ${pedido.codigo_pedido} atualizados.`);
      onSalvo();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Não foi possível salvar os itens do pedido.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalProducao titulo={`Itens do pedido ${pedido.codigo_pedido}`} idTitulo="titulo-itens-pedido" onFechar={onFechar} largo>
      <form onSubmit={salvar}>
        {pedido.itens.some((item) => !item.id_cor) && (
          <p className="producao-aviso">Este pedido veio do sistema antigo, sem cor. Escolha a cor de cada item para poder entregar.</p>
        )}
        <ItensPedidoEditor itens={itens} onChange={setItens} modelos={modelos} cores={cores} idPrefixo="editar-item" />
        <footer className="cadastro-modal-rodape">
          <button type="button" className="cadastro-btn secundario" onClick={onFechar}>Cancelar</button>
          <button type="submit" className="cadastro-btn primario" disabled={salvando}>Salvar itens</button>
        </footer>
      </form>
    </ModalProducao>
  );
}
```

`frontend-alfa/src/components/pedidos/ModalEntregaPedido.jsx` (mantém o visual do modal antigo, classes de `PedidoCamisetas.css`):

```jsx
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Info, Truck, X } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../feedback/useToast';
import { mensagemDeErro } from '../feedback/mensagemErro';
import { linhasDaEntrega } from '../../utils/pedidoItens';
import './pedidos.css';

function situacao(linha) {
  if (linha.semCor) return 'Defina a cor';
  if (linha.disponivel < linha.necessario) return `Faltam ${linha.necessario - linha.disponivel}`;
  return 'OK';
}

function mensagemDaConferencia(semCor, faltando) {
  if (semCor) return 'Defina a cor dos itens antes de entregar (botão “Definir cor” na lista de pedidos).';
  if (faltando.length > 0) return `Estoque insuficiente em ${faltando.length} item(ns): a entrega fica bloqueada até as peças ficarem prontas.`;
  return 'Estoque suficiente para entregar o pedido inteiro.';
}

const descreverFaltas = (faltas) => faltas.map((f) => `${f.sku}: precisa ${f.necessario}, tem ${f.disponivel}`).join('; ');

/** Registro da entrega: confere o estoque de cada cor e tamanho do pedido antes de baixar. */
export function ModalEntregaPedido({ pedido, saldos, hoje, onFechar, onEntregue }) {
  const toast = useToast();
  const [dados, setDados] = useState({ data_entrega: hoje, recebedor: '', observacoes: '' });
  const [salvando, setSalvando] = useState(false);
  const linhas = linhasDaEntrega(pedido, saldos);
  const semCor = linhas.some((l) => l.semCor);
  const faltando = linhas.filter((l) => !l.semCor && l.disponivel < l.necessario);
  const podeEntregar = !semCor && faltando.length === 0;

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === 'Escape') onFechar(); };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [onFechar]);

  const confirmar = async (e) => {
    e.preventDefault();
    if (!podeEntregar) return;
    try {
      setSalvando(true);
      await api.post(`/camisetas/pedidos/${pedido.id_pedido}/entregar`, {
        data_entrega: dados.data_entrega || hoje, recebedor: dados.recebedor, observacoes: dados.observacoes,
      });
      toast.sucesso(`Entrega do pedido ${pedido.codigo_pedido} (${pedido.nome_cliente}) registrada: ${pedido.quantidade_total} peças saíram de Produtos Prontos.`);
      onEntregue();
    } catch (err) {
      const faltas = err.response?.data?.detail?.faltas;
      toast.erro(faltas
        ? `${mensagemDeErro(err, 'Estoque insuficiente.')} ${descreverFaltas(faltas)}`
        : mensagemDeErro(err, 'Erro ao registrar a entrega do pedido.'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-entrega-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-entrega-titulo">
      <div className="modal-entrega-card">
        <header className="modal-entrega-header">
          <div className="modal-header-icone-titulo">
            <div className="modal-icone-box"><Truck size={24} color="#2563eb" aria-hidden="true" /></div>
            <div>
              <h2 id="modal-entrega-titulo">Registrar entrega ao cliente</h2>
              <p>{pedido.codigo_pedido} · {pedido.nome_cliente} · {pedido.quantidade_total} peças</p>
            </div>
          </div>
          <button type="button" className="modal-btn-fechar" onClick={onFechar} aria-label="Fechar janela de entrega">
            <X size={20} />
          </button>
        </header>

        <form onSubmit={confirmar}>
          <div className="modal-entrega-body">
            <table className="entrega-skus">
              <caption className="sr-only">Conferência do estoque por cor e tamanho</caption>
              <thead>
                <tr><th scope="col">Item</th><th scope="col">Pedido</th><th scope="col">Em estoque</th><th scope="col">Situação</th></tr>
              </thead>
              <tbody>
                {linhas.map((linha) => (
                  <tr key={linha.chave} className={linha.semCor || linha.disponivel < linha.necessario ? 'entrega-falta' : undefined}>
                    <td>{linha.sku}</td>
                    <td>{linha.necessario}</td>
                    <td>{linha.semCor ? '—' : linha.disponivel}</td>
                    <td>{situacao(linha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className={`estoque-verificacao-box ${podeEntregar ? 'suficiente' : 'bloqueado'}`}>
              {podeEntregar
                ? <CheckCircle size={22} color="#16a34a" aria-hidden="true" />
                : <AlertTriangle size={22} color="#dc2626" aria-hidden="true" />}
              <div>
                <strong className={podeEntregar ? undefined : 'texto-estoque-bloqueado'}>{mensagemDaConferencia(semCor, faltando)}</strong>
              </div>
            </div>

            <div className="modal-form-grid">
              <div className="form-group">
                <label htmlFor="data-entrega-confirmada">Data da entrega realizada *</label>
                <input id="data-entrega-confirmada" type="date" max={hoje} value={dados.data_entrega}
                  onChange={(e) => setDados({ ...dados, data_entrega: e.target.value })} required />
              </div>
              <div className="form-group">
                <label htmlFor="recebedor-nome">Nome do recebedor / responsável</label>
                <input id="recebedor-nome" type="text" placeholder="Ex.: Carlos (gerente da loja)" value={dados.recebedor}
                  onChange={(e) => setDados({ ...dados, recebedor: e.target.value })} />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: '0.8rem' }}>
              <label htmlFor="obs-entrega">Observações da entrega (opcional)</label>
              <textarea id="obs-entrega" rows="2" value={dados.observacoes}
                onChange={(e) => setDados({ ...dados, observacoes: e.target.value })} />
            </div>

            <div className="aviso-impacto-ihc">
              <Info size={18} color="#2563eb" aria-hidden="true" />
              <span>Ao confirmar, o pedido passa para <strong>Entregue</strong> e as peças saem do estoque de cada cor e tamanho em Produtos Prontos.</span>
            </div>
          </div>

          <footer className="modal-entrega-footer">
            <button type="button" className="modal-btn-cancelar" onClick={onFechar} disabled={salvando}>Cancelar</button>
            <button type="submit" className={`modal-btn-confirmar${podeEntregar ? '' : ' btn-bloqueado'}`} disabled={salvando || !podeEntregar}>
              <CheckCircle size={18} aria-hidden="true" />
              <span>{salvando ? 'Registrando…' : 'Confirmar entrega e baixar estoque'}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Página de pedidos**

Em `frontend-alfa/src/pages/PedidoCamisetas.jsx`:
- imports (ao fim, retirar qualquer import que ficar sem uso): `useMemo` do React; dos ícones, retirar `X` e `Info`; acrescentar `ItensPedidoEditor`, `ModalItensPedido`, `ModalEntregaPedido` (`../components/pedidos/...`) e de `../utils/pedidoItens`: `itemParaApi`, `itemVazio`, `problemaDosItens`, `resumoDoItem`, `saldosDosProdutos`;
- fora do componente: `const formularioVazio = (hoje, idModelo = '') => ({ cliente: null, itens: [itemVazio(1, idModelo)], prazo_entrega: hoje, valor_total: '', observacoes: '' });`
- estado: `formData` começa com `formularioVazio(hoje)`; trocar `estoqueAcabado` por `produtosProntos`; acrescentar `cores` e `pedidoEmEdicao`; retirar `modalEntregaAberto`, `dadosEntrega` e `salvandoEntrega` (fica `pedidoParaEntrega`);
- `carregarDados`:

```jsx
  const carregarDados = async () => {
    setLoading(true);
    const { dados, houveFalha } = await buscarEmParalelo([
      '/camisetas/modelos/', '/camisetas/pedidos/', '/camisetas/produtos-prontos/', '/camisetas/cores/',
    ]);
    const [mods, listaPedidos, prontos, listaCores] = dados;
    setModelos(mods);
    setFormData((atual) => (atual.itens[0]?.id_modelo || mods.length === 0
      ? atual
      : { ...atual, itens: atual.itens.map((item, indice) => (indice === 0 ? { ...item, id_modelo: String(mods[0].id_modelo) } : item)) }));
    setPedidos(listaPedidos);
    setProdutosProntos(prontos);
    setCores(listaCores);
    if (houveFalha) {
      toast.erro('Não foi possível carregar todos os dados de pedidos. Verifique a conexão e recarregue a página.');
    }
    setLoading(false);
  };
```

- apagar `totalGrade`, `abrirModalEntrega`, `handleConfirmarEntrega` e o bloco `estoqueModeloSelecionado … temEstoqueSuficiente`;
- `handleSubmit`:

```jsx
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.cliente) {
      toast.aviso('Escolha o cliente do pedido (ou cadastre um novo pela própria busca).');
      return;
    }
    if (!formData.prazo_entrega || !formData.valor_total) {
      toast.aviso('Preencha o prazo de entrega e o valor do pedido.');
      return;
    }
    if (formData.prazo_entrega < hoje) {
      setErroData('O prazo de entrega não pode ser anterior à data de hoje.');
      return;
    }
    const problema = problemaDosItens(formData.itens);
    if (problema) {
      toast.aviso(problema);
      return;
    }
    try {
      const { data: pedidoCriado } = await api.post('/camisetas/pedidos/', {
        id_cliente: formData.cliente.id_cliente,
        itens: formData.itens.map(itemParaApi),
        prazo_entrega: formData.prazo_entrega,
        valor_total: parseFloat(formData.valor_total),
        observacoes: formData.observacoes,
      });
      toast.sucesso(`Pedido ${pedidoCriado.codigo_pedido} registrado com ${pedidoCriado.quantidade_total} peças. Status inicial: 'Aguardando Produção'.`);
      setFormData(formularioVazio(hoje, modelos[0]?.id_modelo ?? ''));
      setErroData('');
      await carregarDados();
    } catch (err) {
      toast.erro(mensagemDeErro(err, 'Erro ao salvar o pedido.'));
    }
  };
```

- KPIs: `const totalPecasEstoquePronto = produtosProntos.reduce((acc, linha) => acc + linha.total, 0);` e `const saldos = useMemo(() => saldosDosProdutos(produtosProntos), [produtosProntos]);`;
- busca: o filtro passa a olhar também `(p.itens || []).some((i) => i.nome_modelo.toLowerCase().includes(termo))` (com `const termo = busca.toLowerCase();`);
- cabeçalho da página: o parágrafo vira "Registre os pedidos por modelo, cor e tamanho, acompanhe prazos e registre a entrega com baixa automática em Produtos Prontos.";
- formulário: apagar o `form-group` do modelo e o bloco `grade-box-container` inteiro; depois do `form-grid`, inserir
  `<ItensPedidoEditor itens={formData.itens} onChange={(itens) => setFormData((atual) => ({ ...atual, itens }))} modelos={modelos} cores={cores} idPrefixo="novo-item" />`;
- tabela: colunas `Código | Cliente | Itens | Total Peças | Prazo Entrega | Valor Total | Status | Ação de Entrega` (`colSpan="8"` na linha vazia); a célula de itens:

```jsx
                        <td>
                          <ul className="pedido-itens-resumo">
                            {ped.itens.map((item) => (
                              <li key={item.id_item} className={item.id_cor ? undefined : 'sem-cor'}>{resumoDoItem(item)}</li>
                            ))}
                          </ul>
                          {!isEntregue && (
                            <button type="button" className="btn-link-itens" onClick={() => setPedidoEmEdicao(ped)}>
                              {ped.itens.some((item) => !item.id_cor) ? 'Definir cor' : 'Editar itens'}
                            </button>
                          )}
                        </td>
```

- o botão "Registrar Entrega" chama `setPedidoParaEntrega(ped)`; em `handleReverterEntrega`, a mensagem vira "O status volta para 'Aguardando Produção' e as {n} peças voltam para Produtos Prontos.";
- trocar o bloco do modal de entrega antigo por:

```jsx
        {pedidoParaEntrega && (
          <ModalEntregaPedido
            pedido={pedidoParaEntrega}
            saldos={saldos}
            hoje={hoje}
            onFechar={() => setPedidoParaEntrega(null)}
            onEntregue={() => { setPedidoParaEntrega(null); carregarDados(); }}
          />
        )}
        {pedidoEmEdicao && (
          <ModalItensPedido
            pedido={pedidoEmEdicao}
            modelos={modelos}
            cores={cores}
            onFechar={() => setPedidoEmEdicao(null)}
            onSalvo={() => { setPedidoEmEdicao(null); carregarDados(); }}
          />
        )}
```

- [ ] **Step 5: Build, lint e navegador**

Run: `cd frontend-alfa && npm run build && npx oxlint && wc -l src/pages/PedidoCamisetas.jsx`
Expected: sem erros; página menor que antes (672).

Criar um pedido no formato antigo (simula um pedido migrado) antes do QA:

```bash
curl -s -X POST http://localhost:8001/camisetas/pedidos/ -H 'Content-Type: application/json' \
  -d "{\"nome_cliente\": \"Loja Antiga\", \"id_modelo\": 1, \"grade_p\": 2, \"prazo_entrega\": \"$(date +%F)\", \"valor_total\": 50}"
```

`qa_pedidos_sku.mjs` (no scratchpad; roda depois do `qa_costura_sku.mjs`):

```js
// QA Tarefa 12 (Fase 1B): pedido com itens, "Definir cor" e entrega por SKU — URL http://localhost:5173/camisetas/pedidos
const PASTA = '/private/tmp/claude-501/-Users-laurindocostajunior-Documents-VScode-PlatConfec/c97f7374-3abc-47be-97f3-5917410155cf/scratchpad';

export default async function run(page) {
  const r = { dialogosNativos: [] };
  page.on('dialog', async (d) => { r.dialogosNativos.push(d.message()); await d.dismiss(); });
  const toasts = () => page.$$eval('.feedback-toast', (els) => els.map((e) => e.innerText.trim()));
  const linha = (texto) => page.locator('.pedidos-table tbody tr', { hasText: texto }).first();

  await page.waitForSelector('.pedidos-table tbody tr td:nth-child(2)');
  r.kpiEstoque = await page.textContent('.kpi-pedido-card.estoque-pronto .kpi-valor');

  // Novo pedido com dois itens
  await page.locator('#campo-cliente').pressSequentially('Lojas Alpha', { delay: 20 });
  await page.waitForSelector('.seletor-cliente-opcao');
  await page.locator('.seletor-cliente-opcao').first().click();
  await page.waitForSelector('.seletor-cliente-ok');
  await page.selectOption('#novo-item-1-cor', { label: 'Branco' });
  await page.getByLabel('Branco, tamanho M').fill('10');
  await page.getByRole('button', { name: 'Adicionar item' }).click();
  await page.selectOption('#novo-item-2-cor', { label: 'Preto' });
  await page.getByLabel('Preto, tamanho P').fill('5');
  await page.fill('#campo-valor-total', '500');
  await page.screenshot({ path: `${PASTA}/pedido_form.png`, fullPage: true });
  await page.getByRole('button', { name: /Salvar Pedido/ }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('.feedback-toast')].some((t) => t.innerText.includes('registrado')));
  r.toastPedido = (await toasts()).at(-1);
  r.linhaNova = await page.locator('.pedidos-table tbody tr').first().innerText();

  // Entrega do pedido novo (há estoque)
  await page.locator('.pedidos-table tbody tr').first().getByRole('button', { name: /Registrar entrega/ }).click();
  r.conferenciaOk = await page.textContent('.estoque-verificacao-box');
  await page.getByRole('button', { name: 'Confirmar entrega e baixar estoque' }).click();
  await page.waitForSelector('.modal-entrega-backdrop', { state: 'detached' });
  r.toastEntrega = (await toasts()).at(-1);

  // PED-002 (Branco, 200 peças): falta estoque
  await linha('PED-002').getByRole('button', { name: /Registrar entrega/ }).click();
  r.conferenciaFalta = await page.textContent('.estoque-verificacao-box');
  r.botaoBloqueado = await page.getByRole('button', { name: 'Confirmar entrega e baixar estoque' }).isDisabled();
  await page.screenshot({ path: `${PASTA}/entrega_falta.png` });
  await page.getByRole('button', { name: 'Fechar janela de entrega' }).click();

  // Pedido antigo: Definir cor
  await linha('Loja Antiga').getByRole('button', { name: 'Definir cor' }).click();
  await page.selectOption('#editar-item-1-cor', { label: 'Preto' });
  await page.getByRole('button', { name: 'Salvar itens' }).click();
  await page.waitForSelector('.cadastro-modal', { state: 'detached' });
  r.pedidoAntigoDepois = await linha('Loja Antiga').innerText();
  await page.screenshot({ path: `${PASTA}/pedidos.png`, fullPage: true });
  return r;
}
```

Expected: KPI de estoque igual ao total de Produtos Prontos; pedido novo com "Camiseta Básica Gola Redonda · Branco: M10" e "… · Preto: P5"; entrega registrada; PED-002 mostra "Estoque insuficiente em …" com o botão desativado; o pedido da "Loja Antiga" passa de "cor não informada" para "Preto: P2"; nenhum diálogo nativo nem erro de console. Conferir os PNGs.

- [ ] **Step 6: Commit**

```bash
git add frontend-alfa/src
git commit -m "feat: pedidos com itens por cor e tamanho, definir cor e entrega por SKU" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verificação final, documentação e pendências de produção

**Files:**
- Modify: `docs/superpowers/plans/2026-11-10-fase1b-estoque-sku.md` (seção "Notas de execução"), `README.md` (se listar as telas/rotas)
- Modify: memória `fase0-pendencias-producao.md` (fora do repositório)

- [ ] **Step 1: Suíte completa e cobertura**

Run: `cd backend && venv/bin/python -m pytest --cov=app/services --cov-report=term-missing -q`
Expected: todos os testes passam; cobertura de `app/services` ≥ 80%.

- [ ] **Step 2: Migração do zero e alinhamento**

Run: `cd backend && rm -f /tmp/fase1b.db && DATABASE_URL=sqlite:////tmp/fase1b.db venv/bin/python -m alembic upgrade head && DATABASE_URL=sqlite:////tmp/fase1b.db venv/bin/python -m alembic check; rm -f /tmp/fase1b.db`
Expected: "No new upgrade operations detected."

- [ ] **Step 3: Frontend**

Run: `cd frontend-alfa && npm run build && npx oxlint && wc -l src/pages/*.jsx src/components/*/*.jsx | sort -n | tail -5`
Expected: build e lint sem erros; nenhum arquivo tocado acima de 800 linhas.

- [ ] **Step 4: Fluxo completo no navegador**

Com banco novo (roteiro de verificação local + seed), rodar em sequência `qa_produtos.mjs`, `qa_corte.mjs`, `qa_costura_sku.mjs` e (depois do `curl` do pedido antigo) `qa_pedidos_sku.mjs`; conferir os resultados esperados de cada tarefa, abrir os PNGs e verificar o Dashboard (`/camisetas/dashboard`: card de estoque pronto igual ao total de Produtos Prontos). Desligar backend e frontend ao terminar.

- [ ] **Step 5: Documentação e memória**

- Acrescentar ao fim deste plano a seção `## Notas de execução` com o que mudou em relação ao plano (ajustes de teste, mensagens, arquivos).
- Se o `README.md` listar telas ou rotas, incluir "Produtos Prontos" e as rotas novas.
- Atualizar a memória `fase0-pendencias-producao.md`: o `alembic upgrade head` em produção precisa aplicar também a `20261110_006_estoque_sku` (que converte os pedidos em itens e cria os índices que a 005 deixou de criar); depois dela, o estoque pronto começa zerado e precisa do inventário de abertura na tela Produtos Prontos.

- [ ] **Step 6: Commit**

```bash
git add docs README.md
git commit -m "docs: notas de execução da Fase 1B" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
