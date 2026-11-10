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

router = APIRouter()

# ----------------- 7. COSTURA E TERCEIRIZAÇÃO - FACÇÕES (RF07) -----------------
@router.get("/costura/", response_model=List[CamisetaCosturaFaccaoResponse])
def listar_remessas_costura(db: Session = Depends(get_db)):
    remessas = db.query(CamisetaCosturaFaccao).order_by(CamisetaCosturaFaccao.id_costura.desc()).all()
    resultado = []
    for r in remessas:
        resultado.append(CamisetaCosturaFaccaoResponse(
            id_costura=r.id_costura,
            id_op=r.id_op,
            codigo_op=r.op.codigo_op if r.op else "OP",
            nome_modelo=r.op.modelo.nome_modelo if r.op and r.op.modelo else "Modelo",
            nome_faccao=r.nome_faccao,
            quantidade_enviada=r.quantidade_enviada,
            margem_seguranca_aviamentos_percentual=r.margem_seguranca_aviamentos_percentual,
            quantidade_retornada=r.quantidade_retornada,
            perdas_pecas=r.perdas_pecas,
            saldo_aprovado=r.saldo_aprovado,
            status=r.status,
            data_envio=r.data_envio,
            data_retorno=r.data_retorno,
            observacoes=r.observacoes
        ))
    return resultado

@router.post("/costura/enviar", response_model=CamisetaCosturaFaccaoResponse, status_code=status.HTTP_201_CREATED)
def enviar_para_faccao(envio_in: CamisetaCosturaFaccaoEnviar, db: Session = Depends(get_db)):
    """
    Envio: Seleciona a OP cortada, define a facção parceira de destino e aplica margens de segurança de aviamentos.
    """
    op = db.query(CamisetaOrdemProducao).filter_by(id_op=envio_in.id_op).first()
    if not op:
        raise HTTPException(status_code=404, detail="Ordem de corte não encontrada")

    if envio_in.quantidade_enviada <= 0:
        raise HTTPException(status_code=400, detail="Quantidade enviada deve ser maior que zero")

    # Calcula saldo de corte disponível
    total_ja_enviado = sum(r.quantidade_enviada or 0 for r in (op.movimentacoes_costura or []))
    pecas_cortadas = op.pecas_reais_cortadas or 0
    saldo_disponivel = max(0, pecas_cortadas - total_ja_enviado)

    if envio_in.quantidade_enviada > saldo_disponivel:
        raise HTTPException(
            status_code=400,
            detail=f"Quantidade a enviar ({envio_in.quantidade_enviada}) ultrapassa o saldo de painéis cortados disponíveis nesta OP ({saldo_disponivel})."
        )

    remessa = CamisetaCosturaFaccao(
        id_op=envio_in.id_op,
        nome_faccao=envio_in.nome_faccao,
        quantidade_enviada=envio_in.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=envio_in.margem_seguranca_aviamentos_percentual,
        status="Em Costura Externa",
        data_envio=get_utc_now(),
        observacoes=envio_in.observacoes
    )

    # O status geral da OP passa a ser 'Em Costura', mantendo a rastreabilidade detalhada na remessa
    op.status_op = "Em Costura"

    # Desconto dos aviamentos com os 3% (ou margem informada) de todos os aviamentos
    margem_perc = Decimal(str(envio_in.margem_seguranca_aviamentos_percentual if envio_in.margem_seguranca_aviamentos_percentual is not None else 3.00))
    multiplicador_margem = Decimal("1") + (margem_perc / Decimal("100"))
    qtd_enviada_dec = Decimal(str(envio_in.quantidade_enviada))

    itens_ficha = db.query(CamisetaFichaTecnica).filter_by(id_modelo=op.id_modelo).all()
    itens_aviamentos = [it for it in itens_ficha if (it.tipo_insumo != 'Tecido Principal')]

    if itens_aviamentos:
        for it in itens_aviamentos:
            qtd_consumo = Decimal(str(it.consumo_unitario)) * qtd_enviada_dec * multiplicador_margem
            if it.id_insumo:
                insumo = db.query(CamisetaInsumo).filter_by(id_insumo=it.id_insumo).first()
                if insumo:
                    insumo.saldo_atual = (insumo.saldo_atual or Decimal("0")) - qtd_consumo
                    insumo.atualizado_em = get_utc_now()
    else:
        aviamentos_cadastrados = db.query(CamisetaInsumo).filter_by(categoria='AVIAMENTO').all()
        for av in aviamentos_cadastrados:
            nome_ou_cod = (av.tipo_malha_ou_aviamento + " " + av.codigo).lower()
            if "linha" in nome_ou_cod or "fio" in nome_ou_cod or "carretel" in nome_ou_cod or "tubo" in nome_ou_cod:
                taxa_base = Decimal("0.02")
            else:
                taxa_base = Decimal("1.0")
            qtd_consumo = taxa_base * qtd_enviada_dec * multiplicador_margem
            av.saldo_atual = (av.saldo_atual or Decimal("0")) - qtd_consumo
            av.atualizado_em = get_utc_now()

    db.add(remessa)
    db.commit()
    db.refresh(remessa)

    return CamisetaCosturaFaccaoResponse(
        id_costura=remessa.id_costura,
        id_op=remessa.id_op,
        codigo_op=op.codigo_op,
        nome_modelo=op.modelo.nome_modelo if op.modelo else "Modelo",
        nome_faccao=remessa.nome_faccao,
        quantidade_enviada=remessa.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=remessa.margem_seguranca_aviamentos_percentual,
        quantidade_retornada=None,
        perdas_pecas=None,
        saldo_aprovado=None,
        status=remessa.status,
        data_envio=remessa.data_envio,
        data_retorno=None,
        observacoes=remessa.observacoes
    )

