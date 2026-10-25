# PRD — Painel de despesas

## 1. Visão geral

Aplicação web para registrar e acompanhar despesas persistidas em MySQL. O painel permite adicionar despesas, consultar a lista completa e visualizar os totais geral e por categoria.

## 2. Objetivo

Entregar uma interface simples para que a pessoa usuária registre despesas e acompanhe como os valores se distribuem entre categorias, com armazenamento persistente em MySQL e sem necessidade de cadastro.

## 3. Público e contexto de uso

- Pessoas que desejam registrar despesas manualmente e consultar seus totais.
- Os dados são mantidos no banco e restaurados ao abrir ou recarregar a página.
- Como não há autenticação, os dados são globais e compartilhados por todas as pessoas que acessarem a aplicação.

## 4. Escopo

### Incluído

- Adicionar uma despesa com título, valor e categoria.
- Exibir todas as despesas adicionadas em uma lista.
- Exibir a soma de todas as despesas.
- Exibir o total acumulado de cada categoria fixa.
- Atualizar os valores apresentados após a inclusão de uma despesa.
- Persistir despesas em MySQL por meio de uma API HTTP.

### Fora do escopo

- Cadastro, edição ou exclusão de categorias.
- Edição ou exclusão de despesas.
- Autenticação e suporte a múltiplos usuários.
- Relatórios ou exportação de dados.

## 5. Requisitos funcionais

### RF-01 — Adicionar despesa

Disponibilizar um card com formulário para incluir uma despesa contendo:

- **Título:** texto que identifica a despesa.
- **Valor:** número que representa o valor da despesa.
- **Categoria:** uma das categorias fixas definidas neste documento.

Ao confirmar o formulário, a aplicação deve enviar os dados à API. Após a confirmação de persistência pela API, a despesa criada com identificador UUID do tipo `string` deve ser adicionada à lista e os totais geral e por categoria devem ser atualizados.

### RF-02 — Validar dados de entrada

- Título, valor e categoria são obrigatórios.
- O valor deve ser numérico e maior que zero.
- A categoria selecionada deve pertencer à lista fixa.
- Uma entrada inválida não deve ser adicionada nem alterar os totais; a interface deve informar que é necessário corrigir os campos.

### RF-03 — Listar despesas

- Exibir abaixo do formulário todas as despesas persistidas e carregadas pela API.
- Cada item deve apresentar, no mínimo, título, valor e categoria.
- A lista deve estar ordenada por data de criação crescente, usando o ID como desempate.
- Quando ainda não houver despesas, apresentar um estado vazio informativo.

### RF-04 — Exibir resumo

Na sidebar à esquerda, apresentar:

- A soma dos valores de todas as despesas.
- A soma dos valores de cada categoria fixa, inclusive categorias sem despesas, cujo total deve ser zero.

Todos os totais devem ser calculados a partir da lista de despesas carregada pela API e atualizados após cada inclusão confirmada.

### RF-05 — Persistir dados em MySQL via API

As despesas devem ser armazenadas em MySQL por meio da API. Ao iniciar ou recarregar a aplicação, a lista e os totais devem ser restaurados a partir dos dados retornados pela API.

## 6. Categorias

As categorias são fixas e não podem ser criadas ou alteradas pela pessoa usuária:

- Alimento
- Investimento
- Lazer
- Saúde
- Transporte
- Outros

Usar esses valores de forma consistente no formulário, nos itens da lista e no resumo por categoria.

## 7. Requisitos visuais e de experiência

- A interface deve ter um card de inclusão de despesa.
- A lista de despesas deve aparecer abaixo desse card.
- Uma sidebar à esquerda deve reunir o total geral e os totais por categoria.
- O formulário, a lista e o resumo devem ser visualmente distinguíveis e fáceis de entender.
- Valores devem ser apresentados em formato monetário consistente, com duas casas decimais.
- Campos e controles devem ter rótulos claros; erros de validação e estado vazio devem ser perceptíveis.
- A interface deve continuar utilizável em telas menores: reorganizar o conteúdo sem esconder o formulário, a lista ou os totais. Em telas estreitas, a sidebar pode passar para cima do conteúdo principal.
- Priorizar legibilidade e simplicidade, sem introduzir elementos visuais ou funcionalidades que não contribuam para o acompanhamento das despesas.

