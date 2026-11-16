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
