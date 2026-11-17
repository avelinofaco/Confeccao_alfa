# app/routers/usuarios.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import usuarios as models_usuarios
from app.models.usuarios import Usuario
from app.schemas import usuarios as schemas
from app.core import security # Importando nosso motor de criptografia
from app.core.auth import usuario_atual

router = APIRouter(prefix="/usuarios", tags=["Usuários e Acesso"])


@router.get("/eu", response_model=schemas.UsuarioResponse)
def obter_usuario_logado(eu: Usuario = Depends(usuario_atual)):
    """Quem está com este token na mão. É assim que o frontend descobre o usuário da sessão.

    Precisa vir declarada ANTES de /{id_usuario}: o FastAPI casa as rotas na ordem de registro, e
    "eu" seria lido como um id.
    """
    return eu


def _exigir_que_seja_voce(id_usuario: int, eu: Usuario) -> None:
    """Acesso é igual para os dados do negócio, mas conta é pessoal: ninguém mexe na do outro."""
    if id_usuario != eu.id_usuario:
        raise HTTPException(status_code=403, detail="Você só pode ver e alterar a sua própria conta.")

@router.post("/", response_model=schemas.UsuarioResponse, status_code=status.HTTP_201_CREATED)
@router.post("", response_model=schemas.UsuarioResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
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
def atualizar_perfil(id_usuario: int, dados: schemas.UsuarioUpdate, db: Session = Depends(get_db),
                     eu: Usuario = Depends(usuario_atual)):
    """Atualiza os dados do próprio perfil."""
    _exigir_que_seja_voce(id_usuario, eu)
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
def obter_perfil_usuario(id_usuario: int, db: Session = Depends(get_db),
                         eu: Usuario = Depends(usuario_atual)):
    """Busca os dados atuais do usuário para exibir na tela de configurações."""
    _exigir_que_seja_voce(id_usuario, eu)
    usuario = db.query(models_usuarios.Usuario).filter(models_usuarios.Usuario.id_usuario == id_usuario).first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        
    return usuario