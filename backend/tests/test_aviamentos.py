from decimal import Decimal
from types import SimpleNamespace

from app.models.camisetas import CamisetaCosturaFaccao
from app.services.camisetas.estoque import AVISO_SEM_AVIAMENTOS, calcular_necessidades, listar_faltas
from tests.fabricas import criar_insumo, criar_item_ficha, criar_modelo, criar_op_cortada


def insumo_falso(id_insumo, saldo):
    return SimpleNamespace(
        id_insumo=id_insumo, codigo=f"AV-{id_insumo}", tipo_malha_ou_aviamento=f"Aviamento {id_insumo}",
        unidade_medida="unidades", saldo_atual=Decimal(saldo),
    )


def item(insumo, consumo):
    return SimpleNamespace(insumo=insumo, consumo_unitario=Decimal(consumo))


def test_necessidade_inclui_a_margem():
    [necessidade] = calcular_necessidades([item(insumo_falso(1, "10"), "0.02")], 100, Decimal("3"))
    assert necessidade.quantidade == Decimal("2.060")


def test_soma_itens_do_mesmo_insumo():
    etiqueta = insumo_falso(2, "500")
    [necessidade] = calcular_necessidades([item(etiqueta, "1"), item(etiqueta, "1")], 10, Decimal("0"))
    assert necessidade.quantidade == Decimal("20.000")


def test_ignora_itens_sem_insumo_no_estoque():
    assert calcular_necessidades([item(None, "1")], 10, Decimal("3")) == []


def test_lista_faltas_com_necessario_e_disponivel():
    [falta] = listar_faltas(calcular_necessidades([item(insumo_falso(1, "1"), "0.03")], 100, Decimal("3")))
    assert falta.necessario == Decimal("3.090")
    assert falta.disponivel == Decimal("1")


def _cenario(db, saldo_etiqueta="500"):
    modelo = criar_modelo(db)
    tecido = criar_insumo(db, codigo="MALHA-01", saldo="50.000")
    linha = criar_insumo(db, codigo="AV-LINHA-01", categoria="AVIAMENTO", nome="Linha 120", unidade="unidades", saldo="10.000")
    etiqueta = criar_insumo(db, codigo="AV-ETIQ-01", categoria="AVIAMENTO", nome="Etiqueta", unidade="unidades", saldo=saldo_etiqueta)
    criar_item_ficha(db, modelo, tecido, tipo="Tecido Principal", consumo="0.1800", unidade="kg")
    criar_item_ficha(db, modelo, linha, tipo="Linha de Costura", consumo="0.0200")
    criar_item_ficha(db, modelo, etiqueta, tipo="Etiqueta", consumo="1.0000")
    op = criar_op_cortada(db, modelo, pecas=100, tecido=tecido)
    return op, tecido, linha, etiqueta


def _enviar(client, op, **extra):
    return client.post("/camisetas/costura/enviar", json={
        "id_op": op.id_op, "nome_faccao": "Facção Maria", "quantidade_enviada": 100,
        "margem_seguranca_aviamentos_percentual": "3", **extra,
    })


def test_envio_com_saldo_baixa_aviamentos_com_margem_e_nao_mexe_no_tecido(client, db):
    op, tecido, linha, etiqueta = _cenario(db)
    resposta = _enviar(client, op)
    assert resposta.status_code == 201
    assert resposta.json()["avisos"] == []
    for insumo in (tecido, linha, etiqueta):
        db.refresh(insumo)
    assert linha.saldo_atual == Decimal("7.940")
    assert etiqueta.saldo_atual == Decimal("397.000")
    assert tecido.saldo_atual == Decimal("50.000")


def test_envio_com_falta_sem_confirmacao_retorna_409_e_nao_baixa(client, db):
    op, _, linha, etiqueta = _cenario(db, saldo_etiqueta="50")
    resposta = _enviar(client, op)
    assert resposta.status_code == 409
    faltas = resposta.json()["detail"]["faltas"]
    assert [f["codigo"] for f in faltas] == ["AV-ETIQ-01"]
    assert faltas[0]["necessario"] == 103.0
    db.refresh(etiqueta)
    assert etiqueta.saldo_atual == Decimal("50.000")
    assert db.query(CamisetaCosturaFaccao).count() == 0


def test_envio_com_falta_confirmado_baixa_e_saldo_fica_negativo(client, db):
    op, _, _, etiqueta = _cenario(db, saldo_etiqueta="50")
    resposta = _enviar(client, op, confirmar_saldo_insuficiente=True)
    assert resposta.status_code == 201
    db.refresh(etiqueta)
    assert etiqueta.saldo_atual == Decimal("-53.000")


def test_modelo_sem_aviamentos_gera_aviso_e_nao_baixa_nada(client, db):
    modelo = criar_modelo(db)
    avulso = criar_insumo(db, codigo="AV-01", categoria="AVIAMENTO", nome="Tag", unidade="unidades", saldo="100.000")
    op = criar_op_cortada(db, modelo, pecas=100)
    resposta = _enviar(client, op)
    assert resposta.status_code == 201
    assert resposta.json()["avisos"] == [AVISO_SEM_AVIAMENTOS]
    db.refresh(avulso)
    assert avulso.saldo_atual == Decimal("100.000")
