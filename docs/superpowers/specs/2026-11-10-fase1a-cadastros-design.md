# Fase 1A — Cadastros: Clientes, Cores e Grades (Segmento Camisetas)

**Data:** 2026-11-10
**Status:** proposta, aguardando revisão
**Branch:** `feat/camisetas-cadastros` (a partir de `feat/camisetas-fundacao`)
**Roadmap:** Fase 1 dividida em 1A (cadastros, este documento) e 1B (pedido com itens, OP e facção por
cor/tamanho, estoque de acabados por SKU, ajuste de inventário).

## 1. Objetivo

Criar os cadastros de que o pedido e o estoque por variação vão depender, já com uso fácil no dia a dia:
o cliente passa a ser escolhido (não digitado), cada modelo usa uma grade de tamanhos configurável e as
cores das camisetas ficam padronizadas e ligadas às malhas do estoque.

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Forma de venda | Sob encomenda **e** pronta-entrega → estoque por SKU será o centro (1B); reserva por pedido na Fase 6. |
| Migração do estoque de acabados (1B) | **Inventário de abertura**: estoque por SKU começa zerado e é contado na tela de ajuste. |
| Modelagem de grade | **Tabelas normalizadas** (grade + tamanhos ordenados); nada de colunas fixas nem JSON. |
| Onde ficam as telas | **Clientes** no menu (logo após Pedidos); **Cores** e **Grades** como abas da Ficha Técnica. |
| Compatibilidade | Migrações só aditivas; `nome_cliente` e `grade_disponivel` continuam preenchidos para as telas atuais. |

## 3. Escopo

### Dentro
1. Cadastro de clientes com validação de CPF/CNPJ, busca e resumo de compras.
2. Seleção de cliente no pedido com busca ao digitar e criação rápida sem sair da tela.
3. Cadastro de cores com amostra visual e atalho de cores básicas.
4. Cadastro de grades com tamanhos ordenados e modelos prontos.
5. Modelo de camiseta passa a usar uma grade (com edição de modelo).
6. Rolo de malha pode indicar a cor de camiseta que produz (com edição de insumo).
7. Migração dos dados do piloto (clientes a partir dos pedidos, grades a partir dos modelos).

### Fora (com destino)
- Itens do pedido, SKU, estoque por SKU, OP/facção por tamanho, ajuste de inventário → **1B**.
- Endereço estruturado com busca por CEP, importação de clientes por planilha → depois, se houver demanda.
- Reserva de peças por pedido → **Fase 6**.

## 4. Desenho

### 4.1 Dados (novas tabelas e colunas)

```
camisetas_clientes
  id_cliente PK
  tipo            VARCHAR(2)  NULL   -- 'PF' | 'PJ' (nulo para clientes migrados)
  nome            VARCHAR(150) NOT NULL        -- nome ou razão social
  documento       VARCHAR(14) NULL UNIQUE      -- só dígitos (CPF 11 / CNPJ 14)
  telefone_whatsapp VARCHAR(20) NULL
  email           VARCHAR(150) NULL
  cidade          VARCHAR(100) NULL
  uf              VARCHAR(2)  NULL
  endereco        VARCHAR(255) NULL            -- texto livre
  observacoes     TEXT NULL
  ativo           BOOLEAN NOT NULL DEFAULT TRUE
  criado_em, atualizado_em

camisetas_cores
  id_cor PK
  nome   VARCHAR(60) NOT NULL UNIQUE           -- ex.: Preto, Cinza Mescla
  hex    VARCHAR(7)  NOT NULL                  -- '#RRGGBB'
  ativo  BOOLEAN NOT NULL DEFAULT TRUE

camisetas_grades
  id_grade PK
  nome  VARCHAR(80) NOT NULL UNIQUE            -- ex.: Adulto (PP–XGG)
  ativo BOOLEAN NOT NULL DEFAULT TRUE

camisetas_grade_tamanhos
  id_tamanho PK
  id_grade   FK camisetas_grades (CASCADE)
  rotulo     VARCHAR(10) NOT NULL              -- ex.: PP, M, 10, 42
  ordem      INTEGER NOT NULL
  UNIQUE (id_grade, rotulo)

camisetas_pedidos.id_cliente   FK camisetas_clientes NULL   (nova coluna)
camisetas_insumos.id_cor       FK camisetas_cores    NULL   (nova coluna)
camisetas_modelos.id_grade     FK camisetas_grades   NULL   (nova coluna)
```

