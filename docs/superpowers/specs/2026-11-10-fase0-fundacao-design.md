# Fase 0 — Fundação (Segmento Camisetas)

**Data:** 2026-11-10
**Status:** proposta, aguardando revisão
**Roadmap:** Fase 0 de 7 (Fundação → Cadastros → Banco de Estampas → Pedido → Precificação → PDF → Produção → Financeiro real)

## 1. Objetivo

Deixar a base do segmento Camisetas confiável antes de construir estampas, precificação e o novo pedido:
os números do financeiro e do estoque precisam refletir a realidade, os códigos de documentos não podem
colidir e o código precisa estar organizado e testado para receber as próximas fases.

## 2. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Segmento | Somente **Camisetas** evolui. Moda Íntima fica congelada (código mantido, sem novas funcionalidades). |
| Implantação | **Uma instalação por confecção** (sem multi-empresa por enquanto). |
| Situação dos dados | **Piloto**: dados preservados, correções permitidas. |
| Backup | Não será feito. Por isso todas as migrações desta fase são **somente aditivas** (não removem tabelas/colunas) e têm `downgrade`. |
| Segurança | **Adiada** para uma fase própria (login obrigatório, cadastro fechado, SECRET_KEY no ambiente, `.env` fora do git, `/seed-inicial` protegido). |

## 3. Escopo

### Dentro
1. Financeiro calculado a partir das movimentações (fim dos dados de demonstração e da contagem em dobro).
2. Data de entrega real do pedido como campo próprio.
3. Regras de retorno de facção e status da OP.
4. Custo médio ponderado na entrada de NF.
5. Baixa de aviamentos com aviso (sem travar a produção).
6. Códigos sequenciais de Pedido e OP gerados pelo servidor.
7. Dashboard sem números fictícios.
8. Reorganização do backend e remoção de código morto.
9. Feedback de interface padronizado e menu na ordem do processo.
10. Testes automatizados das regras de negócio.

### Fora (com destino)
- Segurança → fase própria, antes de abrir para outras confecções.
- Grade por tamanho no retorno da facção, estoque por SKU (modelo × cor × tamanho) e ajuste de inventário → **Fase 1** (a grade fixa P/M/G/GG será substituída; fazer agora seria retrabalho).
- PDF do financeiro (popup + `window.print`) → **Fase 5**, junto com o exportador de PDF do pedido.
- Contas a pagar/receber e DRE completo → **Fase 7**.

## 4. Desenho

### 4.1 Financeiro calculado (sem "Sincronizar")

**Regra:** os valores do mês são calculados na hora a partir dos registros reais. Nada de totais gravados
que ficam desatualizados.

| Valor do mês | Origem |
|---|---|
| Faturamento | Soma de `valor_total` dos pedidos com `data_entrega_realizada` dentro do mês |
| Gasto com materiais | Soma de `valor_total` das entradas de insumo (`camisetas_entradas_insumos.data_entrada`) dentro do mês |
| Outros custos | `outros_custos_operacionais` lançado manualmente para o mês |
| Lucro | Faturamento − Gasto com materiais − Outros custos |

- Os limites do mês usam o fuso **America/Sao_Paulo** (constante `FUSO_HORARIO` em `app/core/config.py`),
  pois as datas são gravadas em UTC e uma NF lançada às 22h do dia 31 não pode cair no mês seguinte.
- `mes_ano` é validado no formato `YYYY-MM` (resposta 422 se inválido).
- **Serviço único** `services/camisetas/financeiro.py`:
  - `apurar_mes(db, mes_ano) -> ApuracaoMensal`
  - `apurar_ano(db, ano) -> list[ApuracaoMensal]` (12 meses, meses sem movimento retornam zeros)
