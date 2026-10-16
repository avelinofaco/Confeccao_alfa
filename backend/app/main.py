from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import estoque, ficha_tecnica, producao, costura, comercial, equipe, auth, usuarios, contexto
from app.database import engine, Base
from sqlalchemy import text

# Garante a existência das novas colunas para retrocompatibilidade
try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE produtos ADD COLUMN IF NOT EXISTS id_contexto INTEGER REFERENCES contextos_produto(id_contexto) ON DELETE SET NULL;"))
        conn.execute(text("ALTER TABLE ordens_producao ADD COLUMN IF NOT EXISTS id_etapa_atual INTEGER REFERENCES workflow_etapas(id_etapa) ON DELETE SET NULL;"))
        conn.execute(text("ALTER TABLE ordens_producao ADD COLUMN IF NOT EXISTS dados_contexto JSON DEFAULT '{}';"))
        conn.commit()
except Exception as e:
    # Caso ocorra algum erro não-fatal (tabelas ainda sendo criadas), ignora
    pass

# Comando para criar as tabelas no PostgreSQL (caso ainda não existam)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="API Confecção Alfa", version="1.0.0")

# Lista de domínios autorizados a fazer requisições para a API
origins = [
    "https://confeccao-alfa.vercel.app",  # Seu front-end na Vercel
    "http://localhost:5173",              # Desenvolvimento local (Vite)
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # Utiliza a lista de origens explicitas
    allow_credentials=True,
    allow_methods=["*"],         # Libera POST, GET, PUT, DELETE, OPTIONS, etc.
    allow_headers=["*"],         # Libera Authorization, Content-Type, etc.
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
app.include_router(contexto.router)



@app.get("/")
def read_root():
    return {"mensagem": "API da Confecção Alfa rodando com sucesso! 🚀"}
