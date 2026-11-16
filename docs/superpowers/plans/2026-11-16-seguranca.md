# Segurança — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nenhuma rota de negócio responde sem token válido; o segredo que assina os tokens sai do código e vem do ambiente; as portas que permitiam criar usuário e repovoar o banco deixam de ser públicas; e o frontend manda para o login quem não está autenticado.

**Architecture:** Uma dependência única (`app/core/auth.py::usuario_atual`) aplicada no `include_router` de cada módulo de negócio — assim nenhuma rota, nem as futuras daquele módulo, escapa. A configuração sai de `app/core/config.py`, que lê o ambiente e recusa subir em produção sem `SECRET_KEY`. No frontend, um componente de guarda cobre as rotas internas e um interceptor de resposta derruba para o login quando a sessão expira.

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, PyJWT, passlib/bcrypt, pytest; React 19 + Vite 8, react-router-dom, axios, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-16-seguranca-design.md`

## Global Constraints

- Trabalhar no branch `feat/camisetas-seguranca`, criado a partir de `feat/camisetas-estoque-sku`. Nunca commitar na `main`. Não fazer push.
- Mensagens de commit `<tipo>: <descrição>` com um segundo `-m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- **Nunca rodar nada contra o banco de produção.** Testes usam SQLite em memória (`tests/conftest.py`); execução local usa `DATABASE_URL=sqlite:///./dev.db`.
- Comandos de backend dentro de `backend/` com `venv/bin/python -m ...`.
- **Não mexer no versionamento do `.env`** nem em segredos do repositório: decisão do usuário, fora desta fase. O código apenas passa a *ler* do ambiente.
- Nenhuma migração nova: esta fase não altera o esquema do banco.
- Erros: 401 para quem não provou quem é · 403 para quem provou mas não pode · 404 não encontrado · 422 formato. Mensagens em português claro.
- Frontend: `npm run build` sem erros e `npx oxlint` sem **erros**; avisos e confirmações por `useToast`/`useConfirm` (nunca `alert`/`confirm`); sem `console.log`.
- Cobertura ≥ 80% em `app/services/`. Arquivos-fonte abaixo de 800 linhas.
- Moda Íntima congelada: não alterar a lógica dela, mas suas rotas **entram** na proteção junto com as demais.

### Roteiro de verificação local

```bash
cd backend && DATABASE_URL=sqlite:///./dev.db venv/bin/python -m uvicorn app.main:app --port 8001   # terminal 1
cd frontend-alfa && npm run dev -- --port 5173 --strictPort                                          # terminal 2
# Navegador automatizado: node ~/.claude/skills/browser-automation/browser.mjs <url> --script <arquivo.mjs>
```

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `backend/app/core/config.py` | lê o ambiente: `SECRET_KEY`, duração da sessão, `AMBIENTE`, credenciais do bootstrap |
| `backend/app/core/security.py` | passa a usar a config; deixa de ter segredo escrito no código |
| `backend/app/core/auth.py` (novo) | `usuario_atual`: a porta |
| `backend/app/core/bootstrap.py` (novo) | cria a primeira conta a partir do ambiente, no boot |
| `backend/app/main.py` | aplica a porta em cada módulo e chama o bootstrap |
| `backend/app/routers/usuarios.py` | `/usuarios/eu`, edição só de si mesmo |
| `backend/app/routers/camisetas/seed.py` | seed recusado em produção |
| `backend/tests/conftest.py` | `client` passa a vir autenticado; nasce `client_sem_login` |
| `frontend-alfa/src/components/auth/RotaProtegida.jsx` (novo) | guarda das rotas internas |
| `frontend-alfa/src/services/api.js` | interceptor de 401 |
| `frontend-alfa/src/pages/Login.jsx` | guarda o usuário logado e avisa sessão expirada |
| `frontend-alfa/src/pages/Cadastro.jsx` | vira "novo usuário" interno, com toast no lugar de `alert` |
| `frontend-alfa/src/pages/PerfilUsuario.jsx` | usa o usuário autenticado em vez do id fixo 1 |

---

### Task 1: Configuração — segredo e ambiente fora do código

**Files:**
- Modify: `backend/app/core/config.py`, `backend/app/core/security.py`
- Test: `backend/tests/test_config.py` (novo)

**Interfaces:**
- Produces: em `app.core.config` — `AMBIENTE: str`, `EM_PRODUCAO: bool`, `ALGORITMO_TOKEN: str`, `MINUTOS_DE_SESSAO: int`, `ADMIN_LOGIN: str | None`, `ADMIN_SENHA: str | None`, `ler_secret_key() -> str`, `SECRET_KEY: str`.

- [ ] **Step 1: Escrever o teste que falha**

`backend/tests/test_config.py`:

