# app/routers/camisetas/cores.py
"""Cadastro de cores (segmento Camisetas)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas_cadastros import CorEntrada, CorResponse
from app.services.camisetas.cores import atualizar_cor, criar_cor, excluir_cor, listar_cores

router = APIRouter()


@router.get("/cores/", response_model=List[CorResponse])
def listar(incluir_inativas: bool = False, db: Session = Depends(get_db)):
    return listar_cores(db, incluir_inativas)


@router.post("/cores/", response_model=CorResponse, status_code=status.HTTP_201_CREATED)
def criar(dados: CorEntrada, db: Session = Depends(get_db)):
    return criar_cor(db, dados)


@router.put("/cores/{id_cor}", response_model=CorResponse)
def atualizar(id_cor: int, dados: CorEntrada, db: Session = Depends(get_db)):
    return atualizar_cor(db, id_cor, dados)


@router.delete("/cores/{id_cor}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(id_cor: int, db: Session = Depends(get_db)):
    excluir_cor(db, id_cor)
