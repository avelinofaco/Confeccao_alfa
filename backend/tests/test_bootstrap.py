from app.core.bootstrap import criar_primeiro_usuario
from app.core.security import obter_hash_senha, verificar_senha
from app.models.usuarios import Usuario


def test_cria_a_conta_quando_nao_ha_nenhuma(db):
    criado = criar_primeiro_usuario(db, "dona", "senhaforte1")
    assert criado is not None
    assert criado.login == "dona"
    assert criado.ativo is True
    assert verificar_senha("senhaforte1", criado.senha_hash)


def test_nao_faz_nada_quando_ja_existe_usuario(db):
    db.add(Usuario(login="ja_existo", senha_hash=obter_hash_senha("x123456"), nome_usuario="Alguém"))
    db.commit()
    assert criar_primeiro_usuario(db, "dona", "senhaforte1") is None
    assert db.query(Usuario).count() == 1


def test_nao_faz_nada_sem_as_variaveis(db):
    assert criar_primeiro_usuario(db, None, None) is None
    assert criar_primeiro_usuario(db, "dona", None) is None
    assert db.query(Usuario).count() == 0


def test_e_idempotente(db):
    primeiro = criar_primeiro_usuario(db, "dona", "senhaforte1")
    assert criar_primeiro_usuario(db, "dona", "senhaforte1") is None
    assert db.query(Usuario).count() == 1
    assert primeiro.login == "dona"
