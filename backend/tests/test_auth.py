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
