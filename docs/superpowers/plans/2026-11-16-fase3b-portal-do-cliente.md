# Fase 3B: Portal do Cliente — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o cliente aprove pedidos criados pela confecção via link (`/portal/pedido/:token`) e monte novos pedidos pelo celular (`/portal/cliente/:token`) usando o catálogo visual de modelos, cores e estampas.

**Architecture:** Migração aditiva `20261116_009_portal_cliente` adiciona tokens criptográficos (`token_aprovacao` em `camisetas_pedidos` e `token_portal` em `camisetas_clientes`) e os campos de aprovação do cliente. O serviço `app/services/camisetas/portal.py` e o router `app/routers/portal_cliente.py` (`/portal`) atendem aos links externos validando o token de capacidade. No frontend, `PortalPedidoCliente.jsx` e `PortalCatalogoCliente.jsx` fornecem telas mobile-first para o cliente, enquanto `PedidoCamisetas.jsx` e `ClientesCamisetas.jsx` ganham botões para copiar os links de envio.

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, Alembic, pytest; React 19 + Vite 8, axios, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-16-fase3b-portal-do-cliente-design.md`

---

### Task 1: Modelos e migração `20261116_009_portal_cliente`

**Files:**
- Modify: `backend/app/models/camisetas.py`, `backend/app/models/camisetas_cadastros.py`
- Create: `backend/alembic/versions/20261116_009_portal_cliente.py`
- Test: `backend/tests/test_migracoes.py`

- [ ] **Step 1: Escrever o teste de migração que falha**
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Atualizar os modelos e criar a migração `20261116_009_portal_cliente`**
- [ ] **Step 4: Rodar os testes de migração e `alembic check`**
- [ ] **Step 5: Commit**

---

### Task 2: Serviço, schemas e rotas `/portal`

**Files:**
- Create: `backend/app/schemas/portal_cliente.py`, `backend/app/services/camisetas/portal.py`, `backend/app/routers/portal_cliente.py`
- Modify: `backend/app/schemas/camisetas.py`, `backend/app/schemas/camisetas_cadastros.py`, `backend/app/services/camisetas/pedidos.py`, `backend/app/services/camisetas/clientes.py`, `backend/app/main.py`
- Test: `backend/tests/test_portal_cliente.py`

- [ ] **Step 1: Escrever os testes de serviço e API em `tests/test_portal_cliente.py`**
  - Todo pedido criado e todo cliente criado ganham `token_aprovacao` e `token_portal`.
  - `GET /portal/pedido/{token}` funciona sem JWT de funcionário e traz itens, cores e `imagem_estampa_url`.
  - `POST /portal/pedido/{token}/responder` aprova ou registra `"Ajuste Solicitado"` (exigindo observação no ajuste; recusando com 409 se pedido já entregue).
  - `GET /portal/cliente/{token}` retorna catálogo ativo e recusa cliente inativo com 403.
  - `POST /portal/cliente/{token}/pedidos` cria pedido vinculado ao cliente com `status_aprovacao_cliente == "Aprovado"`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar serviço, schemas e router**
- [ ] **Step 4: Rodar toda a suíte do backend e ver passar**
- [ ] **Step 5: Commit**

---

### Task 3: Frontend — `PortalPedidoCliente.jsx`, `PortalCatalogoCliente.jsx` e links nas telas internas

**Files:**
- Create: `frontend-alfa/src/pages/PortalPedidoCliente.jsx`, `frontend-alfa/src/pages/PortalCatalogoCliente.jsx`, `frontend-alfa/src/pages/PortalCliente.css`
- Modify: `frontend-alfa/src/App.jsx`, `frontend-alfa/src/pages/PedidoCamisetas.jsx`, `frontend-alfa/src/pages/ClientesCamisetas.jsx`

- [ ] **Step 1: Criar `PortalPedidoCliente.jsx` e `PortalCatalogoCliente.jsx` com layout mobile-first**
- [ ] **Step 2: Registrar rotas em `App.jsx` e adicionar botões de link e status de aprovação em `PedidoCamisetas.jsx` e `ClientesCamisetas.jsx`**
- [ ] **Step 3: Rodar `npm run build` e `npx oxlint`**
- [ ] **Step 4: Commit**

---

### Task 4: Verificação no navegador, cobertura e notas de execução

**Files:**
- Modify: `docs/superpowers/plans/2026-11-16-fase3b-portal-do-cliente.md`

- [ ] **Step 1: Conferir cobertura `≥ 80%` e `alembic check`**
- [ ] **Step 2: Verificar aprovação e montagem de pedido pelo Portal do Cliente no navegador automatizado**
- [ ] **Step 3: Registrar notas de execução e commitar**
