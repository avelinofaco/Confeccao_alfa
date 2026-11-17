# Fase 6: Produção (Reserva por Pedido e Ligação Pedido → OP) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular a reserva de peças por SKU a partir dos pedidos em aberto (`reservado`, `disponivel`, `falta_produzir`) em Produtos Prontos e permitir vincular Ordens de Produção a pedidos comerciais (`id_pedido`).

**Architecture:** Migração aditiva `20261117_011_producao_pedido_op` acrescenta `id_pedido` em `camisetas_ordens_producao`. `app/services/camisetas/produtos_prontos.py` agrega as quantidades dos pedidos não entregues por SKU e enriquece `CelulaSku` e `LinhaProdutoPronto`. `app/services/camisetas/ordens.py` valida o pedido vinculado ao abrir a OP e avança o status do pedido para `"Em Produção"`. No frontend, `FormNovaOp.jsx`, `CorteRendimentoCamisetas.jsx` e `ProdutosProntosCamisetas.jsx` passam a mostrar o vínculo e a reserva.

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, Alembic, pytest; React 19 + Vite 8, axios, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-17-fase6-producao-design.md`

---

### Task 1: Modelo `CamisetaOrdemProducao` e migração `20261117_011_producao_pedido_op`

**Files:**
- Modify: `backend/app/models/camisetas.py`
- Create: `backend/alembic/versions/20261117_011_producao_pedido_op.py`
- Test: `backend/tests/test_migracoes.py`

- [x] **Step 1: Escrever o teste de migração que falha**
- [x] **Step 2: Rodar e ver falhar**
- [x] **Step 3: Atualizar `CamisetaOrdemProducao` e criar `20261117_011_producao_pedido_op.py`**
- [x] **Step 4: Rodar os testes de migração e `alembic check`**
- [x] **Step 5: Commit**

---

### Task 2: Serviços e schemas — reserva por SKU e vínculo Pedido → OP

**Files:**
- Modify: `backend/app/schemas/camisetas.py`, `backend/app/schemas/camisetas_sku.py`, `backend/app/services/camisetas/ordens.py`, `backend/app/services/camisetas/produtos_prontos.py`
- Test: `backend/tests/test_producao_fase6.py`

- [x] **Step 1: Escrever os testes que falham em `tests/test_producao_fase6.py`**
- [x] **Step 2: Rodar e ver falhar**
- [x] **Step 3: Implementar o cálculo de reserva em `produtos_prontos.py` e o vínculo `id_pedido` em `ordens.py`**
- [x] **Step 4: Rodar toda a suíte do backend e ver passar**
- [x] **Step 5: Commit**

---

### Task 3: Frontend — `FormNovaOp.jsx`, `CorteRendimentoCamisetas.jsx` e `ProdutosProntosCamisetas.jsx`

**Files:**
- Modify: `frontend-alfa/src/components/producao/FormNovaOp.jsx`, `frontend-alfa/src/pages/CorteRendimentoCamisetas.jsx`, `frontend-alfa/src/pages/ProdutosProntosCamisetas.jsx`

- [x] **Step 1: Adicionar seletor de pedido em aberto em `FormNovaOp.jsx` e coluna/etiqueta de pedido em `CorteRendimentoCamisetas.jsx`**
- [x] **Step 2: Exibir reservado/disponível/falta produzir em `ProdutosProntosCamisetas.jsx`**
- [x] **Step 3: Rodar `npm run build` e `npx oxlint`**
- [x] **Step 4: Commit**

---

### Task 4: Verificação no navegador, cobertura e notas de execução

**Files:**
- Modify: `docs/superpowers/plans/2026-11-17-fase6-producao.md`

- [x] **Step 1: Conferir cobertura `≥ 80%` e `alembic check`**
- [x] **Step 2: Verificar telas no navegador automatizado**
- [x] **Step 3: Registrar notas de execução e commitar**

---

## Notas de execução (2026-11-17)

- **Migração `20261117_011_producao_pedido_op`:** adiciona `id_pedido` (`FK camisetas_pedidos.id_pedido ON DELETE SET NULL`, índice `ix_camisetas_op_id_pedido`) em `camisetas_ordens_producao`. Testada com `upgrade` e `downgrade` em `tests/test_migracoes.py` e `alembic check` sem pendências.
- **Backend TDD:** 5 novos testes em `tests/test_producao_fase6.py` cobrindo cálculo de `reservado`, `disponivel` e `falta_produzir` por SKU, listagem de linhas com pedido em aberto mesmo sem `CamisetaVariacao` prévia, exclusão de pedidos entregues da reserva e vínculo Pedido → OP com avanço automático de `"Aguardando Produção"` para `"Em Produção"`. Cobertura nos serviços alterados: `ordens.py` 93%, `produtos_prontos.py` 94% (total 94%).
- **Frontend e QA no navegador:** `npm run build` e `npx oxlint` com 0 erros. Verificação automatizada via Playwright (`/camisetas/produtos-prontos` e `/camisetas/corte-rendimento`) confirmou os KPIs (`peças prontas`, `reservadas em pedidos`, `livres`, `faltam produzir`), o preenchimento automático de modelo e cores ao selecionar um pedido em aberto na abertura da OP e a exibição do código do pedido na tabela de OPs, com `0` erros de console ou de página.
