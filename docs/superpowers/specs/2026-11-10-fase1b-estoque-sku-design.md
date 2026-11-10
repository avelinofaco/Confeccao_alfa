# Fase 1B — Produção e Estoque por Cor e Tamanho (Segmento Camisetas)

**Data:** 2026-11-10
**Status:** proposta, aguardando revisão
**Branch:** `feat/camisetas-estoque-sku` (a partir de `feat/camisetas-fundacao`, que já contém Fase 0 e 1A)
**Roadmap:** Fase 1B — fecha a Fase 1 (cadastros + fluxo por cor/tamanho).

## 1. Objetivo

Fazer toda quantidade do sistema andar por **SKU** (modelo + cor + tamanho): o corte registra o que saiu de
cada cor e tamanho, a facção envia e devolve por SKU, o estoque de produtos prontos é controlado por SKU
(com histórico e inventário) e o pedido é feito por itens, sendo entregue a partir do estoque de cada SKU.

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Forma de venda | Sob encomenda e pronta-entrega → estoque por SKU completo, com estoque mínimo. |
| Estoque inicial | **Inventário de abertura**: saldo por SKU começa em zero e é contado na tela nova. |
| Enfesto | **Várias cores na mesma OP** (camadas de cores diferentes do mesmo modelo). |
| Produção antiga em andamento | **Continua funcionando**: no retorno de remessa antiga, a equipe distribui as peças por cor × tamanho. |
| Modelagem | **Tabela de SKUs (variações) com saldo + tabela de movimentações**; toda alteração de saldo passa por uma única função que grava o movimento. |
| Tela de estoque pronto | Item próprio no menu: **8. Produtos Prontos** (Financeiro passa a 9). |

## 3. Escopo

### Dentro
1. SKUs (variações) com saldo, estoque mínimo e histórico de movimentações.
2. Tela Produtos Prontos: grade modelo × cor × tamanho, inventário (contagem), ajuste com motivo, histórico.
3. OP com várias cores (rolo e peso por cor) e corte registrado por cor × tamanho; rendimento total e por cor.
4. Envio à facção e retorno por SKU; retorno lança entrada no estoque do SKU; perdas por tamanho.
5. Pedido com itens (modelo + cor + quantidade por tamanho), edição de itens antes da entrega.
6. Entrega baixando o estoque por SKU (com aviso do que falta) e estorno ao reverter.
7. Migração: pedidos antigos viram itens com "cor não informada"; produção antiga segue pelo caminho legado.
8. Proteção de grade: tamanho com pedido ou estoque não pode ser removido.

### Fora (com destino)
- Entrega parcial e romaneio → **Fase 7**.
- Reserva de peças por pedido e ligação pedido → OP → **Fase 6**.
- Estampas nos itens do pedido → **Fase 3**.
- Código de SKU impresso / etiquetas → quando houver necessidade.

## 4. Desenho

### 4.1 Dados (migração `20261110_006_estoque_sku`, somente aditiva)

```
camisetas_variacoes                      -- o SKU
  id_variacao PK
  id_modelo   FK camisetas_modelos        NOT NULL
  id_cor      FK camisetas_cores          NOT NULL
  id_tamanho  FK camisetas_grade_tamanhos NOT NULL
  saldo          INTEGER NOT NULL DEFAULT 0      -- nunca negativo
  estoque_minimo INTEGER NOT NULL DEFAULT 0
  UNIQUE (id_modelo, id_cor, id_tamanho)

camisetas_movimentos_estoque
  id_movimento PK
  id_variacao  FK NOT NULL
  tipo         VARCHAR(20) NOT NULL  -- INVENTARIO | AJUSTE | ENTRADA_PRODUCAO | SAIDA_ENTREGA | ESTORNO_ENTREGA
  quantidade   INTEGER NOT NULL      -- com sinal; nunca zero
  saldo_apos   INTEGER NOT NULL
  motivo       VARCHAR(255) NULL
  id_pedido    FK camisetas_pedidos NULL
  id_costura   FK camisetas_costura_faccoes NULL
  criado_em

camisetas_op_cores                      -- uma linha por cor do enfesto
  id_op_cor PK, id_op FK (CASCADE), id_cor FK, id_insumo_tecido FK NULL, peso_kg NUMERIC(10,3)
  UNIQUE (id_op, id_cor)

camisetas_op_cortes                     -- peças cortadas por SKU
  id_corte PK, id_op FK (CASCADE), id_variacao FK, quantidade INTEGER
  UNIQUE (id_op, id_variacao)

camisetas_remessa_itens                 -- envio/retorno da facção por SKU
  id_item PK, id_costura FK (CASCADE), id_variacao FK, qtd_enviada INTEGER, qtd_retornada INTEGER NULL
  UNIQUE (id_costura, id_variacao)

camisetas_pedido_itens
  id_item PK, id_pedido FK (CASCADE), id_modelo FK NOT NULL, id_cor FK NULL   -- NULL = cor não informada

camisetas_pedido_item_qtds
  id_item FK (CASCADE), id_tamanho FK, quantidade INTEGER
  PRIMARY KEY (id_item, id_tamanho)
```

