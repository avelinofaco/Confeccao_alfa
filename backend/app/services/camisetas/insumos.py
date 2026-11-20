# app/services/camisetas/insumos.py
"""Montagem da resposta e edição cadastral de insumos."""
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaInsumo, get_utc_now
from app.schemas.camisetas import CamisetaInsumoResponse, CamisetaInsumoUpdate
from app.services.camisetas.cores import validar_cor_opcional


def montar_resposta_insumo(insumo: CamisetaInsumo) -> CamisetaInsumoResponse:
    cor = insumo.cor_camiseta
    return CamisetaInsumoResponse(
        id_insumo=insumo.id_insumo,
        codigo=insumo.codigo,
        categoria=insumo.categoria,
        tipo_malha_ou_aviamento=insumo.tipo_malha_ou_aviamento,
        cor=insumo.cor,
        unidade_medida=insumo.unidade_medida,
        saldo_atual=insumo.saldo_atual,
        estoque_minimo=insumo.estoque_minimo,
        preco_custo_medio=insumo.preco_custo_medio,
        id_cor=insumo.id_cor,
        nome_cor=cor.nome if cor else None,
        hex_cor=cor.hex if cor else None,
        criado_em=insumo.criado_em,
        atualizado_em=insumo.atualizado_em,
    )


def excluir_insumo(db: Session, id_insumo: int) -> None:
    """Remove o insumo do estoque, bloqueando se houver vínculos ativos."""
    insumo = db.get(CamisetaInsumo, id_insumo)
    if insumo is None:
        raise ErroNegocio(404, "Insumo não encontrado.")

    from app.models.camisetas import CamisetaFichaTecnica, CamisetaEntradaInsumo, CamisetaOrdemProducao
    from app.models.camisetas_sku import CamisetaOpCor

    # Fichas técnicas com vínculo ativo (id_insumo não-nulo)
    ficha_vinculada = db.query(CamisetaFichaTecnica).filter(
        CamisetaFichaTecnica.id_insumo == id_insumo
    ).first()
    if ficha_vinculada:
        raise ErroNegocio(
            400,
            "Não é possível excluir este insumo pois ele está vinculado a fichas técnicas ou ordens de produção."
        )

    # Entradas de estoque: bloqueiam exclusão (ondelete=RESTRICT no banco)
    entrada_vinculada = db.query(CamisetaEntradaInsumo).filter(
        CamisetaEntradaInsumo.id_insumo == id_insumo
    ).first()
    if entrada_vinculada:
        raise ErroNegocio(
            400,
            "Não é possível excluir este insumo pois ele possui histórico de entradas no estoque."
        )

    db.delete(insumo)
    db.commit()


def atualizar_insumo(db: Session, id_insumo: int, dados: CamisetaInsumoUpdate) -> CamisetaInsumo:
    insumo = db.get(CamisetaInsumo, id_insumo)
    if insumo is None:
        raise ErroNegocio(404, "Insumo não encontrado.")
    validar_cor_opcional(db, dados.id_cor)
    insumo.tipo_malha_ou_aviamento = " ".join(dados.tipo_malha_ou_aviamento.split())
    insumo.cor = " ".join((dados.cor or "").split()) or None
    insumo.id_cor = dados.id_cor
    insumo.unidade_medida = dados.unidade_medida.lower()
    insumo.estoque_minimo = dados.estoque_minimo
    insumo.atualizado_em = get_utc_now()
    db.commit()
    db.refresh(insumo)
    return insumo
