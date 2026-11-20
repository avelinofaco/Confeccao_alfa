from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core import config
from app.core.auth import usuario_atual
from app.core.bootstrap import criar_primeiro_usuario
from app.core.erros import ErroNegocio
from app.routers import estoque, ficha_tecnica, producao, costura, comercial, equipe, auth, usuarios, camisetas, portal_cliente
from app.models import camisetas as camisetas_models, camisetas_estampas  # noqa: F401
from app.database import engine, Base, SessionLocal

# Comando para criar as tabelas no PostgreSQL (caso ainda não existam)
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    """Na subida, garante que exista uma conta para entrar (ver app/core/bootstrap.py)."""
    db = SessionLocal()
    try:
        criar_primeiro_usuario(db, config.ADMIN_LOGIN, config.ADMIN_SENHA)
    finally:
        db.close()
    yield


app = FastAPI(title="API Confecção Alfa", version="1.0.0", lifespan=ciclo_de_vida)


@app.exception_handler(ErroNegocio)
async def tratar_erro_negocio(_request: Request, erro: ErroNegocio):
    return JSONResponse(status_code=erro.status_code, content={"detail": erro.detalhe()})

# Lista de domínios autorizados a fazer requisições para a API
origins = [
    "https://confeccao-alfa.vercel.app",  # Seu front-end na Vercel
    "http://localhost:5173",              # Desenvolvimento local (Vite)
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # Permite qualquer URL de deploy ou preview da Vercel
    allow_credentials=True,
    allow_methods=["*"],         # Libera POST, GET, PUT, DELETE, OPTIONS, etc.
    allow_headers=["*"],         # Libera Authorization, Content-Type, etc.
)

# /login e /portal (protegido por token criptográfico de capacidade na própria URL) ficam abertos sem JWT interno.
app.include_router(auth.router)
app.include_router(portal_cliente.router)

# Todo o resto exige token. Protegendo no include_router, nenhuma rota do módulo escapa —
# nem as que forem criadas depois.
# Cadastro público (POST /usuarios) fica livre; as rotas privadas de /usuarios já exigem token individualmente
app.include_router(usuarios.router)

for _modulo in (estoque, ficha_tecnica, comercial, producao, costura, equipe, camisetas):
    app.include_router(_modulo.router, dependencies=[Depends(usuario_atual)])


@app.get("/")
def read_root():
    return {"mensagem": "API da Confecção Alfa rodando com sucesso! 🚀"}
