import base64
import pytest

from app.core.erros import ErroNegocio
from app.schemas.camisetas_estampas import EstampaCreate, EstampaUpdate
from app.services.camisetas.estampas import (
    LIMITE_BYTES_ESTAMPA,
    atualizar_estampa,
    criar_estampa,
    decodificar_imagem_estampa,
    excluir_estampa,
    listar_estampas,
    obter_estampa,
)

# 1x1 PNG transparente válido
PNG_1X1_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)
PNG_DATA_URL = "data:image/png;base64," + base64.b64encode(PNG_1X1_BYTES).decode("ascii")

# Cabeçalho JPEG válido mínimo
JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
JPEG_DATA_URL = "data:image/jpeg;base64," + base64.b64encode(JPEG_BYTES).decode("ascii")

# Cabeçalho WEBP válido mínimo
WEBP_BYTES = b"RIFF\x14\x00\x00\x00WEBPVP8 \x08\x00\x00\x00\x00\x00\x00\x00"
WEBP_DATA_URL = "data:image/webp;base64," + base64.b64encode(WEBP_BYTES).decode("ascii")


def test_decodificar_aceita_png_jpeg_e_webp():
    dados_png, mime_png = decodificar_imagem_estampa(PNG_DATA_URL)
    assert dados_png == PNG_1X1_BYTES
    assert mime_png == "image/png"

    dados_jpg, mime_jpg = decodificar_imagem_estampa(JPEG_DATA_URL)
    assert dados_jpg == JPEG_BYTES
    assert mime_jpg == "image/jpeg"

    dados_webp, mime_webp = decodificar_imagem_estampa(WEBP_DATA_URL)
    assert dados_webp == WEBP_BYTES
    assert mime_webp == "image/webp"


def test_decodificar_aceita_base64_sem_prefixo():
    apenas_b64 = base64.b64encode(PNG_1X1_BYTES).decode("ascii")
    dados, mime = decodificar_imagem_estampa(apenas_b64)
    assert dados == PNG_1X1_BYTES
    assert mime == "image/png"


@pytest.mark.parametrize("entrada", ["", "   ", "data:image/png;base64,", "!!!nao-e-base64!!!"])
def test_decodificar_recusa_base64_vazio_ou_invalido(entrada):
    with pytest.raises(ErroNegocio) as exc:
        decodificar_imagem_estampa(entrada)
    assert exc.value.status_code == 400


def test_decodificar_recusa_formato_desconhecido():
    falso = "data:image/png;base64," + base64.b64encode(b"texto comum disfarcado").decode("ascii")
    with pytest.raises(ErroNegocio) as exc:
        decodificar_imagem_estampa(falso)
    assert exc.value.status_code == 400
    assert "PNG, JPG ou WEBP" in exc.value.mensagem


def test_decodificar_recusa_acima_de_2mb():
    gigante = PNG_1X1_BYTES + (b"\x00" * (LIMITE_BYTES_ESTAMPA + 10))
    data_url = "data:image/png;base64," + base64.b64encode(gigante).decode("ascii")
    with pytest.raises(ErroNegocio) as exc:
        decodificar_imagem_estampa(data_url)
    assert exc.value.status_code == 400
    assert "2 MB" in exc.value.mensagem


def test_criar_estampa_gera_codigo_sequencial_quando_omitido(db):
    e1 = criar_estampa(db, EstampaCreate(nome="Leão Dourado", imagem_data_url=PNG_DATA_URL))
    e2 = criar_estampa(db, EstampaCreate(nome="Águia Real", codigo="   ", imagem_data_url=JPEG_DATA_URL))
    assert e1.codigo.startswith("EST-") and e1.codigo.endswith("-0001")
    assert e2.codigo.startswith("EST-") and e2.codigo.endswith("-0002")
    assert e1.tamanho_bytes == len(PNG_1X1_BYTES)


def test_criar_estampa_com_codigo_proprio_e_unicidade(db):
    criar_estampa(db, EstampaCreate(nome="Floral Verão", codigo=" flor-01 ", imagem_data_url=PNG_DATA_URL))
    with pytest.raises(ErroNegocio) as exc:
        criar_estampa(db, EstampaCreate(nome="Outra Arte", codigo="FLOR-01", imagem_data_url=PNG_DATA_URL))
    assert exc.value.status_code == 409
    assert "FLOR-01" in exc.value.mensagem


