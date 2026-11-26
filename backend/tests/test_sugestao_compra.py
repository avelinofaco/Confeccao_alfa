"""Sugestão de compra de insumos a partir dos pedidos que vão entrar em produção.

O recorte é diferente para cada insumo porque o momento do consumo é diferente:
tecido é baixado em `abrir_op()` (criação da OP) e aviamento em `enviar_remessa()`
(envio à facção). Ver docs/superpowers/specs/2026-11-26-sugestao-compra-insumos-design.md
"""
from decimal import Decimal

import pytest

from app.services.camisetas.sugestao_compra import sugerir_compra
from tests.fabricas import (
    criar_cor,
    criar_insumo,
    criar_item_ficha,
    criar_modelo,
    criar_op_aberta,
    criar_op_cortada,
    criar_pedido_com_itens,
    criar_remessa,
)

MARGEM = Decimal("5")


def linha_do_insumo(linhas, insumo):
    return next((linha for linha in linhas if linha.id_insumo == insumo.id_insumo), None)


# ----------------- tecido -----------------

def test_tecido_de_pedido_aguardando_producao_entra_na_sugestao(db):
    # Arrange: 100 peças de um modelo que gasta 0,2 kg por peça, sem rolo em estoque
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    malha = criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", custo="30.00", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"P": 25, "M": 25, "G": 25, "GG": 25})

    # Act
    sugestao = sugerir_compra(db, MARGEM)

    # Assert: 100 × 0,2 = 20 kg, + 5% de margem (veio do cadastro, não do rendimento real)
    linha = linha_do_insumo(sugestao.tecidos, malha)
    assert linha is not None
    assert linha.necessario == Decimal("21.000")
    assert linha.comprar == Decimal("21.000")
    assert linha.pecas == 100


def test_tecido_de_pedido_que_ja_tem_op_nao_entra(db):
    """`abrir_op()` já subtraiu o peso do rolo: contar aqui seria contar duas vezes."""
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    malha = criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", cor=preto)
    pedido = criar_pedido_com_itens(db, modelo, preto, {"M": 100}, status="Em Produção")
    criar_op_aberta(db, modelo, pedido=pedido, tecido=malha)

    sugestao = sugerir_compra(db, MARGEM)

    assert linha_do_insumo(sugestao.tecidos, malha) is None


def test_kg_por_peca_vem_do_rendimento_real_quando_ha_op_cortada(db):
    """OP cortada com 100 peças em 25 kg = 4 peças/kg, ou seja 0,25 kg/peça.

    O cadastro diz 0,20. O rendimento real manda, e sem margem: a perda do enfesto
    já está dentro dele.
    """
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    malha = criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", cor=preto)
    criar_op_cortada(db, modelo, codigo="OP-HIST", pecas=100, peso="25.000", tecido=malha)
    criar_pedido_com_itens(db, modelo, preto, {"M": 200}, codigo="PED-NOVO")

    sugestao = sugerir_compra(db, MARGEM)

    # 200 / 4 peças por kg = 50 kg, sem margem
    assert linha_do_insumo(sugestao.tecidos, malha).necessario == Decimal("50.000")


def test_sem_historico_de_corte_usa_o_cadastro_e_avisa(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, nome="Camiseta Nova", consumo_kg="0.2000")
    criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    sugestao = sugerir_compra(db, MARGEM)

    assert any("Camiseta Nova" in a and "rendimento" in a.lower() for a in sugestao.alertas)


def test_item_sem_cor_nao_entra_no_tecido_e_gera_alerta(db):
    """Não se compra malha sem saber a cor."""
    modelo = criar_modelo(db, consumo_kg="0.2000")
    criar_insumo(db, codigo="MALHA-01", saldo="0.000", minimo="0.000")
    criar_pedido_com_itens(db, modelo, None, {"M": 100}, codigo="PED-SEM-COR")

    sugestao = sugerir_compra(db, MARGEM)

    assert sugestao.tecidos == []
    assert any("PED-SEM-COR" in a for a in sugestao.alertas)