```python
import pytest

from app.core import config


def test_em_desenvolvimento_a_chave_e_gerada_quando_nao_ha_variavel(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setattr(config, "EM_PRODUCAO", False)
    chave = config.ler_secret_key()
    assert len(chave) >= 32
    assert chave != config.ler_secret_key()  # cada subida gera a sua


def test_em_producao_sem_chave_a_aplicacao_nao_sobe(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setattr(config, "EM_PRODUCAO", True)
    with pytest.raises(RuntimeError) as erro:
        config.ler_secret_key()
    assert "SECRET_KEY" in str(erro.value)


def test_a_variavel_de_ambiente_tem_prioridade(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "chave-do-ambiente")
    monkeypatch.setattr(config, "EM_PRODUCAO", True)
    assert config.ler_secret_key() == "chave-do-ambiente"


def test_sessao_padrao_de_doze_horas():
    assert config.MINUTOS_DE_SESSAO == 720


def test_o_segredo_nao_esta_mais_escrito_no_codigo():
    from pathlib import Path
    fonte = Path(config.__file__).parent / "security.py"
    assert "sua_chave_secreta_super_segura_aqui" not in fonte.read_text(encoding="utf-8")
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_config.py -q`
Expected: FAIL — `config` não tem `ler_secret_key`, `EM_PRODUCAO` nem `MINUTOS_DE_SESSAO`.

- [ ] **Step 3: Implementar a configuração**

`backend/app/core/config.py` (substitui o arquivo):

```python
# app/core/config.py
"""Constantes de configuração e leitura do ambiente."""
import os
import secrets
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv()

# Fuso do negócio: define "hoje" e os limites de cada mês no financeiro.
FUSO_HORARIO = ZoneInfo("America/Fortaleza")

AMBIENTE = os.getenv("AMBIENTE", "desenvolvimento").strip().lower()
EM_PRODUCAO = AMBIENTE == "producao"

ALGORITMO_TOKEN = "HS256"
MINUTOS_DE_SESSAO = int(os.getenv("MINUTOS_DE_SESSAO", "720"))  # 12 h: uma jornada de trabalho

# Usadas só no primeiro boot, para criar a conta inicial.
ADMIN_LOGIN = os.getenv("ADMIN_LOGIN")
ADMIN_SENHA = os.getenv("ADMIN_SENHA")


def ler_secret_key() -> str:
    """Segredo que assina os tokens.

    Em produção é obrigatório: sem ele a aplicação não sobe, em vez de assinar tokens com uma chave
    que qualquer um conhece. Em desenvolvimento, gera uma por subida — os tokens morrem no restart,
    o que é aceitável para quem está programando.
    """
    chave = os.getenv("SECRET_KEY")
    if chave:
        return chave
    if EM_PRODUCAO:
        raise RuntimeError(
            "SECRET_KEY não definida. Em produção ela é obrigatória: defina a variável de ambiente "
            "antes de subir a aplicação."
        )
    return secrets.token_urlsafe(32)


SECRET_KEY = ler_secret_key()
```

`backend/app/core/security.py` (substitui o arquivo):

```python
# app/core/security.py
"""Hash de senha e emissão do token de acesso."""
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext

from app.core import config

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verificar_senha(senha_texto_puro, senha_criptografada):
    """Compara a senha digitada com o hash do banco de dados."""
    return pwd_context.verify(senha_texto_puro, senha_criptografada)


def obter_hash_senha(senha):
    """Criptografa a senha antes de salvar no banco."""
    return pwd_context.hash(senha)


def criar_token_acesso(dados: dict):
    """Gera o token JWT do usuário logado, válido pelo tempo configurado."""
    copia_dados = dados.copy()
    copia_dados["exp"] = datetime.now(timezone.utc) + timedelta(minutes=config.MINUTOS_DE_SESSAO)
    return jwt.encode(copia_dados, config.SECRET_KEY, algorithm=config.ALGORITMO_TOKEN)
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_config.py -q`
Expected: PASS.

Run: `cd backend && venv/bin/python -m pytest -q`
Expected: toda a suíte continua passando (nenhuma rota foi protegida ainda).

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/config.py backend/app/core/security.py backend/tests/test_config.py
git commit -m "feat: segredo e duração da sessão vindos do ambiente" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: A porta — dependência `usuario_atual`

**Files:**
- Create: `backend/app/core/auth.py`
- Test: `backend/tests/test_auth.py` (novo)

**Interfaces:**
- Consumes: `config.SECRET_KEY`, `config.ALGORITMO_TOKEN` (Task 1); `security.criar_token_acesso`; `app.models.usuarios.Usuario`; `app.database.get_db`.
- Produces: `app.core.auth.usuario_atual(token, db) -> Usuario` (dependência do FastAPI) e `app.core.auth.recusar() -> HTTPException`.

- [ ] **Step 1: Escrever o teste que falha**

`backend/tests/test_auth.py`:

