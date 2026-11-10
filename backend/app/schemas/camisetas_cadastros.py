# app/schemas/camisetas_cadastros.py
"""Schemas dos cadastros do segmento Camisetas: clientes, cores e grades."""
from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ClienteEntrada(BaseModel):
    """Usado para criar e para atualizar (PUT substitui todos os campos)."""
    tipo: Optional[Literal["PF", "PJ"]] = None
    nome: str = Field(..., min_length=2, max_length=150)
    documento: Optional[str] = Field(None, max_length=20)
    telefone_whatsapp: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=150)
    cidade: Optional[str] = Field(None, max_length=100)
    uf: Optional[str] = Field(None, max_length=2)
    endereco: Optional[str] = Field(None, max_length=255)
    observacoes: Optional[str] = None
    ativo: bool = True


class ClienteResponse(BaseModel):
    id_cliente: int
    tipo: Optional[str] = None
    nome: str
    documento: Optional[str] = None
    telefone_whatsapp: Optional[str] = None
    email: Optional[str] = None
    cidade: Optional[str] = None
    uf: Optional[str] = None
    endereco: Optional[str] = None
    observacoes: Optional[str] = None
    ativo: bool
    qtd_pedidos: int = 0
    ultimo_pedido_em: Optional[datetime] = None
    valor_total_pedidos: Decimal = Decimal("0.00")
    criado_em: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


PADRAO_HEX = r"^#[0-9A-Fa-f]{6}$"


class CorEntrada(BaseModel):
    nome: str = Field(..., min_length=1, max_length=60)
    hex: str = Field(..., pattern=PADRAO_HEX)
    ativo: bool = True


class CorResponse(BaseModel):
    id_cor: int
    nome: str
    hex: str
    ativo: bool
    model_config = ConfigDict(from_attributes=True)
