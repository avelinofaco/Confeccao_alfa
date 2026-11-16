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
