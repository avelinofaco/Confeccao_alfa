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
