# app/schemas/camisetas.py
"""
Schemas Pydantic para validação e serialização de dados do Segmento de Camisetas.
Todos os schemas com nomes em português e campos tipados.
"""

from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

from app.schemas.camisetas_sku import (
    CorteEntrada,
    ItemEnvioEntrada,
    ItemRetornoEntrada,
    OpCorEntrada,
    PedidoItemEntrada,
    PedidoItemResponse,
    OpCorResponse,
    OpCorteResponse,
    RemessaItemResponse,
    TamanhoResponse,
)

# ----------------- MODELO DE CAMISETA -----------------
class CamisetaModeloBase(BaseModel):
    nome_modelo: str
    grade_disponivel: Optional[str] = "P, M, G, GG"
    consumo_tecido_kg: Decimal = Decimal("0.1800")
    descricao: Optional[str] = None

class CamisetaModeloCreate(CamisetaModeloBase):
    id_grade: Optional[int] = None  # ausente → grade padrão "Adulto (P, M, G, GG)"


class CamisetaModeloUpdate(BaseModel):
    nome_modelo: str = Field(..., min_length=1, max_length=150)
    consumo_tecido_kg: Decimal = Field(..., gt=0)
    descricao: Optional[str] = None
    id_grade: Optional[int] = None  # ausente → mantém a grade atual

class CamisetaModeloResponse(CamisetaModeloBase):
    id_modelo: int
    id_grade: Optional[int] = None
    nome_grade: Optional[str] = None
    tamanhos: List[str] = Field(default_factory=list)
    grade_tamanhos: List[TamanhoResponse] = Field(default_factory=list)
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# ----------------- INSUMOS (MALHAS E AVIAMENTOS) -----------------
class CamisetaInsumoBase(BaseModel):
    codigo: Optional[str] = None
    categoria: str # 'ROLO_TECIDO' ou 'AVIAMENTO'
    tipo_malha_ou_aviamento: str
    cor: Optional[str] = None
    unidade_medida: str # 'kg', 'unidades', 'metros'
    saldo_atual: Decimal = Decimal("0.000")
    estoque_minimo: Decimal = Decimal("10.000")
    preco_custo_medio: Decimal = Decimal("0.00")
    id_cor: Optional[int] = None  # cor de camiseta que esta malha produz

class CamisetaInsumoCreate(CamisetaInsumoBase):
    pass

class CamisetaInsumoResponse(CamisetaInsumoBase):
    id_insumo: int
    nome_cor: Optional[str] = None
    hex_cor: Optional[str] = None
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class CamisetaInsumoUpdate(BaseModel):
    """Só dados cadastrais: saldo e custo médio mudam por nota fiscal (e ajuste de inventário)."""
    tipo_malha_ou_aviamento: str = Field(..., min_length=1, max_length=150)
    cor: Optional[str] = Field(None, max_length=80)
    id_cor: Optional[int] = None
    unidade_medida: str = Field(..., min_length=1, max_length=15)
    estoque_minimo: Decimal = Field(..., ge=0)

# ----------------- ENTRADA DE INSUMOS (COMPRAS/NFs) -----------------
class CamisetaEntradaInsumoCreate(BaseModel):
    id_insumo: int
    numero_nota_fiscal: Optional[str] = None
    fornecedor: Optional[str] = None
    quantidade: Decimal
    valor_total: Decimal = Decimal("0.00")

class CamisetaEntradaInsumoResponse(BaseModel):
    id_entrada: int
    id_insumo: int
    numero_nota_fiscal: Optional[str] = None
    fornecedor: Optional[str] = None
    quantidade: Decimal
    valor_total: Decimal
    data_entrada: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# ----------------- FICHA TÉCNICA DIGITAL -----------------
class CamisetaFichaTecnicaBase(BaseModel):
    id_modelo: int
    id_insumo: Optional[int] = None
    tipo_insumo: str
    descricao_insumo: str
    consumo_unitario: Decimal
    unidade_medida: str
    custo_unitario_estimado: Decimal = Decimal("0.00")

class CamisetaFichaTecnicaCreate(CamisetaFichaTecnicaBase):
    pass

