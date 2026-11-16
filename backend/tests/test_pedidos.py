from datetime import date, datetime, timedelta

from app.core.config import FUSO_HORARIO
from app.models.camisetas_sku import CamisetaMovimentoEstoque
from tests.fabricas import (
    criar_cliente,
    criar_cor,
    criar_estampa_teste,
    criar_modelo,
    criar_pedido,
    criar_pedido_com_itens,
    criar_variacao,
    tamanho,
)


def hoje():
    return datetime.now(FUSO_HORARIO).date()


def _cenario(db, saldo_p=10, saldo_m=5):
    modelo, preto = criar_modelo(db), criar_cor(db)
    p = criar_variacao(db, modelo, preto, "P", saldo=saldo_p)
    m = criar_variacao(db, modelo, preto, "M", saldo=saldo_m)
    return p, m, criar_pedido_com_itens(db, modelo, preto, {"P": 4, "M": 5})


def _entregar(client, pedido, **corpo):
    return client.post(f"/camisetas/pedidos/{pedido.id_pedido}/entregar", json=corpo)


def _reverter(client, pedido):
    return client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Aguardando Produção"})


def test_mudar_para_entregue_pelo_status_e_bloqueado(client, db):
    pedido = criar_pedido(db, criar_modelo(db))
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Entregue"})
    assert resposta.status_code == 400
    assert "Registrar entrega" in resposta.json()["detail"]


def test_status_invalido_retorna_400(client, db):
    pedido = criar_pedido(db, criar_modelo(db))
    resposta = client.put(f"/camisetas/pedidos/{pedido.id_pedido}/status", json={"status_pedido": "Qualquer"})
    assert resposta.status_code == 400


def test_entregar_grava_data_e_baixa_cada_sku(client, db):
    p, m, pedido = _cenario(db)
    ontem = hoje() - timedelta(days=1)
    resposta = _entregar(client, pedido, data_entrega=ontem.isoformat())
    assert resposta.status_code == 200
    assert resposta.json()["data_entrega_realizada"] == ontem.isoformat()
    db.refresh(p)
    db.refresh(m)
    assert (p.saldo, m.saldo) == (6, 0)
    movimentos = db.query(CamisetaMovimentoEstoque).order_by(CamisetaMovimentoEstoque.id_movimento).all()
    assert [(mv.tipo, mv.quantidade, mv.id_pedido) for mv in movimentos] == [
        ("SAIDA_ENTREGA", -4, pedido.id_pedido), ("SAIDA_ENTREGA", -5, pedido.id_pedido)]


def test_entregar_sem_data_usa_hoje(client, db):
    _, _, pedido = _cenario(db)
    assert _entregar(client, pedido).json()["data_entrega_realizada"] == hoje().isoformat()


def test_entregar_com_data_futura_retorna_400(client, db):
    _, _, pedido = _cenario(db)
    assert _entregar(client, pedido, data_entrega=(hoje() + timedelta(days=1)).isoformat()).status_code == 400


def test_entregar_com_falta_retorna_409_com_a_lista_e_nao_baixa(client, db):
    p, m, pedido = _cenario(db, saldo_m=2)
    resposta = _entregar(client, pedido)
    assert resposta.status_code == 409
    detalhe = resposta.json()["detail"]
    assert detalhe["mensagem"] == "Estoque pronto insuficiente para este pedido."
    assert detalhe["faltas"] == [
        {"id_variacao": m.id_variacao, "sku": "Camiseta Básica · Preto · M", "necessario": 5, "disponivel": 2}]
    db.refresh(p)
    assert p.saldo == 10
    assert db.query(CamisetaMovimentoEstoque).count() == 0


