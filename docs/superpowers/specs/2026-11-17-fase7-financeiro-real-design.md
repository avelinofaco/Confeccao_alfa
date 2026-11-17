# Fase 7 — Financeiro Real (Despesas Categorizadas, Contas a Pagar/Receber e DRE Mensal)

**Data:** 2026-11-17
**Status:** aprovada para implementação
**Roadmap:** Fase 7 de 7 (Fundação → Cadastros → Banco de Estampas → Pedido → Precificação → PDF → Produção → Financeiro real)

## 1. Objetivo

Evoluir o módulo financeiro do segmento **Camisetas** de um lançamento único de "outros custos do mês" para um controle financeiro real de confecção:
1. **Despesas operacionais categorizadas e Contas a Pagar** (`FACCAO`, `ESTAMPARIA`, `ALUGUEL`, `ENERGIA_AGUA`, `FOLHA`, `IMPOSTOS`, `FRETE`, `OUTROS`) com status (`Pago` / `Pendente`), vencimento e baixa de pagamento.
2. **Contas a Receber de Pedidos** (`status_pagamento` `Pendente` / `Pago` e `data_pagamento` em `camisetas_pedidos`).
3. **DRE Mensal Detalhado** consolidando Faturamento de Entregas, Compras de Matéria-Prima (NFs), Margem Bruta, Despesas por Categoria, Lucro Líquido e saldos A Receber / A Pagar, preservando 100% de compatibilidade com os endpoints e testes da Fase 0.

## 2. Modelo de Dados e Migração (`20261117_012_financeiro_despesas_recebimentos`)

Migração **estritamente aditiva** com `downgrade` completo:

1. **Nova tabela `camisetas_despesas` (`CamisetaDespesa`)**:
   - `id_despesa`: `Integer`, PK, autoincrement
   - `mes_ano`: `String(7)`, `nullable=False`, indexado (`ix_camisetas_despesas_mes_ano`)
   - `categoria`: `String(40)`, `nullable=False` (`FACCAO`, `ESTAMPARIA`, `ALUGUEL`, `ENERGIA_AGUA`, `FOLHA`, `IMPOSTOS`, `FRETE`, `OUTROS`)
   - `descricao`: `String(255)`, `nullable=False`
   - `valor`: `Numeric(12, 2)`, `nullable=False`
   - `data_vencimento`: `Date`, `nullable=True`
   - `data_pagamento`: `Date`, `nullable=True`
   - `status_pagamento`: `String(20)`, `nullable=False`, `server_default='Pago'` (`"Pago"` ou `"Pendente"`)
   - `criado_em`: `DateTime(timezone=True)`, `default=get_utc_now`

2. **Novas colunas em `camisetas_pedidos` (`CamisetaPedido`)**:
   - `status_pagamento`: `String(20)`, `nullable=False`, `server_default='Pendente'` (`"Pendente"` ou `"Pago"`)
   - `data_pagamento`: `Date`, `nullable=True`

## 3. Regras de Negócio e Endpoints

### 3.1 Compatibilidade com `apurar_mes` e `apurar_ano`
- O total de `outros_custos` de um `mes_ano` passa a somar:
  - `sum(CamisetaDespesa.valor)` do `mes_ano` +
  - `CamisetaRegistroFinanceiro.outros_custos_operacionais` (quando houver lançamento manual legado/avulso no mês).
- `ApuracaoMensal` e `CamisetaRegistroFinanceiroResponse` ganham campos adicionais com defaults seguros:
  - `total_despesas_lancadas: Decimal = 0.00`
  - `despesas_pagas: Decimal = 0.00`
  - `despesas_pendentes: Decimal = 0.00`
  - `qtd_despesas: int = 0`
  - `receita_recebida: Decimal = 0.00`
  - `receita_a_receber: Decimal = 0.00`

### 3.2 Novos Endpoints em `/camisetas/financeiro`
- `GET /camisetas/financeiro/despesas/?mes_ano=YYYY-MM` → lista as despesas do mês.
- `POST /camisetas/financeiro/despesas/` (`201`) → cria despesa categorizada (valida `mes_ano`, `categoria`, `valor > 0` e `descricao`).
- `PUT /camisetas/financeiro/despesas/{id_despesa}/pagar` → quita despesa pendente (`status_pagamento = "Pago"`, `data_pagamento = informada ou hoje`).
- `DELETE /camisetas/financeiro/despesas/{id_despesa}` (`204`) → remove despesa lançada por engano.
- `PUT /camisetas/financeiro/pedidos/{id_pedido}/pagamento` → atualiza `status_pagamento` (`"Pago"` ou `"Pendente"`) e `data_pagamento` de um pedido.
- `GET /camisetas/financeiro/dre/?mes_ano=YYYY-MM` → retorna o demonstrativo completo do mês (faturamento, recebido, a receber, matéria-prima, margem bruta, despesas por categoria, despesas pagas/pendentes, outros custos avulsos, lucro líquido, lista de despesas e lista de pedidos entregues no mês).

## 4. Interface (`RegistroFinanceiroCamisetas.jsx`)

- **Indicadores do Ano**: Faturamento, Compras de Matéria-Prima, Lucro Líquido e Margem Média.
- **Painel do Mês Selecionado (`DRE + Contas a Pagar e a Receber`)**:
  - Seletor de mês (`type="month"`).
  - Resumo DRE do mês (Faturamento de Entregas, Recebido vs. A Receber, Matéria-Prima, Margem Bruta, Despesas por Categoria, A Pagar Pendente e Lucro Líquido).
  - Formulário rápido para lançar **Despesa Operacional** (Categoria, Descrição, Valor R$, Vencimento, Status `Pago`/`Pendente`) e tabela de despesas do mês com botões **Quitar** e **Excluir**.
  - Tabela de **Recebimentos de Pedidos Entregues no Mês** com botão de 1 clique para alternar entre **Pago** e **Pendente**.
  - Mantém o ajuste rápido de "Outros custos avulsos / observações do mês" para compatibilidade imediata.
