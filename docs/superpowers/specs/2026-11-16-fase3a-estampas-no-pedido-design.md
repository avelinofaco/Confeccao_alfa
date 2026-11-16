# Fase 3A — Estampas nos Itens do Pedido (Segmento Camisetas)

**Data:** 2026-11-16
**Status:** aprovado pelo usuário
**Branch:** `feat/camisetas-pedido-estampas` (a partir de `feat/camisetas-estampas`)
**Roadmap:** Fase 3 dividida em **3A (estampas e posição nos itens do pedido — este documento)** e **3B (Portal do Cliente: aprovação por link e montagem de pedido pelo celular)**.

## 1. Objetivo

Permitir que cada item do pedido de camisetas seja liso ou tenha uma **estampa do Banco de Estampas** com a **posição de aplicação** na peça (`Frente`, `Costas`, `Peito Esquerdo`, etc.). Dois itens do mesmo pedido podem usar o mesmo modelo e cor com estampas diferentes, e a entrega consolida a baixa por SKU físico para nunca estourar o estoque pronto.

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Camiseta lisa × estampada | `id_estampa` é opcional no item do pedido: vazio significa camiseta lisa. |
| Posição da estampa | Quando `id_estampa` é informado, `posicao_estampa` indica onde aplicar (padrão `"Frente"` se não informada). Sem estampa, `posicao_estampa` fica nula. |
| Mesmo modelo e cor com estampas diferentes | Permitido no mesmo pedido: a chave que não pode repetir entre itens passa a ser `(id_modelo, id_cor, id_estampa, posicao_estampa)`. |
| Baixa no estoque pronto (entrega) | Como o estoque pronto é por SKU liso (`modelo + cor + tamanho`), a conferência e a baixa na entrega **somam as quantidades por SKU** entre todos os itens do pedido. |
| Exclusão de estampa em uso | Bloqueada com `409 "Estampa em uso por pedidos; inative-a em vez de excluir."`, e a tela oferece inativar. |

## 3. Escopo

### Dentro
1. Migração `20261116_008_pedido_item_estampa` adicionando `id_estampa` e `posicao_estampa` em `camisetas_pedido_itens` (aditiva, com `downgrade` via `batch_alter_table`).
2. Validação de estampa existente e ativa nos itens do pedido (`services/camisetas/pedido_itens.py`).
3. Chave de unicidade do item por `(id_modelo, id_cor, id_estampa, posicao_estampa)` e consolidação de baixa por SKU em `_baixas_do_pedido` (`services/camisetas/pedidos.py`).
4. Bloqueio de exclusão (`409`) em `excluir_estampa` quando a estampa está vinculada a algum item de pedido.
5. Resposta do item do pedido (`PedidoItemResponse`) enriquecida com `id_estampa`, `codigo_estampa`, `nome_estampa`, `imagem_estampa_url` (`imagem_data_url`) e `posicao_estampa`.
6. Editor de itens do pedido (`ItensPedidoEditor.jsx`, `ModalItensPedido.jsx`, `PedidoCamisetas.jsx`) com escolha de estampa, miniatura visual, seletor de posição e consolidação de SKUs no modal de entrega.

### Fora (com destino)
- Link público para o cliente aprovar o pedido e montar pedido pelo celular → **Fase 3B (Portal do Cliente)**.
- Acréscimo automático de preço por estampa → **Fase 4 (Precificação)**.
- Exportação da folha A4 com grade 5×5 de estampas → **Fase 5 (PDF)**.

## 4. Desenho

### 4.1 Dados (migração `20261116_008_pedido_item_estampa`)

```
camisetas_pedido_itens
  + id_estampa       INTEGER FK camisetas_estampas(id_estampa) ON DELETE RESTRICT NULL
  + posicao_estampa  VARCHAR(40) NULL
```

### 4.2 Regras de negócio

- **Validação no item (`services/camisetas/pedido_itens.py`)**:
  - Se `id_estampa` for `None`: `posicao_estampa = None`.
  - Se `id_estampa` vier preenchido: busca a estampa (`404` se não existir); se `not estampa.ativo`, recusa com `400 "A estampa {estampa.nome} está inativa; escolha outra para o item {numero}."`.
  - `posicao_estampa`: aparada; se vazia quando há `id_estampa`, assume `"Frente"`.
  - Dois itens no mesmo pedido com a mesma combinação `(id_modelo, id_cor, id_estampa, posicao_normalizada)` → `400 "O item {numero} repete modelo, cor e estampa de outro item; junte as quantidades num item só."`.
- **Entrega consolidada por SKU (`services/camisetas/pedidos.py`)**:
  - `_baixas_do_pedido` agrupa as quantidades de todos os itens por `(id_modelo, id_cor, id_tamanho)`, mantendo a ordem de aparição. Se dois itens pedem 10 e 15 peças de `Básica · Preto · M`, a entrega exige e baixa 25 peças de uma só vez daquele SKU.
- **Proteção de estampa (`services/camisetas/estampas.py`)**:
  - `excluir_estampa` verifica `db.query(CamisetaPedidoItem.id_item).filter_by(id_estampa=id_estampa).first()`; se existir, lança `ErroNegocio(409, "Estampa em uso por pedidos; inative-a em vez de excluir.")`.

### 4.3 Telas

- **`ItensPedidoEditor.jsx`**:
  - Recebe `estampas` (ativas) e mostra em cada item os campos **Estampa (opcional)** e **Posição na peça** (`Frente`, `Costas`, `Peito Esquerdo`, `Peito Direito`, `Manga Esquerda`, `Manga Direita`, `Nuca`, `Frente e Costas`), além da miniatura da arte escolhida.
- **`PedidoCamisetas.jsx` e `ModalItensPedido.jsx`**:
  - Carregam `/camisetas/estampas/` junto com modelos e cores; exibem no resumo do pedido a estampa e a posição de cada item.
- **`PainelEstampas.jsx`**:
  - Ao receber `409` na exclusão, pergunta se o usuário deseja inativar a estampa.

## 5. Critérios de aceite

- [ ] Migração `20261116_008_pedido_item_estampa` sobe, passa no `alembic check` e faz `downgrade` limpo.
- [ ] Pedido pode ter item liso, item estampado, e dois itens do mesmo modelo/cor com estampas ou posições diferentes.
- [ ] Estampa inativa ou inexistente é recusada ao criar/editar itens do pedido.
- [ ] Entrega de pedido com dois itens do mesmo modelo/cor/tamanho soma a necessidade por SKU antes de conferir o saldo e baixar.
- [ ] Estampa usada em pedido não pode ser excluída (`409`), oferecendo inativação na tela.
- [ ] Suíte de testes passando, cobertura `≥ 80%` em `app/services/`, `npm run build` e `npx oxlint` sem erros, e fluxo verificado no navegador.