## 8. Requisitos técnicos

- Usar Vite para desenvolvimento e build.
- Implementar com HTML, CSS e TypeScript vanilla, sem framework de interface.
- Implementar a API em Node.js, Express, TypeScript e `mysql2/promise`, usando pool de conexões e SQL puro, sem ORM.
- Usar MySQL 8 em Docker Compose; somente o banco roda em Docker. A API e o frontend rodam localmente com npm.
- Criar a tabela pelo script `db/init.sql`, montado em `/docker-entrypoint-initdb.d/`, com charset `utf8mb4` e volume nomeado.
- A tabela `despesas` deve conter ID UUID (`CHAR(36)`), título (`VARCHAR(120)`), valor (`DECIMAL(10,2)` com restrição maior que zero), categoria fixa (`ENUM('alimento','Transporte','Lazer','Saúde','Investimento','outros')`) e data de criação (`TIMESTAMP`). A API converte `Alimento`/`Outros` para os valores do ENUM e vice-versa.
- Disponibilizar `GET /api/despesas`, `POST /api/despesas` e `GET /api/saude`. O Vite deve encaminhar `/api` à API por proxy.
- Validar as entradas no servidor, usar queries parametrizadas, converter valores `DECIMAL` para `number` nas respostas e não expor detalhes internos em erros.
- Manter as despesas carregadas em memória no frontend e recalcular os totais a partir dessa lista; a persistência é responsabilidade do MySQL via API.
- Declarar todos os tipos TypeScript no arquivo `src/types.ts`.
- Representar uma despesa com os campos:

  ```ts
  interface Despesa {
    id: string;
    titulo: string;
    valor: number;
    categoria: Categoria;
  }
  ```

- Definir `Categoria` como um tipo restrito às seis categorias fixas deste documento.
- Associar eventos exclusivamente pelo TypeScript; não usar atributos de evento inline no HTML.
- Manter o código simples, legível e fácil de manter, separando estrutura, estilos, tipos e comportamento conforme a organização existente no projeto.

## 9. Critérios de aceite

1. A aplicação inicia e pode ser compilada pelo fluxo existente do projeto Vite.
2. O formulário oferece título, valor e seleção entre as seis categorias fixas.
3. Uma despesa válida recebe um ID string e aparece na lista com os dados informados.
4. Campos ausentes, valor não numérico, zero ou valor negativo impedem a inclusão e geram indicação de validação.
5. Após cada inclusão, o total geral e o total da categoria correspondente são atualizados corretamente.
6. Todas as categorias aparecem no resumo, inclusive aquelas cujo total é zero.
7. A lista vazia apresenta uma mensagem ou indicação apropriada antes da primeira inclusão.
8. Após recarregar a página, as despesas e os totais são restaurados a partir do banco.
9. Os eventos da interface são tratados em TypeScript, sem handlers inline no HTML.
10. Todos os tipos de domínio TypeScript estão declarados em `src/types.ts`.
11. O conteúdo principal e os totais permanecem acessíveis e legíveis em telas estreitas.

## 10. Decisões e pontos não especificados

- Não foram definidos controles de edição ou remoção de despesas; portanto, não fazem parte da primeira implementação.
- Não foi definida uma localidade monetária. A implementação deve escolher um formato consistente e aplicar o mesmo formato em todos os valores.
- Os nomes das categorias foram mantidos conforme fornecidos no brain dump, inclusive a capitalização.
- Não há autenticação; os dados são globais e compartilhados por todas as pessoas que acessarem a aplicação.

## 11. Fase 1 — Migrations e data da despesa

### Requisitos