def test_listar_filtra_por_busca_sem_acento_e_inativas(db):
    e1 = criar_estampa(db, EstampaCreate(nome="Leão Tropical", codigo="LEAO-01", imagem_data_url=PNG_DATA_URL))
    e2 = criar_estampa(db, EstampaCreate(nome="Geométrica Minimalista", codigo="GEO-02", imagem_data_url=PNG_DATA_URL))
    atualizar_estampa(
        db,
        e2.id_estampa,
        EstampaUpdate(nome=e2.nome, codigo=e2.codigo, ativo=False),
    )

    ativas = listar_estampas(db)
    assert [e.id_estampa for e in ativas] == [e1.id_estampa]

    todas = listar_estampas(db, incluir_inativas=True)
    assert len(todas) == 2

    por_nome_sem_acento = listar_estampas(db, busca="leao", incluir_inativas=True)
    assert [e.id_estampa for e in por_nome_sem_acento] == [e1.id_estampa]

    por_codigo = listar_estampas(db, busca="geo-02", incluir_inativas=True)
    assert [e.id_estampa for e in por_codigo] == [e2.id_estampa]


def test_atualizar_estampa_mantem_ou_troca_imagem(db):
    estampa = criar_estampa(db, EstampaCreate(nome="Original", codigo="ORIG-1", imagem_data_url=PNG_DATA_URL))
    sem_trocar_img = atualizar_estampa(
        db,
        estampa.id_estampa,
        EstampaUpdate(nome="Renomeada", codigo="ORIG-1", observacoes="Frente peito", ativo=True),
    )
    assert sem_trocar_img.nome == "Renomeada"
    assert sem_trocar_img.imagem_mime == "image/png"
    assert sem_trocar_img.imagem_data_url == PNG_DATA_URL

    trocando_img = atualizar_estampa(
        db,
        estampa.id_estampa,
        EstampaUpdate(nome="Renomeada", codigo="ORIG-1", ativo=True, imagem_data_url=WEBP_DATA_URL),
    )
    assert trocando_img.imagem_mime == "image/webp"
    assert trocando_img.imagem_data_url == WEBP_DATA_URL


def test_excluir_estampa_remove_do_banco(db):
    estampa = criar_estampa(db, EstampaCreate(nome="Temporária", imagem_data_url=PNG_DATA_URL))
    excluir_estampa(db, estampa.id_estampa)
    with pytest.raises(ErroNegocio) as exc:
        obter_estampa(db, estampa.id_estampa)
    assert exc.value.status_code == 404


def test_api_ciclo_completo_de_estampas(client, client_sem_login):
    assert client_sem_login.get("/camisetas/estampas/").status_code == 401

    resp_criar = client.post(
        "/camisetas/estampas/",
        json={"nome": "Logo Leão Dourado", "observacoes": "Silk 2 cores", "imagem_data_url": PNG_DATA_URL},
    )
    assert resp_criar.status_code == 201
    criada = resp_criar.json()
    assert criada["nome"] == "Logo Leão Dourado"
    assert criada["codigo"].startswith("EST-")
    assert criada["imagem_data_url"] == PNG_DATA_URL

    id_est = criada["id_estampa"]
    resp_detalhe = client.get(f"/camisetas/estampas/{id_est}")
    assert resp_detalhe.status_code == 200
    assert resp_detalhe.json()["id_estampa"] == id_est

    resp_img = client.get(f"/camisetas/estampas/{id_est}/imagem")
    assert resp_img.status_code == 200
    assert resp_img.headers["content-type"] == "image/png"
    assert resp_img.content == PNG_1X1_BYTES

    resp_lista = client.get("/camisetas/estampas/", params={"busca": "leao"})
    assert resp_lista.status_code == 200
    assert [e["id_estampa"] for e in resp_lista.json()] == [id_est]

    resp_edit = client.put(
        f"/camisetas/estampas/{id_est}",
        json={"nome": "Logo Leão Rei", "codigo": "LEAO-REI", "observacoes": "Peito", "ativo": False},
    )
    assert resp_edit.status_code == 200
    assert resp_edit.json()["codigo"] == "LEAO-REI"
    assert resp_edit.json()["ativo"] is False

    assert client.get("/camisetas/estampas/").json() == []
    assert len(client.get("/camisetas/estampas/", params={"incluir_inativas": True}).json()) == 1

    resp_del = client.delete(f"/camisetas/estampas/{id_est}")
    assert resp_del.status_code == 204
    assert client.get(f"/camisetas/estampas/{id_est}").status_code == 404

