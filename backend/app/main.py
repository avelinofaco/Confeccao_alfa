from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import estoque, ficha_tecnica, producao, costura, comercial, equipe, auth, usuarios
from app.database import engine, Base

# Comando para criar as tabelas no PostgreSQL (caso ainda não existam)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Confecção Alfa", version="1.0.0")

# --- Configuração do CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://confeccao-alfa-kolw.vercel.app" ],
        # Link exato do domínio da Vercel
    allow_credentials=True,
    # Libera todos os métodos (GET, POST, PUT, DELETE, etc.)
    allow_methods=["*"],
    # Libera todos os cabeçalhos (inclusive os de autenticação JWT)
    allow_headers=["*"],
)

# Incluindo o router de cada módulo na aplicação FastAPI
app.include_router(usuarios.router)
app.include_router(auth.router)
app.include_router(estoque.router)
app.include_router(ficha_tecnica.router)
app.include_router(comercial.router)
app.include_router(producao.router)
app.include_router(costura.router)
app.include_router(equipe.router)


@app.get("/")
def read_root():
    return {"mensagem": "API da Confecção Alfa rodando com sucesso! 🚀"}
