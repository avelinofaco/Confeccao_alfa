# app/routers/camisetas/costura.py
"""Costura terceirizada: remessas para facções (segmento Camisetas)."""
from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.camisetas import CamisetaCosturaFaccao
from app.schemas.camisetas import (
    CamisetaCosturaFaccaoEnviar,
    CamisetaCosturaFaccaoResponse,
    CamisetaCosturaFaccaoRetornar,
)
from app.services.camisetas.costura import (
    enviar_remessa,
    excluir_remessa,
    montar_resposta_remessa,
    registrar_retorno,
)

router = APIRouter()


@router.get("/costura/", response_model=List[CamisetaCosturaFaccaoResponse])
def listar_remessas_costura(db: Session = Depends(get_db)):
    remessas = db.query(CamisetaCosturaFaccao).order_by(CamisetaCosturaFaccao.id_costura.desc()).all()
    return [montar_resposta_remessa(r) for r in remessas]


@router.post("/costura/enviar", response_model=CamisetaCosturaFaccaoResponse, status_code=status.HTTP_201_CREATED)
def enviar_para_faccao(envio_in: CamisetaCosturaFaccaoEnviar, db: Session = Depends(get_db)):
    """Envia peças cortadas (por cor e tamanho) para a facção e baixa os aviamentos da ficha técnica."""
    remessa, avisos = enviar_remessa(db, envio_in)
    return montar_resposta_remessa(remessa, avisos)


@router.put("/costura/{id_costura}/retornar", response_model=CamisetaCosturaFaccaoResponse)
def registrar_retorno_faccao(id_costura: int, retorno_in: CamisetaCosturaFaccaoRetornar, db: Session = Depends(get_db)):
    """Registra o retorno por cor e tamanho, apura perdas e lança as peças no estoque de Produtos Prontos."""
    return montar_resposta_remessa(registrar_retorno(db, id_costura, retorno_in))


@router.delete("/costura/{id_costura}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_remessa_costura(id_costura: int, db: Session = Depends(get_db)):
    """Exclui uma remessa em costura externa e estorna os aviamentos baixados de volta ao estoque."""
    excluir_remessa(db, id_costura)