@router.put("/costura/{id_costura}/retornar", response_model=CamisetaCosturaFaccaoResponse)
def registrar_retorno_faccao(id_costura: int, retorno_in: CamisetaCosturaFaccaoRetornar, db: Session = Depends(get_db)):
    """
    Retorno:
    1. Registra a quantidade física de camisetas costuradas que retornaram à fábrica.
    2. Apura eventuais perdas de lote (peças avariadas ou extraviadas = enviada - retornada).
    3. Injeta o saldo aprovado de camisetas prontas no Estoque de Produtos Acabados para expedição.
    """
    remessa = db.query(CamisetaCosturaFaccao).filter_by(id_costura=id_costura).first()
    if not remessa:
        raise HTTPException(status_code=404, detail="Remessa de costura não encontrada")

    if retorno_in.quantidade_retornada < 0:
        raise HTTPException(status_code=400, detail="Quantidade retornada não pode ser negativa")

    remessa.quantidade_retornada = retorno_in.quantidade_retornada
    remessa.data_retorno = get_utc_now()
    remessa.status = "Retornado e Conferido"

    # Apura perdas
    perdas = remessa.quantidade_enviada - retorno_in.quantidade_retornada
    remessa.perdas_pecas = max(perdas, 0)
    remessa.saldo_aprovado = retorno_in.quantidade_retornada
    if retorno_in.observacoes:
        remessa.observacoes = (remessa.observacoes or "") + " | Retorno: " + retorno_in.observacoes

    # Injeta saldo aprovado no Estoque de Produtos Acabados
    if remessa.op and remessa.op.id_modelo:
        id_mod = remessa.op.id_modelo
        estoque_acabado = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=id_mod).first()
        if not estoque_acabado:
            estoque_acabado = CamisetaProdutoAcabado(
                id_modelo=id_mod,
                quantidade_total=remessa.saldo_aprovado,
                atualizado_em=get_utc_now()
            )
            db.add(estoque_acabado)
        else:
            estoque_acabado.quantidade_total = (estoque_acabado.quantidade_total or 0) + remessa.saldo_aprovado
            estoque_acabado.atualizado_em = get_utc_now()

    if remessa.op:
        remessa.op.status_op = "Costura Finalizada"

    db.commit()
    db.refresh(remessa)

    return CamisetaCosturaFaccaoResponse(
        id_costura=remessa.id_costura,
        id_op=remessa.id_op,
        codigo_op=remessa.op.codigo_op if remessa.op else "OP",
        nome_modelo=remessa.op.modelo.nome_modelo if remessa.op and remessa.op.modelo else "Modelo",
        nome_faccao=remessa.nome_faccao,
        quantidade_enviada=remessa.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=remessa.margem_seguranca_aviamentos_percentual,
        quantidade_retornada=remessa.quantidade_retornada,
        perdas_pecas=remessa.perdas_pecas,
        saldo_aprovado=remessa.saldo_aprovado,
        status=remessa.status,
        data_envio=remessa.data_envio,
        data_retorno=remessa.data_retorno,
        observacoes=remessa.observacoes
    )