- `db/init.sql` é o baseline para bancos novos. Toda alteração de schema após ele deve ser uma migration versionada em `db/migrations/NNN_descricao.sql`.
- Um runner registra migrations em `schema_migrations(nome, aplicada_em)`, executa pendentes em ordem e roda antes de iniciar a API. `npm run migrate` também executa o runner. Somente o runner usa uma conexão com `multipleStatements: true`.
- Adicionar `despesas.data DATE NOT NULL`, preenchendo registros existentes com `DATE(criada_em)`, e indexar `data`.
- POST e PUT de despesas exigem `data` válida no formato `YYYY-MM-DD`; GET retorna a data como string nesse formato. O pool usa `dateStrings: true`.
- O formulário começa com a data de hoje no fuso local do navegador; edição preserva a data, e cada lançamento apresenta a data em `dd/mm/aaaa`.
- Listagem ordenada por `data ASC`, depois `criada_em ASC`.

### Categorias

Nesta fase, permanecem as dez categorias existentes: Alimento, Investimento, Lazer, Saúde, Transporte, Moradia, Contas, Educação, Assinaturas e Outros. A migração para tabela é escopo exclusivo da Fase 2.

### Critérios de aceite

1. Uma despesa salva persiste a data submetida e GET a devolve como `YYYY-MM-DD`.
2. Data ausente, impossível ou em formato incorreto recebe HTTP 400.
3. O formulário usa a data local de hoje por padrão e apresenta datas da lista em `dd/mm/aaaa`.
4. Reiniciar a API não reaplica migrations já registradas.
5. Em um banco novo, `db/init.sql` seguido de todas as migrations produz o schema atual desta fase.
6. Build/typecheck da API e frontend passa.

## 16. Fase 6 — Receitas e saldo

### Requisitos

- Criar tabela `receitas` com UUID, `usuario_id` FK, título (`VARCHAR(120)`), valor (`DECIMAL(10,2)` positivo), data (`DATE`), timestamp de criação e índice `(usuario_id, data)`.
- Disponibilizar CRUD autenticado de receitas: GET lista com filtro `?mes=YYYY-MM` idêntico ao de despesas, POST, PUT e DELETE. Valores seguem validação e serialização monetária das despesas; cada query usa sempre o `usuario_id` do token.
- Receitas não possuem categoria.
- Adicionar formulário e lista de receitas independentes, com data, editar e excluir seguindo o padrão da aplicação.
- Sidebar mostra receitas, despesas e saldo (receitas menos despesas) dentro do período selecionado. Saldo negativo tem destaque visual e textual.

### Categorias

Receitas não usam categorias; os totais por categoria continuam correspondendo apenas às despesas filtradas.

### Critérios de aceite

1. CRUD de receitas persiste, filtra e ordena por data, sem compartilhar dados entre usuários.
2. Valores inválidos e datas inválidas recebem HTTP 400; DECIMAL sai como number e UI mostra duas casas.
3. Usuário B não lista nem consulta por ID, edita ou exclui receita do usuário A.
4. Saldo do período é exatamente receitas menos despesas do mesmo período.
5. Receita não afeta totais de categoria; mudar período atualiza receitas, despesas e saldo.
6. Build/typecheck da API, frontend e smoke test passa.

## 15. Fase 5 — Orçamento por categoria

### Requisitos

- Criar `orcamentos` com chave primária composta `(usuario_id, categoria_id)`, `limite DECIMAL(10,2) NOT NULL CHECK (limite > 0)` e FKs para `usuarios` e `categorias`.
- API autenticada e sempre no escopo do JWT: `GET /api/orcamentos`, `PUT /api/orcamentos/:categoriaId` com `{ limite }` (criar ou atualizar) e `DELETE /api/orcamentos/:categoriaId`.
- `limite` é um número positivo com até duas casas decimais, representado como number na API após conversão do DECIMAL.
- No resumo por categoria, permitir definir, editar e remover limite. Quando um mês específico estiver selecionado, apresentar gasto do mês versus limite, barra de progresso e alerta visual e textual ao exceder.
- Em “Todos os períodos”, não apresentar orçamento nem comparação.

### Categorias

Orçamentos referenciam os IDs da tabela global de categorias. Limites são por usuário/categoria, mensais fixos, sem histórico mensal.

### Critérios de aceite

1. Limites persistem por usuário/categoria; GET nunca retorna limites de outra conta.
2. Limite zero, negativo, não numérico ou maior que duas casas retorna 400.
3. Usuário não pode atualizar/remover orçamento alheio; edição e exclusão são sempre escopadas ao JWT.
4. No mês específico, UI mostra gasto e limite, barra de progresso e mensagem inequívoca quando excedido.
5. Em “Todos os períodos”, controles e comparações de orçamento ficam ocultos.
6. Build/typecheck da API e frontend passa.

