# Fase 0 — Fundação (Camisetas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o segmento Camisetas confiável (financeiro e estoque corretos, códigos sem colisão, dashboard sem números inventados) e organizado/testado para receber as próximas fases.

**Architecture:** Backend FastAPI: o router monolítico `app/routers/camisetas.py` vira um pacote com um arquivo por assunto, e as regras de negócio vão para `app/services/` (funções puras sempre que possível, testadas com pytest + SQLite em memória). Frontend React: um provedor único de avisos (toast) e confirmações substitui `alert()`/`window.confirm()` e as 4 cópias locais de toast.

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, Pydantic 2, Alembic, pytest; React 19 + Vite 8, axios, lucide-react, recharts, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-10-fase0-fundacao-design.md`

## Global Constraints

- Trabalhar no branch `fase-0-fundacao` (já criado). Nunca commitar na `main`.
- Toda mensagem de commit segue `<tipo>: <descrição>` (feat, fix, refactor, docs, test, chore) e termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use um segundo `-m`).
- **Nunca rodar nada contra o banco de produção.** O arquivo `backend/.env` aponta para ele. Testes forçam `DATABASE_URL=sqlite://` no `conftest.py`; execução local usa sempre `DATABASE_URL=sqlite:///./dev.db`.
- Comandos de backend rodam dentro de `backend/` com o Python do venv: `venv/bin/python -m ...` (no Windows: `venv\Scripts\python -m ...`).
- Fuso horário do negócio: `America/Fortaleza` (constante `FUSO_HORARIO` em `app/core/config.py`). "Hoje" e limites de mês sempre neste fuso.
- Migrações Alembic **somente aditivas**, sempre com `downgrade`. Revisões novas: `20261110_003_sequencias` e `20261110_004_data_entrega`.
- Moda Íntima é congelada: não alterar seus routers, models, schemas nem páginas.
- Nenhuma URL usada pelo frontend muda, exceto a remoção de `POST /camisetas/financeiro/sincronizar-automatico/`.
- Textos de interface e mensagens de erro em português claro e acionável. Erros de regra: 400 (dado inválido), 404 (não encontrado), 409 (conflito de estado/confirmação necessária), 422 (formato inválido).
- Frontend: `npm run build` sem erros e `npx oxlint` sem **erros** (avisos preexistentes são tolerados; não introduza avisos novos de import não usado nos arquivos tocados).
- Cobertura de testes ≥ 80% em `app/services/`.

### Roteiro de verificação local (usado nas tarefas de frontend)

```bash
# Terminal 1 — backend com banco local descartável
cd backend
rm -f dev.db
DATABASE_URL=sqlite:///./dev.db venv/bin/python -m uvicorn app.main:app --reload
# (a partir da Tarefa 15, rode antes: DATABASE_URL=sqlite:///./dev.db venv/bin/python -m alembic upgrade head)

# Terminal 2 — dados de demonstração
curl -s -X POST http://localhost:8000/camisetas/seed-inicial

# Terminal 3 — frontend
cd frontend-alfa && npm run dev
# Abrir http://localhost:5173/camisetas/dashboard (as rotas não exigem login)
```

---

### Task 1: Infraestrutura de testes e configuração do backend

**Files:**
- Create: `backend/requirements-dev.txt`
- Modify: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/app/core/config.py`
- Modify: `backend/alembic/env.py:15`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/fabricas.py`
- Test: `backend/tests/test_infra.py`

**Interfaces:**
- Produces: fixtures pytest `db` (Session SQLite em memória com todas as tabelas) e `client` (`TestClient` usando essa sessão); `app.core.config.FUSO_HORARIO: ZoneInfo`; funções em `tests/fabricas.py`: `criar_modelo(db, nome="Camiseta Básica", consumo_kg="0.1800")`, `criar_insumo(db, codigo="MALHA-01", categoria="ROLO_TECIDO", nome="Meia Malha 30.1", unidade="kg", saldo="100.000", custo="40.00", minimo="10.000")`, `criar_item_ficha(db, modelo, insumo=None, tipo="Linha de Costura", consumo="0.0200", unidade="unidades")`, `criar_entrada(db, insumo, quantidade="10.000", valor="100.00", data=None)`, `criar_pedido(db, modelo, codigo="PED-T-1", valor="1000.00", status="Aguardando Produção", grade=(10, 10, 10, 10), criado_em=None, observacoes=None)`, `criar_op_cortada(db, modelo, codigo="OP-T-1", pecas=100, peso="20.000", tecido=None)`, `criar_remessa(db, op, quantidade=50, status="Em Costura Externa")`, `criar_estoque_acabado(db, modelo, grade=(0, 0, 0, 0))`, `criar_registro_financeiro(db, mes_ano, outros="0.00", observacoes=None)`.

- [ ] **Step 1: Declarar dependências**

`backend/requirements.txt` — acrescentar ao final:

```
alembic>=1.13
tzdata>=2024.1
```

`backend/requirements-dev.txt`:

```
-r requirements.txt
pytest>=8.0
pytest-cov>=5.0
httpx>=0.27
```

Run: `cd backend && venv/bin/python -m pip install -r requirements-dev.txt`
Expected: instalação concluída sem erro.

- [ ] **Step 2: Configuração do pytest e fuso**

`backend/pytest.ini`:

```ini
[pytest]
testpaths = tests
pythonpath = .
addopts = -q
```

`backend/app/core/config.py`:

```python
# app/core/config.py
"""Constantes de configuração da aplicação."""
from zoneinfo import ZoneInfo

# Fuso do negócio: define "hoje" e os limites de cada mês no financeiro.
FUSO_HORARIO = ZoneInfo("America/Fortaleza")
```

- [ ] **Step 3: Alembic enxergar os modelos de Camisetas**

Em `backend/alembic/env.py`, linha 15, trocar:

```python
from app.models import usuarios, estoque, ficha_tecnica, producao, costura, comercial, equipe
```

por:

```python
from app.models import usuarios, estoque, ficha_tecnica, producao, costura, comercial, equipe, camisetas
```

- [ ] **Step 4: Fixtures de teste**

`backend/tests/conftest.py`:

```python
"""Fixtures compartilhadas. NUNCA aponte os testes para o banco de produção."""
import os

# Forçado (não setdefault): o backend/.env local aponta para produção.
os.environ["DATABASE_URL"] = "sqlite://"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402

engine_teste = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SessaoTeste = sessionmaker(autocommit=False, autoflush=False, bind=engine_teste)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine_teste)
    sessao = SessaoTeste()
    try:
        yield sessao
    finally:
        sessao.close()
        Base.metadata.drop_all(bind=engine_teste)


@pytest.fixture()
def client(db):
    def _get_db_teste():
        yield db

    app.dependency_overrides[get_db] = _get_db_teste
    with TestClient(app) as cliente:
        yield cliente
    app.dependency_overrides.clear()
```

`backend/tests/fabricas.py`:

```python
"""Fábricas de registros para os testes do segmento Camisetas."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.models.camisetas import (
    CamisetaCosturaFaccao,
    CamisetaEntradaInsumo,
    CamisetaFichaTecnica,
    CamisetaInsumo,
    CamisetaModelo,
    CamisetaOrdemProducao,
    CamisetaPedido,
    CamisetaProdutoAcabado,
    CamisetaRegistroFinanceiro,
)


def _salvar(db, objeto):
    db.add(objeto)
    db.commit()
    db.refresh(objeto)
    return objeto


def criar_modelo(db, nome="Camiseta Básica", consumo_kg="0.1800"):
    return _salvar(db, CamisetaModelo(nome_modelo=nome, consumo_tecido_kg=Decimal(consumo_kg)))


def criar_insumo(db, codigo="MALHA-01", categoria="ROLO_TECIDO", nome="Meia Malha 30.1",
                 unidade="kg", saldo="100.000", custo="40.00", minimo="10.000"):
    return _salvar(db, CamisetaInsumo(
        codigo=codigo,
        categoria=categoria,
        tipo_malha_ou_aviamento=nome,
        unidade_medida=unidade,
        saldo_atual=Decimal(saldo),
        estoque_minimo=Decimal(minimo),
        preco_custo_medio=Decimal(custo),
    ))


def criar_item_ficha(db, modelo, insumo=None, tipo="Linha de Costura", consumo="0.0200", unidade="unidades"):
    return _salvar(db, CamisetaFichaTecnica(
        id_modelo=modelo.id_modelo,
        id_insumo=insumo.id_insumo if insumo else None,
        tipo_insumo=tipo,
        descricao_insumo=insumo.tipo_malha_ou_aviamento if insumo else tipo,
        consumo_unitario=Decimal(consumo),
        unidade_medida=unidade,
    ))


def criar_entrada(db, insumo, quantidade="10.000", valor="100.00", data=None):
    # Grava em UTC, como a aplicação faz (get_utc_now).
    momento = (data or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return _salvar(db, CamisetaEntradaInsumo(
        id_insumo=insumo.id_insumo,
        quantidade=Decimal(quantidade),
        valor_total=Decimal(valor),
        data_entrada=momento,
    ))


def criar_pedido(db, modelo, codigo="PED-T-1", valor="1000.00", status="Aguardando Produção",
                 grade=(10, 10, 10, 10), criado_em=None, observacoes=None):
    p, m, g, gg = grade
    return _salvar(db, CamisetaPedido(
        codigo_pedido=codigo,
        nome_cliente="Cliente Teste",
        id_modelo=modelo.id_modelo,
        grade_p=p, grade_m=m, grade_g=g, grade_gg=gg,
        quantidade_total=p + m + g + gg,
        prazo_entrega=date.today() + timedelta(days=10),
        valor_total=Decimal(valor),
        status_pedido=status,
        observacoes=observacoes,
        criado_em=criado_em or datetime.now(timezone.utc),
    ))


def criar_op_cortada(db, modelo, codigo="OP-T-1", pecas=100, peso="20.000", tecido=None):
    return _salvar(db, CamisetaOrdemProducao(
        codigo_op=codigo,
        id_modelo=modelo.id_modelo,
        id_insumo_tecido=tecido.id_insumo if tecido else None,
        peso_malha_enviado_kg=Decimal(peso),
        pecas_planejadas=pecas,
        pecas_reais_cortadas=pecas,
        status_op="Cortado (Pronto para Costura)",
    ))


def criar_remessa(db, op, quantidade=50, status="Em Costura Externa"):
    return _salvar(db, CamisetaCosturaFaccao(
        id_op=op.id_op,
        nome_faccao="Facção Teste",
        quantidade_enviada=quantidade,
        status=status,
    ))


def criar_estoque_acabado(db, modelo, grade=(0, 0, 0, 0)):
    p, m, g, gg = grade
    return _salvar(db, CamisetaProdutoAcabado(
        id_modelo=modelo.id_modelo,
        grade_p=p, grade_m=m, grade_g=g, grade_gg=gg,
        quantidade_total=p + m + g + gg,
    ))


def criar_registro_financeiro(db, mes_ano, outros="0.00", observacoes=None):
    return _salvar(db, CamisetaRegistroFinanceiro(
        mes_ano=mes_ano,
        outros_custos_operacionais=Decimal(outros),
        observacoes=observacoes,
    ))
```

- [ ] **Step 5: Teste de fumaça da infraestrutura**

`backend/tests/test_infra.py`:

```python
from app.models.camisetas import CamisetaModelo
from tests.fabricas import criar_modelo


def test_api_responde(client):
    resposta = client.get("/")
    assert resposta.status_code == 200


def test_banco_de_teste_isolado(db):
    criar_modelo(db, nome="Modelo Isolado")
    assert db.query(CamisetaModelo).count() == 1
```

- [ ] **Step 6: Rodar**

Run: `cd backend && venv/bin/python -m pytest tests/test_infra.py -v`
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/requirements.txt backend/requirements-dev.txt backend/pytest.ini backend/app/core/config.py backend/alembic/env.py backend/tests
git commit -m "test: infraestrutura de testes do backend com SQLite em memória" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Dividir o router de Camisetas por assunto (sem mudar comportamento)

**Files:**
- Delete: `backend/app/routers/camisetas.py`
- Create: `backend/app/routers/camisetas/__init__.py`, `seed.py`, `dashboard.py`, `pedidos.py`, `insumos.py`, `modelos.py`, `ordens.py`, `financeiro.py`, `costura.py`
- Test: `backend/tests/test_rotas_camisetas.py`

**Interfaces:**
- Consumes: fixtures da Task 1.
- Produces: módulos `app.routers.camisetas.<assunto>`, cada um com `router = APIRouter()` sem prefixo; `app.routers.camisetas.router` com `prefix="/camisetas"` (o `main.py` não muda). Constante de teste `ROTAS_ESPERADAS` em `tests/test_rotas_camisetas.py`.

- [ ] **Step 1: Teste de caracterização das rotas (deve passar ANTES da divisão)**

`backend/tests/test_rotas_camisetas.py`:

```python
from app.main import app

ROTAS_ESPERADAS = {
    ("POST", "/camisetas/seed-inicial"),
    ("GET", "/camisetas/dashboard/"),
    ("GET", "/camisetas/pedidos/"),
    ("POST", "/camisetas/pedidos/"),
    ("PUT", "/camisetas/pedidos/{id_pedido}/status"),
    ("POST", "/camisetas/pedidos/{id_pedido}/entregar"),
    ("DELETE", "/camisetas/pedidos/{id_pedido}"),
    ("GET", "/camisetas/estoque-acabado/"),
    ("GET", "/camisetas/insumos/"),
    ("POST", "/camisetas/insumos/"),
    ("POST", "/camisetas/insumos/entrada/"),
    ("GET", "/camisetas/modelos/"),
    ("POST", "/camisetas/modelos/"),
    ("GET", "/camisetas/fichas/"),
    ("POST", "/camisetas/fichas/"),
    ("DELETE", "/camisetas/fichas/{id_ficha}"),
    ("GET", "/camisetas/ordens/"),
    ("POST", "/camisetas/ordens/"),
    ("PUT", "/camisetas/ordens/{id_op}/finalizar-corte"),
    ("GET", "/camisetas/financeiro/apuracao-mensal/"),
    ("POST", "/camisetas/financeiro/sincronizar-automatico/"),
    ("GET", "/camisetas/financeiro/"),
    ("POST", "/camisetas/financeiro/"),
    ("GET", "/camisetas/costura/"),
    ("POST", "/camisetas/costura/enviar"),
    ("PUT", "/camisetas/costura/{id_costura}/retornar"),
}


def rotas_camisetas():
    # FastAPI 0.143 guarda routers incluídos como _IncludedRouter; o esquema OpenAPI
    # é a forma pública e estável de listar todas as rotas efetivas.
    caminhos = app.openapi()["paths"]
    return {
        (metodo.upper(), caminho)
        for caminho, operacoes in caminhos.items()
        if caminho.startswith("/camisetas")
        for metodo in operacoes
    }


def test_rotas_camisetas_nao_mudam():
    assert rotas_camisetas() == ROTAS_ESPERADAS
```

Run: `cd backend && venv/bin/python -m pytest tests/test_rotas_camisetas.py -v`
Expected: 1 passed (caracteriza o estado atual).

- [ ] **Step 2: Conferir os marcos do arquivo original**

Run: `cd backend/app/routers && wc -l < camisetas.py && sed -n '43p;289p;419p;673p;762p;821p;954p;1182p' camisetas.py`
Expected: `1353` e, na ordem, as linhas que começam com: `# ----------------- SEED INICIAL`, `NOME_MESES = {`, `# ----------------- 2. CADASTRO DE PEDIDOS`, `# ----------------- 3. GESTÃO DE ESTOQUE`, `# ----------------- 4. MODELOS`, `# ----------------- 5. CORTE`, `# ----------------- 6. REGISTRO FINANCEIRO`, `# ----------------- 7. COSTURA`. Se algo diferir, PARE e reavalie os intervalos.

- [ ] **Step 3: Dividir o arquivo (script determinístico)**

```bash
cd backend/app/routers
bash <<'SCRIPT'
set -euo pipefail
mkdir -p camisetas_novo
cabecalho=$(sed -n '7,39p' camisetas.py)
while IFS=: read -r nome inicio fim; do
  {
    printf '# app/routers/camisetas/%s.py\n' "$nome"
    printf '%s\n\n' "$cabecalho"
    printf 'router = APIRouter()\n\n'
    sed -n "${inicio},${fim}p" camisetas.py
  } > "camisetas_novo/${nome}.py"
done <<'INTERVALOS'
seed:43:286
dashboard:289:416
pedidos:419:670
insumos:673:759
modelos:762:818
ordens:821:951
financeiro:954:1179
costura:1182:1353
INTERVALOS
SCRIPT
git rm -q camisetas.py
rm -f __pycache__/camisetas.*.pyc
mv camisetas_novo camisetas
```

- [ ] **Step 4: Criar o `__init__.py` do pacote**

`backend/app/routers/camisetas/__init__.py`:

```python
# app/routers/camisetas/__init__.py
"""Rotas do Segmento Camisetas, divididas por assunto."""
from fastapi import APIRouter

from app.routers.camisetas import (
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

for _modulo in (seed, dashboard, pedidos, insumos, modelos, ordens, financeiro, costura):
    router.include_router(_modulo.router)
```

- [ ] **Step 5: Rodar todos os testes**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam (3 testes), em especial `test_rotas_camisetas_nao_mudam`.

- [ ] **Step 6: Commit**

```bash
git add -A backend/app/routers backend/tests/test_rotas_camisetas.py
git commit -m "refactor: divide o router de Camisetas em um arquivo por assunto" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Códigos sequenciais de Pedido e OP gerados pelo servidor

**Files:**
- Create: `backend/app/models/sequencias.py`
- Create: `backend/app/services/__init__.py` (vazio), `backend/app/services/camisetas/__init__.py` (vazio)
- Create: `backend/app/services/sequencias.py`
- Create: `backend/alembic/versions/20261110_003_sequencias_documentos.py`
- Modify: `backend/alembic/env.py:15`
- Modify: `backend/app/schemas/camisetas.py:84-86` e `:135-136`
- Modify: `backend/app/routers/camisetas/pedidos.py` (função `cadastrar_pedido`)
- Modify: `backend/app/routers/camisetas/ordens.py` (função `abrir_ordem_corte`)
- Test: `backend/tests/test_sequencias.py`, `backend/tests/test_migracoes.py`

**Interfaces:**
- Consumes: `FUSO_HORARIO` (Task 1).
- Produces: `app.services.sequencias.proximo_codigo(db: Session, prefixo: str, agora: datetime | None = None) -> str` (ex.: `"PED-2026-0001"`; faz `flush`, não `commit`); modelo `SequenciaDocumento(prefixo, ano, ultimo_numero)`; helper de teste `rodar_alembic(*args, url)` em `tests/test_migracoes.py`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_sequencias.py`:

```python
import re
from datetime import date, datetime, timedelta

from app.core.config import FUSO_HORARIO
from app.services.sequencias import proximo_codigo
from tests.fabricas import criar_insumo, criar_modelo

EM_2026 = datetime(2026, 3, 1, 12, 0, tzinfo=FUSO_HORARIO)
EM_2027 = datetime(2027, 1, 2, 9, 0, tzinfo=FUSO_HORARIO)


def test_primeiro_codigo_do_ano(db):
    assert proximo_codigo(db, "PED", agora=EM_2026) == "PED-2026-0001"


def test_codigos_incrementam(db):
    proximo_codigo(db, "PED", agora=EM_2026)
    assert proximo_codigo(db, "PED", agora=EM_2026) == "PED-2026-0002"


def test_numeracao_reinicia_na_virada_do_ano(db):
    proximo_codigo(db, "PED", agora=EM_2026)
    assert proximo_codigo(db, "PED", agora=EM_2027) == "PED-2027-0001"


def test_prefixos_sao_independentes(db):
    proximo_codigo(db, "PED", agora=EM_2026)
    assert proximo_codigo(db, "OP", agora=EM_2026) == "OP-2026-0001"


def _payload_pedido(id_modelo, **extra):
    return {
        "nome_cliente": "Loja Beta",
        "id_modelo": id_modelo,
        "grade_p": 5, "grade_m": 5, "grade_g": 0, "grade_gg": 0,
        "prazo_entrega": (date.today() + timedelta(days=7)).isoformat(),
        "valor_total": "300.00",
        **extra,
    }


def test_api_gera_codigo_do_pedido(client, db):
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json=_payload_pedido(modelo.id_modelo))
    assert resposta.status_code == 201
    assert re.fullmatch(r"PED-\d{4}-0001", resposta.json()["codigo_pedido"])


def test_api_ignora_codigo_enviado_pelo_cliente(client, db):
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json=_payload_pedido(modelo.id_modelo, codigo_pedido="PED-123"))
    assert resposta.status_code == 201
    assert resposta.json()["codigo_pedido"] != "PED-123"


def test_api_gera_codigo_da_op(client, db):
    modelo = criar_modelo(db)
    tecido = criar_insumo(db, saldo="50.000")
    resposta = client.post("/camisetas/ordens/", json={
        "id_modelo": modelo.id_modelo,
        "id_insumo_tecido": tecido.id_insumo,
        "peso_malha_enviado_kg": "10.000",
    })
    assert resposta.status_code == 201
    assert re.fullmatch(r"OP-\d{4}-0001", resposta.json()["codigo_op"])
```

