# app/routers/camisetas/grades.py
"""Grades de tamanhos (segmento Camisetas)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas_cadastros import GradeEntrada, GradeResponse
from app.services.camisetas.grades import atualizar_grade, criar_grade, excluir_grade, listar_grades, resposta_da_grade

router = APIRouter()


@router.get("/grades/", response_model=List[GradeResponse])
def listar(incluir_inativas: bool = False, db: Session = Depends(get_db)):
    return listar_grades(db, incluir_inativas)


@router.post("/grades/", response_model=GradeResponse, status_code=status.HTTP_201_CREATED)
def criar(dados: GradeEntrada, db: Session = Depends(get_db)):
    return resposta_da_grade(db, criar_grade(db, dados))


@router.put("/grades/{id_grade}", response_model=GradeResponse)
def atualizar(id_grade: int, dados: GradeEntrada, db: Session = Depends(get_db)):
    return resposta_da_grade(db, atualizar_grade(db, id_grade, dados))


@router.delete("/grades/{id_grade}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(id_grade: int, db: Session = Depends(get_db)):
    excluir_grade(db, id_grade)
