from app.core.erros import ErroNegocio


def test_erro_sem_dados_devolve_so_a_mensagem():
    assert ErroNegocio(400, "Dado inválido.").detalhe() == "Dado inválido."


def test_erro_com_dados_devolve_mensagem_e_dados():
    erro = ErroNegocio(409, "Falta estoque.", {"faltas": [{"sku": "X"}]})
    assert erro.detalhe() == {"mensagem": "Falta estoque.", "faltas": [{"sku": "X"}]}
