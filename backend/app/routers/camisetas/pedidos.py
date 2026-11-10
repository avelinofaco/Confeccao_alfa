# app/routers/camisetas/pedidos.py
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

# ----------------- 2. CADASTRO DE PEDIDOS DO CLIENTE (RF02) -----------------
@router.get("/pedidos/", response_model=List[CamisetaPedidoResponse])
def listar_pedidos(db: Session = Depends(get_db)):
    pedidos = db.query(CamisetaPedido).order_by(CamisetaPedido.id_pedido.desc()).all()
    resultado = []
    for p in pedidos:
        resultado.append(CamisetaPedidoResponse(
            id_pedido=p.id_pedido,
            codigo_pedido=p.codigo_pedido,
            nome_cliente=p.nome_cliente,
            id_modelo=p.id_modelo,
            nome_modelo=p.modelo.nome_modelo if p.modelo else "Modelo Geral",
            grade_p=p.grade_p,
            grade_m=p.grade_m,
            grade_g=p.grade_g,
            grade_gg=p.grade_gg,
            quantidade_total=p.quantidade_total,
            prazo_entrega=p.prazo_entrega,
            valor_total=p.valor_total,
            status_pedido=p.status_pedido,
            observacoes=p.observacoes,
            criado_em=p.criado_em
        ))
    return resultado

@router.post("/pedidos/", response_model=CamisetaPedidoResponse, status_code=status.HTTP_201_CREATED)
def cadastrar_pedido(pedido_in: CamisetaPedidoCreate, db: Session = Depends(get_db)):
    # Validação IHC (Usabilidade e Prevenção de Erros): Prazo não pode ser anterior a hoje
    if pedido_in.prazo_entrega < date.today():
        raise HTTPException(
            status_code=400, 
            detail="O prazo de entrega desejado não pode ser anterior à data de hoje. Selecione hoje ou uma data futura."
        )

    # Valida modelo existente
    modelo = db.query(CamisetaModelo).filter_by(id_modelo=pedido_in.id_modelo).first()
    if not modelo:
        raise HTTPException(status_code=404, detail="Modelo de camiseta informado não encontrado")

    # Calcula automaticamente a quantidade total pela grade
    qtd_total = pedido_in.grade_p + pedido_in.grade_m + pedido_in.grade_g + pedido_in.grade_gg
    if qtd_total <= 0:
        raise HTTPException(status_code=400, detail="A soma das grades (P, M, G, GG) deve ser maior que zero")

    novo_pedido = CamisetaPedido(
        codigo_pedido=proximo_codigo(db, "PED"),
        nome_cliente=pedido_in.nome_cliente,
        id_modelo=pedido_in.id_modelo,
        grade_p=pedido_in.grade_p,
        grade_m=pedido_in.grade_m,
        grade_g=pedido_in.grade_g,
        grade_gg=pedido_in.grade_gg,
        quantidade_total=qtd_total,
        prazo_entrega=pedido_in.prazo_entrega,
        valor_total=pedido_in.valor_total,
        status_pedido="Aguardando Produção", # Regra de negócio obrigatória
        observacoes=pedido_in.observacoes
    )
    db.add(novo_pedido)
    db.commit()
    db.refresh(novo_pedido)

    return CamisetaPedidoResponse(
        id_pedido=novo_pedido.id_pedido,
        codigo_pedido=novo_pedido.codigo_pedido,
        nome_cliente=novo_pedido.nome_cliente,
        id_modelo=novo_pedido.id_modelo,
        nome_modelo=modelo.nome_modelo,
        grade_p=novo_pedido.grade_p,
        grade_m=novo_pedido.grade_m,
        grade_g=novo_pedido.grade_g,
        grade_gg=novo_pedido.grade_gg,
        quantidade_total=novo_pedido.quantidade_total,
        prazo_entrega=novo_pedido.prazo_entrega,
        valor_total=novo_pedido.valor_total,
        status_pedido=novo_pedido.status_pedido,
        observacoes=novo_pedido.observacoes,
        criado_em=novo_pedido.criado_em
    )

