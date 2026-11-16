# Segurança — fechar o sistema antes do portal do cliente

**Data:** 2026-11-16
**Status:** proposta, aguardando revisão
**Branch:** `feat/camisetas-seguranca` (a partir de `feat/camisetas-estoque-sku`, que já contém as Fases 0, 1A e 1B)
**Roadmap:** fase própria, fora da numeração. Vem **antes** do Banco de Estampas (Fase 2) e do portal do
cliente, porque os dois expõem o sistema a quem está fora da confecção.

## 1. Objetivo

Hoje o sistema não tem porta. Esta fase coloca uma: ninguém lê nem altera dado de negócio sem estar
logado, o segredo que assina os tokens sai do código, e as duas rotas que hoje permitem criar usuário e
repovoar o banco deixam de ser públicas.

## 2. O que está aberto hoje (verificado em 2026-11-16)

| Problema | Evidência |
|---|---|
| Nenhuma rota exige autenticação | `grep -r "get_current_user\|oauth2_scheme" app/routers/` → 0 ocorrências. O `/login` emite token, mas nada o confere. |
| `SECRET_KEY` fixa no código | `app/core/security.py:8` — `"sua_chave_secreta_super_segura_aqui"`, em repositório público. Qualquer pessoa forja um token válido. |
| Cadastro de usuário aberto | `POST /usuarios/` sem proteção. Durante o QA desta sessão um usuário foi criado por `curl`, sem credencial nenhuma. |
| Seed aberto | `POST /camisetas/seed-inicial` repovoa o banco para quem chamar. |
| Frontend sem guarda | `/camisetas/produtos-prontos` e as demais abrem direto pela URL, sem token. |

## 3. Decisões já tomadas

| Decisão | Escolha |
|---|---|
| Quem usa por dentro | Várias pessoas da confecção, **todas com acesso igual**. Sem restrição por perfil nesta fase. |
| Primeira conta em produção | Criada **no boot**, a partir de `ADMIN_LOGIN` e `ADMIN_SENHA` do ambiente, só se não houver nenhum usuário. Render no plano gratuito não dá shell, então script não serve. |
| Duração da sessão | **12 horas** (uma jornada), no lugar da 1 hora atual. |
| Segredos do repositório | **Fora desta fase.** O usuário cuida do `.env` versionado e da rotação da senha do banco por conta própria. Esta fase não mexe no versionamento. |
| Perfis (Gestor/Operador) | O campo continua existindo e sendo gravado, mas **não restringe nada** por enquanto. |

## 4. Escopo

### Dentro

1. Dependência de autenticação aplicada a todos os módulos de negócio.
2. `SECRET_KEY` e duração do token vindos do ambiente.
3. `POST /usuarios/` fechado; criação da primeira conta pelo ambiente, no boot.
4. `/camisetas/seed-inicial` protegido e recusado em produção.
5. Guarda de rota e tratamento de 401 no frontend.
6. Tela para cadastrar colegas (usuário logado cria outro usuário).
7. Testes: os existentes passam a autenticar; novos cobrem a porta.

### Fora (com destino)

- Restrição por perfil (Gestor × Operador) → quando houver funcionário que não deva ver valores.
- Conta e acesso **de cliente** (login externo, aprovação de pedido, pedido pelo celular) → fase do
  **portal do cliente**, depois do Banco de Estampas.
- Troca e recuperação de senha pelo próprio usuário → portal, junto com o cadastro de cliente.
- Registro de auditoria (quem alterou o quê) → quando houver mais de duas pessoas usando.
- Rotação da senha do Postgres e limpeza do histórico do git → **ação do usuário**, documentada no
  roteiro de produção.

## 5. Desenho

### 5.1 Configuração (`app/core/config.py`)

```
SECRET_KEY                    obrigatória em produção; em desenvolvimento, gerada aleatória a cada
                              subida com aviso no log (os tokens morrem no restart, o que é aceitável)
ACCESS_TOKEN_EXPIRE_MINUTES   padrão 720 (12 h)
AMBIENTE                      "desenvolvimento" (padrão) ou "producao"
ADMIN_LOGIN, ADMIN_SENHA      opcionais; só usadas no bootstrap
```

