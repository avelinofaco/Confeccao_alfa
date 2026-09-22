# app/schemas/comercial.py

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date, datetime
from decimal import Decimal

class PedidoBase(BaseModel):
    codigo_pedido: str = Field(..., max_length=20, description="Código único (Ex: #PED-01)")
    nome_cliente: str = Field(..., max_length=150, description="Nome do cliente ou loja")
    id_produto: int = Field(..., description="ID do modelo desejado")
    quantidade_pecas: int = Field(..., gt=0, description="Quantidade total de peças encomendadas")
    data_entrega_desejada: date = Field(..., description="Data limite para entrega (YYYY-MM-DD)")
    valor_total: Decimal = Field(..., ge=0, description="Valor financeiro total do pedido")
    observacoes: Optional[str] = Field(None, description="Anotações extras do cliente")

class PedidoCreate(PedidoBase):
    pass

class PedidoResponse(PedidoBase):
    id_pedido: int
    status_pedido: str
    criado_em: datetime
    atualizado_em: datetime

    model_config = ConfigDict(from_attributes=True)

class StatusPedidoUpdate(BaseModel):
    status_pedido: str = Field(..., description="Novo status do pedido (ex: Entregue)")