from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Any
from datetime import datetime

class UsuarioBase(BaseModel):
    login: str = Field(..., max_length=100, description="E-mail ou CPF do usuário")
    nome_usuario: str = Field(..., max_length=150, description="Nome completo")
    perfil: Optional[str] = Field("Gestor", description="Perfil (Ex: Gestor, Operador)")
    ativo: Optional[bool] = Field(True, description="Status de acesso")
    onboarding_concluido: Optional[bool] = Field(False, description="Se concluiu o questionário de configuração de contexto")
    contexto_preferido: Optional[str] = Field(None, description="Código do nicho configurado (CAMISETA, CALCINHA, JEANS, MISTO)")
    preferencias_modulos: Optional[Dict[str, Any]] = Field(default={}, description="Flags dos módulos ativos")

# Schema para CADASTRO (recebe a senha em texto puro)
class UsuarioCreate(UsuarioBase):
    senha: str = Field(..., min_length=6, description="Senha (mínimo 6 caracteres)")

# Schema para RESPOSTA (NÃO contém a senha)
class UsuarioResponse(UsuarioBase):
    id_usuario: int
    criado_em: datetime
    atualizado_em: datetime

    model_config = ConfigDict(from_attributes=True)

class UsuarioUpdate(BaseModel):
    nome_usuario: Optional[str] = Field(None, max_length=150, description="Novo nome")
    login: Optional[str] = Field(None, max_length=100, description="Novo e-mail ou CPF")
    senha: Optional[str] = Field(None, min_length=6, description="Nova senha (se quiser alterar)")
    onboarding_concluido: Optional[bool] = None
    contexto_preferido: Optional[str] = None
    preferencias_modulos: Optional[Dict[str, Any]] = None

class OnboardingContextoRequest(BaseModel):
    tipo_confeccao: str = Field(..., description="Nicho da confecção: 'CAMISETA', 'CALCINHA', 'JEANS', 'FITNESS', 'MISTO'")
    modulos_selecionados: Dict[str, bool] = Field(default={}, description="Funcionalidades ativadas pelo usuário")
    nome_confeccao: Optional[str] = Field(None, description="Nome fantasia da confecção")