```python
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import HTTPException

from app.core import config
from app.core.auth import usuario_atual
from app.core.security import criar_token_acesso, obter_hash_senha
from app.models.usuarios import Usuario


def criar_usuario(db, login="ana", ativo=True):
    usuario = Usuario(
        login=login, senha_hash=obter_hash_senha("segredo123"), nome_usuario="Ana", perfil="Gestor", ativo=ativo,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def test_token_valido_devolve_o_usuario(db):
    usuario = criar_usuario(db)
    token = criar_token_acesso({"sub": usuario.login})
    assert usuario_atual(token=token, db=db).id_usuario == usuario.id_usuario


def test_sem_token_recusa(db):
    with pytest.raises(HTTPException) as erro:
        usuario_atual(token=None, db=db)
    assert erro.value.status_code == 401
    assert erro.value.headers["WWW-Authenticate"] == "Bearer"


def test_token_assinado_com_outra_chave_recusa(db):
    criar_usuario(db)
    token = jwt.encode({"sub": "ana"}, "outra-chave", algorithm=config.ALGORITMO_TOKEN)
    with pytest.raises(HTTPException) as erro:
        usuario_atual(token=token, db=db)
    assert erro.value.status_code == 401


def test_token_expirado_recusa(db):
    criar_usuario(db)
    vencido = {"sub": "ana", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}
    token = jwt.encode(vencido, config.SECRET_KEY, algorithm=config.ALGORITMO_TOKEN)
    with pytest.raises(HTTPException) as erro:
        usuario_atual(token=token, db=db)
    assert erro.value.status_code == 401


def test_usuario_apagado_recusa(db):
    token = criar_token_acesso({"sub": "fantasma"})
    with pytest.raises(HTTPException) as erro:
        usuario_atual(token=token, db=db)
    assert erro.value.status_code == 401


def test_usuario_inativo_recusa_com_401(db):
    """401 de propósito: de fora não se distingue 'inativo' de 'inválido', e não vale dar a dica."""
    usuario = criar_usuario(db, login="demitido", ativo=False)
    token = criar_token_acesso({"sub": usuario.login})
    with pytest.raises(HTTPException) as erro:
        usuario_atual(token=token, db=db)
    assert erro.value.status_code == 401
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_auth.py -q`
Expected: FAIL — `ModuleNotFoundError: app.core.auth`.

- [ ] **Step 3: Implementar a porta**

`backend/app/core/auth.py`:

```python
# app/core/auth.py
"""A porta: toda rota de negócio passa por aqui antes de responder."""
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core import config
from app.database import get_db
from app.models.usuarios import Usuario

# auto_error=False: a recusa é montada aqui, em português e com o cabeçalho certo.
oauth2 = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


def recusar() -> HTTPException:
    """Mesma resposta para token ausente, inválido, expirado, de usuário apagado ou inativo."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Faça login para continuar.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def usuario_atual(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> Usuario:
    if not token:
        raise recusar()
    try:
        dados = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITMO_TOKEN])
    except jwt.PyJWTError:
        raise recusar() from None
    login = dados.get("sub")
    if not login:
        raise recusar()
    usuario = db.query(Usuario).filter(Usuario.login == login).first()
    if usuario is None or not usuario.ativo:
        raise recusar()
    return usuario
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_auth.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/auth.py backend/tests/test_auth.py
git commit -m "feat: dependência de autenticação" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Fechar todos os módulos e deixar a suíte verde

**Files:**
- Modify: `backend/app/main.py`, `backend/tests/conftest.py`
- Test: `backend/tests/test_rotas_protegidas.py` (novo)

**Interfaces:**
- Consumes: `usuario_atual` (Task 2).
- Produces: fixture `client` **já autenticado** (é o que os 16 arquivos de teste existentes usam, sem precisar de alteração) e fixture `client_sem_login` para conferir a recusa.

> **Decisão que muda o que a spec previa:** a spec falava num fixture novo `cliente_autenticado` e em alterar os testes existentes. É mais limpo manter o nome `client` e fazê-lo autenticado: nenhum dos 16 arquivos precisa mudar, e a mudança fica num lugar só. O fixture `client_sem_login` cobre o outro lado.

- [ ] **Step 1: Escrever o teste que falha**

`backend/tests/test_rotas_protegidas.py`:

```python
import pytest

# Uma rota de cada módulo: se a porta falhar em algum, o teste aponta qual.
ROTAS = [
    # Camisetas (o segmento ativo)
    ("GET", "/camisetas/produtos-prontos/"),
    ("GET", "/camisetas/pedidos/"),
    ("GET", "/camisetas/ordens/"),
    ("GET", "/camisetas/costura/"),
    ("GET", "/camisetas/dashboard/"),
    ("GET", "/camisetas/clientes/"),
    # Moda Íntima e módulos originais — congelados, mas a porta vale para eles também.
    # Prefixos conferidos no código: ficha_tecnica usa /produtos, não /ficha-tecnica.
    ("GET", "/estoque/insumos"),
    ("GET", "/produtos/"),
    ("GET", "/producao/ordens"),
    ("GET", "/costura/movimentacoes"),
    ("GET", "/comercial/pedidos"),
    ("GET", "/equipe/colaboradores"),
    # Conta: /usuarios/eu só nasce na Task 4; aqui vale qualquer rota do módulo.
    ("GET", "/usuarios/1"),
]


@pytest.mark.parametrize("metodo, caminho", ROTAS)
def test_sem_token_a_rota_recusa(client_sem_login, metodo, caminho):
    resposta = client_sem_login.request(metodo, caminho)
    assert resposta.status_code == 401, f"{metodo} {caminho} respondeu {resposta.status_code}"
    assert resposta.json()["detail"] == "Faça login para continuar."


@pytest.mark.parametrize("metodo, caminho", ROTAS)
def test_com_token_a_rota_deixa_passar(client, metodo, caminho):
    resposta = client.request(metodo, caminho)
    assert resposta.status_code != 401, f"{metodo} {caminho} recusou um token válido"


