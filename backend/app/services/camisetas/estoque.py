# app/services/camisetas/estoque.py
"""Regras de estoque do segmento Camisetas."""
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models.camisetas import CamisetaProdutoAcabado, get_utc_now

DUAS_CASAS = Decimal("0.01")
ZERO = Decimal("0")
CAMPOS_GRADE = ("grade_p", "grade_m", "grade_g", "grade_gg")


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


def obter_ou_criar_estoque_acabado(db: Session, id_modelo: int) -> CamisetaProdutoAcabado:
    estoque = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=id_modelo).first()
    if estoque is None:
        estoque = CamisetaProdutoAcabado(
            id_modelo=id_modelo, grade_p=0, grade_m=0, grade_g=0, grade_gg=0,
            quantidade_total=0, atualizado_em=get_utc_now(),
        )
        db.add(estoque)
        db.flush()
    return estoque


def baixar_estoque_acabado(estoque: CamisetaProdutoAcabado, pedido) -> None:
    """Tira do estoque pronto as peças do pedido (nunca abaixo de zero)."""
    estoque.quantidade_total = max(0, (estoque.quantidade_total or 0) - pedido.quantidade_total)
    for campo in CAMPOS_GRADE:
        setattr(estoque, campo, max(0, (getattr(estoque, campo) or 0) - (getattr(pedido, campo) or 0)))
    estoque.atualizado_em = get_utc_now()


def devolver_estoque_acabado(estoque: CamisetaProdutoAcabado, pedido) -> None:
    """Devolve ao estoque pronto as peças de um pedido cuja entrega foi revertida."""
    estoque.quantidade_total = (estoque.quantidade_total or 0) + pedido.quantidade_total
    for campo in CAMPOS_GRADE:
        setattr(estoque, campo, (getattr(estoque, campo) or 0) + (getattr(pedido, campo) or 0))
    estoque.atualizado_em = get_utc_now()
