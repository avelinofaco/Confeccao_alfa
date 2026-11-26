"""A nota fiscal de insumo tem de cair no mês da compra e com o valor que o usuário digitou.

Divergência que motivou estes testes: a coluna "Matéria-Prima (Notas)" do Registro
Financeiro mostrava valores que não correspondiam às entradas lançadas em Estoque e
Insumos, porque a data da nota não existia e o valor era opcional (virava zero calado).
"""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.core.config import FUSO_HORARIO
from app.services.camisetas.financeiro import apurar_mes
from tests.fabricas import criar_insumo


def _mes_corrente() -> str:
    agora = datetime.now(FUSO_HORARIO)
    return f"{agora.year}-{agora.month:02d}"


def _lancar(client, insumo, **campos):
    corpo = {
        "id_insumo": insumo.id_insumo,
        "quantidade": "10.000",
        "valor_total": "500.00",
        **campos,
    }
    return client.post("/camisetas/insumos/entrada/", json=corpo)


# ----------------- data da nota fiscal -----------------

def test_nota_entra_no_mes_informado_e_nao_no_mes_do_lancamento(client, db):
    # Arrange
    insumo = criar_insumo(db, saldo="0.000", custo="0.00")

    # Act: nota de uma compra de agosto, lançada hoje
    resposta = _lancar(client, insumo, valor_total="4500.00", data_entrada="2026-08-14")

    # Assert
    assert resposta.status_code == 201, resposta.text
    assert apurar_mes(db, "2026-08").gasto_materiais == Decimal("4500.00")
    assert apurar_mes(db, "2026-08").qtd_entradas == 1
    assert apurar_mes(db, _mes_corrente()).gasto_materiais == Decimal("0.00")


def test_nota_no_primeiro_dia_do_mes_nao_escorrega_para_o_mes_anterior(client, db):
    insumo = criar_insumo(db, saldo="0.000", custo="0.00")

    _lancar(client, insumo, valor_total="300.00", data_entrada="2026-09-01")

    assert apurar_mes(db, "2026-08").gasto_materiais == Decimal("0.00")
    assert apurar_mes(db, "2026-09").gasto_materiais == Decimal("300.00")


def test_nota_no_ultimo_dia_do_mes_nao_escorrega_para_o_mes_seguinte(client, db):
    insumo = criar_insumo(db, saldo="0.000", custo="0.00")

    _lancar(client, insumo, valor_total="300.00", data_entrada="2026-09-30")

    assert apurar_mes(db, "2026-09").gasto_materiais == Decimal("300.00")
    assert apurar_mes(db, "2026-10").gasto_materiais == Decimal("0.00")


def test_nota_sem_data_usa_o_momento_do_lancamento(client, db):
    insumo = criar_insumo(db, saldo="0.000", custo="0.00")

    resposta = _lancar(client, insumo, valor_total="120.00")

    assert resposta.status_code == 201, resposta.text
    assert apurar_mes(db, _mes_corrente()).gasto_materiais == Decimal("120.00")


def test_nota_com_data_futura_e_recusada(client, db):
    insumo = criar_insumo(db, saldo="0.000", custo="0.00")
    amanha = (datetime.now(FUSO_HORARIO).date() + timedelta(days=1)).isoformat()

    resposta = _lancar(client, insumo, data_entrada=amanha)

    assert resposta.status_code == 400
    assert "futura" in resposta.json()["detail"].lower()


def test_data_da_nota_volta_na_resposta(client, db):
    insumo = criar_insumo(db, saldo="0.000", custo="0.00")

    corpo = _lancar(client, insumo, data_entrada="2026-07-09").json()

    gravado = datetime.fromisoformat(corpo["data_entrada"])
    if gravado.tzinfo is None:
        gravado = gravado.replace(tzinfo=timezone.utc)
    assert gravado.astimezone(FUSO_HORARIO).date() == date(2026, 7, 9)


# ----------------- valor da nota fiscal -----------------

def test_valor_da_nota_e_obrigatorio(client, db):
    """Omitir o valor virava R$ 0,00 calado: a nota aparecia no estoque e não no financeiro."""
    insumo = criar_insumo(db, saldo="0.000", custo="0.00")

    resposta = client.post("/camisetas/insumos/entrada/", json={
        "id_insumo": insumo.id_insumo,
        "quantidade": "10.000",
    })

    assert resposta.status_code == 422


def test_valor_zero_explicito_e_aceito_para_bonificacao(client, db):
    """Bonificação e ajuste continuam valendo: sobe o saldo e não mexe no custo médio."""
    insumo = criar_insumo(db, saldo="100.000", custo="40.00")

    resposta = _lancar(client, insumo, quantidade="50.000", valor_total="0")

    assert resposta.status_code == 201, resposta.text
    db.refresh(insumo)
    assert insumo.saldo_atual == Decimal("150.000")
    assert insumo.preco_custo_medio == Decimal("40.00")


def test_valor_lancado_chega_inteiro_no_financeiro(client, db):
    """O que o usuário digita em Estoque é exatamente o que a coluna de notas soma."""
    insumo = criar_insumo(db, saldo="0.000", custo="0.00")

    _lancar(client, insumo, quantidade="100.000", valor_total="4500.00", data_entrada="2026-10-05")
    _lancar(client, insumo, quantidade="50.000", valor_total="400.00", data_entrada="2026-10-20")

    apuracao = apurar_mes(db, "2026-10")
    assert apuracao.gasto_materiais == Decimal("4900.00")
    assert apuracao.qtd_entradas == 2
