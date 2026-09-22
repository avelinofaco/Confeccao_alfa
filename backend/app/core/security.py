# app/core/security.py

from datetime import datetime, timedelta, timezone
import jwt
from passlib.context import CryptContext

# Configurações do JWT
SECRET_KEY = "sua_chave_secreta_super_segura_aqui" # Em produção, coloque isso em um arquivo .env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 # O token expira em 1 hora

# Configuração do passlib para usar o algoritmo bcrypt
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verificar_senha(senha_texto_puro, senha_criptografada):
    """Compara a senha digitada com o hash do banco de dados."""
    return pwd_context.verify(senha_texto_puro, senha_criptografada)

def obter_hash_senha(senha):
    """Criptografa a senha antes de salvar no banco."""
    return pwd_context.hash(senha)

def criar_token_acesso(dados: dict):
    """Gera o Token JWT para o usuário logado."""
    copia_dados = dados.copy()
    expiracao = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    copia_dados.update({"exp": expiracao})
    
    token = jwt.encode(copia_dados, SECRET_KEY, algorithm=ALGORITHM)
    return token