## 12. Fase 2 — Categorias como tabela

### Requisitos

- Categorias são globais e fixas, sem CRUD de categoria.
- Criar `categorias(id INT AUTO_INCREMENT PRIMARY KEY, nome VARCHAR(40) NOT NULL UNIQUE)` e semear, nesta ordem: Alimentação, Transporte, Lazer, Saúde, Investimento, Moradia, Contas, Educação, Assinaturas e Outros.
- Migrar despesas para `categoria_id INT NOT NULL` com FK. Mapear `alimento` para Alimentação, `outros` para Outros e valores restantes para as categorias de mesmo nome, incluindo as categorias antes armazenadas em minúsculas. Remover a antiga coluna ENUM depois do preenchimento.
- Categorias são fornecidas pela API; a lista não é hardcoded no frontend nem no servidor.
- `GET /api/categorias` retorna `{ id, nome }[]`.
- Despesa usa `{ id, titulo, valor, data, categoriaId, categoria }`, onde `categoria` é o nome, e POST/PUT recebem `categoriaId` existente.
- O frontend carrega categorias da API para o formulário e para o resumo, incluindo categorias cujo total é zero.

### Critérios de aceite

1. Todas as despesas legadas conservam sua categoria após a migration.
2. `GET /api/categorias` fornece as dez categorias fixas com IDs.
3. Categoria inexistente em POST/PUT retorna HTTP 400.
4. Formulário, edição e resumo usam os dados retornados pela API; o resumo inclui categorias com total zero.
5. Build/typecheck da API e frontend passa, e as migrations são aplicadas pelo runner.

## 13. Fase 3 — Login e isolamento por usuário

### Requisitos

- Criar `usuarios(id CHAR(36), nome VARCHAR(80), email VARCHAR(160) UNIQUE, senha_hash VARCHAR(255), criado_em TIMESTAMP)` e adicionar `despesas.usuario_id` com FK e índice composto `(usuario_id, data)`.
- A migration apaga as despesas existentes, que são dados de teste globais, antes de exigir `usuario_id NOT NULL`. Categorias continuam globais.
- Normalizar email para minúsculas e validar formato; nome obrigatório até 80 caracteres. Senha com no mínimo oito caracteres, não pode ser uma sequência numérica crescente ou decrescente previsível, e é armazenada somente como hash bcryptjs com cost 12. Recomendar, sem exigir, combinar letras, números e caracteres especiais.
- Exigir `JWT_SECRET` no ambiente; falhar na inicialização se ausente. JWT de sete dias em cookie `httpOnly`, `SameSite=Lax`, `Secure` apenas em produção. Não armazenar token no navegador.
- Endpoints de autenticação: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Email duplicado gera 409; falhas de credencial de login usam a mesma mensagem genérica.
- Aplicar rate limit a cadastro/login, Helmet e Content-Type JSON em endpoints mutáveis.
- Todas as rotas de despesas e categorias exigem autenticação. Dono sempre deriva do JWT; todas as operações de leitura/edição/exclusão de despesas filtram por usuário. Recurso de outro usuário responde 404.
- Frontend alterna entre login, cadastro e painel por estado, consulta `/api/auth/me` ao iniciar, mostra nome do usuário e oferece logout. Qualquer resposta 401 retorna ao login, com erros visíveis nos formulários.
- `server/scripts/smoke-test.ts` cria dois usuários e verifica isolamento de leitura individual/edição/exclusão, acesso sem cookie e senha incorreta.

### Categorias

As dez categorias da Fase 2 permanecem globais e fixas na tabela `categorias`; a API e o frontend não mantêm cópias hardcoded.

### Critérios de aceite

