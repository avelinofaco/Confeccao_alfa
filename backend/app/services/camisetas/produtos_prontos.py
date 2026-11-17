# app/services/camisetas/produtos_prontos.py
"""Produtos Prontos: saldos por modelo × cor × tamanho, inventário, ajuste, estoque mínimo e histórico."""
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo, CamisetaPedido
from app.models.camisetas_cadastros import CamisetaCor
from app.models.camisetas_sku import (
    CamisetaMovimentoEstoque,
    CamisetaPedidoItem,
    CamisetaPedidoItemQtd,
    CamisetaVariacao,
)
from app.schemas.camisetas_sku import (
    AjusteEntrada,
    CelulaSku,
    InventarioEntrada,
    InventarioResultado,
    LinhaProdutoPronto,
    MovimentoResponse,
    VariacaoResponse,
)
from app.services.camisetas.cores import obter_cor
from app.services.camisetas.sku import (
    AJUSTE,
    INVENTARIO,
    TIPOS_MOVIMENTO,
    buscar_variacao,
    descrever_variacao,
    movimentar,
    obter_modelo,
    obter_ou_criar_variacao,
    obter_variacao,
    tamanho_do_modelo,
    tamanhos_do_modelo,
)

MOTIVO_INVENTARIO_PADRAO = "Inventário de abertura"
LIMITE_MOVIMENTOS = 100
STATUS_PEDIDO_ENTREGUE = "Entregue"


def esta_abaixo_do_minimo(variacao: CamisetaVariacao) -> bool:
    return variacao.estoque_minimo > 0 and variacao.saldo < variacao.estoque_minimo


def _celula(tamanho, variacao: Optional[CamisetaVariacao], reservado: int = 0) -> CelulaSku:
    saldo = variacao.saldo if variacao is not None else 0
    disponivel = max(0, saldo - reservado)
    falta_produzir = max(0, reservado - saldo)
    if variacao is None:
        return CelulaSku(
            id_tamanho=tamanho.id_tamanho,
            rotulo=tamanho.rotulo,
            saldo=0,
            reservado=reservado,
            disponivel=disponivel,
            falta_produzir=falta_produzir,
        )
    return CelulaSku(
        id_tamanho=tamanho.id_tamanho,
        rotulo=tamanho.rotulo,
        id_variacao=variacao.id_variacao,
        saldo=saldo,
        estoque_minimo=variacao.estoque_minimo,
        abaixo_minimo=esta_abaixo_do_minimo(variacao),
        reservado=reservado,
        disponivel=disponivel,
        falta_produzir=falta_produzir,
    )


def _reservas_por_sku(
    db: Session, id_modelo: Optional[int] = None, id_cor: Optional[int] = None
) -> dict[tuple[int, int, int], int]:
    consulta = (
        db.query(
            CamisetaPedidoItem.id_modelo,
            CamisetaPedidoItem.id_cor,
            CamisetaPedidoItemQtd.id_tamanho,
            func.coalesce(func.sum(CamisetaPedidoItemQtd.quantidade), 0),
        )
        .join(CamisetaPedidoItem, CamisetaPedidoItem.id_item == CamisetaPedidoItemQtd.id_item)
        .join(CamisetaPedido, CamisetaPedido.id_pedido == CamisetaPedidoItem.id_pedido)
        .filter(
            CamisetaPedido.status_pedido != STATUS_PEDIDO_ENTREGUE,
            CamisetaPedidoItem.id_cor.is_not(None),
        )
    )
    if id_modelo is not None:
        consulta = consulta.filter(CamisetaPedidoItem.id_modelo == id_modelo)
    if id_cor is not None:
        consulta = consulta.filter(CamisetaPedidoItem.id_cor == id_cor)
    linhas = consulta.group_by(
        CamisetaPedidoItem.id_modelo,
        CamisetaPedidoItem.id_cor,
        CamisetaPedidoItemQtd.id_tamanho,
    ).all()
    return {
        (int(mod), int(cor), int(tam)): int(qtd)
        for mod, cor, tam, qtd in linhas
        if int(qtd) > 0
    }


