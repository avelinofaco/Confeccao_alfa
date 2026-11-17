import os
import subprocess
import sys
from pathlib import Path

import sqlalchemy as sa

BACKEND = Path(__file__).resolve().parents[1]


def rodar_alembic(*args, url):
    ambiente = {**os.environ, "DATABASE_URL": url}
    resultado = subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND, env=ambiente, capture_output=True, text=True,
    )
    assert resultado.returncode == 0, resultado.stderr


def tabelas(url):
    engine = sa.create_engine(url)
    try:
        return set(sa.inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_migracao_de_sequencias_sobe_e_desce(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261110_003_sequencias", url=url)
    assert "sequencias_documentos" in tabelas(url)
    rodar_alembic("downgrade", "20261022_002_camisetas", url=url)
    assert "sequencias_documentos" not in tabelas(url)


def test_migracao_preenche_data_de_entrega(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261110_003_sequencias", url=url)
    engine = sa.create_engine(url)
    with engine.begin() as conexao:
        conexao.execute(sa.text(
            "INSERT INTO camisetas_modelos (id_modelo, nome_modelo, consumo_tecido_kg) VALUES (1, 'M', 0.18)"
        ))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_pedidos (id_pedido, codigo_pedido, nome_cliente, id_modelo, quantidade_total, "
            "prazo_entrega, valor_total, status_pedido, observacoes, atualizado_em) VALUES "
            "(1, 'PED-1', 'C', 1, 10, '2026-10-01', 100, 'Entregue', "
            "'obs\n[ENTREGA REALIZADA em 05/10/2026 | Recebido por: Ana]', '2026-10-07 10:00:00'), "
            "(2, 'PED-2', 'C', 1, 10, '2026-10-01', 100, 'Entregue', NULL, '2026-10-09 10:00:00'), "
            "(3, 'PED-3', 'C', 1, 10, '2026-10-01', 100, 'Aguardando Produção', NULL, '2026-10-09 10:00:00')"
        ))
    rodar_alembic("upgrade", "head", url=url)
    with engine.connect() as conexao:
        datas = dict(conexao.execute(sa.text(
            "SELECT id_pedido, data_entrega_realizada FROM camisetas_pedidos"
        )).all())
    engine.dispose()
    assert str(datas[1]) == "2026-10-05"
    assert str(datas[2]) == "2026-10-09"
    assert datas[3] is None
    rodar_alembic("downgrade", "20261110_003_sequencias", url=url)


def test_migracao_cadastros_cria_clientes_e_grades(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261110_004_data_entrega", url=url)
    engine = sa.create_engine(url)
    with engine.begin() as conexao:
        conexao.execute(sa.text(
            "INSERT INTO camisetas_modelos (id_modelo, nome_modelo, consumo_tecido_kg, grade_disponivel) VALUES "
            "(1, 'Básica', 0.18, 'P, M, G, GG'), (2, 'Longa', 0.2, 'P, M, G, GG, XG'), (3, 'Polo', 0.2, NULL)"
        ))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_pedidos (id_pedido, codigo_pedido, nome_cliente, id_modelo, quantidade_total, "
            "prazo_entrega, valor_total) VALUES "
            "(1, 'A', 'Loja Beta', 1, 10, '2026-10-01', 100), "
            "(2, 'B', ' loja  beta ', 1, 10, '2026-10-01', 100), "
            "(3, 'C', 'Ateliê Sol', 1, 10, '2026-10-01', 100)"
        ))
    rodar_alembic("upgrade", "head", url=url)
    with engine.connect() as conexao:
        clientes = conexao.execute(sa.text(
            "SELECT nome, nome_busca FROM camisetas_clientes ORDER BY id_cliente")).all()
        pedidos = dict(conexao.execute(sa.text("SELECT id_pedido, id_cliente FROM camisetas_pedidos")).all())
        grades = dict(conexao.execute(sa.text("SELECT nome, id_grade FROM camisetas_grades")).all())
        modelos = dict(conexao.execute(sa.text("SELECT id_modelo, id_grade FROM camisetas_modelos")).all())
        tamanhos_xg = [linha[0] for linha in conexao.execute(sa.text(
            "SELECT t.rotulo FROM camisetas_grade_tamanhos t JOIN camisetas_grades g ON g.id_grade = t.id_grade "
            "WHERE g.nome = 'Grade (P, M, G, GG, XG)' ORDER BY t.ordem")).all()]
    engine.dispose()
    assert [tuple(c) for c in clientes] == [("Loja Beta", "loja beta"), ("Ateliê Sol", "atelie sol")]
    assert pedidos[1] == pedidos[2] != pedidos[3]
    assert set(grades) == {"Adulto (P, M, G, GG)", "Grade (P, M, G, GG, XG)"}
    assert modelos[1] == modelos[3] == grades["Adulto (P, M, G, GG)"]
    assert modelos[2] == grades["Grade (P, M, G, GG, XG)"]
    assert tamanhos_xg == ["P", "M", "G", "GG", "XG"]
    rodar_alembic("downgrade", "20261110_004_data_entrega", url=url)
    assert "camisetas_clientes" not in tabelas(url)


def test_migracao_estoque_sku_converte_pedidos_em_itens(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261110_005_cadastros", url=url)
    engine = sa.create_engine(url)
    with engine.begin() as conexao:
        conexao.execute(sa.text("INSERT INTO camisetas_grades (id_grade, nome, ativo) VALUES (1, 'Curta', 1)"))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_grade_tamanhos (id_tamanho, id_grade, rotulo, ordem) VALUES (1, 1, 'P', 1), (2, 1, 'M', 2)"
        ))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_modelos (id_modelo, nome_modelo, consumo_tecido_kg, grade_disponivel, id_grade) "
            "VALUES (1, 'Básica', 0.18, 'P, M', 1)"
        ))
        conexao.execute(sa.text(
            "INSERT INTO camisetas_pedidos (id_pedido, codigo_pedido, nome_cliente, id_modelo, grade_p, grade_m, grade_g, "
            "grade_gg, quantidade_total, prazo_entrega, valor_total) VALUES (1, 'A', 'C', 1, 5, 0, 3, 0, 8, '2026-10-01', 100)"
        ))
    rodar_alembic("upgrade", "head", url=url)
    with engine.connect() as conexao:
        item = conexao.execute(sa.text(
            "SELECT id_item, id_modelo, id_cor FROM camisetas_pedido_itens WHERE id_pedido = 1")).one()
        quantidades = conexao.execute(sa.text(
            "SELECT t.rotulo, q.quantidade FROM camisetas_pedido_item_qtds q "
            "JOIN camisetas_grade_tamanhos t ON t.id_tamanho = q.id_tamanho WHERE q.id_item = :i ORDER BY t.ordem"),
            {"i": item.id_item}).all()
        rotulos = [r[0] for r in conexao.execute(sa.text(
            "SELECT rotulo FROM camisetas_grade_tamanhos WHERE id_grade = 1 ORDER BY ordem")).all()]
        texto = conexao.execute(sa.text("SELECT grade_disponivel FROM camisetas_modelos WHERE id_modelo = 1")).scalar_one()
    engine.dispose()
    assert (item.id_modelo, item.id_cor) == (1, None)
    assert [tuple(q) for q in quantidades] == [("P", 5), ("G", 3)]
    assert rotulos == ["P", "M", "G"]
    assert texto == "P, M, G"
    rodar_alembic("downgrade", "20261110_005_cadastros", url=url)
    assert "camisetas_variacoes" not in tabelas(url)
    assert "camisetas_pedido_itens" not in tabelas(url)


