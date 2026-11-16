# Fase 4 — Precificação de Modelos e Pedidos (Segmento Camisetas)

**Data:** 2026-11-16
**Status:** aprovado pelo usuário
**Branch:** `feat/camisetas-precificacao` (a partir de `feat/camisetas-portal-cliente`)
**Roadmap:** Fase 4 de 7 (Fundação → Cadastros → Seg. → Banco de Estampas → Pedido/Portal → **Precificação** → PDF → Produção → Financeiro real)

## 1. Objetivo

Eliminar a necessidade de calcular o valor do pedido na calculadora: cada modelo de camiseta passa a ter seu **preço de venda (peça lisa)** e seu **adicional por estampa**, calculando automaticamente o preço unitário e o subtotal de cada card de item (tanto na tela interna **2. Pedidos do Cliente** quanto no **Portal do Cliente** no celular), além de exibir a margem bruta estimada na **Ficha Técnica Digital**.

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Onde fica a tabela de preços | No próprio **Modelo de Camiseta** (`preco_venda_lisa` e `acrescimo_estampa`), editável em **4. Ficha Técnica Digital**. |
| Regra do adicional de estampa | Peça lisa = `preco_venda_lisa`. Peça com estampa em 1 posição = `preco_venda_lisa + acrescimo_estampa`. Posição `"Frente e Costas"` = `preco_venda_lisa + 2 × acrescimo_estampa`. |
| Preço congelado no item do pedido | `camisetas_pedido_itens.preco_unitario` grava o valor vigente no momento do pedido, para que reajustes futuros na tabela do modelo não alterem pedidos antigos. |
| Desconto / valor negociado | Na tela interna de Pedidos, o campo `Valor Financeiro Total (R$)` acompanha a soma dos itens automaticamente, mas permite edição livre para descontos ou negociações especiais. |
| Portal do Cliente | Calcula e mostra o valor total do pedido no celular à medida que o cliente preenche as quantidades e escolhe estampas. |

## 3. Escopo

### Dentro
1. Migração `20261116_010_precificacao` adicionando `preco_venda_lisa` e `acrescimo_estampa` em `camisetas_modelos` e `preco_unitario` em `camisetas_pedido_itens` (aditiva, com `downgrade`).
2. Serviço puro `app/services/camisetas/precificacao.py` para cálculo de preço unitário do item, subtotal e total do pedido.
3. Integração em `modelos.py`, `pedido_itens.py`, `pedidos.py`, `portal.py` e `seed.py`.
4. Campos de preço e indicador de margem bruta em `FichaTecnicaCamisetas.jsx`.
5. Exibição do preço unitário e subtotal em cada card da grade de 4 colunas (`ItensPedidoEditor.jsx`) e preenchimento automático do valor total em `PedidoCamisetas.jsx` e `PortalCatalogoCliente.jsx`.

### Fora (com destino)
- Exportação de PDF do pedido (modelos Cliente/Produção/Estamparia/Facção e grade 5×5) e PDF do financeiro → **Fase 5**.

## 4. Desenho

### 4.1 Dados (migração `20261116_010_precificacao`)

```
camisetas_modelos
  + preco_venda_lisa   NUMERIC(12, 2) NOT NULL DEFAULT 0.00
  + acrescimo_estampa  NUMERIC(12, 2) NOT NULL DEFAULT 0.00

camisetas_pedido_itens
  + preco_unitario     NUMERIC(12, 2) NOT NULL DEFAULT 0.00
```

### 4.2 Regras de negócio (`services/camisetas/precificacao.py`)

- `calcular_preco_unitario(preco_venda_lisa: Decimal, acrescimo_estampa: Decimal, tem_estampa: bool, posicao_estampa: str | None) -> Decimal`:
  - Se `not tem_estampa`: devolve `preco_venda_lisa` (2 casas decimais).
  - Multiplicador = `2` se `(posicao_estampa or "").strip().casefold() == "frente e costas"` senão `1`.
  - Devolve `preco_venda_lisa + acrescimo_estampa * multiplicador`.
- Em `montar_itens` (`services/camisetas/pedido_itens.py`):
  - Se `entrada.preco_unitario` vier informado (`>= 0`), usa esse valor; caso contrário, calcula a partir do modelo, presença de estampa e posição.
- Em `criar_pedido` (`services/camisetas/pedidos.py`) e `criar_pedido_pelo_portal` (`services/camisetas/portal.py`):
  - `soma_itens = sum(item.preco_unitario * total_do_item(item) for item in itens)`.
  - Se `dados.valor_total` for omitido/`None`, grava `valor_total = soma_itens`.

## 5. Critérios de aceite

- [ ] Migração `20261116_010_precificacao` sobe, passa no `alembic check` e faz `downgrade` limpo.
- [ ] `calcular_preco_unitario` aplica preço liso, 1× acréscimo em posição simples e 2× em `"Frente e Costas"`.
- [ ] Criar pedido sem `valor_total` (ou pelo Portal do Cliente) calcula `valor_total` automaticamente pela soma dos itens.
- [ ] Na Ficha Técnica, é possível cadastrar/editar `preco_venda_lisa` e `acrescimo_estampa` e ver a margem estimada.
- [ ] Nos cards de Itens do Pedido (grade 4 colunas), o preço unitário e o subtotal aparecem em tempo real e preenchem o valor total do pedido.
