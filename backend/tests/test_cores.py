from decimal import Decimal

from tests.fabricas import criar_cor, criar_insumo


def test_cria_cor_e_padroniza_hex(client):
    resposta = client.post("/camisetas/cores/", json={"nome": "Cinza Mescla", "hex": "#b8b8b8"})
    assert resposta.status_code == 201
    assert resposta.json()["hex"] == "#B8B8B8"


def test_nome_repetido_sem_diferenciar_maiusculas_retorna_409(client, db):
    criar_cor(db, nome="Preto")
    assert client.post("/camisetas/cores/", json={"nome": "PRETO", "hex": "#000000"}).status_code == 409


def test_hex_invalido_retorna_422(client):
    assert client.post("/camisetas/cores/", json={"nome": "Azul", "hex": "azul"}).status_code == 422


def test_inativas_ficam_fora_por_padrao(client, db):
    criar_cor(db, nome="Preto")
    criar_cor(db, nome="Antiga", ativo=False)
    assert [c["nome"] for c in client.get("/camisetas/cores/").json()] == ["Preto"]
    assert len(client.get("/camisetas/cores/?incluir_inativas=true").json()) == 2


def test_atualiza_cor(client, db):
    cor = criar_cor(db, nome="Preto")
    resposta = client.put(f"/camisetas/cores/{cor.id_cor}", json={"nome": "Preto Ônix", "hex": "#111111", "ativo": False})
    assert (resposta.json()["nome"], resposta.json()["ativo"]) == ("Preto Ônix", False)


def test_excluir_cor_em_uso_retorna_409(client, db):
    cor = criar_cor(db)
    insumo = criar_insumo(db)
    insumo.id_cor = cor.id_cor
    db.commit()
    assert client.delete(f"/camisetas/cores/{cor.id_cor}").status_code == 409


def test_excluir_cor_livre(client, db):
    cor = criar_cor(db)
    assert client.delete(f"/camisetas/cores/{cor.id_cor}").status_code == 204


def test_insumo_criado_com_cor_mostra_nome_e_hex(client, db):
    cor = criar_cor(db, nome="Preto", hex="#1F1F1F")
    resposta = client.post("/camisetas/insumos/", json={
        "categoria": "ROLO_TECIDO", "tipo_malha_ou_aviamento": "Meia Malha", "unidade_medida": "kg", "id_cor": cor.id_cor,
    })
    assert resposta.status_code == 201
    assert (resposta.json()["nome_cor"], resposta.json()["hex_cor"]) == ("Preto", "#1F1F1F")
    assert client.get("/camisetas/insumos/").json()[0]["nome_cor"] == "Preto"


def test_insumo_com_cor_inexistente_retorna_404(client):
    resposta = client.post("/camisetas/insumos/", json={
        "categoria": "ROLO_TECIDO", "tipo_malha_ou_aviamento": "Meia Malha", "unidade_medida": "kg", "id_cor": 999,
    })
    assert resposta.status_code == 404


def test_editar_insumo_nao_altera_saldo_nem_custo(client, db):
    cor = criar_cor(db)
    insumo = criar_insumo(db, saldo="100.000", custo="40.00")
    resposta = client.put(f"/camisetas/insumos/{insumo.id_insumo}", json={
        "tipo_malha_ou_aviamento": "Meia Malha Penteada", "cor": "Preto Reativo", "id_cor": cor.id_cor,
        "unidade_medida": "kg", "estoque_minimo": "25", "saldo_atual": "9999", "preco_custo_medio": "1",
    })
    assert resposta.status_code == 200
    db.refresh(insumo)
    assert insumo.tipo_malha_ou_aviamento == "Meia Malha Penteada"
    assert insumo.estoque_minimo == Decimal("25.000")
    assert insumo.saldo_atual == Decimal("100.000")
    assert insumo.preco_custo_medio == Decimal("40.00")
