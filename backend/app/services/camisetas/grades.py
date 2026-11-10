# app/services/camisetas/grades.py
"""Grades de tamanhos: validação, ordem, sincronização com os modelos e grade padrão."""
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo
from app.models.camisetas_cadastros import CamisetaGrade, CamisetaGradeTamanho
from app.schemas.camisetas_cadastros import GradeEntrada, GradeResponse

GRADE_PADRAO_NOME = "Adulto (P, M, G, GG)"
TAMANHOS_PADRAO = ("P", "M", "G", "GG")
TAMANHO_MAX = 10


def limpar_tamanhos(rotulos) -> list[str]:
    limpos = [" ".join((r or "").split()) for r in rotulos]
    limpos = [r for r in limpos if r]
    if not limpos:
        raise ErroNegocio(400, "A grade precisa de pelo menos um tamanho.")
    longo = next((r for r in limpos if len(r) > TAMANHO_MAX), None)
    if longo:
        raise ErroNegocio(400, f"O tamanho '{longo}' passa de {TAMANHO_MAX} caracteres.")
    vistos = set()
    for rotulo in limpos:
        if rotulo.casefold() in vistos:
            raise ErroNegocio(400, f"Tamanho repetido na grade: {rotulo}.")
        vistos.add(rotulo.casefold())
    return limpos


def texto_grade(rotulos) -> str:
    return ", ".join(rotulos)


def rotulos_da_grade(grade: CamisetaGrade) -> list[str]:
    return [t.rotulo for t in sorted(grade.tamanhos, key=lambda t: t.ordem)]


def aplicar_tamanhos(grade: CamisetaGrade, rotulos: list[str]) -> None:
    """Mantém os tamanhos que continuam (preservando o id), cria os novos e remove os retirados."""
    existentes = {t.rotulo: t for t in grade.tamanhos}
    novos = []
    for ordem, rotulo in enumerate(rotulos, start=1):
        tamanho = existentes.pop(rotulo, None) or CamisetaGradeTamanho(rotulo=rotulo)
        tamanho.ordem = ordem
        novos.append(tamanho)
    grade.tamanhos = novos


def obter_grade(db: Session, id_grade: int) -> CamisetaGrade:
    grade = db.get(CamisetaGrade, id_grade)
    if grade is None:
        raise ErroNegocio(404, "Grade não encontrada.")
    return grade


def obter_grade_padrao(db: Session) -> CamisetaGrade:
    """Grade 'Adulto (P, M, G, GG)', criada se não existir. Não faz commit."""
    grade = db.query(CamisetaGrade).filter_by(nome=GRADE_PADRAO_NOME).first()
    if grade is None:
        grade = CamisetaGrade(nome=GRADE_PADRAO_NOME, ativo=True)
        aplicar_tamanhos(grade, list(TAMANHOS_PADRAO))
        db.add(grade)
        db.flush()
    return grade


def _contar_modelos(db: Session) -> dict:
    linhas = db.query(CamisetaModelo.id_grade, func.count(CamisetaModelo.id_modelo)).group_by(CamisetaModelo.id_grade).all()
    return dict(linhas)


def montar_resposta_grade(grade: CamisetaGrade, qtd_modelos: int = 0) -> GradeResponse:
    return GradeResponse(
        id_grade=grade.id_grade, nome=grade.nome, ativo=grade.ativo,
        tamanhos=rotulos_da_grade(grade), qtd_modelos=qtd_modelos,
    )


def listar_grades(db: Session, incluir_inativas: bool = False) -> list[GradeResponse]:
    consulta = db.query(CamisetaGrade)
    if not incluir_inativas:
        consulta = consulta.filter(CamisetaGrade.ativo.is_(True))
    contagem = _contar_modelos(db)
    return [montar_resposta_grade(g, contagem.get(g.id_grade, 0)) for g in consulta.order_by(CamisetaGrade.nome).all()]


def resposta_da_grade(db: Session, grade: CamisetaGrade) -> GradeResponse:
    return montar_resposta_grade(grade, _contar_modelos(db).get(grade.id_grade, 0))


def _validar_nome(db: Session, nome: str, id_grade=None) -> str:
    limpo = " ".join(nome.split())
    repetida = (
        db.query(CamisetaGrade)
        .filter(func.lower(CamisetaGrade.nome) == limpo.lower(), CamisetaGrade.id_grade != id_grade)
        .first()
    )
    if repetida:
        raise ErroNegocio(409, f"Já existe a grade {repetida.nome}.")
    return limpo


def _sincronizar_modelos(db: Session, grade: CamisetaGrade) -> None:
    texto = texto_grade(rotulos_da_grade(grade))
    for modelo in db.query(CamisetaModelo).filter_by(id_grade=grade.id_grade).all():
        modelo.grade_disponivel = texto


def criar_grade(db: Session, dados: GradeEntrada) -> CamisetaGrade:
    grade = CamisetaGrade(nome=_validar_nome(db, dados.nome), ativo=dados.ativo)
    aplicar_tamanhos(grade, limpar_tamanhos(dados.tamanhos))
    db.add(grade)
    db.commit()
    db.refresh(grade)
    return grade


def atualizar_grade(db: Session, id_grade: int, dados: GradeEntrada) -> CamisetaGrade:
    grade = obter_grade(db, id_grade)
    grade.nome = _validar_nome(db, dados.nome, id_grade)
    grade.ativo = dados.ativo
    aplicar_tamanhos(grade, limpar_tamanhos(dados.tamanhos))
    db.flush()
    _sincronizar_modelos(db, grade)
    db.commit()
    db.refresh(grade)
    return grade


def excluir_grade(db: Session, id_grade: int) -> None:
    grade = obter_grade(db, id_grade)
    if db.query(CamisetaModelo.id_modelo).filter_by(id_grade=id_grade).first() is not None:
        raise ErroNegocio(409, "Grade em uso por modelos; inative-a em vez de excluir.")
    db.delete(grade)
    db.commit()
