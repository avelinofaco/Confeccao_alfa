# app/services/camisetas/pedido_itens.py
"""Itens do pedido (modelo + cor + quantidade por tamanho): validação, conversão do corpo antigo e resposta."""
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas_sku import CamisetaPedidoItem, CamisetaPedidoItemQtd
from app.schemas.camisetas_estampas import EstampaCreate
from app.schemas.camisetas_sku import PedidoItemEntrada, PedidoItemResponse, QtdTamanhoEntrada, QtdTamanhoResponse
from app.services.camisetas.cores import obter_cor
from app.services.camisetas.estampas import criar_estampa, obter_estampa
from app.services.camisetas.precificacao import arredondar_moeda, calcular_preco_unitario
from app.services.camisetas.sku import obter_modelo, tamanho_do_modelo, tamanhos_do_modelo

ROTULOS_LEGADOS = (("P", "grade_p"), ("M", "grade_m"), ("G", "grade_g"), ("GG", "grade_gg"))
CAMPOS_GRADE_LEGADA = tuple(campo for _, campo in ROTULOS_LEGADOS)


def _validar_cor(db: Session, entrada: PedidoItemEntrada, numero: int, nome_modelo: str, exigir_cor: bool) -> None:
    if entrada.id_cor is None:
        if exigir_cor:
            raise ErroNegocio(400, f"Escolha a cor do item {numero} ({nome_modelo}).")
        return
    cor = obter_cor(db, entrada.id_cor)
    if not cor.ativo:
        raise ErroNegocio(400, f"A cor {cor.nome} está inativa; escolha outra para o item {numero}.")


def _resolver_estampa(db: Session, entrada: PedidoItemEntrada, numero: int) -> tuple[int | None, str | None]:
    posicao = " ".join((entrada.posicao_estampa or "").split()) or "Frente"
    if entrada.id_estampa is not None:
        estampa = obter_estampa(db, entrada.id_estampa)
        if not estampa.ativo:
            raise ErroNegocio(400, f"A estampa {estampa.nome} está inativa; escolha outra para o item {numero}.")
        return estampa.id_estampa, posicao
    if entrada.imagem_data_url and entrada.imagem_data_url.strip():
        nome_nova = " ".join((entrada.nome_estampa_nova or "").split()) or f"Estampa do Item {numero}"
        nova = criar_estampa(
            db,
            EstampaCreate(nome=nome_nova, imagem_data_url=entrada.imagem_data_url),
        )
        return nova.id_estampa, posicao
    return None, None


def _quantidades(db: Session, modelo, entrada: PedidoItemEntrada, numero: int) -> list[CamisetaPedidoItemQtd]:
    vistos = set()
    linhas = []
    for qtd in entrada.quantidades:
        tamanho_do_modelo(db, modelo, qtd.id_tamanho)
        if qtd.id_tamanho in vistos:
            raise ErroNegocio(400, f"O item {numero} repete um tamanho.")
        vistos.add(qtd.id_tamanho)
        if qtd.quantidade > 0:
            linhas.append(CamisetaPedidoItemQtd(id_tamanho=qtd.id_tamanho, quantidade=qtd.quantidade))
    if not linhas:
        raise ErroNegocio(400, f"O item {numero} ({modelo.nome_modelo}) está sem quantidades.")
    return linhas


def montar_itens(db: Session, entradas: list[PedidoItemEntrada], exigir_cor: bool = True) -> list[CamisetaPedidoItem]:
    """Valida tudo antes de devolver: modelo, cor ativa, tamanhos da grade, sem itens repetidos e total > 0."""
    if not entradas:
        raise ErroNegocio(400, "O pedido precisa de pelo menos um item.")
    vistos = set()
    itens = []
    for numero, entrada in enumerate(entradas, start=1):
        modelo = obter_modelo(db, entrada.id_modelo)
        _validar_cor(db, entrada, numero, modelo.nome_modelo, exigir_cor)
        id_estampa, posicao = _resolver_estampa(db, entrada, numero)
        chave_item = (entrada.id_modelo, entrada.id_cor, id_estampa, (posicao or "").casefold())
        if chave_item in vistos:
            raise ErroNegocio(400, f"O item {numero} repete modelo e cor de outro item; junte as quantidades num item só.")
        vistos.add(chave_item)
        preco_unit = (
            arredondar_moeda(entrada.preco_unitario)
            if entrada.preco_unitario is not None
            else calcular_preco_unitario(
                modelo.preco_venda_lisa,
                modelo.acrescimo_estampa,
                tem_estampa=id_estampa is not None,
                posicao_estampa=posicao,
            )
        )
        itens.append(CamisetaPedidoItem(
            id_modelo=modelo.id_modelo,
            id_cor=entrada.id_cor,
            id_estampa=id_estampa,
            posicao_estampa=posicao,
            preco_unitario=preco_unit,
            quantidades=_quantidades(db, modelo, entrada, numero),
        ))
    return itens


def itens_do_corpo_antigo(db: Session, dados) -> list[PedidoItemEntrada]:
    """Corpo antigo (id_modelo + grade_p/m/g/gg) vira um item com cor não informada."""
    if dados.id_modelo is None:
        raise ErroNegocio(400, "Informe os itens do pedido.")
    modelo = obter_modelo(db, dados.id_modelo)
    por_rotulo = {t.rotulo.casefold(): t for t in tamanhos_do_modelo(modelo)}
    quantidades = []
    for rotulo, campo in ROTULOS_LEGADOS:
        valor = getattr(dados, campo) or 0
        if valor <= 0:
            continue
        tamanho = por_rotulo.get(rotulo.casefold())
        if tamanho is None:
            raise ErroNegocio(400, f"O modelo {modelo.nome_modelo} não tem o tamanho {rotulo} na grade.")
        quantidades.append(QtdTamanhoEntrada(id_tamanho=tamanho.id_tamanho, quantidade=valor))
    if not quantidades:
        raise ErroNegocio(400, "A soma das grades (P, M, G, GG) deve ser maior que zero")
    return [PedidoItemEntrada(id_modelo=modelo.id_modelo, id_cor=None, quantidades=quantidades)]


def total_do_item(item: CamisetaPedidoItem) -> int:
    return sum(q.quantidade for q in item.quantidades)


def soma_subtotais_itens(itens: list[CamisetaPedidoItem]) -> Decimal:
    return arredondar_moeda(sum(arredondar_moeda(i.preco_unitario) * total_do_item(i) for i in itens))


def resposta_do_item(item: CamisetaPedidoItem) -> PedidoItemResponse:
    quantidades = sorted(item.quantidades, key=lambda q: q.tamanho.ordem)
    est = item.estampa
    total_pecas = total_do_item(item)
    preco_unit = arredondar_moeda(item.preco_unitario)
    return PedidoItemResponse(
        id_item=item.id_item,
        id_modelo=item.id_modelo,
        nome_modelo=item.modelo.nome_modelo,
        id_cor=item.id_cor,
        nome_cor=item.cor.nome if item.cor else None,
        hex_cor=item.cor.hex if item.cor else None,
        id_estampa=item.id_estampa,
        codigo_estampa=est.codigo if est else None,
        nome_estampa=est.nome if est else None,
        imagem_estampa_url=est.imagem_data_url if est else None,
        posicao_estampa=item.posicao_estampa,
        preco_unitario=preco_unit,
        subtotal=arredondar_moeda(preco_unit * total_pecas),
        quantidades=[QtdTamanhoResponse(id_tamanho=q.id_tamanho, rotulo=q.tamanho.rotulo, quantidade=q.quantidade)
                     for q in quantidades],
        total=total_pecas,
    )
