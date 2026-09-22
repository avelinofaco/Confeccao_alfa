from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import usuarios as models_usuarios
from app.core import security

router = APIRouter(tags=["Login e Segurança"])

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Valida as credenciais e retorna o Token de Acesso."""
    
    # 1. Busca o usuário no banco pelo login (username)
    usuario = db.query(models_usuarios.Usuario).filter(models_usuarios.Usuario.login == form_data.username).first()
    
    # 2. Verifica se o usuário existe e se a senha está correta
    if not usuario or not security.verificar_senha(form_data.password, usuario.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Login ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not usuario.ativo:
        raise HTTPException(status_code=400, detail="Usuário inativo.")

    # 3. Gera o token JWT
    token_acesso = security.criar_token_acesso(dados={"sub": usuario.login})
    
    # Retorna o token no formato padrão OAuth2
    return {"access_token": token_acesso, "token_type": "bearer"}