# app/routers/camisetas/ordens.py
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
from app.services.sequencias import proximo_codigo

router = APIRouter()

# ----------------- 5. CORTE E RENDIMENTO - PCP (RF05) -----------------
@router.get("/ordens/", response_model=List[CamisetaOrdemProducaoResponse])
def listar_ordens_corte(db: Session = Depends(get_db)):
    ops = db.query(CamisetaOrdemProducao).order_by(CamisetaOrdemProducao.id_op.desc()).all()
    resultado = []
    for op in ops:
        total_enviado_costura = sum(r.quantidade_enviada or 0 for r in (op.movimentacoes_costura or []))
        pecas_reais = op.pecas_reais_cortadas or 0
        saldo_disp = max(0, pecas_reais - total_enviado_costura)
        # Normaliza o status da OP para terminologia industrial limpa
        status_exibicao = op.status_op or "Aguardando Corte"
        if "Envio Parcial" in status_exibicao or "Facção" in status_exibicao or "Oficina" in status_exibicao:
            status_exibicao = "Em Costura"

        resultado.append(CamisetaOrdemProducaoResponse(
            id_op=op.id_op,
            codigo_op=op.codigo_op,
            id_modelo=op.id_modelo,
            nome_modelo=op.modelo.nome_modelo if op.modelo else "Modelo",
            id_insumo_tecido=op.id_insumo_tecido,
            nome_tecido=op.tecido.tipo_malha_ou_aviamento if op.tecido else "Malha Geral",
            peso_malha_enviado_kg=op.peso_malha_enviado_kg,
            pecas_planejadas=op.pecas_planejadas,
            pecas_reais_cortadas=op.pecas_reais_cortadas,
            rendimento_real_pecas_kg=op.rendimento_real_pecas_kg,
            status_op=status_exibicao,
            data_corte=op.data_corte,
            criado_em=op.criado_em,
            quantidade_enviada_costura=total_enviado_costura,
            saldo_disponivel_envio=saldo_disp
        ))
    return resultado

@router.post("/ordens/", response_model=CamisetaOrdemProducaoResponse, status_code=status.HTTP_201_CREATED)
def abrir_ordem_corte(op_in: CamisetaOrdemProducaoCreate, db: Session = Depends(get_db)):
    """
    Passo a passo PCP:
    1. Operador seleciona modelo e informa peso total de malha enviado para a mesa (kg).
    2. O sistema realiza a explosão e baixa automática do insumo no estoque de tecido.
    """
    modelo = db.query(CamisetaModelo).filter_by(id_modelo=op_in.id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo não encontrado")

    if op_in.peso_malha_enviado_kg <= 0:
        raise HTTPException(status_code=400, detail="Peso de malha enviado deve ser maior que zero")

    # Baixa automática no estoque de insumo com validação rigorosa de saldo
    tecido_insumo = None
    if op_in.id_insumo_tecido:
        tecido_insumo = db.query(CamisetaInsumo).filter_by(id_insumo=op_in.id_insumo_tecido).first()
        if tecido_insumo:
            saldo_disp = tecido_insumo.saldo_atual or Decimal("0")
            if saldo_disp < op_in.peso_malha_enviado_kg:
                raise HTTPException(
                    status_code=400,
                    detail=f"Estoque insuficiente de malha. O rolo [{tecido_insumo.codigo}] possui apenas {float(saldo_disp):.3f} kg em estoque, mas você tentou enviar {float(op_in.peso_malha_enviado_kg):.3f} kg para a mesa."
                )
            tecido_insumo.saldo_atual = saldo_disp - op_in.peso_malha_enviado_kg
            tecido_insumo.atualizado_em = get_utc_now()

    # Cálculo estimado de peças planejadas baseado no consumo teórico do modelo
    pecas_plan = int(op_in.peso_malha_enviado_kg / modelo.consumo_tecido_kg) if modelo.consumo_tecido_kg > 0 else 0

    nova_op = CamisetaOrdemProducao(
        codigo_op=proximo_codigo(db, "OP"),
        id_modelo=op_in.id_modelo,
        id_insumo_tecido=op_in.id_insumo_tecido,
        peso_malha_enviado_kg=op_in.peso_malha_enviado_kg,
        pecas_planejadas=pecas_plan,
        status_op="Enfestado na Mesa"
    )
    db.add(nova_op)
    db.commit()
    db.refresh(nova_op)

    return CamisetaOrdemProducaoResponse(
        id_op=nova_op.id_op,
        codigo_op=nova_op.codigo_op,
        id_modelo=nova_op.id_modelo,
        nome_modelo=modelo.nome_modelo,
        id_insumo_tecido=nova_op.id_insumo_tecido,
        nome_tecido=tecido_insumo.tipo_malha_ou_aviamento if tecido_insumo else "Malha",
        peso_malha_enviado_kg=nova_op.peso_malha_enviado_kg,
        pecas_planejadas=nova_op.pecas_planejadas,
        pecas_reais_cortadas=None,
        rendimento_real_pecas_kg=None,
        status_op=nova_op.status_op,
        data_corte=None,
        criado_em=nova_op.criado_em
    )

@router.put("/ordens/{id_op}/finalizar-corte", response_model=CamisetaOrdemProducaoResponse)
def finalizar_corte_op(id_op: int, corte_in: CamisetaOrdemProducaoFinalizarCorte, db: Session = Depends(get_db)):
    """
    Após o enfesto e o corte, o operador registra a quantidade real de peças obtidas.
    O sistema calcula instantaneamente o Rendimento Real (peças/kg).
    """
    op = db.query(CamisetaOrdemProducao).filter_by(id_op=id_op).first()
    if not op:
        raise HTTPException(status_code=404, detail="Ordem de produção não encontrada")

    if corte_in.pecas_reais_cortadas <= 0:
        raise HTTPException(status_code=400, detail="Quantidade de peças cortadas deve ser maior que zero")

    op.pecas_reais_cortadas = corte_in.pecas_reais_cortadas
    op.data_corte = get_utc_now()
    op.status_op = "Cortado (Pronto para Costura)"

    # Cálculo instantâneo do rendimento real: peças / kg
    if op.peso_malha_enviado_kg and op.peso_malha_enviado_kg > 0:
        op.rendimento_real_pecas_kg = Decimal(str(round(op.pecas_reais_cortadas / float(op.peso_malha_enviado_kg), 2)))

    db.commit()
    db.refresh(op)

    return CamisetaOrdemProducaoResponse(
        id_op=op.id_op,
        codigo_op=op.codigo_op,
        id_modelo=op.id_modelo,
        nome_modelo=op.modelo.nome_modelo if op.modelo else "Modelo",
        id_insumo_tecido=op.id_insumo_tecido,
        nome_tecido=op.tecido.tipo_malha_ou_aviamento if op.tecido else "Malha",
        peso_malha_enviado_kg=op.peso_malha_enviado_kg,
        pecas_planejadas=op.pecas_planejadas,
        pecas_reais_cortadas=op.pecas_reais_cortadas,
        rendimento_real_pecas_kg=op.rendimento_real_pecas_kg,
        status_op=op.status_op,
        data_corte=op.data_corte,
        criado_em=op.criado_em
    )
