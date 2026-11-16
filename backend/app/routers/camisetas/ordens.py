# app/routers/camisetas/ordens.py
"""Ordens de produção: corte e rendimento (segmento Camisetas)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.camisetas import CamisetaOrdemProducao
from app.schemas.camisetas import (
    CamisetaOrdemProducaoCreate,
    CamisetaOrdemProducaoFinalizarCorte,
    CamisetaOrdemProducaoResponse,
)
from app.services.camisetas.ordens import abrir_op, montar_resposta_op, registrar_corte

router = APIRouter()


@router.get("/ordens/", response_model=List[CamisetaOrdemProducaoResponse])
def listar_ordens_corte(db: Session = Depends(get_db)):
    ops = db.query(CamisetaOrdemProducao).order_by(CamisetaOrdemProducao.id_op.desc()).all()
    return [montar_resposta_op(op) for op in ops]


@router.post("/ordens/", response_model=CamisetaOrdemProducaoResponse, status_code=status.HTTP_201_CREATED)
def abrir_ordem_corte(op_in: CamisetaOrdemProducaoCreate, db: Session = Depends(get_db)):
    """Abre a OP com uma linha por cor do enfesto e baixa o peso de cada rolo de malha."""
    return montar_resposta_op(abrir_op(db, op_in))


@router.put("/ordens/{id_op}/finalizar-corte", response_model=CamisetaOrdemProducaoResponse)
def finalizar_corte_op(id_op: int, corte_in: CamisetaOrdemProducaoFinalizarCorte, db: Session = Depends(get_db)):
    """Registra as peças cortadas por cor e tamanho (OP antiga: só o total) e calcula o rendimento."""
    return montar_resposta_op(registrar_corte(db, id_op, corte_in))
