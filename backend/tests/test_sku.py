import pytest

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaModelo
from app.models.camisetas_sku import CamisetaMovimentoEstoque
from app.services.camisetas.sku import (
    ENTRADA_PRODUCAO,
    SAIDA_ENTREGA,
    descrever_variacao,
    movimentar,
    obter_ou_criar_variacao,
    tamanhos_do_modelo,
)
from tests.fabricas import criar_cor, criar_grade, criar_modelo, criar_variacao, tamanho


def test_obter_ou_criar_variacao_cria_uma_vez_so(db):
    modelo = criar_modelo(db)
    preto = criar_cor(db)
    primeira = obter_ou_criar_variacao(db, modelo, preto.id_cor, tamanho(modelo, "M").id_tamanho)
    segunda = obter_ou_criar_variacao(db, modelo, preto.id_cor, tamanho(modelo, "M").id_tamanho)
    assert primeira.id_variacao == segunda.id_variacao
    assert primeira.saldo == 0


def test_tamanho_de_outra_grade_e_recusado(db):
    modelo = criar_modelo(db)
    infantil = criar_grade(db, nome="Infantil", rotulos=("2", "4"))
    preto = criar_cor(db)
    with pytest.raises(ErroNegocio) as erro:
        obter_ou_criar_variacao(db, modelo, preto.id_cor, infantil.tamanhos[0].id_tamanho)
    assert erro.value.status_code == 400
    assert "O tamanho 2 não faz parte da grade do modelo Camiseta Básica" in erro.value.mensagem


def test_cor_inexistente_retorna_404(db):
    modelo = criar_modelo(db)
    with pytest.raises(ErroNegocio) as erro:
        obter_ou_criar_variacao(db, modelo, 999, tamanho(modelo, "P").id_tamanho)
    assert erro.value.status_code == 404


def test_modelo_sem_grade_e_recusado(db):
    modelo = CamisetaModelo(nome_modelo="Sem grade", consumo_tecido_kg=1)
    db.add(modelo)
    db.commit()
    with pytest.raises(ErroNegocio) as erro:
        tamanhos_do_modelo(modelo)
    assert "não tem grade" in erro.value.mensagem


def test_movimentar_soma_e_grava_o_saldo_depois(db):
    modelo = criar_modelo(db)
    variacao = criar_variacao(db, modelo, criar_cor(db), "M", saldo=5)
    movimento = movimentar(db, variacao, 10, ENTRADA_PRODUCAO, motivo="Retorno da facção")
    db.commit()
    assert variacao.saldo == 15
    assert (movimento.tipo, movimento.quantidade, movimento.saldo_apos, movimento.motivo) == (
        "ENTRADA_PRODUCAO", 10, 15, "Retorno da facção")


def test_movimentar_nunca_deixa_saldo_negativo(db):
    modelo = criar_modelo(db)
    variacao = criar_variacao(db, modelo, criar_cor(db), "M", saldo=3)
    with pytest.raises(ErroNegocio) as erro:
        movimentar(db, variacao, -4, SAIDA_ENTREGA)
    assert erro.value.status_code == 400
    assert "Camiseta Básica · Preto · M" in erro.value.mensagem
    assert variacao.saldo == 3
    assert db.query(CamisetaMovimentoEstoque).count() == 0


def test_movimentar_recusa_tipo_desconhecido_e_quantidade_zero(db):
    modelo = criar_modelo(db)
    variacao = criar_variacao(db, modelo, criar_cor(db), "M")
    with pytest.raises(ValueError):
        movimentar(db, variacao, 1, "QUALQUER")
    with pytest.raises(ValueError):
        movimentar(db, variacao, 0, ENTRADA_PRODUCAO)


def test_descrever_variacao(db):
    modelo = criar_modelo(db)
    assert descrever_variacao(criar_variacao(db, modelo, criar_cor(db), "GG")) == "Camiseta Básica · Preto · GG"
