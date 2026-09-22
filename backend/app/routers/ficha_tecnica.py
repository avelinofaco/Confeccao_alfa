from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import ficha_tecnica as models_ficha
from app.models import estoque as models_estoque
from app.schemas import ficha_tecnica as schemas

router = APIRouter(
    prefix="/produtos",
    tags=["Ficha Técnica"]
)

@router.post("/", response_model=schemas.ProdutoResponse, status_code=status.HTTP_201_CREATED)
def criar_produto(produto: schemas.ProdutoCreate, db: Session = Depends(get_db)):
    """Cadastra um novo modelo de roupa no sistema."""
    
    db_produto = db.query(models_ficha.Produto).filter(models_ficha.Produto.nome_modelo == produto.nome_modelo).first()
    if db_produto:
        raise HTTPException(status_code=400, detail="Este modelo já está cadastrado.")
        
    novo_produto = models_ficha.Produto(**produto.model_dump())
    db.add(novo_produto)
    db.commit()
    db.refresh(novo_produto)
    
    return novo_produto

@router.get("/", response_model=List[schemas.ProdutoResponse])
def listar_produtos(db: Session = Depends(get_db)):
    """Retorna a lista de todos os modelos de produtos cadastrados."""
    return db.query(models_ficha.Produto).all()

@router.post("/{id_produto}/insumos", response_model=schemas.ComposicaoResponse, status_code=status.HTTP_201_CREATED)
def adicionar_insumo_ficha(id_produto: int, composicao: schemas.ComposicaoCreate, db: Session = Depends(get_db)):
    """Adiciona um material e seu consumo à ficha técnica do produto."""
    
    # Verifica se o produto existe
    produto = db.query(models_ficha.Produto).filter(models_ficha.Produto.id_produto == id_produto).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
        
    # Verifica se o insumo existe
    insumo = db.query(models_estoque.Insumo).filter(models_estoque.Insumo.id_insumo == composicao.id_insumo).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo não encontrado no estoque.")
        
    # Verifica se já existe essa combinação (para não duplicar na ficha)
    registro_existente = db.query(models_ficha.FichaTecnicaInsumo).filter(
        models_ficha.FichaTecnicaInsumo.id_produto == id_produto,
        models_ficha.FichaTecnicaInsumo.id_insumo == composicao.id_insumo
    ).first()
    
    if registro_existente:
        raise HTTPException(status_code=400, detail="Este insumo já está na ficha técnica deste produto.")

    # Cria o relacionamento
    nova_composicao = models_ficha.FichaTecnicaInsumo(
        id_produto=id_produto,
        **composicao.model_dump()
    )
    
    db.add(nova_composicao)
    db.commit()
    db.refresh(nova_composicao)
    
    return nova_composicao

@router.get("/{id_produto}", response_model=schemas.ProdutoFichaCompletaResponse)
def buscar_ficha_tecnica(id_produto: int, db: Session = Depends(get_db)):
    """Busca os detalhes do produto juntamente com todos os materiais que ele consome."""
    produto = db.query(models_ficha.Produto).filter(models_ficha.Produto.id_produto == id_produto).first()
    if not produto:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
        
    return produto