"""Testes da Fase 7: Despesas operacionais categorizadas, Contas a Pagar/Receber e DRE mensal."""
from datetime import date, datetime
from decimal import Decimal

from app.core.config import FUSO_HORARIO
from tests.fabricas import (
    criar_entrada,
    criar_insumo,
    criar_modelo,
    criar_pedido,
    criar_registro_financeiro,
)


def test_criar_listar_quitar_e_excluir_despesas(client, db):
    r1 = client.post(
        "/camisetas/financeiro/despesas/",
        json={
            "mes_ano": "2026-10",
            "categoria": "FACCAO",
            "descricao": "Facção Dona Maria - OP-101",
            "valor": "1200.00",
            "status_pagamento": "Pendente",
            "data_vencimento": "2026-10-20",
        },
    )
    assert r1.status_code == 201
    d1 = r1.json()
    assert d1["categoria"] == "FACCAO"
    assert d1["status_pagamento"] == "Pendente"
    assert d1["data_pagamento"] is None
    assert Decimal(d1["valor"]) == Decimal("1200.00")

    r2 = client.post(
        "/camisetas/financeiro/despesas/",
        json={
            "mes_ano": "2026-10",
            "categoria": "ENERGIA_AGUA",
            "descricao": "Conta de energia outubro",
            "valor": "450.50",
            "status_pagamento": "Pago",
        },
    )
    assert r2.status_code == 201
    d2 = r2.json()
    assert d2["status_pagamento"] == "Pago"
    assert d2["data_pagamento"] is not None

    lista = client.get("/camisetas/financeiro/despesas/?mes_ano=2026-10").json()
    assert len(lista) == 2

    # Quitar a despesa pendente
    r_quitar = client.put(
        f"/camisetas/financeiro/despesas/{d1['id_despesa']}/pagar",
        json={"data_pagamento": "2026-10-18"},
    )
    assert r_quitar.status_code == 200
    assert r_quitar.json()["status_pagamento"] == "Pago"
    assert r_quitar.json()["data_pagamento"] == "2026-10-18"

    # Excluir a segunda despesa
    r_del = client.delete(f"/camisetas/financeiro/despesas/{d2['id_despesa']}")
    assert r_del.status_code == 204
    lista_apos = client.get("/camisetas/financeiro/despesas/?mes_ano=2026-10").json()
    assert len(lista_apos) == 1


def test_validacoes_de_despesa(client):
    assert (
        client.post(
            "/camisetas/financeiro/despesas/",
            json={"mes_ano": "2026-13", "categoria": "FACCAO", "descricao": "X", "valor": "10.00"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/camisetas/financeiro/despesas/",
            json={"mes_ano": "2026-10", "categoria": "INVALIDA", "descricao": "X", "valor": "10.00"},
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/camisetas/financeiro/despesas/",
            json={"mes_ano": "2026-10", "categoria": "FACCAO", "descricao": "   ", "valor": "10.00"},
        ).status_code
        == 400
    )
    assert client.put("/camisetas/financeiro/despesas/99999/pagar", json={}).status_code == 404
    assert client.delete("/camisetas/financeiro/despesas/99999").status_code == 404


def test_pagamento_de_pedido_e_dre_mensal_completo(client, db):
    modelo = criar_modelo(db)
    insumo = criar_insumo(db)

    p_pago = criar_pedido(
        db,
        modelo,
        codigo="PED-101",
        valor="3000.00",
        status="Entregue",
        data_entrega_realizada=date(2026, 10, 10),
    )
    p_pendente = criar_pedido(
        db,
        modelo,
        codigo="PED-102",
        valor="2000.00",
        status="Entregue",
        data_entrega_realizada=date(2026, 10, 15),
    )

    # Marcar PED-101 como Pago
    r_pag = client.put(
        f"/camisetas/financeiro/pedidos/{p_pago.id_pedido}/pagamento",
        json={"status_pagamento": "Pago", "data_pagamento": "2026-10-12"},
    )
    assert r_pag.status_code == 200
    assert r_pag.json()["status_pagamento"] == "Pago"
    assert r_pag.json()["data_pagamento"] == "2026-10-12"

    # Entrada de NF no mês: R$ 1.500,00
    criar_entrada(db, insumo, valor="1500.00", data=datetime(2026, 10, 5, 14, 0, tzinfo=FUSO_HORARIO))

    # Despesas categorizadas: R$ 800,00 (Pago) + R$ 400,00 (Pendente)
    client.post(
        "/camisetas/financeiro/despesas/",
        json={
            "mes_ano": "2026-10",
            "categoria": "FACCAO",
            "descricao": "Costura lote 1",
            "valor": "800.00",
            "status_pagamento": "Pago",
        },
    )
    client.post(
        "/camisetas/financeiro/despesas/",
        json={
            "mes_ano": "2026-10",
            "categoria": "ALUGUEL",
            "descricao": "Aluguel galpão",
            "valor": "400.00",
            "status_pagamento": "Pendente",
        },
    )
    # Outros custos avulsos legados: R$ 100,00
    criar_registro_financeiro(db, "2026-10", outros="100.00")

    dre = client.get("/camisetas/financeiro/dre/?mes_ano=2026-10").json()
    assert Decimal(dre["faturamento_entregas"]) == Decimal("5000.00")
    assert Decimal(dre["receita_recebida"]) == Decimal("3000.00")
    assert Decimal(dre["receita_a_receber"]) == Decimal("2000.00")
    assert Decimal(dre["gasto_materiais"]) == Decimal("1500.00")
    assert Decimal(dre["margem_bruta"]) == Decimal("3500.00")
    assert Decimal(dre["total_despesas_lancadas"]) == Decimal("1200.00")
    assert Decimal(dre["despesas_pagas"]) == Decimal("800.00")
    assert Decimal(dre["despesas_pendentes"]) == Decimal("400.00")
    assert Decimal(dre["outros_custos_avulsos"]) == Decimal("100.00")
    assert Decimal(dre["total_despesas_operacionais"]) == Decimal("1300.00")
    assert Decimal(dre["lucro_liquido"]) == Decimal("2200.00")
    assert Decimal(dre["despesas_por_categoria"]["FACCAO"]) == Decimal("800.00")
    assert Decimal(dre["despesas_por_categoria"]["ALUGUEL"]) == Decimal("400.00")
    assert len(dre["despesas"]) == 2
    assert len(dre["pedidos_do_mes"]) == 2
    assert {p["codigo_pedido"]: p["status_pagamento"] for p in dre["pedidos_do_mes"]} == {
        "PED-101": "Pago",
        "PED-102": "Pendente",
    }

    # E na listagem anual o mês 2026-10 também reflete o lucro_liquido de 2200.00
    meses = client.get("/camisetas/financeiro/?ano=2026").json()
    outubro = next(m for m in meses if m["mes_ano"] == "2026-10")
    assert Decimal(outubro["outros_custos_avulsos"]) == Decimal("100.00")
    assert Decimal(outubro["total_despesas_operacionais"]) == Decimal("1300.00")
    assert Decimal(outubro["lucro_liquido"]) == Decimal("2200.00")
    assert Decimal(outubro["receita_recebida"]) == Decimal("3000.00")
    assert Decimal(outubro["receita_a_receber"]) == Decimal("2000.00")
    assert Decimal(outubro["despesas_pendentes"]) == Decimal("400.00")