### 4.2 Regras de negócio

**Clientes** (`services/camisetas/clientes.py`, `services/documentos.py`)
- `documento` é guardado só com dígitos. CPF (11) e CNPJ (14) têm os dígitos verificadores conferidos;
  inválido → 400 "CPF inválido" / "CNPJ inválido". Duplicado → 409 com o nome do cliente que já usa o documento.
- `tipo` é deduzido do documento quando informado (11 → PF, 14 → PJ); sem documento, vem do formulário.
- Excluir cliente com pedidos → 409 "Este cliente tem pedidos; inative-o em vez de excluir." Sem pedidos → exclui.
- Busca (`?busca=`) procura em nome (sem diferenciar maiúsculas), documento e telefone (só dígitos).
  Por padrão lista só ativos (`?incluir_inativos=true` mostra todos). Ordena por nome. `?limite=` (padrão 50).
- Resumo de cada cliente na listagem: `qtd_pedidos`, `ultimo_pedido_em` (data de criação do pedido mais
  recente) e `valor_total_pedidos` (soma do `valor_total` de todos os pedidos do cliente, entregues ou não).

**Pedido ↔ cliente** (`resolver_cliente`)
- `CamisetaPedidoCreate` ganha `id_cliente` opcional. Se vier: o cliente precisa existir e estar ativo
  (404 / 400 "Cliente inativo") e `nome_cliente` do pedido é preenchido com o nome do cadastro.
- Se vier só `nome_cliente` (frontend antigo): procura cliente pelo nome normalizado (espaços colapsados,
  sem diferenciar maiúsculas); se não houver, cria. Assim todo pedido novo fica ligado a um cliente.
- Resposta do pedido ganha `id_cliente`.

**Cores** (`services/camisetas/cores.py`)
- Nome único sem diferenciar maiúsculas (409 se repetido). `hex` validado no formato `#RRGGBB` (422).
- Excluir cor usada por algum insumo → 409 "Cor em uso; inative-a em vez de excluir."

**Grades** (`services/camisetas/grades.py`)
- Grade tem pelo menos 1 tamanho; rótulos únicos na grade (sem diferenciar maiúsculas), aparados, até 10
  caracteres; a ordem é a da lista enviada.
- Atualizar tamanhos compara por rótulo: mantém os que continuam (só muda a ordem), cria os novos, remove os
  retirados. (Na 1B a remoção passará a ser bloqueada se o tamanho tiver pedido/estoque.)
- Ao criar/alterar a grade, o `grade_disponivel` de todos os modelos que a usam é regravado como
  `"P, M, G, GG"` (rótulos em ordem), mantendo as telas atuais corretas.
- Excluir grade usada por algum modelo → 409.
- `obter_grade_padrao(db)`: devolve a grade "Adulto (P, M, G, GG)", criando-a se não existir.

**Modelos**
- `POST /modelos/` aceita `id_grade` (opcional; ausente → grade padrão) e grava `grade_disponivel` a partir dela.
- Novo `PUT /modelos/{id}`: altera nome, consumo de malha, descrição e grade (nome único, 409 se repetido).
- Resposta do modelo ganha `id_grade`, `nome_grade` e `tamanhos` (lista de rótulos em ordem).

**Insumos**
- `POST /insumos/` aceita `id_cor` opcional (precisa existir).
- Novo `PUT /insumos/{id}`: altera só dados cadastrais — tipo/descrição, cor (texto), `id_cor`, unidade e
  estoque mínimo. Saldo e custo médio **não** são editáveis aqui (mudam por nota fiscal e, na 1B, por ajuste).
- Resposta do insumo ganha `id_cor`, `nome_cor` e `hex_cor`.

**Seed de demonstração**: passa a usar `obter_grade_padrao` para ligar os modelos à grade.

### 4.3 API (todas sob `/camisetas`)

