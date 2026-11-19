# app/services/camisetas/ordens.py
"""Ordens de produção: enfesto com várias cores, corte por cor × tamanho e resposta da OP."""
from decimal import ROUND_HALF_UP, Decimal
from typing import Optional

from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaInsumo, CamisetaOrdemProducao, CamisetaPedido, get_utc_now
from app.models.camisetas_sku import CamisetaOpCor, CamisetaOpCorte
from app.schemas.camisetas import (
    CamisetaOrdemProducaoCreate,
    CamisetaOrdemProducaoFinalizarCorte,
    CamisetaOrdemProducaoResponse,
)
from app.schemas.camisetas_sku import OpCorEntrada, OpCorResponse, OpCorteResponse, TamanhoResponse
from app.services.camisetas.cores import obter_cor
from app.services.camisetas.costura import quantidades_enviadas_por_sku, total_enviado
from app.services.camisetas.sku import obter_modelo, obter_ou_criar_variacao, tamanho_do_modelo, tamanhos_do_modelo
from app.services.sequencias import proximo_codigo

CATEGORIA_MALHA = "ROLO_TECIDO"
STATUS_OP_ENFESTADA = "Enfestado na Mesa"
STATUS_OP_CORTADA = "Cortado (Pronto para Costura)"
STATUS_OP_AGUARDANDO = "Aguardando Corte"
DUAS_CASAS = Decimal("0.01")
ZERO = Decimal("0")


def rendimento(pecas: int, peso) -> Optional[Decimal]:
    if not pecas or peso is None or Decimal(peso) <= ZERO:
        return None
    return (Decimal(pecas) / Decimal(peso)).quantize(DUAS_CASAS, rounding=ROUND_HALF_UP)


def obter_op(db: Session, id_op: int) -> CamisetaOrdemProducao:
    op = db.get(CamisetaOrdemProducao, id_op)
    if op is None:
        raise ErroNegocio(404, "Ordem de produção não encontrada")
    return op


def _linhas_do_corpo_antigo(db: Session, dados: CamisetaOrdemProducaoCreate) -> list[OpCorEntrada]:
    if dados.id_insumo_tecido is None or dados.peso_malha_enviado_kg is None:
        raise ErroNegocio(400, "Informe as cores do enfesto, com o rolo de malha e o peso de cada uma.")
    if dados.peso_malha_enviado_kg <= ZERO:
        raise ErroNegocio(400, "Peso de malha enviado deve ser maior que zero")
    rolo = db.get(CamisetaInsumo, dados.id_insumo_tecido)
    if rolo is None:
        raise ErroNegocio(404, "Rolo de malha não encontrado.")
    if rolo.id_cor is None:
        raise ErroNegocio(400, f"Informe a cor: o rolo {rolo.codigo} não está ligado a uma cor de camiseta.")
    return [OpCorEntrada(id_cor=rolo.id_cor, id_insumo_tecido=rolo.id_insumo, peso_kg=dados.peso_malha_enviado_kg)]


def _validar_linhas(db: Session, linhas: list[OpCorEntrada]) -> list[tuple[OpCorEntrada, CamisetaInsumo]]:
    """Cor existente e sem repetição; rolo de malha com saldo para o peso somado de todas as linhas que o usam."""
    if not linhas:
        raise ErroNegocio(400, "Informe pelo menos uma cor no enfesto.")
    cores_vistas = set()
    peso_por_rolo: dict[int, Decimal] = {}
    validadas = []
    for linha in linhas:
        cor = obter_cor(db, linha.id_cor)
        if linha.id_cor in cores_vistas:
            raise ErroNegocio(400, f"A cor {cor.nome} aparece duas vezes no enfesto.")
        cores_vistas.add(linha.id_cor)
        rolo = db.get(CamisetaInsumo, linha.id_insumo_tecido)
        if rolo is None or rolo.categoria != CATEGORIA_MALHA:
            raise ErroNegocio(400, f"Escolha um rolo de malha para a cor {cor.nome}.")
        peso_por_rolo[rolo.id_insumo] = peso_por_rolo.get(rolo.id_insumo, ZERO) + linha.peso_kg
        saldo = rolo.saldo_atual or ZERO
        if saldo < peso_por_rolo[rolo.id_insumo]:
            raise ErroNegocio(
                400,
                f"Estoque insuficiente de malha: o rolo {rolo.codigo} tem {saldo:.3f} kg "
                f"e o enfesto pede {peso_por_rolo[rolo.id_insumo]:.3f} kg.",
            )
        validadas.append((linha, rolo))
    return validadas


def _obter_pedido_para_op(db: Session, id_pedido: Optional[int]) -> Optional[CamisetaPedido]:
    if id_pedido is None:
        return None
    pedido = db.get(CamisetaPedido, id_pedido)
    if pedido is None:
        raise ErroNegocio(404, "Pedido não encontrado para vincular à Ordem de Produção.")
    if pedido.status_pedido == "Entregue":
        raise ErroNegocio(400, "Não é possível vincular uma Ordem de Produção a um pedido já entregue.")
    return pedido


