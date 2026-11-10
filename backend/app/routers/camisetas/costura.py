# app/routers/camisetas/costura.py
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
from app.services.camisetas.costura import (
    STATUS_OP_EM_COSTURA,
    STATUS_REMESSA_EM_COSTURA,
    STATUS_REMESSA_RETORNADA,
    montar_resposta_remessa,
    status_op_apos_retorno,
)
from app.services.camisetas.estoque import (
    AVISO_SEM_AVIAMENTOS,
    TIPO_TECIDO_PRINCIPAL,
    aplicar_baixa,
    calcular_necessidades,
    listar_faltas,
    obter_ou_criar_estoque_acabado,
)

router = APIRouter()

# ----------------- 7. COSTURA E TERCEIRIZAÇÃO - FACÇÕES (RF07) -----------------
@router.get("/costura/", response_model=List[CamisetaCosturaFaccaoResponse])
def listar_remessas_costura(db: Session = Depends(get_db)):
    remessas = db.query(CamisetaCosturaFaccao).order_by(CamisetaCosturaFaccao.id_costura.desc()).all()
    return [montar_resposta_remessa(r) for r in remessas]


@router.post("/costura/enviar", response_model=CamisetaCosturaFaccaoResponse, status_code=status.HTTP_201_CREATED)
def enviar_para_faccao(envio_in: CamisetaCosturaFaccaoEnviar, db: Session = Depends(get_db)):
    """Envia painéis cortados para a facção e baixa os aviamentos da ficha técnica (com margem)."""
    op = db.query(CamisetaOrdemProducao).filter_by(id_op=envio_in.id_op).first()
    if not op:
        raise HTTPException(status_code=404, detail="Ordem de corte não encontrada")
    if envio_in.quantidade_enviada <= 0:
        raise HTTPException(status_code=400, detail="Quantidade enviada deve ser maior que zero")

    total_ja_enviado = sum(r.quantidade_enviada or 0 for r in (op.movimentacoes_costura or []))
    saldo_disponivel = max(0, (op.pecas_reais_cortadas or 0) - total_ja_enviado)
    if envio_in.quantidade_enviada > saldo_disponivel:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Quantidade a enviar ({envio_in.quantidade_enviada}) ultrapassa o saldo de painéis "
                f"cortados disponíveis nesta OP ({saldo_disponivel})."
            ),
        )

    itens_ficha = db.query(CamisetaFichaTecnica).filter(
        CamisetaFichaTecnica.id_modelo == op.id_modelo,
        CamisetaFichaTecnica.tipo_insumo != TIPO_TECIDO_PRINCIPAL,
    ).all()
    necessidades = calcular_necessidades(
        itens_ficha, envio_in.quantidade_enviada, envio_in.margem_seguranca_aviamentos_percentual
    )
    faltas = listar_faltas(necessidades)
    if faltas and not envio_in.confirmar_saldo_insuficiente:
        raise HTTPException(
            status_code=409,
            detail={
                "mensagem": "Aviamentos insuficientes no estoque para este envio.",
                "faltas": [f.para_dict() for f in faltas],
            },
        )

    remessa = CamisetaCosturaFaccao(
        id_op=envio_in.id_op,
        nome_faccao=envio_in.nome_faccao,
        quantidade_enviada=envio_in.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=envio_in.margem_seguranca_aviamentos_percentual,
        status=STATUS_REMESSA_EM_COSTURA,
        data_envio=get_utc_now(),
        observacoes=envio_in.observacoes,
    )
    db.add(remessa)
    op.status_op = STATUS_OP_EM_COSTURA
    aplicar_baixa(necessidades)
    avisos = [] if necessidades else [AVISO_SEM_AVIAMENTOS]

    db.commit()
    db.refresh(remessa)
    return montar_resposta_remessa(remessa, avisos)


@router.put("/costura/{id_costura}/retornar", response_model=CamisetaCosturaFaccaoResponse)
def registrar_retorno_faccao(id_costura: int, retorno_in: CamisetaCosturaFaccaoRetornar, db: Session = Depends(get_db)):
    """Registra o retorno da facção, apura perdas e lança as peças aprovadas no estoque pronto."""
    remessa = db.query(CamisetaCosturaFaccao).filter_by(id_costura=id_costura).first()
    if not remessa:
        raise HTTPException(status_code=404, detail="Remessa de costura não encontrada")
    if remessa.status != STATUS_REMESSA_EM_COSTURA:
        raise HTTPException(status_code=409, detail="Esta remessa já teve o retorno registrado.")
    if retorno_in.quantidade_retornada < 0:
        raise HTTPException(status_code=400, detail="Quantidade retornada não pode ser negativa")
    if retorno_in.quantidade_retornada > remessa.quantidade_enviada:
        raise HTTPException(
            status_code=400,
            detail=f"O retorno ({retorno_in.quantidade_retornada}) não pode ser maior que o enviado ({remessa.quantidade_enviada}).",
        )

    remessa.quantidade_retornada = retorno_in.quantidade_retornada
    remessa.data_retorno = get_utc_now()
    remessa.status = STATUS_REMESSA_RETORNADA
    remessa.perdas_pecas = remessa.quantidade_enviada - retorno_in.quantidade_retornada
    remessa.saldo_aprovado = retorno_in.quantidade_retornada
    if retorno_in.observacoes:
        remessa.observacoes = (remessa.observacoes or "") + " | Retorno: " + retorno_in.observacoes

    if remessa.op and remessa.op.id_modelo:
        estoque = obter_ou_criar_estoque_acabado(db, remessa.op.id_modelo)
        estoque.quantidade_total = (estoque.quantidade_total or 0) + remessa.saldo_aprovado
        estoque.atualizado_em = get_utc_now()

    db.flush()
    if remessa.op:
        remessa.op.status_op = status_op_apos_retorno(
            remessa.op.pecas_reais_cortadas or 0, remessa.op.movimentacoes_costura
        )

    db.commit()
    db.refresh(remessa)
    return montar_resposta_remessa(remessa)