`backend/tests/test_migracoes.py`:

```python
import os
import subprocess
import sys
from pathlib import Path

import sqlalchemy as sa

BACKEND = Path(__file__).resolve().parents[1]


def rodar_alembic(*args, url):
    ambiente = {**os.environ, "DATABASE_URL": url}
    resultado = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND, env=ambiente, capture_output=True, text=True,
    )
    assert resultado.returncode == 0, resultado.stderr


def tabelas(url):
    return set(sa.inspect(sa.create_engine(url)).get_table_names())


def test_migracao_de_sequencias_sobe_e_desce(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261110_003_sequencias", url=url)
    assert "sequencias_documentos" in tabelas(url)
    rodar_alembic("downgrade", "20261022_002_camisetas", url=url)
    assert "sequencias_documentos" not in tabelas(url)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_sequencias.py tests/test_migracoes.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services'` e erro do Alembic "Can't locate revision".

- [ ] **Step 3: Modelo, serviço e migração**

`backend/app/models/sequencias.py`:

```python
# app/models/sequencias.py
from sqlalchemy import Column, Integer, String

from app.database import Base


class SequenciaDocumento(Base):
    """Último número usado por tipo de documento e ano (ex.: PED/2026 → 41)."""

    __tablename__ = "sequencias_documentos"

    prefixo = Column(String(10), primary_key=True)
    ano = Column(Integer, primary_key=True)
    ultimo_numero = Column(Integer, nullable=False, default=0)
```

`backend/app/services/__init__.py` e `backend/app/services/camisetas/__init__.py`: arquivos vazios.

`backend/app/services/sequencias.py`:

```python
# app/services/sequencias.py
"""Numeração sequencial de documentos (pedidos, OPs) sem colisão."""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.models.sequencias import SequenciaDocumento


def proximo_codigo(db: Session, prefixo: str, agora: Optional[datetime] = None) -> str:
    """Reserva o próximo número do ano e devolve o código, ex.: PED-2026-0001.

    Usa SELECT ... FOR UPDATE (PostgreSQL) para que dois pedidos simultâneos não
    recebam o mesmo número. Não faz commit: o número só é gravado junto com o
    documento que o usa.
    """
    ano = (agora or datetime.now(FUSO_HORARIO)).year
    sequencia = (
        db.query(SequenciaDocumento)
        .filter_by(prefixo=prefixo, ano=ano)
        .with_for_update()
        .first()
    )
    if sequencia is None:
        sequencia = SequenciaDocumento(prefixo=prefixo, ano=ano, ultimo_numero=0)
        db.add(sequencia)
    sequencia.ultimo_numero = (sequencia.ultimo_numero or 0) + 1
    db.flush()
    return f"{prefixo}-{ano}-{sequencia.ultimo_numero:04d}"
```

`backend/alembic/versions/20261110_003_sequencias_documentos.py`:

```python
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
```

Em `backend/alembic/env.py`, linha 15, acrescentar `sequencias` ao final do import:

```python
from app.models import usuarios, estoque, ficha_tecnica, producao, costura, comercial, equipe, camisetas, sequencias
```

- [ ] **Step 4: Schemas — código passa a ser opcional e ignorado**

Em `backend/app/schemas/camisetas.py`, trocar `codigo_pedido: str` (dentro de `CamisetaPedidoCreate`) por:

```python
    codigo_pedido: Optional[str] = None  # ignorado: o servidor gera PED-AAAA-NNNN
```

e `codigo_op: str` (dentro de `CamisetaOrdemProducaoCreate`) por:

```python
    codigo_op: Optional[str] = None  # ignorado: o servidor gera OP-AAAA-NNNN
```

- [ ] **Step 5: Routers usam a sequência**

Em `backend/app/routers/camisetas/pedidos.py`: acrescentar após o bloco de imports de schemas:

```python
from app.services.sequencias import proximo_codigo
```

e, em `cadastrar_pedido`, trocar a linha `        codigo_pedido=pedido_in.codigo_pedido,` por:

```python
        codigo_pedido=proximo_codigo(db, "PED"),
```

Em `backend/app/routers/camisetas/ordens.py`: acrescentar o mesmo import e, em `abrir_ordem_corte`, trocar `        codigo_op=op_in.codigo_op,` por:

```python
        codigo_op=proximo_codigo(db, "OP"),
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam (inclui os 7 de sequência e o de migração).

- [ ] **Step 7: Commit**

```bash
git add backend/app/models/sequencias.py backend/app/services backend/alembic backend/app/schemas/camisetas.py backend/app/routers/camisetas/pedidos.py backend/app/routers/camisetas/ordens.py backend/tests/test_sequencias.py backend/tests/test_migracoes.py
git commit -m "feat: códigos PED-AAAA-NNNN e OP-AAAA-NNNN gerados pelo servidor" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Custo médio ponderado na entrada de nota fiscal

**Files:**
- Create: `backend/app/services/camisetas/estoque.py`
- Modify: `backend/app/routers/camisetas/insumos.py` (função `registrar_entrada_estoque`)
- Test: `backend/tests/test_custo_medio.py`

**Interfaces:**
- Produces: `app.services.camisetas.estoque.calcular_custo_medio(saldo_anterior: Decimal, custo_anterior: Decimal, quantidade: Decimal, valor_total: Decimal) -> Decimal` (2 casas, ROUND_HALF_UP); constantes `DUAS_CASAS`, `ZERO` no mesmo módulo.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_custo_medio.py`:

```python
from decimal import Decimal

from app.services.camisetas.estoque import calcular_custo_medio
from tests.fabricas import criar_insumo


def D(valor):
    return Decimal(valor)


def test_sem_saldo_o_custo_e_o_da_nota():
    assert calcular_custo_medio(D("0"), D("40.00"), D("10"), D("450.00")) == D("45.00")


def test_com_saldo_faz_media_ponderada():
    # (100 × 40 + 2250) ÷ 150 = 41,666… → 41,67
    assert calcular_custo_medio(D("100"), D("40.00"), D("50"), D("2250.00")) == D("41.67")


def test_nota_sem_valor_nao_muda_o_custo():
    assert calcular_custo_medio(D("100"), D("40.00"), D("10"), D("0")) == D("40.00")


def test_saldo_negativo_e_tratado_como_zero():
    assert calcular_custo_medio(D("-5"), D("40.00"), D("10"), D("500.00")) == D("50.00")


def test_arredonda_meio_para_cima():
    # (3 × 10 + 31) ÷ 6 = 10,1666… → 10,17
    assert calcular_custo_medio(D("3"), D("10.00"), D("3"), D("31.00")) == D("10.17")


def test_api_entrada_atualiza_custo_e_saldo(client, db):
    insumo = criar_insumo(db, saldo="100.000", custo="40.00")
    resposta = client.post("/camisetas/insumos/entrada/", json={
        "id_insumo": insumo.id_insumo, "quantidade": "50", "valor_total": "2250.00",
    })
    assert resposta.status_code == 201
    db.refresh(insumo)
    assert insumo.preco_custo_medio == D("41.67")
    assert insumo.saldo_atual == D("150.000")


def test_api_entrada_com_valor_negativo_retorna_400(client, db):
    insumo = criar_insumo(db)
    resposta = client.post("/camisetas/insumos/entrada/", json={
        "id_insumo": insumo.id_insumo, "quantidade": "5", "valor_total": "-1",
    })
    assert resposta.status_code == 400
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_custo_medio.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.camisetas.estoque'`.

- [ ] **Step 3: Implementar a regra**

`backend/app/services/camisetas/estoque.py`:

```python
# app/services/camisetas/estoque.py
"""Regras de estoque do segmento Camisetas."""
from decimal import ROUND_HALF_UP, Decimal

DUAS_CASAS = Decimal("0.01")
ZERO = Decimal("0")


def calcular_custo_medio(saldo_anterior: Decimal, custo_anterior: Decimal,
                         quantidade: Decimal, valor_total: Decimal) -> Decimal:
    """Custo médio ponderado depois de uma entrada de nota fiscal.

    - Entrada sem valor (bonificação, ajuste) não altera o custo.
    - Saldo zero ou negativo: o custo passa a ser o da própria nota.
    """
    if valor_total <= ZERO:
        return custo_anterior
    if saldo_anterior > ZERO:
        novo_custo = (saldo_anterior * custo_anterior + valor_total) / (saldo_anterior + quantidade)
    else:
        novo_custo = valor_total / quantidade
    return novo_custo.quantize(DUAS_CASAS, rounding=ROUND_HALF_UP)
```

Em `backend/app/routers/camisetas/insumos.py`, acrescentar o import:

```python
from app.services.camisetas.estoque import calcular_custo_medio
```

Em `registrar_entrada_estoque`, logo após o bloco `if entrada_in.quantidade <= 0: raise ...`, acrescentar:

```python
    if (entrada_in.valor_total or Decimal("0")) < 0:
        raise HTTPException(status_code=400, detail="O valor da nota fiscal não pode ser negativo")
```

e trocar estas linhas:

```python
    # Injeção automática no saldo atual do insumo
    insumo.saldo_atual = (insumo.saldo_atual or Decimal("0")) + entrada_in.quantidade
    insumo.atualizado_em = get_utc_now()
```

por:

```python
    # Custo médio ponderado é calculado com o saldo ANTES da entrada
    saldo_anterior = insumo.saldo_atual or Decimal("0")
    insumo.preco_custo_medio = calcular_custo_medio(
        saldo_anterior,
        insumo.preco_custo_medio or Decimal("0"),
        entrada_in.quantidade,
        entrada_in.valor_total or Decimal("0"),
    )
    insumo.saldo_atual = saldo_anterior + entrada_in.quantidade
    insumo.atualizado_em = get_utc_now()
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/camisetas/estoque.py backend/app/routers/camisetas/insumos.py backend/tests/test_custo_medio.py
git commit -m "fix: recalcula o custo médio ponderado a cada nota fiscal" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Data de entrega realizada e regras de status do pedido

**Files:**
- Create: `backend/alembic/versions/20261110_004_data_entrega_realizada.py`
- Modify: `backend/app/models/camisetas.py` (classe `CamisetaPedido`)
- Modify: `backend/app/schemas/camisetas.py` (`CamisetaPedidoCreate`, `CamisetaPedidoResponse`)
- Modify: `backend/app/services/camisetas/estoque.py` (acrescentar funções de estoque acabado)
- Create: `backend/app/services/camisetas/pedidos.py`
- Replace: `backend/app/routers/camisetas/pedidos.py` (arquivo inteiro)
- Modify: `backend/tests/fabricas.py` (`criar_pedido`)
- Modify: `backend/tests/test_migracoes.py`
- Test: `backend/tests/test_pedidos.py`

**Interfaces:**
- Consumes: `proximo_codigo` (Task 3), `FUSO_HORARIO` (Task 1).
- Produces:
  - coluna `CamisetaPedido.data_entrega_realizada: Date | None`;
  - `app.services.camisetas.pedidos`: `STATUS_INICIAL = "Aguardando Produção"`, `STATUS_ENTREGUE = "Entregue"`, `STATUS_VALIDOS: tuple[str, ...]`, `montar_resposta_pedido(pedido) -> CamisetaPedidoResponse`;
  - `app.services.camisetas.estoque`: `CAMPOS_GRADE`, `obter_ou_criar_estoque_acabado(db, id_modelo) -> CamisetaProdutoAcabado`, `baixar_estoque_acabado(estoque, pedido) -> None`, `devolver_estoque_acabado(estoque, pedido) -> None`;
  - `tests.fabricas.criar_pedido(..., data_entrega_realizada=None)`.

- [ ] **Step 1: Testes que falham**

Em `backend/tests/fabricas.py`, trocar a função `criar_pedido` inteira por:

```python
def criar_pedido(db, modelo, codigo="PED-T-1", valor="1000.00", status="Aguardando Produção",
                 grade=(10, 10, 10, 10), criado_em=None, observacoes=None, data_entrega_realizada=None):
    p, m, g, gg = grade
    return _salvar(db, CamisetaPedido(
        codigo_pedido=codigo,
        nome_cliente="Cliente Teste",
        id_modelo=modelo.id_modelo,
        grade_p=p, grade_m=m, grade_g=g, grade_gg=gg,
        quantidade_total=p + m + g + gg,
        prazo_entrega=date.today() + timedelta(days=10),
        valor_total=Decimal(valor),
        status_pedido=status,
        observacoes=observacoes,
        criado_em=criado_em or datetime.now(timezone.utc),
        data_entrega_realizada=data_entrega_realizada,
    ))
```

`backend/tests/test_pedidos.py`:

```python
from datetime import date, datetime, timedelta

from app.core.config import FUSO_HORARIO
from tests.fabricas import criar_estoque_acabado, criar_modelo, criar_pedido


def hoje():
    return datetime.now(FUSO_HORARIO).date()


def test_mudar_para_entregue_pelo_status_e_bloqueado(client, db):
    modelo = criar_modelo(db)
    pedido = criar_pedido(db, modelo)
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Entregue"})
    assert resposta.status_code == 400
    assert "Registrar entrega" in resposta.json()["detail"]


def test_status_invalido_retorna_400(client, db):
    modelo = criar_modelo(db)
    pedido = criar_pedido(db, modelo)
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Qualquer"})
    assert resposta.status_code == 400


def test_entregar_grava_data_e_baixa_estoque(client, db):
    modelo = criar_modelo(db)
    estoque = criar_estoque_acabado(db, modelo, grade=(20, 20, 20, 20))
    pedido = criar_pedido(db, modelo, grade=(10, 10, 10, 10))
    ontem = hoje() - timedelta(days=1)
    resposta = client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json={"data_entrega": ontem.isoformat()})
    assert resposta.status_code == 200
    assert resposta.json()["data_entrega_realizada"] == ontem.isoformat()
    db.refresh(estoque)
    assert estoque.quantidade_total == 40
    assert estoque.grade_p == 10


def test_entregar_sem_data_usa_hoje(client, db):
    modelo = criar_modelo(db)
    criar_estoque_acabado(db, modelo, grade=(10, 10, 10, 10))
    pedido = criar_pedido(db, modelo)
    resposta = client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json={})
    assert resposta.json()["data_entrega_realizada"] == hoje().isoformat()


def test_entregar_com_data_futura_retorna_400(client, db):
    modelo = criar_modelo(db)
    criar_estoque_acabado(db, modelo, grade=(10, 10, 10, 10))
    pedido = criar_pedido(db, modelo)
    amanha = hoje() + timedelta(days=1)
    resposta = client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json={"data_entrega": amanha.isoformat()})
    assert resposta.status_code == 400


def test_entregar_sem_estoque_suficiente_retorna_400(client, db):
    modelo = criar_modelo(db)
    criar_estoque_acabado(db, modelo, grade=(1, 1, 1, 1))
    pedido = criar_pedido(db, modelo, grade=(10, 10, 10, 10))
    resposta = client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json={})
    assert resposta.status_code == 400


def test_reverter_entrega_limpa_data_e_devolve_estoque(client, db):
    modelo = criar_modelo(db)
    estoque = criar_estoque_acabado(db, modelo, grade=(0, 0, 0, 0))
    pedido = criar_pedido(db, modelo, status="Entregue", grade=(5, 5, 5, 5), data_entrega_realizada=date(2026, 10, 5))
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Aguardando Produção"})
    assert resposta.status_code == 200
    assert resposta.json()["data_entrega_realizada"] is None
    db.refresh(estoque)
    assert estoque.quantidade_total == 20
    assert estoque.grade_gg == 5


def test_grade_negativa_e_recusada(client, db):
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json={
        "nome_cliente": "Loja", "id_modelo": modelo.id_modelo,
        "grade_p": -5, "grade_m": 10, "grade_g": 0, "grade_gg": 0,
        "prazo_entrega": (hoje() + timedelta(days=3)).isoformat(), "valor_total": "100",
    })
    assert resposta.status_code == 422
```

Em `backend/tests/test_migracoes.py`, acrescentar ao final:

```python
def test_migracao_preenche_data_de_entrega(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261110_003_sequencias", url=url)
    engine = sa.create_engine(url)
    with engine.begin() as conexao:
        conexao.execute(sa.text(
            "INSERT INTO camisetas_modelos (id_modelo, nome_modelo, consumo_tecido_kg) VALUES (1, 'M', 0.18)"
        ))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_pedidos (id_pedido, codigo_pedido, nome_cliente, id_modelo, quantidade_total, "
            "prazo_entrega, valor_total, status_pedido, observacoes, atualizado_em) VALUES "
            "(1, 'PED-1', 'C', 1, 10, '2026-10-01', 100, 'Entregue', "
            "'obs\n[ENTREGA REALIZADA em 05/10/2026 | Recebido por: Ana]', '2026-10-07 10:00:00'), "
            "(2, 'PED-2', 'C', 1, 10, '2026-10-01', 100, 'Entregue', NULL, '2026-10-09 10:00:00'), "
            "(3, 'PED-3', 'C', 1, 10, '2026-10-01', 100, 'Aguardando Produção', NULL, '2026-10-09 10:00:00')"
        ))
    rodar_alembic("upgrade", "head", url=url)
    with engine.connect() as conexao:
        datas = dict(conexao.execute(sa.text(
            "SELECT id_pedido, data_entrega_realizada FROM camisetas_pedidos"
        )).all())
    assert str(datas[1]) == "2026-10-05"
    assert str(datas[2]) == "2026-10-09"
    assert datas[3] is None
    rodar_alembic("downgrade", "20261110_003_sequencias", url=url)
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_pedidos.py tests/test_migracoes.py -v`
Expected: FAIL — `TypeError: 'data_entrega_realizada' is an invalid keyword argument for CamisetaPedido` e revisão `head` sem a coluna.

- [ ] **Step 3: Modelo, schema e migração**

Em `backend/app/models/camisetas.py`, na classe `CamisetaPedido`, logo após `observacoes = Column(Text, nullable=True)`, acrescentar:

```python
    data_entrega_realizada = Column(Date, nullable=True)  # preenchida ao registrar a entrega
```

Em `backend/app/schemas/camisetas.py`:
- mudar o import do topo para `from pydantic import BaseModel, ConfigDict, Field`;
- em `CamisetaPedidoCreate`, trocar as 4 linhas de grade por:

```python
    grade_p: int = Field(0, ge=0)
    grade_m: int = Field(0, ge=0)
    grade_g: int = Field(0, ge=0)
    grade_gg: int = Field(0, ge=0)
```

- em `CamisetaPedidoResponse`, logo após `observacoes: Optional[str] = None`, acrescentar:

```python
    data_entrega_realizada: Optional[date] = None
```

`backend/alembic/versions/20261110_004_data_entrega_realizada.py`:

```python
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
```

- [ ] **Step 4: Serviços de estoque acabado e de pedidos**

Acrescentar ao final de `backend/app/services/camisetas/estoque.py` (e acrescentar `from sqlalchemy.orm import Session` e `from app.models.camisetas import CamisetaProdutoAcabado, get_utc_now` aos imports do topo):

```python
CAMPOS_GRADE = ("grade_p", "grade_m", "grade_g", "grade_gg")


def obter_ou_criar_estoque_acabado(db: Session, id_modelo: int) -> CamisetaProdutoAcabado:
    estoque = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=id_modelo).first()
    if estoque is None:
        estoque = CamisetaProdutoAcabado(
            id_modelo=id_modelo, grade_p=0, grade_m=0, grade_g=0, grade_gg=0,
            quantidade_total=0, atualizado_em=get_utc_now(),
        )
        db.add(estoque)
        db.flush()
    return estoque