def test_token_invalido_recusa(client_sem_login):
    resposta = client_sem_login.get(
        "/camisetas/produtos-prontos/", headers={"Authorization": "Bearer nao-e-um-token"})
    assert resposta.status_code == 401


def test_a_saude_e_o_login_continuam_abertos(client_sem_login):
    assert client_sem_login.get("/").status_code == 200
    # senha errada: 401 do próprio login, não da porta
    assert client_sem_login.post("/login", data={"username": "ninguem", "password": "x"}).status_code == 401
```

> Os caminhos acima foram conferidos no esquema OpenAPI desta versão do projeto. **Atenção:** o
> FastAPI 0.143 guarda os routers incluídos como `_IncludedRouter`, então `app.routes` mostra só a
> rota raiz — para listar rotas, use `app.openapi()["paths"]`, como já faz `test_rotas_camisetas.py`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_rotas_protegidas.py -q`
Expected: FAIL — não existe `client_sem_login`, e as rotas respondem 200 sem token.

- [ ] **Step 3: Aplicar a porta em `main.py`**

Em `backend/app/main.py`, trocar o bloco de `include_router` por:

```python
from fastapi import Depends
from app.core.auth import usuario_atual

# /login fica aberto: é por ele que se entra.
app.include_router(auth.router)

# Todo o resto exige token. Protegendo no include_router, nenhuma rota do módulo escapa —
# nem as que forem criadas depois.
for _modulo in (usuarios, estoque, ficha_tecnica, comercial, producao, costura, equipe, camisetas):
    app.include_router(_modulo.router, dependencies=[Depends(usuario_atual)])
```

- [ ] **Step 4: Deixar o `client` autenticado**

Em `backend/tests/conftest.py`, acrescentar aos imports e substituir o fixture `client`:

```python
from app.core.security import criar_token_acesso, obter_hash_senha  # noqa: E402
from app.models.usuarios import Usuario  # noqa: E402


@pytest.fixture()
def usuario_teste(db):
    usuario = Usuario(
        login="qa", senha_hash=obter_hash_senha("qa123456"), nome_usuario="Usuário de Teste",
        perfil="Gestor", ativo=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def _com_banco_de_teste(db):
    def _get_db_teste():
        yield db
    app.dependency_overrides[get_db] = _get_db_teste


@pytest.fixture()
def client(db, usuario_teste):
    """Cliente já autenticado: é o que os testes de API usam."""
    _com_banco_de_teste(db)
    with TestClient(app) as cliente:
        cliente.headers["Authorization"] = f"Bearer {criar_token_acesso({'sub': usuario_teste.login})}"
        yield cliente
    app.dependency_overrides.clear()


@pytest.fixture()
def client_sem_login(db):
    """Cliente sem token, para conferir que a porta recusa."""
    _com_banco_de_teste(db)
    with TestClient(app) as cliente:
        yield cliente
    app.dependency_overrides.clear()
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_rotas_protegidas.py -q`
Expected: PASS.

Run: `cd backend && venv/bin/python -m pytest -q`
Expected: **toda a suíte passa sem tocar nos 16 arquivos de teste**, porque o `client` que eles já usam agora chega autenticado. Se algum teste falhar com 401, é porque usa um cliente próprio — ajuste aquele teste.

- [ ] **Step 6: Commit**

```bash
git add backend/app/main.py backend/tests/conftest.py backend/tests/test_rotas_protegidas.py
git commit -m "feat: todas as rotas de negócio exigem token" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Usuários — quem sou eu, e edição só de si mesmo

**Files:**
- Modify: `backend/app/routers/usuarios.py`
- Test: `backend/tests/test_usuarios.py` (novo)

**Interfaces:**
- Consumes: `usuario_atual` (Task 2).
- Produces: `GET /usuarios/eu` devolvendo `UsuarioResponse` do autenticado; `PUT /usuarios/{id}` restrito ao próprio usuário (403 para outro); `POST /usuarios/` exigindo token (já coberto pela Task 3).

- [ ] **Step 1: Escrever o teste que falha**

`backend/tests/test_usuarios.py`:

```python
from app.core.security import obter_hash_senha
from app.models.usuarios import Usuario


