from datetime import date, timedelta
from decimal import Decimal

from tests.fabricas import criar_cliente, criar_modelo, criar_pedido

CNPJ_VALIDO = "11.222.333/0001-81"


def test_cria_cliente_com_documento_normalizado(client):
    resposta = client.post("/camisetas/clientes/", json={
        "nome": "  Ateliê   Sol ", "documento": "529.982.247-25", "telefone_whatsapp": "(85) 9 9999-0000", "uf": "ce",
    })
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert (corpo["nome"], corpo["documento"], corpo["tipo"]) == ("Ateliê Sol", "52998224725", "PF")
    assert corpo["telefone_whatsapp"] == "85999990000"
    assert corpo["uf"] == "CE"


def test_documento_invalido_retorna_400(client):
    resposta = client.post("/camisetas/clientes/", json={"nome": "Loja", "documento": "11.222.333/0001-82"})
    assert resposta.status_code == 400
    assert "CNPJ inválido" in resposta.json()["detail"]


def test_documento_duplicado_retorna_409_com_nome(client, db):
    criar_cliente(db, nome="Loja Beta", documento="11222333000181")
    resposta = client.post("/camisetas/clientes/", json={"nome": "Outra", "documento": CNPJ_VALIDO})
    assert resposta.status_code == 409
    assert "Loja Beta" in resposta.json()["detail"]


def test_busca_sem_acento_por_documento_e_telefone(client, db):
    criar_cliente(db, nome="Ateliê Sol", telefone="85999990000")
    criar_cliente(db, nome="Loja Beta", documento="11222333000181")
    assert [c["nome"] for c in client.get("/camisetas/clientes/?busca=atelie").json()] == ["Ateliê Sol"]
    assert [c["nome"] for c in client.get("/camisetas/clientes/?busca=99990").json()] == ["Ateliê Sol"]
    assert [c["nome"] for c in client.get("/camisetas/clientes/?busca=11.222").json()] == ["Loja Beta"]


def test_inativos_ficam_fora_da_lista_por_padrao(client, db):
    criar_cliente(db, nome="Ativo")
    criar_cliente(db, nome="Inativo", ativo=False)
    assert [c["nome"] for c in client.get("/camisetas/clientes/").json()] == ["Ativo"]
    assert len(client.get("/camisetas/clientes/?incluir_inativos=true").json()) == 2


def test_resumo_de_pedidos_do_cliente(client, db):
    cliente = criar_cliente(db)
    modelo = criar_modelo(db)
    criar_pedido(db, modelo, codigo="A", valor="100.00", cliente=cliente)
    criar_pedido(db, modelo, codigo="B", valor="250.50", cliente=cliente)
    corpo = client.get(f"/camisetas/clientes/{cliente.id_cliente}").json()
    assert corpo["qtd_pedidos"] == 2
    assert Decimal(corpo["valor_total_pedidos"]) == Decimal("350.50")
    assert corpo["ultimo_pedido_em"] is not None


def test_excluir_cliente_com_pedidos_retorna_409(client, db):
    cliente = criar_cliente(db)
    criar_pedido(db, criar_modelo(db), cliente=cliente)
    resposta = client.delete(f"/camisetas/clientes/{cliente.id_cliente}")
    assert resposta.status_code == 409
    assert "inative" in resposta.json()["detail"]


def test_excluir_cliente_sem_pedidos(client, db):
    cliente = criar_cliente(db)
    assert client.delete(f"/camisetas/clientes/{cliente.id_cliente}").status_code == 204
    assert client.get(f"/camisetas/clientes/{cliente.id_cliente}").status_code == 404


def test_inativar_cliente(client, db):
    cliente = criar_cliente(db, nome="Loja Beta")
    resposta = client.put(f"/camisetas/clientes/{cliente.id_cliente}", json={"nome": "Loja Beta", "ativo": False})
    assert resposta.status_code == 200
    assert resposta.json()["ativo"] is False


def _pedido(**extra):
    return {
        "id_modelo": extra.pop("id_modelo"), "grade_p": 5, "grade_m": 5, "grade_g": 0, "grade_gg": 0,
        "prazo_entrega": (date.today() + timedelta(days=5)).isoformat(), "valor_total": "300.00", **extra,
    }


def test_pedido_com_id_cliente_usa_nome_do_cadastro(client, db):
    cliente = criar_cliente(db, nome="Loja Beta")
    modelo = criar_modelo(db)
    corpo = client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo, id_cliente=cliente.id_cliente)).json()
    assert (corpo["id_cliente"], corpo["nome_cliente"]) == (cliente.id_cliente, "Loja Beta")


def test_pedido_com_cliente_inativo_retorna_400(client, db):
    cliente = criar_cliente(db, ativo=False)
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo, id_cliente=cliente.id_cliente))
    assert resposta.status_code == 400


def test_pedido_so_com_nome_reaproveita_cliente_existente(client, db):
    cliente = criar_cliente(db, nome="Loja Beta")
    modelo = criar_modelo(db)
    corpo = client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo, nome_cliente=" LOJA  beta")).json()
    assert corpo["id_cliente"] == cliente.id_cliente


def test_pedido_so_com_nome_novo_cria_cliente(client, db):
    modelo = criar_modelo(db)
    corpo = client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo, nome_cliente="Cliente Novo")).json()
    assert corpo["id_cliente"] is not None
    assert client.get("/camisetas/clientes/?busca=cliente novo").json()[0]["nome"] == "Cliente Novo"


def test_pedido_sem_cliente_retorna_400(client, db):
    modelo = criar_modelo(db)
    assert client.post("/camisetas/pedidos/", json=_pedido(id_modelo=modelo.id_modelo)).status_code == 400