def test_cor_sem_rolo_cadastrado_gera_alerta(db):
    verde = criar_cor(db, nome="Verde Militar")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    criar_pedido_com_itens(db, modelo, verde, {"M": 50})

    sugestao = sugerir_compra(db, MARGEM)

    assert any("Verde Militar" in a for a in sugestao.alertas)


# ----------------- aviamentos -----------------

def test_aviamento_de_pedido_em_producao_sem_remessa_entra(db):
    """O aviamento só é baixado no envio à facção, então ainda precisa ser comprado."""
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    etiqueta = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta",
                            unidade="unidades", saldo="0.000", minimo="0.000", custo="0.10")
    criar_item_ficha(db, modelo, insumo=etiqueta, tipo="Etiqueta", consumo="1.0000")
    pedido = criar_pedido_com_itens(db, modelo, preto, {"M": 100}, status="Em Produção")
    criar_op_aberta(db, modelo, pedido=pedido)

    sugestao = sugerir_compra(db, MARGEM)

    # 100 peças × 1 etiqueta × 1,05 de margem
    assert linha_do_insumo(sugestao.aviamentos, etiqueta).necessario == Decimal("105.000")


def test_aviamento_desconta_as_pecas_ja_enviadas_a_faccao(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    etiqueta = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta",
                            unidade="unidades", saldo="0.000", minimo="0.000", custo="0.10")
    criar_item_ficha(db, modelo, insumo=etiqueta, tipo="Etiqueta", consumo="1.0000")
    pedido = criar_pedido_com_itens(db, modelo, preto, {"M": 100}, status="Em Produção")
    op = criar_op_cortada(db, modelo, pecas=100, peso="20.000", pedido=pedido)
    criar_remessa(db, op, quantidade=60)

    sugestao = sugerir_compra(db, MARGEM)

    # sobram 40 peças × 1 × 1,05
    assert linha_do_insumo(sugestao.aviamentos, etiqueta).necessario == Decimal("42.000")


def test_pedido_todo_enviado_nao_pede_mais_aviamento(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    etiqueta = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta",
                            unidade="unidades", saldo="0.000", minimo="0.000")
    criar_item_ficha(db, modelo, insumo=etiqueta, tipo="Etiqueta", consumo="1.0000")
    pedido = criar_pedido_com_itens(db, modelo, preto, {"M": 100}, status="Em Produção")
    op = criar_op_cortada(db, modelo, pecas=100, peso="20.000", pedido=pedido)
    criar_remessa(db, op, quantidade=100)

    sugestao = sugerir_compra(db, MARGEM)

    assert linha_do_insumo(sugestao.aviamentos, etiqueta) is None


def test_item_de_ficha_sem_insumo_ligado_e_ignorado(db):
    """Ficha solta, sem vínculo com o estoque, não tem o que comprar."""
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    criar_item_ficha(db, modelo, insumo=None, tipo="Linha de Costura", consumo="0.0200")
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    sugestao = sugerir_compra(db, MARGEM)

    assert sugestao.aviamentos == []


# ----------------- quanto comprar e quanto custa -----------------

def test_comprar_desconta_saldo_e_mantem_o_estoque_minimo_como_piso(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    # necessário 20 kg (+5% = 21), saldo 8, mínimo 5 -> comprar 21 - 8 + 5 = 18
    malha = criar_insumo(db, codigo="MALHA-PRETA", saldo="8.000", minimo="5.000", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).tecidos, malha)

    assert linha.necessario == Decimal("21.000")
    assert linha.saldo_atual == Decimal("8.000")
    assert linha.estoque_minimo == Decimal("5.000")
    assert linha.comprar == Decimal("18.000")