Migração dos dados:
- Cada pedido existente vira **um item** (seu modelo, cor nula) com as quantidades de `grade_p/m/g/gg`
  ligadas aos tamanhos P, M, G, GG da grade do modelo; se a grade não tiver o rótulo, ele é acrescentado ao
  fim da grade. Quantidades zero são ignoradas.
- OPs e remessas existentes não ganham linhas (ficam como **legadas**).
- `camisetas_produtos_acabados` deixa de ser usada (fica como histórico). Saldo por SKU começa em zero.

### 4.2 Regras de negócio

**SKU e movimentações** (`services/camisetas/sku.py`)
- `obter_ou_criar_variacao(db, id_modelo, id_cor, id_tamanho)`: o tamanho precisa pertencer à grade do
  modelo (400 "O tamanho X não faz parte da grade do modelo Y") e a cor precisa existir (404).
- `movimentar(db, variacao, quantidade, tipo, motivo=None, id_pedido=None, id_costura=None)`: soma ao saldo,
  grava o movimento com `saldo_apos`; se o saldo ficar negativo → 400 com o SKU e o saldo disponível. É a
  **única** forma de alterar `saldo`.
- `descrever_variacao(v)` → "Básica Gola Redonda · Preto · M" (usado em mensagens e no histórico).

**Produtos Prontos** (`services/camisetas/produtos_prontos.py`)
- Listagem agrupada por modelo × cor com todos os tamanhos da grade do modelo (tamanho sem SKU aparece com
  saldo 0); filtros: `id_modelo`, `id_cor`, `abaixo_minimo` (só linhas com algum SKU abaixo do mínimo).
  "Abaixo do mínimo" = SKU com `estoque_minimo > 0` e `saldo < estoque_minimo`.
- **Inventário**: recebe contagens `[{id_modelo, id_cor, id_tamanho, quantidade_contada ≥ 0}]` e um motivo
  (padrão "Inventário de abertura"); para cada contagem, cria o SKU se preciso e lança a diferença como
  `INVENTARIO` (nada é lançado se a diferença for zero). Devolve quantos SKUs mudaram.
- **Ajuste**: `{id_variacao, quantidade ≠ 0, motivo (mín. 3 letras)}` → `AJUSTE`.
- **Estoque mínimo**: alterável por SKU (≥ 0).
- **Histórico**: movimentos filtráveis por SKU, modelo e tipo, mais recentes primeiro, com a referência
  (código do pedido ou da OP da remessa).

**OP com várias cores** (`services/camisetas/ordens.py`)
- Abrir OP: `{id_modelo, cores: [{id_cor, id_insumo_tecido, peso_kg > 0}]}` com pelo menos uma cor e cores
  sem repetição; cada rolo precisa ser malha (`ROLO_TECIDO`) com saldo suficiente (400 com o rolo e o
  saldo) e é baixado. Peças planejadas = peso total ÷ consumo do modelo.
  Compatibilidade: corpo antigo (`id_insumo_tecido`, `peso_malha_enviado_kg`) vira uma linha de cor usando
  a cor ligada ao rolo; se o rolo não tiver cor → 400 "Informe a cor".
- Finalizar corte: `{cortes: [{id_cor, id_tamanho, quantidade ≥ 0}]}` — cores da OP, tamanhos da grade do
  modelo, total > 0. Grava as linhas por SKU, o total e o rendimento total (peças ÷ kg). Pode ser refeito
  enquanto nada foi enviado à facção (depois → 409). OP legada (sem cores) aceita o corpo antigo
  `{pecas_reais_cortadas}`.
- Resposta da OP ganha `cores` (cor, rolo, peso, peças cortadas da cor, rendimento da cor), `cortes`
  (SKU, cor, tamanho, cortado, já enviado, disponível) e `legada`.

**Facção por SKU** (`services/camisetas/costura.py`)
- Envio de OP com cortes: `itens: [{id_variacao, quantidade > 0}]`, cada um ≤ disponível do SKU na OP;
  `quantidade_enviada` = soma. A baixa de aviamentos continua pelo total. OP legada: envio pelo total, como hoje.
- Retorno: `itens: [{id_cor, id_tamanho, quantidade ≥ 0}]`.
  - Remessa com itens: só os SKUs enviados, cada um ≤ enviado.
  - Remessa legada: distribuição livre entre os tamanhos da grade do modelo e cores existentes; soma ≤ enviado.
  - Cada quantidade > 0 lança `ENTRADA_PRODUCAO` no SKU (com `id_costura`); perdas = enviado − retornado.
  - Mantidas as regras da Fase 0 (retorno duplo 409, OP finaliza só com tudo de volta).

