import pytest

from app.core.erros import ErroNegocio
from app.models.camisetas_cadastros import CamisetaGrade
from app.services.camisetas.grades import aplicar_tamanhos, limpar_tamanhos, obter_grade_padrao
from tests.fabricas import criar_cor, criar_modelo, criar_pedido_com_itens, criar_variacao, tamanho


def test_limpar_tamanhos_apara_e_mantem_ordem():
    assert limpar_tamanhos([" PP", "P ", "  ", "M"]) == ["PP", "P", "M"]


@pytest.mark.parametrize("rotulos, mensagem", [
    ([], "pelo menos um tamanho"),
    (["  "], "pelo menos um tamanho"),
    (["P", "p"], "repetido"),
    (["EXTRAGRANDE1"], "10 caracteres"),
])
def test_limpar_tamanhos_recusa_lista_invalida(rotulos, mensagem):
    with pytest.raises(ErroNegocio) as erro:
        limpar_tamanhos(rotulos)
    assert erro.value.status_code == 400 and mensagem in erro.value.mensagem


def test_aplicar_tamanhos_mantem_os_que_continuam(db):
    grade = CamisetaGrade(nome="Teste")
    aplicar_tamanhos(grade, ["P", "M", "G"])
    db.add(grade)
    db.commit()
    id_m = next(t.id_tamanho for t in grade.tamanhos if t.rotulo == "M")
    aplicar_tamanhos(grade, ["M", "GG", "P"])
    db.commit()
    db.refresh(grade)
    assert [(t.rotulo, t.ordem) for t in grade.tamanhos] == [("M", 1), ("GG", 2), ("P", 3)]
    assert next(t.id_tamanho for t in grade.tamanhos if t.rotulo == "M") == id_m


def test_grade_padrao_e_criada_uma_vez(db):
    primeira = obter_grade_padrao(db)
    db.commit()
    assert obter_grade_padrao(db).id_grade == primeira.id_grade
    assert [t.rotulo for t in primeira.tamanhos] == ["P", "M", "G", "GG"]


def test_api_cria_e_lista_grade(client):
    resposta = client.post("/camisetas/grades/", json={"nome": "Infantil (2–16)", "tamanhos": ["2", "4", "6"]})
    assert resposta.status_code == 201
    assert client.get("/camisetas/grades/").json()[0]["tamanhos"] == ["2", "4", "6"]


def test_api_nome_repetido_retorna_409(client):
    client.post("/camisetas/grades/", json={"nome": "Adulto", "tamanhos": ["P"]})
    assert client.post("/camisetas/grades/", json={"nome": "adulto", "tamanhos": ["M"]}).status_code == 409


def test_api_editar_grade_regrava_texto_dos_modelos(client, db):
    grade = client.post("/camisetas/grades/", json={"nome": "Adulto", "tamanhos": ["P", "M"]}).json()
    modelo = client.post("/camisetas/modelos/", json={
        "nome_modelo": "Básica", "consumo_tecido_kg": "0.18", "id_grade": grade["id_grade"],
    }).json()
    client.put(f"/camisetas/grades/{grade['id_grade']}", json={"nome": "Adulto", "tamanhos": ["PP", "P", "M", "XG"]})
    modelos = {m["id_modelo"]: m for m in client.get("/camisetas/modelos/").json()}
    assert modelos[modelo["id_modelo"]]["grade_disponivel"] == "PP, P, M, XG"
    assert modelos[modelo["id_modelo"]]["tamanhos"] == ["PP", "P", "M", "XG"]
    assert client.get("/camisetas/grades/").json()[0]["qtd_modelos"] == 1


def test_api_excluir_grade_em_uso_retorna_409(client):
    grade = client.post("/camisetas/grades/", json={"nome": "Adulto", "tamanhos": ["P"]}).json()
    client.post("/camisetas/modelos/", json={"nome_modelo": "Básica", "consumo_tecido_kg": "0.18", "id_grade": grade["id_grade"]})
    assert client.delete(f"/camisetas/grades/{grade['id_grade']}").status_code == 409