| Método e rota | Função |
|---|---|
| `GET /clientes/?busca=&incluir_inativos=&limite=` | lista com resumo |
| `POST /clientes/` | cria |
| `GET /clientes/{id}` | detalhe com resumo |
| `PUT /clientes/{id}` | altera (inclui `ativo`) |
| `DELETE /clientes/{id}` | exclui se não tiver pedidos |
| `GET /cores/?incluir_inativas=` · `POST /cores/` · `PUT /cores/{id}` · `DELETE /cores/{id}` | cadastro de cores |
| `GET /grades/?incluir_inativas=` · `POST /grades/` · `PUT /grades/{id}` · `DELETE /grades/{id}` | grades com tamanhos (`tamanhos: ["PP","P",...]`) |
| `PUT /modelos/{id}` | edição de modelo (nova) |
| `PUT /insumos/{id}` | edição cadastral de insumo (nova) |

Nenhuma rota existente muda de URL; `POST /modelos/`, `POST /insumos/` e `POST /pedidos/` só ganham campos opcionais.

### 4.4 Migração `20261110_005_cadastros` (somente aditiva, com downgrade)

1. Cria as quatro tabelas e as três colunas de ligação.
2. **Grades**: para cada texto distinto de `camisetas_modelos.grade_disponivel` (nulo/vazio → "P, M, G, GG"),
   cria uma grade com os rótulos separados por vírgula; o texto "P, M, G, GG" vira a grade
   "Adulto (P, M, G, GG)" e os demais viram "Grade (<texto>)". Liga cada modelo à sua grade.
3. **Clientes**: para cada `nome_cliente` distinto (normalizado: aparado, espaços colapsados, sem diferenciar
   maiúsculas), cria um cliente com o nome como apareceu primeiro e liga os pedidos a ele.
4. Cores não são migradas (o texto livre das malhas fica como está); a ligação malha → cor é feita na tela.

### 4.5 Telas

**Menu**: 1. Dashboard · 2. Pedidos do Cliente · **3. Clientes** · 4. Ficha Técnica · 5. Estoque de Insumos ·
6. Corte & Rendimento · 7. Costura & Facções · 8. Financeiro (os títulos das páginas acompanham a numeração).

**Clientes** (nova página `ClientesCamisetas.jsx`, rota `/camisetas/clientes`)
- Lista com busca no topo (filtra enquanto digita), colunas: nome, documento formatado, WhatsApp, cidade/UF,
  pedidos, último pedido, total em pedidos; filtro "mostrar inativos".
- Botão "+ Novo cliente" e "Editar" abrem o mesmo formulário (componente `FormCliente.jsx`): tipo PF/PJ,
  nome/razão social, CPF/CNPJ (máscara aplicada ao sair do campo), WhatsApp, e-mail, cidade, UF, endereço,
  observações, ativo. Erros do servidor aparecem no campo (ex.: "CNPJ já usado por Loja Beta").
- "Excluir" pede confirmação; se o cliente tiver pedidos, oferece "Inativar" no lugar.

**Pedido** (`PedidoCamisetas.jsx`)
- O campo "Nome do Cliente / Lojista" vira `SeletorCliente.jsx`: campo com busca ao digitar (a partir de 2
  letras), lista de sugestões navegável por teclado (setas, Enter, Esc — padrão ARIA combobox) e a opção
  final "+ Cadastrar '<texto digitado>'", que abre o `FormCliente` em modo rápido (nome e WhatsApp) já com o
  texto preenchido. Ao salvar, o cliente fica selecionado.
- O pedido envia `id_cliente`.

**Ficha Técnica** (`FichaTecnicaCamisetas.jsx` ganha só a barra de abas: Modelos | Cores | Grades)
- **Modelos** (conteúdo atual): o formulário troca o texto livre de grade por um seletor de grade com
  prévia dos tamanhos em etiquetas; novo botão "Editar modelo" usando o mesmo formulário.
