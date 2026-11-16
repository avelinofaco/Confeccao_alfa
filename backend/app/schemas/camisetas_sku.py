# app/schemas/camisetas_sku.py
"""Schemas de SKU, Produtos Prontos e itens por cor e tamanho (OP, remessa e pedido)."""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class TamanhoResponse(BaseModel):
    id_tamanho: int
    rotulo: str


class CelulaSku(BaseModel):
    id_tamanho: int
    rotulo: str
    id_variacao: Optional[int] = None  # nulo = ainda não há SKU (saldo zero)
    saldo: int = 0
    estoque_minimo: int = 0
    abaixo_minimo: bool = False


class LinhaProdutoPronto(BaseModel):
    id_modelo: int
    nome_modelo: str
    id_cor: int
    nome_cor: str
    hex_cor: str
    tamanhos: List[CelulaSku]
    total: int


class ContagemInventario(BaseModel):
    id_modelo: int
    id_cor: int
    id_tamanho: int
    quantidade_contada: int = Field(..., ge=0)


class InventarioEntrada(BaseModel):
    motivo: Optional[str] = Field(None, max_length=255)
    contagens: List[ContagemInventario] = Field(..., min_length=1)


class InventarioResultado(BaseModel):
    skus_alterados: int
    pecas_entrada: int
    pecas_saida: int


class AjusteEntrada(BaseModel):
    id_variacao: int
    quantidade: int
    motivo: str = Field(..., min_length=3, max_length=255)


class MinimoEntrada(BaseModel):
    estoque_minimo: int = Field(..., ge=0)


class VariacaoResponse(BaseModel):
    id_variacao: int
    id_modelo: int
    id_cor: int
    id_tamanho: int
    sku: str
    saldo: int
    estoque_minimo: int


class MovimentoResponse(BaseModel):
    id_movimento: int
    id_variacao: int
    sku: str
    tipo: str
    quantidade: int
    saldo_apos: int
    motivo: Optional[str] = None
    referencia: Optional[str] = None  # código do pedido ou da OP da remessa
    criado_em: Optional[datetime] = None
