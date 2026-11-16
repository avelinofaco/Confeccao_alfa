import pytest

from app.core import config


def test_em_desenvolvimento_a_chave_e_gerada_quando_nao_ha_variavel(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setattr(config, "EM_PRODUCAO", False)
    chave = config.ler_secret_key()
    assert len(chave) >= 32
    assert chave != config.ler_secret_key()  # cada subida gera a sua


def test_em_producao_sem_chave_a_aplicacao_nao_sobe(monkeypatch):
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setattr(config, "EM_PRODUCAO", True)
    with pytest.raises(RuntimeError) as erro:
        config.ler_secret_key()
    assert "SECRET_KEY" in str(erro.value)


def test_a_variavel_de_ambiente_tem_prioridade(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "chave-do-ambiente")
    monkeypatch.setattr(config, "EM_PRODUCAO", True)
    assert config.ler_secret_key() == "chave-do-ambiente"


def test_sessao_padrao_de_doze_horas():
    assert config.MINUTOS_DE_SESSAO == 720


def test_o_segredo_nao_esta_mais_escrito_no_codigo():
    from pathlib import Path
    fonte = Path(config.__file__).parent / "security.py"
    assert "sua_chave_secreta_super_segura_aqui" not in fonte.read_text(encoding="utf-8")