def test_migracao_estampas_sobe_e_desce(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261116_007_estampas", url=url)
    assert "camisetas_estampas" in tabelas(url)
    rodar_alembic("downgrade", "20261110_006_estoque_sku", url=url)
    assert "camisetas_estampas" not in tabelas(url)


def test_migracao_pedido_item_estampa_sobe_e_desce(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261116_008_pedido_item_estampa", url=url)
    engine = sa.create_engine(url)
    try:
        colunas = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_pedido_itens")}
    finally:
        engine.dispose()
    assert {"id_estampa", "posicao_estampa"}.issubset(colunas)
    rodar_alembic("downgrade", "20261116_007_estampas", url=url)
    engine = sa.create_engine(url)
    try:
        colunas_apos = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_pedido_itens")}
    finally:
        engine.dispose()
    assert "id_estampa" not in colunas_apos
    assert "posicao_estampa" not in colunas_apos


def test_migracao_portal_cliente_sobe_e_desce(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261116_009_portal_cliente", url=url)
    engine = sa.create_engine(url)
    try:
        cols_ped = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_pedidos")}
        cols_cli = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_clientes")}
    finally:
        engine.dispose()
    assert {"token_aprovacao", "status_aprovacao_cliente", "observacao_cliente", "aprovado_pelo_cliente_em"}.issubset(cols_ped)
    assert "token_portal" in cols_cli

    rodar_alembic("downgrade", "20261116_008_pedido_item_estampa", url=url)
    engine = sa.create_engine(url)
    try:
        cols_ped_apos = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_pedidos")}
        cols_cli_apos = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_clientes")}
    finally:
        engine.dispose()
    assert "token_aprovacao" not in cols_ped_apos
    assert "token_portal" not in cols_cli_apos


def test_migracao_precificacao_sobe_e_desce(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261116_010_precificacao", url=url)
    engine = sa.create_engine(url)
    try:
        cols_mod = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_modelos")}
        cols_item = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_pedido_itens")}
    finally:
        engine.dispose()
    assert {"preco_venda_lisa", "acrescimo_estampa"}.issubset(cols_mod)
    assert "preco_unitario" in cols_item

    rodar_alembic("downgrade", "20261116_009_portal_cliente", url=url)
    engine = sa.create_engine(url)
    try:
        cols_mod_apos = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_modelos")}
        cols_item_apos = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_pedido_itens")}
    finally:
        engine.dispose()
    assert "preco_venda_lisa" not in cols_mod_apos
    assert "preco_unitario" not in cols_item_apos


def test_migracao_producao_pedido_op_sobe_e_desce(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261117_011_producao_pedido_op", url=url)
    engine = sa.create_engine(url)
    try:
        cols_op = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_ordens_producao")}
    finally:
        engine.dispose()
    assert "id_pedido" in cols_op

    rodar_alembic("downgrade", "20261116_010_precificacao", url=url)
    engine = sa.create_engine(url)
    try:
        cols_op_apos = {c["name"] for c in sa.inspect(engine).get_columns("camisetas_ordens_producao")}
    finally:
        engine.dispose()
    assert "id_pedido" not in cols_op_apos


def test_migracao_financeiro_despesas_recebimentos_sobe_e_desce(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "20261117_012_financeiro_despesas_recebimentos", url=url)
    engine = sa.create_engine(url)
    try:
        inspetor = sa.inspect(engine)
        assert "camisetas_despesas" in inspetor.get_table_names()
        cols_ped = {c["name"] for c in inspetor.get_columns("camisetas_pedidos")}
    finally:
        engine.dispose()
    assert {"status_pagamento", "data_pagamento"}.issubset(cols_ped)

    rodar_alembic("downgrade", "20261117_011_producao_pedido_op", url=url)
    engine = sa.create_engine(url)
    try:
        inspetor_apos = sa.inspect(engine)
        assert "camisetas_despesas" not in inspetor_apos.get_table_names()
        cols_ped_apos = {c["name"] for c in inspetor_apos.get_columns("camisetas_pedidos")}
    finally:
        engine.dispose()
    assert "status_pagamento" not in cols_ped_apos
    assert "data_pagamento" not in cols_ped_apos


def test_modelos_e_migracoes_estao_alinhados(tmp_path):
    url = f"sqlite:///{tmp_path / 'migracao.db'}"
    rodar_alembic("upgrade", "head", url=url)
    rodar_alembic("check", url=url)
