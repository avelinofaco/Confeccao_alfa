# Fase 5 — Exportação de PDF do Pedido com Grade 4×4 por Folha A4 (Segmento Camisetas)

**Data:** 2026-11-16
**Status:** aprovado pelo usuário (com correção para grade 4×4)
**Branch:** `feat/camisetas-pdf-pedido` (a partir de `feat/camisetas-precificacao`)
**Roadmap:** Fase 5 de 7 (Fundação → Cadastros → Seg. → Banco de Estampas → Pedido/Portal → Precificação → **PDF** → Produção → Financeiro real)

## 1. Objetivo

Permitir gerar e imprimir/salvar em PDF a ficha completa de qualquer pedido de camisetas, escolhendo entre **4 modelos de destinatário (`Cliente`, `Produção`, `Estamparia`, `Facção`)** e marcando/desmarcando por **checkboxes** o que deve aparecer no documento, com destaque para a **Grade de Estampas 4×4 por Folha A4** (4 colunas × 4 linhas = até 16 quadros por página A4, com tamanhos e quantidades abaixo de cada arte).

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Dimensão da grade por folha A4 | **4×4 por folha A4** (4 colunas × 4 linhas = 16 quadros por folha A4), paginando automaticamente em novas folhas A4 quando o pedido tiver mais de 16 itens. |
| Conteúdo de cada quadro da grade 4×4 | Arte da estampa (ou silhueta de peça lisa) no topo + identificação (`Modelo · Cor` com amostra e `[Código] Estampa · Posição`) + barra de tamanhos (`P, M, G, GG...`) com as quantidades logo abaixo. |
| Perfis e checkboxes | Quatro botões de perfil (`Cliente`, `Produção`, `Estamparia`, `Facção`) que pré-configuram 6 checkboxes independentes (`mostrarCliente`, `mostrarValores`, `mostrarGrade4x4`, `mostrarTabelaItens`, `mostrarPrazoObservacoes`, `mostrarAssinatura`). |
| Ocultação de preços para chão de fábrica | Nos perfis `Produção`, `Estamparia` e `Facção`, `mostrarValores` vem desmarcado por padrão para não expor preços comerciais na fábrica ou em oficinas terceirizadas. |
| Prévia antes de imprimir | Modal interativo (`ModalPdfPedido.jsx`) mostra a folha A4 ao vivo conforme você alterna perfis ou checkboxes, antes de acionar a impressão/salvamento em PDF. |

## 3. Escopo

### Dentro
1. Utilitário `frontend-alfa/src/utils/pdfPedido.js`:
   - `PERFIS_PDF_PEDIDO` (`cliente`, `producao`, `estamparia`, `faccao`) e seus presets de checkboxes.
   - `paginarItens4x4(itens)` (divide os itens em páginas de até 16 quadros — 4×4).
   - `gerarHtmlPdfPedido(pedido, opcoes)` e `abrirJanelaImpressaoPedido(pedido, opcoes)` com CSS `@page { size: A4 portrait; margin: 10mm; }`.
2. Componente `frontend-alfa/src/components/pedidos/ModalPdfPedido.jsx`:
   - Seletor dos 4 perfis (`Cliente`, `Produção`, `Estamparia`, `Facção`).
   - 6 checkboxes para personalizar o que aparece no PDF.
   - Pré-visualização ao vivo da folha A4 com a grade 4×4.
   - Botão **Imprimir / Salvar em PDF**.
3. Integração em `PedidoCamisetas.jsx` (botão **"PDF"** em cada linha de pedido) e em `PortalPedidoCliente.jsx` (botão **"Salvar PDF"** para o cliente).

### Fora (com destino)
- Reserva de peças por pedido e vínculo Pedido → Ordem de Produção → **Fase 6 (Produção)**.
- Contas a pagar/receber, DRE e entrega parcial com romaneio → **Fase 7 (Financeiro real)**.

## 4. Critérios de aceite

- [ ] A grade de estampas do PDF organiza os itens em **4 colunas × 4 linhas (até 16 quadros por folha A4)**, exibindo tamanhos e quantidades abaixo de cada imagem.
- [ ] Pedidos com mais de 16 itens quebram automaticamente em múltiplas folhas A4 de 4×4.
- [ ] Os 4 perfis (`Cliente`, `Produção`, `Estamparia`, `Facção`) ajustam os checkboxes automaticamente, e o usuário pode marcar/desmarcar qualquer opção individualmente.
- [ ] Perfis industriais (`Produção`, `Estamparia`, `Facção`) ocultam valores em R$ por padrão.
- [ ] `npm run build` e `npx oxlint` sem erros, e modal de PDF conferido no navegador sem erros de console.
