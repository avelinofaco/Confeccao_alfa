# app/services/camisetas/precificacao.py
"""Cálculo puro de precificação por modelo, estampa e posição."""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

DUAS_CASAS = Decimal("0.01")


def arredondar_moeda(valor: Decimal | int | float | None) -> Decimal:
    return Decimal(str(valor or 0)).quantize(DUAS_CASAS, rounding=ROUND_HALF_UP)


def calcular_preco_unitario(
    preco_venda_lisa: Decimal | None,
    acrescimo_estampa: Decimal | None,
    tem_estampa: bool,
    posicao_estampa: Optional[str] = None,
) -> Decimal:
    """Preço de 1 peça: base lisa + acréscimo de estampa (dobrado em 'Frente e Costas')."""
    base = arredondar_moeda(preco_venda_lisa)
    if not tem_estampa:
        return base
    adicional = arredondar_moeda(acrescimo_estampa)
    eh_frente_e_costas = (posicao_estampa or "").strip().casefold() == "frente e costas"
    multiplicador = 2 if eh_frente_e_costas else 1
    return arredondar_moeda(base + adicional * multiplicador)