Com `AMBIENTE=producao` e sem `SECRET_KEY`, a aplicação **não sobe** — falha clara no startup em vez de
assinar tokens com chave conhecida.

### 5.2 A porta (`app/core/auth.py`, novo)

- `usuario_atual(token) -> Usuario`: lê o `Authorization: Bearer`, valida assinatura e expiração,
  carrega o usuário pelo `sub` e confere `ativo`.
- Erros: token ausente, inválido ou expirado → **401** com `WWW-Authenticate: Bearer`; usuário inativo
  ou apagado → **401** também. Aqui o 401 é proposital e diferente do `/login`, que continua com **400**
  para usuário inativo: no login a pessoa já provou a senha e merece saber que a conta foi desativada;
  com um token na mão, de fora não se distingue "inativo" de "inválido", e não vale entregar a dica.
- Aplicada **no `include_router`** de cada módulo em `main.py`:
  `app.include_router(camisetas.router, dependencies=[Depends(usuario_atual)])`. Uma linha por módulo
  cobre todas as rotas atuais e futuras daquele módulo — nenhuma fica esquecida.
- Abertos: `GET /` (health), `POST /login`, `/docs`, `/openapi.json`.

### 5.3 Usuários

- `POST /usuarios/` passa a exigir token: quem já está dentro cadastra colegas.
- `GET/PUT /usuarios/{id}` exigem token.
- **Bootstrap no startup:** se `usuarios` estiver vazia e `ADMIN_LOGIN`/`ADMIN_SENHA` existirem, cria a
  conta e registra no log (sem a senha). Com qualquer usuário existente, não faz nada. É idempotente:
  rodar mil vezes tem o mesmo efeito de rodar uma.

### 5.4 Seed

`POST /camisetas/seed-inicial` exige token **e** responde **403** quando `AMBIENTE=producao`, com
mensagem explicando que dados de demonstração não entram em produção.

### 5.5 Frontend

- `RotaProtegida`: componente que envolve as rotas internas; sem token no `localStorage`, redireciona
  para `/`.
- Interceptor de resposta no axios: **401** → limpa o token e volta ao login com o aviso "Sua sessão
  expirou. Entre de novo." (via `useToast`, não `alert`).
- Tela de cadastro de colega: formulário simples (nome, login, senha) em Configurações, chamando
  `POST /usuarios/`.
- O interceptor de requisição que já envia o `Bearer` continua como está.

### 5.6 Testes

- `conftest.py` ganha `cliente_autenticado`: cria um usuário e injeta o `Authorization` em todas as
  chamadas. Os testes de API existentes passam a usá-lo.
- Novos: rota de negócio sem token → 401; token inválido → 401; token expirado → 401; usuário inativo →
  401; login com senha errada → 401; seed em produção → 403; `POST /usuarios/` sem token → 401;
  bootstrap cria quando vazio e não cria quando já há usuário.
- O `cliente` sem autenticação continua existindo para os testes que conferem justamente o 401.

## 6. Critérios de aceite

- [ ] Nenhuma rota de negócio responde sem token válido (conferido por teste, módulo a módulo).
- [ ] Com `AMBIENTE=producao` e sem `SECRET_KEY`, a aplicação não sobe.
- [ ] `grep "sua_chave_secreta_super_segura_aqui" app/` não encontra nada.
- [ ] A primeira conta nasce das variáveis de ambiente, e só quando não há usuário.
- [ ] `POST /usuarios/` e `/camisetas/seed-inicial` recusam quem não está logado; o seed também recusa
      em produção.
- [ ] Abrir `/camisetas/produtos-prontos` sem estar logado leva ao login.
- [ ] Sessão expirada derruba para o login com aviso, sem tela quebrada.
- [ ] A suíte toda passa e a cobertura de `app/services/` segue ≥ 80%.
- [ ] O usuário recebe o roteiro de produção: rotacionar a senha do banco, definir `SECRET_KEY`,
      `ADMIN_LOGIN`, `ADMIN_SENHA` e `AMBIENTE=producao` no Render.
