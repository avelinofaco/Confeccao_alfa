# app/services/camisetas/modelos.py
"""Modelos de camiseta: criação, edição e grade."""
from typing import Optional

from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo
from app.models.camisetas_sku import CamisetaPedidoItem, CamisetaVariacao
from app.schemas.camisetas import CamisetaModeloCreate, CamisetaModeloResponse, CamisetaModeloUpdate
from app.schemas.camisetas_sku import TamanhoResponse
from app.services.camisetas.grades import obter_grade, obter_grade_padrao, rotulos_da_grade, texto_grade


def montar_resposta_modelo(modelo: CamisetaModelo) -> CamisetaModeloResponse:
    grade = modelo.grade
    tamanhos = rotulos_da_grade(grade) if grade else [r.strip() for r in (modelo.grade_disponivel or "").split(",") if r.strip()]
    return CamisetaModeloResponse(
        id_modelo=modelo.id_modelo,
        nome_modelo=modelo.nome_modelo,
        grade_disponivel=modelo.grade_disponivel,
        consumo_tecido_kg=modelo.consumo_tecido_kg,
        descricao=modelo.descricao,
        criado_em=modelo.criado_em,
        atualizado_em=modelo.atualizado_em,
        id_grade=modelo.id_grade,
        nome_grade=grade.nome if grade else None,
        tamanhos=tamanhos,
        grade_tamanhos=[
            TamanhoResponse(id_tamanho=t.id_tamanho, rotulo=t.rotulo)
            for t in sorted(grade.tamanhos, key=lambda t: t.ordem)
        ] if grade else [],
    )


def definir_grade(db: Session, modelo: CamisetaModelo, id_grade: Optional[int]) -> None:
    grade = obter_grade(db, id_grade) if id_grade is not None else obter_grade_padrao(db)
    modelo.grade = grade
    modelo.grade_disponivel = texto_grade(rotulos_da_grade(grade))


def _validar_nome(db: Session, nome: str, id_modelo=None) -> str:
    limpo = " ".join(nome.split())
    repetido = (
        db.query(CamisetaModelo)
        .filter(CamisetaModelo.nome_modelo == limpo, CamisetaModelo.id_modelo != id_modelo)
        .first()
    )
    if repetido:
        raise ErroNegocio(409, "Já existe um modelo com esse nome.")
    return limpo


def criar_modelo(db: Session, dados: CamisetaModeloCreate) -> CamisetaModelo:
    modelo = CamisetaModelo(
        nome_modelo=_validar_nome(db, dados.nome_modelo),
        consumo_tecido_kg=dados.consumo_tecido_kg,
        descricao=dados.descricao,
    )
    definir_grade(db, modelo, dados.id_grade)
    db.add(modelo)
    db.commit()
    db.refresh(modelo)
    return modelo


def _modelo_em_uso(db: Session, id_modelo: int) -> bool:
    return (
        db.query(CamisetaVariacao.id_variacao).filter_by(id_modelo=id_modelo).first() is not None
        or db.query(CamisetaPedidoItem.id_item).filter_by(id_modelo=id_modelo).first() is not None
    )


def atualizar_modelo(db: Session, id_modelo: int, dados: CamisetaModeloUpdate) -> CamisetaModelo:
    modelo = db.get(CamisetaModelo, id_modelo)
    if modelo is None:
        raise ErroNegocio(404, "Modelo não encontrado.")
    trocando_grade = dados.id_grade is not None and dados.id_grade != modelo.id_grade
    if trocando_grade and _modelo_em_uso(db, id_modelo):
        raise ErroNegocio(
            409,
            f"O modelo {modelo.nome_modelo} já tem pedidos ou estoque por tamanho; a grade não pode ser trocada. "
            "Acrescente os tamanhos que faltam na grade atual.",
        )
    modelo.nome_modelo = _validar_nome(db, dados.nome_modelo, id_modelo)
    modelo.consumo_tecido_kg = dados.consumo_tecido_kg
    modelo.descricao = dados.descricao
    if dados.id_grade is not None or modelo.grade is None:
        definir_grade(db, modelo, dados.id_grade)
    db.commit()
    db.refresh(modelo)
    return modelo
