import re
from datetime import date, datetime, timedelta

from app.core.config import FUSO_HORARIO
from app.services.sequencias import proximo_codigo
from tests.fabricas import criar_cor, criar_insumo, criar_modelo

EM_2026 = datetime(2026, 3, 1, 12, 0, tzinfo=FUSO_HORARIO)
EM_2027 = datetime(2027, 1, 2, 9, 0, tzinfo=FUSO_HORARIO)


def test_primeiro_codigo_do_ano(db):
    assert proximo_codigo(db, "PED", agora=EM_2026) == "PED-2026-0001"


def test_codigos_incrementam(db):
    proximo_codigo(db, "PED", agora=EM_2026)
    assert proximo_codigo(db, "PED", agora=EM_2026) == "PED-2026-0002"


def test_numeracao_reinicia_na_virada_do_ano(db):
    proximo_codigo(db, "PED", agora=EM_2026)
    assert proximo_codigo(db, "PED", agora=EM_2027) == "PED-2027-0001"


def test_prefixos_sao_independentes(db):
    proximo_codigo(db, "PED", agora=EM_2026)
    assert proximo_codigo(db, "OP", agora=EM_2026) == "OP-2026-0001"


def _payload_pedido(id_modelo, **extra):
    return {
        "nome_cliente": "Loja Beta",
        "id_modelo": id_modelo,
        "grade_p": 5, "grade_m": 5, "grade_g": 0, "grade_gg": 0,
        "prazo_entrega": (date.today() + timedelta(days=7)).isoformat(),
        "valor_total": "300.00",
        **extra,
    }


def test_api_gera_codigo_do_pedido(client, db):
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json=_payload_pedido(modelo.id_modelo))
    assert resposta.status_code == 201
    assert re.fullmatch(r"PED-\d{4}-0001", resposta.json()["codigo_pedido"])


def test_api_ignora_codigo_enviado_pelo_cliente(client, db):
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json=_payload_pedido(modelo.id_modelo, codigo_pedido="PED-123"))
    assert resposta.status_code == 201
    assert resposta.json()["codigo_pedido"] != "PED-123"


def test_api_gera_codigo_da_op(client, db):
    modelo = criar_modelo(db)
    preto = criar_cor(db)
    tecido = criar_insumo(db, saldo="50.000", cor=preto)
    resposta = client.post("/camisetas/ordens/", json={
        "id_modelo": modelo.id_modelo,
        "cores": [{"id_cor": preto.id_cor, "id_insumo_tecido": tecido.id_insumo, "peso_kg": "10.000"}],
    })
    assert resposta.status_code == 201
    assert re.fullmatch(r"OP-\d{4}-0001", resposta.json()["codigo_op"])