def baixar_estoque_acabado(estoque: CamisetaProdutoAcabado, pedido) -> None:
    """Tira do estoque pronto as peças do pedido (nunca abaixo de zero)."""
    estoque.quantidade_total = max(0, (estoque.quantidade_total or 0) - pedido.quantidade_total)
    for campo in CAMPOS_GRADE:
        setattr(estoque, campo, max(0, (getattr(estoque, campo) or 0) - (getattr(pedido, campo) or 0)))
    estoque.atualizado_em = get_utc_now()


def devolver_estoque_acabado(estoque: CamisetaProdutoAcabado, pedido) -> None:
    """Devolve ao estoque pronto as peças de um pedido cuja entrega foi revertida."""
    estoque.quantidade_total = (estoque.quantidade_total or 0) + pedido.quantidade_total
    for campo in CAMPOS_GRADE:
        setattr(estoque, campo, (getattr(estoque, campo) or 0) + (getattr(pedido, campo) or 0))
    estoque.atualizado_em = get_utc_now()
```

`backend/app/services/camisetas/pedidos.py`:

```python
# app/services/camisetas/pedidos.py
"""Regras e montagem de resposta dos pedidos de camisetas."""
from app.schemas.camisetas import CamisetaPedidoResponse

STATUS_INICIAL = "Aguardando Produção"
STATUS_ENTREGUE = "Entregue"
STATUS_VALIDOS = ("Aguardando Produção", "Em Produção", "Pronto no Estoque", "Entregue")


def montar_resposta_pedido(pedido) -> CamisetaPedidoResponse:
    return CamisetaPedidoResponse(
        id_pedido=pedido.id_pedido,
        codigo_pedido=pedido.codigo_pedido,
        nome_cliente=pedido.nome_cliente,
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
    )
```

- [ ] **Step 5: Reescrever o router de pedidos**

Substituir todo o conteúdo de `backend/app/routers/camisetas/pedidos.py` por:

```python
# app/routers/camisetas/pedidos.py
"""Pedidos de clientes e estoque de produtos acabados (segmento Camisetas)."""
from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.database import get_db
from app.models.camisetas import CamisetaModelo, CamisetaPedido, CamisetaProdutoAcabado, get_utc_now
from app.schemas.camisetas import (
    CamisetaPedidoCreate,
    CamisetaPedidoEntregar,
    CamisetaPedidoResponse,
    CamisetaPedidoStatusUpdate,
    CamisetaProdutoAcabadoResponse,
)
from app.services.camisetas.estoque import (
    baixar_estoque_acabado,
    devolver_estoque_acabado,
    obter_ou_criar_estoque_acabado,
)
from app.services.camisetas.pedidos import (
    STATUS_ENTREGUE,
    STATUS_INICIAL,
    STATUS_VALIDOS,
    montar_resposta_pedido,
)
from app.services.sequencias import proximo_codigo

router = APIRouter()


def hoje_local() -> date:
    return datetime.now(FUSO_HORARIO).date()


def buscar_pedido(db: Session, id_pedido: int) -> CamisetaPedido:
    pedido = db.query(CamisetaPedido).filter_by(id_pedido=id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    return pedido


@router.get("/pedidos/", response_model=List[CamisetaPedidoResponse])
def listar_pedidos(db: Session = Depends(get_db)):
    pedidos = db.query(CamisetaPedido).order_by(CamisetaPedido.id_pedido.desc()).all()
    return [montar_resposta_pedido(p) for p in pedidos]


@router.post("/pedidos/", response_model=CamisetaPedidoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_pedido(pedido_in: CamisetaPedidoCreate, db: Session = Depends(get_db)):
    if pedido_in.prazo_entrega < hoje_local():
        raise HTTPException(
            status_code=400,
            detail="O prazo de entrega desejado não pode ser anterior à data de hoje. Selecione hoje ou uma data futura.",
        )
    modelo = db.query(CamisetaModelo).filter_by(id_modelo=pedido_in.id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo de camiseta informado não encontrado")

    qtd_total = pedido_in.grade_p + pedido_in.grade_m + pedido_in.grade_g + pedido_in.grade_gg
    if qtd_total <= 0:
        raise HTTPException(status_code=400, detail="A soma das grades (P, M, G, GG) deve ser maior que zero")

    novo_pedido = CamisetaPedido(
        codigo_pedido=proximo_codigo(db, "PED"),
        nome_cliente=pedido_in.nome_cliente,
        id_modelo=pedido_in.id_modelo,
        grade_p=pedido_in.grade_p,
        grade_m=pedido_in.grade_m,
        grade_g=pedido_in.grade_g,
        grade_gg=pedido_in.grade_gg,
        quantidade_total=qtd_total,
        prazo_entrega=pedido_in.prazo_entrega,
        valor_total=pedido_in.valor_total,
        status_pedido=STATUS_INICIAL,
        observacoes=pedido_in.observacoes,
    )
    db.add(novo_pedido)
    db.commit()
    db.refresh(novo_pedido)
    return montar_resposta_pedido(novo_pedido)


@router.put("/pedidos/{id_pedido}/status", response_model=CamisetaPedidoResponse)
def atualizar_status_pedido(id_pedido: int, status_in: CamisetaPedidoStatusUpdate, db: Session = Depends(get_db)):
    pedido = buscar_pedido(db, id_pedido)
    novo_status = status_in.status_pedido

    if novo_status not in STATUS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail=f"Status inválido: '{novo_status}'. Use um destes: {', '.join(STATUS_VALIDOS)}.",
        )
    if novo_status == STATUS_ENTREGUE and pedido.status_pedido != STATUS_ENTREGUE:
        raise HTTPException(
            status_code=400,
            detail="Para marcar o pedido como Entregue, use 'Registrar entrega': ela confere o estoque pronto antes da baixa.",
        )
    if pedido.status_pedido == STATUS_ENTREGUE and novo_status != STATUS_ENTREGUE:
        devolver_estoque_acabado(obter_ou_criar_estoque_acabado(db, pedido.id_modelo), pedido)
        pedido.data_entrega_realizada = None

    pedido.status_pedido = novo_status
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return montar_resposta_pedido(pedido)


@router.post("/pedidos/{id_pedido}/entregar", response_model=CamisetaPedidoResponse)
def registrar_entrega_pedido(id_pedido: int, dados_entrega: CamisetaPedidoEntregar, db: Session = Depends(get_db)):
    """Registra a entrega: confere e baixa o estoque pronto e grava a data real da entrega."""
    pedido = buscar_pedido(db, id_pedido)
    if pedido.status_pedido == STATUS_ENTREGUE:
        raise HTTPException(status_code=400, detail="Este pedido já foi registrado como Entregue anteriormente.")

    data_entrega = dados_entrega.data_entrega or hoje_local()
    if data_entrega > hoje_local():
        raise HTTPException(status_code=400, detail="A data da entrega não pode ser futura.")

    estoque = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=pedido.id_modelo).first()
    disponivel = (estoque.quantidade_total or 0) if estoque else 0
    if disponivel < pedido.quantidade_total:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Estoque pronto insuficiente para entrega! Disponível em estoque: {disponivel} peças. "
                f"Quantidade do pedido a entregar: {pedido.quantidade_total} peças."
            ),
        )

    baixar_estoque_acabado(estoque, pedido)
    recebedor = f" | Recebido por: {dados_entrega.recebedor}" if dados_entrega.recebedor else ""
    obs_extra = f" | Obs: {dados_entrega.observacoes}" if dados_entrega.observacoes else ""
    nota = f"\n[ENTREGA REALIZADA em {data_entrega.strftime('%d/%m/%Y')}{recebedor}{obs_extra}]"

    pedido.observacoes = (pedido.observacoes or "") + nota
    pedido.status_pedido = STATUS_ENTREGUE
    pedido.data_entrega_realizada = data_entrega
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)
    return montar_resposta_pedido(pedido)


@router.delete("/pedidos/{id_pedido}")
def excluir_pedido_camiseta(id_pedido: int, db: Session = Depends(get_db)):
    """Exclui um pedido. Impede exclusão de pedido já entregue."""
    pedido = buscar_pedido(db, id_pedido)
    if (pedido.status_pedido or "").lower() == STATUS_ENTREGUE.lower():
        raise HTTPException(
            status_code=400,
            detail="Não é permitido excluir um pedido que já foi formalizado como Entregue ao cliente.",
        )
    codigo = pedido.codigo_pedido
    db.delete(pedido)
    db.commit()
    return {"mensagem": f"Pedido {codigo} excluído com sucesso!"}


@router.get("/estoque-acabado/", response_model=List[CamisetaProdutoAcabadoResponse])
def listar_estoque_acabado(db: Session = Depends(get_db)):
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

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam (inclui os 8 de pedidos e os 2 de migração).

- [ ] **Step 7: Commit**

```bash
git add backend/alembic/versions/20261110_004_data_entrega_realizada.py backend/app/models/camisetas.py backend/app/schemas/camisetas.py backend/app/services/camisetas backend/app/routers/camisetas/pedidos.py backend/tests
git commit -m "feat: data real de entrega do pedido e regras de status" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Financeiro calculado a partir das movimentações (fim do "Sincronizar")

**Files:**
- Create: `backend/app/services/camisetas/financeiro.py`
- Replace: `backend/app/routers/camisetas/financeiro.py` (arquivo inteiro)
- Modify: `backend/app/schemas/camisetas.py` (`CamisetaRegistroFinanceiroCreate`, `CamisetaRegistroFinanceiroResponse`)
- Modify: `backend/tests/test_rotas_camisetas.py` (remover a rota de sincronizar)
- Test: `backend/tests/test_financeiro.py`

**Interfaces:**
- Consumes: `CamisetaPedido.data_entrega_realizada` (Task 5), `FUSO_HORARIO`.
- Produces (`app.services.camisetas.financeiro`): exceção `MesAnoInvalido(ValueError)`; `validar_mes_ano(mes_ano: str) -> tuple[int, int]`; dataclass imutável `ApuracaoMensal(mes_ano, mes_nome, faturamento, gasto_materiais, outros_custos, lucro, qtd_pedidos_entregues, qtd_entradas, id_registro, observacoes, criado_em)` com propriedade `tem_dados_reais`; `apurar_mes(db, mes_ano: str) -> ApuracaoMensal`; `apurar_ano(db, ano: int) -> list[ApuracaoMensal]` (sempre 12 itens, jan→dez).

- [ ] **Step 1: Testes que falham**

`backend/tests/test_financeiro.py`:

```python
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.core.config import FUSO_HORARIO
from app.services.camisetas.financeiro import MesAnoInvalido, apurar_ano, apurar_mes
from tests.fabricas import (
    criar_entrada,
    criar_insumo,
    criar_modelo,
    criar_pedido,
    criar_registro_financeiro,
)


def test_faturamento_soma_pedidos_entregues_no_mes(db):
    modelo = criar_modelo(db)
    criar_pedido(db, modelo, codigo="A", valor="1000.00", status="Entregue", data_entrega_realizada=date(2026, 10, 3))
    criar_pedido(db, modelo, codigo="B", valor="500.00", status="Entregue", data_entrega_realizada=date(2026, 10, 30))
    criar_pedido(db, modelo, codigo="C", valor="999.00")  # não entregue
    apuracao = apurar_mes(db, "2026-10")
    assert apuracao.faturamento == Decimal("1500.00")
    assert apuracao.qtd_pedidos_entregues == 2


def test_pedido_conta_no_mes_da_entrega_e_nao_no_da_criacao(db):
    modelo = criar_modelo(db)
    criar_pedido(
        db, modelo, valor="800.00", status="Entregue",
        criado_em=datetime(2026, 10, 10, tzinfo=timezone.utc),
        data_entrega_realizada=date(2026, 11, 4),
    )
    assert apurar_mes(db, "2026-10").faturamento == Decimal("0.00")
    assert apurar_mes(db, "2026-11").faturamento == Decimal("800.00")


def test_gasto_soma_notas_do_mes_e_nao_o_valor_do_estoque(db):
    insumo = criar_insumo(db, saldo="100.000", custo="40.00")  # R$ 4.000 em estoque: não é gasto
    criar_entrada(db, insumo, valor="500.00", data=datetime(2026, 10, 15, 10, 0, tzinfo=FUSO_HORARIO))
    apuracao = apurar_mes(db, "2026-10")
    assert apuracao.gasto_materiais == Decimal("500.00")
    assert apuracao.qtd_entradas == 1


def test_nota_as_23h_do_ultimo_dia_fica_no_mes_certo(db):
    insumo = criar_insumo(db)
    # 31/10 23h em Fortaleza = 01/11 02h em UTC
    criar_entrada(db, insumo, valor="200.00", data=datetime(2026, 10, 31, 23, 0, tzinfo=FUSO_HORARIO))
    assert apurar_mes(db, "2026-10").gasto_materiais == Decimal("200.00")
    assert apurar_mes(db, "2026-11").gasto_materiais == Decimal("0.00")


def test_lucro_desconta_outros_custos(db):
    modelo = criar_modelo(db)
    insumo = criar_insumo(db)
    criar_pedido(db, modelo, valor="1000.00", status="Entregue", data_entrega_realizada=date(2026, 10, 3))
    criar_entrada(db, insumo, valor="300.00", data=datetime(2026, 10, 5, 9, 0, tzinfo=FUSO_HORARIO))
    criar_registro_financeiro(db, "2026-10", outros="150.00")
    apuracao = apurar_mes(db, "2026-10")
    assert apuracao.lucro == Decimal("550.00")
    assert apuracao.tem_dados_reais is True


def test_mes_sem_movimento_retorna_zeros(db):
    apuracao = apurar_mes(db, "2026-03")
    assert (apuracao.faturamento, apuracao.gasto_materiais, apuracao.lucro) == (Decimal("0.00"),) * 3
    assert apuracao.tem_dados_reais is False
    assert apuracao.mes_nome == "Março"


@pytest.mark.parametrize("valor", ["2026-13", "2026-1", "10/2026", "", "abc"])
def test_mes_ano_invalido_levanta_erro(db, valor):
    with pytest.raises(MesAnoInvalido):
        apurar_mes(db, valor)


def test_apurar_ano_devolve_12_meses_em_ordem(db):
    meses = apurar_ano(db, 2026)
    assert [m.mes_ano for m in meses] == [f"2026-{n:02d}" for n in range(1, 13)]


def test_api_mes_ano_invalido_retorna_422(client):
    assert client.get("/camisetas/financeiro/apuracao-mensal/?mes_ano=2026-13").status_code == 422


def test_api_lista_12_meses_calculados(client, db):
    modelo = criar_modelo(db)
    criar_pedido(db, modelo, valor="700.00", status="Entregue", data_entrega_realizada=date(2026, 2, 10))
    resposta = client.get("/camisetas/financeiro/?ano=2026")
    assert resposta.status_code == 200
    meses = resposta.json()
    assert len(meses) == 12
    fevereiro = meses[1]
    assert fevereiro["mes_ano"] == "2026-02"
    assert Decimal(fevereiro["faturamento_receita"]) == Decimal("700.00")
    assert fevereiro["qtd_pedidos_entregues"] == 1


def test_api_lanca_outros_custos_e_ignora_faturamento_enviado(client, db):
    resposta = client.post("/camisetas/financeiro/", json={
        "mes_ano": "2026-10",
        "outros_custos_operacionais": "250.00",
        "faturamento_receita": "99999.00",
        "observacoes": "Energia e facção",
    })
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert Decimal(corpo["faturamento_receita"]) == Decimal("0.00")
    assert Decimal(corpo["outros_custos_operacionais"]) == Decimal("250.00")
    assert Decimal(corpo["lucro_liquido"]) == Decimal("-250.00")


def test_api_outros_custos_negativo_retorna_400(client):
    resposta = client.post("/camisetas/financeiro/", json={"mes_ano": "2026-10", "outros_custos_operacionais": "-1"})
    assert resposta.status_code == 400


def test_api_sincronizar_nao_existe_mais(client):
    assert client.post("/camisetas/financeiro/sincronizar-automatico/").status_code == 404
```

Em `backend/tests/test_rotas_camisetas.py`, remover a linha:

```python
    ("POST", "/camisetas/financeiro/sincronizar-automatico/"),
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_financeiro.py tests/test_rotas_camisetas.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.camisetas.financeiro'` e diferença de rotas (sincronizar ainda existe).

- [ ] **Step 3: Serviço de apuração**

`backend/app/services/camisetas/financeiro.py`:

```python
# app/services/camisetas/financeiro.py
"""Apuração financeira mensal calculada a partir das movimentações reais.

Faturamento = pedidos com data de entrega no mês.
Gasto com materiais = notas fiscais (entradas de insumo) lançadas no mês.
Outros custos = lançamento manual do mês. Lucro = faturamento − gasto − outros.
"""
import re
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.models.camisetas import CamisetaEntradaInsumo, CamisetaPedido, CamisetaRegistroFinanceiro

PADRAO_MES_ANO = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
DUAS_CASAS = Decimal("0.01")
NOMES_MESES = (
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
)


class MesAnoInvalido(ValueError):
    """Mês fora do formato AAAA-MM."""


@dataclass(frozen=True)
class ApuracaoMensal:
    mes_ano: str
    mes_nome: str
    faturamento: Decimal
    gasto_materiais: Decimal
    outros_custos: Decimal
    lucro: Decimal
    qtd_pedidos_entregues: int
    qtd_entradas: int
    id_registro: Optional[int]
    observacoes: Optional[str]
    criado_em: Optional[datetime]

    @property
    def tem_dados_reais(self) -> bool:
        return self.qtd_pedidos_entregues > 0 or self.qtd_entradas > 0


def validar_mes_ano(mes_ano: str) -> tuple[int, int]:
    if not mes_ano or not PADRAO_MES_ANO.match(mes_ano):
        raise MesAnoInvalido(f"Mês inválido: '{mes_ano}'. Use o formato AAAA-MM, ex.: 2026-10.")
    ano, mes = mes_ano.split("-")
    return int(ano), int(mes)


def _primeiro_dia_do_mes_seguinte(ano: int, mes: int) -> tuple[int, int]:
    return (ano + 1, 1) if mes == 12 else (ano, mes + 1)


def _limites_em_datas(ano: int, mes: int) -> tuple[date, date]:
    ano_fim, mes_fim = _primeiro_dia_do_mes_seguinte(ano, mes)
    return date(ano, mes, 1), date(ano_fim, mes_fim, 1)


def _limites_em_utc(ano: int, mes: int) -> tuple[datetime, datetime]:
    """Início e fim do mês no fuso do negócio, convertidos para UTC (como as datas são gravadas)."""
    ano_fim, mes_fim = _primeiro_dia_do_mes_seguinte(ano, mes)
    inicio = datetime(ano, mes, 1, tzinfo=FUSO_HORARIO).astimezone(timezone.utc)
    fim = datetime(ano_fim, mes_fim, 1, tzinfo=FUSO_HORARIO).astimezone(timezone.utc)
    return inicio, fim


def _decimal(valor) -> Decimal:
    return Decimal(str(valor or 0)).quantize(DUAS_CASAS)


def apurar_mes(db: Session, mes_ano: str) -> ApuracaoMensal:
    ano, mes = validar_mes_ano(mes_ano)

    data_inicio, data_fim = _limites_em_datas(ano, mes)
    faturamento, qtd_pedidos = db.query(
        func.coalesce(func.sum(CamisetaPedido.valor_total), 0),
        func.count(CamisetaPedido.id_pedido),
    ).filter(
        CamisetaPedido.data_entrega_realizada >= data_inicio,
        CamisetaPedido.data_entrega_realizada < data_fim,
    ).one()

    utc_inicio, utc_fim = _limites_em_utc(ano, mes)
    gasto, qtd_entradas = db.query(
        func.coalesce(func.sum(CamisetaEntradaInsumo.valor_total), 0),
        func.count(CamisetaEntradaInsumo.id_entrada),
    ).filter(
        CamisetaEntradaInsumo.data_entrada >= utc_inicio,
        CamisetaEntradaInsumo.data_entrada < utc_fim,
    ).one()

    registro = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=mes_ano).first()
    outros = _decimal(registro.outros_custos_operacionais) if registro else _decimal(0)
    faturamento_dec = _decimal(faturamento)
    gasto_dec = _decimal(gasto)

    return ApuracaoMensal(
        mes_ano=mes_ano,
        mes_nome=NOMES_MESES[mes - 1],
        faturamento=faturamento_dec,
        gasto_materiais=gasto_dec,
        outros_custos=outros,
        lucro=faturamento_dec - gasto_dec - outros,
        qtd_pedidos_entregues=int(qtd_pedidos or 0),
        qtd_entradas=int(qtd_entradas or 0),
        id_registro=registro.id_registro if registro else None,
        observacoes=registro.observacoes if registro else None,
        criado_em=registro.criado_em if registro else None,
    )


def apurar_ano(db: Session, ano: int) -> list[ApuracaoMensal]:
    return [apurar_mes(db, f"{ano}-{mes:02d}") for mes in range(1, 13)]
```

