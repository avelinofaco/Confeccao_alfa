from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON
from app.database import Base
from app.models.estoque import get_utc_now # Reutilizando a função de data

class Usuario(Base):
    __tablename__ = "usuarios"

    id_usuario = Column(Integer, primary_key=True, index=True)
    login = Column(String(100), unique=True, nullable=False, index=True) # E-mail ou CPF
    senha_hash = Column(String(255), nullable=False) # Guardaremos apenas o Hash, NUNCA a senha real
    nome_usuario = Column(String(150), nullable=False)
    perfil = Column(String(50), default="Gestor") # 'Gestor' ou 'Operador'
    ativo = Column(Boolean, default=True)
    
    # Controle de primeiro acesso e contexto do negócio
    onboarding_concluido = Column(Boolean, default=False)
    contexto_preferido = Column(String(50), nullable=True) # 'CAMISETA', 'CALCINHA', 'JEANS', 'MISTO'
    preferencias_modulos = Column(JSON, default=dict) # Flags de módulos ativos
    
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    atualizado_em = Column(DateTime(timezone=True), default=get_utc_now, onupdate=get_utc_now)