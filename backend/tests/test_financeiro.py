from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from app.core.config import FUSO_HORARIO
from app.services.camisetas.financeiro import MesAnoInvalido, apurar_ano, apurar_mes
from tests.fabricas import (
    criar_entrada,
    criar_insumo,
    criar_modelo,
    criar_pedido,
    criar_registro_financeiro,
)


def test_faturamento_soma_pedidos_entregues_no_mes(db):
    modelo = criar_modelo(db)
    criar_pedido(db, modelo, codigo="A", valor="1000.00", status="Entregue", data_entrega_realizada=date(2026, 10, 3))
    criar_pedido(db, modelo, codigo="B", valor="500.00", status="Entregue", data_entrega_realizada=date(2026, 10, 30))
    criar_pedido(db, modelo, codigo="C", valor="999.00")  # não entregue
    apuracao = apurar_mes(db, "2026-10")
    assert apuracao.faturamento == Decimal("1500.00")
    assert apuracao.qtd_pedidos_entregues == 2


def test_pedido_conta_no_mes_da_entrega_e_nao_no_da_criacao(db):
    modelo = criar_modelo(db)
    criar_pedido(
        db, modelo, valor="800.00", status="Entregue",
        criado_em=datetime(2026, 10, 10, tzinfo=timezone.utc),
        data_entrega_realizada=date(2026, 11, 4),
    )
    assert apurar_mes(db, "2026-10").faturamento == Decimal("0.00")
    assert apurar_mes(db, "2026-11").faturamento == Decimal("800.00")


def test_gasto_soma_notas_do_mes_e_nao_o_valor_do_estoque(db):
    insumo = criar_insumo(db, saldo="100.000", custo="40.00")  # R$ 4.000 em estoque: não é gasto
    criar_entrada(db, insumo, valor="500.00", data=datetime(2026, 10, 15, 10, 0, tzinfo=FUSO_HORARIO))
    apuracao = apurar_mes(db, "2026-10")
    assert apuracao.gasto_materiais == Decimal("500.00")
    assert apuracao.qtd_entradas == 1


def test_nota_as_23h_do_ultimo_dia_fica_no_mes_certo(db):
    insumo = criar_insumo(db)
    # 31/10 23h em Fortaleza = 01/11 02h em UTC
    criar_entrada(db, insumo, valor="200.00", data=datetime(2026, 10, 31, 23, 0, tzinfo=FUSO_HORARIO))
    assert apurar_mes(db, "2026-10").gasto_materiais == Decimal("200.00")
    assert apurar_mes(db, "2026-11").gasto_materiais == Decimal("0.00")


def test_lucro_desconta_outros_custos(db):
    modelo = criar_modelo(db)
    insumo = criar_insumo(db)
    criar_pedido(db, modelo, valor="1000.00", status="Entregue", data_entrega_realizada=date(2026, 10, 3))
    criar_entrada(db, insumo, valor="300.00", data=datetime(2026, 10, 5, 9, 0, tzinfo=FUSO_HORARIO))
    criar_registro_financeiro(db, "2026-10", outros="150.00")
    apuracao = apurar_mes(db, "2026-10")
    assert apuracao.lucro == Decimal("550.00")
    assert apuracao.tem_dados_reais is True


def test_mes_sem_movimento_retorna_zeros(db):
    apuracao = apurar_mes(db, "2026-03")
    assert (apuracao.faturamento, apuracao.gasto_materiais, apuracao.lucro) == (Decimal("0.00"),) * 3
    assert apuracao.tem_dados_reais is False
    assert apuracao.mes_nome == "Março"


@pytest.mark.parametrize("valor", ["2026-13", "2026-1", "10/2026", "", "abc"])
def test_mes_ano_invalido_levanta_erro(db, valor):
    with pytest.raises(MesAnoInvalido):
        apurar_mes(db, valor)


def test_apurar_ano_devolve_12_meses_em_ordem(db):
    meses = apurar_ano(db, 2026)
    assert [m.mes_ano for m in meses] == [f"2026-{n:02d}" for n in range(1, 13)]


def test_api_mes_ano_invalido_retorna_422(client):
    assert client.get("/camisetas/financeiro/apuracao-mensal/?mes_ano=2026-13").status_code == 422


def test_api_lista_12_meses_calculados(client, db):
    modelo = criar_modelo(db)
    criar_pedido(db, modelo, valor="700.00", status="Entregue", data_entrega_realizada=date(2026, 2, 10))
    resposta = client.get("/camisetas/financeiro/?ano=2026")
    assert resposta.status_code == 200
    meses = resposta.json()
    assert len(meses) == 12
    fevereiro = meses[1]
    assert fevereiro["mes_ano"] == "2026-02"
    assert Decimal(fevereiro["faturamento_receita"]) == Decimal("700.00")
    assert fevereiro["qtd_pedidos_entregues"] == 1


def test_api_lanca_outros_custos_e_ignora_faturamento_enviado(client, db):
    resposta = client.post("/camisetas/financeiro/", json={
        "mes_ano": "2026-10",
        "outros_custos_avulsos": "250.00",
        "faturamento_receita": "99999.00",
        "observacoes": "Energia e facção",
    })
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert Decimal(corpo["faturamento_receita"]) == Decimal("0.00")
    assert Decimal(corpo["outros_custos_avulsos"]) == Decimal("250.00")
    assert Decimal(corpo["total_despesas_operacionais"]) == Decimal("250.00")
    assert Decimal(corpo["lucro_liquido"]) == Decimal("-250.00")


def test_api_outros_custos_negativo_retorna_400(client):
    resposta = client.post("/camisetas/financeiro/", json={"mes_ano": "2026-10", "outros_custos_avulsos": "-1"})
    assert resposta.status_code == 400


def test_api_sincronizar_nao_existe_mais(client):
    assert client.post("/camisetas/financeiro/sincronizar-automatico/").status_code == 404
