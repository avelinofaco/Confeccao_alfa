from app.models.camisetas_sku import CamisetaMovimentoEstoque, CamisetaVariacao
from app.services.camisetas.sku import AJUSTE, INVENTARIO, movimentar
from tests.fabricas import criar_cor, criar_modelo, criar_variacao, tamanho

URL = "/camisetas/produtos-prontos"


def _contagem(modelo, cor, rotulo, quantidade):
    return {"id_modelo": modelo.id_modelo, "id_cor": cor.id_cor,
            "id_tamanho": tamanho(modelo, rotulo).id_tamanho, "quantidade_contada": quantidade}


def test_inventario_lanca_so_as_diferencas(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    criar_variacao(db, modelo, preto, "P", saldo=5)
    resposta = client.post(f"{URL}/inventario", json={"contagens": [
        _contagem(modelo, preto, "P", 5), _contagem(modelo, preto, "M", 12), _contagem(modelo, preto, "G", 0),
    ]})
    assert resposta.status_code == 200
    assert resposta.json() == {"skus_alterados": 1, "pecas_entrada": 12, "pecas_saida": 0}
    movimentos = db.query(CamisetaMovimentoEstoque).all()
    assert [(m.tipo, m.quantidade, m.saldo_apos, m.motivo) for m in movimentos] == [
        ("INVENTARIO", 12, 12, "Inventário de abertura")]
    assert db.query(CamisetaVariacao).count() == 2  # o G contado como zero não cria SKU


def test_inventario_reduz_quando_a_contagem_e_menor(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "M", saldo=10)
    resposta = client.post(f"{URL}/inventario", json={"motivo": "Contagem de novembro",
                                                     "contagens": [_contagem(modelo, preto, "M", 7)]})
    assert resposta.json() == {"skus_alterados": 1, "pecas_entrada": 0, "pecas_saida": 3}
    db.refresh(variacao)
    assert variacao.saldo == 7
    assert db.query(CamisetaMovimentoEstoque).one().motivo == "Contagem de novembro"


def test_inventario_com_contagem_repetida_retorna_400_e_nao_lanca(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    resposta = client.post(f"{URL}/inventario", json={"contagens": [
        _contagem(modelo, preto, "M", 3), _contagem(modelo, preto, "M", 4)]})
    assert resposta.status_code == 400
    assert db.query(CamisetaMovimentoEstoque).count() == 0


def test_listagem_agrupa_por_modelo_e_cor_com_todos_os_tamanhos(client, db):
    modelo, preto, branco = criar_modelo(db), criar_cor(db), criar_cor(db, "Branco", "#FFFFFF")
    criar_variacao(db, modelo, preto, "M", saldo=4)
    criar_variacao(db, modelo, branco, "G", saldo=2, minimo=5)
    linhas = client.get(f"{URL}/").json()
    assert [(linha["nome_cor"], linha["total"]) for linha in linhas] == [("Branco", 2), ("Preto", 4)]
    assert [c["rotulo"] for c in linhas[0]["tamanhos"]] == ["P", "M", "G", "GG"]
    g_branco = linhas[0]["tamanhos"][2]
    assert (g_branco["saldo"], g_branco["estoque_minimo"], g_branco["abaixo_minimo"]) == (2, 5, True)
    assert linhas[1]["tamanhos"][0]["id_variacao"] is None


def test_filtro_abaixo_do_minimo(client, db):
    modelo, preto, branco = criar_modelo(db), criar_cor(db), criar_cor(db, "Branco", "#FFFFFF")
    criar_variacao(db, modelo, preto, "M", saldo=4)
    criar_variacao(db, modelo, branco, "G", saldo=2, minimo=5)
    linhas = client.get(f"{URL}/", params={"abaixo_minimo": True}).json()
    assert [linha["nome_cor"] for linha in linhas] == ["Branco"]


def test_ajuste_com_motivo(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "M", saldo=3)
    ok = client.post(f"{URL}/ajustes", json={"id_variacao": variacao.id_variacao, "quantidade": -2, "motivo": "Peça manchada"})
    assert ok.status_code == 200
    assert ok.json()["saldo"] == 1
    assert client.post(f"{URL}/ajustes", json={"id_variacao": variacao.id_variacao, "quantidade": -5,
                                               "motivo": "Perda"}).status_code == 400
    assert client.post(f"{URL}/ajustes", json={"id_variacao": variacao.id_variacao, "quantidade": 0,
                                               "motivo": "Nada"}).status_code == 400
    assert client.post(f"{URL}/ajustes", json={"id_variacao": variacao.id_variacao, "quantidade": 1,
                                               "motivo": "ab"}).status_code == 422


def test_definir_estoque_minimo(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "M")
    resposta = client.put(f"{URL}/variacoes/{variacao.id_variacao}/minimo", json={"estoque_minimo": 8})
    assert resposta.status_code == 200
    assert resposta.json()["estoque_minimo"] == 8
    assert client.put(f"{URL}/variacoes/{variacao.id_variacao}/minimo", json={"estoque_minimo": -1}).status_code == 422
    assert client.put(f"{URL}/variacoes/999/minimo", json={"estoque_minimo": 1}).status_code == 404


def test_historico_mais_recente_primeiro_e_filtros(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "M")
    movimentar(db, variacao, 10, INVENTARIO, motivo="Inventário de abertura")
    movimentar(db, variacao, -2, AJUSTE, motivo="Perda")
    db.commit()
    lista = client.get(f"{URL}/movimentos/", params={"id_variacao": variacao.id_variacao}).json()
    assert [(m["tipo"], m["quantidade"], m["saldo_apos"]) for m in lista] == [("AJUSTE", -2, 8), ("INVENTARIO", 10, 10)]
    assert lista[0]["sku"] == "Camiseta Básica · Preto · M"
    assert len(client.get(f"{URL}/movimentos/", params={"tipo": "AJUSTE"}).json()) == 1
    assert len(client.get(f"{URL}/movimentos/", params={"id_modelo": modelo.id_modelo}).json()) == 2
    assert client.get(f"{URL}/movimentos/", params={"tipo": "XPTO"}).status_code == 400