class CamisetaFichaTecnicaResponse(CamisetaFichaTecnicaBase):
    id_ficha: int
    model_config = ConfigDict(from_attributes=True)

# ----------------- PEDIDOS COMERCIAIS -----------------
class CamisetaPedidoCreate(BaseModel):
    codigo_pedido: Optional[str] = None  # ignorado: o servidor gera PED-AAAA-NNNN
    nome_cliente: Optional[str] = None  # usado só se id_cliente não vier (frontend antigo)
    id_cliente: Optional[int] = None
    id_modelo: Optional[int] = None  # corpo antigo (com grade_p/m/g/gg)
    itens: Optional[List[PedidoItemEntrada]] = None  # Fase 1B: modelo + cor + quantidade por tamanho
    grade_p: int = Field(0, ge=0)
    grade_m: int = Field(0, ge=0)
    grade_g: int = Field(0, ge=0)
    grade_gg: int = Field(0, ge=0)
    prazo_entrega: date
    valor_total: Decimal
    observacoes: Optional[str] = None

class CamisetaPedidoStatusUpdate(BaseModel):
    status_pedido: str

class CamisetaPedidoEntregar(BaseModel):
    data_entrega: Optional[date] = None
    recebedor: Optional[str] = None
    observacoes: Optional[str] = None

class CamisetaProdutoAcabadoResponse(BaseModel):
    id_estoque_acabado: int
    id_modelo: int
    nome_modelo: Optional[str] = None
    grade_p: int = 0
    grade_m: int = 0
    grade_g: int = 0
    grade_gg: int = 0
    quantidade_total: int = 0
    atualizado_em: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class CamisetaPedidoResponse(BaseModel):
    id_pedido: int
    codigo_pedido: str
    nome_cliente: str
    id_cliente: Optional[int] = None
    id_modelo: int
    nome_modelo: Optional[str] = None
    grade_p: int
    grade_m: int
    grade_g: int
    grade_gg: int
    quantidade_total: int
    prazo_entrega: date
    valor_total: Decimal
    status_pedido: str
    observacoes: Optional[str] = None
    data_entrega_realizada: Optional[date] = None
    criado_em: Optional[datetime] = None
    itens: List[PedidoItemResponse] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)

# ----------------- CORTE E RENDIMENTO (PCP) -----------------
class CamisetaOrdemProducaoCreate(BaseModel):
    codigo_op: Optional[str] = None  # ignorado: o servidor gera OP-AAAA-NNNN
    id_modelo: int
    cores: Optional[List[OpCorEntrada]] = None  # uma linha por cor do enfesto
    id_insumo_tecido: Optional[int] = None  # corpo antigo: uma malha só (a cor vem do rolo)
    peso_malha_enviado_kg: Optional[Decimal] = None
    pecas_planejadas: Optional[int] = None

class CamisetaOrdemProducaoFinalizarCorte(BaseModel):
    cortes: Optional[List[CorteEntrada]] = None  # OP com cores
    pecas_reais_cortadas: Optional[int] = None  # só OP antiga (sem cores)

class CamisetaOrdemProducaoResponse(BaseModel):
    id_op: int
    codigo_op: str
    id_modelo: int
    nome_modelo: Optional[str] = None
    id_insumo_tecido: Optional[int] = None
    nome_tecido: Optional[str] = None
    peso_malha_enviado_kg: Decimal
    pecas_planejadas: Optional[int] = None
    pecas_reais_cortadas: Optional[int] = None
    rendimento_real_pecas_kg: Optional[Decimal] = None
    status_op: str
    data_corte: Optional[datetime] = None
    criado_em: Optional[datetime] = None
    quantidade_enviada_costura: Optional[int] = 0
    saldo_disponivel_envio: Optional[int] = 0
    legada: bool = False
    cores: List[OpCorResponse] = Field(default_factory=list)
    cortes: List[OpCorteResponse] = Field(default_factory=list)
    tamanhos: List[TamanhoResponse] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)

