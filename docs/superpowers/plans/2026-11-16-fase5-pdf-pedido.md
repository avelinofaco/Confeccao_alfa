# Fase 5: PDF do Pedido (Grade 4×4 por Folha A4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exportar o PDF do pedido de camisetas com 4 perfis (`Cliente`, `Produção`, `Estamparia`, `Facção`), checkboxes de personalização e grade visual 4×4 por folha A4 (até 16 quadros por página com imagem da estampa, modelo/cor, posição e quantidades por tamanho).

**Architecture:** `frontend-alfa/src/utils/pdfPedido.js` define os presets de perfis, a paginação 4×4 (`16` itens por folha A4) e a geração do HTML de impressão A4. `frontend-alfa/src/components/pedidos/ModalPdfPedido.jsx` apresenta os botões de perfil, os checkboxes e uma pré-visualização ao vivo da folha A4 com a grade 4×4 antes de acionar a janela de impressão. `PedidoCamisetas.jsx` e `PortalPedidoCliente.jsx` expõem o botão de exportação.

**Tech Stack:** React 19 + Vite 8, CSS `@page { size: A4 portrait }`, oxlint.

**Spec:** `docs/superpowers/specs/2026-11-16-fase5-pdf-pedido-design.md`

---

### Task 1: Utilitário `pdfPedido.js` e componente `ModalPdfPedido.jsx`

**Files:**
- Create: `frontend-alfa/src/utils/pdfPedido.js`
- Create: `frontend-alfa/src/components/pedidos/ModalPdfPedido.jsx`
- Modify: `frontend-alfa/src/components/pedidos/pedidos.css`

- [ ] **Step 1: Implementar `pdfPedido.js` com presets (`Cliente`, `Produção`, `Estamparia`, `Facção`), paginação 4×4 (`16` quadros por página A4) e gerador HTML A4**
- [ ] **Step 2: Implementar `ModalPdfPedido.jsx` com seletor de perfil, checkboxes e prévia ao vivo da grade 4×4**
- [ ] **Step 3: Adicionar estilos da prévia 4×4 em `pedidos.css`**

---

### Task 2: Integrar nas telas `PedidoCamisetas.jsx` e `PortalPedidoCliente.jsx`

**Files:**
- Modify: `frontend-alfa/src/pages/PedidoCamisetas.jsx`, `frontend-alfa/src/pages/PortalPedidoCliente.jsx`

- [ ] **Step 1: Adicionar botão "PDF" na tabela de pedidos em `PedidoCamisetas.jsx` abrindo `ModalPdfPedido`**
- [ ] **Step 2: Adicionar botão "Salvar PDF" em `PortalPedidoCliente.jsx`**
- [ ] **Step 3: Rodar `npm run build` e `npx oxlint`**
- [ ] **Step 4: Commit**

---

### Task 3: Verificação no navegador e notas de execução

**Files:**
- Modify: `docs/superpowers/plans/2026-11-16-fase5-pdf-pedido.md`

- [x] **Step 1: Abrir o modal de PDF no navegador automatizado, alternar perfis/checkboxes e inspecionar screenshot da grade 4×4**
- [x] **Step 2: Registrar notas de execução e commitar**

---

## Notas de execução

Fase 5 executada em 2026-11-16 na branch `feat/camisetas-pdf-pedido` (a partir de `feat/camisetas-precificacao`).

**Resultado:**
- Criado `frontend-alfa/src/utils/pdfPedido.js` com os 4 perfis (`Cliente`, `Produção`, `Estamparia`, `Facção`), paginação em blocos de **16 quadros (grade 4×4 por folha A4)** e gerador de documento A4 retrato.
- Criado `frontend-alfa/src/components/pedidos/ModalPdfPedido.jsx` com abas de perfil, 6 checkboxes personalizáveis e pré-visualização ao vivo da folha A4 com a grade 4×4.
- Integrado em `PedidoCamisetas.jsx` (botão **Exportar PDF** em cada pedido) e `PortalPedidoCliente.jsx` (botão **Salvar PDF**).
- Conferido no navegador real (`browser.mjs`) com screenshot verificado: alternância entre perfis (`Cliente` → `Estamparia` ocultando valores financeiros e destacando a grade 4×4), `npm run build` e `npx oxlint` com **zero avisos e zero erros**.