def _montar_linha(
    modelo: CamisetaModelo,
    cor: CamisetaCor,
    variacoes: list[CamisetaVariacao],
    reservas: dict[tuple[int, int, int], int],
) -> LinhaProdutoPronto:
    por_tamanho = {v.id_tamanho: v for v in variacoes}
    celulas = [
        _celula(
            t,
            por_tamanho.get(t.id_tamanho),
            reservas.get((modelo.id_modelo, cor.id_cor, t.id_tamanho), 0),
        )
        for t in tamanhos_do_modelo(modelo)
    ]
    return LinhaProdutoPronto(
        id_modelo=modelo.id_modelo,
        nome_modelo=modelo.nome_modelo,
        id_cor=cor.id_cor,
        nome_cor=cor.nome,
        hex_cor=cor.hex,
        tamanhos=celulas,
        total=sum(c.saldo for c in celulas),
        total_reservado=sum(c.reservado for c in celulas),
        total_disponivel=sum(c.disponivel for c in celulas),
        total_falta_produzir=sum(c.falta_produzir for c in celulas),
    )


def listar_produtos_prontos(db: Session, id_modelo: Optional[int] = None, id_cor: Optional[int] = None,
                            abaixo_minimo: bool = False) -> list[LinhaProdutoPronto]:
    consulta = db.query(CamisetaVariacao)
    if id_modelo is not None:
        consulta = consulta.filter(CamisetaVariacao.id_modelo == id_modelo)
    if id_cor is not None:
        consulta = consulta.filter(CamisetaVariacao.id_cor == id_cor)
    grupos: dict[tuple[int, int], list[CamisetaVariacao]] = {}
    modelos_cache: dict[int, CamisetaModelo] = {}
    cores_cache: dict[int, CamisetaCor] = {}
    for variacao in consulta.all():
        grupos.setdefault((variacao.id_modelo, variacao.id_cor), []).append(variacao)
        modelos_cache[variacao.id_modelo] = variacao.modelo
        cores_cache[variacao.id_cor] = variacao.cor

    reservas = _reservas_por_sku(db, id_modelo=id_modelo, id_cor=id_cor)
    for mod_id, cor_id, _ in reservas.keys():
        grupos.setdefault((mod_id, cor_id), [])
        if mod_id not in modelos_cache:
            mod_obj = db.get(CamisetaModelo, mod_id)
            if mod_obj is not None:
                modelos_cache[mod_id] = mod_obj
        if cor_id not in cores_cache:
            cor_obj = db.get(CamisetaCor, cor_id)
            if cor_obj is not None:
                cores_cache[cor_id] = cor_obj

    linhas = [
        _montar_linha(modelos_cache[mod_id], cores_cache[cor_id], variacoes, reservas)
        for (mod_id, cor_id), variacoes in grupos.items()
        if mod_id in modelos_cache and cor_id in cores_cache
    ]
    if abaixo_minimo:
        linhas = [linha for linha in linhas if any(c.abaixo_minimo for c in linha.tamanhos)]
    return sorted(linhas, key=lambda linha: (linha.nome_modelo.casefold(), linha.nome_cor.casefold()))


def _validar_contagens(db: Session, dados: InventarioEntrada) -> list:
    """Confere tudo antes de lançar qualquer coisa (modelo, cor, tamanho e repetição)."""
    vistas = set()
    validadas = []
    for contagem in dados.contagens:
        chave = (contagem.id_modelo, contagem.id_cor, contagem.id_tamanho)
        if chave in vistas:
            raise ErroNegocio(400, "A mesma cor e tamanho aparece duas vezes na contagem.")
        vistas.add(chave)
        modelo = obter_modelo(db, contagem.id_modelo)
        tamanho_do_modelo(db, modelo, contagem.id_tamanho)
        obter_cor(db, contagem.id_cor)
        validadas.append((modelo, contagem))
    return validadas