def test_comprar_nunca_e_negativo_quando_o_saldo_cobre(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    malha = criar_insumo(db, codigo="MALHA-PRETA", saldo="500.000", minimo="0.000", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    assert linha_do_insumo(sugerir_compra(db, MARGEM).tecidos, malha).comprar == Decimal("0.000")


def test_preco_usa_o_custo_medio_quando_existe(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    malha = criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", custo="30.00", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).tecidos, malha)

    assert linha.origem_preco == "custo médio"
    assert linha.preco_referencia == Decimal("30.00")
    assert linha.custo_estimado == Decimal("630.00")  # 21 kg × 30


def test_preco_cai_para_o_estimado_da_ficha_quando_nao_ha_custo_medio(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    etiqueta = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta",
                            unidade="unidades", saldo="0.000", minimo="0.000", custo="0.00")
    ficha = criar_item_ficha(db, modelo, insumo=etiqueta, tipo="Etiqueta", consumo="1.0000")
    ficha.custo_unitario_estimado = Decimal("0.25")
    db.commit()
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.origem_preco == "estimado na ficha"
    assert linha.custo_estimado == Decimal("26.25")  # 105 × 0,25


def test_insumo_sem_preco_nenhum_gera_alerta(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", custo="0.00", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    sugestao = sugerir_compra(db, MARGEM)

    assert sugestao.tecidos[0].origem_preco == "sem preço"
    assert any("MALHA-PRETA" in a and "preço" in a.lower() for a in sugestao.alertas)


def test_total_estimado_e_a_soma_das_linhas(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", custo="30.00", cor=preto)
    etiqueta = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta",
                            unidade="unidades", saldo="0.000", minimo="0.000", custo="0.10")
    criar_item_ficha(db, modelo, insumo=etiqueta, tipo="Etiqueta", consumo="1.0000")
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    sugestao = sugerir_compra(db, MARGEM)

    esperado = sum(l.custo_estimado for l in sugestao.tecidos + sugestao.aviamentos)
    assert sugestao.total_estimado == esperado
    assert sugestao.total_estimado == Decimal("640.50")  # 630 de malha + 10,50 de etiqueta


# ----------------- arredondamento para unidade de compra -----------------

def test_insumo_contado_em_unidades_arredonda_a_compra_para_cima(db):
    """Não se compra 214,5 etiquetas. Arredonda para cima: faltar material é pior que sobrar."""
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    etiqueta = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta",
                            unidade="unidades", saldo="500.000", minimo="200.000", custo="0.12")
    criar_item_ficha(db, modelo, insumo=etiqueta, tipo="Etiqueta", consumo="1.0000")
    # 490 peças × 1 × 1,05 = 514,5 necessário; 514,5 − 500 + 200 = 214,5 a comprar
    criar_pedido_com_itens(db, modelo, preto, {"M": 490})

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.necessario == Decimal("514.500")  # a necessidade real mantém a fração
    assert linha.comprar == Decimal("215")         # a compra, não
    assert linha.comprar == linha.comprar.to_integral_value()


def test_custo_estimado_acompanha_a_quantidade_arredondada(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    etiqueta = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta",
                            unidade="unidades", saldo="0.000", minimo="0.000", custo="0.10")
    criar_item_ficha(db, modelo, insumo=etiqueta, tipo="Etiqueta", consumo="1.0000")
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})  # 105 necessário -> compra 105

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.comprar == Decimal("105")
    assert linha.custo_estimado == Decimal("10.50")


def test_tecido_em_kg_mantem_as_casas_decimais(db):
    """Malha é vendida por peso: arredondar 56,027 kg para 57 kg seria pedir demais."""
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    malha = criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", custo="30.00", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).tecidos, malha)

    assert linha.comprar == Decimal("21.000")


def test_insumo_em_metros_mantem_as_casas_decimais(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    vies = criar_insumo(db, codigo="AV-VIES", categoria="AVIAMENTO", nome="Viés",
                        unidade="metros", saldo="0.000", minimo="0.000", custo="1.50")
    criar_item_ficha(db, modelo, insumo=vies, tipo="Viés", consumo="0.5000", unidade="metros")
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, vies)

    assert linha.comprar == Decimal("52.500")


def test_compra_coberta_pelo_saldo_segue_zerada_em_unidades(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    etiqueta = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta",
                            unidade="unidades", saldo="5000.000", minimo="0.000")
    criar_item_ficha(db, modelo, insumo=etiqueta, tipo="Etiqueta", consumo="1.0000")
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    assert linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta).comprar == Decimal("0")