- **Endpoints:**
  - `GET /camisetas/financeiro/?ano=2026` → 12 meses calculados (padrão: ano corrente). A resposta
    **mantém os nomes de campo atuais** (`mes_ano`, `valor_gasto_materiais`, `faturamento_receita`,
    `outros_custos_operacionais`, `lucro_liquido`, `observacoes`; `id_registro` passa a ser nulo quando o mês
    não tem lançamento manual) e acrescenta `qtd_pedidos_entregues` e `qtd_entradas`, para o frontend atual
    continuar funcionando durante a implantação.
  - `GET /camisetas/financeiro/apuracao-mensal/?mes_ano=2026-10` → um mês (mesmos campos de hoje).
  - `POST /camisetas/financeiro/` grava/atualiza **só** `outros_custos_operacionais` e `observacoes` do
    `mes_ano`; os campos de faturamento/gasto/lucro tornam-se opcionais no corpo e são ignorados.
  - `POST /camisetas/financeiro/sincronizar-automatico/` é **removido**.
- O gráfico do dashboard usa `apurar_ano`.
- As colunas `valor_gasto_materiais`, `faturamento_receita` e `lucro_liquido` de
  `camisetas_registros_financeiros` deixam de ser lidas e escritas (permanecem na tabela; remoção numa
  fase futura). Os registros de demonstração existentes ficam inofensivos, pois têm outros custos = 0.

