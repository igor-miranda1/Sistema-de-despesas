# Painel de despesas

Aplicação para acompanhar despesas, receitas, saldo por período, categorias e orçamentos mensais. O frontend usa Vite e TypeScript vanilla; a API usa Express, TypeScript e MySQL 8.

## Pré-requisitos

- Node.js 20.19+ ou 22.12+ e npm.
- Docker Desktop com Docker Compose.

## Configuração e execução

1. Copie `.env.example` para `.env` na raiz. Ajuste as credenciais do MySQL e substitua `JWT_SECRET` por uma chave aleatória segura (recomenda-se pelo menos 32 bytes). Não use os valores de exemplo em ambientes expostos.
2. Inicie o banco:

   ```sh
   docker compose up -d
   ```

   Aguarde o healthcheck do MySQL ficar `healthy`.

3. Instale as dependências e inicie a API e o frontend:

   ```sh
   npm install
   npm run dev
   ```

   Antes de iniciar a API, o comando `npm run dev` aplica as migrations pelo usuário migrator. Abra o endereço do Vite informado no terminal (normalmente `http://localhost:5173`); o Vite encaminha `/api` para a API local.

Para aplicar migrations manualmente, com o MySQL em execução e as variáveis do `.env` configuradas:

```sh
npm run migrate
```

O runner registra cada arquivo aplicado em `schema_migrations` e não reaplica migrations registradas. `db/init.sql` é o baseline usado apenas na criação inicial do volume; mudanças de schema posteriores ficam em `db/migrations/`.

> A migration `004_users_and_expense_ownership.sql` remove despesas globais antigas, conforme o requisito de atribuir os lançamentos a usuários. Isso ocorre uma única vez quando essa migration é aplicada; faça backup antes de migrar dados que precisem ser preservados.

## Funcionalidades

- Cadastro, login e logout com sessão em cookie httpOnly.
- Cadastro com entrada imediata no painel e redefinição de senha diretamente pelo formulário de recuperação.
- Senha de cadastro com pelo menos oito caracteres; sequências numéricas previsíveis são rejeitadas. Letras e caracteres especiais são recomendados, mas opcionais.
- CRUD de despesas e receitas, isoladas por usuário.
- Categorias fixas carregadas da API: Alimentação, Transporte, Lazer, Saúde, Investimento, Moradia, Contas, Educação, Assinaturas e Outros.
- Filtros por mês, intervalo personalizado de datas ou todos os períodos, com resumo de receitas, despesas e saldo.
- Orçamento mensal por categoria, com indicador de progresso e aviso ao exceder o limite.
- Aba de gráficos mensais com receitas, despesas e saldo em barras, linha e tabela acessível.
- Datas trafegadas como `YYYY-MM-DD` e exibidas em `dd/mm/aaaa`; o intervalo personalizado usa datas inclusivas digitadas no padrão brasileiro. Valores monetários exibidos com duas casas decimais.
- Os campos de data usam um calendário próprio acessível, sempre em português do Brasil, com entrada estrita `dd/mm/aaaa`; a API continua recebendo `YYYY-MM-DD`.

## Comandos

| Comando | Descrição |
| --- | --- |
| `docker compose up -d` | Inicia o MySQL em Docker |
| `npm install` | Instala as dependências |
| `npm run dev` | Inicia API e frontend; aplica migrations pendentes |
| `npm run dev:api` | Inicia somente a API em desenvolvimento |
| `npm run dev:web` | Inicia somente o frontend Vite |
| `npm run migrate` | Aplica migrations pendentes |
| `npm run build` | Compila/typecheck da API e frontend e gera o build Vite |
| `npm run start:api` | Inicia a API compilada |
| `npm run smoke-test` | Executa verificações de autenticação e isolamento |

Execute apenas uma instância da API por vez; a porta padrão é `3001`. Migrations devem ser executadas com `npm run migrate`.

### Smoke test

Com o MySQL e a API em execução, rode:

```
npm run smoke-test
```

O teste cria dois usuários e verifica acesso sem sessão, senha incorreta e isolamento de leitura, edição e exclusão de despesas e receitas. Ele remove os lançamentos que cria, mas mantém os usuários de teste no banco. Para usar outra URL da API, defina `SMOKE_TEST_API_URL` (por exemplo, `http://127.0.0.1:3001/api`).

Para testar as funções puras de datas:

```sh
npm run test:dates
```

Para verificar os scripts shell e a suíte de segurança:

```sh
npm run test:shell-line-endings
npm run test:security
npm run build
```

## Variáveis de ambiente