@router.put("/pedidos/{id_pedido}/status", response_model=CamisetaPedidoResponse)
def atualizar_status_pedido(id_pedido: int, status_in: CamisetaPedidoStatusUpdate, db: Session = Depends(get_db)):
    pedido = db.query(CamisetaPedido).filter_by(id_pedido=id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    status_anterior = pedido.status_pedido
    novo_status = status_in.status_pedido

    # Se está marcando como Entregue e antes não era:
    if novo_status == "Entregue" and status_anterior != "Entregue":
        estoque_acabado = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=pedido.id_modelo).first()
        if not estoque_acabado:
            estoque_acabado = CamisetaProdutoAcabado(
                id_modelo=pedido.id_modelo,
                grade_p=0, grade_m=0, grade_g=0, grade_gg=0,
                quantidade_total=0,
                atualizado_em=get_utc_now()
            )
            db.add(estoque_acabado)
            db.flush()
        
        # Baixa do Estoque Pronto
        estoque_acabado.quantidade_total = max(0, (estoque_acabado.quantidade_total or 0) - pedido.quantidade_total)
        estoque_acabado.grade_p = max(0, (estoque_acabado.grade_p or 0) - (pedido.grade_p or 0))
        estoque_acabado.grade_m = max(0, (estoque_acabado.grade_m or 0) - (pedido.grade_m or 0))
        estoque_acabado.grade_g = max(0, (estoque_acabado.grade_g or 0) - (pedido.grade_g or 0))
        estoque_acabado.grade_gg = max(0, (estoque_acabado.grade_gg or 0) - (pedido.grade_gg or 0))
        estoque_acabado.atualizado_em = get_utc_now()

    # Se estava Entregue e foi revertido para outro status:
    elif status_anterior == "Entregue" and novo_status != "Entregue":
        estoque_acabado = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=pedido.id_modelo).first()
        if estoque_acabado:
            estoque_acabado.quantidade_total = (estoque_acabado.quantidade_total or 0) + pedido.quantidade_total
            estoque_acabado.grade_p = (estoque_acabado.grade_p or 0) + (pedido.grade_p or 0)
            estoque_acabado.grade_m = (estoque_acabado.grade_m or 0) + (pedido.grade_m or 0)
            estoque_acabado.grade_g = (estoque_acabado.grade_g or 0) + (pedido.grade_g or 0)
            estoque_acabado.grade_gg = (estoque_acabado.grade_gg or 0) + (pedido.grade_gg or 0)
            estoque_acabado.atualizado_em = get_utc_now()

    pedido.status_pedido = novo_status
    pedido.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(pedido)

    return CamisetaPedidoResponse(
        id_pedido=pedido.id_pedido,
        codigo_pedido=pedido.codigo_pedido,
        nome_cliente=pedido.nome_cliente,
        id_modelo=pedido.id_modelo,
        nome_modelo=pedido.modelo.nome_modelo if pedido.modelo else "Modelo",
        grade_p=pedido.grade_p,
        grade_m=pedido.grade_m,
        grade_g=pedido.grade_g,
        grade_gg=pedido.grade_gg,
        quantidade_total=pedido.quantidade_total,
        prazo_entrega=pedido.prazo_entrega,
        valor_total=pedido.valor_total,
        status_pedido=pedido.status_pedido,
        observacoes=pedido.observacoes,
        criado_em=pedido.criado_em
    )

