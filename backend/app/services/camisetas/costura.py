# app/services/camisetas/costura.py
"""Remessas para facções: envio e retorno por SKU, com o caminho antigo para OPs cortadas sem cor e tamanho."""
from decimal import Decimal
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaCosturaFaccao, CamisetaFichaTecnica, CamisetaOrdemProducao, get_utc_now
from app.models.camisetas_sku import CamisetaRemessaItem, CamisetaVariacao
from app.schemas.camisetas import (
    CamisetaCosturaFaccaoEnviar,
    CamisetaCosturaFaccaoResponse,
    CamisetaCosturaFaccaoRetornar,
)
from app.schemas.camisetas_sku import RemessaItemResponse
from app.services.camisetas.cores import obter_cor
from app.services.camisetas.estoque import (
    AVISO_SEM_AVIAMENTOS,
    TIPO_TECIDO_PRINCIPAL,
    aplicar_baixa,
    calcular_necessidades,
    listar_faltas,
)
from app.services.camisetas.sku import (
    ENTRADA_PRODUCAO,
    descrever_variacao,
    movimentar,
    obter_ou_criar_variacao,
    tamanho_do_modelo,
)

STATUS_REMESSA_EM_COSTURA = "Em Costura Externa"
STATUS_REMESSA_RETORNADA = "Retornado e Conferido"
STATUS_OP_EM_COSTURA = "Em Costura"
STATUS_OP_FINALIZADA = "Costura Finalizada"


def status_op_apos_retorno(pecas_cortadas: int, remessas) -> str:
    """A OP só finaliza quando todas as peças cortadas foram enviadas e nenhuma remessa está pendente."""
    enviado = sum(r.quantidade_enviada or 0 for r in remessas)
    ha_pendentes = any(r.status == STATUS_REMESSA_EM_COSTURA for r in remessas)
    if enviado >= pecas_cortadas and not ha_pendentes:
        return STATUS_OP_FINALIZADA
    return STATUS_OP_EM_COSTURA


def total_enviado(op) -> int:
    return sum(r.quantidade_enviada or 0 for r in op.movimentacoes_costura or [])


def quantidades_enviadas_por_sku(op) -> dict[int, int]:
    enviados: dict[int, int] = {}
    for remessa in op.movimentacoes_costura or []:
        for item in remessa.itens:
            enviados[item.id_variacao] = enviados.get(item.id_variacao, 0) + item.qtd_enviada
    return enviados


def _envio_legado(op: CamisetaOrdemProducao, dados: CamisetaCosturaFaccaoEnviar) -> int:
    if dados.itens:
        raise ErroNegocio(400, "Esta OP foi cortada sem cor e tamanho; informe só a quantidade total.")
    quantidade = dados.quantidade_enviada or 0
    if quantidade <= 0:
        raise ErroNegocio(400, "Quantidade enviada deve ser maior que zero")
    saldo = max(0, (op.pecas_reais_cortadas or 0) - total_enviado(op))
    if quantidade > saldo:
        raise ErroNegocio(
            400, f"Quantidade a enviar ({quantidade}) ultrapassa o saldo de painéis cortados disponíveis nesta OP ({saldo}).")
    return quantidade


def _envio_por_sku(op: CamisetaOrdemProducao, dados: CamisetaCosturaFaccaoEnviar) -> list[tuple[CamisetaVariacao, int]]:
    if not dados.itens:
        raise ErroNegocio(400, "Informe quantas peças de cada cor e tamanho vão para a facção.")
    cortes = {c.id_variacao: c for c in op.cortes}
    enviados = quantidades_enviadas_por_sku(op)
    vistos = set()
    linhas = []
    for item in dados.itens:
        corte = cortes.get(item.id_variacao)
        if corte is None:
            raise ErroNegocio(400, "Há uma cor e tamanho no envio que não foi cortado nesta OP.")
        if item.id_variacao in vistos:
            raise ErroNegocio(400, "A mesma cor e tamanho aparece duas vezes no envio.")
        vistos.add(item.id_variacao)
        disponivel = corte.quantidade - enviados.get(item.id_variacao, 0)
        if item.quantidade > disponivel:
            raise ErroNegocio(
                400, f"{descrever_variacao(corte.variacao)}: só há {max(disponivel, 0)} peça(s) cortada(s) para enviar.")
        linhas.append((corte.variacao, item.quantidade))
    return linhas


