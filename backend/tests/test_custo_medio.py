from decimal import Decimal

from app.services.camisetas.estoque import calcular_custo_medio
from tests.fabricas import criar_insumo


def D(valor):
    return Decimal(valor)


def test_sem_saldo_o_custo_e_o_da_nota():
    assert calcular_custo_medio(D("0"), D("40.00"), D("10"), D("450.00")) == D("45.00")


def test_com_saldo_faz_media_ponderada():
    # (100 × 40 + 2250) ÷ 150 = 41,666… → 41,67
    assert calcular_custo_medio(D("100"), D("40.00"), D("50"), D("2250.00")) == D("41.67")


def test_nota_sem_valor_nao_muda_o_custo():
    assert calcular_custo_medio(D("100"), D("40.00"), D("10"), D("0")) == D("40.00")


def test_saldo_negativo_e_tratado_como_zero():
    assert calcular_custo_medio(D("-5"), D("40.00"), D("10"), D("500.00")) == D("50.00")


def test_arredonda_meio_para_cima():
    # (3 × 10 + 31) ÷ 6 = 10,1666… → 10,17
    assert calcular_custo_medio(D("3"), D("10.00"), D("3"), D("31.00")) == D("10.17")


def test_api_entrada_atualiza_custo_e_saldo(client, db):
    insumo = criar_insumo(db, saldo="100.000", custo="40.00")
    resposta = client.post("/camisetas/insumos/entrada/", json={
        "id_insumo": insumo.id_insumo, "quantidade": "50", "valor_total": "2250.00",
    })
    assert resposta.status_code == 201
    db.refresh(insumo)
    assert insumo.preco_custo_medio == D("41.67")
    assert insumo.saldo_atual == D("150.000")


def test_api_entrada_com_valor_negativo_retorna_400(client, db):
    insumo = criar_insumo(db)
    resposta = client.post("/camisetas/insumos/entrada/", json={
        "id_insumo": insumo.id_insumo, "quantidade": "5", "valor_total": "-1",
    })
    assert resposta.status_code == 400
