# app/services/camisetas/estoque.py
"""Regras de estoque do segmento Camisetas."""
from decimal import ROUND_HALF_UP, Decimal

DUAS_CASAS = Decimal("0.01")
ZERO = Decimal("0")


def calcular_custo_medio(saldo_anterior: Decimal, custo_anterior: Decimal,
                         quantidade: Decimal, valor_total: Decimal) -> Decimal:
    """Custo médio ponderado depois de uma entrada de nota fiscal.

    - Entrada sem valor (bonificação, ajuste) não altera o custo.
    - Saldo zero ou negativo: o custo passa a ser o da própria nota.
    """
    if valor_total <= ZERO:
        return custo_anterior
    if saldo_anterior > ZERO:
        novo_custo = (saldo_anterior * custo_anterior + valor_total) / (saldo_anterior + quantidade)
    else:
        novo_custo = valor_total / quantidade
    return novo_custo.quantize(DUAS_CASAS, rounding=ROUND_HALF_UP)
