# app/routers/camisetas/modelos.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
import re
from datetime import datetime, timezone, timedelta, date
from decimal import Decimal

from app.database import get_db
from app.models.camisetas import (
    CamisetaModelo,
    CamisetaInsumo,
    CamisetaFichaTecnica,
    CamisetaEntradaInsumo,
    CamisetaPedido,
    CamisetaOrdemProducao,
    CamisetaCosturaFaccao,
    CamisetaProdutoAcabado,
    CamisetaRegistroFinanceiro,
    get_utc_now
)
from app.schemas.camisetas import (
    CamisetaModeloCreate, CamisetaModeloResponse,
    CamisetaInsumoCreate, CamisetaInsumoResponse,
    CamisetaEntradaInsumoCreate, CamisetaEntradaInsumoResponse,
    CamisetaFichaTecnicaCreate, CamisetaFichaTecnicaResponse,
    CamisetaPedidoCreate, CamisetaPedidoStatusUpdate, CamisetaPedidoEntregar, CamisetaPedidoResponse,
    CamisetaProdutoAcabadoResponse,
    CamisetaOrdemProducaoCreate, CamisetaOrdemProducaoFinalizarCorte, CamisetaOrdemProducaoResponse,
    CamisetaCosturaFaccaoEnviar, CamisetaCosturaFaccaoRetornar, CamisetaCosturaFaccaoResponse,
    CamisetaRegistroFinanceiroCreate, CamisetaRegistroFinanceiroResponse, CamisetaApuracaoMensalResponse,
    CamisetaDashboardCompletoResponse, CamisetaCardDestaque, CamisetaItemFinanceiroMensal
)

router = APIRouter()

# ----------------- 4. MODELOS & FICHA TÉCNICA DIGITAL (RF04) -----------------
@router.get("/modelos/", response_model=List[CamisetaModeloResponse])
def listar_modelos(db: Session = Depends(get_db)):
    return db.query(CamisetaModelo).order_by(CamisetaModelo.nome_modelo.asc()).all()

@router.post("/modelos/", response_model=CamisetaModeloResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_modelo(modelo_in: CamisetaModeloCreate, db: Session = Depends(get_db)):
    existente = db.query(CamisetaModelo).filter_by(nome_modelo=modelo_in.nome_modelo).first()
    if existente:
        raise HTTPException(status_code=400, detail="Modelo com esse nome já cadastrado")

    novo_mod = CamisetaModelo(
        nome_modelo=modelo_in.nome_modelo,
        grade_disponivel=modelo_in.grade_disponivel,
        consumo_tecido_kg=modelo_in.consumo_tecido_kg,
        descricao=modelo_in.descricao
    )
    db.add(novo_mod)
    db.commit()
    db.refresh(novo_mod)
    return novo_mod

@router.get("/fichas/", response_model=List[CamisetaFichaTecnicaResponse])
def listar_fichas(id_modelo: Optional[int] = None, db: Session = Depends(get_db)):
    query = db.query(CamisetaFichaTecnica)
    if id_modelo:
        query = query.filter_by(id_modelo=id_modelo)
    return query.all()

@router.post("/fichas/", response_model=CamisetaFichaTecnicaResponse, status_code=status.HTTP_201_CREATED)
def adicionar_item_ficha(ficha_in: CamisetaFichaTecnicaCreate, db: Session = Depends(get_db)):
    modelo = db.query(CamisetaModelo).filter_by(id_modelo=ficha_in.id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo de camiseta não encontrado")

    item = CamisetaFichaTecnica(
        id_modelo=ficha_in.id_modelo,
        id_insumo=ficha_in.id_insumo,
        tipo_insumo=ficha_in.tipo_insumo,
        descricao_insumo=ficha_in.descricao_insumo,
        consumo_unitario=ficha_in.consumo_unitario,
        unidade_medida=ficha_in.unidade_medida,
        custo_unitario_estimado=ficha_in.custo_unitario_estimado
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/fichas/{id_ficha}", status_code=status.HTTP_204_NO_CONTENT)
def remover_item_ficha(id_ficha: int, db: Session = Depends(get_db)):
    item = db.query(CamisetaFichaTecnica).filter_by(id_ficha=id_ficha).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item da ficha técnica não encontrado")
    db.delete(item)
    db.commit()
    return None