def abrir_op(db: Session, dados: CamisetaOrdemProducaoCreate) -> CamisetaOrdemProducao:
    modelo = obter_modelo(db, dados.id_modelo)
    tamanhos_do_modelo(modelo)  # sem grade não há como cortar por tamanho
    pedido = _obter_pedido_para_op(db, dados.id_pedido)
    linhas = dados.cores if dados.cores is not None else _linhas_do_corpo_antigo(db, dados)
    validadas = _validar_linhas(db, linhas)
    peso_total = sum((linha.peso_kg for linha, _ in validadas), ZERO)
    consumo = modelo.consumo_tecido_kg or ZERO
    op = CamisetaOrdemProducao(
        codigo_op=proximo_codigo(db, "OP"),
        id_modelo=modelo.id_modelo,
        id_pedido=pedido.id_pedido if pedido else None,
        id_insumo_tecido=validadas[0][1].id_insumo,
        peso_malha_enviado_kg=peso_total,
        pecas_planejadas=int(peso_total / consumo) if consumo > ZERO else 0,
        status_op=STATUS_OP_ENFESTADA,
    )
    if pedido is not None and pedido.status_pedido == "Aguardando Produção":
        pedido.status_pedido = "Em Produção"
    op.cores = [CamisetaOpCor(id_cor=linha.id_cor, id_insumo_tecido=rolo.id_insumo, peso_kg=linha.peso_kg)
                for linha, rolo in validadas]
    for linha, rolo in validadas:
        rolo.saldo_atual = (rolo.saldo_atual or ZERO) - linha.peso_kg
        rolo.atualizado_em = get_utc_now()
    db.add(op)
    db.commit()
    db.refresh(op)
    return op


def _corte_legado(op: CamisetaOrdemProducao, dados: CamisetaOrdemProducaoFinalizarCorte) -> None:
    if dados.pecas_reais_cortadas is None or dados.pecas_reais_cortadas <= 0:
        raise ErroNegocio(400, "Quantidade de peças cortadas deve ser maior que zero")
    op.pecas_reais_cortadas = dados.pecas_reais_cortadas


def _corte_por_sku(db: Session, op: CamisetaOrdemProducao, dados: CamisetaOrdemProducaoFinalizarCorte) -> None:
    if op.movimentacoes_costura:
        raise ErroNegocio(409, "Esta OP já enviou peças para a facção; o corte não pode mais ser alterado.")
    if not dados.cortes:
        raise ErroNegocio(400, "Informe as peças cortadas de cada cor e tamanho.")
    cores_da_op = {c.id_cor for c in op.cores}
    vistos = set()
    for corte in dados.cortes:
        if corte.id_cor not in cores_da_op:
            raise ErroNegocio(400, "Há uma cor no corte que não faz parte do enfesto desta OP.")
        tamanho_do_modelo(db, op.modelo, corte.id_tamanho)
        if (corte.id_cor, corte.id_tamanho) in vistos:
            raise ErroNegocio(400, "A mesma cor e tamanho aparece duas vezes no corte.")
        vistos.add((corte.id_cor, corte.id_tamanho))
    positivos = [c for c in dados.cortes if c.quantidade > 0]
    if not positivos:
        raise ErroNegocio(400, "Quantidade de peças cortadas deve ser maior que zero")
    variacoes = [(obter_ou_criar_variacao(db, op.modelo, c.id_cor, c.id_tamanho), c.quantidade) for c in positivos]
    op.cortes.clear()
    db.flush()  # apaga as linhas antigas antes de inserir as novas (restrição única id_op + id_variacao)
    op.cortes.extend(CamisetaOpCorte(id_variacao=v.id_variacao, quantidade=q) for v, q in variacoes)
    op.pecas_reais_cortadas = sum(q for _, q in variacoes)


def registrar_corte(db: Session, id_op: int, dados: CamisetaOrdemProducaoFinalizarCorte) -> CamisetaOrdemProducao:
    op = obter_op(db, id_op)
    if op.cores:
        _corte_por_sku(db, op, dados)
    else:
        _corte_legado(op, dados)
    op.data_corte = get_utc_now()
    op.status_op = STATUS_OP_CORTADA
    op.rendimento_real_pecas_kg = rendimento(op.pecas_reais_cortadas, op.peso_malha_enviado_kg)
    db.commit()
    db.refresh(op)
    return op


def status_exibicao(op: CamisetaOrdemProducao) -> str:
    status = op.status_op or STATUS_OP_AGUARDANDO
    if "Envio Parcial" in status or "Facção" in status or "Oficina" in status:
        return "Em Costura"
    return status


def _nome_tecido(op: CamisetaOrdemProducao) -> str:
    if op.cores:
        nomes = dict.fromkeys(c.tecido.tipo_malha_ou_aviamento for c in op.cores if c.tecido)
        return ", ".join(nomes) or "Malha"
    return op.tecido.tipo_malha_ou_aviamento if op.tecido else "Malha Geral"


