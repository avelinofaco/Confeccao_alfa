# app/routers/portal_cliente.py
"""Rotas públicas por token de capacidade para o Portal do Cliente."""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas import CamisetaPedidoResponse
from app.schemas.portal_cliente import (
    CatalogoPortalClienteResponse,
    PedidoPortalClienteEntrada,
    RespostaAprovacaoEntrada,
)
from app.services.camisetas.pedidos import montar_resposta_pedido
from app.services.camisetas.portal import (
    criar_pedido_pelo_portal,
    obter_catalogo_cliente,
    obter_pedido_por_token,
    responder_aprovacao_pedido,
)

router = APIRouter(prefix="/portal", tags=["Portal do Cliente"])


@router.get("/pedido/{token}", response_model=CamisetaPedidoResponse)
def ver_pedido(token: str, db: Session = Depends(get_db)):
    return montar_resposta_pedido(obter_pedido_por_token(db, token))


@router.post("/pedido/{token}/responder", response_model=CamisetaPedidoResponse)
def responder_pedido(token: str, dados: RespostaAprovacaoEntrada, db: Session = Depends(get_db)):
    return montar_resposta_pedido(responder_aprovacao_pedido(db, token, dados))


@router.get("/cliente/{token}", response_model=CatalogoPortalClienteResponse)
def ver_catalogo_cliente(token: str, db: Session = Depends(get_db)):
    return obter_catalogo_cliente(db, token)


@router.post(
    "/cliente/{token}/pedidos",
    response_model=CamisetaPedidoResponse,
    status_code=status.HTTP_201_CREATED,
)
def criar_pedido_cliente(token: str, dados: PedidoPortalClienteEntrada, db: Session = Depends(get_db)):
    return montar_resposta_pedido(criar_pedido_pelo_portal(db, token, dados))
