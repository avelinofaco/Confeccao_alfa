"""Testes da Fase 6: Reserva de peças por pedido em Produtos Prontos e vínculo Pedido → OP."""
from tests.fabricas import (
    criar_cor,
    criar_insumo,
    criar_modelo,
    criar_pedido_com_itens,
    criar_variacao,
)

URL_PRONTOS = "/camisetas/produtos-prontos"
URL_ORDENS = "/camisetas/ordens"
URL_PEDIDOS = "/camisetas/pedidos"


def test_produtos_prontos_calcula_reserva_disponivel_e_falta_produzir(client, db):
    modelo = criar_modelo(db)
    preto = criar_cor(db, "Preto", "#1F1F1F")
    criar_variacao(db, modelo, preto, "P", saldo=10)
    criar_variacao(db, modelo, preto, "M", saldo=3)
    # Pedido aberto pede 4 P e 8 M de Preto
    criar_pedido_com_itens(db, modelo, preto, {"P": 4, "M": 8}, codigo="PED-2026-0001")

    linhas = client.get(f"{URL_PRONTOS}/").json()
    assert len(linhas) == 1
    linha = linhas[0]
    assert linha["total"] == 13
    assert linha["total_reservado"] == 12
    assert linha["total_disponivel"] == 6  # P tem 6 livres, M tem 0 livres
    assert linha["total_falta_produzir"] == 5  # P falta 0, M falta 5

    por_rotulo = {c["rotulo"]: c for c in linha["tamanhos"]}
    assert por_rotulo["P"]["saldo"] == 10
    assert por_rotulo["P"]["reservado"] == 4
    assert por_rotulo["P"]["disponivel"] == 6
    assert por_rotulo["P"]["falta_produzir"] == 0

    assert por_rotulo["M"]["saldo"] == 3
    assert por_rotulo["M"]["reservado"] == 8
    assert por_rotulo["M"]["disponivel"] == 0
    assert por_rotulo["M"]["falta_produzir"] == 5


def test_produtos_prontos_exibe_linha_com_pedido_aberto_mesmo_sem_variacao(client, db):
    modelo = criar_modelo(db)
    azul = criar_cor(db, "Azul Marinho", "#1B2A4A")
    # Nenhuma CamisetaVariacao criada ainda, mas há pedido em aberto
    criar_pedido_com_itens(db, modelo, azul, {"G": 7}, codigo="PED-2026-0002")

    linhas = client.get(f"{URL_PRONTOS}/").json()
    assert len(linhas) == 1
    linha = linhas[0]
    assert linha["nome_cor"] == "Azul Marinho"
    assert linha["total"] == 0
    assert linha["total_reservado"] == 7
    assert linha["total_disponivel"] == 0
    assert linha["total_falta_produzir"] == 7

    g_celula = next(c for c in linha["tamanhos"] if c["rotulo"] == "G")
    assert g_celula["id_variacao"] is None
    assert g_celula["saldo"] == 0
    assert g_celula["reservado"] == 7
    assert g_celula["disponivel"] == 0
    assert g_celula["falta_produzir"] == 7


def test_pedido_entregue_nao_entra_na_reserva(client, db):
    modelo = criar_modelo(db)
    preto = criar_cor(db, "Preto", "#1F1F1F")
    criar_variacao(db, modelo, preto, "P", saldo=10)
    criar_pedido_com_itens(db, modelo, preto, {"P": 4}, codigo="PED-2026-0003", status="Entregue")

    linhas = client.get(f"{URL_PRONTOS}/").json()
    assert len(linhas) == 1
    p_celula = next(c for c in linhas[0]["tamanhos"] if c["rotulo"] == "P")
    assert p_celula["reservado"] == 0
    assert p_celula["disponivel"] == 10
    assert p_celula["falta_produzir"] == 0


def test_abrir_op_vinculada_a_pedido_atualiza_status_para_em_producao(client, db):
    modelo = criar_modelo(db)
    preto = criar_cor(db, "Preto", "#1F1F1F")
    rolo = criar_insumo(db, codigo="MALHA-PRETA", cor=preto, saldo="50.000")
    pedido = criar_pedido_com_itens(
        db, modelo, preto, {"P": 5, "M": 5}, codigo="PED-2026-0010", status="Aguardando Produção"
    )

    resp = client.post(
        f"{URL_ORDENS}/",
        json={
            "id_modelo": modelo.id_modelo,
            "id_pedido": pedido.id_pedido,
            "cores": [{"id_cor": preto.id_cor, "id_insumo_tecido": rolo.id_insumo, "peso_kg": "10.000"}],
        },
    )
    assert resp.status_code == 201
    dados = resp.json()
    assert dados["id_pedido"] == pedido.id_pedido
    assert dados["codigo_pedido"] == "PED-2026-0010"
    assert dados["nome_cliente_pedido"] == "Cliente Teste"

    db.refresh(pedido)
    assert pedido.status_pedido == "Em Produção"


def test_abrir_op_rejeita_pedido_inexistente_ou_entregue(client, db):
    modelo = criar_modelo(db)
    preto = criar_cor(db, "Preto", "#1F1F1F")
    rolo = criar_insumo(db, codigo="MALHA-PRETA", cor=preto, saldo="50.000")
    pedido_entregue = criar_pedido_com_itens(
        db, modelo, preto, {"P": 2}, codigo="PED-2026-0011", status="Entregue"
    )

    r_404 = client.post(
        f"{URL_ORDENS}/",
        json={
            "id_modelo": modelo.id_modelo,
            "id_pedido": 99999,
            "cores": [{"id_cor": preto.id_cor, "id_insumo_tecido": rolo.id_insumo, "peso_kg": "5.000"}],
        },
    )
    assert r_404.status_code == 404

    r_400 = client.post(
        f"{URL_ORDENS}/",
        json={
            "id_modelo": modelo.id_modelo,
            "id_pedido": pedido_entregue.id_pedido,
            "cores": [{"id_cor": preto.id_cor, "id_insumo_tecido": rolo.id_insumo, "peso_kg": "5.000"}],
        },
    )
    assert r_400.status_code == 400