# ----------------- embalagem fechada do fornecedor -----------------

def _cenario_etiqueta(db, embalagem=None, saldo="0.000", minimo="0.000", pecas=100, custo="0.10"):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    etiqueta = criar_insumo(db, codigo="AV-ETQ", categoria="AVIAMENTO", nome="Etiqueta de composição",
                            unidade="unidades", saldo=saldo, minimo=minimo, custo=custo)
    if embalagem is not None:
        etiqueta.embalagem_compra = Decimal(embalagem)
        db.commit()
    criar_item_ficha(db, modelo, insumo=etiqueta, tipo="Etiqueta", consumo="1.0000")
    criar_pedido_com_itens(db, modelo, preto, {"M": pecas})
    return etiqueta


def test_sem_embalagem_cadastrada_o_comportamento_nao_muda(db):
    etiqueta = _cenario_etiqueta(db, embalagem=None)

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.comprar == Decimal("105")  # 100 × 1,05, arredondado ao inteiro
    assert linha.embalagens == 0
    assert linha.sobra == Decimal("0")


def test_embalagem_zero_equivale_a_nao_ter_embalagem(db):
    etiqueta = _cenario_etiqueta(db, embalagem="0")

    assert linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta).comprar == Decimal("105")


def test_caixa_fechada_sobe_a_compra_para_o_proximo_multiplo(db):
    """Precisa de 105 etiquetas e o fornecedor só vende caixa de 1000."""
    etiqueta = _cenario_etiqueta(db, embalagem="1000")

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.necessario == Decimal("105.000")  # a necessidade real não muda
    assert linha.comprar == Decimal("1000")
    assert linha.embalagens == 1
    assert linha.sobra == Decimal("895")


def test_multiplo_exato_nao_pede_uma_embalagem_a_mais(db):
    # 1000 peças × 1 × 1,05 = 1050 -> com caixa de 1050 fecha exatamente uma
    etiqueta = _cenario_etiqueta(db, embalagem="1050", pecas=1000)

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.comprar == Decimal("1050")
    assert linha.embalagens == 1
    assert linha.sobra == Decimal("0")


def test_precisa_de_mais_de_uma_embalagem(db):
    etiqueta = _cenario_etiqueta(db, embalagem="1000", pecas=2500)

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.necessario == Decimal("2625.000")
    assert linha.comprar == Decimal("3000")
    assert linha.embalagens == 3
    assert linha.sobra == Decimal("375")


def test_custo_estimado_cobra_a_embalagem_inteira(db):
    """É o que você vai pagar: a caixa toda, não só o que vai usar."""
    etiqueta = _cenario_etiqueta(db, embalagem="1000", custo="0.10")

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.custo_estimado == Decimal("100.00")  # 1000 × 0,10


def test_embalagem_unitaria_nao_muda_nada(db):
    etiqueta = _cenario_etiqueta(db, embalagem="1")

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.comprar == Decimal("105")
    assert linha.embalagens == 105
    assert linha.sobra == Decimal("0")


def test_saldo_suficiente_nao_compra_embalagem_nenhuma(db):
    etiqueta = _cenario_etiqueta(db, embalagem="1000", saldo="5000.000")

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, etiqueta)

    assert linha.comprar == Decimal("0")
    assert linha.embalagens == 0
    assert linha.sobra == Decimal("0")


def test_rolo_de_tecido_ignora_a_embalagem(db):
    """Decisão do usuário: rolo de malha não tem peso fixo, então segue fracionado."""
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    malha = criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", custo="30.00", cor=preto)
    malha.embalagem_compra = Decimal("25.000")  # alguém preencheu; a regra deve ignorar
    db.commit()
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).tecidos, malha)

    assert linha.comprar == Decimal("21.000")  # não virou 25,000
    assert linha.embalagens == 0