def enviar_remessa(db: Session, dados: CamisetaCosturaFaccaoEnviar) -> tuple[CamisetaCosturaFaccao, list[str]]:
    """Envia peças cortadas à facção e baixa os aviamentos da ficha técnica (com margem)."""
    op = db.get(CamisetaOrdemProducao, dados.id_op)
    if op is None:
        raise ErroNegocio(404, "Ordem de corte não encontrada")
    linhas = _envio_por_sku(op, dados) if op.cortes else []
    quantidade = sum(q for _, q in linhas) if op.cortes else _envio_legado(op, dados)
    itens_ficha = db.query(CamisetaFichaTecnica).filter(
        CamisetaFichaTecnica.id_modelo == op.id_modelo,
        CamisetaFichaTecnica.tipo_insumo != TIPO_TECIDO_PRINCIPAL,
    ).all()
    necessidades = calcular_necessidades(itens_ficha, quantidade, dados.margem_seguranca_aviamentos_percentual)
    faltas = listar_faltas(necessidades)
    if faltas and not dados.confirmar_saldo_insuficiente:
        raise ErroNegocio(409, "Aviamentos insuficientes no estoque para este envio.",
                          {"faltas": [f.para_dict() for f in faltas]})
    remessa = CamisetaCosturaFaccao(
        id_op=op.id_op, nome_faccao=dados.nome_faccao, quantidade_enviada=quantidade,
        margem_seguranca_aviamentos_percentual=dados.margem_seguranca_aviamentos_percentual,
        status=STATUS_REMESSA_EM_COSTURA, data_envio=get_utc_now(), observacoes=dados.observacoes,
    )
    remessa.itens = [CamisetaRemessaItem(id_variacao=v.id_variacao, qtd_enviada=q) for v, q in linhas]
    db.add(remessa)
    op.status_op = STATUS_OP_EM_COSTURA
    aplicar_baixa(necessidades)
    db.commit()
    db.refresh(remessa)
    return remessa, ([] if necessidades else [AVISO_SEM_AVIAMENTOS])


def _sem_repeticao(itens) -> None:
    vistos = set()
    for item in itens:
        if (item.id_cor, item.id_tamanho) in vistos:
            raise ErroNegocio(400, "A mesma cor e tamanho aparece duas vezes no retorno.")
        vistos.add((item.id_cor, item.id_tamanho))


def _retorno_com_itens(remessa: CamisetaCosturaFaccao, itens) -> list[tuple[CamisetaRemessaItem, int]]:
    enviados = {(i.variacao.id_cor, i.variacao.id_tamanho): i for i in remessa.itens}
    retornos: dict[int, int] = {}
    for item in itens:
        enviado = enviados.get((item.id_cor, item.id_tamanho))
        if enviado is None:
            raise ErroNegocio(400, "Há uma cor e tamanho no retorno que não foi enviado nesta remessa.")
        if item.quantidade > enviado.qtd_enviada:
            raise ErroNegocio(
                400, f"{descrever_variacao(enviado.variacao)}: voltaram {item.quantidade}, mas foram enviadas {enviado.qtd_enviada}.")
        retornos[enviado.id_item] = item.quantidade
    return [(enviado, retornos.get(enviado.id_item, 0)) for enviado in remessa.itens]


def _retorno_legado(db: Session, remessa: CamisetaCosturaFaccao, itens) -> list[tuple[CamisetaVariacao, int]]:
    modelo = remessa.op.modelo
    for item in itens:  # valida tudo antes de criar SKUs
        tamanho_do_modelo(db, modelo, item.id_tamanho)
        obter_cor(db, item.id_cor)
    return [(obter_ou_criar_variacao(db, modelo, i.id_cor, i.id_tamanho), i.quantidade) for i in itens if i.quantidade > 0]


def _entradas_do_retorno(db: Session, remessa: CamisetaCosturaFaccao, itens) -> list[tuple[CamisetaVariacao, int]]:
    if not remessa.itens:
        return _retorno_legado(db, remessa, itens)
    pares = _retorno_com_itens(remessa, itens)
    for item, quantidade in pares:
        item.qtd_retornada = quantidade
    return [(item.variacao, quantidade) for item, quantidade in pares if quantidade > 0]


