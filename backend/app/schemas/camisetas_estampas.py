# app/schemas/camisetas_estampas.py
"""Schemas do Banco de Estampas do segmento Camisetas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class EstampaCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=120)
    codigo: Optional[str] = Field(None, max_length=30)
    observacoes: Optional[str] = None
    imagem_data_url: str = Field(..., min_length=1)
    ativo: bool = True


class EstampaUpdate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=120)
    codigo: Optional[str] = Field(None, max_length=30)
    observacoes: Optional[str] = None
    imagem_data_url: Optional[str] = None
    ativo: bool = True


class EstampaResponse(BaseModel):
    id_estampa: int
    codigo: str
    nome: str
    observacoes: Optional[str] = None
    imagem_mime: str
    tamanho_bytes: int
    imagem_data_url: str
    ativo: bool
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)
