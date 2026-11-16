import pytest

# Uma rota de cada módulo: se a porta falhar em algum, o teste aponta qual.
# Caminhos conferidos no esquema OpenAPI; ficha_tecnica usa o prefixo /produtos.
ROTAS = [
    # Camisetas (o segmento ativo)
    ("GET", "/camisetas/produtos-prontos/"),
    ("GET", "/camisetas/pedidos/"),
    ("GET", "/camisetas/ordens/"),
    ("GET", "/camisetas/costura/"),
    ("GET", "/camisetas/dashboard/"),
    ("GET", "/camisetas/clientes/"),
    # Moda Íntima e módulos originais — congelados, mas a porta vale para eles também.
    ("GET", "/estoque/insumos"),
    ("GET", "/produtos/"),
    ("GET", "/producao/ordens"),
    ("GET", "/costura/movimentacoes"),
    ("GET", "/comercial/pedidos"),
    ("GET", "/equipe/colaboradores"),
    # Conta: /usuarios/eu só nasce na Task 4; aqui vale qualquer rota do módulo.
    ("GET", "/usuarios/1"),
]


@pytest.mark.parametrize("metodo, caminho", ROTAS)
def test_sem_token_a_rota_recusa(client_sem_login, metodo, caminho):
    resposta = client_sem_login.request(metodo, caminho)
    assert resposta.status_code == 401, f"{metodo} {caminho} respondeu {resposta.status_code}"
    assert resposta.json()["detail"] == "Faça login para continuar."


@pytest.mark.parametrize("metodo, caminho", ROTAS)
def test_com_token_a_rota_deixa_passar(client, metodo, caminho):
    resposta = client.request(metodo, caminho)
    assert resposta.status_code != 401, f"{metodo} {caminho} recusou um token válido"


def test_token_invalido_recusa(client_sem_login):
    resposta = client_sem_login.get(
        "/camisetas/produtos-prontos/", headers={"Authorization": "Bearer nao-e-um-token"})
    assert resposta.status_code == 401


def test_a_saude_e_o_login_continuam_abertos(client_sem_login):
    assert client_sem_login.get("/").status_code == 200
    # senha errada: 401 do próprio login, não da porta
    assert client_sem_login.post("/login", data={"username": "ninguem", "password": "x"}).status_code == 401