- **Cores** (`PainelCores.jsx`): grade de amostras (quadrado colorido + nome), formulário com seletor de cor
  nativo e campo hex, botão "Adicionar cores básicas" (Branco #FFFFFF, Preto #1F1F1F, Cinza Mescla #B8B8B8,
  Azul Marinho #1F2A44 — cria só as que faltam), editar/inativar/excluir.
- **Grades** (`PainelGrades.jsx`): lista de grades com os tamanhos em etiquetas; formulário com nome e
  tamanhos (adicionar, remover, subir/descer); botões de modelos prontos: "Adulto PP–XGG"
  (PP, P, M, G, GG, XG, XGG), "Infantil 2–16" (2, 4, 6, 8, 10, 12, 14, 16), "Babylook PP–GG" (PP, P, M, G, GG).

**Estoque de Insumos** (`EstoqueCamisetas.jsx`)
- Formulário de insumo ganha "Cor da camiseta que esta malha produz" (seletor de cores, opcional, só para
  rolos de tecido) e passa a servir também para editar (botão "Editar" na linha).
- A coluna Cor mostra a amostra da cor ligada, quando houver.

Todos os avisos e confirmações usam os componentes compartilhados da Fase 0.

### 4.6 Organização do código

```
backend/app/models/camisetas_cadastros.py   # Cliente, Cor, Grade, GradeTamanho
backend/app/schemas/camisetas_cadastros.py  # schemas dos três cadastros
backend/app/services/documentos.py           # normalizar/validar CPF e CNPJ (puro)
backend/app/services/camisetas/clientes.py   # busca, resumo, resolver_cliente
backend/app/services/camisetas/cores.py
backend/app/services/camisetas/grades.py     # tamanhos, sincronizar grade_disponivel, grade padrão
backend/app/routers/camisetas/clientes.py
backend/app/routers/camisetas/cores.py
backend/app/routers/camisetas/grades.py
frontend-alfa/src/pages/ClientesCamisetas.jsx (+ .css)
frontend-alfa/src/components/cadastros/FormCliente.jsx
frontend-alfa/src/components/cadastros/SeletorCliente.jsx
frontend-alfa/src/components/cadastros/PainelCores.jsx
frontend-alfa/src/components/cadastros/PainelGrades.jsx
frontend-alfa/src/components/cadastros/cadastros.css
frontend-alfa/src/utils/documentos.js        # máscara de CPF/CNPJ e telefone (exibição)
```

## 5. Testes

- Unitários: CPF/CNPJ válidos, inválidos, com máscara, repetidos (111.111.111-11); normalização de nome;
  diferença de tamanhos da grade (mantém/cria/remove); texto de `grade_disponivel`.
- API: criar/buscar/editar/excluir cliente (409 com pedidos, 409 documento duplicado); pedido com
  `id_cliente`, com cliente inativo (400) e só com `nome_cliente` (encontra ou cria); cores (nome repetido,
  hex inválido, exclusão em uso); grades (tamanho repetido, grade sem tamanhos, exclusão em uso, edição
  regrava `grade_disponivel` dos modelos); `PUT /modelos/{id}`; `PUT /insumos/{id}` não altera saldo nem custo.
- Migração: pedidos "Loja Beta" e " loja  beta " viram um cliente só; modelos com "P, M, G, GG" e
  "P, M, G, GG, XG" viram duas grades; downgrade remove tudo.
- `ROTAS_ESPERADAS` atualizado com as rotas novas.
- Frontend: build e lint sem erros; verificação no navegador (banco local) de cada tela, incluindo teclado
  no seletor de cliente.
- Cobertura ≥ 80% em `app/services/`.

## 6. Critérios de aceite

- [ ] Cliente é escolhido no pedido por busca; dá para cadastrar um novo sem sair do pedido.
- [ ] CPF/CNPJ inválido ou duplicado é recusado com mensagem clara.
- [ ] Cliente com pedidos não pode ser excluído, só inativado.
- [ ] Cores têm amostra visual; "Adicionar cores básicas" cria só as que faltam.
- [ ] Grades são criadas por modelo pronto ou manualmente, com ordem dos tamanhos.
- [ ] Modelos usam uma grade e podem ser editados; telas antigas continuam mostrando os tamanhos.
- [ ] Rolos de malha podem ser ligados a uma cor; saldo e custo não são editáveis pela edição de insumo.
- [ ] Pedidos e modelos do piloto aparecem ligados a clientes e grades depois da migração.
- [ ] Testes passando, cobertura ≥ 80% em `app/services/`, build e lint sem erros.
