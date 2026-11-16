"""Fixtures compartilhadas. NUNCA aponte os testes para o banco de produção."""
import os

# Forçado (não setdefault): o backend/.env local aponta para produção.
os.environ["DATABASE_URL"] = "sqlite://"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.security import criar_token_acesso, obter_hash_senha  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.usuarios import Usuario  # noqa: E402

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


# bcrypt é lento de propósito. Hasheando uma vez por sessão em vez de uma por teste, a suíte
# inteira volta a rodar em segundos.
SENHA_DO_TESTE = "qa123456"
_HASH_DO_TESTE = obter_hash_senha(SENHA_DO_TESTE)


@pytest.fixture()
def usuario_teste(db):
    usuario = Usuario(
        login="qa", senha_hash=_HASH_DO_TESTE, nome_usuario="Usuário de Teste",
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
