from datetime import datetime

from app.core.config import FUSO_HORARIO
from app.models.camisetas_sku import CamisetaPedidoItem
from tests.fabricas import (
    criar_cliente,
    criar_cor,
    criar_estampa_teste,
    criar_grade,
    criar_modelo,
    criar_modelo_com_grade,
    criar_pedido,
    tamanho,
)

URL = "/camisetas/pedidos/"


def hoje():
    return datetime.now(FUSO_HORARIO).date()


def _item(modelo, cor, **quantidades):
    return {"id_modelo": modelo.id_modelo, "id_cor": cor.id_cor if cor else None,
            "quantidades": [{"id_tamanho": tamanho(modelo, r).id_tamanho, "quantidade": q} for r, q in quantidades.items()]}


def _pedido(cliente, itens):
    return {"id_cliente": cliente.id_cliente, "itens": itens, "prazo_entrega": hoje().isoformat(), "valor_total": "1500.00"}


def _antigo(cliente, modelo, **grade):
    return {"id_cliente": cliente.id_cliente, "id_modelo": modelo.id_modelo, **grade,
            "prazo_entrega": hoje().isoformat(), "valor_total": "100"}


def _cenario(db):
    return criar_modelo(db), criar_cor(db), criar_cor(db, "Branco", "#FFFFFF"), criar_cliente(db)


def test_pedido_com_dois_itens(client, db):
    modelo, preto, branco, cliente = _cenario(db)
    resposta = client.post(URL, json=_pedido(cliente, [_item(modelo, preto, P=10, M=20), _item(modelo, branco, G=5)]))
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert (corpo["quantidade_total"], corpo["id_modelo"], corpo["grade_p"]) == (35, modelo.id_modelo, 0)
    assert [(i["nome_cor"], i["total"]) for i in corpo["itens"]] == [("Preto", 30), ("Branco", 5)]
    assert [(q["rotulo"], q["quantidade"]) for q in corpo["itens"][0]["quantidades"]] == [("P", 10), ("M", 20)]


def test_item_repetido_retorna_400(client, db):
    modelo, preto, _, cliente = _cenario(db)
    resposta = client.post(URL, json=_pedido(cliente, [_item(modelo, preto, P=1), _item(modelo, preto, M=1)]))
    assert resposta.status_code == 400
    assert "repete modelo e cor" in resposta.json()["detail"]


def test_item_sem_cor_retorna_400(client, db):
    modelo, _, _, cliente = _cenario(db)
    resposta = client.post(URL, json=_pedido(cliente, [_item(modelo, None, P=1)]))
    assert resposta.status_code == 400
    assert "Escolha a cor do item 1" in resposta.json()["detail"]


def test_tamanho_fora_da_grade_retorna_400(client, db):
    modelo, preto, _, cliente = _cenario(db)
    infantil = criar_grade(db, nome="Infantil", rotulos=("2",))
    item = {"id_modelo": modelo.id_modelo, "id_cor": preto.id_cor,
            "quantidades": [{"id_tamanho": infantil.tamanhos[0].id_tamanho, "quantidade": 3}]}
    assert client.post(URL, json=_pedido(cliente, [item])).status_code == 400


def test_item_sem_quantidade_retorna_400(client, db):
    modelo, preto, _, cliente = _cenario(db)
    assert client.post(URL, json=_pedido(cliente, [_item(modelo, preto, P=0)])).status_code == 400


def test_cor_inativa_retorna_400(client, db):
    modelo, _, _, cliente = _cenario(db)
    cinza = criar_cor(db, "Cinza", "#888888", ativo=False)
    assert client.post(URL, json=_pedido(cliente, [_item(modelo, cinza, P=2)])).status_code == 400


def test_corpo_antigo_vira_item_sem_cor(client, db):
    modelo, _, _, cliente = _cenario(db)
    resposta = client.post(URL, json=_antigo(cliente, modelo, grade_p=5, grade_g=3))
    assert resposta.status_code == 201
    item = resposta.json()["itens"][0]
    assert item["id_cor"] is None
    assert [(q["rotulo"], q["quantidade"]) for q in item["quantidades"]] == [("P", 5), ("G", 3)]
    assert resposta.json()["grade_p"] == 5


