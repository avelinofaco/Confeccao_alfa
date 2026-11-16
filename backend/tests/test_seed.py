def test_seed_cria_cores_pedidos_com_itens_e_estoque_por_sku(client):
    assert client.post("/camisetas/seed-inicial").status_code == 200
    linhas = client.get("/camisetas/produtos-prontos/").json()
    assert [(linha["nome_cor"], linha["total"]) for linha in linhas] == [("Preto", 350)]
    pedidos = client.get("/camisetas/pedidos/").json()
    assert sorted(p["itens"][0]["nome_cor"] for p in pedidos) == ["Branco", "Preto"]
    rolos = client.get("/camisetas/insumos/", params={"categoria": "ROLO_TECIDO"}).json()
    assert all(r["id_cor"] for r in rolos)
    movimentos = client.get("/camisetas/produtos-prontos/movimentos/").json()
    assert {m["motivo"] for m in movimentos} == {"Carga de demonstração"}


def test_seed_recusa_em_producao(client, monkeypatch):
    from app.routers.camisetas import seed as rotas_seed
    monkeypatch.setattr(rotas_seed.config, "EM_PRODUCAO", True)
    resposta = client.post("/camisetas/seed-inicial")
    assert resposta.status_code == 403
    assert "produção" in resposta.json()["detail"]


def test_seed_sem_token_recusa(client_sem_login):
    assert client_sem_login.post("/camisetas/seed-inicial").status_code == 401
