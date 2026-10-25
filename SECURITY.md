# Segurança

Este é um projeto de estudo e não deve ser usado em produção.

## Controles implementados

- TypeScript vanilla no frontend, CSP e headers de segurança do Helmet.
- Sessões em cookie `httpOnly`, expiração, invalidação e limitação de tentativas.
- Senhas armazenadas com bcrypt e segredo JWT obrigatório, com validação de tamanho e placeholder.
- Consultas de despesas, receitas e orçamentos isoladas pelo usuário autenticado.
- Validação de entrada com Zod, limite de corpo JSON, rate limit e proteção contra mutações de origens não permitidas.
- Consultas SQL parametrizadas e logs sem valores sensíveis.
- Calendário próprio, empacotado pelo Vite, sem CDN ou HTML dinâmico com dados do usuário.
- Dependências atualizadas para Vite `8.3.3` e `body-parser` `2.4.0`.

## Autenticação e e-mail

- O cadastro entra diretamente no painel. Não existe confirmação de e-mail por código.
- A recuperação de senha usa `POST /api/auth/password-reset/confirm` com e-mail e nova senha. Não envia código nem e-mail neste momento.
- O módulo de transporte de e-mail permanece como infraestrutura opcional para desenvolvimento e futuras integrações; SMTP é exigido apenas quando `NODE_ENV=production` e `EMAIL_TRANSPORT=smtp`.

## Limitações conhecidas

- O projeto não oferece CAPTCHA, MFA ou processamento automático de bounces.
- Rate limits são mantidos em memória e não são compartilhados entre processos.
- A configuração de banco do Compose é adequada somente para desenvolvimento local; os privilégios não foram redesenhados nesta etapa.
- A redefinição direta de senha não é adequada para um ambiente público sem um fluxo adicional de verificação de identidade.

## Verificações

```sh
npm run test:security
npm run test:dates
npm run test:shell-line-endings
npm audit --audit-level=high
```
