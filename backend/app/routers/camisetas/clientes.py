# app/routers/camisetas/clientes.py
"""Cadastro de clientes (segmento Camisetas)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.camisetas_cadastros import ClienteEntrada, ClienteResponse
from app.services.camisetas.clientes import (
    LIMITE_PADRAO,
    atualizar_cliente,
    criar_cliente,
    excluir_cliente,
    listar_clientes,
    obter_cliente,
    resposta_do_cliente,
)

router = APIRouter()


@router.get("/clientes/", response_model=List[ClienteResponse])
def listar(
    busca: Optional[str] = Query(None, max_length=100),
    incluir_inativos: bool = False,
    limite: int = Query(LIMITE_PADRAO, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return listar_clientes(db, busca, incluir_inativos, limite)


@router.post("/clientes/", response_model=ClienteResponse, status_code=status.HTTP_201_CREATED)
def criar(dados: ClienteEntrada, db: Session = Depends(get_db)):
    return resposta_do_cliente(db, criar_cliente(db, dados))


@router.get("/clientes/{id_cliente}", response_model=ClienteResponse)
def detalhar(id_cliente: int, db: Session = Depends(get_db)):
    return resposta_do_cliente(db, obter_cliente(db, id_cliente))


@router.put("/clientes/{id_cliente}", response_model=ClienteResponse)
def atualizar(id_cliente: int, dados: ClienteEntrada, db: Session = Depends(get_db)):
    return resposta_do_cliente(db, atualizar_cliente(db, id_cliente, dados))


@router.delete("/clientes/{id_cliente}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(id_cliente: int, db: Session = Depends(get_db)):
    excluir_cliente(db, id_cliente)
