# Sugestão de compra de insumos

**Data:** 2026-11-26
**Objetivo:** em Estoque e Insumos, recomendar quanto tecido e quanto de cada aviamento comprar,
com o custo estimado, a partir dos pedidos que vão entrar em produção.

## Problema

Hoje o usuário vê saldo e custo médio por insumo, mas não vê o que precisa comprar. A necessidade
só aparece quando já é tarde: na abertura da OP o tecido é descontado do rolo e pode ficar negativo,
e no envio à facção `listar_faltas()` avisa que faltam aviamentos — com o lote já cortado.

## Dado de entrada que já existe

| Fonte | Campo | Uso |
|---|---|---|
| `CamisetaModelo` | `consumo_tecido_kg` | kg de tecido por peça (fallback) |
| `CamisetaOrdemProducao` | `rendimento_real_pecas_kg` | peças/kg real das OPs já cortadas |
| `CamisetaFichaTecnica` | `consumo_unitario`, `id_insumo`, `tipo_insumo` | consumo de aviamento por peça |
| `CamisetaFichaTecnica` | `custo_unitario_estimado` | preço de referência quando não há custo médio |
| `CamisetaInsumo` | `saldo_atual`, `estoque_minimo`, `preco_custo_medio`, `id_cor` | saldo, piso e preço |
| `CamisetaPedidoItem` | `id_modelo`, `id_cor` + `quantidades` | peças por modelo e cor |
| `CamisetaCosturaFaccao` | `quantidade_enviada` | peças que já consumiram aviamento |

Primitivas reaproveitadas: `calcular_necessidades()` e `NecessidadeAviamento` de
`services/camisetas/estoque.py`.

## Decisão central: os dois insumos têm momentos de consumo diferentes

Isto define todo o recorte e foi verificado no código:

- **Tecido** é baixado em `abrir_op()` (`ordens.py`), na *criação* da OP, pelo peso do enfesto.
- **Aviamento** é baixado em `enviar_remessa()` (`costura.py`), no *envio à facção*, pela
  quantidade enviada × consumo da ficha × margem.

Logo:

- **Tecido**: entram só pedidos **sem nenhuma OP**. Incluir pedido "Em Produção" contaria duas
  vezes, porque a OP dele já tirou a malha do estoque.
- **Aviamento**: entram as **peças ainda não enviadas à facção**, descontando o que já saiu em
  remessa. Pedido "Em Produção" sem remessa ainda precisa de aviamento.

Pedidos candidatos: `status_pedido` em `("Aguardando Produção", "Em Produção")`.
`Pronto no Estoque` e `Entregue` ficam fora — já foram produzidos.

## Cálculo

### Tecido

Por item de pedido candidato sem OP, agrupado por cor:

```
kg_por_peca = 1 / rendimento_medio(modelo)      se houver OP cortada com rendimento > 0
            = modelo.consumo_tecido_kg           caso contrário (com margem de segurança)
necessario_kg(cor) = Σ (peças do item × kg_por_peca)
```

`rendimento_medio(modelo)` = média de `rendimento_real_pecas_kg` das OPs daquele modelo com valor
maior que zero. Esse número já embute a perda do enfesto, **por isso a margem de segurança não é
aplicada nesse caminho** — só no fallback do cadastro.

O insumo de cada cor é o `ROLO_TECIDO` com `id_cor` igual à do item; havendo mais de um, o de maior
saldo. Item com `id_cor` nulo não entra: não se compra malha sem saber a cor — gera alerta.

### Aviamentos

Por modelo, sobre as peças pendentes de envio:

```
pecas_pendentes(pedido) = max(0, total_de_peças − Σ quantidade_enviada das remessas das OPs do pedido)
necessario(insumo) = Σ por modelo de calcular_necessidades(ficha_sem_tecido, pecas_pendentes, margem)
```

### Quanto comprar e quanto custa

Igual para tecido e aviamento:

```
comprar = arredondar(max(0, necessario − saldo_atual + estoque_minimo), unidade)
preco_referencia = preco_custo_medio            se > 0
                 = custo_unitario_estimado       se > 0   (origem: "estimado na ficha")
                 = 0                             (origem: "sem preço", gera alerta)
custo_estimado = comprar × preco_referencia
```

O `estoque_minimo` entra como piso: depois da compra o saldo não fica abaixo do mínimo cadastrado.

**Granularidade da compra.** Com `embalagem_compra` cadastrada no insumo, a compra sobe para o
próximo múltiplo da embalagem: precisando de 215 etiquetas e havendo só caixa de 1000, pede
1000. A resposta devolve `embalagens` (quantas caixas) e `sobra` (o que fica na prateleira),
senão o salto no número parece erro. O `custo_estimado` cobra a embalagem inteira, que é o que
se paga. **Vale só para aviamento** — ver Fora de escopo.

