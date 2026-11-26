# app/routers/camisetas/financeiro.py
"""Financeiro do segmento Camisetas: valores calculados, despesas categorizadas, recebimentos e DRE."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.database import get_db
from app.models.camisetas import CamisetaRegistroFinanceiro
from app.schemas.camisetas import (
    CamisetaApuracaoMensalResponse,
    CamisetaDespesaCreate,
    CamisetaDespesaPagar,
    CamisetaDespesaResponse,
    CamisetaDreMensalResponse,
    CamisetaPedidoFinanceiroItem,
    CamisetaPedidoPagamentoUpdate,
    CamisetaRegistroFinanceiroCreate,
    CamisetaRegistroFinanceiroResponse,
)
from app.services.camisetas.financeiro import (
    ApuracaoMensal,
    MesAnoInvalido,
    apurar_ano,
    apurar_dre_mensal,
    apurar_mes,
    atualizar_pagamento_pedido,
    criar_despesa,
    excluir_despesa,
    listar_despesas,
    quitar_despesa,
    validar_mes_ano,
)

router = APIRouter()


def para_resposta_registro(apuracao: ApuracaoMensal) -> CamisetaRegistroFinanceiroResponse:
    return CamisetaRegistroFinanceiroResponse(
        id_registro=apuracao.id_registro,
        mes_ano=apuracao.mes_ano,
        valor_gasto_materiais=apuracao.gasto_materiais,
        faturamento_receita=apuracao.faturamento,
        outros_custos_avulsos=apuracao.outros_custos_avulsos,
        total_despesas_operacionais=apuracao.outros_custos,
        lucro_liquido=apuracao.lucro,
        observacoes=apuracao.observacoes,
        criado_em=apuracao.criado_em,
        qtd_pedidos_entregues=apuracao.qtd_pedidos_entregues,
        qtd_entradas=apuracao.qtd_entradas,
        qtd_despesas=apuracao.qtd_despesas,
        total_despesas_lancadas=apuracao.total_despesas_lancadas,
        despesas_pagas=apuracao.despesas_pagas,
        despesas_pendentes=apuracao.despesas_pendentes,
        receita_recebida=apuracao.receita_recebida,
        receita_a_receber=apuracao.receita_a_receber,
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
    """Grava só o custo avulso e as observações do mês; o resto é calculado.

    Campo que não veio no corpo não é alterado: salvar só a observação deixa o custo
    avulso já gravado intacto.
    """
    _validar_ou_422(reg_in.mes_ano)
    avulso = reg_in.outros_custos_avulsos
    if avulso is not None and avulso < 0:
        raise HTTPException(status_code=400, detail="Outros custos não pode ser negativo.")

    registro = db.query(CamisetaRegistroFinanceiro).filter_by(mes_ano=reg_in.mes_ano).first()
    if registro is None:
        registro = CamisetaRegistroFinanceiro(mes_ano=reg_in.mes_ano, outros_custos_operacionais=0)
        db.add(registro)
    enviados = reg_in.model_fields_set
    if avulso is not None:
        registro.outros_custos_operacionais = avulso
    if "observacoes" in enviados:
        registro.observacoes = reg_in.observacoes
    db.commit()
    return para_resposta_registro(apurar_mes(db, reg_in.mes_ano))


@router.get("/financeiro/dre/", response_model=CamisetaDreMensalResponse)
def obter_dre_mensal(
    mes_ano: str = Query(..., description="Mês no formato AAAA-MM, ex.: 2026-10"),
    db: Session = Depends(get_db),
):
    _validar_ou_422(mes_ano)
    return apurar_dre_mensal(db, mes_ano)


@router.get("/financeiro/despesas/", response_model=List[CamisetaDespesaResponse])
def listar_despesas_do_mes(
    mes_ano: str = Query(..., description="Mês no formato AAAA-MM, ex.: 2026-10"),
    db: Session = Depends(get_db),
):
    _validar_ou_422(mes_ano)
    return listar_despesas(db, mes_ano)


@router.post(
    "/financeiro/despesas/",
    response_model=CamisetaDespesaResponse,
    status_code=status.HTTP_201_CREATED,
)
def lancar_despesa(dados: CamisetaDespesaCreate, db: Session = Depends(get_db)):
    _validar_ou_422(dados.mes_ano)
    return criar_despesa(db, dados)


@router.put("/financeiro/despesas/{id_despesa}/pagar", response_model=CamisetaDespesaResponse)
def pagar_despesa(id_despesa: int, dados: CamisetaDespesaPagar, db: Session = Depends(get_db)):
    return quitar_despesa(db, id_despesa, dados)


@router.delete("/financeiro/despesas/{id_despesa}", status_code=status.HTTP_204_NO_CONTENT)
def remover_despesa(id_despesa: int, db: Session = Depends(get_db)):
    excluir_despesa(db, id_despesa)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put(
    "/financeiro/pedidos/{id_pedido}/pagamento",
    response_model=CamisetaPedidoFinanceiroItem,
)
def alterar_pagamento_pedido(
    id_pedido: int,
    dados: CamisetaPedidoPagamentoUpdate,
    db: Session = Depends(get_db),
):
    return atualizar_pagamento_pedido(db, id_pedido, dados)
