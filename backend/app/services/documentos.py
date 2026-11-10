# app/services/documentos.py
"""Validação de CPF/CNPJ (dígitos verificadores) e normalização de textos para busca."""
import re
import unicodedata
from typing import Optional

from app.core.erros import ErroNegocio

PESOS_CNPJ = (5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)


def somente_digitos(valor: Optional[str]) -> str:
    return re.sub(r"\D", "", valor or "")


def _digito_verificador(digitos: str, pesos) -> int:
    resto = sum(int(d) * p for d, p in zip(digitos, pesos)) % 11
    return 0 if resto < 2 else 11 - resto


def cpf_valido(digitos: str) -> bool:
    if len(digitos) != 11 or len(set(digitos)) == 1:
        return False
    d1 = _digito_verificador(digitos[:9], range(10, 1, -1))
    d2 = _digito_verificador(digitos[:9] + str(d1), range(11, 1, -1))
    return digitos[-2:] == f"{d1}{d2}"


def cnpj_valido(digitos: str) -> bool:
    if len(digitos) != 14 or len(set(digitos)) == 1:
        return False
    d1 = _digito_verificador(digitos[:12], PESOS_CNPJ)
    d2 = _digito_verificador(digitos[:12] + str(d1), (6,) + PESOS_CNPJ)
    return digitos[-2:] == f"{d1}{d2}"


def normalizar_documento(valor: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """Devolve (só dígitos, 'PF'|'PJ'), ou (None, None) se vazio. Documento inválido → ErroNegocio(400)."""
    digitos = somente_digitos(valor)
    if not digitos:
        return None, None
    if len(digitos) == 11:
        if not cpf_valido(digitos):
            raise ErroNegocio(400, "CPF inválido. Confira os números digitados.")
        return digitos, "PF"
    if len(digitos) == 14:
        if not cnpj_valido(digitos):
            raise ErroNegocio(400, "CNPJ inválido. Confira os números digitados.")
        return digitos, "PJ"
    raise ErroNegocio(400, "O documento deve ter 11 dígitos (CPF) ou 14 dígitos (CNPJ).")


def normalizar_nome(texto: Optional[str]) -> str:
    """Nome para busca e comparação: sem acentos, minúsculo e com espaços simples."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto or "") if not unicodedata.combining(c))
    return " ".join(sem_acento.split()).casefold()
