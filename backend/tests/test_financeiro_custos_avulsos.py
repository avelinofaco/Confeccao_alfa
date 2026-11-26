"""O custo avulso do mês não pode ser apagado por um salvamento de observação.

E o nome do campo tem de dizer uma coisa só: `outros_custos_avulsos` é o que o usuário
digita; `total_despesas_operacionais` é esse avulso somado às despesas categorizadas.
"""
from datetime import date
from decimal import Decimal

from tests.fabricas import criar_modelo, criar_pedido


def _lancar_despesa(client, mes="2026-10", valor="350.00", categoria="FACCAO"):
    return client.post("/camisetas/financeiro/despesas/", json={
        "mes_ano": mes,
        "categoria": categoria,
        "descricao": "Facção Dona Maria lote 12",
        "valor": valor,
        "status_pagamento": "Pago",
    })


def _mes_na_listagem(client, mes="2026-10", ano=2026):
    meses = client.get(f"/camisetas/financeiro/?ano={ano}").json()
    return next(m for m in meses if m["mes_ano"] == mes)


def test_salvar_so_a_observacao_preserva_o_custo_avulso(client, db):
    # Arrange: usuário lança R$ 500 de custo avulso
    primeira = client.post("/camisetas/financeiro/", json={
        "mes_ano": "2026-10",
        "outros_custos_avulsos": "500.00",
        "observacoes": "Pró-labore do mês",
    })
    assert primeira.status_code == 201, primeira.text
    assert Decimal(primeira.json()["outros_custos_avulsos"]) == Decimal("500.00")

    # Act: depois salva só a observação, sem mandar o avulso
    segunda = client.post("/camisetas/financeiro/", json={
        "mes_ano": "2026-10",
        "observacoes": "Fechamento conferido com a contabilidade",
    })

    # Assert: os R$ 500 continuam lá
    assert segunda.status_code == 201, segunda.text
    corpo = segunda.json()
    assert Decimal(corpo["outros_custos_avulsos"]) == Decimal("500.00")
    assert corpo["observacoes"] == "Fechamento conferido com a contabilidade"


def test_zero_explicito_zera_o_custo_avulso(client, db):
    client.post("/camisetas/financeiro/", json={
        "mes_ano": "2026-10", "outros_custos_avulsos": "500.00",
    })

    resposta = client.post("/camisetas/financeiro/", json={
        "mes_ano": "2026-10", "outros_custos_avulsos": "0",
    })

    assert Decimal(resposta.json()["outros_custos_avulsos"]) == Decimal("0.00")


def test_listagem_anual_separa_avulso_do_total_de_despesas(client, db):
    # Arrange
    client.post("/camisetas/financeiro/", json={
        "mes_ano": "2026-10", "outros_custos_avulsos": "500.00",
    })
    _lancar_despesa(client, valor="350.00")

    # Act
    outubro = _mes_na_listagem(client)

    # Assert: dois nomes, dois significados
    assert Decimal(outubro["outros_custos_avulsos"]) == Decimal("500.00")
    assert Decimal(outubro["total_despesas_operacionais"]) == Decimal("850.00")


def test_lucro_desconta_avulso_e_despesas_uma_vez_so(client, db):
    modelo = criar_modelo(db)
    criar_pedido(
        db, modelo, valor="2000.00", status="Entregue",
        data_entrega_realizada=date(2026, 10, 7),
    )
    client.post("/camisetas/financeiro/", json={
        "mes_ano": "2026-10", "outros_custos_avulsos": "500.00",
    })
    _lancar_despesa(client, valor="350.00")

    outubro = _mes_na_listagem(client)

    assert Decimal(outubro["faturamento_receita"]) == Decimal("2000.00")
    assert Decimal(outubro["lucro_liquido"]) == Decimal("1150.00")


def test_custo_avulso_negativo_retorna_400(client, db):
    resposta = client.post("/camisetas/financeiro/", json={
        "mes_ano": "2026-10", "outros_custos_avulsos": "-1",
    })

    assert resposta.status_code == 400