**Pedido com itens** (`services/camisetas/pedidos.py`)
- Criar: `{id_cliente, itens: [{id_modelo, id_cor, quantidades: [{id_tamanho, quantidade}]}], prazo_entrega,
  valor_total, observacoes}`; pelo menos um item; sem itens repetidos (mesmo modelo e cor); cada item com
  total > 0; tamanhos da grade do modelo; cor obrigatória e ativa nos pedidos novos.
  Compatibilidade: corpo antigo (`id_modelo` + `grade_p/m/g/gg`) vira um item com cor nula.
- Cabeçalho mantido: `quantidade_total` = soma dos itens, `id_modelo` = modelo do primeiro item,
  `grade_p/m/g/gg` = 0 nos pedidos novos.
- Editar itens: `PUT /pedidos/{id}/itens` substitui os itens (pedido não entregue; senão 409), com as mesmas
  regras da criação — inclusive cor obrigatória em todos os itens. É assim que o pedido antigo "define a cor".
- Entregar: todos os itens precisam ter cor (400 listando os itens sem cor); todos os SKUs precisam de saldo
  (409 com `detail = {mensagem, faltas: [{id_variacao, sku, necessario, disponivel}]}`, mesmo formato do aviso
  de aviamentos da facção); então `SAIDA_ENTREGA` por SKU.
- Reverter entrega: `ESTORNO_ENTREGA` por SKU (regras de data da Fase 0 mantidas).
- Resposta do pedido ganha `itens` (modelo, cor, quantidades por tamanho com rótulo, total).

**Outras regras**
- Grade: remover tamanho que tenha SKU ou quantidade em pedido → 409 "O tamanho X tem pedidos ou estoque".
- Modelo: trocar a grade de um modelo que já tem SKU, pedido com itens ou corte por SKU → 409 (a grade antiga
  continua; dá para acrescentar tamanhos nela).
- Cor: excluir cor usada por SKU, item de pedido ou OP → 409 "Cor em uso; inative-a em vez de excluir"
  (amplia a regra da 1A, que já bloqueia cor usada por malha).
- Dashboard: estoque pronto = soma dos saldos dos SKUs.
- Seed de demonstração: cria as cores Preto e Branco, pedidos com itens e uma carga inicial por inventário
  (motivo "Carga de demonstração") no lugar da tabela antiga.

### 4.3 API (sob `/camisetas`)

| Rota | Função |
|---|---|
| `GET /produtos-prontos/?id_modelo=&id_cor=&abaixo_minimo=` | grade agrupada por modelo × cor |
| `POST /produtos-prontos/inventario` | contagem (lança diferenças) |
| `POST /produtos-prontos/ajustes` | ajuste ± com motivo |
| `PUT /produtos-prontos/variacoes/{id}/minimo` | estoque mínimo do SKU |
| `GET /produtos-prontos/movimentos/?id_variacao=&id_modelo=&tipo=&limite=` | histórico |
| `PUT /pedidos/{id}/itens` | substitui os itens do pedido |

Rotas existentes de OP, costura e pedido mantêm as URLs; os corpos ganham os campos novos (com
compatibilidade descrita acima). `GET /estoque-acabado/` continua existindo (tabela antiga, só histórico).

### 4.4 Telas

**8. Produtos Prontos** (nova página `ProdutosProntosCamisetas.jsx`)
- Filtros (modelo, cor, "só abaixo do mínimo"); tabela: linha = modelo · cor (com amostra), colunas = tamanhos,
  célula = saldo (vermelho se abaixo do mínimo), totais por linha e coluna.
- Clique numa célula → painel do SKU: ajustar (+/− com motivo), definir estoque mínimo, ver histórico.
- Botão **"Fazer inventário"**: as células viram campos de contagem; "Adicionar modelo e cor" inclui linhas que
  ainda não têm SKU; motivo com padrão "Inventário de abertura"; salvar mostra quantos SKUs mudaram.
- Aba/área **Histórico** com os últimos movimentos e filtros.

**Corte & Rendimento**
- Abrir OP: modelo + linhas de cor (cor, rolo de malha filtrado/preenchendo a cor ligada, peso); "+ Adicionar
  cor"; peças planejadas atualizam na hora.
- Finalizar corte: grade cor × tamanho (linhas = cores da OP); total e rendimento calculados na tela.
- Tabela de OPs mostra as cores da OP (amostras) e o rendimento por cor no detalhe.

**Costura & Facções**
- Envio: ao escolher a OP, grade cor × tamanho já preenchida com o disponível; dá para reduzir (parcial).
- Retorno: grade com o enviado e campo do retornado (padrão = enviado); perdas calculadas na tela.
  Remessa legada: grade livre (escolher cores e tamanhos) com limite do total enviado.

