# app/routers/camisetas/insumos.py
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
from app.schemas.camisetas import CamisetaInsumoUpdate
from app.services.camisetas.cores import validar_cor_opcional
from app.services.camisetas.estoque import calcular_custo_medio
from app.services.camisetas.insumos import atualizar_insumo, excluir_insumo, montar_resposta_insumo
from app.core.erros import ErroNegocio

router = APIRouter()

# ----------------- 3. GESTÃO DE ESTOQUE DE INSUMOS (RF03) -----------------
@router.get("/insumos/", response_model=List[CamisetaInsumoResponse])
def listar_insumos(categoria: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(CamisetaInsumo)
    if categoria:
        cat_u = categoria.upper()
        if cat_u in ["AVIAMENTO", "LINHA", "ETIQUETA", "TAG"]:
            query = query.filter(CamisetaInsumo.categoria.in_(["AVIAMENTO", "LINHA", "ETIQUETA", "TAG", "OUTRO_AVIAMENTO"]))
        else:
            query = query.filter(CamisetaInsumo.categoria == cat_u)
    return [montar_resposta_insumo(i) for i in query.order_by(CamisetaInsumo.codigo.asc()).all()]

@router.post("/insumos/", response_model=CamisetaInsumoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_insumo(insumo_in: CamisetaInsumoCreate, db: Session = Depends(get_db)):
    validar_cor_opcional(db, insumo_in.id_cor)
    # Geração automática de código caso não enviado
    codigo_final = (insumo_in.codigo or "").strip()
    if not codigo_final:
        cat = (insumo_in.categoria or "ROLO_TECIDO").upper()
        if cat == "ROLO_TECIDO":
            prefixo = "MALHA-"
        elif cat == "LINHA":
            prefixo = "AV-LINHA-"
        elif cat == "TAG":
            prefixo = "AV-TAG-"
        elif cat == "ETIQUETA":
            prefixo = "AV-ETIQ-"
        else:
            prefixo = "AV-"

        existentes = db.query(CamisetaInsumo).all()
        numeros = []
        for it in existentes:
            cod = (it.codigo or "").upper()
            if cod.startswith(prefixo):
                nums = re.findall(r'\d+', cod)
                if nums:
                    numeros.append(int(nums[-1]))
        proximo = (max(numeros) + 1) if numeros else 1
        codigo_final = f"{prefixo}{proximo:02d}"

    # Valida código duplicado
    existente = db.query(CamisetaInsumo).filter_by(codigo=codigo_final).first()
    if existente:
        raise HTTPException(status_code=400, detail="Já existe um insumo cadastrado com este código")

    novo_insumo = CamisetaInsumo(
        codigo=codigo_final,
        categoria=insumo_in.categoria.upper(),
        tipo_malha_ou_aviamento=insumo_in.tipo_malha_ou_aviamento,
        cor=insumo_in.cor,
        unidade_medida=insumo_in.unidade_medida.lower(),
        saldo_atual=insumo_in.saldo_atual,
        estoque_minimo=insumo_in.estoque_minimo,
        preco_custo_medio=insumo_in.preco_custo_medio,
        id_cor=insumo_in.id_cor,
    )
    db.add(novo_insumo)
    db.commit()
    db.refresh(novo_insumo)
    return montar_resposta_insumo(novo_insumo)

@router.post("/insumos/entrada/", response_model=CamisetaEntradaInsumoResponse, status_code=status.HTTP_201_CREATED)
def registrar_entrada_estoque(entrada_in: CamisetaEntradaInsumoCreate, db: Session = Depends(get_db)):
    """Botão de lançamento rápido para registrar compras e notas fiscais com atualização de saldo imediata."""
    insumo = db.query(CamisetaInsumo).filter_by(id_insumo=entrada_in.id_insumo).first()
    if not insumo:
        raise HTTPException(status_code=404, detail="Insumo não encontrado")

    if entrada_in.quantidade <= 0:
        raise HTTPException(status_code=400, detail="Quantidade deve ser maior que zero")
    if (entrada_in.valor_total or Decimal("0")) < 0:
        raise HTTPException(status_code=400, detail="O valor da nota fiscal não pode ser negativo")

    nova_entrada = CamisetaEntradaInsumo(
        id_insumo=entrada_in.id_insumo,
        numero_nota_fiscal=entrada_in.numero_nota_fiscal,
        fornecedor=entrada_in.fornecedor,
        quantidade=entrada_in.quantidade,
        valor_total=entrada_in.valor_total,
        data_entrada=get_utc_now()
    )
    db.add(nova_entrada)

    # Custo médio ponderado é calculado com o saldo ANTES da entrada
    saldo_anterior = insumo.saldo_atual or Decimal("0")
    insumo.preco_custo_medio = calcular_custo_medio(
        saldo_anterior,
        insumo.preco_custo_medio or Decimal("0"),
        entrada_in.quantidade,
        entrada_in.valor_total or Decimal("0"),
    )
    insumo.saldo_atual = saldo_anterior + entrada_in.quantidade
    insumo.atualizado_em = get_utc_now()

    db.commit()
    db.refresh(nova_entrada)
    return nova_entrada


@router.put("/insumos/{id_insumo}", response_model=CamisetaInsumoResponse)
def editar_insumo(id_insumo: int, dados: CamisetaInsumoUpdate, db: Session = Depends(get_db)):
    """Edição cadastral: não altera saldo nem custo médio."""
    return montar_resposta_insumo(atualizar_insumo(db, id_insumo, dados))


@router.delete("/insumos/{id_insumo}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_insumo(id_insumo: int, db: Session = Depends(get_db)):
    """Remove o insumo do estoque. Bloqueado se houver fichas técnicas ou histórico de entradas vinculados."""
    excluir_insumo(db, id_insumo)
