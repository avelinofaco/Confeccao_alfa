# app/schemas/equipe.py

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import date, datetime

# ==========================================
# SCHEMAS PARA COLABORADOR
# ==========================================
class ColaboradorBase(BaseModel):
    nome_completo: str = Field(..., max_length=150, description="Nome do funcionário")
    telefone_whatsapp: Optional[str] = Field( None, pattern=r"^\(\d{2}\)9 ?\d{8}$", description="Obrigatório seguir o formato: (85)9 84657234")
    ativo: Optional[bool] = Field(True, description="Se o funcionário está ativo na empresa")

class ColaboradorCreate(ColaboradorBase):
    pass

class ColaboradorResponse(ColaboradorBase):
    id_colaborador: int
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)

# ==========================================
# SCHEMAS PARA PRESENÇA
# ==========================================
class PresencaBase(BaseModel):
    id_colaborador: int = Field(..., description="ID do funcionário")
    data_referencia: date = Field(..., description="Data da chamada (YYYY-MM-DD)")
    presente: bool = Field(..., description="True para presente, False para falta")

class PresencaCreate(PresencaBase):
    pass

class PresencaResponse(PresencaBase):
    id_presenca: int
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)

class ResumoMensalResponse(BaseModel):
    nome: str
    presencas: int
    faltas: int

    model_config = ConfigDict(from_attributes=True)