- [ ] **Step 4: Schemas do financeiro**

Em `backend/app/schemas/camisetas.py`, trocar a classe `CamisetaRegistroFinanceiroCreate` inteira por:

```python
class CamisetaRegistroFinanceiroCreate(BaseModel):
    """Lançamento manual do mês: só outros custos e observações são gravados.

    Faturamento, gasto e lucro são calculados pelo sistema; se vierem no corpo,
    são ignorados (mantidos aqui só por compatibilidade com o frontend antigo).
    """
    mes_ano: str
    outros_custos_operacionais: Decimal = Decimal("0.00")
    observacoes: Optional[str] = None
    valor_gasto_materiais: Optional[Decimal] = None
    faturamento_receita: Optional[Decimal] = None
    lucro_liquido: Optional[Decimal] = None
```

e a classe `CamisetaRegistroFinanceiroResponse` inteira por:

```python
class CamisetaRegistroFinanceiroResponse(BaseModel):
    id_registro: Optional[int] = None  # nulo quando o mês não tem lançamento manual
    mes_ano: str
    valor_gasto_materiais: Decimal
    faturamento_receita: Decimal
    outros_custos_operacionais: Decimal
    lucro_liquido: Decimal
    observacoes: Optional[str] = None
    criado_em: Optional[datetime] = None
    qtd_pedidos_entregues: int = 0
    qtd_entradas: int = 0
    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 5: Reescrever o router do financeiro**

Substituir todo o conteúdo de `backend/app/routers/camisetas/financeiro.py` por:

```python
# app/routers/camisetas/financeiro.py
"""Financeiro do segmento Camisetas: valores calculados a partir das movimentações reais."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.database import get_db
from app.models.camisetas import CamisetaRegistroFinanceiro
from app.schemas.camisetas import (
    CamisetaApuracaoMensalResponse,
    CamisetaRegistroFinanceiroCreate,
    CamisetaRegistroFinanceiroResponse,
)
from app.services.camisetas.financeiro import (
    ApuracaoMensal,
    MesAnoInvalido,
    apurar_ano,
    apurar_mes,
    validar_mes_ano,
)

router = APIRouter()


def para_resposta_registro(apuracao: ApuracaoMensal) -> CamisetaRegistroFinanceiroResponse:
    return CamisetaRegistroFinanceiroResponse(
        id_registro=apuracao.id_registro,
        mes_ano=apuracao.mes_ano,
        valor_gasto_materiais=apuracao.gasto_materiais,
        faturamento_receita=apuracao.faturamento,
        outros_custos_operacionais=apuracao.outros_custos,
        lucro_liquido=apuracao.lucro,
        observacoes=apuracao.observacoes,
        criado_em=apuracao.criado_em,
        qtd_pedidos_entregues=apuracao.qtd_pedidos_entregues,
        qtd_entradas=apuracao.qtd_entradas,
    )


def _validar_ou_422(mes_ano: str) -> None:
    try:
        validar_mes_ano(mes_ano)
    except MesAnoInvalido as erro:
        raise HTTPException(status_code=422, detail=str(erro)) from erro


@router.get("/financeiro/", response_model=List[CamisetaRegistroFinanceiroResponse])
def listar_financeiro(ano: Optional[int] = Query(None, ge=2000, le=2100), db: Session = Depends(get_db)):
    """Os 12 meses do ano (padrão: ano corrente), calculados na hora."""
    ano_referencia = ano or datetime.now(FUSO_HORARIO).year
    return [para_resposta_registro(a) for a in apurar_ano(db, ano_referencia)]


@router.get("/financeiro/apuracao-mensal/", response_model=CamisetaApuracaoMensalResponse)
def apurar_financeiro_mensal(
    mes_ano: str = Query(..., description="Mês no formato AAAA-MM, ex.: 2026-10"),
    db: Session = Depends(get_db),
):
    _validar_ou_422(mes_ano)
    apuracao = apurar_mes(db, mes_ano)
    return CamisetaApuracaoMensalResponse(
        mes_ano=apuracao.mes_ano,
        tem_dados_reais=apuracao.tem_dados_reais,
        gasto_materiais_real=apuracao.gasto_materiais,
        faturamento_vendas_real=apuracao.faturamento,
        outros_custos=apuracao.outros_custos,
        lucro_apurado=apuracao.lucro,
        qtd_entradas_estoque=apuracao.qtd_entradas,
        qtd_pedidos_vendas=apuracao.qtd_pedidos_entregues,
    )


@router.post("/financeiro/", response_model=CamisetaRegistroFinanceiroResponse, status_code=status.HTTP_201_CREATED)
def lancar_outros_custos(reg_in: CamisetaRegistroFinanceiroCreate, db: Session = Depends(get_db)):
    """Grava só os outros custos e as observações do mês; o resto é calculado."""
    _validar_ou_422(reg_in.mes_ano)
    if reg_in.outros_custos_operacionais < 0:
        raise HTTPException(status_code=400, detail="Outros custos não pode ser negativo.")

    registro = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=reg_in.mes_ano).first()
    if registro is None:
        registro = CamisetaRegistroFinanceiro(mes_ano=reg_in.mes_ano)
        db.add(registro)
    registro.outros_custos_operacionais = reg_in.outros_custos_operacionais
    registro.observacoes = reg_in.observacoes
    db.commit()
    return para_resposta_registro(apurar_mes(db, reg_in.mes_ano))
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/camisetas/financeiro.py backend/app/routers/camisetas/financeiro.py backend/app/schemas/camisetas.py backend/tests/test_financeiro.py backend/tests/test_rotas_camisetas.py
git commit -m "fix: financeiro calculado a partir de entregas e notas fiscais reais" -m "Remove a sincronização que sobrescrevia meses com dados de demonstração e contava o estoque como gasto." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Retorno de facção sem duplicidade e status correto da OP

**Files:**
- Create: `backend/app/services/camisetas/costura.py`
- Modify: `backend/app/routers/camisetas/costura.py` (funções `listar_remessas_costura` e `registrar_retorno_faccao`)
- Test: `backend/tests/test_costura_retorno.py`

**Interfaces:**
- Consumes: `obter_ou_criar_estoque_acabado` (Task 5).
- Produces (`app.services.camisetas.costura`): `STATUS_REMESSA_EM_COSTURA = "Em Costura Externa"`, `STATUS_REMESSA_RETORNADA = "Retornado e Conferido"`, `STATUS_OP_EM_COSTURA = "Em Costura"`, `STATUS_OP_FINALIZADA = "Costura Finalizada"`, `status_op_apos_retorno(pecas_cortadas: int, remessas) -> str`, `montar_resposta_remessa(remessa) -> CamisetaCosturaFaccaoResponse`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_costura_retorno.py`:

```python
from types import SimpleNamespace

from app.models.camisetas import CamisetaProdutoAcabado
from app.services.camisetas.costura import status_op_apos_retorno
from tests.fabricas import criar_modelo, criar_op_cortada, criar_remessa


def remessa(quantidade, status):
    return SimpleNamespace(quantidade_enviada=quantidade, status=status)


def test_op_finaliza_quando_tudo_foi_enviado_e_retornado():
    remessas = [remessa(60, "Retornado e Conferido"), remessa(40, "Retornado e Conferido")]
    assert status_op_apos_retorno(100, remessas) == "Costura Finalizada"


def test_op_continua_em_costura_com_remessa_pendente():
    remessas = [remessa(60, "Retornado e Conferido"), remessa(40, "Em Costura Externa")]
    assert status_op_apos_retorno(100, remessas) == "Em Costura"


def test_op_continua_em_costura_com_pecas_ainda_nao_enviadas():
    assert status_op_apos_retorno(100, [remessa(60, "Retornado e Conferido")]) == "Em Costura"


def test_api_retorno_duplicado_retorna_409_e_nao_duplica_estoque(client, db):
    modelo = criar_modelo(db)
    op = criar_op_cortada(db, modelo, pecas=100)
    rem = criar_remessa(db, op, quantidade=50)
    primeira = client.put(f"/camisetas/costura/{rem.id_costura}/retornar", json={"quantidade_retornada": 48})
    segunda = client.put(f"/camisetas/costura/{rem.id_costura}/retornar", json={"quantidade_retornada": 48})
    assert primeira.status_code == 200
    assert primeira.json()["perdas_pecas"] == 2
    assert segunda.status_code == 409
    estoque = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=modelo.id_modelo).one()
    assert estoque.quantidade_total == 48


def test_api_retorno_maior_que_o_enviado_retorna_400(client, db):
    modelo = criar_modelo(db)
    op = criar_op_cortada(db, modelo, pecas=100)
    rem = criar_remessa(db, op, quantidade=50)
    resposta = client.put(f"/camisetas/costura/{rem.id_costura}/retornar", json={"quantidade_retornada": 60})
    assert resposta.status_code == 400


def test_api_op_so_finaliza_no_ultimo_retorno(client, db):
    modelo = criar_modelo(db)
    op = criar_op_cortada(db, modelo, pecas=100)
    rem_a = criar_remessa(db, op, quantidade=60)
    rem_b = criar_remessa(db, op, quantidade=40)
    client.put(f"/camisetas/costura/{rem_a.id_costura}/retornar", json={"quantidade_retornada": 60})
    db.refresh(op)
    assert op.status_op == "Em Costura"
    client.put(f"/camisetas/costura/{rem_b.id_costura}/retornar", json={"quantidade_retornada": 40})
    db.refresh(op)
    assert op.status_op == "Costura Finalizada"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_costura_retorno.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.camisetas.costura'`.

- [ ] **Step 3: Serviço de costura**

`backend/app/services/camisetas/costura.py`:

```python
# app/services/camisetas/costura.py
"""Regras das remessas para facções (costura terceirizada)."""
from app.schemas.camisetas import CamisetaCosturaFaccaoResponse

STATUS_REMESSA_EM_COSTURA = "Em Costura Externa"
STATUS_REMESSA_RETORNADA = "Retornado e Conferido"
STATUS_OP_EM_COSTURA = "Em Costura"
STATUS_OP_FINALIZADA = "Costura Finalizada"


def status_op_apos_retorno(pecas_cortadas: int, remessas) -> str:
    """A OP só finaliza quando todas as peças cortadas foram enviadas e nenhuma remessa está pendente."""
    total_enviado = sum(r.quantidade_enviada or 0 for r in remessas)
    ha_pendentes = any(r.status == STATUS_REMESSA_EM_COSTURA for r in remessas)
    if total_enviado >= pecas_cortadas and not ha_pendentes:
        return STATUS_OP_FINALIZADA
    return STATUS_OP_EM_COSTURA


def montar_resposta_remessa(remessa) -> CamisetaCosturaFaccaoResponse:
    op = remessa.op
    return CamisetaCosturaFaccaoResponse(
        id_costura=remessa.id_costura,
        id_op=remessa.id_op,
        codigo_op=op.codigo_op if op else "OP",
        nome_modelo=op.modelo.nome_modelo if op and op.modelo else "Modelo",
        nome_faccao=remessa.nome_faccao,
        quantidade_enviada=remessa.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=remessa.margem_seguranca_aviamentos_percentual,
        quantidade_retornada=remessa.quantidade_retornada,
        perdas_pecas=remessa.perdas_pecas,
        saldo_aprovado=remessa.saldo_aprovado,
        status=remessa.status,
        data_envio=remessa.data_envio,
        data_retorno=remessa.data_retorno,
        observacoes=remessa.observacoes,
    )
```

- [ ] **Step 4: Router de costura (listar e retornar)**

Em `backend/app/routers/camisetas/costura.py`, acrescentar aos imports:

```python
from app.services.camisetas.costura import (
    STATUS_REMESSA_EM_COSTURA,
    STATUS_REMESSA_RETORNADA,
    montar_resposta_remessa,
    status_op_apos_retorno,
)
from app.services.camisetas.estoque import obter_ou_criar_estoque_acabado
```

Substituir a função `listar_remessas_costura` inteira por:

```python
@router.get("/costura/", response_model=List[CamisetaCosturaFaccaoResponse])
def listar_remessas_costura(db: Session = Depends(get_db)):
    remessas = db.query(CamisetaCosturaFaccao).order_by(CamisetaCosturaFaccao.id_costura.desc()).all()
    return [montar_resposta_remessa(r) for r in remessas]
```

Substituir a função `registrar_retorno_faccao` inteira (decorador incluído) por:

```python
@router.put("/costura/{id_costura}/retornar", response_model=CamisetaCosturaFaccaoResponse)
def registrar_retorno_faccao(id_costura: int, retorno_in: CamisetaCosturaFaccaoRetornar, db: Session = Depends(get_db)):
    """Registra o retorno da facção, apura perdas e lança as peças aprovadas no estoque pronto."""
    remessa = db.query(CamisetaCosturaFaccao).filter_by(id_costura=id_costura).first()
    if not remessa:
        raise HTTPException(status_code=404, detail="Remessa de costura não encontrada")
    if remessa.status != STATUS_REMESSA_EM_COSTURA:
        raise HTTPException(status_code=409, detail="Esta remessa já teve o retorno registrado.")
    if retorno_in.quantidade_retornada < 0:
        raise HTTPException(status_code=400, detail="Quantidade retornada não pode ser negativa")
    if retorno_in.quantidade_retornada > remessa.quantidade_enviada:
        raise HTTPException(
            status_code=400,
            detail=f"O retorno ({retorno_in.quantidade_retornada}) não pode ser maior que o enviado ({remessa.quantidade_enviada}).",
        )

    remessa.quantidade_retornada = retorno_in.quantidade_retornada
    remessa.data_retorno = get_utc_now()
    remessa.status = STATUS_REMESSA_RETORNADA
    remessa.perdas_pecas = remessa.quantidade_enviada - retorno_in.quantidade_retornada
    remessa.saldo_aprovado = retorno_in.quantidade_retornada
    if retorno_in.observacoes:
        remessa.observacoes = (remessa.observacoes or "") + " | Retorno: " + retorno_in.observacoes

    if remessa.op and remessa.op.id_modelo:
        estoque = obter_ou_criar_estoque_acabado(db, remessa.op.id_modelo)
        estoque.quantidade_total = (estoque.quantidade_total or 0) + remessa.saldo_aprovado
        estoque.atualizado_em = get_utc_now()

    db.flush()
    if remessa.op:
        remessa.op.status_op = status_op_apos_retorno(
            remessa.op.pecas_reais_cortadas or 0, remessa.op.movimentacoes_costura
        )

    db.commit()
    db.refresh(remessa)
    return montar_resposta_remessa(remessa)
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/camisetas/costura.py backend/app/routers/camisetas/costura.py backend/tests/test_costura_retorno.py
git commit -m "fix: impede retorno de facção duplicado e só finaliza a OP no último retorno" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Baixa de aviamentos com aviso e confirmação (sem travar a produção)

**Files:**
- Modify: `backend/app/services/camisetas/estoque.py` (acrescentar regras de aviamentos)
- Modify: `backend/app/services/camisetas/costura.py` (`montar_resposta_remessa` aceita avisos)
- Modify: `backend/app/schemas/camisetas.py` (`CamisetaCosturaFaccaoEnviar`, `CamisetaCosturaFaccaoResponse`)
- Modify: `backend/app/routers/camisetas/costura.py` (função `enviar_para_faccao`)
- Test: `backend/tests/test_aviamentos.py`

**Interfaces:**
- Consumes: `STATUS_REMESSA_EM_COSTURA`, `STATUS_OP_EM_COSTURA`, `montar_resposta_remessa` (Task 7).
- Produces (`app.services.camisetas.estoque`): `TIPO_TECIDO_PRINCIPAL = "Tecido Principal"`, `AVISO_SEM_AVIAMENTOS: str`, dataclasses `NecessidadeAviamento(insumo, quantidade)` e `FaltaAviamento(codigo, descricao, necessario, disponivel, unidade)` com `para_dict() -> dict` (números como float), `calcular_necessidades(itens_ficha, quantidade_pecas: int, margem_percentual: Decimal) -> list[NecessidadeAviamento]`, `listar_faltas(necessidades) -> list[FaltaAviamento]`, `aplicar_baixa(necessidades) -> None`. Schema: `CamisetaCosturaFaccaoEnviar.confirmar_saldo_insuficiente: bool = False`; `CamisetaCosturaFaccaoResponse.avisos: List[str]`. Resposta 409: `detail = {"mensagem": str, "faltas": [FaltaAviamento.para_dict()]}`.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_aviamentos.py`:

```python
from decimal import Decimal
from types import SimpleNamespace

from app.models.camisetas import CamisetaCosturaFaccao
from app.services.camisetas.estoque import AVISO_SEM_AVIAMENTOS, calcular_necessidades, listar_faltas
from tests.fabricas import criar_insumo, criar_item_ficha, criar_modelo, criar_op_cortada


def insumo_falso(id_insumo, saldo):
    return SimpleNamespace(
        id_insumo=id_insumo, codigo=f"AV-{id_insumo}", tipo_malha_ou_aviamento=f"Aviamento {id_insumo}",
        unidade_medida="unidades", saldo_atual=Decimal(saldo),
    )


def item(insumo, consumo):
    return SimpleNamespace(insumo=insumo, consumo_unitario=Decimal(consumo))


def test_necessidade_inclui_a_margem():
    [necessidade] = calcular_necessidades([item(insumo_falso(1, "10"), "0.02")], 100, Decimal("3"))
    assert necessidade.quantidade == Decimal("2.060")


def test_soma_itens_do_mesmo_insumo():
    etiqueta = insumo_falso(2, "500")
    [necessidade] = calcular_necessidades([item(etiqueta, "1"), item(etiqueta, "1")], 10, Decimal("0"))
    assert necessidade.quantidade == Decimal("20.000")


def test_ignora_itens_sem_insumo_no_estoque():
    assert calcular_necessidades([item(None, "1")], 10, Decimal("3")) == []


def test_lista_faltas_com_necessario_e_disponivel():
    [falta] = listar_faltas(calcular_necessidades([item(insumo_falso(1, "1"), "0.03")], 100, Decimal("3")))
    assert falta.necessario == Decimal("3.090")
    assert falta.disponivel == Decimal("1")


def _cenario(db, saldo_etiqueta="500"):
    modelo = criar_modelo(db)
    tecido = criar_insumo(db, codigo="MALHA-01", saldo="50.000")
    linha = criar_insumo(db, codigo="AV-LINHA-01", categoria="AVIAMENTO", nome="Linha 120", unidade="unidades", saldo="10.000")
    etiqueta = criar_insumo(db, codigo="AV-ETIQ-01", categoria="AVIAMENTO", nome="Etiqueta", unidade="unidades", saldo=saldo_etiqueta)
    criar_item_ficha(db, modelo, tecido, tipo="Tecido Principal", consumo="0.1800", unidade="kg")
    criar_item_ficha(db, modelo, linha, tipo="Linha de Costura", consumo="0.0200")
    criar_item_ficha(db, modelo, etiqueta, tipo="Etiqueta", consumo="1.0000")
    op = criar_op_cortada(db, modelo, pecas=100, tecido=tecido)
    return op, tecido, linha, etiqueta


def _enviar(client, op, **extra):
    return client.post("/camisetas/costura/enviar", json={
        "id_op": op.id_op, "nome_faccao": "Facção Maria", "quantidade_enviada": 100,
        "margem_seguranca_aviamentos_percentual": "3", **extra,
    })


def test_envio_com_saldo_baixa_aviamentos_com_margem_e_nao_mexe_no_tecido(client, db):
    op, tecido, linha, etiqueta = _cenario(db)
    resposta = _enviar(client, op)
    assert resposta.status_code == 201
    assert resposta.json()["avisos"] == []
    for insumo in (tecido, linha, etiqueta):
        db.refresh(insumo)
    assert linha.saldo_atual == Decimal("7.940")
    assert etiqueta.saldo_atual == Decimal("397.000")
    assert tecido.saldo_atual == Decimal("50.000")


def test_envio_com_falta_sem_confirmacao_retorna_409_e_nao_baixa(client, db):
    op, _, linha, etiqueta = _cenario(db, saldo_etiqueta="50")
    resposta = _enviar(client, op)
    assert resposta.status_code == 409
    faltas = resposta.json()["detail"]["faltas"]
    assert [f["codigo"] for f in faltas] == ["AV-ETIQ-01"]
    assert faltas[0]["necessario"] == 103.0
    db.refresh(etiqueta)
    assert etiqueta.saldo_atual == Decimal("50.000")
    assert db.query(CamisetaCosturaFaccao).count() == 0


def test_envio_com_falta_confirmado_baixa_e_saldo_fica_negativo(client, db):
    op, _, _, etiqueta = _cenario(db, saldo_etiqueta="50")
    resposta = _enviar(client, op, confirmar_saldo_insuficiente=True)
    assert resposta.status_code == 201
    db.refresh(etiqueta)
    assert etiqueta.saldo_atual == Decimal("-53.000")


def test_modelo_sem_aviamentos_gera_aviso_e_nao_baixa_nada(client, db):
    modelo = criar_modelo(db)
    avulso = criar_insumo(db, codigo="AV-01", categoria="AVIAMENTO", nome="Tag", unidade="unidades", saldo="100.000")
    op = criar_op_cortada(db, modelo, pecas=100)
    resposta = _enviar(client, op)
    assert resposta.status_code == 201
    assert resposta.json()["avisos"] == [AVISO_SEM_AVIAMENTOS]
    db.refresh(avulso)
    assert avulso.saldo_atual == Decimal("100.000")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_aviamentos.py -v`
Expected: FAIL — `ImportError: cannot import name 'AVISO_SEM_AVIAMENTOS'`.

- [ ] **Step 3: Regras de aviamentos**

Em `backend/app/services/camisetas/estoque.py`, acrescentar aos imports do topo `from dataclasses import dataclass` e `CamisetaInsumo` ao import de `app.models.camisetas`; e acrescentar ao final do arquivo:

```python
TRES_CASAS = Decimal("0.001")
TIPO_TECIDO_PRINCIPAL = "Tecido Principal"
AVISO_SEM_AVIAMENTOS = (
    "A ficha técnica deste modelo não tem aviamentos ligados ao estoque; nenhum aviamento foi baixado."
)


@dataclass(frozen=True)
class NecessidadeAviamento:
    insumo: CamisetaInsumo
    quantidade: Decimal


@dataclass(frozen=True)
class FaltaAviamento:
    codigo: str
    descricao: str
    necessario: Decimal
    disponivel: Decimal
    unidade: str

    def para_dict(self) -> dict:
        return {
            "codigo": self.codigo,
            "descricao": self.descricao,
            "necessario": float(self.necessario),
            "disponivel": float(self.disponivel),
            "unidade": self.unidade,
        }


def calcular_necessidades(itens_ficha, quantidade_pecas: int, margem_percentual: Decimal) -> list[NecessidadeAviamento]:
    """Consumo de cada aviamento ligado ao estoque para o lote, já com a margem de segurança.

    Itens que apontam para o mesmo insumo são somados; itens sem insumo são ignorados.
    """
    multiplicador = Decimal("1") + Decimal(str(margem_percentual)) / Decimal("100")
    insumos = {}
    totais = {}
    for item in itens_ficha:
        if item.insumo is None:
            continue
        chave = item.insumo.id_insumo
        insumos[chave] = item.insumo
        consumo = Decimal(str(item.consumo_unitario)) * quantidade_pecas * multiplicador
        totais[chave] = totais.get(chave, ZERO) + consumo
    return [
        NecessidadeAviamento(insumo=insumos[chave], quantidade=total.quantize(TRES_CASAS, rounding=ROUND_HALF_UP))
        for chave, total in totais.items()
    ]


def listar_faltas(necessidades: list[NecessidadeAviamento]) -> list[FaltaAviamento]:
    return [
        FaltaAviamento(
            codigo=n.insumo.codigo,
            descricao=n.insumo.tipo_malha_ou_aviamento,
            necessario=n.quantidade,
            disponivel=Decimal(str(n.insumo.saldo_atual or 0)),
            unidade=n.insumo.unidade_medida,
        )
        for n in necessidades
        if Decimal(str(n.insumo.saldo_atual or 0)) < n.quantidade
    ]


def aplicar_baixa(necessidades: list[NecessidadeAviamento]) -> None:
    """Baixa os aviamentos do estoque; o saldo pode ficar negativo (pendência de inventário)."""
    for n in necessidades:
        n.insumo.saldo_atual = Decimal(str(n.insumo.saldo_atual or 0)) - n.quantidade
        n.insumo.atualizado_em = get_utc_now()
```

- [ ] **Step 4: Schemas e resposta com avisos**

Em `backend/app/schemas/camisetas.py`, trocar a classe `CamisetaCosturaFaccaoEnviar` inteira por:

```python
class CamisetaCosturaFaccaoEnviar(BaseModel):
    id_op: int
    nome_faccao: str
    quantidade_enviada: int
    margem_seguranca_aviamentos_percentual: Decimal = Field(Decimal("3.00"), ge=0, le=100)
    observacoes: Optional[str] = None
    # Enviar mesmo com aviamento insuficiente no estoque registrado (saldo fica negativo)
    confirmar_saldo_insuficiente: bool = False
```

e, em `CamisetaCosturaFaccaoResponse`, logo após `observacoes: Optional[str] = None`, acrescentar:

```python
    avisos: List[str] = Field(default_factory=list)
```

Em `backend/app/services/camisetas/costura.py`, trocar a assinatura e o fim de `montar_resposta_remessa` para aceitar avisos:

```python
def montar_resposta_remessa(remessa, avisos=None) -> CamisetaCosturaFaccaoResponse:
    op = remessa.op
    return CamisetaCosturaFaccaoResponse(
        id_costura=remessa.id_costura,
        id_op=remessa.id_op,
        codigo_op=op.codigo_op if op else "OP",
        nome_modelo=op.modelo.nome_modelo if op and op.modelo else "Modelo",
        nome_faccao=remessa.nome_faccao,
        quantidade_enviada=remessa.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=remessa.margem_seguranca_aviamentos_percentual,
        quantidade_retornada=remessa.quantidade_retornada,
        perdas_pecas=remessa.perdas_pecas,
        saldo_aprovado=remessa.saldo_aprovado,
        status=remessa.status,
        data_envio=remessa.data_envio,
        data_retorno=remessa.data_retorno,
        observacoes=remessa.observacoes,
        avisos=list(avisos or []),
    )
```

- [ ] **Step 5: Router — envio para facção**

Em `backend/app/routers/camisetas/costura.py`, substituir os dois imports de serviços acrescentados na Task 7 por:

```python
from app.services.camisetas.costura import (
    STATUS_OP_EM_COSTURA,
    STATUS_REMESSA_EM_COSTURA,
    STATUS_REMESSA_RETORNADA,
    montar_resposta_remessa,
    status_op_apos_retorno,
)
from app.services.camisetas.estoque import (
    AVISO_SEM_AVIAMENTOS,
    TIPO_TECIDO_PRINCIPAL,
    aplicar_baixa,
    calcular_necessidades,
    listar_faltas,
    obter_ou_criar_estoque_acabado,
)
```

Substituir a função `enviar_para_faccao` inteira (decorador incluído) por:

```python
@router.post("/costura/enviar", response_model=CamisetaCosturaFaccaoResponse, status_code=status.HTTP_201_CREATED)
def enviar_para_faccao(envio_in: CamisetaCosturaFaccaoEnviar, db: Session = Depends(get_db)):
    """Envia painéis cortados para a facção e baixa os aviamentos da ficha técnica (com margem)."""
    op = db.query(CamisetaOrdemProducao).filter_by(id_op=envio_in.id_op).first()
    if not op:
        raise HTTPException(status_code=404, detail="Ordem de corte não encontrada")
    if envio_in.quantidade_enviada <= 0:
        raise HTTPException(status_code=400, detail="Quantidade enviada deve ser maior que zero")

    total_ja_enviado = sum(r.quantidade_enviada or 0 for r in (op.movimentacoes_costura or []))
    saldo_disponivel = max(0, (op.pecas_reais_cortadas or 0) - total_ja_enviado)
    if envio_in.quantidade_enviada > saldo_disponivel:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Quantidade a enviar ({envio_in.quantidade_enviada}) ultrapassa o saldo de painéis "
                f"cortados disponíveis nesta OP ({saldo_disponivel})."
            ),
        )

    itens_ficha = db.query(CamisetaFichaTecnica).filter(
        CamisetaFichaTecnica.id_modelo == op.id_modelo,
        CamisetaFichaTecnica.tipo_insumo != TIPO_TECIDO_PRINCIPAL,
    ).all()
    necessidades = calcular_necessidades(
        itens_ficha, envio_in.quantidade_enviada, envio_in.margem_seguranca_aviamentos_percentual
    )
    faltas = listar_faltas(necessidades)
    if faltas and not envio_in.confirmar_saldo_insuficiente:
        raise HTTPException(
            status_code=409,
            detail={
                "mensagem": "Aviamentos insuficientes no estoque para este envio.",
                "faltas": [f.para_dict() for f in faltas],
            },
        )

    remessa = CamisetaCosturaFaccao(
        id_op=envio_in.id_op,
        nome_faccao=envio_in.nome_faccao,
        quantidade_enviada=envio_in.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=envio_in.margem_seguranca_aviamentos_percentual,
        status=STATUS_REMESSA_EM_COSTURA,
        data_envio=get_utc_now(),
        observacoes=envio_in.observacoes,
    )
    db.add(remessa)
    op.status_op = STATUS_OP_EM_COSTURA
    aplicar_baixa(necessidades)
    avisos = [] if necessidades else [AVISO_SEM_AVIAMENTOS]

    db.commit()
    db.refresh(remessa)
    return montar_resposta_remessa(remessa, avisos)
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/camisetas backend/app/schemas/camisetas.py backend/app/routers/camisetas/costura.py backend/tests/test_aviamentos.py
git commit -m "fix: aviamentos insuficientes pedem confirmação e não usam mais taxas fixas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Dashboard usa o financeiro calculado e não inventa números

**Files:**
- Replace: `backend/app/routers/camisetas/dashboard.py` (arquivo inteiro)
- Modify: `backend/app/schemas/camisetas.py` (`CamisetaCardDestaque`)
- Test: `backend/tests/test_dashboard.py`

**Interfaces:**
- Consumes: `apurar_ano` (Task 6), `STATUS_ENTREGUE` (Task 5).
- Produces: `CamisetaCardDestaque.tecido_maior_rendimento: Optional[str]` e `rendimento_medio_tecido: Optional[Decimal]` (nulos sem dados); `grafico_financeiro_12_meses` sempre com os 12 meses do ano corrente.

- [ ] **Step 1: Testes que falham**

`backend/tests/test_dashboard.py`:

```python
from datetime import datetime
from decimal import Decimal

from app.core.config import FUSO_HORARIO
from tests.fabricas import criar_modelo, criar_pedido


def test_banco_vazio_nao_mostra_numeros_inventados(client):
    corpo = client.get("/camisetas/dashboard/").json()
    cards = corpo["cards"]
    assert cards["producao_total_acumulada"] == 0
    assert cards["tecido_maior_rendimento"] is None
    assert cards["rendimento_medio_tecido"] is None
    assert len(corpo["grafico_financeiro_12_meses"]) == 12
    assert all(Decimal(m["faturamento"]) == 0 for m in corpo["grafico_financeiro_12_meses"])


def test_grafico_usa_entregas_reais_do_mes(client, db):
    hoje = datetime.now(FUSO_HORARIO).date()
    modelo = criar_modelo(db)
    criar_pedido(db, modelo, valor="1200.00", status="Entregue", data_entrega_realizada=hoje)
    grafico = client.get("/camisetas/dashboard/").json()["grafico_financeiro_12_meses"]
    mes_atual = grafico[hoje.month - 1]
    assert mes_atual["mes_ano"] == hoje.strftime("%Y-%m")
    assert Decimal(mes_atual["faturamento"]) == Decimal("1200.00")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_dashboard.py -v`
Expected: FAIL — `producao_total_acumulada == 252` e `tecido_maior_rendimento == 'Meia Malha 30.1 Penteada'`.

- [ ] **Step 3: Schema**

Em `backend/app/schemas/camisetas.py`, na classe `CamisetaCardDestaque`, trocar:

```python
    tecido_maior_rendimento: str
    rendimento_medio_tecido: Decimal
```

por:

```python
    tecido_maior_rendimento: Optional[str] = None   # nulo enquanto não houver corte registrado
    rendimento_medio_tecido: Optional[Decimal] = None
```

- [ ] **Step 4: Reescrever o router do dashboard**

Substituir todo o conteúdo de `backend/app/routers/camisetas/dashboard.py` por:

```python
# app/routers/camisetas/dashboard.py
"""Indicadores do Dashboard do segmento Camisetas (somente dados reais)."""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.database import get_db
from app.models.camisetas import (
    CamisetaCosturaFaccao,
    CamisetaInsumo,
    CamisetaOrdemProducao,
    CamisetaPedido,
    CamisetaProdutoAcabado,
)
from app.schemas.camisetas import (
    CamisetaCardDestaque,
    CamisetaDashboardCompletoResponse,
    CamisetaItemFinanceiroMensal,
)
from app.services.camisetas.financeiro import apurar_ano
from app.services.camisetas.pedidos import STATUS_ENTREGUE

router = APIRouter()
DUAS_CASAS = Decimal("0.01")


def _tecido_de_maior_rendimento(db: Session) -> tuple[Optional[str], Optional[Decimal]]:
    linha = (
        db.query(
            CamisetaInsumo.tipo_malha_ou_aviamento.label("nome_tecido"),
            func.avg(CamisetaOrdemProducao.rendimento_real_pecas_kg).label("media_rendimento"),
        )
        .join(CamisetaOrdemProducao, CamisetaOrdemProducao.id_insumo_tecido == CamisetaInsumo.id_insumo)
        .filter(
            CamisetaOrdemProducao.rendimento_real_pecas_kg.isnot(None),
            CamisetaOrdemProducao.rendimento_real_pecas_kg > 0,
        )
        .group_by(CamisetaInsumo.tipo_malha_ou_aviamento)
        .order_by(desc("media_rendimento"))
        .first()
    )
    if not linha or not linha.nome_tecido or linha.media_rendimento is None:
        return None, None
    return str(linha.nome_tecido), Decimal(str(linha.media_rendimento)).quantize(DUAS_CASAS)


def _soma(db: Session, coluna, *filtros) -> int:
    return int(db.query(func.coalesce(func.sum(coluna), 0)).filter(*filtros).scalar() or 0)


@router.get("/dashboard/", response_model=CamisetaDashboardCompletoResponse)
def obter_metricas_dashboard(db: Session = Depends(get_db)):
    total_cortado = _soma(db, CamisetaOrdemProducao.pecas_reais_cortadas)
    total_costurado = _soma(db, CamisetaCosturaFaccao.saldo_aprovado)
    total_entregue = _soma(db, CamisetaPedido.quantidade_total, CamisetaPedido.status_pedido == STATUS_ENTREGUE)
    total_estoque_pronto = _soma(db, CamisetaProdutoAcabado.quantidade_total)
    criticos = db.query(CamisetaInsumo).filter(CamisetaInsumo.saldo_atual <= CamisetaInsumo.estoque_minimo).count()

    # Regra mantida: a produção total é abatida pelas peças já entregues aos clientes.
    producao_liquida = max(0, max(total_cortado, total_costurado) - total_entregue)
    tecido_top, rendimento_top = _tecido_de_maior_rendimento(db)

    ano_atual = datetime.now(FUSO_HORARIO).year
    grafico = [
        CamisetaItemFinanceiroMensal(
            mes_ano=a.mes_ano,
            mes_nome=a.mes_nome,
            materiais_gastos=a.gasto_materiais,
            lucro_liquido=a.lucro,
            faturamento=a.faturamento,
        )
        for a in apurar_ano(db, ano_atual)
    ]

    return CamisetaDashboardCompletoResponse(
        cards=CamisetaCardDestaque(
            producao_total_acumulada=producao_liquida,
            estoque_critico_quantidade=criticos,
            tecido_maior_rendimento=tecido_top,
            rendimento_medio_tecido=rendimento_top,
            estoque_pronto_total=total_estoque_pronto,
            total_entregue_acumulado=total_entregue,
        ),
        grafico_financeiro_12_meses=grafico,
    )
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest -v`
Expected: todos passam.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/camisetas/dashboard.py backend/app/schemas/camisetas.py backend/tests/test_dashboard.py
git commit -m "fix: dashboard mostra apenas dados reais e o financeiro calculado" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Avisos e confirmações compartilhados + tela de Pedidos

**Files:**
- Create: `frontend-alfa/src/components/feedback/feedbackContexts.js`
- Create: `frontend-alfa/src/components/feedback/ToastProvider.jsx`
- Create: `frontend-alfa/src/components/feedback/ConfirmProvider.jsx`
- Create: `frontend-alfa/src/components/feedback/useToast.js`
- Create: `frontend-alfa/src/components/feedback/useConfirm.js`
- Create: `frontend-alfa/src/components/feedback/mensagemErro.js`
- Create: `frontend-alfa/src/components/feedback/feedback.css`
- Create: `frontend-alfa/src/services/buscarEmParalelo.js`
- Modify: `frontend-alfa/src/App.jsx`
- Modify: `frontend-alfa/src/pages/PedidoCamisetas.jsx`
- Modify: `frontend-alfa/src/pages/PedidoCamisetas.css` (remover estilos do toast antigo)

**Interfaces:**
- Consumes: resposta de `POST /camisetas/pedidos/` com `codigo_pedido` gerado (Task 3).
- Produces: `useToast()` → `{ mostrar(tipo, texto), sucesso(texto), erro(texto), aviso(texto), info(texto) }` (tipos: `'sucesso' | 'erro' | 'aviso' | 'info'`, objeto estável); `useConfirm()` → `confirmar({ titulo, mensagem, detalhes?: string[], textoConfirmar?, textoCancelar?, perigo?: boolean }) => Promise<boolean>`; `mensagemDeErro(erro, padrao) => string`; `buscarEmParalelo(urls: string[]) => Promise<{ dados: any[][], houveFalha: boolean }>`.

- [ ] **Step 1: Contextos, hooks e utilitários**

`frontend-alfa/src/components/feedback/feedbackContexts.js`:

```js
import { createContext } from 'react';

export const ToastContext = createContext(null);
export const ConfirmContext = createContext(null);
```

`frontend-alfa/src/components/feedback/useToast.js`:

```js
import { useContext } from 'react';
import { ToastContext } from './feedbackContexts';

/** Avisos rápidos no canto da tela. Ex.: toast.sucesso('Pedido salvo'). */
export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  }
  return contexto;
}
```

`frontend-alfa/src/components/feedback/useConfirm.js`:

```js
import { useContext } from 'react';
import { ConfirmContext } from './feedbackContexts';

/** Diálogo de confirmação que devolve Promise<boolean>. */
export function useConfirm() {
  const contexto = useContext(ConfirmContext);
  if (!contexto) {
    throw new Error('useConfirm precisa estar dentro de <ConfirmProvider>.');
  }
  return contexto;
}
```

`frontend-alfa/src/components/feedback/mensagemErro.js`:

```js
/**
 * Extrai a mensagem amigável que o backend devolve em `detail`.
 * @param {unknown} erro erro do axios
 * @param {string} padrao texto usado quando não há detalhe
 * @returns {string}
 */
export function mensagemDeErro(erro, padrao) {
  const detalhe = erro?.response?.data?.detail;
  if (typeof detalhe === 'string') return detalhe;
  if (detalhe && typeof detalhe.mensagem === 'string') return detalhe.mensagem;
  if (Array.isArray(detalhe) && detalhe[0]?.msg) return detalhe[0].msg;
  return padrao;
}
```

`frontend-alfa/src/services/buscarEmParalelo.js`:

```js
import api from './api';

/**
 * Busca várias URLs em paralelo sem deixar uma falha esconder as outras.
 * @param {string[]} urls
 * @returns {Promise<{ dados: any[][], houveFalha: boolean }>}
 */
export async function buscarEmParalelo(urls) {
  const resultados = await Promise.allSettled(urls.map((url) => api.get(url)));
  return {
    dados: resultados.map((r) => (r.status === 'fulfilled' ? r.value.data ?? [] : [])),
    houveFalha: resultados.some((r) => r.status === 'rejected'),
  };
}
```

- [ ] **Step 2: Provedores**

`frontend-alfa/src/components/feedback/ToastProvider.jsx`:

```jsx
import { useCallback, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { ToastContext } from './feedbackContexts';
import './feedback.css';

const DURACAO_MS = 5000;
const DURACAO_ERRO_MS = 8000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const proximoId = useRef(1);

  const fechar = useCallback((id) => {
    setToasts((atuais) => atuais.filter((t) => t.id !== id));
  }, []);

  const mostrar = useCallback((tipo, texto) => {
    const id = proximoId.current;
    proximoId.current += 1;
    setToasts((atuais) => [...atuais, { id, tipo, texto }]);
    setTimeout(() => fechar(id), tipo === 'erro' ? DURACAO_ERRO_MS : DURACAO_MS);
  }, [fechar]);

  const valor = useMemo(() => ({
    mostrar,
    sucesso: (texto) => mostrar('sucesso', texto),
    erro: (texto) => mostrar('erro', texto),
    aviso: (texto) => mostrar('aviso', texto),
    info: (texto) => mostrar('info', texto),
  }), [mostrar]);

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="feedback-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`feedback-toast ${t.tipo}`} role={t.tipo === 'erro' ? 'alert' : 'status'}>
            <span>{t.texto}</span>
            <button
              type="button"
              className="feedback-toast-fechar"
              onClick={() => fechar(t.id)}
              aria-label="Fechar notificação"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

`frontend-alfa/src/components/feedback/ConfirmProvider.jsx`:

```jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmContext } from './feedbackContexts';
import './feedback.css';

const PADROES = { textoConfirmar: 'Confirmar', textoCancelar: 'Cancelar', perigo: false, detalhes: [] };

export function ConfirmProvider({ children }) {
  const [pedido, setPedido] = useState(null);
  const cancelarRef = useRef(null);
  const confirmarRef = useRef(null);

  const confirmar = useCallback((opcoes) => new Promise((resolver) => {
    setPedido({ ...PADROES, ...opcoes, detalhes: opcoes?.detalhes || [], resolver });
  }), []);

  const responder = useCallback((resposta) => {
    if (!pedido) return;
    pedido.resolver(resposta);
    setPedido(null);
  }, [pedido]);

  useEffect(() => {
    if (!pedido) return undefined;
    const focoAnterior = document.activeElement;
    (pedido.perigo ? cancelarRef.current : confirmarRef.current)?.focus();

    const aoTeclar = (evento) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        responder(false);
        return;
      }
      if (evento.key !== 'Tab') return;
      const botoes = [cancelarRef.current, confirmarRef.current].filter(Boolean);
      const atual = botoes.indexOf(document.activeElement);
      const passo = evento.shiftKey ? -1 : 1;
      const proximo = (atual + passo + botoes.length) % botoes.length;
      evento.preventDefault();
      botoes[proximo]?.focus();
    };

    window.addEventListener('keydown', aoTeclar);
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      focoAnterior?.focus?.();
    };
  }, [pedido, responder]);

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {pedido && (
        <div
          className="feedback-confirm-fundo"
          onMouseDown={(e) => { if (e.target === e.currentTarget) responder(false); }}
        >
          <div
            className="feedback-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="feedback-confirm-titulo"
            aria-describedby="feedback-confirm-mensagem"
          >
            <h2 id="feedback-confirm-titulo">{pedido.titulo}</h2>
            <p id="feedback-confirm-mensagem">{pedido.mensagem}</p>
            {pedido.detalhes.length > 0 && (
              <ul className="feedback-confirm-detalhes">
                {pedido.detalhes.map((linha) => <li key={linha}>{linha}</li>)}
              </ul>
            )}
            <div className="feedback-confirm-acoes">
              <button ref={cancelarRef} type="button" className="feedback-btn secundario" onClick={() => responder(false)}>
                {pedido.textoCancelar}
              </button>
              <button
                ref={confirmarRef}
                type="button"
                className={`feedback-btn ${pedido.perigo ? 'perigo' : 'primario'}`}
                onClick={() => responder(true)}
              >
                {pedido.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
```

`frontend-alfa/src/components/feedback/feedback.css`:

```css
/* Avisos (toast) e confirmações — usam os tokens do Ateliê Artesanal (index.css) */
.feedback-toasts {
  position: fixed;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  max-width: min(28rem, calc(100vw - 2rem));
  pointer-events: none;
}

.feedback-toast {
  pointer-events: auto;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.1rem;
  border-radius: 8px;
  font-family: var(--font-sans-humanist);
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.45;
  box-shadow: 0 10px 30px rgba(44, 37, 35, 0.12);
  animation: feedback-entrar 0.25s ease-out;
}

.feedback-toast.sucesso {
  background: var(--accent-artisan-sage-bg);
  border: 1px dashed var(--accent-artisan-sage-border);
  color: var(--accent-artisan-sage);
}

.feedback-toast.erro {
  background: var(--accent-artisan-terracotta-bg);
  border: 1px dashed var(--accent-artisan-terracotta-border);
  color: var(--accent-artisan-terracotta);
}

.feedback-toast.aviso {
  background: var(--accent-artisan-amber-bg);
  border: 1px dashed var(--accent-artisan-amber-border);
  color: var(--accent-artisan-amber);
}

.feedback-toast.info {
  background: var(--accent-artisan-indigo-bg);
  border: 1px dashed var(--accent-artisan-indigo-border);
  color: var(--accent-artisan-indigo);
}

.feedback-toast-fechar {
  background: transparent;
  border: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  padding: 0.15rem;
  border-radius: 4px;
  display: flex;
}

.feedback-toast-fechar:hover,
.feedback-toast-fechar:focus-visible {
  opacity: 1;
  outline: 2px solid currentColor;
  outline-offset: 1px;
}

.feedback-confirm-fundo {
  position: fixed;
  inset: 0;
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(44, 37, 35, 0.45);
}

.feedback-confirm {
  width: min(30rem, 100%);
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid var(--border-artisan);
  background: var(--bg-artisan-surface);
  color: var(--color-text-main);
  box-shadow: 0 24px 60px rgba(44, 37, 35, 0.25);
  animation: feedback-entrar 0.2s ease-out;
}

.feedback-confirm h2 {
  margin: 0 0 0.5rem;
  font-family: var(--font-serif-editorial);
  font-size: 1.2rem;
}

.feedback-confirm p {
  margin: 0 0 1rem;
  color: var(--color-text-body);
  line-height: 1.5;
}

.feedback-confirm-detalhes {
  margin: 0 0 1.1rem;
  padding: 0.75rem 1rem 0.75rem 2rem;
  border-radius: 8px;
  border: 1px dashed var(--accent-artisan-amber-border);
  background: var(--accent-artisan-amber-bg);
  color: var(--accent-artisan-amber);
  font-size: 0.88rem;
  line-height: 1.5;
}

.feedback-confirm-acoes {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.6rem;
}

.feedback-btn {
  font: inherit;
  font-weight: 700;
  padding: 0.65rem 1.15rem;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
}

.feedback-btn.secundario {
  background: var(--bg-artisan-subtle);
  border-color: var(--border-artisan-strong);
  color: var(--color-text-main);
}

.feedback-btn.primario {
  background: var(--accent-artisan-indigo);
  color: var(--bg-artisan-surface);
}

.feedback-btn.perigo {
  background: var(--accent-artisan-terracotta);
  color: var(--bg-artisan-surface);
}

.feedback-btn:hover {
  filter: brightness(0.94);
}

.feedback-btn:focus-visible {
  outline: 3px solid var(--accent-artisan-indigo-border);
  outline-offset: 2px;
}

@keyframes feedback-entrar {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .feedback-toast,
  .feedback-confirm {
    animation: none;
  }
}

@media (max-width: 600px) {
  .feedback-toasts {
    top: 1rem;
    left: 1rem;
    right: 1rem;
    max-width: none;
  }

  .feedback-confirm-acoes .feedback-btn {
    flex: 1 1 100%;
  }
}
```

- [ ] **Step 3: Montar os provedores no App**

Em `frontend-alfa/src/App.jsx`, acrescentar após `import { SegmentoProvider, useSegmento } from './context/SegmentoContext';`:

```jsx
import { ToastProvider } from './components/feedback/ToastProvider';
import { ConfirmProvider } from './components/feedback/ConfirmProvider';
```

e trocar a função `App` por:

```jsx
function App() {
  return (
    <BrowserRouter>
      <SegmentoProvider>
        <ToastProvider>
          <ConfirmProvider>
            <AppRoutes />
          </ConfirmProvider>
        </ToastProvider>
      </SegmentoProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Tela de Pedidos usa os componentes compartilhados**

Em `frontend-alfa/src/pages/PedidoCamisetas.jsx`:

1. Após `import api from '../services/api';`, acrescentar:

```jsx
import { useToast } from '../components/feedback/useToast';
import { useConfirm } from '../components/feedback/useConfirm';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
```

2. Trocar `const hoje = new Date().toISOString().split('T')[0];` por (data local, não UTC — depois das 21h o UTC já é amanhã):

```jsx
  const hoje = new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do navegador
```

3. Trocar `const [toast, setToast] = useState(null);` por:

```jsx
  const toast = useToast();
  const confirmar = useConfirm();
```

4. Substituir a função `carregarDados` inteira por:

```jsx
  const carregarDados = async () => {
    setLoading(true);
    const { dados, houveFalha } = await buscarEmParalelo([
      '/camisetas/modelos/',
      '/camisetas/pedidos/',
      '/camisetas/estoque-acabado/',
    ]);
    const [mods, listaPedidos, acabados] = dados;
    setModelos(mods);
    if (mods.length > 0 && !formData.id_modelo) {
      setFormData((prev) => ({ ...prev, id_modelo: mods[0].id_modelo }));
    }
    setPedidos(listaPedidos);
    setEstoqueAcabado(acabados);
    if (houveFalha) {
      toast.erro('Não foi possível carregar todos os dados de pedidos. Verifique a conexão e recarregue a página.');
    }
    setLoading(false);
  };
```

5. Substituir a função `handleSubmit` inteira por:

```jsx
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.nome_cliente || !formData.id_modelo || !formData.prazo_entrega || !formData.valor_total) {
      toast.aviso('Preencha todos os campos obrigatórios marcados com asterisco (*).');
      return;
    }
    if (formData.prazo_entrega < hoje) {
      setErroData('O prazo de entrega não pode ser anterior à data de hoje.');
      return;
    }
    if (totalGrade <= 0) {
      toast.aviso('A soma da grade de tamanhos (P, M, G, GG) deve ser maior que zero.');
      return;
    }

    try {
      const { data: pedidoCriado } = await api.post('/camisetas/pedidos/', {
        nome_cliente: formData.nome_cliente,
        id_modelo: parseInt(formData.id_modelo, 10),
        grade_p: parseInt(formData.grade_p || 0, 10),
        grade_m: parseInt(formData.grade_m || 0, 10),
        grade_g: parseInt(formData.grade_g || 0, 10),
        grade_gg: parseInt(formData.grade_gg || 0, 10),
        prazo_entrega: formData.prazo_entrega,
        valor_total: parseFloat(formData.valor_total),
        observacoes: formData.observacoes,
      });

      toast.sucesso(`Pedido ${pedidoCriado.codigo_pedido} registrado! Status inicial: 'Aguardando Produção'.`);
      setFormData({
        nome_cliente: '',
        id_modelo: modelos.length > 0 ? modelos[0].id_modelo : '',
        grade_p: 0,
        grade_m: 0,
        grade_g: 0,
        grade_gg: 0,
        prazo_entrega: hoje,
        valor_total: '',
        observacoes: '',
      });
      setErroData('');
      await carregarDados();
    } catch (err) {
      console.error('Erro ao cadastrar pedido:', err);
      toast.erro(mensagemDeErro(err, 'Erro ao salvar o pedido.'));
    }
  };
```

6. Substituir a função `handleConfirmarEntrega` inteira por:

```jsx
  const handleConfirmarEntrega = async (e) => {
    e.preventDefault();
    if (!pedidoParaEntrega) return;

    if (!temEstoqueSuficiente) {
      toast.aviso(`Estoque pronto insuficiente para entrega. Disponível: ${saldoProntoModelo} peças. Necessário: ${pedidoParaEntrega.quantidade_total} peças.`);
      return;
    }

    try {
      setSalvandoEntrega(true);
      await api.post(`/camisetas/pedidos/${pedidoParaEntrega.id_pedido}/entregar`, {
        data_entrega: dadosEntrega.data_entrega || hoje,
        recebedor: dadosEntrega.recebedor,
        observacoes: dadosEntrega.observacoes,
      });
      setModalEntregaAberto(false);
      toast.sucesso(`Entrega do pedido ${pedidoParaEntrega.codigo_pedido} (${pedidoParaEntrega.nome_cliente}) concluída. ${pedidoParaEntrega.quantidade_total} peças baixadas do Estoque Pronto.`);
      await carregarDados();
    } catch (err) {
      console.error('Erro ao registrar entrega:', err);
      toast.erro(mensagemDeErro(err, 'Erro ao registrar a entrega do pedido.'));
    } finally {
      setSalvandoEntrega(false);
    }
  };
```

7. Substituir a função `handleReverterEntrega` inteira por:

```jsx
  const handleReverterEntrega = async (pedido) => {
    const confirmou = await confirmar({
      titulo: `Reverter a entrega do pedido ${pedido.codigo_pedido}?`,
      mensagem: `O status volta para 'Aguardando Produção' e as ${pedido.quantidade_total} peças retornam ao Estoque Pronto.`,
      textoConfirmar: 'Reverter entrega',
      perigo: true,
    });
    if (!confirmou) return;

    try {
      setLoading(true);
      await api.put(`/camisetas/pedidos/${pedido.id_pedido}/status`, { status_pedido: 'Aguardando Produção' });
      toast.info(`Entrega do pedido ${pedido.codigo_pedido} revertida. As peças voltaram ao Estoque Pronto.`);
      await carregarDados();
    } catch (err) {
      console.error('Erro ao reverter status do pedido:', err);
      toast.erro(mensagemDeErro(err, 'Erro ao reverter a entrega.'));
    } finally {
      setLoading(false);
    }
  };
```

8. Apagar o bloco JSX do toast antigo (logo após `<main className="pedido-camisetas-main">`), de `{/* Toast Notificação */}` até o `)}` que fecha `{toast && (`.

9. Em `frontend-alfa/src/pages/PedidoCamisetas.css`, apagar as regras cujos seletores começam com `.toast-alerta-flutuante` ou `.toast-btn-fechar` (e o `@keyframes` usado só por elas, se houver).

- [ ] **Step 5: Verificar build, lint e restos**

Run: `cd frontend-alfa && npm run build && npx oxlint src/pages/PedidoCamisetas.jsx src/components/feedback src/services && grep -n "alert(\|window.confirm\|setToast\|toast-alerta" src/pages/PedidoCamisetas.jsx src/pages/PedidoCamisetas.css`
Expected: build ok; oxlint sem erros (se acusar import não usado em `PedidoCamisetas.jsx`, como `X`, remova-o do import); o `grep` não encontra nada (saída vazia, código 1).

- [ ] **Step 6: Verificação manual (Roteiro de verificação local)**

Em `http://localhost:5173/camisetas/pedidos`:
- cadastrar um pedido → aviso verde com `PED-2026-0001` (ou próximo número);
- tentar salvar sem cliente → aviso âmbar, sem janela do navegador;
- clicar em "Registrar entrega" de um pedido com estoque suficiente → aviso verde;
- reverter a entrega → diálogo com "Reverter entrega" em vermelho, foco em "Cancelar"; `Esc` fecha; `Tab` alterna entre os botões.

- [ ] **Step 7: Commit**

```bash
git add frontend-alfa/src/components/feedback frontend-alfa/src/services/buscarEmParalelo.js frontend-alfa/src/App.jsx frontend-alfa/src/pages/PedidoCamisetas.jsx frontend-alfa/src/pages/PedidoCamisetas.css
git commit -m "feat: avisos e confirmações compartilhados na tela de Pedidos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Telas de Corte, Estoque e Ficha Técnica com o feedback compartilhado

**Files:**
- Modify: `frontend-alfa/src/pages/CorteRendimentoCamisetas.jsx` + `.css`
- Modify: `frontend-alfa/src/pages/EstoqueCamisetas.jsx` + `.css`
- Modify: `frontend-alfa/src/pages/FichaTecnicaCamisetas.jsx` + `.css`

**Interfaces:**
- Consumes: `useToast`, `useConfirm`, `mensagemDeErro`, `buscarEmParalelo` (Task 10); `codigo_op` gerado pelo servidor (Task 3); saldo negativo possível (Task 8).

- [ ] **Step 1: Corte & Rendimento**

Em `frontend-alfa/src/pages/CorteRendimentoCamisetas.jsx`:

1. Imports: acrescentar após `import api from '../services/api';`:

```jsx
import { useToast } from '../components/feedback/useToast';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
```

2. Trocar o estado do toast e o efeito que o fecha sozinho:

```jsx
  const [toast, setToast] = useState(null);

  // Fecha o toast automaticamente após 5 segundos
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
```

por:

```jsx
  const toast = useToast();
```

3. Em `carregarDados`, trocar:

```jsx
      const [resModelos, resInsumos, resOps] = await Promise.all([
        api.get('/camisetas/modelos/').catch(() => ({ data: [] })),
        api.get('/camisetas/insumos/?categoria=ROLO_TECIDO').catch(() => ({ data: [] })),
        api.get('/camisetas/ordens/').catch(() => ({ data: [] }))
      ]);

      const listaMods = resModelos.data || [];
      const listaTecs = resInsumos.data || [];
      setModelos(listaMods);
      setTecidos(listaTecs);
      setOrdens(resOps.data || []);
```

por:

```jsx
      const { dados, houveFalha } = await buscarEmParalelo([
        '/camisetas/modelos/',
        '/camisetas/insumos/?categoria=ROLO_TECIDO',
        '/camisetas/ordens/',
      ]);
      const [listaMods, listaTecs, listaOps] = dados;
      setModelos(listaMods);
      setTecidos(listaTecs);
      setOrdens(listaOps);
      if (houveFalha) {
        toast.erro('Não foi possível carregar todos os dados de corte. Verifique a conexão e recarregue a página.');
      }
```

4. Código da OP vem do servidor. Trocar (atenção: a linha `const proximoNumero = ordens.length > 0` termina com um espaço):

```jsx
      const proximoNumero = ordens.length > 0 
        ? Math.max(...ordens.map(o => {
            const m = o.codigo_op?.match(/\d+/);
            return m ? parseInt(m[0], 10) : 100;
          })) + 1
        : 101;
      const codigoGerado = `OP-CAM-${proximoNumero}`;

      await api.post('/camisetas/ordens/', {
        codigo_op: codigoGerado,
        id_modelo: parseInt(formOp.id_modelo),
```

por:

```jsx
      const { data: opCriada } = await api.post('/camisetas/ordens/', {
        id_modelo: parseInt(formOp.id_modelo, 10),
```

e, no aviso de sucesso logo abaixo, trocar `${codigoGerado}` por `${opCriada.codigo_op}`.

5. Cada chamada `setToast({ tipo: T, texto: X });` (multilinha ou não) vira `toast.mostrar(T, X);`. Nos `catch`, quando o texto for `err.response?.data?.detail || "..."`, use `mensagemDeErro(err, "...")`. Exemplo:

```jsx
      setToast({
        tipo: 'erro',
        texto: err.response?.data?.detail || "Erro ao registrar corte."
      });
```

vira:

```jsx
      toast.erro(mensagemDeErro(err, 'Erro ao registrar corte.'));
```

6. Apagar o bloco JSX `{/* Toast Notificação Integrada (Sem alertas de navegador) */}` + `{toast && ( ... )}` logo após `<main className="corte-camisetas-main">`.

7. Em `CorteRendimentoCamisetas.css`, apagar as regras `.toast-alerta-flutuante*` e `.toast-btn-fechar*`.

- [ ] **Step 2: Estoque de Insumos (inclui selo de saldo negativo)**

Em `frontend-alfa/src/pages/EstoqueCamisetas.jsx`:

1. Acrescentar após `import api from '../services/api';`:

```jsx
import { useToast } from '../components/feedback/useToast';
```

2. Trocar `const [toast, setToast] = useState(null);` por `const toast = useToast();`.

3. Trocar a função:

```jsx
  const mostrarToast = (tipo, texto) => {
    setToast({ tipo, texto });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };
```

por:

```jsx
  const mostrarToast = (tipo, texto) => toast.mostrar(tipo, texto);
```

4. Apagar o bloco JSX `{toast && ( ... )}` do toast antigo (contém `className={`toast-alerta-flutuante ${toast.tipo}`}`).

5. No mapeamento das linhas da tabela, logo após `const isCritico = saldoNum <= minNum;`, acrescentar:

```jsx
                    const isNegativo = saldoNum < 0;
```

e trocar o bloco do selo:

```jsx
                          {isCritico ? (
                            <span className="status-estoque-badge critico" title="Saldo abaixo ou igual ao estoque mínimo">
```

por:

```jsx
                          {isNegativo ? (
                            <span className="status-estoque-badge negativo" title="O saldo registrado ficou abaixo de zero: confira o estoque físico e lance a nota fiscal que faltou">
                              <AlertTriangle size={12} />
                              Negativo — conferir inventário
                            </span>
                          ) : isCritico ? (
                            <span className="status-estoque-badge critico" title="Saldo abaixo ou igual ao estoque mínimo">
```

6. Em `EstoqueCamisetas.css`: apagar as regras `.toast-alerta-flutuante*`, `.toast-btn-fechar*` e `@keyframes slideDownToast`; acrescentar:

```css
.status-estoque-badge.negativo {
  background: var(--accent-artisan-terracotta);
  color: var(--bg-artisan-surface);
  border: 1px solid var(--accent-artisan-terracotta);
}
```

- [ ] **Step 3: Ficha Técnica**

Em `frontend-alfa/src/pages/FichaTecnicaCamisetas.jsx`:

1. Acrescentar após `import api from '../services/api';`:

```jsx
import { useToast } from '../components/feedback/useToast';
import { useConfirm } from '../components/feedback/useConfirm';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
```

2. Trocar `const [toast, setToast] = useState(null);` por:

```jsx
  const toast = useToast();
  const confirmar = useConfirm();
```

3. Trocar a função `mostrarToast` (mesmo formato da de Estoque) por:

```jsx
  const mostrarToast = (tipo, texto) => toast.mostrar(tipo, texto);
```

4. Em `carregarDados`, trocar:

```jsx
      const [resModelos, resInsumos] = await Promise.all([
        api.get('/camisetas/modelos/').catch(() => ({ data: [] })),
        api.get('/camisetas/insumos/').catch(() => ({ data: [] }))
      ]);

      const listaMods = resModelos.data || [];
      setModelos(listaMods);
      setInsumosEstoque(resInsumos.data || []);
```

por:

```jsx
      const { dados, houveFalha } = await buscarEmParalelo(['/camisetas/modelos/', '/camisetas/insumos/']);
      const [listaMods, listaInsumos] = dados;
      setModelos(listaMods);
      setInsumosEstoque(listaInsumos);
      if (houveFalha) {
        mostrarToast('erro', 'Não foi possível carregar todos os modelos e insumos. Verifique a conexão e recarregue a página.');
      }
```

5. Em `handleRemoverItemFicha`, trocar:

```jsx
    const confirma = window.confirm(`Deseja remover "${nomeItem}" da ficha técnica deste modelo?`);
    if (!confirma) return;
```

por:

```jsx
    const confirma = await confirmar({
      titulo: 'Remover item da ficha técnica?',
      mensagem: `"${nomeItem}" deixará de ser considerado no custo e na baixa de aviamentos deste modelo.`,
      textoConfirmar: 'Remover item',
      perigo: true,
    });
    if (!confirma) return;
```

6. Apagar o bloco JSX `{toast && ( ... )}` do toast antigo e, em `FichaTecnicaCamisetas.css`, as regras `.toast-alerta-flutuante*` e `.toast-btn-fechar*`.

7. Renumerar o título: trocar `4. Tela de Ficha Técnica Digital` por `3. Tela de Ficha Técnica Digital`. Em `EstoqueCamisetas.jsx`, trocar `3. Gestão de Estoque de Insumos` por `4. Gestão de Estoque de Insumos`.

- [ ] **Step 4: Verificar build, lint e restos**

Run: `cd frontend-alfa && npm run build && npx oxlint src/pages/CorteRendimentoCamisetas.jsx src/pages/EstoqueCamisetas.jsx src/pages/FichaTecnicaCamisetas.jsx && grep -rn "setToast\|toast-alerta\|window.confirm\|alert(" src/pages/CorteRendimentoCamisetas.* src/pages/EstoqueCamisetas.* src/pages/FichaTecnicaCamisetas.*`
Expected: build ok; oxlint sem erros (remova imports que ficaram sem uso, como `X`); `grep` sem resultados.

- [ ] **Step 5: Verificação manual**

- Corte: abrir uma OP → aviso verde com `OP-2026-000N`; finalizar o corte → aviso verde.
- Estoque: lançar entrada de NF → aviso; um insumo com saldo negativo (crie via envio confirmado na Tarefa 12, ou ajuste no `dev.db`) mostra o selo vermelho "Negativo — conferir inventário".
- Ficha: remover um item → diálogo com "Remover item" em vermelho.

- [ ] **Step 6: Commit**

```bash
git add frontend-alfa/src/pages/CorteRendimentoCamisetas.* frontend-alfa/src/pages/EstoqueCamisetas.* frontend-alfa/src/pages/FichaTecnicaCamisetas.*
git commit -m "refactor: corte, estoque e ficha técnica usam os avisos compartilhados" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Tela de Costura & Facções — confirmação de aviamentos faltantes

**Files:**
- Modify: `frontend-alfa/src/pages/CosturaFaccoesCamisetas.jsx`

**Interfaces:**
- Consumes: `useToast`, `useConfirm`, `mensagemDeErro`, `buscarEmParalelo` (Task 10); 409 com `detail.faltas` e `avisos` na resposta do envio (Task 8); 409 do retorno duplicado (Task 7).

- [ ] **Step 1: Imports e hooks**

Acrescentar após `import api from '../services/api';`:

```jsx
import { useToast } from '../components/feedback/useToast';
import { useConfirm } from '../components/feedback/useConfirm';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import { buscarEmParalelo } from '../services/buscarEmParalelo';
```

Logo após `function CosturaFaccoesCamisetas() {`, acrescentar:

```jsx
  const toast = useToast();
  const confirmar = useConfirm();
```

Acima de `function CosturaFaccoesCamisetas() {`, acrescentar:

```jsx
const FORM_ENVIO_VAZIO = {
  id_op: '',
  nome_faccao: '',
  quantidade_enviada: '',
  margem_seguranca_aviamentos_percentual: '3.00',
  observacoes: '',
};

const formatarNumero = (valor) => Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

const descreverFalta = (falta) =>
  `${falta.descricao} (${falta.codigo}): precisa ${formatarNumero(falta.necessario)} ${falta.unidade}, tem ${formatarNumero(falta.disponivel)} ${falta.unidade}`;
```

e trocar o `useState` inicial do formulário de envio por `const [formEnvio, setFormEnvio] = useState(FORM_ENVIO_VAZIO);`.

- [ ] **Step 2: Carregamento**

Em `carregarDados`, trocar:

```jsx
      const [resOps, resRemessas] = await Promise.all([
        api.get('/camisetas/ordens/').catch(() => ({ data: [] })),
        api.get('/camisetas/costura/').catch(() => ({ data: [] }))
      ]);

      const listaRemessas = resRemessas.data || [];
      setRemessas(listaRemessas);
```

por:

```jsx
      const { dados, houveFalha } = await buscarEmParalelo(['/camisetas/ordens/', '/camisetas/costura/']);
      const [listaOps, listaRemessas] = dados;
      setRemessas(listaRemessas);
      if (houveFalha) {
        toast.erro('Não foi possível carregar todas as OPs e remessas. Verifique a conexão e recarregue a página.');
      }
```

e, logo abaixo, trocar `const opsComSaldo = (resOps.data || []).map(op => {` por `const opsComSaldo = listaOps.map(op => {`.

- [ ] **Step 3: Envio com confirmação de faltas**

Substituir a função `handleEnviarFaccao` inteira por:

```jsx
  const enviarRemessa = (confirmarSaldoInsuficiente) => api.post('/camisetas/costura/enviar', {
    id_op: parseInt(formEnvio.id_op, 10),
    nome_faccao: formEnvio.nome_faccao,
    quantidade_enviada: parseInt(formEnvio.quantidade_enviada, 10),
    margem_seguranca_aviamentos_percentual: parseFloat(formEnvio.margem_seguranca_aviamentos_percentual || 3),
    observacoes: formEnvio.observacoes,
    confirmar_saldo_insuficiente: confirmarSaldoInsuficiente,
  });

  const handleEnviarFaccao = async (e) => {
    e.preventDefault();
    if (!formEnvio.id_op || !formEnvio.nome_faccao || !formEnvio.quantidade_enviada) {
      toast.aviso('Preencha a OP, a facção parceira e a quantidade enviada.');
      return;
    }
    const opAtual = opsCortadas.find((o) => String(o.id_op) === String(formEnvio.id_op));
    const qtdNum = parseInt(formEnvio.quantidade_enviada, 10);
    if (opAtual && qtdNum > opAtual.saldo_disponivel) {
      toast.aviso(`Quantidade enviada (${qtdNum}) não pode ultrapassar os painéis disponíveis nesta OP (${opAtual.saldo_disponivel}).`);
      return;
    }

    try {
      let resposta;
      try {
        resposta = await enviarRemessa(false);
      } catch (err) {
        const faltas = err.response?.status === 409 ? err.response.data?.detail?.faltas : null;
        if (!faltas) throw err;
        const confirmou = await confirmar({
          titulo: 'Aviamentos insuficientes no estoque',
          mensagem: 'O estoque registrado não cobre este envio. Se o material existe na fábrica, envie mesmo assim: o saldo ficará negativo para você conferir o inventário depois.',
          detalhes: faltas.map(descreverFalta),
          textoConfirmar: 'Enviar mesmo assim',
          textoCancelar: 'Cancelar envio',
        });
        if (!confirmou) return;
        resposta = await enviarRemessa(true);
      }

      const avisos = resposta.data?.avisos || [];
      const margem = formEnvio.margem_seguranca_aviamentos_percentual || '3';
      toast.sucesso(avisos.length > 0
        ? `Lote enviado para ${formEnvio.nome_faccao}.`
        : `Lote enviado para ${formEnvio.nome_faccao}. Aviamentos baixados com margem de ${margem}%.`);
      avisos.forEach((aviso) => toast.aviso(aviso));
      setFormEnvio(FORM_ENVIO_VAZIO);
      carregarDados();
    } catch (err) {
      console.error('Erro ao enviar para facção:', err);
      toast.erro(mensagemDeErro(err, 'Erro ao registrar a remessa de costura.'));
    }
  };
```

- [ ] **Step 4: Retorno**

Substituir a função `handleRegistrarRetorno` inteira por (agora aceita retorno 0 — lote todo perdido):

```jsx
  const handleRegistrarRetorno = async (e) => {
    e.preventDefault();
    if (!remessaSelecionada || qtdRetornada === '') return;

    try {
      await api.put(`/camisetas/costura/${remessaSelecionada.id_costura}/retornar`, {
        quantidade_retornada: parseInt(qtdRetornada, 10),
        observacoes: obsRetorno,
      });
      toast.sucesso('Retorno conferido! Perdas apuradas e peças aprovadas lançadas no Estoque de Produtos Acabados.');
      setModalRetornoAberto(false);
      setRemessaSelecionada(null);
      carregarDados();
    } catch (err) {
      console.error('Erro ao registrar retorno:', err);
      toast.erro(mensagemDeErro(err, 'Erro ao registrar o retorno da facção.'));
    }
  };
```

- [ ] **Step 5: Título**

Trocar `7. Tela de Costura e Terceirização (Facções)` por `6. Tela de Costura e Terceirização (Facções)`.

- [ ] **Step 6: Verificar build, lint e restos**

Run: `cd frontend-alfa && npm run build && npx oxlint src/pages/CosturaFaccoesCamisetas.jsx && grep -n "alert(\|window.confirm" src/pages/CosturaFaccoesCamisetas.jsx`
Expected: build ok; oxlint sem erros; `grep` sem resultados.

- [ ] **Step 7: Verificação manual**

Com o seed carregado: no `dev.db`, deixe a etiqueta com pouco saldo (ex.: `sqlite3 backend/dev.db "UPDATE camisetas_insumos SET saldo_atual=5 WHERE codigo='AV-ETIQ-01'"`), envie 100 peças da OP cortada → diálogo listando "Etiqueta Composição Cetim P/M/G (AV-ETIQ-01): precisa 103, tem 5 unidades". "Cancelar envio" não cria remessa; "Enviar mesmo assim" cria e o Estoque mostra o selo "Negativo — conferir inventário". Registrar o retorno duas vezes não é possível (segunda tentativa mostra o aviso de erro do 409).

- [ ] **Step 8: Commit**

```bash
git add frontend-alfa/src/pages/CosturaFaccoesCamisetas.jsx
git commit -m "feat: confirmação de aviamentos faltantes no envio para facção" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Tela Financeiro sem "Sincronizar" — só outros custos são digitados

**Files:**
- Replace: `frontend-alfa/src/pages/RegistroFinanceiroCamisetas.jsx` (arquivo inteiro)
- Modify: `frontend-alfa/src/pages/RegistroFinanceiroCamisetas.css` (acrescentar 3 classes)

**Interfaces:**
- Consumes: `GET /camisetas/financeiro/?ano=` (12 meses com `qtd_pedidos_entregues`, `qtd_entradas`) e `POST /camisetas/financeiro/` (só outros custos) da Task 6; `useToast`, `mensagemDeErro` (Task 10).

- [ ] **Step 1: Reescrever a página**

Substituir todo o conteúdo de `frontend-alfa/src/pages/RegistroFinanceiroCamisetas.jsx` por:

```jsx
import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, DollarSign, PlusCircle, Printer } from 'lucide-react';
import api from '../services/api';
import Sidebar from '../components/Sidebar';
import { useToast } from '../components/feedback/useToast';
import { mensagemDeErro } from '../components/feedback/mensagemErro';
import './RegistroFinanceiroCamisetas.css';

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const mesAtual = () => new Date().toLocaleDateString('sv-SE').slice(0, 7);

const formatarMoeda = (valor) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor) || 0);

const formatarMesAno = (mesAno) => {
  const [ano, mes] = String(mesAno || '').split('-');
  const indice = parseInt(mes, 10) - 1;
  return NOMES_MESES[indice] ? `${NOMES_MESES[indice]} / ${ano}` : mesAno || '—';
};

const margemPercentual = (reg) => {
  const faturamento = Number(reg.faturamento_receita) || 0;
  return faturamento > 0 ? ((Number(reg.lucro_liquido) / faturamento) * 100).toFixed(1) : '0.0';
};

const descreverOrigem = (reg) => {
  const partes = [];
  if (reg.qtd_pedidos_entregues > 0) partes.push(`${reg.qtd_pedidos_entregues} entrega(s)`);
  if (reg.qtd_entradas > 0) partes.push(`${reg.qtd_entradas} nota(s) fiscal(is)`);
  return partes.length > 0 ? partes.join(' · ') : 'Sem movimento';
};

const escaparHtml = (texto) =>
  String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const somar = (registros, campo) => registros.reduce((acc, r) => acc + (Number(r[campo]) || 0), 0);

function RegistroFinanceiroCamisetas() {
  const toast = useToast();
  const anoCorrente = Number(mesAtual().slice(0, 4));
  const [ano, setAno] = useState(anoCorrente);
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [formFin, setFormFin] = useState({ mes_ano: mesAtual(), outros_custos_operacionais: '', observacoes: '' });

  const carregarRegistros = useCallback(async (anoReferencia) => {
    try {
      setCarregando(true);
      const res = await api.get(`/camisetas/financeiro/?ano=${anoReferencia}`);
      setRegistros(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar financeiro:', err);
      toast.erro(mensagemDeErro(err, 'Não foi possível carregar o financeiro.'));
    } finally {
      setCarregando(false);
    }
  }, [toast]);

  useEffect(() => {
    carregarRegistros(ano);
  }, [ano, carregarRegistros]);

  const registroDoMes = registros.find((r) => r.mes_ano === formFin.mes_ano);

  const handleMesAnoChange = (e) => {
    const novoMes = e.target.value;
    const existente = registros.find((r) => r.mes_ano === novoMes);
    setFormFin({
      mes_ano: novoMes,
      outros_custos_operacionais: existente && Number(existente.outros_custos_operacionais) > 0
        ? String(existente.outros_custos_operacionais)
        : '',
      observacoes: existente?.observacoes || '',
    });
    const anoDoMes = Number(novoMes.slice(0, 4));
    if (anoDoMes && anoDoMes !== ano) setAno(anoDoMes);
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    const outros = Number(formFin.outros_custos_operacionais || 0);
    if (!formFin.mes_ano) {
      toast.aviso('Escolha o mês de referência.');
      return;
    }
    if (outros < 0) {
      toast.aviso('Outros custos não pode ser negativo.');
      return;
    }
    try {
      setSalvando(true);
      await api.post('/camisetas/financeiro/', {
        mes_ano: formFin.mes_ano,
        outros_custos_operacionais: outros,
        observacoes: formFin.observacoes,
      });
      toast.sucesso(`Outros custos de ${formatarMesAno(formFin.mes_ano)} salvos. O lucro do mês foi recalculado.`);
      await carregarRegistros(ano);
    } catch (err) {
      console.error('Erro ao salvar outros custos:', err);
      toast.erro(mensagemDeErro(err, 'Erro ao salvar os outros custos.'));
    } finally {
      setSalvando(false);
    }
  };

  const totalFaturamento = somar(registros, 'faturamento_receita');
  const totalGasto = somar(registros, 'valor_gasto_materiais');
  const totalLucro = somar(registros, 'lucro_liquido');
  const margemMedia = totalFaturamento > 0 ? ((totalLucro / totalFaturamento) * 100).toFixed(1) : '0.0';

  const handleExportarPDF = () => {
    const janela = window.open('', '_blank');
    if (!janela) {
      toast.aviso('Permita janelas pop-up neste navegador para exportar o relatório em PDF.');
      return;
    }
    const emissao = new Date().toLocaleString('pt-BR');
    const linhas = registros.map((reg) => `
      <tr>
        <td><strong>${escaparHtml(formatarMesAno(reg.mes_ano))}</strong></td>
        <td>${escaparHtml(descreverOrigem(reg))}</td>
        <td style="text-align:right;color:#b91c1c;font-weight:700;">${formatarMoeda(reg.valor_gasto_materiais)}</td>
        <td style="text-align:right;color:#1d4ed8;font-weight:700;">${formatarMoeda(reg.faturamento_receita)}</td>
        <td style="text-align:right;">${formatarMoeda(reg.outros_custos_operacionais)}</td>
        <td style="text-align:right;color:#047857;font-weight:800;">${formatarMoeda(reg.lucro_liquido)}</td>
        <td style="text-align:center;font-weight:700;">${margemPercentual(reg)}%</td>
        <td style="font-size:10px;color:#6b7280;">${escaparHtml(reg.observacoes || '-')}</td>
      </tr>`).join('');

    janela.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
      <title>Relatório Financeiro ${ano} - Confecção Alfa</title>
      <style>
        @page { size: A4 landscape; margin: 12mm 15mm; }
        body { font-family: 'Plus Jakarta Sans', Arial, sans-serif; color: #2C2523; padding: 24px; font-size: 12px; }
        h1 { margin: 0; font-size: 22px; color: #1E3A8A; font-family: 'Lora', Georgia, serif; }
        .meta { color: #6B7280; font-size: 11px; margin: 4px 0 16px; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
        .kpi { border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px 14px; background: #FAF9F6; }
        .kpi span { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #6B7280; }
        .kpi strong { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #F4EFEA; text-transform: uppercase; font-size: 10px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #D5CCC0; }
        td { padding: 8px 10px; border-bottom: 1px solid #EAE4DD; }
      </style></head><body>
      <h1>CONFECÇÃO ALFA — Financeiro ${ano}</h1>
      <p class="meta">Emissão: ${escaparHtml(emissao)} · Faturamento = pedidos entregues · Gasto = notas fiscais de insumos</p>
      <div class="kpis">
        <div class="kpi"><span>Faturamento</span><strong>${formatarMoeda(totalFaturamento)}</strong></div>
        <div class="kpi"><span>Compras de matéria-prima</span><strong>${formatarMoeda(totalGasto)}</strong></div>
        <div class="kpi"><span>Lucro líquido</span><strong>${formatarMoeda(totalLucro)}</strong></div>
        <div class="kpi"><span>Margem média</span><strong>${margemMedia}%</strong></div>
      </div>
      <table><thead><tr>
        <th>Mês</th><th>Origem</th><th>Matéria-prima</th><th>Faturamento</th><th>Outros custos</th>
        <th>Lucro</th><th>Margem</th><th>Observações</th>
      </tr></thead><tbody>${linhas}</tbody></table>
      <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
      </body></html>`);
    janela.document.close();
  };

  return (
    <div className="financeiro-camisetas-container">
      <Sidebar />

      <main className="financeiro-camisetas-main">
        <header className="financeiro-header">
          <h1>
            <DollarSign size={28} color="#204B72" aria-hidden="true" />
            7. Tela de Registro Financeiro (Custos e Lucratividade)
          </h1>
          <p>
            O faturamento (pedidos entregues) e as compras de matéria-prima (notas fiscais) são calculados
            automaticamente. Aqui você lança só os <strong>outros custos do mês</strong>: facções, energia, aluguel…
          </p>
        </header>

        <section className="resumo-financeiro-grid" aria-label={`Resumo do ano ${ano}`}>
          <div className="card-financeiro-kpi faturamento">
            <span>Faturamento {ano}</span>
            <h3>{formatarMoeda(totalFaturamento)}</h3>
          </div>
          <div className="card-financeiro-kpi saidas">
            <span>Compras de Matéria-Prima</span>
            <h3>{formatarMoeda(totalGasto)}</h3>
          </div>
          <div className="card-financeiro-kpi lucro">
            <span>Lucro Líquido</span>
            <h3>{formatarMoeda(totalLucro)}</h3>
          </div>
          <div className="card-financeiro-kpi">
            <span>Margem Média</span>
            <h3>{margemMedia}%</h3>
          </div>
        </section>

        <div className="form-financeiro-card">
          <h2>
            <PlusCircle size={20} color="#2563eb" aria-hidden="true" />
            Outros custos do mês
          </h2>

          {registroDoMes && (
            <div className="banner-mes-apurado" role="status">
              <strong>{formatarMesAno(formFin.mes_ano)}:</strong>{' '}
              {formatarMoeda(registroDoMes.faturamento_receita)} em entregas ({registroDoMes.qtd_pedidos_entregues}) ·{' '}
              {formatarMoeda(registroDoMes.valor_gasto_materiais)} em notas fiscais ({registroDoMes.qtd_entradas}) ·{' '}
              lucro {formatarMoeda(registroDoMes.lucro_liquido)}
            </div>
          )}

          <form onSubmit={handleSalvar}>
            <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1.2rem' }}>
              <div className="form-group">
                <label htmlFor="fin-mes">Mês de referência *</label>
                <input id="fin-mes" type="month" value={formFin.mes_ano} onChange={handleMesAnoChange} required />
              </div>
              <div className="form-group">
                <label htmlFor="fin-outros">Outros custos (facções, energia, aluguel…) R$</label>
                <input
                  id="fin-outros"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="Ex: 3500.00"
                  value={formFin.outros_custos_operacionais}
                  onChange={(e) => setFormFin({ ...formFin, outros_custos_operacionais: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.4rem' }}>
              <label htmlFor="fin-obs">Observações</label>
              <textarea
                id="fin-obs"
                rows="2"
                placeholder="Ex: Facção Maria R$ 2.000 + energia R$ 1.500"
                value={formFin.observacoes}
                onChange={(e) => setFormFin({ ...formFin, observacoes: e.target.value })}
              />
            </div>

            <button type="submit" className="btn-acao-rapida" disabled={salvando}>
              <CheckCircle size={18} aria-hidden="true" />
              <span>{salvando ? 'Salvando…' : 'Salvar outros custos'}</span>
            </button>
          </form>
        </div>

        <div className="tabela-financeiro-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.4rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Mês a mês — {ano}</h2>
              <label htmlFor="fin-ano" className="seletor-ano-label">
                Ano:{' '}
                <select id="fin-ano" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
                  {[anoCorrente - 2, anoCorrente - 1, anoCorrente].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="button" className="btn-exportar-pdf" onClick={handleExportarPDF} title={`Exportar o financeiro de ${ano} em PDF`}>
              <Printer size={16} aria-hidden="true" />
              <span>Exportar em PDF</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="tabela-fin">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th>Origem</th>
                  <th>Matéria-Prima (Notas)</th>
                  <th>Faturamento (Entregas)</th>
                  <th>Outros Custos</th>
                  <th>Lucro Líquido</th>
                  <th>Margem</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {carregando && registros.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Carregando…</td></tr>
                ) : registros.map((reg) => (
                  <tr key={reg.mes_ano}>
                    <td><strong>{formatarMesAno(reg.mes_ano)}</strong></td>
                    <td>
                      <span className={`origem-tag ${reg.qtd_pedidos_entregues + reg.qtd_entradas > 0 ? '' : 'vazio'}`}>
                        {descreverOrigem(reg)}
                      </span>
                    </td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>{formatarMoeda(reg.valor_gasto_materiais)}</td>
                    <td style={{ color: '#2563eb', fontWeight: 700 }}>{formatarMoeda(reg.faturamento_receita)}</td>
                    <td>{formatarMoeda(reg.outros_custos_operacionais)}</td>
                    <td style={{ color: '#059669', fontWeight: 800 }}>{formatarMoeda(reg.lucro_liquido)}</td>
                    <td><span className="margem-lucro-tag">{margemPercentual(reg)}%</span></td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>{reg.observacoes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default RegistroFinanceiroCamisetas;
```

- [ ] **Step 2: Estilos novos**

Acrescentar ao final de `frontend-alfa/src/pages/RegistroFinanceiroCamisetas.css`:

```css
.banner-mes-apurado {
  margin-bottom: 1.2rem;
  padding: 0.85rem 1.1rem;
  border-radius: 10px;
  border: 1px dashed var(--accent-artisan-sage-border);
  background: var(--accent-artisan-sage-bg);
  color: var(--accent-artisan-sage);
  font-size: 0.9rem;
  line-height: 1.5;
}

.origem-tag {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 800;
  background: var(--accent-artisan-sage-bg);
  color: var(--accent-artisan-sage);
}

.origem-tag.vazio {
  background: var(--bg-artisan-subtle);
  color: var(--color-text-subtle);
  font-weight: 600;
}

.seletor-ano-label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
```

- [ ] **Step 3: Verificar**

Run: `cd frontend-alfa && npm run build && npx oxlint src/pages/RegistroFinanceiroCamisetas.jsx && grep -n "sincronizar\|alert(" src/pages/RegistroFinanceiroCamisetas.jsx`
Expected: build ok; oxlint sem erros; `grep` sem resultados.

- [ ] **Step 4: Verificação manual**

Em `/camisetas/financeiro`: não existe botão "Sincronizar"; a tabela tem os 12 meses do ano; entregue um pedido na tela de Pedidos e volte → o mês corrente mostra "1 entrega(s)" e o faturamento; lance R$ 500 de outros custos → o lucro do mês cai R$ 500; troque o ano no seletor; "Exportar em PDF" abre a impressão.

- [ ] **Step 5: Commit**

```bash
git add frontend-alfa/src/pages/RegistroFinanceiroCamisetas.jsx frontend-alfa/src/pages/RegistroFinanceiroCamisetas.css
git commit -m "feat: tela financeira com valores calculados e lançamento só de outros custos" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Dashboard sem números de demonstração, menu na ordem do processo e remoção de código morto

**Files:**
- Modify: `frontend-alfa/src/pages/DashboardCamisetas.jsx` + `.css`
- Modify: `frontend-alfa/src/components/Sidebar.jsx` (bloco do menu de Camisetas)
- Delete: `frontend-alfa/src/pages/EnfestoCorteCamisetas.jsx`, `EnfestoCorteCamisetas.css`, `CosturaCamisetas.jsx`, `CosturaCamisetas.css`

**Interfaces:**
- Consumes: `tecido_maior_rendimento`/`rendimento_medio_tecido` nulos sem dados (Task 9); `useToast` (Task 10).

- [ ] **Step 1: Dashboard**

Em `frontend-alfa/src/pages/DashboardCamisetas.jsx`:

1. Acrescentar após `import api from '../services/api';`:

```jsx
import { useToast } from '../components/feedback/useToast';
```

2. Logo após `const navigate = useNavigate();`, acrescentar `const toast = useToast();` e, no `useState` inicial de `metricas`, trocar `tecido_maior_rendimento: 'Meia Malha 30.1',` por `tecido_maior_rendimento: null,` e `rendimento_medio_tecido: 5.60` por `rendimento_medio_tecido: null`.

3. Em `carregarDashboard`, substituir tudo entre `} catch (err) {` e `} finally {` (o `console.warn` e o `setMetricas({...})` com 1420 peças e 12 meses fictícios), mantendo as duas linhas-limite, de modo que fique:

```jsx
    } catch (err) {
      console.error('Erro ao buscar métricas do dashboard:', err);
      toast.erro('Não foi possível carregar o dashboard. Verifique a conexão e clique em atualizar.');
    } finally {
```

4. Trocar o conteúdo do Card 3:

```jsx
            <div className="card-destaque-valor" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
              {metricas.cards.tecido_maior_rendimento || 'Meia Malha 30.1'}
            </div>
            <div className="card-destaque-subtexto">
              Rendimento Real Apurado: <strong>{Number(metricas.cards.rendimento_medio_tecido || 5.6).toFixed(2)} peças / kg</strong>
            </div>
```

por:

```jsx
            <div className="card-destaque-valor" style={{ fontSize: '1.45rem', fontWeight: 800 }}>
              {metricas.cards.tecido_maior_rendimento || '—'}
            </div>
            <div className="card-destaque-subtexto">
              {metricas.cards.rendimento_medio_tecido != null ? (
                <>Rendimento Real Apurado: <strong>{Number(metricas.cards.rendimento_medio_tecido).toFixed(2)} peças / kg</strong></>
              ) : (
                'Nenhum corte registrado ainda'
              )}
            </div>
```

5. Logo após a declaração de `dadosGraficoFormatados` (que termina em `.sort((a, b) => a.mes_idx - b.mes_idx);`), acrescentar:

```jsx
  const graficoSemMovimento = dadosGraficoFormatados.every(
    (m) => m.faturamento === 0 && m.materiais_gastos === 0
  );
```

e, imediatamente antes de `<div className="grafico-wrapper">`, acrescentar:

```jsx
          {graficoSemMovimento && (
            <p className="grafico-vazio-aviso">
              Ainda não há entregas nem notas fiscais registradas neste ano. O gráfico se preenche sozinho conforme você usa o sistema.
            </p>
          )}
```

6. Trocar o título `Gráfico de Barras Financeiro (Últimos 12 Meses)` por `Gráfico de Barras Financeiro (Ano Atual)`.

7. Acrescentar ao final de `DashboardCamisetas.css`:

```css
.grafico-vazio-aviso {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px dashed var(--border-artisan-strong);
  background: var(--bg-artisan-subtle);
  color: var(--color-text-muted);
  font-size: 0.9rem;
}
```

- [ ] **Step 2: Menu na ordem do processo**

Em `frontend-alfa/src/components/Sidebar.jsx`, substituir todo o fragmento do ramo `isCamisetas ? ( <> ... </> )` (os 7 botões, de `1. Dashboard Geral` a `7. Costura & Facções`) por:

```jsx
          <>
            <button
              className={`nav-item ${isActive('/dashboard') || isActive('/camisetas/dashboard') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/dashboard')}
            >
              <LayoutDashboard size={19} />
              <span>1. Dashboard Geral</span>
            </button>
            <button
              className={`nav-item ${isActive('/comercial') || isActive('/camisetas/pedidos') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/pedidos')}
            >
              <ShoppingCart size={19} />
              <span>2. Pedidos do Cliente</span>
            </button>
            <button
              className={`nav-item ${isActive('/ficha-tecnica') || isActive('/camisetas/ficha-tecnica') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/ficha-tecnica')}
            >
              <FileText size={19} />
              <span>3. Ficha Técnica Digital</span>
            </button>
            <button
              className={`nav-item ${isActive('/estoque') || isActive('/camisetas/estoque') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/estoque')}
            >
              <Package size={19} />
              <span>4. Estoque de Insumos</span>
            </button>
            <button
              className={`nav-item ${isActive('/corte-rendimento') || isActive('/camisetas/corte-rendimento') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/corte-rendimento')}
            >
              <Layers size={19} />
              <span>5. Corte & Rendimento</span>
            </button>
            <button
              className={`nav-item ${isActive('/costura') || isActive('/camisetas/costura-faccoes') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/costura-faccoes')}
            >
              <Scissors size={19} />
              <span>6. Costura & Facções</span>
            </button>
            <button
              className={`nav-item ${isActive('/financeiro') || isActive('/camisetas/financeiro') ? 'active' : ''}`}
              onClick={() => irPara('/camisetas/financeiro')}
            >
              <DollarSign size={19} />
              <span>7. Registro Financeiro</span>
            </button>
          </>
```

- [ ] **Step 3: Remover telas mortas**

Run: `cd frontend-alfa && grep -rn "EnfestoCorteCamisetas\|CosturaCamisetas'" src --include=*.jsx | grep -v "^src/pages/EnfestoCorteCamisetas.jsx\|^src/pages/CosturaCamisetas.jsx"`
Expected: nenhum resultado (ninguém importa essas telas).

Run: `git rm -q src/pages/EnfestoCorteCamisetas.jsx src/pages/EnfestoCorteCamisetas.css src/pages/CosturaCamisetas.jsx src/pages/CosturaCamisetas.css`

- [ ] **Step 4: Verificar**

Run: `cd frontend-alfa && npm run build && npx oxlint && grep -rn "alert(\|window.confirm(" src/pages/*Camisetas*.jsx`
Expected: build ok; oxlint sem erros; nenhum `alert(`/`window.confirm(` nas telas de Camisetas.

- [ ] **Step 5: Verificação manual**

Com `dev.db` recém-criado **sem** seed: o Dashboard mostra 0 peças, "—" e "Nenhum corte registrado ainda", e o aviso de gráfico sem movimento. Pare o backend e recarregue: aparece aviso de erro (não números inventados). O menu segue: Dashboard · Pedidos · Ficha · Estoque · Corte · Costura · Financeiro.

- [ ] **Step 6: Commit**

```bash
git add -A frontend-alfa/src/pages frontend-alfa/src/components/Sidebar.jsx
git commit -m "fix: dashboard sem dados de demonstração, menu na ordem do processo e remoção de telas mortas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Banco de produção no Alembic e remoção do `create_all` (⚠️ checkpoint com o usuário)

> Esta tarefa precisa de acesso ao banco de produção e ao painel do Render. **Não execute os passos 1–3 sozinho**: apresente-os ao usuário e execute junto com ele (ou ele executa). O passo 4 (código) pode ser feito antes, mas só vai para produção depois dos passos 1–3.

**Files:**
- Modify: `backend/app/main.py:5-8`
- Test: `backend/tests/test_infra.py`

- [ ] **Step 1: (usuário) Verificar se o banco de produção já usa Alembic**

No console SQL do provedor: `SELECT version_num FROM alembic_version;`
- Retorna `20261022_002_camisetas` → seguir para o passo 2.
- Tabela não existe (banco criado pelo `create_all`) → rodar, de dentro de `backend/`, com a URL de produção **só no ambiente deste comando**:
  `DATABASE_URL='<url-de-producao>' venv/bin/python -m alembic stamp 20261022_002_camisetas`

- [ ] **Step 2: (usuário) Conferir que o banco bate com os modelos e aplicar as migrações novas**

```bash
DATABASE_URL='<url-de-producao>' venv/bin/python -m alembic upgrade head
DATABASE_URL='<url-de-producao>' venv/bin/python -m alembic check
```

Expected: `upgrade` aplica `20261110_003_sequencias` e `20261110_004_data_entrega`; `check` responde "No new upgrade operations detected." Se `check` apontar diferenças, PARE e analise antes de seguir (não gere migração destrutiva).

- [ ] **Step 3: (usuário) Comando de início no Render**

No serviço do backend no Render, trocar o Start Command para:

```
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

- [ ] **Step 4: Teste que falha + remoção do `create_all`**

Acrescentar a `backend/tests/test_infra.py`:

```python
from pathlib import Path


def test_main_nao_cria_tabelas_por_fora_do_alembic():
    codigo = (Path(__file__).resolve().parents[1] / "app" / "main.py").read_text(encoding="utf-8")
    assert "create_all" not in codigo
```

Run: `cd backend && venv/bin/python -m pytest tests/test_infra.py -v` → Expected: FAIL no teste novo.

Em `backend/app/main.py`, trocar:

```python
from app.routers import estoque, ficha_tecnica, producao, costura, comercial, equipe, auth, usuarios, camisetas
from app.models import camisetas as camisetas_models
from app.database import engine, Base

# Comando para criar as tabelas no PostgreSQL (caso ainda não existam)
Base.metadata.create_all(bind=engine)
```

por:

```python
from app.routers import estoque, ficha_tecnica, producao, costura, comercial, equipe, auth, usuarios, camisetas

# As tabelas são criadas e alteradas somente pelas migrações do Alembic
# (o Start Command roda "alembic upgrade head" antes de subir a API).
```

Run: `cd backend && venv/bin/python -m pytest -v` → Expected: todos passam.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_infra.py
git commit -m "chore: esquema do banco passa a ser controlado só pelo Alembic" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Verificação final e documentação dos testes

**Files:**
- Modify: `README.md` (seção de testes)

- [ ] **Step 1: Cobertura**

Run: `cd backend && venv/bin/python -m pytest --cov=app/services --cov-report=term-missing`
Expected: todos passam e `TOTAL` ≥ 80%. Se ficar abaixo, acrescente testes para as linhas listadas em "Missing" antes de seguir.

- [ ] **Step 2: Frontend completo**

Run: `cd frontend-alfa && npm run build && npx oxlint`
Expected: build ok, zero erros.

- [ ] **Step 3: Critérios de aceite da spec**

Percorrer a seção 8 de `docs/superpowers/specs/2026-11-10-fase0-fundacao-design.md` com o Roteiro de verificação local e marcar cada item. Rodar também:

Run: `cd frontend-alfa && grep -rn "alert(\|window.confirm(\|sincronizar" src/pages/*Camisetas*.jsx`
Expected: nenhum resultado.

- [ ] **Step 4: Documentar como rodar os testes**

No `README.md`, logo antes da seção `## 🔄 Integrações e Regras de Negócio`, acrescentar:

````markdown
## 🧪 Testes do Backend

Os testes usam um banco SQLite em memória — nunca o banco de produção.

```bash
cd backend
venv/bin/python -m pip install -r requirements-dev.txt   # Windows: venv\Scripts\python -m pip ...
venv/bin/python -m pytest                                 # roda todos os testes
venv/bin/python -m pytest --cov=app/services              # com cobertura das regras de negócio
```

Para rodar a API localmente sem tocar na produção:

```bash
DATABASE_URL=sqlite:///./dev.db venv/bin/python -m alembic upgrade head
DATABASE_URL=sqlite:///./dev.db venv/bin/python -m uvicorn app.main:app --reload
```

---
````

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: como rodar os testes e a API local sem tocar na produção" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