def test_aviamento_em_metros_tambem_respeita_a_embalagem(db):
    """Viés vendido em rolo de 100 m."""
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db)
    vies = criar_insumo(db, codigo="AV-VIES", categoria="AVIAMENTO", nome="Viés",
                        unidade="metros", saldo="0.000", minimo="0.000", custo="1.50")
    vies.embalagem_compra = Decimal("100.000")
    db.commit()
    criar_item_ficha(db, modelo, insumo=vies, tipo="Viés", consumo="0.5000", unidade="metros")
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})  # 52,5 m necessários

    linha = linha_do_insumo(sugerir_compra(db, MARGEM).aviamentos, vies)

    assert linha.comprar == Decimal("100.000")
    assert linha.embalagens == 1
    assert linha.sobra == Decimal("47.500")


def test_api_devolve_embalagens_e_sobra(client, db):
    _cenario_etiqueta(db, embalagem="1000")

    corpo = client.get("/camisetas/insumos/sugestao-compra/", params={"margem_percentual": "5"}).json()

    linha = corpo["aviamentos"][0]
    assert Decimal(linha["comprar"]) == Decimal("1000")
    assert linha["embalagens"] == 1
    assert Decimal(linha["sobra"]) == Decimal("895")


# ----------------- recorte dos pedidos -----------------

@pytest.mark.parametrize("status", ["Entregue", "Pronto no Estoque"])
def test_pedido_ja_produzido_fica_fora(db, status):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"M": 100}, status=status)

    sugestao = sugerir_compra(db, MARGEM)

    assert sugestao.tecidos == []
    assert sugestao.pedidos_considerados == []


def test_pedidos_considerados_mostram_de_onde_veio_a_conta(db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    malha = criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"M": 100}, codigo="PED-SEM-OP")
    com_op = criar_pedido_com_itens(db, modelo, preto, {"M": 40}, codigo="PED-COM-OP", status="Em Produção")
    criar_op_aberta(db, modelo, pedido=com_op, tecido=malha)

    por_codigo = {p.codigo_pedido: p for p in sugerir_compra(db, MARGEM).pedidos_considerados}

    assert por_codigo["PED-SEM-OP"].conta_tecido is True
    assert por_codigo["PED-SEM-OP"].pecas == 100
    assert por_codigo["PED-COM-OP"].conta_tecido is False
    assert por_codigo["PED-COM-OP"].pecas_pendentes_aviamento == 40


def test_sem_pedidos_a_produzir_devolve_sugestao_vazia(db):
    sugestao = sugerir_compra(db, MARGEM)

    assert sugestao.tecidos == []
    assert sugestao.aviamentos == []
    assert sugestao.total_estimado == Decimal("0.00")


# ----------------- endpoint -----------------

def test_endpoint_devolve_a_sugestao(client, db):
    preto = criar_cor(db, nome="Preto")
    modelo = criar_modelo(db, consumo_kg="0.2000")
    criar_insumo(db, codigo="MALHA-PRETA", saldo="0.000", minimo="0.000", custo="30.00", cor=preto)
    criar_pedido_com_itens(db, modelo, preto, {"M": 100})

    resposta = client.get("/camisetas/insumos/sugestao-compra/", params={"margem_percentual": "5"})

    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert Decimal(corpo["total_estimado"]) == Decimal("630.00")
    assert corpo["tecidos"][0]["codigo"] == "MALHA-PRETA"
    assert corpo["tecidos"][0]["nome_cor"] == "Preto"


def test_endpoint_sem_token_recusa(client_sem_login):
    assert client_sem_login.get("/camisetas/insumos/sugestao-compra/").status_code == 401


def test_endpoint_recusa_margem_negativa(client):
    assert client.get("/camisetas/insumos/sugestao-compra/", params={"margem_percentual": "-1"}).status_code == 422
