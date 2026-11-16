from datetime import datetime, timedelta
from decimal import Decimal

from app.core.config import FUSO_HORARIO
from app.services.camisetas.precificacao import calcular_preco_unitario
from tests.fabricas import (
    criar_cliente,
    criar_cor,
    criar_estampa_teste,
    criar_modelo,
    tamanho,
)


def hoje():
    return datetime.now(FUSO_HORARIO).date()


def test_calculo_puro_de_preco_unitario():
    assert calcular_preco_unitario(Decimal("28.00"), Decimal("5.00"), tem_estampa=False, posicao_estampa=None) == Decimal("28.00")
    assert calcular_preco_unitario(Decimal("28.00"), Decimal("5.00"), tem_estampa=True, posicao_estampa="Frente") == Decimal("33.00")
    assert calcular_preco_unitario(Decimal("28.00"), Decimal("5.00"), tem_estampa=True, posicao_estampa="Frente e Costas") == Decimal("38.00")


def test_modelo_salva_e_edita_precos(client):
    resp_criar = client.post("/camisetas/modelos/", json={
        "nome_modelo": "Básica Premium",
        "consumo_tecido_kg": "0.180",
        "preco_venda_lisa": "30.00",
        "acrescimo_estampa": "6.50",
    })
    assert resp_criar.status_code == 200 or resp_criar.status_code == 201
    mod = resp_criar.json()
    assert Decimal(str(mod["preco_venda_lisa"])) == Decimal("30.00")
    assert Decimal(str(mod["acrescimo_estampa"])) == Decimal("6.50")

    resp_edit = client.put(f"/camisetas/modelos/{mod['id_modelo']}", json={
        "nome_modelo": "Básica Premium",
        "consumo_tecido_kg": "0.180",
        "preco_venda_lisa": "32.00",
        "acrescimo_estampa": "7.00",
    })
    assert resp_edit.status_code == 200
    assert Decimal(str(resp_edit.json()["preco_venda_lisa"])) == Decimal("32.00")
    assert Decimal(str(resp_edit.json()["acrescimo_estampa"])) == Decimal("7.00")


def test_pedido_calcula_preco_unitario_e_valor_total_automatico(client, db):
    modelo = criar_modelo(db)
    modelo.preco_venda_lisa = Decimal("25.00")
    modelo.acrescimo_estampa = Decimal("5.00")
    db.commit()

    preto = criar_cor(db, "Preto", "#1F1F1F")
    branco = criar_cor(db, "Branco", "#FFFFFF")
    est = criar_estampa_teste(db, nome="Leão", codigo="EST-1")
    cliente = criar_cliente(db, nome="Loja Alfa")

    # Item 1: 10 peças lisas -> 10 x 25 = 250.00
    # Item 2: 10 peças estampadas Frente e Costas -> 10 x (25 + 2*5) = 350.00
    # Total esperado = 600.00
    resp = client.post("/camisetas/pedidos/", json={
        "id_cliente": cliente.id_cliente,
        "prazo_entrega": hoje().isoformat(),
        "itens": [
            {
                "id_modelo": modelo.id_modelo,
                "id_cor": preto.id_cor,
                "quantidades": [{"id_tamanho": tamanho(modelo, "M").id_tamanho, "quantidade": 10}],
            },
            {
                "id_modelo": modelo.id_modelo,
                "id_cor": branco.id_cor,
                "id_estampa": est.id_estampa,
                "posicao_estampa": "Frente e Costas",
                "quantidades": [{"id_tamanho": tamanho(modelo, "G").id_tamanho, "quantidade": 10}],
            },
        ],
    })
    assert resp.status_code == 201
    corpo = resp.json()
    assert Decimal(str(corpo["valor_total"])) == Decimal("600.00")
    assert Decimal(str(corpo["itens"][0]["preco_unitario"])) == Decimal("25.00")
    assert Decimal(str(corpo["itens"][0]["subtotal"])) == Decimal("250.00")
    assert Decimal(str(corpo["itens"][1]["preco_unitario"])) == Decimal("35.00")
    assert Decimal(str(corpo["itens"][1]["subtotal"])) == Decimal("350.00")


def test_portal_do_cliente_calcula_valor_total_do_pedido(client_sem_login, db):
    modelo = criar_modelo(db)
    modelo.preco_venda_lisa = Decimal("30.00")
    modelo.acrescimo_estampa = Decimal("4.00")
    db.commit()

    preto = criar_cor(db, "Preto", "#1F1F1F")
    est = criar_estampa_teste(db, nome="Arte", codigo="EST-A")
    cliente = criar_cliente(db, nome="Cliente Celular")

    resp = client_sem_login.post(f"/portal/cliente/{cliente.token_portal}/pedidos", json={
        "prazo_entrega": (hoje() + timedelta(days=5)).isoformat(),
        "itens": [{
            "id_modelo": modelo.id_modelo,
            "id_cor": preto.id_cor,
            "id_estampa": est.id_estampa,
            "posicao_estampa": "Frente",
            "quantidades": [{"id_tamanho": tamanho(modelo, "P").id_tamanho, "quantidade": 5}],
        }],
    })
    assert resp.status_code == 201
    # 5 x (30 + 4) = 170.00
    assert Decimal(str(resp.json()["valor_total"])) == Decimal("170.00")
