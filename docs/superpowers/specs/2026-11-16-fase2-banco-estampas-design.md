# Fase 2 — Banco de Estampas (Segmento Camisetas)

**Data:** 2026-11-16
**Status:** aprovado pelo usuário
**Branch:** `feat/camisetas-estampas` (a partir de `feat/camisetas-seguranca`, que contém Fases 0, 1A, 1B e Segurança)
**Roadmap:** Fase 2 de 7 (Fundação → Cadastros → Seg. → **Banco de Estampas** → Pedido/Portal → Precificação → PDF → Produção → Financeiro real)

## 1. Objetivo

Criar o catálogo visual de estampas da confecção: cada arte tem imagem, código (automático ou próprio), nome e observações, guardada diretamente no banco de dados sem depender de contas externas. O catálogo permite achar qualquer estampa rapidamente por nome ou código e prepara a base para os itens do pedido (Fase 3), aprovação pelo cliente no celular e a folha A4 com grade 5×5 de estampas (Fase 5).

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Escopo do cadastro | **Só o catálogo visual**: imagem, código, nome, observações opcionais e status ativo/inativo. Sem ficha técnica de serigrafia/bordado nem vínculo de exclusividade por cliente agora. |
| Onde guardar as imagens | **No próprio banco de dados** (`BYTEA` / `LargeBinary`), com limite de 2 MB por arte e validação dos bytes reais (PNG, JPG, WEBP). Funciona local e no Render sem conta externa nem risco de disco efêmero. |
| Como servir a imagem | A resposta JSON já entrega `imagem_data_url` (`data:image/...;base64,...`) para exibição imediata em telas autenticadas e no `window.print()` do PDF, além de `GET /camisetas/estampas/{id}/imagem` para download binário direto. |
| Onde fica a tela | Aba **Estampas** dentro de **4. Ficha Técnica Digital** (`Modelos | Cores | Grades | Estampas`), mantendo o menu lateral enxuto. |
| Código da estampa | Opcional no formulário: se ficar em branco, o servidor gera `EST-AAAA-NNNN` usando `proximo_codigo(db, "EST")`. |

## 3. Escopo

### Dentro
1. Tabela `camisetas_estampas` e migração `20261116_007_estampas` (somente aditiva, com `downgrade`).
2. Validação pura de imagem (`PNG`, `JPEG`, `WEBP` pelos bytes mágicos, tamanho máximo de 2 MB).
3. Geração automática de código sequencial `EST-AAAA-NNNN` quando não informado, ou validação de código único informado pelo usuário.
4. CRUD completo sob `/camisetas/estampas/` com busca por nome ou código e filtro de inativas.
5. Aba **Estampas** (`PainelEstampas.jsx`) na Ficha Técnica Digital: upload com prévia instantânea, busca em tempo real, grade visual de cartões, ampliação da arte em modal, edição, inativação e exclusão.
6. Dados de demonstração no `/camisetas/seed-inicial` com estampas de exemplo.

### Fora (com destino)
- Vínculo de estampa + posição (frente, costas, manga) nos itens do pedido → **Fase 3**.
- Aprovação do pedido pelo cliente e montagem de pedido pelo celular → **Portal do Cliente (Fase 3+)**.
- Custo de aplicação por técnica (silk, DTF, sublimação, bordado) → **Fase 4 (Precificação)**.
- Folha A4 com grade 5×5 de estampas → **Fase 5 (PDF)**.

## 4. Desenho

### 4.1 Dados (migração `20261116_007_estampas`, somente aditiva)

```
camisetas_estampas
  id_estampa     PK INTEGER
  codigo         VARCHAR(30)  NOT NULL UNIQUE   -- ex.: EST-2026-0001 ou LEAO-01
  nome           VARCHAR(120) NOT NULL          -- ex.: Leão Dourado
  nome_busca     VARCHAR(120) NOT NULL INDEX    -- sem acento, minúsculo, espaços colapsados
  observacoes    TEXT         NULL
  imagem_bytes   BYTEA/BLOB   NOT NULL          -- até 2 MB (2.097.152 bytes)
  imagem_mime    VARCHAR(40)  NOT NULL          -- 'image/png' | 'image/jpeg' | 'image/webp'
  tamanho_bytes  INTEGER      NOT NULL
  ativo          BOOLEAN      NOT NULL DEFAULT TRUE
  criado_em      TIMESTAMPTZ  DEFAULT now()
  atualizado_em  TIMESTAMPTZ  DEFAULT now()
```

### 4.2 Regras de negócio (`services/camisetas/estampas.py`)

