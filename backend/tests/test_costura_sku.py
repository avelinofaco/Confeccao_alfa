from app.models.camisetas import CamisetaCosturaFaccao
from app.models.camisetas_sku import CamisetaMovimentoEstoque, CamisetaVariacao
from tests.fabricas import criar_cor, criar_insumo, criar_modelo, criar_op_cortada, criar_remessa, tamanho


def _op_cortada_por_sku(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    malha = criar_insumo(db, saldo="30.000", cor=preto)
    op = client.post("/camisetas/ordens/", json={"id_modelo": modelo.id_modelo, "cores": [
        {"id_cor": preto.id_cor, "id_insumo_tecido": malha.id_insumo, "peso_kg": "10.000"}]}).json()
    client.put(f"/camisetas/ordens/{op['id_op']}/finalizar-corte", json={"cortes": [
        {"id_cor": preto.id_cor, "id_tamanho": tamanho(modelo, "P").id_tamanho, "quantidade": 20},
        {"id_cor": preto.id_cor, "id_tamanho": tamanho(modelo, "M").id_tamanho, "quantidade": 30}]})
    return modelo, preto, client.get("/camisetas/ordens/").json()[0]


def _sku(op, rotulo):
    return next(c["id_variacao"] for c in op["cortes"] if c["rotulo"] == rotulo)


def _enviar(client, op, itens):
    return client.post("/camisetas/costura/enviar", json={"id_op": op["id_op"], "nome_faccao": "Facção Maria", "itens": itens})


def _retorno(modelo, cor, **quantidades):
    return [{"id_cor": cor.id_cor, "id_tamanho": tamanho(modelo, r).id_tamanho, "quantidade": q} for r, q in quantidades.items()]


def test_envio_por_sku_grava_itens_e_total(client, db):
    _, _, op = _op_cortada_por_sku(client, db)
    resposta = _enviar(client, op, [{"id_variacao": _sku(op, "P"), "quantidade": 20},
                                    {"id_variacao": _sku(op, "M"), "quantidade": 10}])
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert (corpo["quantidade_enviada"], corpo["legada"]) == (30, False)
    assert [(i["rotulo"], i["qtd_enviada"]) for i in corpo["itens"]] == [("P", 20), ("M", 10)]
    depois = client.get("/camisetas/ordens/").json()[0]
    assert {c["rotulo"]: c["disponivel"] for c in depois["cortes"]} == {"P": 0, "M": 20}


def test_envio_acima_do_disponivel_retorna_400_e_nao_cria_remessa(client, db):
    _, _, op = _op_cortada_por_sku(client, db)
    resposta = _enviar(client, op, [{"id_variacao": _sku(op, "P"), "quantidade": 21}])
    assert resposta.status_code == 400
    assert "Camiseta Básica · Preto · P" in resposta.json()["detail"]
    assert db.query(CamisetaCosturaFaccao).count() == 0


def test_envio_sem_itens_em_op_por_sku_retorna_400(client, db):
    _, _, op = _op_cortada_por_sku(client, db)
    resposta = client.post("/camisetas/costura/enviar", json={"id_op": op["id_op"], "nome_faccao": "X", "quantidade_enviada": 5})
    assert resposta.status_code == 400


def test_retorno_por_sku_lanca_entrada_e_perdas(client, db):
    modelo, preto, op = _op_cortada_por_sku(client, db)
    remessa = _enviar(client, op, [{"id_variacao": _sku(op, "P"), "quantidade": 20},
                                   {"id_variacao": _sku(op, "M"), "quantidade": 10}]).json()
    resposta = client.put(f"/camisetas/costura/{remessa['id_costura']}/retornar",
                          json={"itens": _retorno(modelo, preto, P=19, M=10)})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert (corpo["quantidade_retornada"], corpo["perdas_pecas"]) == (29, 1)
    assert {i["rotulo"]: i["qtd_retornada"] for i in corpo["itens"]} == {"P": 19, "M": 10}
    assert {v.tamanho.rotulo: v.saldo for v in db.query(CamisetaVariacao).all()} == {"P": 19, "M": 10}
    movimentos = db.query(CamisetaMovimentoEstoque).all()
    assert {(m.tipo, m.id_costura) for m in movimentos} == {("ENTRADA_PRODUCAO", remessa["id_costura"])}


def test_retorno_de_sku_nao_enviado_ou_acima_do_enviado_retorna_400(client, db):
    modelo, preto, op = _op_cortada_por_sku(client, db)
    remessa = _enviar(client, op, [{"id_variacao": _sku(op, "P"), "quantidade": 10}]).json()
    url = f"/camisetas/costura/{remessa['id_costura']}/retornar"
    assert client.put(url, json={"itens": _retorno(modelo, preto, M=1)}).status_code == 400
    assert client.put(url, json={"itens": _retorno(modelo, preto, P=11)}).status_code == 400


def test_remessa_antiga_aceita_distribuicao_livre_ate_o_total(client, db):
    modelo, preto, branco = criar_modelo(db), criar_cor(db), criar_cor(db, "Branco", "#FFFFFF")
    remessa = criar_remessa(db, criar_op_cortada(db, modelo, pecas=100), quantidade=50)
    url = f"/camisetas/costura/{remessa.id_costura}/retornar"
    acima = client.put(url, json={"itens": _retorno(modelo, preto, P=30) + _retorno(modelo, branco, M=21)})
    assert acima.status_code == 400
    ok = client.put(url, json={"itens": _retorno(modelo, preto, P=30) + _retorno(modelo, branco, M=18)})
    assert ok.status_code == 200
    assert (ok.json()["perdas_pecas"], ok.json()["legada"]) == (2, True)
    saldos = {(v.cor.nome, v.tamanho.rotulo): v.saldo for v in db.query(CamisetaVariacao).all()}
    assert saldos == {("Preto", "P"): 30, ("Branco", "M"): 18}


def test_retorno_no_formato_antigo_retorna_422(client, db):
    remessa = criar_remessa(db, criar_op_cortada(db, criar_modelo(db), pecas=100), quantidade=50)
    resposta = client.put(f"/camisetas/costura/{remessa.id_costura}/retornar", json={"quantidade_retornada": 48})
    assert resposta.status_code == 422
