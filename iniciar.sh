#!/usr/bin/env bash

# Diretório base
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "========================================="
echo "   Iniciando Plataforma Confecção Alfa   "
echo "========================================="

# 1. Banco de Dados PostgreSQL (Docker)
echo "[1/3] Verificando container do banco de dados..."
if [ ! "$(docker ps -q -f name=confeccao-postgres)" ]; then
    if [ "$(docker ps -aq -f status=exited -f name=confeccao-postgres)" ]; then
        echo "Iniciando container existente confeccao-postgres..."
        docker start confeccao-postgres
    else
        echo "Criando e iniciando container confeccao-postgres na porta 5435..."
        docker run -d --name confeccao-postgres \
            -e POSTGRES_USER=postgres \
            -e POSTGRES_PASSWORD=postgres \
            -e POSTGRES_DB=Confecção_db \
            -p 5435:5432 \
            postgres:16
    fi
else
    echo "Banco de dados confeccao-postgres já está rodando na porta 5435."
fi

# 2. Iniciar Backend FastAPI
echo "[2/3] Iniciando Backend FastAPI (Porta 8001)..."
cd "$DIR/backend"
"$DIR/backend/venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port 8001 --reload &
BACKEND_PID=$!
echo "Backend iniciado com PID $BACKEND_PID em http://localhost:8001"

# 3. Iniciar Frontend Vite React
echo "[3/3] Iniciando Frontend React (Porta 5173)..."
cd "$DIR/frontend-alfa"
npx vite --port 5173 --host &
FRONTEND_PID=$!
echo "Frontend iniciado com PID $FRONTEND_PID em http://localhost:5173"

echo "========================================="
echo " Sistema ativo e rodando:"
echo " - Frontend: http://localhost:5173"
echo " - Backend API: http://localhost:8001"
echo " - Documentação API (Swagger): http://localhost:8001/docs"
echo " - Pressione CTRL+C para encerrar tudo."
echo "========================================="

cleanup() {
    echo ""
    echo "Encerrando serviços..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

wait
