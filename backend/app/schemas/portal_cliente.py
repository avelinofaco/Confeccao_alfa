# app/schemas/portal_cliente.py
"""Schemas do Portal do Cliente (aprovação por link e montagem de pedido pelo celular)."""
from datetime import date
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.schemas.camisetas import CamisetaModeloResponse, CamisetaPedidoResponse
from app.schemas.camisetas_cadastros import CorResponse
from app.schemas.camisetas_estampas import EstampaResponse
from app.schemas.camisetas_sku import PedidoItemEntrada


class RespostaAprovacaoEntrada(BaseModel):
    decisao: Literal["Aprovado", "Ajuste Solicitado"]
    observacao_cliente: Optional[str] = Field(None, max_length=1000)


class PedidoPortalClienteEntrada(BaseModel):
    prazo_entrega: date
    observacoes: Optional[str] = Field(None, max_length=1000)
    itens: List[PedidoItemEntrada] = Field(..., min_length=1)


class CatalogoPortalClienteResponse(BaseModel):
    id_cliente: int
    nome_cliente: str
    modelos: List[CamisetaModeloResponse]
    cores: List[CorResponse]
    estampas: List[EstampaResponse]
    pedidos: List[CamisetaPedidoResponse]