def _resposta_das_cores(op: CamisetaOrdemProducao) -> list[OpCorResponse]:
    cortado_por_cor: dict[int, int] = {}
    for corte in op.cortes:
        cortado_por_cor[corte.variacao.id_cor] = cortado_por_cor.get(corte.variacao.id_cor, 0) + corte.quantidade
    return [
        OpCorResponse(
            id_cor=c.id_cor, nome_cor=c.cor.nome, hex_cor=c.cor.hex, id_insumo_tecido=c.id_insumo_tecido,
            codigo_tecido=c.tecido.codigo if c.tecido else None,
            nome_tecido=c.tecido.tipo_malha_ou_aviamento if c.tecido else None,
            peso_kg=c.peso_kg, pecas_cortadas=cortado_por_cor.get(c.id_cor, 0),
            rendimento=rendimento(cortado_por_cor.get(c.id_cor, 0), c.peso_kg),
        )
        for c in op.cores
    ]


def _resposta_dos_cortes(op: CamisetaOrdemProducao) -> list[OpCorteResponse]:
    enviados = quantidades_enviadas_por_sku(op)
    cortes = sorted(op.cortes, key=lambda c: (c.variacao.cor.nome.casefold(), c.variacao.tamanho.ordem))
    return [
        OpCorteResponse(
            id_variacao=c.id_variacao, id_cor=c.variacao.id_cor, nome_cor=c.variacao.cor.nome,
            id_tamanho=c.variacao.id_tamanho, rotulo=c.variacao.tamanho.rotulo, cortado=c.quantidade,
            enviado=enviados.get(c.id_variacao, 0), disponivel=max(0, c.quantidade - enviados.get(c.id_variacao, 0)),
        )
        for c in cortes
    ]


def montar_resposta_op(op: CamisetaOrdemProducao) -> CamisetaOrdemProducaoResponse:
    enviado = total_enviado(op)
    grade = op.modelo.grade if op.modelo else None
    tamanhos = sorted(grade.tamanhos, key=lambda t: t.ordem) if grade else []
    return CamisetaOrdemProducaoResponse(
        id_op=op.id_op,
        codigo_op=op.codigo_op,
        id_modelo=op.id_modelo,
        nome_modelo=op.modelo.nome_modelo if op.modelo else "Modelo",
        id_pedido=op.id_pedido,
        codigo_pedido=op.pedido.codigo_pedido if op.pedido else None,
        nome_cliente_pedido=op.pedido.nome_cliente if op.pedido else None,
        id_insumo_tecido=op.id_insumo_tecido,
        nome_tecido=_nome_tecido(op),
        peso_malha_enviado_kg=op.peso_malha_enviado_kg,
        pecas_planejadas=op.pecas_planejadas,
        pecas_reais_cortadas=op.pecas_reais_cortadas,
        rendimento_real_pecas_kg=op.rendimento_real_pecas_kg,
        status_op=status_exibicao(op),
        data_corte=op.data_corte,
        criado_em=op.criado_em,
        quantidade_enviada_costura=enviado,
        saldo_disponivel_envio=max(0, (op.pecas_reais_cortadas or 0) - enviado),
        legada=not op.cores,
        cores=_resposta_das_cores(op),
        cortes=_resposta_dos_cortes(op),
        tamanhos=[TamanhoResponse(id_tamanho=t.id_tamanho, rotulo=t.rotulo) for t in tamanhos],
    )


def excluir_op(db: Session, id_op: int) -> None:
    op = obter_op(db, id_op)

    # Se já houve envio para facção/costura, não pode ser excluída
    if op.movimentacoes_costura:
        raise ErroNegocio(
            409,
            f"A ordem {op.codigo_op} já possui envios para facção/costura e não pode ser excluída.",
        )

    # Estorna o peso de malha de volta ao saldo do estoque de cada rolo utilizado
    if op.cores:
        for linha in op.cores:
            if linha.id_insumo_tecido:
                rolo = db.get(CamisetaInsumo, linha.id_insumo_tecido)
                if rolo:
                    rolo.saldo_atual = (rolo.saldo_atual or ZERO) + (linha.peso_kg or ZERO)
                    rolo.atualizado_em = get_utc_now()
    elif op.id_insumo_tecido and op.peso_malha_enviado_kg:
        rolo = db.get(CamisetaInsumo, op.id_insumo_tecido)
        if rolo:
            rolo.saldo_atual = (rolo.saldo_atual or ZERO) + (op.peso_malha_enviado_kg or ZERO)
            rolo.atualizado_em = get_utc_now()

    id_pedido = op.id_pedido
    db.delete(op)
    db.flush()

    # Se a OP estava ligada a um pedido e ele estava "Em Produção",
    # verifica se ainda restam outras OPs vinculadas; se não, volta para "Aguardando Produção"
    if id_pedido:
        pedido = db.get(CamisetaPedido, id_pedido)
        if pedido and pedido.status_pedido == "Em Produção":
            outras_ops = db.query(CamisetaOrdemProducao.id_op).filter_by(id_pedido=id_pedido).count()
            if outras_ops == 0:
                pedido.status_pedido = "Aguardando Produção"

    db.commit()