@router.post("/pedidos/{id_pedido}/entregar", response_model=CamisetaPedidoResponse)
def registrar_entrega_pedido(id_pedido: int, dados_entrega: CamisetaPedidoEntregar, db: Session = Depends(get_db)):
    """
    Registra formalmente a entrega ao cliente:
    - Status marcado como 'Entregue'
    - Baixa no Estoque de Peças Prontas (CamisetaProdutoAcabado)
    - Card de Produção Total do Dashboard diminui automaticamente
    - Registra comprovante auditável nas observações
    """
    pedido = db.query(CamisetaPedido).filter_by(id_pedido=id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if pedido.status_pedido == "Entregue":
        raise HTTPException(status_code=400, detail="Este pedido já foi registrado como Entregue anteriormente.")

    # 1. Validação estrita de estoque suficiente antes de entregar (IHC / Integridade)
    estoque_acabado = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=pedido.id_modelo).first()
    saldo_disponivel = estoque_acabado.quantidade_total if estoque_acabado else 0
    if saldo_disponivel < pedido.quantidade_total:
        raise HTTPException(
            status_code=400,
            detail=f"Estoque pronto insuficiente para entrega! Disponível em estoque: {saldo_disponivel} peças. Quantidade do pedido a entregar: {pedido.quantidade_total} peças."
        )

    if not estoque_acabado:
        estoque_acabado = CamisetaProdutoAcabado(
            id_modelo=pedido.id_modelo,
            grade_p=0, grade_m=0, grade_g=0, grade_gg=0,
            quantidade_total=0,
            atualizado_em=get_utc_now()
        )
        db.add(estoque_acabado)
        db.flush()

    estoque_acabado.quantidade_total = max(0, (estoque_acabado.quantidade_total or 0) - pedido.quantidade_total)
    estoque_acabado.grade_p = max(0, (estoque_acabado.grade_p or 0) - (pedido.grade_p or 0))
    estoque_acabado.grade_m = max(0, (estoque_acabado.grade_m or 0) - (pedido.grade_m or 0))
    estoque_acabado.grade_g = max(0, (estoque_acabado.grade_g or 0) - (pedido.grade_g or 0))
    estoque_acabado.grade_gg = max(0, (estoque_acabado.grade_gg or 0) - (pedido.grade_gg or 0))
    estoque_acabado.atualizado_em = get_utc_now()

    # 2. Registra comprovante amigável
    data_formatada = (dados_entrega.data_entrega or date.today()).strftime("%d/%m/%Y")
    rec_info = f" | Recebido por: {dados_entrega.recebedor}" if dados_entrega.recebedor else ""
    obs_extra = f" | Obs: {dados_entrega.observacoes}" if dados_entrega.observacoes else ""
    nota_entrega = f"\n[ENTREGA REALIZADA em {data_formatada}{rec_info}{obs_extra}]"
    
    pedido.observacoes = (pedido.observacoes or "") + nota_entrega
    pedido.status_pedido = "Entregue"
    pedido.atualizado_em = get_utc_now()
    
    db.commit()
    db.refresh(pedido)

    return CamisetaPedidoResponse(
        id_pedido=pedido.id_pedido,
        codigo_pedido=pedido.codigo_pedido,
        nome_cliente=pedido.nome_cliente,
        id_modelo=pedido.id_modelo,
        nome_modelo=pedido.modelo.nome_modelo if pedido.modelo else "Modelo",
        grade_p=pedido.grade_p,
        grade_m=pedido.grade_m,
        grade_g=pedido.grade_g,
        grade_gg=pedido.grade_gg,
        quantidade_total=pedido.quantidade_total,
        prazo_entrega=pedido.prazo_entrega,
        valor_total=pedido.valor_total,
        status_pedido=pedido.status_pedido,
        observacoes=pedido.observacoes,
        criado_em=pedido.criado_em
    )

@router.delete("/pedidos/{id_pedido}")
def excluir_pedido_camiseta(id_pedido: int, db: Session = Depends(get_db)):
    """Exclui permanentemente um pedido comercial. Impede exclusão se já estiver entregue."""
    pedido = db.query(CamisetaPedido).filter_by(id_pedido=id_pedido).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    if (pedido.status_pedido or "").lower() == "entregue":
        raise HTTPException(
            status_code=400, 
            detail="Não é permitido excluir um pedido que já foi formalizado como Entregue ao cliente."
        )
    
    codigo = pedido.codigo_pedido
    db.delete(pedido)
    db.commit()
    return {"mensagem": f"Pedido {codigo} excluído com sucesso!"}

@router.get("/estoque-acabado/", response_model=List[CamisetaProdutoAcabadoResponse])
def listar_estoque_acabado(db: Session = Depends(get_db)):
    acabados = db.query(CamisetaProdutoAcabado).all()
    resultado = []
    for ac in acabados:
        resultado.append(CamisetaProdutoAcabadoResponse(
            id_estoque_acabado=ac.id_estoque_acabado,
            id_modelo=ac.id_modelo,
            nome_modelo=ac.modelo.nome_modelo if ac.modelo else "Modelo Geral",
            grade_p=ac.grade_p or 0,
            grade_m=ac.grade_m or 0,
            grade_g=ac.grade_g or 0,
            grade_gg=ac.grade_gg or 0,
            quantidade_total=ac.quantidade_total or 0,
            atualizado_em=ac.atualizado_em
        ))
    return resultado
