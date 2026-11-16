from datetime import datetime, timedelta

from app.core.config import FUSO_HORARIO
from tests.fabricas import (
    criar_cliente,
    criar_cor,
    criar_estampa_teste,
    criar_modelo,
    criar_pedido_com_itens,
    tamanho,
)


def hoje():
    return datetime.now(FUSO_HORARIO).date()


def test_pedido_e_cliente_expoem_tokens_do_portal(client, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    resp_cli = client.post("/camisetas/clientes/", json={"nome": "Loja Portal"}).json()
    assert resp_cli["token_portal"] and len(resp_cli["token_portal"]) >= 20

    resp_ped = client.post("/camisetas/pedidos/", json={
        "id_cliente": resp_cli["id_cliente"],
        "prazo_entrega": hoje().isoformat(),
        "valor_total": "800.00",
        "itens": [{
            "id_modelo": modelo.id_modelo,
            "id_cor": preto.id_cor,
            "quantidades": [{"id_tamanho": tamanho(modelo, "M").id_tamanho, "quantidade": 10}],
        }],
    }).json()
    assert resp_ped["token_aprovacao"] and len(resp_ped["token_aprovacao"]) >= 20
    assert resp_ped["status_aprovacao_cliente"] == "Pendente"


def test_portal_pedido_visualizar_e_aprovar_sem_login(client_sem_login, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    est = criar_estampa_teste(db, nome="Arte Sol", codigo="EST-SOL")
    pedido = criar_pedido_com_itens(db, modelo, preto, {"P": 5, "M": 10})
    pedido.itens[0].id_estampa = est.id_estampa
    pedido.itens[0].posicao_estampa = "Costas"
    db.commit()
    db.refresh(pedido)

    assert client_sem_login.get("/portal/pedido/token-inexistente").status_code == 404

    resp_ver = client_sem_login.get(f"/portal/pedido/{pedido.token_aprovacao}")
    assert resp_ver.status_code == 200
    dados = resp_ver.json()
    assert dados["codigo_pedido"] == pedido.codigo_pedido
    assert dados["itens"][0]["nome_estampa"] == "Arte Sol"
    assert dados["itens"][0]["posicao_estampa"] == "Costas"
    assert dados["status_aprovacao_cliente"] == "Pendente"

    # Solicitar ajuste sem observação deve falhar com 400
    falha_ajuste = client_sem_login.post(
        f"/portal/pedido/{pedido.token_aprovacao}/responder",
        json={"decisao": "Ajuste Solicitado", "observacao_cliente": "   "},
    )
    assert falha_ajuste.status_code == 400

    # Solicitar ajuste com observação funciona
    resp_ajuste = client_sem_login.post(
        f"/portal/pedido/{pedido.token_aprovacao}/responder",
        json={"decisao": "Ajuste Solicitado", "observacao_cliente": "Trocar 5 P por 5 G"},
    )
    assert resp_ajuste.status_code == 200
    assert resp_ajuste.json()["status_aprovacao_cliente"] == "Ajuste Solicitado"
    assert resp_ajuste.json()["observacao_cliente"] == "Trocar 5 P por 5 G"

    # Aprovar funciona e preenche data de aprovação
    resp_ok = client_sem_login.post(
        f"/portal/pedido/{pedido.token_aprovacao}/responder",
        json={"decisao": "Aprovado", "observacao_cliente": "Aprovado, pode produzir!"},
    )
    assert resp_ok.status_code == 200
    corpo_ok = resp_ok.json()
    assert corpo_ok["status_aprovacao_cliente"] == "Aprovado"
    assert corpo_ok["aprovado_pelo_cliente_em"] is not None


def test_portal_pedido_entregue_nao_aceita_nova_resposta(client_sem_login, db):
    modelo, preto = criar_modelo(db), criar_cor(db)
    pedido = criar_pedido_com_itens(db, modelo, preto, {"P": 5}, status="Entregue")
    resp = client_sem_login.post(
        f"/portal/pedido/{pedido.token_aprovacao}/responder",
        json={"decisao": "Aprovado"},
    )
    assert resp.status_code == 409


def test_portal_cliente_catalogo_e_montar_pedido_pelo_celular(client_sem_login, db):
    modelo = criar_modelo(db, nome="Oversized Street")
    preto = criar_cor(db, "Preto", "#1F1F1F")
    criar_cor(db, "Inativa", "#999999", ativo=False)
    est = criar_estampa_teste(db, nome="Dragão Oriental", codigo="EST-DRG")
    criar_estampa_teste(db, nome="Arte Antiga", codigo="EST-OLD", ativo=False)
    cliente = criar_cliente(db, nome="Boutique Jovem")

    resp_cat = client_sem_login.get(f"/portal/cliente/{cliente.token_portal}")
    assert resp_cat.status_code == 200
    cat = resp_cat.json()
    assert cat["nome_cliente"] == "Boutique Jovem"
    assert [c["nome"] for c in cat["cores"]] == ["Preto"]
    assert [e["codigo"] for e in cat["estampas"]] == ["EST-DRG"]
    assert len(cat["modelos"]) == 1

    # Cliente monta o pedido pelo celular
    prazo = (hoje() + timedelta(days=7)).isoformat()
    resp_criar = client_sem_login.post(
        f"/portal/cliente/{cliente.token_portal}/pedidos",
        json={
            "prazo_entrega": prazo,
            "observacoes": "Pedido enviado pelo celular",
            "itens": [{
                "id_modelo": modelo.id_modelo,
                "id_cor": preto.id_cor,
                "id_estampa": est.id_estampa,
                "posicao_estampa": "Frente",
                "quantidades": [
                    {"id_tamanho": tamanho(modelo, "M").id_tamanho, "quantidade": 12},
                    {"id_tamanho": tamanho(modelo, "G").id_tamanho, "quantidade": 8},
                ],
            }],
        },
    )
    assert resp_criar.status_code == 201
    criado = resp_criar.json()
    assert criado["nome_cliente"] == "Boutique Jovem"
    assert criado["quantidade_total"] == 20
    assert criado["status_aprovacao_cliente"] == "Aprovado"
    assert criado["itens"][0]["nome_estampa"] == "Dragão Oriental"


def test_portal_cliente_inativo_retorna_403(client_sem_login, db):
    inativo = criar_cliente(db, nome="Cliente Inativo", ativo=False)
    assert client_sem_login.get(f"/portal/cliente/{inativo.token_portal}").status_code == 403
