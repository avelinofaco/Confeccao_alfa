"""Fábricas de registros para os testes do segmento Camisetas."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.models.camisetas import (
    CamisetaCosturaFaccao,
    CamisetaEntradaInsumo,
    CamisetaFichaTecnica,
    CamisetaInsumo,
    CamisetaModelo,
    CamisetaOrdemProducao,
    CamisetaPedido,
    CamisetaProdutoAcabado,
    CamisetaRegistroFinanceiro,
)


def _salvar(db, objeto):
    db.add(objeto)
    db.commit()
    db.refresh(objeto)
    return objeto


def criar_modelo(db, nome="Camiseta Básica", consumo_kg="0.1800"):
    return _salvar(db, CamisetaModelo(nome_modelo=nome, consumo_tecido_kg=Decimal(consumo_kg)))


def criar_insumo(db, codigo="MALHA-01", categoria="ROLO_TECIDO", nome="Meia Malha 30.1",
                 unidade="kg", saldo="100.000", custo="40.00", minimo="10.000"):
    return _salvar(db, CamisetaInsumo(
        codigo=codigo,
        categoria=categoria,
        tipo_malha_ou_aviamento=nome,
        unidade_medida=unidade,
        saldo_atual=Decimal(saldo),
        estoque_minimo=Decimal(minimo),
        preco_custo_medio=Decimal(custo),
    ))


def criar_item_ficha(db, modelo, insumo=None, tipo="Linha de Costura", consumo="0.0200", unidade="unidades"):
    return _salvar(db, CamisetaFichaTecnica(
        id_modelo=modelo.id_modelo,
        id_insumo=insumo.id_insumo if insumo else None,
        tipo_insumo=tipo,
        descricao_insumo=insumo.tipo_malha_ou_aviamento if insumo else tipo,
        consumo_unitario=Decimal(consumo),
        unidade_medida=unidade,
    ))


def criar_entrada(db, insumo, quantidade="10.000", valor="100.00", data=None):
    # Grava em UTC, como a aplicação faz (get_utc_now).
    momento = (data or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return _salvar(db, CamisetaEntradaInsumo(
        id_insumo=insumo.id_insumo,
        quantidade=Decimal(quantidade),
        valor_total=Decimal(valor),
        data_entrada=momento,
    ))


def criar_pedido(db, modelo, codigo="PED-T-1", valor="1000.00", status="Aguardando Produção",
                 grade=(10, 10, 10, 10), criado_em=None, observacoes=None, data_entrega_realizada=None):
    p, m, g, gg = grade
    return _salvar(db, CamisetaPedido(
        codigo_pedido=codigo,
        nome_cliente="Cliente Teste",
        id_modelo=modelo.id_modelo,
        grade_p=p, grade_m=m, grade_g=g, grade_gg=gg,
        quantidade_total=p + m + g + gg,
        prazo_entrega=date.today() + timedelta(days=10),
        valor_total=Decimal(valor),
        status_pedido=status,
        observacoes=observacoes,
        criado_em=criado_em or datetime.now(timezone.utc),
        data_entrega_realizada=data_entrega_realizada,
    ))


def criar_op_cortada(db, modelo, codigo="OP-T-1", pecas=100, peso="20.000", tecido=None):
    return _salvar(db, CamisetaOrdemProducao(
        codigo_op=codigo,
        id_modelo=modelo.id_modelo,
        id_insumo_tecido=tecido.id_insumo if tecido else None,
        peso_malha_enviado_kg=Decimal(peso),
        pecas_planejadas=pecas,
        pecas_reais_cortadas=pecas,
        status_op="Cortado (Pronto para Costura)",
    ))


def criar_remessa(db, op, quantidade=50, status="Em Costura Externa"):
    return _salvar(db, CamisetaCosturaFaccao(
        id_op=op.id_op,
        nome_faccao="Facção Teste",
        quantidade_enviada=quantidade,
        status=status,
    ))


def criar_estoque_acabado(db, modelo, grade=(0, 0, 0, 0)):
    p, m, g, gg = grade
    return _salvar(db, CamisetaProdutoAcabado(
        id_modelo=modelo.id_modelo,
        grade_p=p, grade_m=m, grade_g=g, grade_gg=gg,
        quantidade_total=p + m + g + gg,
    ))


def criar_registro_financeiro(db, mes_ano, outros="0.00", observacoes=None):
    return _salvar(db, CamisetaRegistroFinanceiro(
        mes_ano=mes_ano,
        outros_custos_operacionais=Decimal(outros),
        observacoes=observacoes,
    ))
