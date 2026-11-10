from datetime import date, datetime, timedelta

from app.core.config import FUSO_HORARIO
from tests.fabricas import criar_estoque_acabado, criar_modelo, criar_pedido


def hoje():
    return datetime.now(FUSO_HORARIO).date()


def test_mudar_para_entregue_pelo_status_e_bloqueado(client, db):
    modelo = criar_modelo(db)
    pedido = criar_pedido(db, modelo)
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Entregue"})
    assert resposta.status_code == 400
    assert "Registrar entrega" in resposta.json()["detail"]


def test_status_invalido_retorna_400(client, db):
    modelo = criar_modelo(db)
    pedido = criar_pedido(db, modelo)
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Qualquer"})
    assert resposta.status_code == 400


def test_entregar_grava_data_e_baixa_estoque(client, db):
    modelo = criar_modelo(db)
    estoque = criar_estoque_acabado(db, modelo, grade=(20, 20, 20, 20))
    pedido = criar_pedido(db, modelo, grade=(10, 10, 10, 10))
    ontem = hoje() - timedelta(days=1)
    resposta = client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json={"data_entrega": ontem.isoformat()})
    assert resposta.status_code == 200
    assert resposta.json()["data_entrega_realizada"] == ontem.isoformat()
    db.refresh(estoque)
    assert estoque.quantidade_total == 40
    assert estoque.grade_p == 10


def test_entregar_sem_data_usa_hoje(client, db):
    modelo = criar_modelo(db)
    criar_estoque_acabado(db, modelo, grade=(10, 10, 10, 10))
    pedido = criar_pedido(db, modelo)
    resposta = client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json={})
    assert resposta.json()["data_entrega_realizada"] == hoje().isoformat()


def test_entregar_com_data_futura_retorna_400(client, db):
    modelo = criar_modelo(db)
    criar_estoque_acabado(db, modelo, grade=(10, 10, 10, 10))
    pedido = criar_pedido(db, modelo)
    amanha = hoje() + timedelta(days=1)
    resposta = client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json={"data_entrega": amanha.isoformat()})
    assert resposta.status_code == 400


def test_entregar_sem_estoque_suficiente_retorna_400(client, db):
    modelo = criar_modelo(db)
    criar_estoque_acabado(db, modelo, grade=(1, 1, 1, 1))
    pedido = criar_pedido(db, modelo, grade=(10, 10, 10, 10))
    resposta = client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json={})
    assert resposta.status_code == 400


def test_reverter_entrega_limpa_data_e_devolve_estoque(client, db):
    modelo = criar_modelo(db)
    estoque = criar_estoque_acabado(db, modelo, grade=(0, 0, 0, 0))
    pedido = criar_pedido(db, modelo, status="Entregue", grade=(5, 5, 5, 5), data_entrega_realizada=date(2026, 10, 5))
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Aguardando Produção"})
    assert resposta.status_code == 200
    assert resposta.json()["data_entrega_realizada"] is None
    db.refresh(estoque)
    assert estoque.quantidade_total == 20
    assert estoque.grade_gg == 5


def test_grade_negativa_e_recusada(client, db):
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json={
        "nome_cliente": "Loja", "id_modelo": modelo.id_modelo,
        "grade_p": -5, "grade_m": 10, "grade_g": 0, "grade_gg": 0,
        "prazo_entrega": (hoje() + timedelta(days=3)).isoformat(), "valor_total": "100",
    })
    assert resposta.status_code == 422
