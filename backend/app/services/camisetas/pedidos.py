# app/services/camisetas/pedidos.py
"""Regras e montagem de resposta dos pedidos de camisetas."""
from app.schemas.camisetas import CamisetaPedidoResponse

STATUS_INICIAL = "Aguardando Produção"
STATUS_ENTREGUE = "Entregue"
STATUS_VALIDOS = ("Aguardando Produção", "Em Produção", "Pronto no Estoque", "Entregue")


def montar_resposta_pedido(pedido) -> CamisetaPedidoResponse:
    return CamisetaPedidoResponse(
        id_pedido=pedido.id_pedido,
        codigo_pedido=pedido.codigo_pedido,
        nome_cliente=pedido.nome_cliente,
        id_cliente=pedido.id_cliente,
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
        data_entrega_realizada=pedido.data_entrega_realizada,
        criado_em=pedido.criado_em,
    )
