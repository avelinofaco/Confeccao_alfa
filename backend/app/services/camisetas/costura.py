# app/services/camisetas/costura.py
"""Regras das remessas para facções (costura terceirizada)."""
from app.schemas.camisetas import CamisetaCosturaFaccaoResponse

STATUS_REMESSA_EM_COSTURA = "Em Costura Externa"
STATUS_REMESSA_RETORNADA = "Retornado e Conferido"
STATUS_OP_EM_COSTURA = "Em Costura"
STATUS_OP_FINALIZADA = "Costura Finalizada"


def status_op_apos_retorno(pecas_cortadas: int, remessas) -> str:
    """A OP só finaliza quando todas as peças cortadas foram enviadas e nenhuma remessa está pendente."""
    total_enviado = sum(r.quantidade_enviada or 0 for r in remessas)
    ha_pendentes = any(r.status == STATUS_REMESSA_EM_COSTURA for r in remessas)
    if total_enviado >= pecas_cortadas and not ha_pendentes:
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
    )
