# app/schemas/producao.py

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal

# Schema Base
class OPBase(BaseModel):
    codigo_op: str = Field(..., max_length=20, description="Código da OP (ex: OP#101)")
    id_produto: int = Field(..., description="ID do modelo a ser fabricado")
    peso_malha_enviado: Decimal = Field(..., gt=0, description="Peso em kg enviado ao cortador")

# Schema para CRIAR a OP (Envio)
class OPCreate(OPBase):
    pass

# Schema para REGISTRAR O RETORNO (Quando o cortador devolve as peças)
class OPRetornoCorte(BaseModel):
    quantidade_pecas_cortadas: int = Field(..., gt=0, description="Quantidade de peças que renderam")

# Schema para DEVOLVER os dados para a tela
class OPResponse(OPBase):
    id_op: int
    quantidade_pecas_cortadas: Optional[int] = None
    rendimento_real: Optional[Decimal] = None
    status_op: str
    criado_em: datetime
    atualizado_em: datetime

    model_config = ConfigDict(from_attributes=True)