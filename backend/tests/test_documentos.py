import pytest

from app.core.erros import ErroNegocio
from app.services.documentos import cnpj_valido, cpf_valido, normalizar_documento, normalizar_nome


def test_cpf_valido_com_mascara():
    assert normalizar_documento("529.982.247-25") == ("52998224725", "PF")


def test_cnpj_valido_com_mascara():
    assert normalizar_documento("11.222.333/0001-81") == ("11222333000181", "PJ")


@pytest.mark.parametrize("digitos", ["52998224724", "11111111111", "123"])
def test_cpf_invalido(digitos):
    assert cpf_valido(digitos) is False


@pytest.mark.parametrize("digitos", ["11222333000182", "00000000000000"])
def test_cnpj_invalido(digitos):
    assert cnpj_valido(digitos) is False


@pytest.mark.parametrize("valor, mensagem", [
    ("529.982.247-24", "CPF inválido"),
    ("11.222.333/0001-82", "CNPJ inválido"),
    ("12345", "11 dígitos"),
])
def test_documento_invalido_levanta_erro_400(valor, mensagem):
    with pytest.raises(ErroNegocio) as erro:
        normalizar_documento(valor)
    assert erro.value.status_code == 400
    assert mensagem in erro.value.mensagem


@pytest.mark.parametrize("vazio", [None, "", "  ", "--"])
def test_documento_vazio_vira_none(vazio):
    assert normalizar_documento(vazio) == (None, None)


def test_normalizar_nome_tira_acento_espaco_e_maiuscula():
    assert normalizar_nome("  Ateliê   SOL ") == "atelie sol"
