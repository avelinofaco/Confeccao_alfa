from types import SimpleNamespace

from app.models.camisetas import CamisetaProdutoAcabado
from app.services.camisetas.costura import status_op_apos_retorno
from tests.fabricas import criar_modelo, criar_op_cortada, criar_remessa


def remessa(quantidade, status):
    return SimpleNamespace(quantidade_enviada=quantidade, status=status)


def test_op_finaliza_quando_tudo_foi_enviado_e_retornado():
    remessas = [remessa(60, "Retornado e Conferido"), remessa(40, "Retornado e Conferido")]
    assert status_op_apos_retorno(100, remessas) == "Costura Finalizada"


def test_op_continua_em_costura_com_remessa_pendente():
    remessas = [remessa(60, "Retornado e Conferido"), remessa(40, "Em Costura Externa")]
    assert status_op_apos_retorno(100, remessas) == "Em Costura"


def test_op_continua_em_costura_com_pecas_ainda_nao_enviadas():
    assert status_op_apos_retorno(100, [remessa(60, "Retornado e Conferido")]) == "Em Costura"


def test_api_retorno_duplicado_retorna_409_e_nao_duplica_estoque(client, db):
    modelo = criar_modelo(db)
    op = criar_op_cortada(db, modelo, pecas=100)
    rem = criar_remessa(db, op, quantidade=50)
    primeira = client.put(f"/camisetas/costura/{rem.id_costura}/retornar", json={"quantidade_retornada": 48})
    segunda = client.put(f"/camisetas/costura/{rem.id_costura}/retornar", json={"quantidade_retornada": 48})
    assert primeira.status_code == 200
    assert primeira.json()["perdas_pecas"] == 2
    assert segunda.status_code == 409
    estoque = db.query(CamisetaProdutoAcabado).filter_by(id_modelo=modelo.id_modelo).one()
    assert estoque.quantidade_total == 48


def test_api_retorno_maior_que_o_enviado_retorna_400(client, db):
    modelo = criar_modelo(db)
    op = criar_op_cortada(db, modelo, pecas=100)
    rem = criar_remessa(db, op, quantidade=50)
    resposta = client.put(f"/camisetas/costura/{rem.id_costura}/retornar", json={"quantidade_retornada": 60})
    assert resposta.status_code == 400


def test_api_op_so_finaliza_no_ultimo_retorno(client, db):
    modelo = criar_modelo(db)
    op = criar_op_cortada(db, modelo, pecas=100)
    rem_a = criar_remessa(db, op, quantidade=60)
    rem_b = criar_remessa(db, op, quantidade=40)
    client.put(f"/camisetas/costura/{rem_a.id_costura}/retornar", json={"quantidade_retornada": 60})
    db.refresh(op)
    assert op.status_op == "Em Costura"
    client.put(f"/camisetas/costura/{rem_b.id_costura}/retornar", json={"quantidade_retornada": 40})
    db.refresh(op)
    assert op.status_op == "Costura Finalizada"
