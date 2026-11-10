from datetime import datetime
from decimal import Decimal

from app.core.config import FUSO_HORARIO
from tests.fabricas import criar_modelo, criar_pedido


def test_banco_vazio_nao_mostra_numeros_inventados(client):
    corpo = client.get("/camisetas/dashboard/").json()
    cards = corpo["cards"]
    assert cards["producao_total_acumulada"] == 0
    assert cards["tecido_maior_rendimento"] is None
    assert cards["rendimento_medio_tecido"] is None
    assert len(corpo["grafico_financeiro_12_meses"]) == 12
    assert all(Decimal(m["faturamento"]) == 0 for m in corpo["grafico_financeiro_12_meses"])


def test_grafico_usa_entregas_reais_do_mes(client, db):
    hoje = datetime.now(FUSO_HORARIO).date()
    modelo = criar_modelo(db)
    criar_pedido(db, modelo, valor="1200.00", status="Entregue", data_entrega_realizada=hoje)
    grafico = client.get("/camisetas/dashboard/").json()["grafico_financeiro_12_meses"]
    mes_atual = grafico[hoje.month - 1]
    assert mes_atual["mes_ano"] == hoje.strftime("%Y-%m")
    assert Decimal(mes_atual["faturamento"]) == Decimal("1200.00")