**Pedidos**
- Formulário com lista de itens: para cada item, modelo, cor e grade de tamanhos do modelo; "+ Adicionar item";
  total do pedido somado na hora. Cliente continua pelo seletor da 1A.
- Tabela mostra os itens resumidos ("Básica · Preto: P10 M20 G20"); itens sem cor aparecem com "Definir cor".
- Editar itens (modal) enquanto não entregue.
- Entrega: lista os SKUs com necessário × disponível; se faltar, mostra o que falta (sem permitir entregar).

**Componente compartilhado** `components/producao/GradeQuantidades.jsx`: grade de linhas (cores) × colunas
(tamanhos) com campos numéricos, máximos opcionais por célula, modo somente leitura, totais por linha/coluna,
navegação por Tab — usada no corte, envio, retorno, inventário e itens do pedido.

### 4.5 Organização do código

```
backend/app/models/camisetas_sku.py            # Variacao, MovimentoEstoque, OpCor, OpCorte, RemessaItem, PedidoItem, PedidoItemQtd
backend/app/schemas/camisetas_sku.py           # schemas de SKU, produtos prontos, itens de OP/remessa/pedido
backend/app/services/camisetas/sku.py          # obter_ou_criar_variacao, movimentar, descrever_variacao
backend/app/services/camisetas/produtos_prontos.py
backend/app/services/camisetas/ordens.py       # abrir OP com cores, finalizar corte por SKU, resposta da OP
backend/app/services/camisetas/costura.py      # (amplia) envio/retorno por SKU
backend/app/services/camisetas/pedidos.py      # (amplia) itens, entrega/estorno por SKU
backend/app/routers/camisetas/produtos_prontos.py
frontend-alfa/src/components/producao/GradeQuantidades.jsx (+ producao.css)
frontend-alfa/src/components/producao/ItensPedidoEditor.jsx
frontend-alfa/src/pages/ProdutosProntosCamisetas.jsx (+ .css)
```

As páginas de Corte, Costura e Pedidos usam os componentes acima para não crescer além do necessário.

## 5. Testes

- Unitários: `movimentar` (soma, `saldo_apos`, saldo negativo recusado); `obter_ou_criar_variacao` (tamanho fora
  da grade); inventário lança só diferenças; agrupamento da listagem.
- API:
  - OP com duas cores baixa os dois rolos; rolo sem saldo → 400; cor repetida → 400; corpo antigo com rolo
    ligado a cor funciona;
  - corte por SKU grava linhas e rendimento; cor fora da OP / tamanho fora da grade → 400; refazer corte após
    envio → 409;
  - envio por SKU acima do disponível → 400; retorno lança `ENTRADA_PRODUCAO` e perdas; remessa legada aceita
    distribuição livre até o total;
  - pedido com dois itens; item repetido → 400; tamanho fora da grade → 400; corpo antigo vira item sem cor;
  - entrega com item sem cor → 400; com falta → 409 com `faltas`; com saldo → `SAIDA_ENTREGA`; reverter →
    `ESTORNO_ENTREGA`;
  - editar itens após entrega → 409; remover tamanho em uso da grade → 409; trocar grade de modelo em uso → 409;
    excluir cor em uso por SKU/pedido/OP → 409;
  - produtos prontos: inventário, ajuste, mínimo, histórico, filtro abaixo do mínimo; dashboard soma SKUs.
- Migração: pedido antigo vira item com quantidades nos tamanhos certos; rótulo ausente é acrescentado à grade;
  downgrade remove as tabelas.
- Frontend: build e lint sem erros; verificação no navegador de corte multicor → envio → retorno → estoque →
  pedido → entrega, e do inventário de abertura.
- Cobertura ≥ 80% em `app/services/`.

## 6. Critérios de aceite

- [ ] Uma OP com duas cores baixa os dois rolos e registra o corte por cor × tamanho, com rendimento por cor.
- [ ] Envio e retorno da facção são feitos por SKU; o retorno entra no estoque do SKU certo.
- [ ] Remessa antiga pode ser retornada distribuindo as peças por cor × tamanho.
- [ ] Produtos Prontos mostra a grade modelo × cor × tamanho, com mínimo, ajuste com motivo e histórico.
- [ ] O inventário de abertura lança só as diferenças, e nenhuma operação deixa saldo negativo.
- [ ] Pedido tem vários itens (modelo + cor + grade); pedidos antigos aparecem com "Definir cor".
- [ ] Entrega baixa cada SKU e mostra o que falta; reverter devolve ao estoque.
- [ ] Tamanho com pedido ou estoque não pode sair da grade; modelo em uso não troca de grade; cor em uso não é excluída.
- [ ] Testes passando, cobertura ≥ 80% em `app/services/`, build e lint sem erros.
