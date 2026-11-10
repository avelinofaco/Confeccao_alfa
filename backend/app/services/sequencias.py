# app/services/sequencias.py
"""Numeração sequencial de documentos (pedidos, OPs) sem colisão."""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import FUSO_HORARIO
from app.models.sequencias import SequenciaDocumento


def proximo_codigo(db: Session, prefixo: str, agora: Optional[datetime] = None) -> str:
    """Reserva o próximo número do ano e devolve o código, ex.: PED-2026-0001.

    Usa SELECT ... FOR UPDATE (PostgreSQL) para que dois pedidos simultâneos não
    recebam o mesmo número. Não faz commit: o número só é gravado junto com o
    documento que o usa.
    """
    ano = (agora or datetime.now(FUSO_HORARIO)).year
    sequencia = (
        db.query(SequenciaDocumento)
        .filter_by(prefixo=prefixo, ano=ano)
        .with_for_update()
        .first()
    )
    if sequencia is None:
        sequencia = SequenciaDocumento(prefixo=prefixo, ano=ano, ultimo_numero=0)
        db.add(sequencia)
    sequencia.ultimo_numero = (sequencia.ultimo_numero or 0) + 1
    db.flush()
    return f"{prefixo}-{ano}-{sequencia.ultimo_numero:04d}"
