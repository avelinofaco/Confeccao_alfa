# app/schemas/estoque.py

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal

# ==========================================
# SCHEMAS PARA INSUMOS (Malhas e Aviamentos)
# ==========================================

class InsumoBase(BaseModel):
    codigo: str = Field(..., max_length=20, description="Código único do material")
    categoria: str = Field(..., max_length=30, description="Categoria: MALHA ou AVIAMENTO")
    tipo: str = Field(..., max_length=100, description="Tipo do material")
    unidade_medida: str = Field(..., max_length=10, description="Unidade: kg ou metros")
    estoque_minimo_seguranca: Optional[Decimal] = Field(default=0.000, max_digits=10, decimal_places=3)

# Schema usado para CADASTRAR um novo insumo
class InsumoCreate(InsumoBase):
    pass

# Schema usado para DEVOLVER os dados do insumo para o React (Front-end)
class InsumoResponse(InsumoBase):
    id_insumo: int
    quantidade_atual: Decimal
    criado_em: datetime
    atualizado_em: datetime

    # Permite que o Pydantic leia diretamente o Model do SQLAlchemy
    model_config = ConfigDict(from_attributes=True)


# ==========================================
# SCHEMAS PARA ENTRADA DE ESTOQUE
# ==========================================

class EntradaEstoqueBase(BaseModel):
    id_insumo: int = Field(..., description="ID do insumo que está recebendo entrada")
    quantidade_recebida: Decimal = Field(..., gt=0, description="Quantidade recebida (deve ser maior que zero)")

# Schema usado para REGISTRAR uma nova entrada
class EntradaEstoqueCreate(EntradaEstoqueBase):
    pass

# Schema usado para DEVOLVER os dados da entrada
class EntradaEstoqueResponse(EntradaEstoqueBase):
    id_entrada: int
    data_entrada: datetime

    model_config = ConfigDict(from_attributes=True)