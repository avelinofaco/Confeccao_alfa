from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal

# Schema Base
class OPBase(BaseModel):
    codigo_op: str = Field(..., max_length=20, description="Código da OP (ex: OP#101)")
    id_produto: int = Field(..., description="ID do modelo a ser fabricado")
    peso_malha_enviado: Optional[Decimal] = Field(Decimal("0.000"), ge=0, description="Peso em kg enviado ao corte (para camisetas/básicos)")
    dados_contexto: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Dados específicos da família da peça (grade, elásticos, etc.)")
    grade_distribuicao: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Matriz 2D de grade (Cores x Tamanhos)")
    dados_enfesto: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Parâmetros técnicos de enfesto")
    horas_descanso_cumpridas: Optional[Decimal] = Field(default=Decimal("0.00"), description="Horas de descanso do rolo cumpridas")
    status_descanso: Optional[str] = Field(default="Liberado", description="Status do descanso de malha/tecido")

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
    id_etapa_atual: Optional[int] = None
    criado_em: datetime
    atualizado_em: datetime

    model_config = ConfigDict(from_attributes=True)