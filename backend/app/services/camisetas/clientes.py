# app/services/camisetas/clientes.py
"""Regras do cadastro de clientes e da ligação pedido → cliente."""
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.erros import ErroNegocio
from app.models.camisetas import CamisetaPedido
from app.models.camisetas_cadastros import CamisetaCliente
from app.schemas.camisetas_cadastros import ClienteEntrada, ClienteResponse
from app.services.documentos import normalizar_documento, normalizar_nome, somente_digitos

LIMITE_PADRAO = 50
MINIMO_DIGITOS_BUSCA = 3
DUAS_CASAS = Decimal("0.01")


def _texto(valor: Optional[str]) -> Optional[str]:
    limpo = " ".join((valor or "").split())
    return limpo or None


def _resumos(db: Session, ids: list[int]) -> dict:
    if not ids:
        return {}
    linhas = (
        db.query(
            CamisetaPedido.id_cliente,
            func.count(CamisetaPedido.id_pedido),
            func.max(CamisetaPedido.criado_em),
            func.coalesce(func.sum(CamisetaPedido.valor_total), 0),
        )
        .filter(CamisetaPedido.id_cliente.in_(ids))
        .group_by(CamisetaPedido.id_cliente)
        .all()
    )
    return {id_cliente: (qtd, ultimo, total) for id_cliente, qtd, ultimo, total in linhas}


def montar_resposta_cliente(cliente: CamisetaCliente, resumo=None) -> ClienteResponse:
    qtd, ultimo, total = resumo or (0, None, 0)
    return ClienteResponse(
        id_cliente=cliente.id_cliente,
        tipo=cliente.tipo,
        nome=cliente.nome,
        documento=cliente.documento,
        telefone_whatsapp=cliente.telefone_whatsapp,
        email=cliente.email,
        cidade=cliente.cidade,
        uf=cliente.uf,
        endereco=cliente.endereco,
        observacoes=cliente.observacoes,
        token_portal=cliente.token_portal,
        ativo=cliente.ativo,
        qtd_pedidos=int(qtd or 0),
        ultimo_pedido_em=ultimo,
        valor_total_pedidos=Decimal(str(total or 0)).quantize(DUAS_CASAS),
        criado_em=cliente.criado_em,
    )


def resposta_do_cliente(db: Session, cliente: CamisetaCliente) -> ClienteResponse:
    return montar_resposta_cliente(cliente, _resumos(db, [cliente.id_cliente]).get(cliente.id_cliente))


def listar_clientes(db: Session, busca: Optional[str] = None, incluir_inativos: bool = False,
                    limite: int = LIMITE_PADRAO) -> list[ClienteResponse]:
    consulta = db.query(CamisetaCliente)
    if not incluir_inativos:
        consulta = consulta.filter(CamisetaCliente.ativo.is_(True))
    termo = normalizar_nome(busca)
    if termo:
        condicoes = [CamisetaCliente.nome_busca.contains(termo)]
        digitos = somente_digitos(busca)
        if len(digitos) >= MINIMO_DIGITOS_BUSCA:
            condicoes += [CamisetaCliente.documento.contains(digitos), CamisetaCliente.telefone_whatsapp.contains(digitos)]
        consulta = consulta.filter(or_(*condicoes))
    clientes = consulta.order_by(CamisetaCliente.nome_busca).limit(limite).all()
    resumos = _resumos(db, [c.id_cliente for c in clientes])
    return [montar_resposta_cliente(c, resumos.get(c.id_cliente)) for c in clientes]


def obter_cliente(db: Session, id_cliente: int) -> CamisetaCliente:
    cliente = db.get(CamisetaCliente, id_cliente)
    if cliente is None:
        raise ErroNegocio(404, "Cliente não encontrado.")
    return cliente


def _aplicar_dados(db: Session, cliente: CamisetaCliente, dados: ClienteEntrada) -> None:
    nome = _texto(dados.nome) or ""
    if len(nome) < 2:
        raise ErroNegocio(400, "Informe o nome do cliente (pelo menos 2 letras).")
    documento, tipo_documento = normalizar_documento(dados.documento)
    if documento:
        dono = (
            db.query(CamisetaCliente)
            .filter(CamisetaCliente.documento == documento, CamisetaCliente.id_cliente != cliente.id_cliente)
            .first()
        )
        if dono:
            raise ErroNegocio(409, f"Este documento já está cadastrado para {dono.nome}.")
    cliente.nome = nome
    cliente.nome_busca = normalizar_nome(nome)
    cliente.documento = documento
    cliente.tipo = tipo_documento or dados.tipo
    cliente.telefone_whatsapp = somente_digitos(dados.telefone_whatsapp) or None
    cliente.email = _texto(dados.email)
    cliente.cidade = _texto(dados.cidade)
    cliente.uf = (_texto(dados.uf) or "").upper() or None
    cliente.endereco = _texto(dados.endereco)
    cliente.observacoes = (dados.observacoes or "").strip() or None
    cliente.ativo = dados.ativo


def criar_cliente(db: Session, dados: ClienteEntrada) -> CamisetaCliente:
    cliente = CamisetaCliente()
    _aplicar_dados(db, cliente, dados)
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def atualizar_cliente(db: Session, id_cliente: int, dados: ClienteEntrada) -> CamisetaCliente:
    cliente = obter_cliente(db, id_cliente)
    _aplicar_dados(db, cliente, dados)
    db.commit()
    db.refresh(cliente)
    return cliente


def excluir_cliente(db: Session, id_cliente: int) -> None:
    cliente = obter_cliente(db, id_cliente)
    if db.query(CamisetaPedido.id_pedido).filter_by(id_cliente=id_cliente).first() is not None:
        raise ErroNegocio(409, "Este cliente tem pedidos; inative-o em vez de excluir.")
    db.delete(cliente)
    db.commit()


def resolver_cliente(db: Session, id_cliente: Optional[int], nome_cliente: Optional[str]) -> CamisetaCliente:
    """Cliente do pedido: pelo id (deve estar ativo) ou pelo nome (encontra ou cria). Não faz commit."""
    if id_cliente is not None:
        cliente = obter_cliente(db, id_cliente)
        if not cliente.ativo:
            raise ErroNegocio(400, "Cliente inativo. Reative o cadastro para criar pedidos.")
        return cliente
    chave = normalizar_nome(nome_cliente)
    if not chave:
        raise ErroNegocio(400, "Informe o cliente do pedido.")
    existente = db.query(CamisetaCliente).filter_by(nome_busca=chave).first()
    if existente:
        return existente
    cliente = CamisetaCliente(nome=_texto(nome_cliente), nome_busca=chave, ativo=True)
    db.add(cliente)
    db.flush()
    return cliente
