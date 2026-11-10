# app/routers/camisetas/__init__.py
"""Rotas do Segmento Camisetas, divididas por assunto."""
from fastapi import APIRouter

from app.routers.camisetas import (
    costura,
    dashboard,
    financeiro,
    insumos,
    modelos,
    ordens,
    pedidos,
    seed,
)

router = APIRouter(prefix="/camisetas", tags=["Segmento Camisetas"])

for _modulo in (seed, dashboard, pedidos, insumos, modelos, ordens, financeiro, costura):
    router.include_router(_modulo.router)