def registrar_retorno(db: Session, id_costura: int, dados: CamisetaCosturaFaccaoRetornar) -> CamisetaCosturaFaccao:
    """Confere o retorno por cor e tamanho, apura as perdas e lança as peças no estoque de cada SKU."""
    remessa = db.get(CamisetaCosturaFaccao, id_costura)
    if remessa is None:
        raise ErroNegocio(404, "Remessa de costura não encontrada")
    if remessa.status != STATUS_REMESSA_EM_COSTURA:
        raise ErroNegocio(409, "Esta remessa já teve o retorno registrado.")
    _sem_repeticao(dados.itens)
    retornado = sum(i.quantidade for i in dados.itens)
    if retornado > remessa.quantidade_enviada:
        raise ErroNegocio(400, f"O retorno ({retornado}) não pode ser maior que o enviado ({remessa.quantidade_enviada}).")
    for variacao, quantidade in _entradas_do_retorno(db, remessa, dados.itens):
        movimentar(db, variacao, quantidade, ENTRADA_PRODUCAO, motivo=f"Retorno da facção {remessa.nome_faccao}",
                   id_costura=remessa.id_costura)
    remessa.quantidade_retornada = retornado
    remessa.perdas_pecas = remessa.quantidade_enviada - retornado
    remessa.saldo_aprovado = retornado
    remessa.data_retorno = get_utc_now()
    remessa.status = STATUS_REMESSA_RETORNADA
    if dados.observacoes:
        remessa.observacoes = (remessa.observacoes or "") + " | Retorno: " + dados.observacoes
    db.flush()
    if remessa.op:
        remessa.op.status_op = status_op_apos_retorno(remessa.op.pecas_reais_cortadas or 0, remessa.op.movimentacoes_costura)
    db.commit()
    db.refresh(remessa)
    return remessa


def _resposta_dos_itens(remessa: CamisetaCosturaFaccao) -> list[RemessaItemResponse]:
    itens = sorted(remessa.itens, key=lambda i: (i.variacao.cor.nome.casefold(), i.variacao.tamanho.ordem))
    return [
        RemessaItemResponse(
            id_variacao=i.id_variacao, id_cor=i.variacao.id_cor, nome_cor=i.variacao.cor.nome, hex_cor=i.variacao.cor.hex,
            id_tamanho=i.variacao.id_tamanho, rotulo=i.variacao.tamanho.rotulo,
            qtd_enviada=i.qtd_enviada, qtd_retornada=i.qtd_retornada,
        )
        for i in itens
    ]


def montar_resposta_remessa(remessa, avisos=None) -> CamisetaCosturaFaccaoResponse:
    op = remessa.op
    return CamisetaCosturaFaccaoResponse(
        id_costura=remessa.id_costura,
        id_op=remessa.id_op,
        codigo_op=op.codigo_op if op else "OP",
        nome_modelo=op.modelo.nome_modelo if op and op.modelo else "Modelo",
        nome_faccao=remessa.nome_faccao,
        quantidade_enviada=remessa.quantidade_enviada,
        margem_seguranca_aviamentos_percentual=remessa.margem_seguranca_aviamentos_percentual,
        quantidade_retornada=remessa.quantidade_retornada,
        perdas_pecas=remessa.perdas_pecas,
        saldo_aprovado=remessa.saldo_aprovado,
        status=remessa.status,
        data_envio=remessa.data_envio,
        data_retorno=remessa.data_retorno,
        observacoes=remessa.observacoes,
        avisos=list(avisos or []),
        id_modelo=op.id_modelo if op else None,
        legada=not remessa.itens,
        itens=_resposta_dos_itens(remessa),
    )


def excluir_remessa(db: Session, id_costura: int) -> None:
    """Exclui uma remessa enviada à facção se ainda estiver em costura externa, estornando os aviamentos."""
    remessa = db.get(CamisetaCosturaFaccao, id_costura)
    if remessa is None:
        raise ErroNegocio(404, "Remessa de costura não encontrada")
    if remessa.status != STATUS_REMESSA_EM_COSTURA:
        raise ErroNegocio(409, "Apenas remessas com status 'Em Costura Externa' podem ser excluídas.")

    op = remessa.op
    if op:
        # Estorna os aviamentos baixados de volta ao estoque
        itens_ficha = db.query(CamisetaFichaTecnica).filter(
            CamisetaFichaTecnica.id_modelo == op.id_modelo,
            CamisetaFichaTecnica.tipo_insumo != TIPO_TECIDO_PRINCIPAL,
        ).all()
        necessidades = calcular_necessidades(
            itens_ficha,
            remessa.quantidade_enviada,
            remessa.margem_seguranca_aviamentos_percentual,
        )
        for n in necessidades:
            n.insumo.saldo_atual = Decimal(str(n.insumo.saldo_atual or 0)) + n.quantidade
            n.insumo.atualizado_em = get_utc_now()

        # Atualiza status da OP
        remessas_restantes = [r for r in (op.movimentacoes_costura or []) if r.id_costura != id_costura]
        if not remessas_restantes:
            from app.services.camisetas.ordens import STATUS_OP_AGUARDANDO, STATUS_OP_CORTADA
            op.status_op = STATUS_OP_CORTADA if (op.pecas_reais_cortadas or 0) > 0 else STATUS_OP_AGUARDANDO
        else:
            op.status_op = status_op_apos_retorno(op.pecas_reais_cortadas or 0, remessas_restantes)

    db.delete(remessa)
    db.commit()