# ----------------- COSTURA E FACÇÕES -----------------
class CamisetaCosturaFaccaoEnviar(BaseModel):
    id_op: int
    nome_faccao: str = Field(..., min_length=1, max_length=150)
    quantidade_enviada: Optional[int] = None  # só OP antiga (cortada sem cor e tamanho)
    itens: Optional[List[ItemEnvioEntrada]] = None  # OP cortada por SKU
    margem_seguranca_aviamentos_percentual: Decimal = Field(Decimal("3.00"), ge=0, le=100)
    observacoes: Optional[str] = None
    # Enviar mesmo com aviamento insuficiente no estoque registrado (saldo fica negativo);
    # sem isso o servidor responde 409 com as faltas.
    confirmar_saldo_insuficiente: bool = False

class CamisetaCosturaFaccaoRetornar(BaseModel):
    itens: List[ItemRetornoEntrada]  # por cor e tamanho; o que não vier conta como não devolvido
    observacoes: Optional[str] = None

class CamisetaCosturaFaccaoResponse(BaseModel):
    id_costura: int
    id_op: int
    codigo_op: Optional[str] = None
    nome_modelo: Optional[str] = None
    nome_faccao: str
    quantidade_enviada: int
    margem_seguranca_aviamentos_percentual: Decimal
    quantidade_retornada: Optional[int] = None
    perdas_pecas: Optional[int] = None
    saldo_aprovado: Optional[int] = None
    status: str
    data_envio: Optional[datetime] = None
    data_retorno: Optional[datetime] = None
    observacoes: Optional[str] = None
    avisos: List[str] = Field(default_factory=list)
    id_modelo: Optional[int] = None
    legada: bool = False
    itens: List[RemessaItemResponse] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)

# ----------------- REGISTRO FINANCEIRO -----------------
class CamisetaRegistroFinanceiroCreate(BaseModel):
    """Lançamento manual do mês: só outros custos e observações são gravados.

    Faturamento, gasto e lucro são calculados pelo sistema; se vierem no corpo,
    são ignorados (mantidos aqui só por compatibilidade com o frontend antigo).
    """
    mes_ano: str
    outros_custos_operacionais: Decimal = Decimal("0.00")
    observacoes: Optional[str] = None
    valor_gasto_materiais: Optional[Decimal] = None
    faturamento_receita: Optional[Decimal] = None
    lucro_liquido: Optional[Decimal] = None

class CamisetaRegistroFinanceiroResponse(BaseModel):
    id_registro: Optional[int] = None  # nulo quando o mês não tem lançamento manual
    mes_ano: str
    valor_gasto_materiais: Decimal
    faturamento_receita: Decimal
    outros_custos_operacionais: Decimal
    lucro_liquido: Decimal
    observacoes: Optional[str] = None
    criado_em: Optional[datetime] = None
    qtd_pedidos_entregues: int = 0
    qtd_entradas: int = 0
    model_config = ConfigDict(from_attributes=True)

class CamisetaApuracaoMensalResponse(BaseModel):
    mes_ano: str
    tem_dados_reais: bool
    gasto_materiais_real: Decimal
    faturamento_vendas_real: Decimal
    outros_custos: Decimal
    lucro_apurado: Decimal
    qtd_entradas_estoque: int
    qtd_pedidos_vendas: int

# ----------------- DASHBOARD -----------------
class CamisetaCardDestaque(BaseModel):
    producao_total_acumulada: int
    estoque_critico_quantidade: int
    tecido_maior_rendimento: Optional[str] = None   # nulo enquanto não houver corte registrado
    rendimento_medio_tecido: Optional[Decimal] = None
    estoque_pronto_total: Optional[int] = 0
    total_entregue_acumulado: Optional[int] = 0

class CamisetaItemFinanceiroMensal(BaseModel):
    mes_ano: str
    mes_nome: Optional[str] = None
    materiais_gastos: Decimal # Saídas (compra matéria-prima)
    lucro_liquido: Decimal    # Entradas líquidas
    faturamento: Decimal      # Faturamento bruto (total ganho)

class CamisetaDashboardCompletoResponse(BaseModel):
    cards: CamisetaCardDestaque
    grafico_financeiro_12_meses: List[CamisetaItemFinanceiroMensal]
