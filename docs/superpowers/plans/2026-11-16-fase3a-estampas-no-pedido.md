# Fase 3A: Estampas nos Itens do Pedido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir vincular uma estampa do Banco de Estampas e sua posição na peça a cada item do pedido de camisetas, permitindo o mesmo modelo/cor com estampas diferentes no mesmo pedido, consolidando a baixa de estoque por SKU na entrega e bloqueando a exclusão de estampas em uso.

**Architecture:** Migração aditiva `20261116_008_pedido_item_estampa` acrescenta `id_estampa` (FK `camisetas_estampas`) e `posicao_estampa` em `camisetas_pedido_itens`. `app/services/camisetas/pedido_itens.py` valida a estampa e enriquece `PedidoItemResponse`. `app/services/camisetas/pedidos.py` soma as quantidades por SKU antes da conferência e da baixa de entrega. No frontend, `ItensPedidoEditor.jsx` e `PedidoCamisetas.jsx` exibem o seletor de estampa com miniatura e posição.

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, Alembic, pytest; React 19 + Vite 8, axios, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-16-fase3a-estampas-no-pedido-design.md`

---

### Task 1: Modelo `CamisetaPedidoItem` e migração `20261116_008_pedido_item_estampa`

**Files:**
- Modify: `backend/app/models/camisetas_sku.py`
- Create: `backend/alembic/versions/20261116_008_pedido_item_estampa.py`
- Test: `backend/tests/test_migracoes.py`

- [ ] **Step 1: Escrever o teste de migração que falha**
- [ ] **Step 2: Rodar o teste e ver falhar**
- [ ] **Step 3: Atualizar `CamisetaPedidoItem` e criar a migração `20261116_008_pedido_item_estampa`**
- [ ] **Step 4: Rodar os testes de migração (`upgrade`, `downgrade`, `alembic check`) e ver passar**
- [ ] **Step 5: Commit**

---

### Task 2: Serviços e schemas — estampa no item, entrega consolidada por SKU e proteção 409

**Files:**
- Modify: `backend/app/schemas/camisetas_sku.py`, `backend/app/services/camisetas/pedido_itens.py`, `backend/app/services/camisetas/pedidos.py`, `backend/app/services/camisetas/estampas.py`, `backend/app/routers/camisetas/seed.py`
- Test: `backend/tests/test_pedido_itens.py`, `backend/tests/test_pedidos.py`, `backend/tests/test_estampas.py`

- [ ] **Step 1: Escrever os testes que falham**
  - Item com estampa e posição padrão `"Frente"` quando posição omitida; item liso limpa posição.
  - Dois itens de mesmo modelo e cor com estampas ou posições diferentes são aceitos no mesmo pedido; com mesma estampa e posição são recusados (400).
  - Estampa inativa (400) ou inexistente (404) recusada no pedido.
  - Entrega de pedido com dois itens do mesmo modelo/cor/tamanho soma a necessidade do SKU antes de validar saldo e lançar `SAIDA_ENTREGA`.
  - Excluir estampa vinculada a item de pedido retorna `409`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar as regras nos serviços e schemas**
- [ ] **Step 4: Rodar toda a suíte do backend e ver passar**
- [ ] **Step 5: Commit**

---

### Task 3: Frontend — estampa e posição no editor e na listagem de pedidos

**Files:**
- Modify: `frontend-alfa/src/utils/pedidoItens.js`, `frontend-alfa/src/components/pedidos/ItensPedidoEditor.jsx`, `frontend-alfa/src/components/pedidos/ModalItensPedido.jsx`, `frontend-alfa/src/components/pedidos/pedidos.css`, `frontend-alfa/src/pages/PedidoCamisetas.jsx`, `frontend-alfa/src/components/cadastros/PainelEstampas.jsx`

- [ ] **Step 1: Atualizar `pedidoItens.js` (chave com estampa e posição, resumo e consolidação de entrega por SKU)**
- [ ] **Step 2: Atualizar `ItensPedidoEditor.jsx`, `ModalItensPedido.jsx`, `PedidoCamisetas.jsx` e `PainelEstampas.jsx`**
- [ ] **Step 3: Rodar `npm run build` e `npx oxlint`**
- [ ] **Step 4: Commit**

---

### Task 4: Verificação no navegador, cobertura e notas de execução

**Files:**
- Modify: `docs/superpowers/plans/2026-11-16-fase3a-estampas-no-pedido.md`

- [ ] **Step 1: Conferir cobertura `≥ 80%` e `alembic check`**
- [ ] **Step 2: Verificar criação de pedido com estampa no navegador automatizado**
- [ ] **Step 3: Registrar notas de execução e commitar**
