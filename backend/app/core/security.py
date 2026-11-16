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