| Variável | Uso | Valor no exemplo |
| --- | --- | --- |
| `MYSQL_HOST` | Host MySQL usado pela API | `127.0.0.1` |
| `MYSQL_PORT` | Porta MySQL | `3306` |
| `MYSQL_DATABASE` | Banco da aplicação | `despesas` |
| `DB_APP_USER` | Usuário DML da aplicação | `despesas_app` |
| `DB_APP_PASSWORD` | Senha DML da aplicação | Definida localmente |
| `DB_MIGRATOR_USER` | Usuário DDL das migrations | `despesas_migrator` |
| `DB_MIGRATOR_PASSWORD` | Senha DDL das migrations | Definida localmente |
| `MYSQL_ROOT_PASSWORD` | Senha root exigida pelo container | Definida localmente |
| `JWT_SECRET` | Segredo de assinatura das sessões (obrigatório; recomenda-se pelo menos 32 bytes) | Substitua pelo seu segredo |
| `API_PORT` | Porta da API | `3001` |
| `VITE_APP_NAME` | Título da aplicação | `Despesas — Painel financeiro` |
| `VITE_LOCALE` | Variável legada; a interface usa `pt-BR` explicitamente | `pt-BR` |
| `VITE_CURRENCY` | Moeda apresentada | `BRL` |
| `SMOKE_TEST_API_URL` | URL base opcional para o smoke test | `http://127.0.0.1:3001/api` |
| `ALLOWED_ORIGINS` | Origens permitidas para mutações | `http://localhost:5173,http://127.0.0.1:5173` |

Variáveis com prefixo `VITE_` são embutidas no navegador e não devem conter segredos. O arquivo `.env` é ignorado pelo Git.

## API

Todas as rotas de dados exigem sessão autenticada. As rotas que criam, atualizam ou excluem dados exigem `Content-Type: application/json`.

- Autenticação: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- A recuperação usa `POST /api/auth/password-reset/confirm` com email e nova senha. Nenhum código ou email é necessário neste momento.
- Categorias: `GET /api/categorias`.
- Despesas: `GET /api/despesas?mes=YYYY-MM` ou `GET /api/despesas?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD`, `GET /api/despesas/:id`, `POST /api/despesas`, `PUT /api/despesas/:id`, `DELETE /api/despesas/:id`.
- Receitas: `GET /api/receitas?mes=YYYY-MM` ou `GET /api/receitas?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD`, `GET /api/receitas/:id`, `POST /api/receitas`, `PUT /api/receitas/:id`, `DELETE /api/receitas/:id`.
- Orçamentos: `GET /api/orcamentos`, `PUT /api/orcamentos/:categoriaId`, `DELETE /api/orcamentos/:categoriaId`.
- Resumo gráfico: `GET /api/resumo/mensal?ate=YYYY-MM&meses=6` (ou `meses=12`).
- Conta: `GET /api/auth/me/export` e `DELETE /api/auth/me` (a exclusão exige a senha no corpo).
- Saúde: `GET /api/saude`.

Use `mes` ou o par `dataInicio`/`dataFim` (ambos inclusivos), nunca os dois filtros juntos. Sem filtro, a consulta retorna todos os períodos. A interface apresenta as datas conforme pt-BR; a API recebe datas no formato `YYYY-MM-DD`. Valores monetários são números positivos.

O resumo mensal agrega receitas e despesas separadamente, exige autenticação, recebe o mês final do cliente e preenche meses sem movimentações com valores zero.

## Publicação

Copie `.env.prod.example` para `.env.prod`, substitua todos os placeholders e configure o domínio DNS. Execute `docker compose -f docker-compose.prod.yml up -d --build`; o Caddy termina TLS automaticamente e o MySQL não publica porta.

Backups:

```sh
set -a; . ./.env.prod; set +a
./scripts/backup.sh
./scripts/restore.sh backups/arquivo.sql.gz
```

Teste a restauração primeiro em um banco descartável, nunca diretamente no banco de produção.

Este é um projeto de estudo. Não use esta configuração em produção.

## Banco de dados

As migrations versionadas em `db/migrations/` são executadas em ordem pelo runner:

- `001_add_expense_categories.sql` — categorias iniciais legadas.
- `002_add_expense_date.sql` — data das despesas.
- `003_categories_table.sql` — normalização e seed das categorias.
- `004_users_and_expense_ownership.sql` — usuários e isolamento de despesas.
- `005_category_budgets.sql` — orçamentos por categoria e usuário.
- `006_income.sql` — receitas.
- `007_password_reset_tokens.sql` — códigos temporários de redefinição de senha.

Para recriar o banco do zero, o comando abaixo remove permanentemente o volume Docker e todos os dados:

```sh
docker compose down -v
docker compose up -d
```

Após a inicialização, rode `npm run migrate` para aplicar as migrations ao baseline de `db/init.sql`. Para executar o smoke test de autenticação, isolamento e CRUD, inicie a API e rode `npm run smoke-test`. O cadastro já cria a sessão diretamente e não usa código de verificação por e-mail.
