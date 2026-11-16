# app/routers/camisetas/estampas.py
"""Catálogo visual do Banco de Estampas (segmento Camisetas)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas_estampas import EstampaCreate, EstampaResponse, EstampaUpdate
from app.services.camisetas.estampas import (
    atualizar_estampa,
    criar_estampa,
    excluir_estampa,
    listar_estampas,
    obter_estampa,
)

router = APIRouter()


@router.get("/estampas/", response_model=List[EstampaResponse])
def listar(
    busca: Optional[str] = None,
    incluir_inativas: bool = False,
    db: Session = Depends(get_db),
):
    return listar_estampas(db, busca=busca, incluir_inativas=incluir_inativas)


@router.post("/estampas/", response_model=EstampaResponse, status_code=status.HTTP_201_CREATED)
def criar(dados: EstampaCreate, db: Session = Depends(get_db)):
    return criar_estampa(db, dados)


@router.get("/estampas/{id_estampa}", response_model=EstampaResponse)
def obter(id_estampa: int, db: Session = Depends(get_db)):
    return obter_estampa(db, id_estampa)


@router.get("/estampas/{id_estampa}/imagem")
def obter_imagem(id_estampa: int, db: Session = Depends(get_db)):
    estampa = obter_estampa(db, id_estampa)
    return Response(
        content=estampa.imagem_bytes,
        media_type=estampa.imagem_mime,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.put("/estampas/{id_estampa}", response_model=EstampaResponse)
def atualizar(id_estampa: int, dados: EstampaUpdate, db: Session = Depends(get_db)):
    return atualizar_estampa(db, id_estampa, dados)


@router.delete("/estampas/{id_estampa}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(id_estampa: int, db: Session = Depends(get_db)):
    excluir_estampa(db, id_estampa)
