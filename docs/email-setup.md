# Configuração de e-mail

Em produção, configure um domínio próprio e um provedor SMTP transacional. `EMAIL_FROM` deve usar o mesmo domínio autenticado pelo provedor.

Variáveis necessárias:

```env
EMAIL_TRANSPORT=smtp
SMTP_HOST=smtp.seu-provedor.example
SMTP_PORT=587
SMTP_USER=usuario-smtp
SMTP_PASS=senha-smtp
EMAIL_FROM=conta@seu-dominio.example
EMAIL_DAILY_CAP=200
```

Na porta 465 é usado TLS direto. Na porta 587 é exigido STARTTLS. A verificação de certificado nunca é desativada.

Configure SPF, DKIM e DMARC no DNS do domínio. Comece com DMARC `p=none`, observe os relatórios e evolua para `quarantine` e depois `reject` quando a entrega legítima estiver confirmada.

Para testar a entregabilidade, use `EMAIL_TRANSPORT=console` em desenvolvimento ou `EMAIL_TRANSPORT=file` em testes. Em produção esses transportes são recusados. Teste entrega, spam, SPF, DKIM e DMARC em uma conta controlada antes de publicar.

Risco residual: bounces e denúncias não possuem processamento automático; monitore o provedor e mantenha o domínio e as credenciais protegidos.
