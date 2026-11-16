from app.core.security import obter_hash_senha
from app.models.usuarios import Usuario


def outro_usuario(db):
    usuario = Usuario(
        login="bruno", senha_hash=obter_hash_senha("outra123"), nome_usuario="Bruno",
        perfil="Operador", ativo=True,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def test_eu_devolve_o_usuario_do_token(client, usuario_teste):
    corpo = client.get("/usuarios/eu").json()
    assert corpo["login"] == usuario_teste.login
    assert corpo["id_usuario"] == usuario_teste.id_usuario
    assert "senha" not in corpo and "senha_hash" not in corpo


def test_usuario_logado_cadastra_colega(client):
    resposta = client.post("/usuarios/", json={
        "login": "carla", "nome_usuario": "Carla", "perfil": "Operador", "senha": "carla123",
    })
    assert resposta.status_code == 201
    assert resposta.json()["login"] == "carla"


def test_login_repetido_retorna_400(client, usuario_teste):
    resposta = client.post("/usuarios/", json={
        "login": usuario_teste.login, "nome_usuario": "Xará", "senha": "outra123",
    })
    assert resposta.status_code == 400


def test_editar_o_proprio_perfil_funciona(client, usuario_teste):
    resposta = client.put(f"/usuarios/{usuario_teste.id_usuario}", json={"nome_usuario": "Nome Novo"})
    assert resposta.status_code == 200
    assert resposta.json()["nome_usuario"] == "Nome Novo"


def test_editar_o_perfil_de_outro_retorna_403(client, db):
    alvo = outro_usuario(db)
    resposta = client.put(f"/usuarios/{alvo.id_usuario}", json={"senha": "invadida123"})
    assert resposta.status_code == 403
    assert "própria conta" in resposta.json()["detail"]


def test_ver_o_perfil_de_outro_retorna_403(client, db):
    alvo = outro_usuario(db)
    assert client.get(f"/usuarios/{alvo.id_usuario}").status_code == 403