1. Usuário registra, entra, consulta sessão e encerra sessão; hash/token nunca é exposto.
2. Email é normalizado, senha curta ou sequência numérica previsível é rejeitada, uma senha numérica não sequencial continua permitida, cadastro duplicado responde 409 e login inválido responde 401 com mensagem genérica.
3. Todas as rotas de despesas/categorias respondem 401 sem sessão.
4. O usuário B recebe 404 ao consultar por ID, editar ou excluir despesa do usuário A; consultas e alterações são filtradas pelo usuário autenticado.
5. Rate limits e Helmet estão ativos; mutações sem `application/json` respondem 400.
6. Smoke test automatiza as verificações de autenticação e isolamento.
7. `JWT_SECRET` está documentado em `.env.example` e ausente do código-fonte.
8. Build/typecheck da API e frontend passa.

## 14. Fase 4 — Filtro por mês

### Requisitos

- `GET /api/despesas?mes=YYYY-MM` filtra pela data com limite inferior inclusivo no primeiro dia do mês e superior exclusivo no primeiro dia do mês seguinte, sem aplicar funções sobre a coluna `data`. Também aceita `dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD` para um intervalo personalizado, com ambas as datas inclusivas. Os parâmetros de mês e intervalo não podem ser combinados. Sem filtro, retorna todas as despesas do usuário autenticado.
- `GET /api/receitas` aceita os mesmos filtros de período das despesas, aplicados também aos totais e listas do painel.
- Formato ou intervalo inválido (incluindo início posterior ao fim) retorna HTTP 400 com erro de validação.
- O painel apresenta opções "Mês", "Intervalo de datas" e "Todos os períodos". O mês inicia no mês atual local e é escolhido em controles explícitos de mês em português e ano numérico, sem depender da localidade do navegador; no modo de intervalo, a pessoa define uma data inicial e final digitadas e exibidas no formato pt-BR `dd/mm/aaaa`.
- Lista, contagem, total geral e totais por categoria refletem o período. Trocar o mês atualiza os dados sem recarregar a página.
- Período sem despesas apresenta mensagem específica.

### Categorias

O resumo mantém todas as categorias da API, inclusive total zero no período filtrado.

### Critérios de aceite

1. Consulta de outubro exclui lançamentos de setembro e vice-versa.
2. Intervalo SQL é `data >= primeiro_dia` e `data < primeiro_dia_seguinte`; usuário continua isolado pelo JWT.
3. Parâmetro inválido responde 400; parâmetro ausente continua retornando todos os períodos.
4. Selecionar mês, intervalo personalizado ou “Todos os períodos” atualiza listas, contagens e todos os totais sem reload de página.
5. A API aceita as duas extremidades inclusivas, rejeita datas inválidas, início posterior ao fim e mistura de parâmetros de mês e intervalo.
6. Estado vazio identifica um mês/intervalo sem despesas, distinguindo-o da lista geral vazia.
7. Build/typecheck da API e frontend passa.

## 17. Aba de gráficos — Entradas e saídas mensais

### Requisitos

- Adicionar navegação por estado com as abas "Painel" e "Gráficos", sem router. Alternar abas não recarrega a página, não descarta o filtro/estado do Painel e não refaz buscas de dados sem necessidade.
- Criar `GET /api/resumo/mensal?ate=YYYY-MM&meses=N`, protegido por `requireAuth`. `ate` é obrigatório e `meses` aceita somente `6` ou `12` (padrão `6`); entradas inválidas retornam 400.
- Retornar um ponto por mês, em ordem crescente, incluindo os meses sem lançamentos: `{ mes: "YYYY-MM", receitas: number, despesas: number, saldo: number }[]`.
- Agregar receitas e despesas em duas consultas SQL separadas com `GROUP BY`, ambas filtradas pelo `usuario_id` do JWT e por intervalo sargable `data >= primeiro mês` e `data < mês seguinte ao final`. Não usar JOIN entre as tabelas de transações; unir as agregações e preencher os meses ausentes no código. Converter DECIMAL em number e arredondar saldo para duas casas.
- Aba "Gráficos" com seletor "Últimos 6 meses"/"Últimos 12 meses"; calcular o mês final no fuso local do navegador e enviá-lo em `ate`.
- Usar Chart.js com imports específicos dos componentes necessários (sem `chart.js/auto`) para mostrar barras agrupadas de receitas e despesas e linha de saldo. Eixo temporal com rótulos pt-BR abreviados (ex.: `out/26`); tooltip e eixo vertical em BRL com duas casas. Legenda textual com nomes das séries e ordem consistente, não dependendo somente de cor.
- Abaixo do gráfico, tabela acessível com os mesmos valores mensais. A interface apresenta carregamento, erro de API explícito e vazio "Sem movimentações neste período", sem canvas de gráfico vazio.
- O gráfico deve ser responsivo. Destruir a instância Chart.js ao ocultar a aba ou trocar o período, sem duplicar canvas ou deixar gráficos antigos.