Sem embalagem cadastrada, insumo contado em peças (`unidades` e variações) sobe para o
inteiro seguinte — 215 etiquetas, não 214,5. Arredonda **para cima** porque faltar aviamento
para a produção custa muito mais que sobrar meia dúzia de etiquetas. `kg` e `metros` são
vendidos fracionados e mantêm as 3 casas: arredondar 56,027 kg de malha para 57 kg pediria
material a mais sem motivo. Unidade desconhecida fica fracionada, pelo mesmo cuidado.

A `necessario` **não** é arredondada: ela continua mostrando a necessidade real (514,5),
para a conta ficar auditável; o arredondamento aparece só em `comprar`.

## Componentes

### `services/camisetas/sugestao_compra.py` (novo)

Dataclasses imutáveis e funções puras onde possível; as consultas ficam em funções próprias.

```python
@dataclass(frozen=True)
class LinhaSugestao:
    id_insumo: int | None
    codigo: str
    descricao: str
    unidade: str
    nome_cor: str | None
    necessario: Decimal
    saldo_atual: Decimal
    estoque_minimo: Decimal
    comprar: Decimal
    preco_referencia: Decimal
    origem_preco: str          # "custo médio" | "estimado na ficha" | "sem preço"
    custo_estimado: Decimal
    pecas: int

@dataclass(frozen=True)
class PedidoConsiderado:
    codigo_pedido: str
    nome_cliente: str
    status_pedido: str
    prazo_entrega: date
    pecas: int
    conta_tecido: bool         # False quando o pedido já tem OP
    pecas_pendentes_aviamento: int

@dataclass(frozen=True)
class SugestaoCompra:
    tecidos: list[LinhaSugestao]
    aviamentos: list[LinhaSugestao]
    total_estimado: Decimal
    pedidos_considerados: list[PedidoConsiderado]
    alertas: list[str]
```

Função de entrada: `sugerir_compra(db, margem_percentual: Decimal) -> SugestaoCompra`.

### Endpoint

`GET /camisetas/insumos/sugestao-compra/?margem_percentual=5` no router de insumos,
autenticado como o resto do módulo. Schema `CamisetaSugestaoCompraResponse`.

### UI

Painel em `EstoqueCamisetas.jsx`: card com o total estimado, tabela de tecidos (cor, necessário,
saldo, comprar, R$), tabela de aviamentos, pedidos considerados em bloco colapsável e a lista de
alertas. Campo para ajustar a margem, com recarga.

O lançamento da nota continua pelo botão de entrada rápida que já existe — o painel só recomenda.

## Alertas em vez de silêncio

- item de pedido sem cor definida (quantas peças e qual pedido)
- modelo sem item "Tecido Principal" na ficha técnica
- cor sem nenhum rolo de tecido cadastrado
- insumo sem custo médio e sem custo estimado na ficha
- modelo sem nenhuma OP cortada (kg vindo do cadastro, não do rendimento real)

## Testes

`backend/tests/test_sugestao_compra.py`, escritos antes da implementação:

1. tecido de pedido "Aguardando Produção" entra na sugestão
2. tecido de pedido que já tem OP **não** entra (a OP já baixou o rolo)
3. aviamento de pedido "Em Produção" sem remessa entra
4. aviamento desconta as peças já enviadas à facção
5. kg/peça vem do rendimento real quando há OP cortada
6. kg/peça cai no `consumo_tecido_kg` quando não há histórico, aí com margem
7. `comprar` desconta saldo e mantém o estoque mínimo como piso
8. `comprar` nunca é negativo quando o saldo cobre a necessidade
9. item sem cor gera alerta e não entra no tecido
10. preço cai do custo médio para o estimado da ficha e depois para alerta
11. `total_estimado` é a soma dos custos das linhas
12. pedido "Entregue" e "Pronto no Estoque" ficam fora
13. endpoint responde 200 com o corpo esperado e 401 sem token

## Fora de escopo

- Despesas operacionais projetadas (facção, estamparia) — descartado pelo usuário
- Lead time de fornecedor e data sugerida de compra
- Botão de lançar entrada direto da sugestão — descartado pelo usuário
- **Embalagem fechada em rolo de malha**: `embalagem_compra` existe, mas a sugestão a ignora
  em `ROLO_TECIDO`. Rolo de malha não tem peso fixo na vida real — você compra "um rolo" e ele
  vem com 23,4 kg —, então fixar 25 kg no cadastro criaria uma sugestão falsamente precisa.
  Decisão do usuário em 2026-11-26.
