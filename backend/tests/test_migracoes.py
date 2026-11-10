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
