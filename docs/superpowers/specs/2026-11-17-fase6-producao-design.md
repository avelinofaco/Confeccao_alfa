# Fase 6 — Produção: Reserva por Pedido e Ligação Pedido → OP (Segmento Camisetas)

**Data:** 2026-11-17
**Status:** aprovado pelo usuário
**Branch:** `feat/camisetas-producao-op` (a partir de `feat/camisetas-pdf-pedido`)
**Roadmap:** Fase 6 de 7 (Fundação → Cadastros → Seg. → Banco de Estampas → Pedido/Portal → Precificação → PDF → **Produção** → Financeiro real)

## 1. Objetivo

Conectar os pedidos comerciais ao chão de fábrica e ao estoque de produtos prontos:
1. **Reserva por pedido em Produtos Prontos**: mostrar para cada SKU (`modelo + cor + tamanho`) quanto há em estoque físico (`saldo`), quanto está comprometido com pedidos em aberto (`reservado`), quanto está livre para pronta-entrega (`disponivel`) e quanto falta produzir (`falta_produzir`).
2. **Ligação Pedido → Ordem de Produção (OP)**: permitir abrir uma OP vinculada a um pedido em aberto (`id_pedido`), preenchendo modelo e cores a partir do pedido e avançando automaticamente o status do pedido de `"Aguardando Produção"` para `"Em Produção"`.

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Como calcular a reserva por SKU | **Calculada na hora** a partir dos itens de pedidos com `status_pedido != "Entregue"` (mesmo princípio do financeiro da Fase 0: nunca desatualiza quando itens são editados, pedidos são excluídos ou entregues). |
| Linha sem estoque mas com pedido | Aparece em **8. Produtos Prontos** com `saldo = 0`, `reservado = X` e `falta_produzir = X`, para que o fabricante enxergue toda a demanda mesmo do que nunca entrou no estoque. |
| Vínculo Pedido → OP | Opcional (`id_pedido` nulo para produção de reposição de estoque; preenchido quando a OP atende a um pedido específico). |
| Avanço de status do pedido | Ao abrir OP ligada a um pedido em `"Aguardando Produção"`, o pedido passa automaticamente para `"Em Produção"`. |

## 3. Escopo

### Dentro
1. Migração `20261117_011_producao_pedido_op` adicionando `id_pedido` (`FK camisetas_pedidos ON DELETE SET NULL`) em `camisetas_ordens_producao`.
2. Cálculo de `reservado`, `disponivel` e `falta_produzir` por SKU em `app/services/camisetas/produtos_prontos.py` e nos schemas `CelulaSku` / `LinhaProdutoPronto`.
3. Vínculo `id_pedido` em `abrir_op` (`app/services/camisetas/ordens.py`) com validação de pedido não entregue e atualização para `"Em Produção"`.
4. Tela **6. Corte & Rendimento** (`FormNovaOp.jsx` e `CorteRendimentoCamisetas.jsx`): seletor de pedido em aberto que preenche modelo e cores da OP e exibe o pedido vinculado na tabela de OPs.
5. Tela **8. Produtos Prontos** (`ProdutosProntosCamisetas.jsx`): exibição de reservado, livre e falta produzir na grade e nos KPIs.

### Fora (com destino)
- Contas a pagar/receber, DRE completo e entrega parcial com romaneio → **Fase 7 (Financeiro real)**.

## 4. Critérios de aceite

- [ ] Migração `20261117_011_producao_pedido_op` sobe, passa no `alembic check` e faz `downgrade` limpo.
- [ ] `GET /camisetas/produtos-prontos/` devolve `reservado`, `disponivel` e `falta_produzir` corretos por SKU e inclui combinações modelo × cor que têm pedido aberto mesmo sem estoque físico.
- [ ] `POST /camisetas/ordens/` com `id_pedido` vincula a OP ao pedido, avança o pedido para `"Em Produção"` e recusa pedido já `"Entregue"` com `400`.
- [ ] Ao entregar ou excluir o pedido, a reserva daquele pedido deixa de contar imediatamente.
- [ ] Telas de Corte & Rendimento e Produtos Prontos exibem os novos dados sem erros de console.
