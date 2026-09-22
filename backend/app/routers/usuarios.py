# app/routers/usuarios.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import usuarios as models_usuarios
from app.schemas import usuarios as schemas
from app.core import security # Importando nosso motor de criptografia

router = APIRouter(prefix="/usuarios", tags=["Usuários e Acesso"])

@router.post("/", response_model=schemas.UsuarioResponse, status_code=status.HTTP_201_CREATED)
def criar_usuario(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    """Cadastra um novo usuário no sistema com senha criptografada."""
    
    # 1. Verifica se o login já existe
    db_usuario = db.query(models_usuarios.Usuario).filter(models_usuarios.Usuario.login == usuario.login).first()
    if db_usuario:
        raise HTTPException(status_code=400, detail="Este login já está cadastrado.")

    # 2. Criptografa a senha digitada!
    senha_segura = security.obter_hash_senha(usuario.senha)
    
    # 3. Salva no banco montando o Model manualmente para trocar 'senha' por 'senha_hash'
    novo_usuario = models_usuarios.Usuario(
        login=usuario.login,
        senha_hash=senha_segura,
        nome_usuario=usuario.nome_usuario,
        perfil=usuario.perfil,
        ativo=usuario.ativo
    )
    
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    
    return novo_usuario

@router.put("/{id_usuario}", response_model=schemas.UsuarioResponse)
def atualizar_perfil(id_usuario: int, dados: schemas.UsuarioUpdate, db: Session = Depends(get_db)):
    """Atualiza os dados do perfil da gestora."""
    usuario = db.query(models_usuarios.Usuario).filter(models_usuarios.Usuario.id_usuario == id_usuario).first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")

    # Atualiza apenas os campos que foram enviados
    if dados.nome_usuario: 
        usuario.nome_usuario = dados.nome_usuario
    if dados.login: 
        usuario.login = dados.login
    if dados.senha: 
        usuario.senha_hash = security.obter_hash_senha(dados.senha) # Criptografa a nova senha
    
    db.commit()
    db.refresh(usuario)
    return usuario

@router.get("/{id_usuario}", response_model=schemas.UsuarioResponse)
def obter_perfil_usuario(id_usuario: int, db: Session = Depends(get_db)):
    """Busca os dados atuais do usuário para exibir na tela de configurações."""
    
    usuario = db.query(models_usuarios.Usuario).filter(models_usuarios.Usuario.id_usuario == id_usuario).first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    return usuario