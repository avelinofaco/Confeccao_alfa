# app/routers/camisetas/financeiro.py
"""Financeiro do segmento Camisetas: valores calculados a partir das movimentações reais."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.database import get_db
from app.models.camisetas import CamisetaRegistroFinanceiro
from app.schemas.camisetas import (
    CamisetaApuracaoMensalResponse,
    CamisetaRegistroFinanceiroCreate,
    CamisetaRegistroFinanceiroResponse,
)
from app.services.camisetas.financeiro import (
    ApuracaoMensal,
    MesAnoInvalido,
    apurar_ano,
    apurar_mes,
    validar_mes_ano,
)

router = APIRouter()


def para_resposta_registro(apuracao: ApuracaoMensal) -> CamisetaRegistroFinanceiroResponse:
    return CamisetaRegistroFinanceiroResponse(
        id_registro=apuracao.id_registro,
        mes_ano=apuracao.mes_ano,
        valor_gasto_materiais=apuracao.gasto_materiais,
        faturamento_receita=apuracao.faturamento,
        outros_custos_operacionais=apuracao.outros_custos,
        lucro_liquido=apuracao.lucro,
        observacoes=apuracao.observacoes,
        criado_em=apuracao.criado_em,
        qtd_pedidos_entregues=apuracao.qtd_pedidos_entregues,
        qtd_entradas=apuracao.qtd_entradas,
    )


def _validar_ou_422(mes_ano: str) -> None:
    try:
        validar_mes_ano(mes_ano)
    except MesAnoInvalido as erro:
        raise HTTPException(status_code=422, detail=str(erro)) from erro


@router.get("/financeiro/", response_model=List[CamisetaRegistroFinanceiroResponse])
def listar_financeiro(ano: Optional[int] = Query(None, ge=2000, le=2100), db: Session = Depends(get_db)):
    """Os 12 meses do ano (padrão: ano corrente), calculados na hora."""
    ano_referencia = ano or datetime.now(FUSO_HORARIO).year
    return [para_resposta_registro(a) for a in apurar_ano(db, ano_referencia)]


@router.get("/financeiro/apuracao-mensal/", response_model=CamisetaApuracaoMensalResponse)
def apurar_financeiro_mensal(
    mes_ano: str = Query(..., description="Mês no formato AAAA-MM, ex.: 2026-10"),
    db: Session = Depends(get_db),
):
    _validar_ou_422(mes_ano)
    apuracao = apurar_mes(db, mes_ano)
    return CamisetaApuracaoMensalResponse(
        mes_ano=apuracao.mes_ano,
        tem_dados_reais=apuracao.tem_dados_reais,
        gasto_materiais_real=apuracao.gasto_materiais,
        faturamento_vendas_real=apuracao.faturamento,
        outros_custos=apuracao.outros_custos,
        lucro_apurado=apuracao.lucro,
        qtd_entradas_estoque=apuracao.qtd_entradas,
        qtd_pedidos_vendas=apuracao.qtd_pedidos_entregues,
    )


@router.post("/financeiro/", response_model=CamisetaRegistroFinanceiroResponse, status_code=status.HTTP_201_CREATED)
def lancar_outros_custos(reg_in: CamisetaRegistroFinanceiroCreate, db: Session = Depends(get_db)):
    """Grava só os outros custos e as observações do mês; o resto é calculado."""
    _validar_ou_422(reg_in.mes_ano)
    if reg_in.outros_custos_operacionais < 0:
        raise HTTPException(status_code=400, detail="Outros custos não pode ser negativo.")

    registro = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=reg_in.mes_ano).first()
    if registro is None:
        registro = CamisetaRegistroFinanceiro(mes_ano=reg_in.mes_ano)
        db.add(registro)
    registro.outros_custos_operacionais = reg_in.outros_custos_operacionais
    registro.observacoes = reg_in.observacoes
    db.commit()
    return para_resposta_registro(apurar_mes(db, reg_in.mes_ano))
