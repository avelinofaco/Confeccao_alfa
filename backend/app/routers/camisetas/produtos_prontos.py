# app/routers/camisetas/produtos_prontos.py
"""Produtos Prontos: estoque de peças acabadas por modelo, cor e tamanho."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas_sku import (
    AjusteEntrada,
    InventarioEntrada,
    InventarioResultado,
    LinhaProdutoPronto,
    MinimoEntrada,
    MovimentoResponse,
    VariacaoResponse,
)
from app.services.camisetas import produtos_prontos as servico

router = APIRouter()


@router.get("/produtos-prontos/", response_model=List[LinhaProdutoPronto])
def listar_produtos_prontos(id_modelo: Optional[int] = None, id_cor: Optional[int] = None,
                            abaixo_minimo: bool = False, db: Session = Depends(get_db)):
    return servico.listar_produtos_prontos(db, id_modelo, id_cor, abaixo_minimo)


@router.post("/produtos-prontos/inventario", response_model=InventarioResultado)
def registrar_inventario(dados: InventarioEntrada, db: Session = Depends(get_db)):
    return servico.registrar_inventario(db, dados)


@router.post("/produtos-prontos/ajustes", response_model=VariacaoResponse)
def registrar_ajuste(dados: AjusteEntrada, db: Session = Depends(get_db)):
    return servico.registrar_ajuste(db, dados)


@router.put("/produtos-prontos/variacoes/{id_variacao}/minimo", response_model=VariacaoResponse)
def definir_minimo(id_variacao: int, dados: MinimoEntrada, db: Session = Depends(get_db)):
    return servico.definir_minimo(db, id_variacao, dados.estoque_minimo)


@router.get("/produtos-prontos/movimentos/", response_model=List[MovimentoResponse])
def listar_movimentos(id_variacao: Optional[int] = None, id_modelo: Optional[int] = None, tipo: Optional[str] = None,
                      limite: int = Query(servico.LIMITE_MOVIMENTOS, ge=1, le=500), db: Session = Depends(get_db)):
    return servico.listar_movimentos(db, id_variacao, id_modelo, tipo, limite)