### Critérios de aceite

1. Agregações mensais conferem com as somas do banco em meses distintos; os totais não sofrem multiplicação por JOIN.
2. O resultado contém exatamente 6 ou 12 meses consecutivos, em ordem, com zeros nos meses sem movimento.
3. Usuário B não acessa dados do usuário A; ausência de cookie retorna 401; `meses=7`, `ate` ausente ou `ate=2026-13` retorna 400.
4. Alternar abas e períodos repetidamente mantém o estado do Painel e não acumula gráficos/instâncias.
5. Gráfico e tabela apresentam os mesmos valores e são utilizáveis em tela estreita; carregamento, erro e vazio são comunicados claramente.
6. Build/typecheck do frontend e API passa, e os critérios existentes deste PRD continuam válidos.
## 18. Redefinição local de senha

### Requisitos

- Disponibilizar na tela de login uma opção "Esqueci minha senha".
- A pessoa usuária informa o email cadastrado e solicita um código temporário.
- Como o ambiente não possui serviço de email, o código é exibido uma única vez na própria interface para uso local.
- O código deve ser numérico, de uso único, armazenado somente como hash no banco e expirar após 15 minutos.
- A pessoa usuária informa email, código e nova senha para concluir a redefinição.
- A nova senha deve seguir as mesmas regras do cadastro: mínimo de 8 caracteres e rejeição de sequências numéricas previsíveis; letras, números e símbolos são recomendados, mas não obrigatórios.
- O endpoint de solicitação não deve revelar se um email existe. Quando o email existir, a resposta local poderá incluir o código temporário para permitir o uso sem serviço de email.
- Após redefinir a senha, os códigos pendentes daquele usuário devem ser invalidados e nenhuma senha ou hash deve ser retornado.
- Solicitação e conclusão devem ter limitação de tentativas e erros sem detalhes internos.

### Critérios de aceite

1. Um email cadastrado recebe um código temporário exibido na interface; email não cadastrado recebe mensagem genérica.
2. Código incorreto, expirado ou já usado retorna erro de validação e não altera a senha.
3. Código válido permite entrar com a nova senha e não pode ser reutilizado.
4. A senha antiga deixa de funcionar após a redefinição.
5. A nova senha rejeita mínimo de 8 caracteres e sequências numéricas previsíveis.
6. O código não é persistido em texto puro e a API nunca retorna senha ou hash.

## 19. Hardening de segurança e preparação para publicação

O projeto deve aplicar as nove fases de segurança e publicação especificadas na solicitação de auditoria:

1. XSS, CSP e headers de segurança, sem renderização dinâmica por `innerHTML`, com CSP também no Vite.
2. Banco MySQL com porta publicada somente em loopback, imagem fixa, usuários separados para aplicação e migrations, pool sem DDL e segredos validados.
3. Autenticação com bcrypt de 8 a 72 bytes, comparação contra hash falso, JWT HS256 de 2 horas, token version, cookie seguro e rate limits por IP/email.
4. Autorização por usuário em todas as queries e proteção CSRF por Origin/Sec-Fetch-Site.
5. Schemas zod por endpoint, corpos limitados e validação estrita de datas, valores, ids e campos.
6. Rate limit geral, mês obrigatório nas listagens, teto de 1000 itens e timeouts.
7. Erros genéricos com correlação, logs JSON sem segredos e auditoria de dependências.
8. Testes automatizados de segurança e SECURITY.md.
9. Preparação de publicação com Docker multi-stage, compose de produção, Caddy, backups, restauração e controles LGPD.

