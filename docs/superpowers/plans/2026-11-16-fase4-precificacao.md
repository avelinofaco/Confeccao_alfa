# Fase 4: Precificação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatizar o cálculo de preço unitário e total dos pedidos a partir do preço base de venda (`preco_venda_lisa`) e adicional por estampa (`acrescimo_estampa`) de cada modelo, exibindo subtotal em cada card de item e margem estimada na Ficha Técnica.

**Architecture:** Migração aditiva `20261116_010_precificacao` acrescenta `preco_venda_lisa` e `acrescimo_estampa` em `camisetas_modelos` e `preco_unitario` em `camisetas_pedido_itens`. O serviço `app/services/camisetas/precificacao.py` concentra a regra pura de cálculo e é consumido por `pedido_itens.py`, `pedidos.py` e `portal.py`. No frontend, `FichaTecnicaCamisetas.jsx`, `ItensPedidoEditor.jsx`, `PedidoCamisetas.jsx` e `PortalCatalogoCliente.jsx` calculam e exibem os preços em tempo real.

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, Alembic, pytest; React 19 + Vite 8, axios, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-16-fase4-precificacao-design.md`

---

### Task 1: Modelos e migração `20261116_010_precificacao`

**Files:**
- Modify: `backend/app/models/camisetas.py`, `backend/app/models/camisetas_sku.py`
- Create: `backend/alembic/versions/20261116_010_precificacao.py`
- Test: `backend/tests/test_migracoes.py`

- [ ] **Step 1: Escrever o teste de migração que falha**
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Atualizar modelos e criar a migração `20261116_010_precificacao`**
- [ ] **Step 4: Rodar os testes de migração e `alembic check`**
- [ ] **Step 5: Commit**

---

### Task 2: Serviço `precificacao.py`, schemas e integração nos pedidos e portal

**Files:**
- Create: `backend/app/services/camisetas/precificacao.py`
- Modify: `backend/app/schemas/camisetas.py`, `backend/app/schemas/camisetas_sku.py`, `backend/app/services/camisetas/modelos.py`, `backend/app/services/camisetas/pedido_itens.py`, `backend/app/services/camisetas/pedidos.py`, `backend/app/services/camisetas/portal.py`, `backend/app/routers/camisetas/seed.py`
- Test: `backend/tests/test_precificacao.py`

- [ ] **Step 1: Escrever os testes unitários e de API em `tests/test_precificacao.py`**
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar `precificacao.py` e integrar em modelos, itens, pedidos e portal**
- [ ] **Step 4: Rodar toda a suíte do backend e ver passar**
- [ ] **Step 5: Commit**

---

### Task 3: Frontend — Preços na Ficha Técnica, nos Cards de Itens e no Pedido/Portal

**Files:**
- Modify: `frontend-alfa/src/utils/pedidoItens.js`, `frontend-alfa/src/components/pedidos/ItensPedidoEditor.jsx`, `frontend-alfa/src/components/pedidos/pedidos.css`, `frontend-alfa/src/pages/PedidoCamisetas.jsx`, `frontend-alfa/src/pages/PortalCatalogoCliente.jsx`, `frontend-alfa/src/pages/FichaTecnicaCamisetas.jsx`

- [ ] **Step 1: Adicionar funções de cálculo de preço unitário, subtotal e total em `pedidoItens.js`**
- [ ] **Step 2: Atualizar `ItensPedidoEditor.jsx`, `PedidoCamisetas.jsx`, `PortalCatalogoCliente.jsx` e `FichaTecnicaCamisetas.jsx`**
- [ ] **Step 3: Rodar `npm run build` e `npx oxlint`**
- [ ] **Step 4: Commit**

---

### Task 4: Verificação no navegador, cobertura e notas de execução

**Files:**
- Modify: `docs/superpowers/plans/2026-11-16-fase4-precificacao.md`

- [x] **Step 1: Conferir cobertura `≥ 80%` e `alembic check`**
- [x] **Step 2: Verificar precificação no navegador automatizado**
- [x] **Step 3: Registrar notas de execução e commitar**

---

## Notas de execução

Fase 4 executada em 2026-11-16 na branch `feat/camisetas-precificacao` (a partir de `feat/camisetas-portal-cliente`), seguindo as 4 tasks em TDD.

**Resultado:**
- **261 testes passando** (eram 255 após Fase 3B); cobertura de `app/services/camisetas/precificacao.py` em **100%** e geral de `app/services/` em **96%**.
- Migração `20261116_010_precificacao` testada em subida, descida (`downgrade`) e `alembic check` sem diferenças.
- Preço unitário por modelo (`preco_venda_lisa` + `acrescimo_estampa` simples ou dobrado em `"Frente e Costas"`) calculado tanto no backend quanto em tempo real nos cards de itens do pedido.
- Conferido no navegador real (`browser.mjs`): edição de preço do modelo na Ficha Técnica (`R$ 30,00` lisa + `R$ 5,00` estampa) e preenchimento automático nos cards de Pedidos (`R$ 35,00/un · R$ 350,00` e campo `Valor Financeiro Total` preenchido com `350.00`), **zero erros de console**.