def test_api_modelo_sem_grade_usa_a_padrao(client):
    corpo = client.post("/camisetas/modelos/", json={"nome_modelo": "Básica", "consumo_tecido_kg": "0.18"}).json()
    assert (corpo["nome_grade"], corpo["tamanhos"]) == ("Adulto (P, M, G, GG)", ["P", "M", "G", "GG"])


def test_api_editar_modelo_troca_grade(client, db):
    modelo = criar_modelo(db, nome="Básica")
    grade = client.post("/camisetas/grades/", json={"nome": "Babylook", "tamanhos": ["PP", "P", "M"]}).json()
    resposta = client.put(f"/camisetas/modelos/{modelo.id_modelo}", json={
        "nome_modelo": "Básica Babylook", "consumo_tecido_kg": "0.15", "id_grade": grade["id_grade"],
    })
    assert resposta.status_code == 200
    assert (resposta.json()["nome_modelo"], resposta.json()["grade_disponivel"]) == ("Básica Babylook", "PP, P, M")


def test_api_modelo_com_nome_repetido_retorna_409(client, db):
    criar_modelo(db, nome="Básica")
    assert client.post("/camisetas/modelos/", json={"nome_modelo": "Básica", "consumo_tecido_kg": "0.2"}).status_code == 409


def test_api_modelo_com_grade_inexistente_retorna_404(client):
    resposta = client.post("/camisetas/modelos/", json={"nome_modelo": "X", "consumo_tecido_kg": "0.2", "id_grade": 999})
    assert resposta.status_code == 404


def _editar_grade(client, modelo, tamanhos):
    return client.put(f"/camisetas/grades/{modelo.id_grade}", json={"nome": "Adulto (P, M, G, GG)", "tamanhos": tamanhos})


def test_api_remover_tamanho_com_estoque_retorna_409(client, db):
    modelo = criar_modelo(db)
    criar_variacao(db, modelo, criar_cor(db), "GG", saldo=1)
    resposta = _editar_grade(client, modelo, ["P", "M", "G"])
    assert resposta.status_code == 409
    assert "O tamanho GG tem pedidos ou estoque" in resposta.json()["detail"]


def test_api_remover_tamanho_com_pedido_retorna_409(client, db):
    modelo = criar_modelo(db)
    criar_pedido_com_itens(db, modelo, None, {"P": 3})
    assert _editar_grade(client, modelo, ["M", "G", "GG"]).status_code == 409


def test_api_remover_tamanho_livre_continua_permitido(client, db):
    modelo = criar_modelo(db)
    criar_variacao(db, modelo, criar_cor(db), "P")
    assert _editar_grade(client, modelo, ["P", "M", "G"]).status_code == 200


def test_api_trocar_grade_de_modelo_em_uso_retorna_409(client, db):
    modelo = criar_modelo(db, nome="Básica")
    criar_variacao(db, modelo, criar_cor(db), "P")
    babylook = client.post("/camisetas/grades/", json={"nome": "Babylook", "tamanhos": ["PP", "P"]}).json()
    resposta = client.put(f"/camisetas/modelos/{modelo.id_modelo}", json={
        "nome_modelo": "Básica", "consumo_tecido_kg": "0.18", "id_grade": babylook["id_grade"]})
    assert resposta.status_code == 409


def test_api_modelo_traz_os_tamanhos_com_id(client, db):
    modelo = criar_modelo(db)
    corpo = client.get("/camisetas/modelos/").json()[0]
    assert [t["rotulo"] for t in corpo["grade_tamanhos"]] == ["P", "M", "G", "GG"]
    assert corpo["grade_tamanhos"][0]["id_tamanho"] == tamanho(modelo, "P").id_tamanho