def test_corpo_antigo_com_tamanho_que_a_grade_nao_tem_retorna_400(client, db):
    modelo = criar_modelo_com_grade(db, nome="Infantil", rotulos=("2", "4"))
    resposta = client.post(URL, json=_antigo(criar_cliente(db), modelo, grade_p=5))
    assert resposta.status_code == 400
    assert "não tem o tamanho P" in resposta.json()["detail"]


def test_editar_itens_define_a_cor_e_recalcula(client, db):
    modelo, preto, branco, cliente = _cenario(db)
    criado = client.post(URL, json=_antigo(cliente, modelo, grade_p=5, grade_g=3)).json()
    resposta = client.put(f"{URL}{criado['id_pedido']}/itens", json={"itens": [
        _item(modelo, preto, P=5, G=3), _item(modelo, branco, M=2)]})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["quantidade_total"] == 10
    assert [i["nome_cor"] for i in corpo["itens"]] == ["Preto", "Branco"]
    assert db.query(CamisetaPedidoItem).count() == 2


def test_editar_itens_sem_cor_retorna_400(client, db):
    modelo, _, _, cliente = _cenario(db)
    criado = client.post(URL, json=_antigo(cliente, modelo, grade_p=5)).json()
    resposta = client.put(f"{URL}{criado['id_pedido']}/itens", json={"itens": [_item(modelo, None, P=5)]})
    assert resposta.status_code == 400


def test_editar_itens_de_pedido_entregue_retorna_409(client, db):
    modelo, preto, _, _ = _cenario(db)
    pedido = criar_pedido(db, modelo, status="Entregue")
    resposta = client.put(f"{URL}{pedido.id_pedido}/itens", json={"itens": [_item(modelo, preto, P=1)]})
    assert resposta.status_code == 409


def test_excluir_pedido_remove_os_itens(client, db):
    modelo, preto, _, cliente = _cenario(db)
    criado = client.post(URL, json=_pedido(cliente, [_item(modelo, preto, P=1)])).json()
    assert client.delete(f"{URL}{criado['id_pedido']}").status_code == 200
    assert db.query(CamisetaPedidoItem).count() == 0


def test_pedido_com_mesmo_modelo_e_cor_mas_estampas_diferentes(client, db):
    modelo, preto, _, cliente = _cenario(db)
    est1 = criar_estampa_teste(db, nome="Leão", codigo="EST-1")
    est2 = criar_estampa_teste(db, nome="Águia", codigo="EST-2")
    i1 = {**_item(modelo, preto, P=10), "id_estampa": est1.id_estampa}
    i2 = {**_item(modelo, preto, M=15), "id_estampa": est2.id_estampa, "posicao_estampa": "Costas"}
    resposta = client.post(URL, json=_pedido(cliente, [i1, i2]))
    assert resposta.status_code == 201
    itens = resposta.json()["itens"]
    assert [(i["codigo_estampa"], i["nome_estampa"], i["posicao_estampa"]) for i in itens] == [
        ("EST-1", "Leão", "Frente"),
        ("EST-2", "Águia", "Costas"),
    ]
    assert itens[0]["imagem_estampa_url"].startswith("data:image/png;base64,")


def test_item_repetindo_mesma_estampa_e_posicao_retorna_400(client, db):
    modelo, preto, _, cliente = _cenario(db)
    est = criar_estampa_teste(db, nome="Leão", codigo="EST-1")
    i1 = {**_item(modelo, preto, P=10), "id_estampa": est.id_estampa, "posicao_estampa": "Frente"}
    i2 = {**_item(modelo, preto, M=5), "id_estampa": est.id_estampa, "posicao_estampa": "frente"}
    resposta = client.post(URL, json=_pedido(cliente, [i1, i2]))
    assert resposta.status_code == 400
    assert "repete modelo e cor" in resposta.json()["detail"]


def test_estampa_inativa_no_pedido_retorna_400(client, db):
    modelo, preto, _, cliente = _cenario(db)
    inativa = criar_estampa_teste(db, nome="Antiga", codigo="EST-OLD", ativo=False)
    item = {**_item(modelo, preto, P=5), "id_estampa": inativa.id_estampa}
    resposta = client.post(URL, json=_pedido(cliente, [item]))
    assert resposta.status_code == 400
    assert "inativa" in resposta.json()["detail"]

