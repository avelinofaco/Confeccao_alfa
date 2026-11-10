# app/services/camisetas/estoque.py
"""Regras de estoque do segmento Camisetas."""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.models.camisetas import CamisetaInsumo, CamisetaProdutoAcabado, get_utc_now

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


TRES_CASAS = Decimal("0.001")
TIPO_TECIDO_PRINCIPAL = "Tecido Principal"
AVISO_SEM_AVIAMENTOS = (
    "A ficha técnica deste modelo não tem aviamentos ligados ao estoque; nenhum aviamento foi baixado."
)


@dataclass(frozen=True)
class NecessidadeAviamento:
    insumo: CamisetaInsumo
    quantidade: Decimal


@dataclass(frozen=True)
class FaltaAviamento:
    codigo: str
    descricao: str
    necessario: Decimal
    disponivel: Decimal
    unidade: str

    def para_dict(self) -> dict:
        return {
            "codigo": self.codigo,
            "descricao": self.descricao,
            "necessario": float(self.necessario),
            "disponivel": float(self.disponivel),
            "unidade": self.unidade,
        }


def calcular_necessidades(itens_ficha, quantidade_pecas: int, margem_percentual: Decimal) -> list[NecessidadeAviamento]:
    """Consumo de cada aviamento ligado ao estoque para o lote, já com a margem de segurança.

    Itens que apontam para o mesmo insumo são somados; itens sem insumo são ignorados.
    """
    multiplicador = Decimal("1") + Decimal(str(margem_percentual)) / Decimal("100")
    insumos = {}
    totais = {}
    for item in itens_ficha:
        if item.insumo is None:
            continue
        chave = item.insumo.id_insumo
        insumos[chave] = item.insumo
        consumo = Decimal(str(item.consumo_unitario)) * quantidade_pecas * multiplicador
        totais[chave] = totais.get(chave, ZERO) + consumo
    return [
        NecessidadeAviamento(insumo=insumos[chave], quantidade=total.quantize(TRES_CASAS, rounding=ROUND_HALF_UP))
        for chave, total in totais.items()
    ]


def listar_faltas(necessidades: list[NecessidadeAviamento]) -> list[FaltaAviamento]:
    return [
        FaltaAviamento(
            codigo=n.insumo.codigo,
            descricao=n.insumo.tipo_malha_ou_aviamento,
            necessario=n.quantidade,
            disponivel=Decimal(str(n.insumo.saldo_atual or 0)),
            unidade=n.insumo.unidade_medida,
        )
        for n in necessidades
        if Decimal(str(n.insumo.saldo_atual or 0)) < n.quantidade
    ]


def aplicar_baixa(necessidades: list[NecessidadeAviamento]) -> None:
    """Baixa os aviamentos do estoque; o saldo pode ficar negativo (pendência de inventário)."""
    for n in necessidades:
        n.insumo.saldo_atual = Decimal(str(n.insumo.saldo_atual or 0)) - n.quantidade
        n.insumo.atualizado_em = get_utc_now()
