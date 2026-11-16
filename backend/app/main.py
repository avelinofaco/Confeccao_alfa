from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.auth import usuario_atual
from app.core.erros import ErroNegocio
from app.routers import estoque, ficha_tecnica, producao, costura, comercial, equipe, auth, usuarios, camisetas
from app.models import camisetas as camisetas_models
from app.database import engine, Base

# Comando para criar as tabelas no PostgreSQL (caso ainda não existam)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Confecção Alfa", version="1.0.0")


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

# /login fica aberto: é por ele que se entra.
app.include_router(auth.router)

# Todo o resto exige token. Protegendo no include_router, nenhuma rota do módulo escapa —
# nem as que forem criadas depois.
for _modulo in (usuarios, estoque, ficha_tecnica, comercial, producao, costura, equipe, camisetas):
    app.include_router(_modulo.router, dependencies=[Depends(usuario_atual)])


@app.get("/")
def read_root():
    return {"mensagem": "API da Confecção Alfa rodando com sucesso! 🚀"}
