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
    id_contexto: Optional[int] = Field(None, description="ID do contexto/família da peça (ex: Camisetas, Calcinhas, etc.)")
    referencia_codigo: Optional[str] = Field(None, max_length=50, description="Código de referência interna/SKU")
    descricao_detalhada: Optional[str] = Field(None, max_length=255, description="Descrição detalhada do modelo")
    grade_tamanhos_disponiveis: Optional[List[str]] = Field(default_factory=list, description="Lista de tamanhos da grade")
    cores_disponiveis: Optional[List[str]] = Field(default_factory=list, description="Lista de cores disponíveis")
    tempo_padrao_total_minutos: Optional[Decimal] = Field(default=Decimal("0.00"), description="Tempo padrão cronometrado em minutos")
    custo_estimado_total: Optional[Decimal] = Field(default=Decimal("0.00"), description="Custo unitário estimado")

class ProdutoCreate(ProdutoBase):
    pass

# Resposta do Produto SIMPLES (só o nome e ID)
class ProdutoResponse(ProdutoBase):
    id_produto: int
    nome_contexto: Optional[str] = None
    codigo_contexto: Optional[str] = None
    criado_em: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Resposta do Produto COMPLETA (traz o modelo e toda a ficha técnica atrelada)
class ProdutoFichaCompletaResponse(ProdutoResponse):
    composicao: List[ComposicaoResponse] = []