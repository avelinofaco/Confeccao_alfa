# app/services/camisetas/cores.py
"""Cadastro de cores de camiseta."""
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaInsumo
from app.models.camisetas_cadastros import CamisetaCor
from app.models.camisetas_sku import CamisetaOpCor, CamisetaPedidoItem, CamisetaVariacao
from app.schemas.camisetas_cadastros import CorEntrada

MODELOS_QUE_USAM_COR = (CamisetaVariacao, CamisetaPedidoItem, CamisetaOpCor)


def listar_cores(db: Session, incluir_inativas: bool = False) -> list[CamisetaCor]:
    consulta = db.query(CamisetaCor)
    if not incluir_inativas:
        consulta = consulta.filter(CamisetaCor.ativo.is_(True))
    return consulta.order_by(CamisetaCor.nome).all()


def obter_cor(db: Session, id_cor: int) -> CamisetaCor:
    cor = db.get(CamisetaCor, id_cor)
    if cor is None:
        raise ErroNegocio(404, "Cor não encontrada.")
    return cor


def _aplicar(db: Session, cor: CamisetaCor, dados: CorEntrada) -> None:
    nome = " ".join(dados.nome.split())
    repetida = (
        db.query(CamisetaCor)
        .filter(func.lower(CamisetaCor.nome) == nome.lower(), CamisetaCor.id_cor != cor.id_cor)
        .first()
    )
    if repetida:
        raise ErroNegocio(409, f"Já existe a cor {repetida.nome}.")
    cor.nome = nome
    cor.hex = dados.hex.upper()
    cor.ativo = dados.ativo


def criar_cor(db: Session, dados: CorEntrada) -> CamisetaCor:
    cor = CamisetaCor()
    _aplicar(db, cor, dados)
    db.add(cor)
    db.commit()
    db.refresh(cor)
    return cor


def atualizar_cor(db: Session, id_cor: int, dados: CorEntrada) -> CamisetaCor:
    cor = obter_cor(db, id_cor)
    _aplicar(db, cor, dados)
    db.commit()
    db.refresh(cor)
    return cor


def excluir_cor(db: Session, id_cor: int) -> None:
    cor = obter_cor(db, id_cor)
    if db.query(CamisetaInsumo.id_insumo).filter_by(id_cor=id_cor).first() is not None:
        raise ErroNegocio(409, "Cor em uso por malhas do estoque; inative-a em vez de excluir.")
    if any(db.query(modelo).filter_by(id_cor=id_cor).first() is not None for modelo in MODELOS_QUE_USAM_COR):
        raise ErroNegocio(409, "Cor em uso por estoque pronto, pedidos ou produção; inative-a em vez de excluir.")
    db.delete(cor)
    db.commit()


def validar_cor_opcional(db: Session, id_cor: Optional[int]) -> None:
    if id_cor is not None:
        obter_cor(db, id_cor)
