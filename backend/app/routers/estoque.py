# app/routers/estoque.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from app.database import get_db
from app.models import estoque as models
from app.schemas import estoque as schemas

# Criamos um roteador para agrupar tudo que é de estoque
router = APIRouter(
    prefix="/estoque",
    tags=["Estoque"]
)

@router.post("/insumos", response_model=schemas.InsumoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_insumo(insumo: schemas.InsumoCreate, db: Session = Depends(get_db)):
    """Cadastra um novo material (Malha ou Aviamento) no sistema."""
    
    # Verifica se o código já existe para não dar erro no banco
    db_insumo = db.query(models.Insumo).filter(models.Insumo.codigo == insumo.codigo).first()
    if db_insumo:
        raise HTTPException(status_code=400, detail="Já existe um material com este código.")
    
    # Transforma o Schema validado em um Model do SQLAlchemy e salva
    novo_insumo = models.Insumo(**insumo.model_dump())
    db.add(novo_insumo)
    db.commit()
    db.refresh(novo_insumo)
    
    return novo_insumo

@router.get("/insumos", response_model=List[schemas.InsumoResponse])
def listar_insumos(db: Session = Depends(get_db)):
    """Retorna a lista de todos os insumos cadastrados (para exibir na tabela do React)."""
    return db.query(models.Insumo).all()

@router.post("/entradas", response_model=schemas.EntradaEstoqueResponse, status_code=status.HTTP_201_CREATED)
def registrar_entrada(entrada: schemas.EntradaEstoqueCreate, db: Session = Depends(get_db)):
    """Registra a chegada de material e atualiza automaticamente o saldo atual."""
    
    # 1. Verifica se o insumo existe
    insumo = db.query(models.Insumo).filter(models.Insumo.id_insumo == entrada.id_insumo).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Material não encontrado.")
    
    # 2. Registra o histórico da entrada
    nova_entrada = models.EntradaEstoque(**entrada.model_dump())
    db.add(nova_entrada)
    
    # 3. Regra de Negócio: Atualiza a quantidade total do insumo
    insumo.quantidade_atual += entrada.quantidade_recebida
    
    db.commit()
    db.refresh(nova_entrada)
    
    return nova_entrada

@router.delete("/{id_insumo}")
def deletar_insumo(id_insumo: int, db: Session = Depends(get_db)):
    insumo_banco = db.query(models.Insumo).filter(models.Insumo.id_insumo == id_insumo).first()
    
    if not insumo_banco:
        raise HTTPException(status_code=404, detail="Insumo não encontrado.")
    
    try:
        db.delete(insumo_banco)
        db.commit()
        return {"mensagem": "Insumo deletado com sucesso!"}
    
    except IntegrityError:
        # Se der erro de integridade (já tem movimentação), desfazemos a operação e avisamos o Front-end
        db.rollback()
        raise HTTPException(
            status_code=400, 
            detail="Não é possível excluir este insumo pois ele possui entradas ou lotes vinculados."
        )