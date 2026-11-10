from app.main import app

ROTAS_ESPERADAS = {
    ("POST", "/camisetas/seed-inicial"),
    ("GET", "/camisetas/dashboard/"),
    ("GET", "/camisetas/pedidos/"),
    ("POST", "/camisetas/pedidos/"),
    ("PUT", "/camisetas/pedidos/{id_pedido}/status"),
    ("POST", "/camisetas/pedidos/{id_pedido}/entregar"),
    ("DELETE", "/camisetas/pedidos/{id_pedido}"),
    ("GET", "/camisetas/estoque-acabado/"),
    ("GET", "/camisetas/insumos/"),
    ("POST", "/camisetas/insumos/"),
    ("POST", "/camisetas/insumos/entrada/"),
    ("GET", "/camisetas/modelos/"),
    ("POST", "/camisetas/modelos/"),
    ("GET", "/camisetas/fichas/"),
    ("POST", "/camisetas/fichas/"),
    ("DELETE", "/camisetas/fichas/{id_ficha}"),
    ("GET", "/camisetas/ordens/"),
    ("POST", "/camisetas/ordens/"),
    ("PUT", "/camisetas/ordens/{id_op}/finalizar-corte"),
    ("GET", "/camisetas/financeiro/apuracao-mensal/"),
    ("GET", "/camisetas/financeiro/"),
    ("POST", "/camisetas/financeiro/"),
    ("GET", "/camisetas/costura/"),
    ("POST", "/camisetas/costura/enviar"),
    ("PUT", "/camisetas/costura/{id_costura}/retornar"),
    ("GET", "/camisetas/clientes/"),
    ("POST", "/camisetas/clientes/"),
    ("GET", "/camisetas/clientes/{id_cliente}"),
    ("PUT", "/camisetas/clientes/{id_cliente}"),
    ("DELETE", "/camisetas/clientes/{id_cliente}"),
}


def rotas_camisetas():
    # FastAPI 0.143 guarda routers incluídos como _IncludedRouter; o esquema OpenAPI
    # é a forma pública e estável de listar todas as rotas efetivas.
    caminhos = app.openapi()["paths"]
    return {
        (metodo.upper(), caminho)
        for caminho, operacoes in caminhos.items()
        if caminho.startswith("/camisetas")
        for metodo in operacoes
    }


def test_rotas_camisetas_nao_mudam():
    assert rotas_camisetas() == ROTAS_ESPERADAS