def outro_usuario(db):
    usuario = Usuario(
        login="bruno", senha_hash=obter_hash_senha("outra123"), nome_usuario="Bruno",
        perfil="Operador", ativo=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def test_eu_devolve_o_usuario_do_token(client, usuario_teste):
    corpo = client.get("/usuarios/eu").json()
    assert corpo["login"] == usuario_teste.login
    assert corpo["id_usuario"] == usuario_teste.id_usuario
    assert "senha" not in corpo and "senha_hash" not in corpo


def test_usuario_logado_cadastra_colega(client):
    resposta = client.post("/usuarios/", json={
        "login": "carla", "nome_usuario": "Carla", "perfil": "Operador", "senha": "carla123",
    })
    assert resposta.status_code == 201
    assert resposta.json()["login"] == "carla"


def test_login_repetido_retorna_400(client, usuario_teste):
    resposta = client.post("/usuarios/", json={
        "login": usuario_teste.login, "nome_usuario": "Xará", "senha": "outra123",
    })
    assert resposta.status_code == 400


def test_editar_o_proprio_perfil_funciona(client, usuario_teste):
    resposta = client.put(f"/usuarios/{usuario_teste.id_usuario}", json={"nome_usuario": "Nome Novo"})
    assert resposta.status_code == 200
    assert resposta.json()["nome_usuario"] == "Nome Novo"


def test_editar_o_perfil_de_outro_retorna_403(client, db):
    alvo = outro_usuario(db)
    resposta = client.put(f"/usuarios/{alvo.id_usuario}", json={"senha": "invadida123"})
    assert resposta.status_code == 403
    assert "própria conta" in resposta.json()["detail"]


def test_ver_o_perfil_de_outro_retorna_403(client, db):
    alvo = outro_usuario(db)
    assert client.get(f"/usuarios/{alvo.id_usuario}").status_code == 403
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_usuarios.py -q`
Expected: FAIL — `/usuarios/eu` responde 422 (o FastAPI tenta ler "eu" como `id_usuario`) e a edição de outro usuário passa.

- [ ] **Step 3: Implementar**

Em `backend/app/routers/usuarios.py`:

1. Acrescentar aos imports: `from app.core.auth import usuario_atual` e `from app.models.usuarios import Usuario`.
2. **Declarar `/eu` antes de `/{id_usuario}`** — o FastAPI casa as rotas na ordem em que foram registradas; se `/{id_usuario}` vier primeiro, "eu" é lido como id e vira 422.

```python
@router.get("/eu", response_model=schemas.UsuarioResponse)
def obter_usuario_logado(eu: Usuario = Depends(usuario_atual)):
    """Quem está com este token na mão. É assim que o frontend descobre o usuário da sessão."""
    return eu


def _exigir_que_seja_voce(id_usuario: int, eu: Usuario) -> None:
    """Acesso é igual para dados do negócio, mas conta é pessoal: ninguém mexe na do outro."""
    if id_usuario != eu.id_usuario:
        raise HTTPException(status_code=403, detail="Você só pode ver e alterar a sua própria conta.")
```

3. Em `atualizar_perfil` e `obter_perfil_usuario`, acrescentar o parâmetro `eu: Usuario = Depends(usuario_atual)` e chamar `_exigir_que_seja_voce(id_usuario, eu)` como primeira linha.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_usuarios.py -q && venv/bin/python -m pytest -q`
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/usuarios.py backend/tests/test_usuarios.py
git commit -m "feat: rota do usuário logado e conta pessoal protegida" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: A primeira conta nasce do ambiente

**Files:**
- Create: `backend/app/core/bootstrap.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_bootstrap.py` (novo)

**Interfaces:**
- Consumes: `config.ADMIN_LOGIN`, `config.ADMIN_SENHA` (Task 1); `security.obter_hash_senha`.
- Produces: `app.core.bootstrap.criar_primeiro_usuario(db, login, senha) -> Usuario | None` — devolve o usuário criado, ou `None` quando não havia o que fazer.

- [ ] **Step 1: Escrever o teste que falha**

`backend/tests/test_bootstrap.py`:

```python
from app.core.bootstrap import criar_primeiro_usuario
from app.core.security import obter_hash_senha, verificar_senha
from app.models.usuarios import Usuario


def test_cria_a_conta_quando_nao_ha_nenhuma(db):
    criado = criar_primeiro_usuario(db, "dona", "senhaforte1")
    assert criado is not None
    assert criado.login == "dona"
    assert criado.ativo is True
    assert verificar_senha("senhaforte1", criado.senha_hash)


def test_nao_faz_nada_quando_ja_existe_usuario(db):
    db.add(Usuario(login="ja_existo", senha_hash=obter_hash_senha("x123456"), nome_usuario="Alguém"))
    db.commit()
    assert criar_primeiro_usuario(db, "dona", "senhaforte1") is None
    assert db.query(Usuario).count() == 1


def test_nao_faz_nada_sem_as_variaveis(db):
    assert criar_primeiro_usuario(db, None, None) is None
    assert criar_primeiro_usuario(db, "dona", None) is None
    assert db.query(Usuario).count() == 0


def test_e_idempotente(db):
    primeiro = criar_primeiro_usuario(db, "dona", "senhaforte1")
    assert criar_primeiro_usuario(db, "dona", "senhaforte1") is None
    assert db.query(Usuario).count() == 1
    assert primeiro.login == "dona"
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_bootstrap.py -q`
Expected: FAIL — `ModuleNotFoundError: app.core.bootstrap`.

- [ ] **Step 3: Implementar**

`backend/app/core/bootstrap.py`:

```python
# app/core/bootstrap.py
"""Primeira conta do sistema, criada a partir do ambiente.

O Render no plano gratuito não dá shell, então não há como rodar um script para criar o primeiro
usuário. A conta nasce no boot, a partir de ADMIN_LOGIN e ADMIN_SENHA, e só quando ainda não existe
nenhum usuário — depois disso as variáveis podem ficar lá sem efeito nenhum.
"""
import logging
from typing import Optional

from sqlalchemy.orm import Session

from app.core.security import obter_hash_senha
from app.models.usuarios import Usuario

logger = logging.getLogger(__name__)


def criar_primeiro_usuario(db: Session, login: Optional[str], senha: Optional[str]) -> Optional[Usuario]:
    """Cria a conta inicial. Devolve None quando não havia o que fazer (já há usuário, ou faltam dados)."""
    if not login or not senha:
        return None
    if db.query(Usuario).first() is not None:
        return None
    usuario = Usuario(
        login=login.strip(), senha_hash=obter_hash_senha(senha), nome_usuario=login.strip(),
        perfil="Gestor", ativo=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    logger.warning("Primeira conta criada a partir do ambiente: %s", usuario.login)  # nunca a senha
    return usuario
```

Em `backend/app/main.py`, depois da criação do `app`:

```python
@app.on_event("startup")
def preparar_primeiro_acesso():
    from app.core import config
    from app.core.bootstrap import criar_primeiro_usuario
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        criar_primeiro_usuario(db, config.ADMIN_LOGIN, config.ADMIN_SENHA)
    finally:
        db.close()
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_bootstrap.py -q && venv/bin/python -m pytest -q`
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/bootstrap.py backend/app/main.py backend/tests/test_bootstrap.py
git commit -m "feat: primeira conta criada a partir do ambiente" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Seed recusado em produção

**Files:**
- Modify: `backend/app/routers/camisetas/seed.py`
- Test: `backend/tests/test_seed.py`

**Interfaces:**
- Consumes: `config.EM_PRODUCAO` (Task 1). A proteção por token já veio da Task 3.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar ao fim de `backend/tests/test_seed.py`:

```python
def test_seed_recusa_em_producao(client, monkeypatch):
    from app.routers.camisetas import seed as rotas_seed
    monkeypatch.setattr(rotas_seed.config, "EM_PRODUCAO", True)
    resposta = client.post("/camisetas/seed-inicial")
    assert resposta.status_code == 403
    assert "produção" in resposta.json()["detail"]


def test_seed_sem_token_recusa(client_sem_login):
    assert client_sem_login.post("/camisetas/seed-inicial").status_code == 401
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd backend && venv/bin/python -m pytest tests/test_seed.py -q`
Expected: FAIL — o seed responde 200 mesmo com `EM_PRODUCAO`.

- [ ] **Step 3: Implementar**

Em `backend/app/routers/camisetas/seed.py`, acrescentar `from app.core import config` aos imports e, como primeira linha do corpo de `seed_camisetas`:

```python
    if config.EM_PRODUCAO:
        raise HTTPException(
            status_code=403,
            detail="Dados de demonstração não entram em produção. Esta rota só funciona em desenvolvimento.",
        )
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd backend && venv/bin/python -m pytest tests/test_seed.py -q && venv/bin/python -m pytest -q`
Expected: PASS em tudo.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/camisetas/seed.py backend/tests/test_seed.py
git commit -m "feat: seed de demonstração recusado em produção" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Frontend — guarda de rota, sessão expirada e conta certa

**Files:**
- Create: `frontend-alfa/src/components/auth/RotaProtegida.jsx`
- Modify: `frontend-alfa/src/App.jsx`, `frontend-alfa/src/services/api.js`, `frontend-alfa/src/pages/Login.jsx`, `frontend-alfa/src/pages/Cadastro.jsx`, `frontend-alfa/src/pages/PerfilUsuario.jsx`

**Interfaces:**
- Consumes: `GET /usuarios/eu` (Task 4); o 401 padronizado (Tasks 2 e 3).
- Produces: `<RotaProtegida>{children}</RotaProtegida>`.

- [ ] **Step 1: A guarda**

`frontend-alfa/src/components/auth/RotaProtegida.jsx`:

```jsx
import { Navigate } from 'react-router-dom';

/** Sem token, não entra: manda para o login. Hoje dá para abrir /camisetas/... direto pela URL. */
export function RotaProtegida({ children }) {
  const token = localStorage.getItem('token_confeccao');
  return token ? children : <Navigate to="/" replace />;
}
```

Em `frontend-alfa/src/App.jsx`: importar `RotaProtegida` e envolver o elemento de **todas as rotas
menos `/`** (o login). O `/cadastro` entra na guarda junto, porque deixa de ser auto-cadastro público
e vira tela interna (Step 4).

```jsx
      <Route path="/selecao-segmento" element={<RotaProtegida><SelecaoSegmento /></RotaProtegida>} />
      <Route path="/cadastro" element={<RotaProtegida><Cadastro /></RotaProtegida>} />
      {/* … e assim por diante em cada rota, menos <Route path="/" element={<Login />} /> */}
```

- [ ] **Step 2: O interceptor de sessão expirada**

Em `frontend-alfa/src/services/api.js`, depois do interceptor de requisição que já existe:

```js
// Sessão expirada ou token inválido: limpa e volta ao login, em vez de deixar a tela vazia.
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const ehTentativaDeLogin = erro.config?.url?.includes('/login');
    if (erro.response?.status === 401 && !ehTentativaDeLogin) {
      localStorage.removeItem('token_confeccao');
      localStorage.removeItem('usuario_confeccao');
      if (window.location.pathname !== '/') {
        window.location.assign('/?sessao=expirada');
      }
    }
    return Promise.reject(erro);
  },
);
```

- [ ] **Step 3: Login guarda quem entrou e avisa a expiração**

Em `frontend-alfa/src/pages/Login.jsx`, depois de salvar o token e antes de navegar:

```jsx
      const { data: usuario } = await api.get('/usuarios/eu');
      localStorage.setItem('usuario_confeccao', JSON.stringify(usuario));
```

E, no topo do componente, avisar quem caiu por expiração:

```jsx
  const toast = useToast();
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('sessao') === 'expirada') {
      toast.aviso('Sua sessão expirou. Entre de novo.');
      window.history.replaceState({}, '', '/');
    }
  }, [toast]);
```

- [ ] **Step 4: `/cadastro` vira tela interna**

Em `frontend-alfa/src/pages/Cadastro.jsx`:
- título passa de "Criar nova conta" para "Cadastrar novo usuário";
- trocar o `alert('Cadastro realizado com sucesso!')` por `toast.sucesso(...)` (o projeto não usa `alert`);
- depois de salvar, `navigate('/configuracoes')` em vez de `navigate('/')` — quem cadastrou já estava logado e não deve ser jogado para fora;
- remover da tela o link "já tenho conta / entrar", se houver.

- [ ] **Step 5: O perfil para de editar o usuário nº 1**

Em `frontend-alfa/src/pages/PerfilUsuario.jsx`, trocar `const idUsuarioLogado = 1;` por estado alimentado pela API:

```jsx
  const [idUsuarioLogado, setIdUsuarioLogado] = useState(null);

  useEffect(() => {
    api.get('/usuarios/eu')
      .then(({ data }) => setIdUsuarioLogado(data.id_usuario))
      .catch(() => { /* o interceptor de 401 já cuida de derrubar para o login */ });
  }, []);
```

e sair cedo das funções que chamam a API enquanto `idUsuarioLogado` for `null`.

> **Por que isso importa:** hoje o id é fixo em 1. Com várias contas, a segunda pessoa a editar o
> perfil sobrescreve os dados da primeira — e, com a Task 4 no ar, ela passaria a receber 403 sem
> entender o motivo.

- [ ] **Step 6: Build, lint e conferência no navegador**

Run: `cd frontend-alfa && npm run build && npx oxlint`
Expected: build sem erros; oxlint sem erros.

Subir o ambiente pelo roteiro de verificação local e rodar `qa_seguranca.mjs` (no scratchpad):

```js
// QA da fase de Segurança — URL http://localhost:5173/camisetas/produtos-prontos
export default async function run(page) {
  const r = {};
  // 1. Sem login, a rota interna manda para o login
  r.semLogin = page.url();
  // 2. Entra
  await page.locator('input').first().fill('qa');
  await page.locator('input[type="password"]').fill('qa123456');
  await page.getByRole('button').first().click();
  await page.waitForURL(/selecao-segmento/);
  await page.getByRole('button', { name: /Acessar Módulo Camisetas/ }).click();
  await page.waitForURL(/camisetas\/dashboard/);
  r.depoisDoLogin = page.url();
  // 3. Token falso: a próxima chamada derruba para o login
  await page.evaluate(() => localStorage.setItem('token_confeccao', 'token-invalido'));
  await page.goto('http://localhost:5173/camisetas/produtos-prontos');
  await page.waitForURL((u) => u.pathname === '/', { timeout: 15000 });
  r.depoisDoTokenInvalido = page.url();
  r.avisos = await page.$$eval('.feedback-toast', (els) => els.map((e) => e.innerText.trim()));
  return r;
}
```

Expected: `semLogin` termina em `/` (a guarda funcionou); `depoisDoLogin` em `/camisetas/dashboard`; `depoisDoTokenInvalido` de volta em `/` com o aviso de sessão expirada; nenhum erro de console.

- [ ] **Step 7: Commit**

```bash
git add frontend-alfa/src
git commit -m "feat: guarda de rota, sessão expirada e conta do usuário logado" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação final, documentação e roteiro de produção

**Files:**
- Modify: `docs/superpowers/plans/2026-11-16-seguranca.md` (seção "Notas de execução"), `README.md`
- Modify: memória `fase0-pendencias-producao.md` (fora do repositório)

- [ ] **Step 1: Suíte completa e cobertura**

Run: `cd backend && venv/bin/python -m pytest --cov=app/services --cov-report=term-missing -q`
Expected: todos passam; cobertura de `app/services` ≥ 80%.

- [ ] **Step 2: Conferir que não sobrou porta aberta**

Como `usuario_atual` depende de `OAuth2PasswordBearer`, o FastAPI marca `security` em cada operação
protegida do esquema OpenAPI. Operação sem `security` é porta aberta:

```bash
cd backend && DATABASE_URL="sqlite://" venv/bin/python -c "
from app.main import app
abertas = [
    (metodo.upper(), caminho)
    for caminho, ops in app.openapi()['paths'].items()
    for metodo, op in ops.items()
    if 'security' not in op
]
for m, c in sorted(abertas):
    print(m, c)
"
```
Expected: exatamente duas linhas — `GET /` e `POST /login`. Qualquer outra é uma porta esquecida.

(`DATABASE_URL="sqlite://"` porque importar `app.main` ainda dispara o `create_all`, que tentaria
conectar no banco do `.env`.)

Run: `cd backend && grep -rn "sua_chave_secreta_super_segura_aqui" app/ ; echo "saída vazia = ok"`

- [ ] **Step 3: Frontend**

Run: `cd frontend-alfa && npm run build && npx oxlint`
Expected: sem erros.

- [ ] **Step 4: Documentação e memória**

- Acrescentar ao fim deste plano a seção `## Notas de execução` com o que mudou em relação ao plano.
- No `README.md`, na seção de instalação, documentar as variáveis novas: `SECRET_KEY`, `AMBIENTE`, `MINUTOS_DE_SESSAO`, `ADMIN_LOGIN`, `ADMIN_SENHA`.
- Atualizar a memória `fase0-pendencias-producao.md`: o deploy agora exige essas variáveis no Render, e sem `SECRET_KEY` a aplicação não sobe (de propósito).

- [ ] **Step 5: Roteiro de produção para o usuário**

Escrever, na resposta ao usuário, o passo a passo — **sem executar nada disso**:

1. Rotacionar a senha do Postgres no Render (a atual está no histórico do git público; remover o arquivo agora não a apaga de lá).
2. Definir no painel do Render: `SECRET_KEY` (valor longo e aleatório, ex.: `openssl rand -base64 48`), `AMBIENTE=producao`, `ADMIN_LOGIN`, `ADMIN_SENHA`.
3. Fazer o deploy; conferir no log a linha "Primeira conta criada a partir do ambiente".
4. Entrar com essa conta, trocar a senha pela tela de Perfil e **remover `ADMIN_SENHA`** do painel.
5. Conferir que `https://<api>/camisetas/pedidos/` sem token responde 401.

- [ ] **Step 6: Commit**

```bash
git add docs README.md
git commit -m "docs: notas de execução da fase de Segurança" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Notas de execução

Fase executada em 2026-11-16 no branch `feat/camisetas-seguranca`, seguindo as 8 tasks em TDD.

**Resultado**

- **228 testes passando** (eram 177 antes da fase); cobertura de `app/services` em **96,4%**.
- Exatamente **duas rotas abertas** no sistema inteiro — `GET /` e `POST /login` — provado pelo
  esquema OpenAPI (operação sem `security` é porta aberta).
- `grep "sua_chave_secreta_super_segura_aqui" app/` não encontra mais nada.
- Com `AMBIENTE=producao` e sem `SECRET_KEY`, a aplicação recusa subir com mensagem explicativa
  (conferido de verdade, não só no teste unitário).
- Conferido no navegador: abrir `/camisetas/produtos-prontos` sem login cai no `/`; o login guarda
  quem entrou; token forjado derruba para o login com "Sua sessão expirou. Entre de novo.".
- Build e `oxlint` sem erros, sem nenhum aviso nos arquivos tocados.

**Diferenças em relação ao plano**

1. **O `client` dos testes passou a chegar autenticado**, em vez de criar um `cliente_autenticado` e
   alterar os 16 arquivos de teste (a spec previa o segundo caminho). **Nenhum arquivo de teste
   existente precisou mudar.** Um `client_sem_login` cobre o outro lado.
2. **`lifespan` no lugar de `on_event("startup")`.** O plano usava `@app.on_event`, que esta versão
   do FastAPI acusa como depreciado — teria nascido código velho. Trocado pelo gerenciador de
   contexto `lifespan`.
3. **Hash da senha de teste calculado uma vez por sessão.** Com o `client` autenticado, cada teste
   passou a gerar um hash bcrypt e a suíte foi de 4,5 s para 27 s. Hasheando uma vez no `conftest`,
   voltou para 5,5 s.
4. **Trava no redirecionamento de sessão expirada.** Descoberto no navegador: uma tela faz várias
   chamadas em paralelo e, com o token vencido, **cada 401 disparava a sua própria navegação** — 8
   erros de console e 7 navegações abortadas numa queda só. Com a trava, cai uma vez.
5. **`Login.jsx` perdeu os `alert()`.** O arquivo já era tocado nesta fase e o projeto não usa
   `alert`; virou `useToast`. Os 7 `alert()` de `PerfilUsuario.jsx` **ficaram como estavam**: são
   anteriores e não têm relação com segurança — trocá-los seria ampliar o escopo.
6. **`.env` não foi tocado**, conforme a decisão do usuário.

**Correção de bug que a fase trouxe junto**

`PerfilUsuario.jsx` tinha `const idUsuarioLogado = 1;` — o perfil sempre editava o usuário nº 1,
fosse quem fosse que estivesse logado. Com várias contas (a decisão desta fase), a segunda pessoa a
salvar sobrescreveria os dados da primeira, e passaria a tomar 403 sem entender o porquê. Agora o id
vem de `GET /usuarios/eu`.

## Pendências de produção (ação do usuário)

1. **Rotacionar a senha do Postgres no Render.** A atual está no histórico do git público; tirar o
   arquivo agora não a apaga de lá.
2. Definir no painel do Render: `SECRET_KEY` (longa e aleatória, ex.: `openssl rand -base64 48`),
   `AMBIENTE=producao`, `ADMIN_LOGIN` e `ADMIN_SENHA`.
3. Fazer o deploy e conferir no log: "Primeira conta criada a partir do ambiente".
4. Entrar com essa conta, trocar a senha pela tela de Perfil e **remover `ADMIN_SENHA`** do painel.
5. Conferir que `https://<api>/camisetas/pedidos/` sem token responde 401.
