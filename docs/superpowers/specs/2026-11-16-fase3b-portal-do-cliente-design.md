# Fase 3B — Portal do Cliente: Aprovação por Link e Pedido pelo Celular

**Data:** 2026-11-16
**Status:** aprovado pelo usuário
**Branch:** `feat/camisetas-portal-cliente` (a partir de `feat/camisetas-pedido-estampas`)
**Roadmap:** Fecha a Fase 3 (3A: Estampas nos Itens do Pedido · 3B: Portal do Cliente).

## 1. Objetivo

Permitir que o fabricante envie um link para o cliente:
1. **Visualizar e aprovar um pedido criado pela confecção** (`/portal/pedido/{token}`), conferindo modelos, cores, estampas, tamanhos, quantidades, prazo e valor direto no celular, podendo aprovar ou solicitar ajuste.
2. **Montar o próprio pedido pelo celular** (`/portal/cliente/{token}`), escolhendo modelos, cores, estampas do catálogo visual e quantidades por tamanho, que caem diretamente na fila comercial da confecção.

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Acesso do cliente sem senha | **Links por token criptográfico (`secrets.token_urlsafe(24)`)**: um `token_aprovacao` por pedido e um `token_portal` por cliente. Simples de enviar no WhatsApp e impossível de adivinhar. |
| Isolamento de segurança | As rotas internas (`/camisetas/...`) continuam exigindo JWT de funcionário. O router `/portal/...` responde apenas a quem possui o token exato daquele pedido ou daquele cliente ativo. |
| Pedido montado pelo cliente | Entra com `valor_total = 0.00` ("A definir/orçar pela confecção" até a Fase 4 de Precificação), `status_pedido = "Aguardando Produção"` e `status_aprovacao_cliente = "Aprovado"`. |
| Solicitação de ajuste | Quando o cliente escolhe `"Ajuste Solicitado"`, é obrigatório explicar o que deseja alterar em `observacao_cliente`. |

## 3. Escopo

### Dentro
1. Migração `20261116_009_portal_cliente` adicionando `token_aprovacao`, `status_aprovacao_cliente`, `observacao_cliente`, `aprovado_pelo_cliente_em` em `camisetas_pedidos` e `token_portal` em `camisetas_clientes` (populando registros existentes).
2. Serviço `app/services/camisetas/portal.py` e router `app/routers/portal_cliente.py` sob `/portal`.
3. Tela pública mobile-first `/portal/pedido/:token` (`PortalPedidoCliente.jsx`) para aprovação/solicitação de ajuste.
4. Tela pública mobile-first `/portal/cliente/:token` (`PortalCatalogoCliente.jsx`) para o cliente montar pedido pelo celular e acompanhar seus pedidos.
5. Botão **"Link de aprovação"** e selo de aprovação do cliente em `PedidoCamisetas.jsx`; botão **"Link de pedidos"** em `ClientesCamisetas.jsx`.

### Fora (com destino)
- Cálculo automático do preço no pedido do cliente → **Fase 4 (Precificação)**.
- Folha A4 com grade 5×5 de estampas → **Fase 5 (PDF)**.

## 4. Desenho

### 4.1 Dados (migração `20261116_009_portal_cliente`)

```
camisetas_pedidos
  + token_aprovacao           VARCHAR(64) NULL UNIQUE
  + status_aprovacao_cliente  VARCHAR(30) NOT NULL DEFAULT 'Pendente'
  + observacao_cliente        TEXT NULL
  + aprovado_pelo_cliente_em  TIMESTAMPTZ NULL

camisetas_clientes
  + token_portal              VARCHAR(64) NULL UNIQUE
```

### 4.2 API (`/portal`)

| Método e rota | Função |
|---|---|
| `GET /portal/pedido/{token}` | Detalhe do pedido para o cliente (modelos, cores, estampas, tamanhos, valor, status de aprovação) |
| `POST /portal/pedido/{token}/responder` | Registra `"Aprovado"` ou `"Ajuste Solicitado"` + `observacao_cliente` |
| `GET /portal/cliente/{token}` | Catálogo ativo (modelos, cores, estampas) + dados básicos e pedidos do cliente |
| `POST /portal/cliente/{token}/pedidos` | Cliente envia novo pedido montado pelo celular (`201`) |

## 5. Critérios de aceite

- [ ] Todo cliente e todo pedido têm tokens únicos (`token_portal` e `token_aprovacao`), inclusive os migrados.
- [ ] `GET /portal/pedido/{token}` mostra o pedido completo com imagens das estampas; token inexistente retorna `404`.
- [ ] `POST /portal/pedido/{token}/responder` aprova ou registra pedido de ajuste (exigindo observação no ajuste; recusando com `409` se o pedido já foi entregue).
- [ ] `GET /portal/cliente/{token}` retorna catálogo ativo e recusa cliente inativo com `403`.
- [ ] `POST /portal/cliente/{token}/pedidos` cria o pedido vinculado ao cliente e ele aparece em **2. Pedidos do Cliente**.
- [ ] Telas `/portal/pedido/:token` e `/portal/cliente/:token` funcionam sem exigir login interno e sem erros de console.