Cada fase exige atualização prévia deste PRD, build/typecheck e testes específicos antes do avanço.

### Fase 2 — decisão de implementação

O pool da API usará exclusivamente `DB_APP_USER`/`DB_APP_PASSWORD`; o runner de migrations usará exclusivamente `DB_MIGRATOR_USER`/`DB_MIGRATOR_PASSWORD` e será executado pelo script `npm run migrate`, antes do desenvolvimento, nunca durante a inicialização do servidor.

### Fase 3 — decisão de implementação

Sessões terão validade de duas horas, algoritmo HS256 fixado, `token_version` consultado em cada requisição e cookie `__Host-session` apenas em produção. Login e cadastro usarão limites independentes e comparação contra hash falso para evitar enumeração temporal.

### Fase 4 — decisão de implementação

Todas as mutações validarão `Origin` contra `ALLOWED_ORIGINS` e bloquearão `Sec-Fetch-Site: cross-site`. O escopo de cada recurso continuará vindo exclusivamente do JWT e respostas de recursos alheios permanecerão 404.

### Fase 5 — decisão de implementação

Schemas zod serão aplicados na entrada dos endpoints de autenticação, despesas, receitas, orçamentos e filtros; objetos desconhecidos serão descartados antes de qualquer montagem de query.

### Fase 6 — decisão de implementação

As listagens de despesas e receitas exigirão `mes=YYYY-MM`; os modos de intervalo e todos os períodos serão removidos da interface para manter totais limitados e auditáveis.

### Fase 7 — decisão de implementação

Erros inesperados receberão um identificador de correlação curto e serão registrados em JSON, sem stack, SQL, credenciais, cookies ou bodies de autenticação na resposta ou no log.

### Fase 8 — decisão de implementação

`npm run test:security` executará verificações sem cookie, validação, CSRF, limites, headers e isolamento contra a API em execução; riscos residuais serão documentados em `SECURITY.md`.

### Fase 9 — decisão de implementação

O ambiente de publicação usará API sem root, MySQL apenas na rede interna e Caddy como proxy TLS. A exclusão da conta exigirá a senha, apagará os dados por FK cascade e a exportação retornará JSON sem hashes ou tokens.

## 20. Verificação de e-mail e envio transacional

O cadastro e a recuperação de senha devem usar e-mail real, com transporte SMTP obrigatório em produção, validação de domínio e posse por código de uso único. O desenvolvimento/teste poderá usar transportes `console` e `file`, sem imprimir códigos em respostas HTTP. As fases, critérios e controles estão definidos no roteiro de verificação de e-mail anexado à tarefa.

### Fase 1 — transporte de e-mail

Criar módulo único com transportes SMTP, console e file. Produção aceita somente SMTP configurado com TLS, limites de timeout e teto diário. O envio será assíncrono e os logs nunca conterão código, corpo ou email em claro.

### Fase 2 — códigos e validação de domínio (recuperação de senha)

O cadastro não exige confirmação de email e libera o acesso imediatamente. Temporariamente, a recuperação de senha permite informar email e nova senha diretamente, sem código ou envio de email.

## 21. Lançamentos — filtro, estados e acessibilidade

A seção de lançamentos terá filtro por mês, atalhos de período e intervalo personalizado em datas locais brasileiras. O período padrão será o mês atual, a lista será ordenada do lançamento mais recente ao mais antigo e o cabeçalho exibirá o período e o total filtrado. Mudanças de período preservarão a rolagem, cancelarão requisições obsoletas e manterão estados de carregamento, erro e vazio acionáveis. O contrato de intervalo usa `dataInicio` e `dataFim` inclusivos, com limite de 366 dias; a API converte internamente o fim para intervalo semiaberto sem aplicar função na coluna `data`.

## 22. Calendário local pt-BR

Todos os campos de data usam um componente próprio, reutilizável e acessível, sem dependência externa ou calendário nativo do navegador. A entrada visível usa `dd/mm/aaaa`, a interpretação é estrita entre 2000 e 2100 e o valor persistido continua no formato ISO `YYYY-MM-DD`. A grade começa no domingo, oferece navegação por teclado, limites de intervalo e textos em português independentemente do idioma do navegador.
