# app/routers/camisetas/__init__.py
"""Rotas do Segmento Camisetas, divididas por assunto."""
from fastapi import APIRouter

from app.routers.camisetas import (
    clientes,
    cores,
    costura,
    dashboard,
    financeiro,
    grades,
    insumos,
    modelos,
    ordens,
    pedidos,
    produtos_prontos,
    seed,
)

router = APIRouter(prefix="/camisetas", tags=["Segmento Camisetas"])

for _modulo in (seed, dashboard, pedidos, produtos_prontos, clientes, cores, grades, insumos, modelos, ordens, financeiro, costura):
    router.include_router(_modulo.router)