def test_sku_que_nunca_teve_estoque_aparece_na_falta(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    pedido = criar_pedido_com_itens(db, modelo, preto, {"GG": 3})
    faltas = _entregar(client, pedido).json()["detail"]["faltas"]
    assert faltas == [{"id_variacao": None, "sku": "Camiseta Básica · Preto · GG", "necessario": 3, "disponivel": 0}]


def test_entregar_item_sem_cor_retorna_400(client, db):
    pedido = criar_pedido_com_itens(db, criar_modelo(db), None, {"P": 2})
    resposta = _entregar(client, pedido)
    assert resposta.status_code == 400
    assert "Defina a cor" in resposta.json()["detail"]


def test_pedido_sem_itens_nao_pode_ser_entregue(client, db):
    assert _entregar(client, criar_pedido(db, criar_modelo(db))).status_code == 400


def test_reverter_entrega_devolve_ao_estoque_e_limpa_a_data(client, db):
    p, m, pedido = _cenario(db)
    _entregar(client, pedido)
    resposta = _reverter(client, pedido)
    assert resposta.status_code == 200
    assert resposta.json()["data_entrega_realizada"] is None
    db.refresh(p)
    db.refresh(m)
    assert (p.saldo, m.saldo) == (10, 5)
    estornos = db.query(CamisetaMovimentoEstoque).filter_by(tipo="ESTORNO_ENTREGA").all()
    assert sorted(e.quantidade for e in estornos) == [4, 5]


def test_entregar_de_novo_depois_de_reverter(client, db):
    p, m, pedido = _cenario(db)
    _entregar(client, pedido)
    _reverter(client, pedido)
    assert _entregar(client, pedido).status_code == 200
    db.refresh(p)
    db.refresh(m)
    assert (p.saldo, m.saldo) == (6, 0)


def test_reverter_pedido_entregue_antes_da_fase_1b_nao_mexe_no_estoque(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    variacao = criar_variacao(db, modelo, preto, "P", saldo=7)
    pedido = criar_pedido_com_itens(db, modelo, None, {"P": 4}, status="Entregue", data_entrega_realizada=date(2026, 10, 5))
    assert _reverter(client, pedido).status_code == 200
    db.refresh(variacao)
    assert variacao.saldo == 7
    assert db.query(CamisetaMovimentoEstoque).count() == 0


def test_grade_negativa_e_recusada(client, db):
    modelo = criar_modelo(db)
    resposta = client.post("/camisetas/pedidos/", json={
        "nome_cliente": "Loja", "id_modelo": modelo.id_modelo,
        "grade_p": -5, "grade_m": 10, "grade_g": 0, "grade_gg": 0,
        "prazo_entrega": (hoje() + timedelta(days=3)).isoformat(), "valor_total": "100",
    })
    assert resposta.status_code == 422


def test_entrega_consolida_necessidade_por_sku_entre_itens_com_estampas_diferentes(client, db):
    modelo, preto, cliente = criar_modelo(db), criar_cor(db), criar_cliente(db)
    est1 = criar_estampa_teste(db, nome="Arte 1", codigo="EST-1")
    est2 = criar_estampa_teste(db, nome="Arte 2", codigo="EST-2")
    var_m = criar_variacao(db, modelo, preto, "M", saldo=10)
    id_m = tamanho(modelo, "M").id_tamanho

    resp_ped = client.post("/camisetas/pedidos/", json={
        "id_cliente": cliente.id_cliente,
        "prazo_entrega": hoje().isoformat(),
        "valor_total": "1000.00",
        "itens": [
            {"id_modelo": modelo.id_modelo, "id_cor": preto.id_cor, "id_estampa": est1.id_estampa,
             "quantidades": [{"id_tamanho": id_m, "quantidade": 6}]},
            {"id_modelo": modelo.id_modelo, "id_cor": preto.id_cor, "id_estampa": est2.id_estampa,
             "quantidades": [{"id_tamanho": id_m, "quantidade": 7}]},
        ],
    })
    assert resp_ped.status_code == 201
    id_pedido = resp_ped.json()["id_pedido"]

    # Juntos pedem 13 peças M, mas o saldo é 10 -> deve recusar com 409 apontando necessário=13, disponível=10
    falha = client.post(f"/camisetas/pedidos/{id_pedido}/entregar", json={})
    assert falha.status_code == 409
    assert falha.json()["detail"]["faltas"] == [
        {"id_variacao": var_m.id_variacao, "sku": "Camiseta Básica · Preto · M", "necessario": 13, "disponivel": 10}
    ]
    db.refresh(var_m)
    assert var_m.saldo == 10

