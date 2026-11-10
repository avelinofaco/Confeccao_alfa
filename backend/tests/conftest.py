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
