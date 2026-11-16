# Fase 2: Banco de Estampas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o catálogo visual de estampas do segmento Camisetas, guardando a imagem (PNG, JPG ou WEBP até 2 MB) diretamente no banco de dados, com código automático (`EST-AAAA-NNNN`) ou personalizado, busca instantânea por nome/código e aba dedicada na Ficha Técnica Digital.

**Architecture:** Modelo `CamisetaEstampa` em `app/models/camisetas_estampas.py` com migração aditiva `20261116_007_estampas`. Toda a validação de imagem (assinatura mágica dos bytes, tamanho máximo de 2 MB, codificação data URL) e regras de negócio ficam isoladas em `app/services/camisetas/estampas.py`. O router `app/routers/camisetas/estampas.py` expõe o CRUD e a rota binária de imagem sob `/camisetas/estampas/`, herdando automaticamente a proteção de `usuario_atual`. No frontend, `PainelEstampas.jsx` entra como quarta aba em `FichaTecnicaCamisetas.jsx`.

**Tech Stack:** Python 3.14, FastAPI 0.143, SQLAlchemy 2.1, Alembic, pytest; React 19 + Vite 8, axios, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-16-fase2-banco-estampas-design.md`

---

### Task 1: Modelo `CamisetaEstampa` e migração `20261116_007_estampas`

**Files:**
- Create: `backend/app/models/camisetas_estampas.py`
- Create: `backend/alembic/versions/20261116_007_estampas.py`
- Modify: `backend/app/models/__init__.py` (se aplicável), `backend/alembic/env.py`, `backend/app/main.py`
- Test: `backend/tests/test_migracoes.py`

- [ ] **Step 1: Escrever o teste de migração que falha**
  Adicionar `test_migracao_estampas_sobe_e_desce` em `backend/tests/test_migracoes.py` verificando que `20261116_007_estampas` cria a tabela `camisetas_estampas` e faz downgrade para `20261110_006_estoque_sku`.
- [ ] **Step 2: Rodar o teste e ver falhar**
  Run: `cd backend && venv/bin/python -m pytest tests/test_migracoes.py -q`
- [ ] **Step 3: Criar o modelo e a migração**
  Implementar `CamisetaEstampa` em `backend/app/models/camisetas_estampas.py`, importar em `backend/alembic/env.py` e `backend/app/main.py`, e criar `backend/alembic/versions/20261116_007_estampas.py`.
- [ ] **Step 4: Rodar os testes de migração e ver passar**
  Run: `cd backend && venv/bin/python -m pytest tests/test_migracoes.py -q`
- [ ] **Step 5: Commit**

---

### Task 2: Serviço e schemas do Banco de Estampas

**Files:**
- Create: `backend/app/schemas/camisetas_estampas.py`
- Create: `backend/app/services/camisetas/estampas.py`
- Test: `backend/tests/test_estampas.py`

- [ ] **Step 1: Escrever os testes unitários e de serviço que falham**
  Testar em `backend/tests/test_estampas.py`:
  - `decodificar_imagem_estampa`: aceita PNG, JPEG e WEBP válidos (com ou sem prefixo `data:image/...;base64,`); recusa formato desconhecido (400), base64 inválido (400), vazio (400) e arquivo > 2 MB (400).
  - `criar_estampa`: gera código `EST-AAAA-0001` quando não informado; normaliza código informado; recusa código duplicado sem diferenciar maiúsculas (409).
  - `listar_estampas`: filtra por busca em nome (sem acento) ou código; filtra inativas por padrão.
  - `atualizar_estampa`: altera nome/código/observações/ativo mantendo a imagem quando `imagem_data_url` é omitida, ou substitui a imagem quando enviada.
- [ ] **Step 2: Rodar e ver falhar**
  Run: `cd backend && venv/bin/python -m pytest tests/test_estampas.py -q`
- [ ] **Step 3: Implementar schemas e serviço**
- [ ] **Step 4: Rodar e ver passar**
  Run: `cd backend && venv/bin/python -m pytest tests/test_estampas.py -q`
- [ ] **Step 5: Commit**

---

### Task 3: Rotas `/camisetas/estampas/` e seed de demonstração

**Files:**
- Create: `backend/app/routers/camisetas/estampas.py`
- Modify: `backend/app/routers/camisetas/__init__.py`, `backend/app/routers/camisetas/seed.py`
- Modify: `backend/tests/test_rotas_camisetas.py`, `backend/tests/test_estampas.py`

- [ ] **Step 1: Escrever os testes de API que falham**
  Adicionar em `backend/tests/test_estampas.py` testes para `POST /camisetas/estampas/`, `GET /camisetas/estampas/`, `GET /camisetas/estampas/{id}`, `GET /camisetas/estampas/{id}/imagem`, `PUT /camisetas/estampas/{id}`, `DELETE /camisetas/estampas/{id}` e recusa 401 sem token. Atualizar `ROTAS_ESPERADAS` em `backend/tests/test_rotas_camisetas.py`.
- [ ] **Step 2: Rodar e ver falhar**
- [ ] **Step 3: Implementar o router e incluir estampas no seed**
- [ ] **Step 4: Rodar toda a suíte do backend e ver passar**
  Run: `cd backend && venv/bin/python -m pytest -q`
- [ ] **Step 5: Commit**

---

### Task 4: Frontend — `PainelEstampas.jsx` na Ficha Técnica Digital

**Files:**
- Create: `frontend-alfa/src/components/cadastros/PainelEstampas.jsx`
- Modify: `frontend-alfa/src/components/cadastros/cadastros.css`, `frontend-alfa/src/pages/FichaTecnicaCamisetas.jsx`

- [ ] **Step 1: Criar `PainelEstampas.jsx` e estilos em `cadastros.css`**
  Formulário com upload de imagem (PNG/JPG/WEBP até 2 MB), prévia instantânea, código opcional, nome e observações; barra de busca e filtro de inativas; grade de cartões com miniatura, código, nome, modal de ampliação, edição e exclusão com `useConfirm` e `useToast`.
- [ ] **Step 2: Integrar a aba `Estampas` em `FichaTecnicaCamisetas.jsx`**
- [ ] **Step 3: Rodar build e lint**
  Run: `cd frontend-alfa && npm run build && npx oxlint`
- [ ] **Step 4: Commit**

---

### Task 5: Verificação final no navegador, cobertura e documentação

**Files:**
- Modify: `docs/superpowers/plans/2026-11-16-fase2-banco-estampas.md`

- [x] **Step 1: Conferir cobertura `≥ 80%` e `alembic check`**
- [x] **Step 2: Verificar a aba Estampas no navegador automatizado**
- [x] **Step 3: Registrar notas de execução e commitar**

---

## Notas de execução

Fase 2 executada em 2026-11-16 na branch `feat/camisetas-estampas` (a partir de `feat/camisetas-seguranca`), seguindo as 5 tasks em TDD.

**Resultado:**
- **243 testes passando** (eram 228 após Segurança); cobertura de `app/services/camisetas/estampas.py` em **98%** e de `app/services/` geral em **97%**.
- Migração `20261116_007_estampas` testada em subida, descida (`downgrade`) e `alembic check` sem diferenças.
- Validação real de bytes mágicos (`PNG`, `JPEG`, `WEBP`) e limite de 2 MB implementados e cobertos por testes unitários.
- Código sequencial `EST-AAAA-NNNN` gerado via `proximo_codigo(db, "EST")` quando omitido, ou validado como único quando informado.
- Aba **Estampas** (`PainelEstampas.jsx`) integrada em **4. Ficha Técnica Digital**, conferida no navegador real (`browser.mjs`): login → Ficha Técnica → aba Estampas → upload de PNG → cadastro → modal de ampliação → fechar com `Escape`, com **zero erros de console e zero requisições falhas**.

