from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

# Schemas para Vincular o Insumo na Ficha Técnica
class ComposicaoBase(BaseModel):
    id_insumo: int = Field(..., description="ID do material (Malha ou Aviamento)")
    gasto_por_unidade: Decimal = Field(..., gt=0, description="Consumo por peça (ex: 0.020 kg)")

class ComposicaoCreate(ComposicaoBase):
    pass

class ComposicaoResponse(ComposicaoBase):
    id_ficha_tecnica: int
    
    model_config = ConfigDict(from_attributes=True)

# Schemas para o Produto (Modelo)
class ProdutoBase(BaseModel):
    nome_modelo: str = Field(..., max_length=150, description="Nome do produto (Ex: Calcinha Modelo X)")

class ProdutoCreate(ProdutoBase):
    pass

# Resposta do Produto SIMPLES (só o nome e ID)
class ProdutoResponse(ProdutoBase):
    id_produto: int
    criado_em: datetime
    
    model_config = ConfigDict(from_attributes=True)

# Resposta do Produto COMPLETA (traz o modelo e toda a ficha técnica atrelada)
class ProdutoFichaCompletaResponse(ProdutoResponse):
    composicao: List[ComposicaoResponse] = []