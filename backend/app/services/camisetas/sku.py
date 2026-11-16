# app/services/camisetas/sku.py
"""SKU (modelo + cor + tamanho): criação e a única porta de entrada para mudar o saldo de peças prontas."""
from typing import Optional

from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo, get_utc_now
from app.models.camisetas_cadastros import CamisetaGradeTamanho
from app.models.camisetas_sku import CamisetaMovimentoEstoque, CamisetaVariacao
from app.services.camisetas.cores import obter_cor

INVENTARIO = "INVENTARIO"
AJUSTE = "AJUSTE"
ENTRADA_PRODUCAO = "ENTRADA_PRODUCAO"
SAIDA_ENTREGA = "SAIDA_ENTREGA"
ESTORNO_ENTREGA = "ESTORNO_ENTREGA"
TIPOS_MOVIMENTO = (INVENTARIO, AJUSTE, ENTRADA_PRODUCAO, SAIDA_ENTREGA, ESTORNO_ENTREGA)


def obter_modelo(db: Session, id_modelo: int) -> CamisetaModelo:
    modelo = db.get(CamisetaModelo, id_modelo)
    if modelo is None:
        raise ErroNegocio(404, "Modelo não encontrado.")
    return modelo


def tamanhos_do_modelo(modelo: CamisetaModelo) -> list[CamisetaGradeTamanho]:
    if modelo.grade is None:
        raise ErroNegocio(400, f"O modelo {modelo.nome_modelo} não tem grade de tamanhos; defina uma na Ficha Técnica.")
    return sorted(modelo.grade.tamanhos, key=lambda t: t.ordem)


def tamanho_do_modelo(db: Session, modelo: CamisetaModelo, id_tamanho: int) -> CamisetaGradeTamanho:
    tamanho = next((t for t in tamanhos_do_modelo(modelo) if t.id_tamanho == id_tamanho), None)
    if tamanho is None:
        desconhecido = db.get(CamisetaGradeTamanho, id_tamanho)
        rotulo = desconhecido.rotulo if desconhecido else f"nº {id_tamanho}"
        raise ErroNegocio(400, f"O tamanho {rotulo} não faz parte da grade do modelo {modelo.nome_modelo}.")
    return tamanho


def buscar_variacao(db: Session, id_modelo: int, id_cor: int, id_tamanho: int) -> Optional[CamisetaVariacao]:
    return db.query(CamisetaVariacao).filter_by(id_modelo=id_modelo, id_cor=id_cor, id_tamanho=id_tamanho).first()


def obter_ou_criar_variacao(db: Session, modelo: CamisetaModelo, id_cor: int, id_tamanho: int) -> CamisetaVariacao:
    """Valida o tamanho (grade do modelo) e a cor; cria o SKU com saldo zero se ainda não existir. Não faz commit."""
    tamanho_do_modelo(db, modelo, id_tamanho)
    existente = buscar_variacao(db, modelo.id_modelo, id_cor, id_tamanho)
    if existente is not None:
        return existente
    obter_cor(db, id_cor)
    variacao = CamisetaVariacao(id_modelo=modelo.id_modelo, id_cor=id_cor, id_tamanho=id_tamanho, saldo=0, estoque_minimo=0)
    db.add(variacao)
    db.flush()
    return variacao


def obter_variacao(db: Session, id_variacao: int) -> CamisetaVariacao:
    variacao = db.get(CamisetaVariacao, id_variacao)
    if variacao is None:
        raise ErroNegocio(404, "Item de estoque não encontrado.")
    return variacao


def descrever_variacao(variacao: CamisetaVariacao) -> str:
    return f"{variacao.modelo.nome_modelo} · {variacao.cor.nome} · {variacao.tamanho.rotulo}"


def movimentar(db: Session, variacao: CamisetaVariacao, quantidade: int, tipo: str, motivo: Optional[str] = None,
               id_pedido: Optional[int] = None, id_costura: Optional[int] = None) -> CamisetaMovimentoEstoque:
    """Única forma de alterar o saldo: soma a quantidade (com sinal) e grava o movimento. Não faz commit."""
    if tipo not in TIPOS_MOVIMENTO:
        raise ValueError(f"Tipo de movimento desconhecido: {tipo}")
    if quantidade == 0:
        raise ValueError("Movimento com quantidade zero.")
    saldo_atual = variacao.saldo or 0
    novo_saldo = saldo_atual + quantidade
    if novo_saldo < 0:
        raise ErroNegocio(
            400,
            f"Saldo insuficiente de {descrever_variacao(variacao)}: há {saldo_atual} peça(s) e a operação tira {-quantidade}.",
        )
    variacao.saldo = novo_saldo
    movimento = CamisetaMovimentoEstoque(
        id_variacao=variacao.id_variacao, tipo=tipo, quantidade=quantidade, saldo_apos=novo_saldo,
        motivo=motivo, id_pedido=id_pedido, id_costura=id_costura, criado_em=get_utc_now(),
    )
    db.add(movimento)
    return movimento
