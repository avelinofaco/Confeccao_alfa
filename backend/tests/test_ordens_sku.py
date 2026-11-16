from decimal import Decimal

from app.models.camisetas import CamisetaOrdemProducao
from app.models.camisetas_sku import CamisetaOpCorte
from tests.fabricas import criar_cor, criar_grade, criar_insumo, criar_modelo, criar_op_cortada, criar_remessa, tamanho

URL = "/camisetas/ordens/"


def _cenario(db):
    modelo = criar_modelo(db)
    preto, branco = criar_cor(db), criar_cor(db, "Branco", "#FFFFFF")
    malha_preta = criar_insumo(db, codigo="MALHA-PRETA", saldo="30.000", cor=preto)
    malha_branca = criar_insumo(db, codigo="MALHA-BRANCA", saldo="20.000", cor=branco)
    return modelo, preto, branco, malha_preta, malha_branca


def _linha(cor, rolo, peso):
    return {"id_cor": cor.id_cor, "id_insumo_tecido": rolo.id_insumo, "peso_kg": peso}


def _abrir_duas_cores(client, db):
    modelo, preto, branco, mp, mb = _cenario(db)
    op = client.post(URL, json={"id_modelo": modelo.id_modelo, "cores": [
        _linha(preto, mp, "10.000"), _linha(branco, mb, "8.000")]}).json()
    return modelo, preto, branco, op


def _corte(cor, modelo, rotulo, quantidade):
    return {"id_cor": cor.id_cor, "id_tamanho": tamanho(modelo, rotulo).id_tamanho, "quantidade": quantidade}


def test_op_com_duas_cores_baixa_os_dois_rolos(client, db):
    modelo, preto, branco, mp, mb = _cenario(db)
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "cores": [
        _linha(preto, mp, "10.000"), _linha(branco, mb, "8.000")]})
    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["legada"] is False
    assert Decimal(corpo["peso_malha_enviado_kg"]) == Decimal("18.000")
    assert corpo["pecas_planejadas"] == 100
    assert [c["nome_cor"] for c in corpo["cores"]] == ["Preto", "Branco"]
    assert [t["rotulo"] for t in corpo["tamanhos"]] == ["P", "M", "G", "GG"]
    db.refresh(mp)
    db.refresh(mb)
    assert (mp.saldo_atual, mb.saldo_atual) == (Decimal("20.000"), Decimal("12.000"))


def test_rolo_sem_saldo_recusa_e_nao_baixa(client, db):
    modelo, preto, _, mp, _ = _cenario(db)
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "cores": [_linha(preto, mp, "31.000")]})
    assert resposta.status_code == 400
    assert "MALHA-PRETA" in resposta.json()["detail"]
    db.refresh(mp)
    assert mp.saldo_atual == Decimal("30.000")


def test_cor_repetida_no_enfesto_retorna_400(client, db):
    modelo, preto, _, mp, _ = _cenario(db)
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "cores": [
        _linha(preto, mp, "5.000"), _linha(preto, mp, "5.000")]})
    assert resposta.status_code == 400


def test_corpo_antigo_usa_a_cor_ligada_ao_rolo(client, db):
    modelo, _, _, mp, _ = _cenario(db)
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "id_insumo_tecido": mp.id_insumo,
                                      "peso_malha_enviado_kg": "9.000"})
    assert resposta.status_code == 201
    assert resposta.json()["cores"][0]["nome_cor"] == "Preto"


def test_corpo_antigo_com_rolo_sem_cor_pede_a_cor(client, db):
    modelo = criar_modelo(db)
    rolo = criar_insumo(db, codigo="MALHA-X")
    resposta = client.post(URL, json={"id_modelo": modelo.id_modelo, "id_insumo_tecido": rolo.id_insumo,
                                      "peso_malha_enviado_kg": "9.000"})
    assert resposta.status_code == 400
    assert "Informe a cor" in resposta.json()["detail"]


def test_corte_por_sku_grava_linhas_e_rendimentos(client, db):
    modelo, preto, branco, op = _abrir_duas_cores(client, db)
    resposta = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [
        _corte(preto, modelo, "P", 20), _corte(preto, modelo, "M", 35),
        _corte(branco, modelo, "M", 44), _corte(branco, modelo, "G", 0)]})
    assert resposta.status_code == 200
    corpo = resposta.json()
    assert corpo["pecas_reais_cortadas"] == 99
    assert Decimal(corpo["rendimento_real_pecas_kg"]) == Decimal("5.50")
    por_cor = {c["nome_cor"]: c for c in corpo["cores"]}
    assert (por_cor["Preto"]["pecas_cortadas"], Decimal(por_cor["Preto"]["rendimento"])) == (55, Decimal("5.50"))
    assert (por_cor["Branco"]["pecas_cortadas"], Decimal(por_cor["Branco"]["rendimento"])) == (44, Decimal("5.50"))
    assert [(c["nome_cor"], c["rotulo"], c["cortado"], c["disponivel"]) for c in corpo["cortes"]] == [
        ("Branco", "M", 44, 44), ("Preto", "P", 20, 20), ("Preto", "M", 35, 35)]


def test_corte_com_cor_fora_da_op_ou_tamanho_fora_da_grade_retorna_400(client, db):
    modelo, preto, _, op = _abrir_duas_cores(client, db)
    azul = criar_cor(db, "Azul", "#0000FF")
    infantil = criar_grade(db, nome="Infantil", rotulos=("2",))
    cor_fora = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [_corte(azul, modelo, "P", 5)]})
    tamanho_fora = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [
        {"id_cor": preto.id_cor, "id_tamanho": infantil.tamanhos[0].id_tamanho, "quantidade": 5}]})
    assert (cor_fora.status_code, tamanho_fora.status_code) == (400, 400)


def test_corte_vazio_retorna_400(client, db):
    modelo, preto, _, op = _abrir_duas_cores(client, db)
    resposta = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [_corte(preto, modelo, "P", 0)]})
    assert resposta.status_code == 400


def test_refazer_corte_antes_do_envio_substitui_e_depois_do_envio_e_409(client, db):
    modelo, preto, _, op = _abrir_duas_cores(client, db)
    client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [_corte(preto, modelo, "P", 20)]})
    refeito = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [
        _corte(preto, modelo, "P", 18), _corte(preto, modelo, "M", 4)]})
    assert refeito.status_code == 200
    assert refeito.json()["pecas_reais_cortadas"] == 22
    assert db.query(CamisetaOpCorte).count() == 2
    criar_remessa(db, db.get(CamisetaOrdemProducao, op["id_op"]), quantidade=5)
    depois_do_envio = client.put(f"{URL}{op['id_op']}/finalizar-corte", json={"cortes": [_corte(preto, modelo, "P", 1)]})
    assert depois_do_envio.status_code == 409


def test_op_legada_aceita_o_corpo_antigo(client, db):
    modelo = criar_modelo(db)
    op = criar_op_cortada(db, modelo, pecas=100, peso="20.000")
    resposta = client.put(f"{URL}{op.id_op}/finalizar-corte", json={"pecas_reais_cortadas": 120})
    assert resposta.status_code == 200
    assert resposta.json()["legada"] is True
    assert Decimal(resposta.json()["rendimento_real_pecas_kg"]) == Decimal("6.00")
