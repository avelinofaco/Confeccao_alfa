from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal

# ==========================================
# SCHEMAS PARA O ENVIO
# ==========================================
class EnvioCosturaCreate(BaseModel):
    id_op: int = Field(..., description="ID da Ordem de Produção que será enviada")
    destino_costura: str = Field(..., max_length=100, description="Nome da costureira/oficina (Ex: Confecção da Maria)")
    margem_seguranca_insumos: Decimal = Field(default=0.000, ge=0, description="Margem extra de aviamentos em metros")

# ==========================================
# SCHEMAS PARA O RETORNO (Fechamento)
# ==========================================
class RetornoCosturaUpdate(BaseModel):
    quantidade_recebida: int = Field(..., ge=0, description="Quantidade de peças que voltaram prontas e boas")

# ==========================================
# SCHEMA DE RESPOSTA (O que o Front-end recebe)
# ==========================================
class MovimentacaoCosturaResponse(BaseModel):
    id_movimentacao: int
    id_op: int
    destino_costura: str
    quantidade_enviada: int
    margem_seguranca_insumos: Decimal
    data_envio: datetime
    
    quantidade_recebida: Optional[int] = None
    perda_pecas: Optional[int] = None
    data_retorno: Optional[datetime] = None
    status_movimentacao: str

    model_config = ConfigDict(from_attributes=True)