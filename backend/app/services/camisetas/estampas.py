# app/services/camisetas/estampas.py
"""Regras de negócio do Banco de Estampas (Segmento Camisetas)."""
import base64
import binascii
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas_estampas import CamisetaEstampa
from app.schemas.camisetas_estampas import EstampaCreate, EstampaUpdate
from app.services.documentos import normalizar_nome
from app.services.sequencias import proximo_codigo

LIMITE_BYTES_ESTAMPA = 2 * 1024 * 1024  # 2 MB


def _detectar_mime_real(dados: bytes) -> str:
    if dados.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if dados.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(dados) >= 12 and dados[:4] == b"RIFF" and dados[8:12] == b"WEBP":
        return "image/webp"
    raise ErroNegocio(400, "Formato de imagem não suportado. Use PNG, JPG ou WEBP.")


def decodificar_imagem_estampa(imagem_data_url: str) -> tuple[bytes, str]:
    """Valida e decodifica a imagem enviada (data URL ou base64 puro), conferindo assinatura e limite."""
    texto = (imagem_data_url or "").strip()
    if not texto:
        raise ErroNegocio(400, "Envie uma imagem PNG, JPG ou WEBP para a estampa.")
    if "," in texto and texto.lower().startswith("data:"):
        _, b64 = texto.split(",", 1)
    else:
        b64 = texto
    b64 = b64.strip()
    if not b64:
        raise ErroNegocio(400, "Imagem inválida. Envie um arquivo PNG, JPG ou WEBP.")
    try:
        dados = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise ErroNegocio(400, "Imagem inválida. Envie um arquivo PNG, JPG ou WEBP.") from None
    if not dados:
        raise ErroNegocio(400, "Imagem vazia. Envie um arquivo PNG, JPG ou WEBP.")
    if len(dados) > LIMITE_BYTES_ESTAMPA:
        raise ErroNegocio(400, "A imagem excede o limite de 2 MB.")
    mime = _detectar_mime_real(dados)
    return dados, mime


def _resolver_codigo(db: Session, codigo_informado: Optional[str], id_atual: Optional[int] = None) -> str:
    limpo = " ".join((codigo_informado or "").split()).upper()
    if not limpo:
        return proximo_codigo(db, "EST")
    repetida = (
        db.query(CamisetaEstampa)
        .filter(func.upper(CamisetaEstampa.codigo) == limpo, CamisetaEstampa.id_estampa != id_atual)
        .first()
    )
    if repetida is not None:
        raise ErroNegocio(409, f"Já existe uma estampa com o código {repetida.codigo}.")
    return limpo


def _validar_nome(nome: str) -> tuple[str, str]:
    limpo = " ".join((nome or "").split())
    if not limpo:
        raise ErroNegocio(400, "Informe o nome da estampa.")
    return limpo, normalizar_nome(limpo)


def listar_estampas(
    db: Session,
    busca: Optional[str] = None,
    incluir_inativas: bool = False,
) -> list[CamisetaEstampa]:
    consulta = db.query(CamisetaEstampa)
    if not incluir_inativas:
        consulta = consulta.filter(CamisetaEstampa.ativo.is_(True))
    termo = normalizar_nome(busca)
    if termo:
        termo_like = f"%{termo}%"
        codigo_like = f"%{(busca or '').strip().upper()}%"
        consulta = consulta.filter(
            or_(
                CamisetaEstampa.nome_busca.like(termo_like),
                func.upper(CamisetaEstampa.codigo).like(codigo_like),
            )
        )
    return consulta.order_by(CamisetaEstampa.nome_busca.asc(), CamisetaEstampa.id_estampa.desc()).all()


def obter_estampa(db: Session, id_estampa: int) -> CamisetaEstampa:
    estampa = db.get(CamisetaEstampa, id_estampa)
    if estampa is None:
        raise ErroNegocio(404, "Estampa não encontrada.")
    return estampa


def criar_estampa(db: Session, dados: EstampaCreate) -> CamisetaEstampa:
    nome, nome_busca = _validar_nome(dados.nome)
    imagem_bytes, imagem_mime = decodificar_imagem_estampa(dados.imagem_data_url)
    codigo = _resolver_codigo(db, dados.codigo)
    estampa = CamisetaEstampa(
        codigo=codigo,
        nome=nome,
        nome_busca=nome_busca,
        observacoes=(dados.observacoes or "").strip() or None,
        imagem_bytes=imagem_bytes,
        imagem_mime=imagem_mime,
        tamanho_bytes=len(imagem_bytes),
        ativo=dados.ativo,
    )
    db.add(estampa)
    db.commit()
    db.refresh(estampa)
    return estampa


def atualizar_estampa(db: Session, id_estampa: int, dados: EstampaUpdate) -> CamisetaEstampa:
    estampa = obter_estampa(db, id_estampa)
    nome, nome_busca = _validar_nome(dados.nome)
    if dados.codigo and dados.codigo.strip():
        estampa.codigo = _resolver_codigo(db, dados.codigo, id_atual=estampa.id_estampa)
    estampa.nome = nome
    estampa.nome_busca = nome_busca
    estampa.observacoes = (dados.observacoes or "").strip() or None
    estampa.ativo = dados.ativo
    if dados.imagem_data_url and dados.imagem_data_url.strip():
        imagem_bytes, imagem_mime = decodificar_imagem_estampa(dados.imagem_data_url)
        estampa.imagem_bytes = imagem_bytes
        estampa.imagem_mime = imagem_mime
        estampa.tamanho_bytes = len(imagem_bytes)
    db.commit()
    db.refresh(estampa)
    return estampa


def excluir_estampa(db: Session, id_estampa: int) -> None:
    estampa = obter_estampa(db, id_estampa)
    db.delete(estampa)
    db.commit()
