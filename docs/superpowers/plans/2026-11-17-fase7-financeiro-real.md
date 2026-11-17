# Fase 7: Financeiro Real (Despesas Categorizadas, Contas a Pagar/Receber e DRE Mensal) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar despesas operacionais categorizadas (`camisetas_despesas` com status `Pago`/`Pendente`), controle de recebimento de pedidos (`status_pagamento` e `data_pagamento` em `camisetas_pedidos`) e DRE mensal detalhado no backend e no frontend.

**Architecture:** Migração aditiva `20261117_012_financeiro_despesas_recebimentos` cria a tabela `camisetas_despesas` e adiciona `status_pagamento` e `data_pagamento` em `camisetas_pedidos`. O serviço `app/services/camisetas/financeiro.py` e as rotas `app/routers/camisetas/financeiro.py` expõem o CRUD de despesas, a baixa de pagamento de pedidos e o DRE mensal consolidado, mantendo 100% de compatibilidade com os testes e endpoints existentes da Fase 0. No frontend, `RegistroFinanceiroCamisetas.jsx` exibe o DRE do mês selecionado, o lançamento/quitação de despesas por categoria e a quitação de pedidos entregues, sem `console.error`.

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, Alembic, pytest; React 19 + Vite 8, axios, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-17-fase7-financeiro-real-design.md`

---

### Task 1: Modelo `CamisetaDespesa`, campos em `CamisetaPedido` e migração `20261117_012_financeiro_despesas_recebimentos`

**Files:**
- Modify: `backend/app/models/camisetas.py`, `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/20261117_012_financeiro_despesas_recebimentos.py`
- Test: `backend/tests/test_migracoes.py`

- [x] **Step 1: Escrever o teste de migração que falha em `tests/test_migracoes.py`**
- [x] **Step 2: Rodar e ver falhar**
- [x] **Step 3: Criar `CamisetaDespesa`, adicionar `status_pagamento` e `data_pagamento` em `CamisetaPedido` e criar a migração `012`**
- [x] **Step 4: Rodar os testes de migração e `alembic check`**
- [x] **Step 5: Commit**

---

### Task 2: Serviços, schemas e rotas — Despesas, Contas a Receber e DRE Mensal (TDD)

**Files:**
- Modify: `backend/app/schemas/camisetas.py`, `backend/app/services/camisetas/financeiro.py`, `backend/app/routers/camisetas/financeiro.py`
- Test: `backend/tests/test_financeiro_fase7.py`

- [x] **Step 1: Escrever os testes que falham em `tests/test_financeiro_fase7.py`**
- [x] **Step 2: Rodar e ver falhar**
- [x] **Step 3: Implementar os schemas, serviços e endpoints de despesas, pagamento de pedido e DRE mensal**
- [x] **Step 4: Rodar toda a suíte do backend e ver passar**
- [x] **Step 5: Commit**

---

### Task 3: Frontend — `RegistroFinanceiroCamisetas.jsx` e `RegistroFinanceiroCamisetas.css`

**Files:**
- Modify: `frontend-alfa/src/pages/RegistroFinanceiroCamisetas.jsx`, `frontend-alfa/src/pages/RegistroFinanceiroCamisetas.css`

- [x] **Step 1: Atualizar `RegistroFinanceiroCamisetas.jsx` com DRE mensal, despesas categorizadas (lançar/quitar/excluir), recebimento de pedidos e remoção de `console.error`**
- [x] **Step 2: Rodar `npm run build` e `npx oxlint src/pages/RegistroFinanceiroCamisetas.jsx`**
- [x] **Step 3: Commit**

---

### Task 4: Verificação no navegador, cobertura e notas de execução

**Files:**
- Modify: `docs/superpowers/plans/2026-11-17-fase7-financeiro-real.md`

- [x] **Step 1: Conferir cobertura `≥ 80%` e `alembic check`**
- [x] **Step 2: Verificar tela financeira no navegador automatizado**
- [x] **Step 3: Registrar notas de execução, atualizar memória de pendências de produção e commitar**

---

## Notas de execução (2026-11-17)

- **Migração `20261117_012_financeiro_despesas_recebimentos`:** cria tabela `camisetas_despesas` com índice por `id_despesa` e `mes_ano`, e adiciona `status_pagamento` (default `'Pendente'`) e `data_pagamento` em `camisetas_pedidos`. Testada com `upgrade` e `downgrade` em `tests/test_migracoes.py` e `alembic check` com 0 diferenças.
- **Backend TDD:** novos testes em `tests/test_financeiro_fase7.py` cobrindo lançamento, listagem, quitação e exclusão de despesas operacionais categorizadas, validações de negócio, atualização de status de recebimento de pedidos e cálculo do DRE mensal detalhado (`faturamento_entregas`, `receita_recebida`, `receita_a_receber`, `gasto_materiais`, `margem_bruta`, `despesas_pagas`, `despesas_pendentes`, `lucro_liquido`). Cobertura do serviço `app.services.camisetas.financeiro`: **97%**.
- **Frontend e QA no navegador:** `npm run build` e `npx oxlint` com 0 erros. Verificação automatizada via Playwright (`/camisetas/financeiro`) confirmou os cards do DRE do mês selecionado, formulário de lançamento de despesa operacional, exibição imediata na lista de despesas, quitação e contas a receber de pedidos com 0 erros de console ou página.


