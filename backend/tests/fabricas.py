"""Fábricas de registros para os testes do segmento Camisetas."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.models.camisetas import (
    CamisetaCosturaFaccao,
    CamisetaEntradaInsumo,
    CamisetaFichaTecnica,
    CamisetaInsumo,
    CamisetaModelo,
    CamisetaOrdemProducao,
    CamisetaPedido,
    CamisetaRegistroFinanceiro,
)
from app.models.camisetas_cadastros import CamisetaCliente, CamisetaCor, CamisetaGrade, CamisetaGradeTamanho
from app.models.camisetas_estampas import CamisetaEstampa
from app.models.camisetas_sku import CamisetaPedidoItem, CamisetaPedidoItemQtd, CamisetaVariacao
from app.services.camisetas.grades import obter_grade_padrao
from app.services.documentos import normalizar_nome


def _salvar(db, objeto):
    db.add(objeto)
    db.commit()
    db.refresh(objeto)
    return objeto


def criar_grade(db, nome="Adulto", rotulos=("P", "M", "G", "GG")):
    grade = CamisetaGrade(nome=nome, ativo=True)
    grade.tamanhos = [CamisetaGradeTamanho(rotulo=r, ordem=i) for i, r in enumerate(rotulos, start=1)]
    return _salvar(db, grade)


def criar_modelo(db, nome="Camiseta Básica", consumo_kg="0.1800", grade=None):
    grade = grade or obter_grade_padrao(db)
    return _salvar(db, CamisetaModelo(
        nome_modelo=nome, consumo_tecido_kg=Decimal(consumo_kg), id_grade=grade.id_grade,
        grade_disponivel=", ".join(t.rotulo for t in grade.tamanhos),
    ))


def criar_modelo_com_grade(db, nome="Camiseta Básica", rotulos=("P", "M", "G", "GG"), consumo_kg="0.1800"):
    return criar_modelo(db, nome=nome, consumo_kg=consumo_kg, grade=criar_grade(db, nome=f"Grade {nome}", rotulos=rotulos))


def tamanho(modelo, rotulo):
    return next(t for t in modelo.grade.tamanhos if t.rotulo == rotulo)


def criar_variacao(db, modelo, cor, rotulo, saldo=0, minimo=0):
    return _salvar(db, CamisetaVariacao(
        id_modelo=modelo.id_modelo, id_cor=cor.id_cor, id_tamanho=tamanho(modelo, rotulo).id_tamanho,
        saldo=saldo, estoque_minimo=minimo,
    ))


def criar_insumo(db, codigo="MALHA-01", categoria="ROLO_TECIDO", nome="Meia Malha 30.1",
                 unidade="kg", saldo="100.000", custo="40.00", minimo="10.000", cor=None):
    return _salvar(db, CamisetaInsumo(
        codigo=codigo,
        categoria=categoria,
        tipo_malha_ou_aviamento=nome,
        unidade_medida=unidade,
        saldo_atual=Decimal(saldo),
        estoque_minimo=Decimal(minimo),
        preco_custo_medio=Decimal(custo),
        id_cor=cor.id_cor if cor else None,
    ))


def criar_item_ficha(db, modelo, insumo=None, tipo="Linha de Costura", consumo="0.0200", unidade="unidades"):
    return _salvar(db, CamisetaFichaTecnica(
        id_modelo=modelo.id_modelo,
        id_insumo=insumo.id_insumo if insumo else None,
        tipo_insumo=tipo,
        descricao_insumo=insumo.tipo_malha_ou_aviamento if insumo else tipo,
        consumo_unitario=Decimal(consumo),
        unidade_medida=unidade,
    ))


def criar_entrada(db, insumo, quantidade="10.000", valor="100.00", data=None):
    # Grava em UTC, como a aplicação faz (get_utc_now).
    momento = (data or datetime.now(timezone.utc)).astimezone(timezone.utc)
    return _salvar(db, CamisetaEntradaInsumo(
        id_insumo=insumo.id_insumo,
        quantidade=Decimal(quantidade),
        valor_total=Decimal(valor),
        data_entrada=momento,
    ))


def criar_pedido(db, modelo, codigo="PED-T-1", valor="1000.00", status="Aguardando Produção",
                 grade=(10, 10, 10, 10), criado_em=None, observacoes=None, data_entrega_realizada=None, cliente=None):
    p, m, g, gg = grade
    return _salvar(db, CamisetaPedido(
        codigo_pedido=codigo,
        nome_cliente=cliente.nome if cliente else "Cliente Teste",
        id_cliente=cliente.id_cliente if cliente else None,
        id_modelo=modelo.id_modelo,
        grade_p=p, grade_m=m, grade_g=g, grade_gg=gg,
        quantidade_total=p + m + g + gg,
        prazo_entrega=date.today() + timedelta(days=10),
        valor_total=Decimal(valor),
        status_pedido=status,
        observacoes=observacoes,
        criado_em=criado_em or datetime.now(timezone.utc),
        data_entrega_realizada=data_entrega_realizada,
    ))


def criar_op_cortada(db, modelo, codigo="OP-T-1", pecas=100, peso="20.000", tecido=None):
    return _salvar(db, CamisetaOrdemProducao(
        codigo_op=codigo,
        id_modelo=modelo.id_modelo,
        id_insumo_tecido=tecido.id_insumo if tecido else None,
        peso_malha_enviado_kg=Decimal(peso),
        pecas_planejadas=pecas,
        pecas_reais_cortadas=pecas,
        status_op="Cortado (Pronto para Costura)",
    ))


def criar_remessa(db, op, quantidade=50, status="Em Costura Externa"):
    return _salvar(db, CamisetaCosturaFaccao(
        id_op=op.id_op,
        nome_faccao="Facção Teste",
        quantidade_enviada=quantidade,
        status=status,
    ))


def criar_registro_financeiro(db, mes_ano, outros="0.00", observacoes=None):
    return _salvar(db, CamisetaRegistroFinanceiro(
        mes_ano=mes_ano,
        outros_custos_operacionais=Decimal(outros),
        observacoes=observacoes,
    ))


def criar_cliente(db, nome="Loja Beta", documento=None, telefone=None, ativo=True):
    return _salvar(db, CamisetaCliente(
        nome=nome,
        nome_busca=normalizar_nome(nome),
        documento=documento,
        telefone_whatsapp=telefone,
        ativo=ativo,
    ))


def criar_cor(db, nome="Preto", hex="#1F1F1F", ativo=True):
    return _salvar(db, CamisetaCor(nome=nome, hex=hex, ativo=ativo))


PNG_MINIMO_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def criar_estampa_teste(db, nome="Leão Dourado", codigo="EST-001", ativo=True):
    return _salvar(db, CamisetaEstampa(
        codigo=codigo,
        nome=nome,
        nome_busca=normalizar_nome(nome),
        imagem_bytes=PNG_MINIMO_BYTES,
        imagem_mime="image/png",
        tamanho_bytes=len(PNG_MINIMO_BYTES),
        ativo=ativo,
    ))


def criar_pedido_com_itens(db, modelo, cor, quantidades, codigo="PED-T-1", status="Aguardando Produção",
                           data_entrega_realizada=None):
    """Pedido com um item (modelo + cor) e quantidades por rótulo, ex.: {"P": 5, "M": 10}. `cor=None` = cor não informada."""
    pedido = CamisetaPedido(
        codigo_pedido=codigo, nome_cliente="Cliente Teste", id_modelo=modelo.id_modelo,
        grade_p=0, grade_m=0, grade_g=0, grade_gg=0, quantidade_total=sum(quantidades.values()),
        prazo_entrega=date.today() + timedelta(days=10), valor_total=Decimal("1000.00"),
        status_pedido=status, data_entrega_realizada=data_entrega_realizada,
    )
    pedido.itens = [CamisetaPedidoItem(
        id_modelo=modelo.id_modelo, id_cor=cor.id_cor if cor else None,
        quantidades=[CamisetaPedidoItemQtd(id_tamanho=tamanho(modelo, r).id_tamanho, quantidade=q) for r, q in quantidades.items()],
    )]
    return _salvar(db, pedido)
