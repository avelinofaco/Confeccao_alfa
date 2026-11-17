# app/schemas/contexto.py

from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Any, Dict
from datetime import datetime

# ========================================================
# SCHEMAS DE ETAPAS DO WORKFLOW
# ========================================================
class WorkflowEtapaBase(BaseModel):
    codigo_etapa: str = Field(..., max_length=50, description="Identificador da etapa (ex: corte, costura, lavanderia)")
    nome_etapa: str = Field(..., max_length=100, description="Nome exibido na esteira (ex: 'Aplicação de Elásticos')")
    ordem_etapa: int = Field(1, description="Posição sequencial na esteira produtiva")
    tipo_operacao: str = Field("INTERNA", description="'INTERNA' ou 'EXTERNA' (facção parceira)")
    permite_perda: bool = Field(True, description="Se permite apontamento de refugo/perda")
    descricao_instrucao: Optional[str] = Field(None, max_length=255, description="Orientações técnicas para os operadores")
    campos_etapa: Optional[List[Dict[str, Any]]] = Field(default=[], description="Definição de campos extras para a etapa")

class WorkflowEtapaCreate(WorkflowEtapaBase):
    pass

class WorkflowEtapaUpdate(BaseModel):
    nome_etapa: Optional[str] = None
    ordem_etapa: Optional[int] = None
    tipo_operacao: Optional[str] = None
    permite_perda: Optional[bool] = None
    descricao_instrucao: Optional[str] = None
    campos_etapa: Optional[List[Dict[str, Any]]] = None

class WorkflowEtapaResponse(WorkflowEtapaBase):
    id_etapa: int
    id_contexto: int
    criado_em: datetime

    model_config = ConfigDict(from_attributes=True)


# ========================================================
# SCHEMAS DE CONTEXTOS DE PRODUTO
# ========================================================
class ContextoProdutoBase(BaseModel):
    codigo: str = Field(..., max_length=50, description="Código único do contexto (ex: CAMISETA, CALCINHA, JEANS)")
    nome: str = Field(..., max_length=100, description="Nome legível da categoria (ex: 'Camisetas & Básicos')")
    descricao: Optional[str] = Field(None, max_length=255, description="Descrição do perfil de confecção")
    unidade_principal: str = Field("UNIDADE", description="Unidade padrão: 'kg', 'metros', 'unidade'")
    
    # Feature Flags
    habilita_grade_tamanhos: bool = Field(True, description="Habilita grade (P, M, G, GG ou 36 ao 48)")
    habilita_lavanderia: bool = Field(False, description="Habilita módulo e etapas de lavanderia industrial")
    habilita_estamparia: bool = Field(False, description="Habilita módulo de silk-screen / estamparia")
    habilita_controle_elasticos: bool = Field(False, description="Habilita medição e tensão de elásticos (moda íntima)")
    habilita_rendimento_peso: bool = Field(True, description="Mede rendimento do corte em peças/kg")

    schema_campos_customizados: Optional[List[Dict[str, Any]]] = Field(
        default=[], 
        description="Campos extras dinâmicos para a ficha técnica e corte"
    )

class ContextoProdutoCreate(ContextoProdutoBase):
    etapas_iniciais: Optional[List[WorkflowEtapaCreate]] = Field(
        default=[], 
        description="Lista opcional de etapas para criar junto com o contexto"
    )

class ContextoProdutoUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    unidade_principal: Optional[str] = None
    habilita_grade_tamanhos: Optional[bool] = None
    habilita_lavanderia: Optional[bool] = None
    habilita_estamparia: Optional[bool] = None
    habilita_controle_elasticos: Optional[bool] = None
    habilita_rendimento_peso: Optional[bool] = None
    schema_campos_customizados: Optional[List[Dict[str, Any]]] = None

class ContextoProdutoResponse(ContextoProdutoBase):
    id_contexto: int
    criado_em: datetime
    atualizado_em: datetime

    model_config = ConfigDict(from_attributes=True)

class ContextoProdutoDetalhadoResponse(ContextoProdutoResponse):
    etapas: List[WorkflowEtapaResponse] = []


# ========================================================
# SCHEMAS DE APONTAMENTO E AVANÇO DE WORKFLOW
# ========================================================
class AvancoWorkflowRequest(BaseModel):
    quantidade_concluida: int = Field(..., gt=0, description="Quantidade de peças que completaram a etapa")
    quantidade_perda: Optional[int] = Field(0, ge=0, description="Quantidade de peças perdidas/refugo")
    responsavel_oficina: Optional[str] = Field(None, max_length=150, description="Nome do operador ou da facção")
    observacoes: Optional[str] = Field(None, description="Observações do apontamento")
    dados_customizados: Optional[Dict[str, Any]] = Field(default={}, description="Valores dos campos extras da etapa")

class ApontamentoEtapaResponse(BaseModel):
    id_apontamento: int
    id_op: int
    id_etapa: int
    status_etapa: str
    quantidade_entrada: Optional[int] = None
    quantidade_concluida: Optional[int] = None
    quantidade_perda: int = 0
    responsavel_oficina: Optional[str] = None
    observacoes: Optional[str] = None
    dados_customizados: Optional[Dict[str, Any]] = None
    data_inicio: datetime
    data_fim: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class StatusWorkflowOPResponse(BaseModel):
    id_op: int
    codigo_op: str
    nome_produto: str
    contexto: Optional[ContextoProdutoResponse] = None
    etapa_atual: Optional[WorkflowEtapaResponse] = None
    todas_etapas: List[WorkflowEtapaResponse] = []
    apontamentos: List[ApontamentoEtapaResponse] = []
    status_op: str
