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
