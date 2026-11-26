"""Cadastro da embalagem fechada do fornecedor no insumo.

A embalagem é opcional e vale só para aviamento: rolo de malha não tem peso fixo na vida
real, então fixá-lo criaria uma sugestão falsamente precisa.
"""
from decimal import Decimal

from tests.fabricas import criar_insumo


def _criar_via_api(client, **campos):
    corpo = {
        "codigo": "AV-ETQ-99",
        "categoria": "AVIAMENTO",
        "tipo_malha_ou_aviamento": "Etiqueta de composição",
        "unidade_medida": "unidades",
        "saldo_atual": "0.000",
        "estoque_minimo": "0.000",
        "preco_custo_medio": "0.10",
        **campos,
    }
    return client.post("/camisetas/insumos/", json=corpo)


def test_cadastro_aceita_a_embalagem_de_compra(client, db):
    resposta = _criar_via_api(client, embalagem_compra="1000.000")

    assert resposta.status_code == 201, resposta.text
    assert Decimal(resposta.json()["embalagem_compra"]) == Decimal("1000.000")


def test_embalagem_e_opcional(client, db):
    resposta = _criar_via_api(client)

    assert resposta.status_code == 201, resposta.text
    assert resposta.json()["embalagem_compra"] is None


def test_embalagem_negativa_e_recusada(client, db):
    assert _criar_via_api(client, embalagem_compra="-1").status_code == 422


def test_edicao_grava_a_embalagem(client, db):
    insumo = criar_insumo(db, codigo="AV-LINHA", categoria="AVIAMENTO", nome="Linha 120",
                          unidade="unidades", saldo="0.000", minimo="0.000")

    resposta = client.put(f"/camisetas/insumos/{insumo.id_insumo}", json={
        "tipo_malha_ou_aviamento": "Linha 120 poliéster",
        "unidade_medida": "unidades",
        "estoque_minimo": "5.000",
        "embalagem_compra": "12.000",
    })

    assert resposta.status_code == 200, resposta.text
    assert Decimal(resposta.json()["embalagem_compra"]) == Decimal("12.000")


def test_edicao_sem_o_campo_limpa_a_embalagem(client, db):
    """O formulário sempre envia o campo; omitir significa 'sem embalagem fechada'."""
    insumo = criar_insumo(db, codigo="AV-LINHA", categoria="AVIAMENTO", nome="Linha 120",
                          unidade="unidades", saldo="0.000", minimo="0.000")
    insumo.embalagem_compra = Decimal("12.000")
    db.commit()

    resposta = client.put(f"/camisetas/insumos/{insumo.id_insumo}", json={
        "tipo_malha_ou_aviamento": "Linha 120 poliéster",
        "unidade_medida": "unidades",
        "estoque_minimo": "5.000",
    })

    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["embalagem_compra"] is None


def test_listagem_mostra_a_embalagem(client, db):
    insumo = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta",
                          unidade="unidades", saldo="0.000", minimo="0.000")
    insumo.embalagem_compra = Decimal("1000.000")
    db.commit()

    linhas = client.get("/camisetas/insumos/", params={"categoria": "AVIAMENTO"}).json()

    assert Decimal(linhas[0]["embalagem_compra"]) == Decimal("1000.000")