def registrar_inventario(db: Session, dados: InventarioEntrada) -> InventarioResultado:
    motivo = " ".join((dados.motivo or "").split()) or MOTIVO_INVENTARIO_PADRAO
    entradas = saidas = alterados = 0
    for modelo, contagem in _validar_contagens(db, dados):
        existente = buscar_variacao(db, contagem.id_modelo, contagem.id_cor, contagem.id_tamanho)
        if existente is None and contagem.quantidade_contada == 0:
            continue
        variacao = existente or obter_ou_criar_variacao(db, modelo, contagem.id_cor, contagem.id_tamanho)
        diferenca = contagem.quantidade_contada - variacao.saldo
        if diferenca == 0:
            continue
        movimentar(db, variacao, diferenca, INVENTARIO, motivo=motivo)
        alterados += 1
        entradas += max(diferenca, 0)
        saidas += max(-diferenca, 0)
    db.commit()
    return InventarioResultado(skus_alterados=alterados, pecas_entrada=entradas, pecas_saida=saidas)


def resposta_da_variacao(variacao: CamisetaVariacao) -> VariacaoResponse:
    return VariacaoResponse(
        id_variacao=variacao.id_variacao, id_modelo=variacao.id_modelo, id_cor=variacao.id_cor,
        id_tamanho=variacao.id_tamanho, sku=descrever_variacao(variacao), saldo=variacao.saldo,
        estoque_minimo=variacao.estoque_minimo,
    )


def registrar_ajuste(db: Session, dados: AjusteEntrada) -> VariacaoResponse:
    if dados.quantidade == 0:
        raise ErroNegocio(400, "Informe quanto entra (+) ou sai (−); zero não muda o estoque.")
    motivo = " ".join(dados.motivo.split())
    if len(motivo) < 3:
        raise ErroNegocio(400, "Explique o motivo do ajuste (pelo menos 3 letras).")
    variacao = obter_variacao(db, dados.id_variacao)
    movimentar(db, variacao, dados.quantidade, AJUSTE, motivo=motivo)
    db.commit()
    return resposta_da_variacao(variacao)


def definir_minimo(db: Session, id_variacao: int, estoque_minimo: int) -> VariacaoResponse:
    variacao = obter_variacao(db, id_variacao)
    variacao.estoque_minimo = estoque_minimo
    db.commit()
    return resposta_da_variacao(variacao)


def _referencia(movimento: CamisetaMovimentoEstoque) -> Optional[str]:
    if movimento.pedido is not None:
        return movimento.pedido.codigo_pedido
    if movimento.remessa is not None and movimento.remessa.op is not None:
        return movimento.remessa.op.codigo_op
    return None


def listar_movimentos(db: Session, id_variacao: Optional[int] = None, id_modelo: Optional[int] = None,
                      tipo: Optional[str] = None, limite: int = LIMITE_MOVIMENTOS) -> list[MovimentoResponse]:
    if tipo is not None and tipo not in TIPOS_MOVIMENTO:
        raise ErroNegocio(400, f"Tipo de movimento inválido: {tipo}. Use um destes: {', '.join(TIPOS_MOVIMENTO)}.")
    consulta = db.query(CamisetaMovimentoEstoque)
    if id_variacao is not None:
        consulta = consulta.filter(CamisetaMovimentoEstoque.id_variacao == id_variacao)
    if id_modelo is not None:
        consulta = consulta.join(CamisetaVariacao).filter(CamisetaVariacao.id_modelo == id_modelo)
    if tipo is not None:
        consulta = consulta.filter(CamisetaMovimentoEstoque.tipo == tipo)
    movimentos = consulta.order_by(CamisetaMovimentoEstoque.id_movimento.desc()).limit(limite).all()
    return [
        MovimentoResponse(
            id_movimento=m.id_movimento, id_variacao=m.id_variacao, sku=descrever_variacao(m.variacao), tipo=m.tipo,
            quantidade=m.quantidade, saldo_apos=m.saldo_apos, motivo=m.motivo, referencia=_referencia(m),
            criado_em=m.criado_em,
        )
        for m in movimentos
    ]