- **Validação e decodificação da imagem (`decodificar_imagem_estampa`)**:
  - Aceita string no formato `data:<mime>;base64,<dados>` ou base64 puro.
  - Base64 inválido ou vazio → `400 "Imagem inválida. Envie um arquivo PNG, JPG ou WEBP."`.
  - Tamanho decodificado > `2 * 1024 * 1024` (2 MB) → `400 "A imagem excede o limite de 2 MB."`.
  - Inspeciona os bytes mágicos reais do arquivo:
    - `\x89PNG\r\n\x1a\n` → `image/png`
    - `\xff\xd8\xff` → `image/jpeg`
    - `RIFF....WEBP` → `image/webp`
  - Qualquer outro formato → `400 "Formato de imagem não suportado. Use PNG, JPG ou WEBP."`.
- **Código (`codigo`)**:
  - Se omitido ou vazio na criação: gera `proximo_codigo(db, "EST")` (ex.: `EST-2026-0001`).
  - Se informado: `strip().upper()`, máximo 30 caracteres; se já existir outra estampa com o mesmo código (sem diferenciar maiúsculas) → `409 "Já existe uma estampa com o código X."`.
- **Nome (`nome`)**:
  - Obrigatório, aparado, entre 1 e 120 caracteres; preenche `nome_busca = normalizar_busca(nome)`.
- **Listagem e busca (`listar_estampas`)**:
  - `?busca=` filtra por `nome_busca` ou `codigo` (sem diferenciar maiúsculas/acentos).
  - Por padrão retorna só `ativo == True`; `?incluir_inativas=true` retorna todas.
  - Ordena por `nome_busca ASC, id_estampa DESC`.
- **Edição (`atualizar_estampa`)**:
  - Atualiza `nome`, `codigo`, `observacoes` e `ativo`.
  - `imagem_data_url` é opcional na edição: se enviada, valida e substitui a imagem; se omitida/`None`, preserva a imagem existente.
- **Exclusão (`excluir_estampa`)**:
  - Remove a estampa do banco (404 se não existir).

### 4.3 API (todas sob `/camisetas`)

| Método e rota | Função |
|---|---|
| `GET /estampas/?busca=&incluir_inativas=` | Lista estampas (com `imagem_data_url`) |
| `POST /estampas/` | Cria estampa (`201`) |
| `GET /estampas/{id_estampa}` | Detalhe de uma estampa |
| `GET /estampas/{id_estampa}/imagem` | Bytes binários da imagem (`Content-Type: image/...`) |
| `PUT /estampas/{id_estampa}` | Atualiza dados e/ou imagem da estampa |
| `DELETE /estampas/{id_estampa}` | Exclui estampa (`204`) |

### 4.4 Tela (`PainelEstampas.jsx`)

- Nova aba **Estampas** em `FichaTecnicaCamisetas.jsx` (`Modelos | Cores | Grades | Estampas`).
- Barra superior com campo de busca por nome/código, filtro `"Mostrar inativas"` e contador de estampas.
- Formulário integrado no topo (mesmo padrão visual de `PainelCores` e `PainelGrades`):
  - Seletor de arquivo de imagem (`PNG, JPG, WEBP` até 2 MB) com miniatura de prévia instantânea.
  - Campo **Nome da estampa** (obrigatório) e **Código** (opcional — dica: `"Deixe em branco para gerar automático"`).
  - Campo **Observações** (opcional) e caixa **Ativa** (ao editar).
- Grade visual de cartões (`.painel-estampas-grade`):
  - Cada cartão mostra a miniatura da arte em quadro quadrado, o código em etiqueta, o nome da estampa, selo `"Inativa"` quando inativa, botão de ampliar (abre modal com a arte grande) e botão de editar.

### 4.5 Organização do código

```
backend/alembic/versions/20261116_007_estampas.py
backend/app/models/camisetas_estampas.py
backend/app/schemas/camisetas_estampas.py
backend/app/services/camisetas/estampas.py
backend/app/routers/camisetas/estampas.py
backend/tests/test_estampas.py
frontend-alfa/src/components/cadastros/PainelEstampas.jsx
frontend-alfa/src/components/cadastros/cadastros.css
frontend-alfa/src/pages/FichaTecnicaCamisetas.jsx
```

## 5. Critérios de aceite

- [ ] Migração `20261116_007_estampas` sobe, passa no `alembic check` e faz `downgrade` limpo.
- [ ] Upload aceita PNG, JPEG e WEBP válidos até 2 MB e recusa formatos inválidos ou arquivos > 2 MB com 400.
- [ ] Estampa criada sem código recebe `EST-AAAA-NNNN` sequencial; código repetido retorna 409.
- [ ] Busca encontra estampas por parte do nome (com ou sem acento) ou pelo código.
- [ ] Edição permite alterar dados sem precisar reenviar a imagem, ou trocar a imagem quando desejado.
- [ ] Aba **Estampas** na Ficha Técnica exibe a grade visual, cadastra, edita, filtra, amplia e exclui estampas sem `alert()`/`confirm()` nativos e sem erros de console.
- [ ] Suíte de testes passando, cobertura de `app/services/` ≥ 80%, `npm run build` e `npx oxlint` sem erros.
