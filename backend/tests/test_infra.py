from app.models.camisetas import CamisetaModelo
from tests.fabricas import criar_modelo


def test_api_responde(client):
    resposta = client.get("/")
    assert resposta.status_code == 200


def test_banco_de_teste_isolado(db):
    criar_modelo(db, nome="Modelo Isolado")
    assert db.query(CamisetaModelo).count() == 1