**Tela Financeiro:** some o botão "Sincronizar"; o formulário pede apenas "Outros custos do mês" e
observações; a tabela mostra os 12 meses calculados com a origem de cada número (ex.: "3 pedidos
entregues · 5 notas fiscais").

### 4.2 Data de entrega realizada

- Migração adiciona `camisetas_pedidos.data_entrega_realizada` (`Date`, nulo).
- Preenchimento dos pedidos já entregues: extrair a data do texto `[ENTREGA REALIZADA em dd/mm/aaaa`
  em `observacoes`; se não houver, usar a data de `atualizado_em`.
- `POST /pedidos/{id}/entregar` grava a data (informada ou hoje).
- `PUT /pedidos/{id}/status`:
  - aceita só os status válidos: `Aguardando Produção`, `Em Produção`, `Pronto no Estoque`, `Entregue`
    (400 para outros valores);
  - **não** permite mudar para `Entregue` (400: "Use Registrar entrega"), para que toda entrega passe pela
    validação de estoque;
  - ao reverter de `Entregue`, devolve as peças ao estoque acabado (comportamento atual) e limpa
    `data_entrega_realizada`.

### 4.3 Retorno de facção e status da OP

Em `PUT /costura/{id}/retornar`:
- 409 se a remessa não estiver `Em Costura Externa` ("Esta remessa já teve o retorno registrado").
- 400 se `quantidade_retornada` > `quantidade_enviada`.
- Status da OP após o retorno:
  - `Costura Finalizada` somente se **todas** as peças cortadas já foram enviadas **e** nenhuma remessa da
    OP está pendente;
  - caso contrário permanece `Em Costura`.
- A soma ao estoque acabado continua pelo total (`quantidade_total`); a grade por tamanho fica para a Fase 1.

### 4.4 Custo médio ponderado

Em `POST /insumos/entrada/`, antes de somar o saldo:

```
se valor_total > 0:
    se saldo_anterior > 0:
        novo_custo = (saldo_anterior × custo_anterior + valor_total) ÷ (saldo_anterior + quantidade)
    senão:
        novo_custo = valor_total ÷ quantidade
senão:
    custo médio não muda (entrada sem valor, ex.: bonificação)
```

Arredondamento: 2 casas (`ROUND_HALF_UP`), compatível com `Numeric(12,2)`.
Regra isolada em `services/camisetas/estoque.py::calcular_custo_medio(...)` (função pura).

### 4.5 Baixa de aviamentos com aviso

Em `POST /costura/enviar`:
- O sistema calcula a necessidade de cada aviamento da ficha técnica (consumo × quantidade × (1 + margem%)).
- Se algum saldo for insuficiente e a requisição **não** trouxer `confirmar_saldo_insuficiente: true`,
  responde **409** com a lista de faltas: `[{codigo, descricao, necessario, disponivel, unidade}]`.
- O frontend mostra um diálogo: "Faltam no estoque: Linha 120 — precisa 3,09, tem 1,00 carretel.
  [Cancelar] [Enviar mesmo assim]". Ao confirmar, reenvia com a flag e o saldo pode ficar negativo.
- **Removido** o "plano B" que baixava todos os aviamentos cadastrados com taxas fixas (0,02 / 1,0)
  quando o modelo não tinha aviamentos na ficha. No lugar, a resposta traz
  `avisos: ["Modelo sem aviamentos na ficha técnica; nenhum aviamento foi baixado."]`.
- Tela de Estoque: saldo negativo aparece em vermelho com o selo "Negativo — conferir inventário".

### 4.6 Códigos sequenciais

- Nova tabela `sequencias_documentos (prefixo VARCHAR, ano INT, ultimo_numero INT, PK(prefixo, ano))`.
- `services/sequencias.py::proximo_codigo(db, prefixo) -> str` usa `SELECT ... FOR UPDATE` na linha do
  prefixo/ano (cria se não existir), incrementa e devolve `PED-2026-0001` / `OP-2026-0001`.
  A numeração reinicia a cada ano.
- `POST /pedidos/` e `POST /ordens/` geram o código no servidor; o campo `codigo_*` do corpo passa a ser
  opcional e é ignorado. O frontend deixa de gerar códigos.
- Códigos antigos (`PED-123`, `OP-CAM-101`) permanecem; o formato novo não colide com eles.

### 4.7 Dashboard sem números fictícios

- Removidos os valores inventados: mínimo de 252 peças, tecido padrão "Meia Malha 30.1 Penteada",
  rendimento padrão 5,60 e a série fixa de 12 meses.
- Sem dados, o backend devolve zeros/`null` e o frontend mostra estado vazio
  ("Nenhum corte registrado ainda").
- A definição atual dos cards é mantida (fora os valores fictícios).

### 4.8 Organização do código

**Backend** — URLs não mudam:

```
app/routers/camisetas/
  __init__.py      # router com prefix="/camisetas" incluindo os sub-routers
  dashboard.py
  pedidos.py
  insumos.py
  modelos.py       # modelos + ficha técnica
  ordens.py        # corte e rendimento
  costura.py
  financeiro.py
  seed.py          # inalterado (proteção fica na fase de segurança)
app/services/
  sequencias.py
  camisetas/
    estoque.py     # custo médio, necessidade/baixa de aviamentos
    financeiro.py  # apuração mensal/anual
    costura.py     # regras de retorno e status da OP
    pedidos.py     # montagem da resposta do pedido (hoje repetida 4×), entrega/reversão
app/core/config.py # FUSO_HORARIO e constantes
```

- Funções de rota finas: validam entrada, chamam o serviço, devolvem a resposta.
- Remoção de `Base.metadata.create_all` em `main.py` **somente depois** de confirmar que o banco de
  produção tem a tabela `alembic_version` e que `alembic check` não aponta diferenças. Se o banco foi
  criado pelo `create_all`, fazer `alembic stamp` na revisão correspondente antes.

**Frontend** — remover código morto:
- `pages/EnfestoCorteCamisetas.jsx` + `.css` e `pages/CosturaCamisetas.jsx` + `.css` (não são importados
  e chamam endpoints inexistentes).

### 4.9 Feedback de interface e menu

- `components/feedback/`:
  - `ToastProvider` + `useToast()` → mensagens de sucesso/erro/aviso no canto da tela, somem sozinhas.
  - `ConfirmDialog` + `useConfirm()` → diálogo acessível (foco preso, Esc fecha), retorna `Promise<boolean>`.
- Substituir `alert()`/`window.confirm()` nas telas de Camisetas:
  `PedidoCamisetas` (8), `CosturaFaccoesCamisetas` (6), `RegistroFinanceiroCamisetas` (6),
  `FichaTecnicaCamisetas` (1). O toast local de `PedidoCamisetas` migra para o compartilhado.
- Menu de Camisetas na ordem do processo:
  1. Dashboard · 2. Pedidos do Cliente · 3. Ficha Técnica · 4. Estoque de Insumos ·
  5. Corte & Rendimento · 6. Costura & Facções · 7. Financeiro · Perfil

### 4.10 Tratamento de erros

- Erros de regra de negócio: 400 (dado inválido), 404 (não encontrado), 409 (conflito de estado ou
  confirmação necessária), sempre com `detail` em português claro e acionável.
- O 409 de aviamentos usa `detail: {mensagem, faltas: [...]}` para o frontend montar o diálogo.
- Frontend: todo erro de API vira toast com o `detail`; nada falha em silêncio (os `.catch(() => ({data: []}))`
  das telas de Camisetas passam a mostrar toast de erro além do estado vazio).

## 5. Migrações (Alembic, somente aditivas)

1. `add_data_entrega_realizada`: coluna + preenchimento dos pedidos entregues. Downgrade remove a coluna.
2. `add_sequencias_documentos`: tabela nova. Downgrade remove a tabela.

## 6. Testes

- `backend/tests/` com pytest + `fastapi.testclient`, banco SQLite em memória via override de `get_db`.
  Dependências em `backend/requirements-dev.txt` (`pytest`, `pytest-cov`, `httpx`).
- Escrever cada teste **antes** da correção correspondente (vermelho → verde).
- Meta: **80% de cobertura** em `app/services/`.
- Casos mínimos:
  - custo médio: saldo zero, saldo positivo, valor zero, arredondamento;
  - financeiro: mês com entregas e NFs; NF às 23h do último dia (fuso); pedido criado num mês e entregue
    no outro conta no mês da entrega; mês sem movimento = zeros; `mes_ano` inválido = 422;
  - retorno de facção: retorno duplo = 409; retorno maior que o enviado = 400; OP só finaliza com tudo
    enviado e retornado;
  - aviamentos: falta sem confirmação = 409 com lista; com confirmação baixa e fica negativo; modelo sem
    aviamentos gera aviso e não baixa nada;
  - sequências: primeiro código do ano, incremento, virada de ano, prefixos independentes;
  - pedido: mudar para `Entregue` via status = 400; reverter entrega limpa a data e devolve estoque;
  - dashboard: banco vazio não devolve números fictícios.
- Frontend: `npm run build` e `npm run lint` sem erros + verificação manual das telas alteradas no navegador.
- Observação: `FOR UPDATE` não tem efeito no SQLite; a concorrência das sequências é garantida pelo
  PostgreSQL e não é coberta pelos testes.

## 7. Implantação

1. Backend primeiro (compatível com o frontend atual: códigos enviados pelo frontend são ignorados; o
   botão "Sincronizar" antigo passa a falhar com erro visível até o frontend novo subir).
2. `alembic upgrade head` no Render.
3. Frontend em seguida (Vercel).

## 8. Critérios de aceite

- [ ] Financeiro e gráfico do dashboard mostram apenas valores calculados de movimentações reais.
- [ ] Não existe mais botão nem endpoint de "Sincronizar".
- [ ] Pedido entregue conta no faturamento do mês da entrega.
- [ ] Retorno de facção não pode ser lançado duas vezes; OP só finaliza com todas as peças de volta.
- [ ] Custo médio muda corretamente a cada NF.
- [ ] Envio para facção com aviamento insuficiente pede confirmação e não trava.
- [ ] Pedidos e OPs novos recebem `PED-AAAA-NNNN` / `OP-AAAA-NNNN` sem colisão.
- [ ] Dashboard com banco vazio mostra estado vazio, não números inventados.
- [ ] Nenhum `alert()`/`window.confirm()` nas telas de Camisetas.
- [ ] Menu na ordem do processo.
- [ ] Testes passando e cobertura ≥ 80% em `app/services/`.
- [ ] Nenhuma URL existente usada pelo frontend mudou, exceto a remoção do "Sincronizar".
