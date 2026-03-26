# Configuração: Google Workspace User Sync (OPUS)

## O que acontece quando um colaborador é desativado

Quando uma conta do Google Workspace é **excluída ou suspensa**, o OPUS:
1. Remove o usuário da listagem de usuários ativos
2. Seta o status de presença para `offline`
3. Bloqueia novo login (OAuth retornará erro)
4. Registra o evento em `google_sync_log`

---

## Setup no Google Cloud Console

### 1. Ativar as APIs necessárias

No [Google Cloud Console](https://console.cloud.google.com):
- Ativar **Admin SDK API**
- Ativar **Google Workspace Events API**

### 2. Criar Service Account

```
IAM & Admin → Service Accounts → Create Service Account
Nome: opus-workspace-sync
Role: (deixar vazio, permissões são via Admin SDK)
```

Baixar o JSON da chave e salvar como `GOOGLE_SERVICE_ACCOUNT_JSON` no Supabase.

### 3. Delegar acesso ao domínio (Domain-wide Delegation)

No [Google Admin Console](https://admin.google.com):
```
Security → API Controls → Domain-wide Delegation → Add new
Client ID: (ID da service account)
Scopes: https://www.googleapis.com/auth/admin.reports.audit.readonly
         https://www.googleapis.com/auth/admin.directory.user.readonly
```

### 4. Configurar Push Notifications no Admin SDK

O Google Workspace envia notificações push via webhooks quando eventos ocorrem.
Execute este script uma vez para registrar o canal:

```javascript
// scripts/setup-google-sync.mjs
import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  keyFile: 'service-account.json',
  scopes: ['https://www.googleapis.com/auth/admin.reports.audit.readonly'],
});

const admin = google.admin({ version: 'reports_v1', auth });

// Register webhook channel
await admin.activities.watch({
  userKey: 'all',
  applicationName: 'admin',
  requestBody: {
    id: 'opus-user-sync-channel',
    type: 'web_hook',
    address: 'https://YOUR_SUPABASE_URL/functions/v1/google-user-sync',
    token: 'YOUR_GOOGLE_SYNC_SECRET', // mesmo valor no Supabase env
    expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
  },
});
```

### 5. Variáveis de ambiente no Supabase

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set GOOGLE_SYNC_SECRET=opus-sync-secret-token-aleatorio
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
```

### 6. Renovação automática do canal

Os canais do Google expiram a cada 7 dias. Configure um cron job via Supabase para renovar:

```sql
-- Em supabase/migrations/003_cron.sql
SELECT cron.schedule(
  'renew-google-sync-channel',
  '0 0 */6 * *',  -- a cada 6 dias
  $$
    SELECT net.http_post(
      url := 'https://YOUR_SUPABASE_URL/functions/v1/google-user-sync-renew',
      body := '{}'::jsonb
    );
  $$
);
```

---

## Fluxo completo de desativação

```
Gestor exclui conta no Google Workspace Admin
    ↓
Google envia POST para /functions/v1/google-user-sync
    ↓
Edge Function verifica token de segurança
    ↓
Chama supabase.rpc('deactivate_user_by_email', { p_email })
    ↓
users.is_active = false, deactivated_at = NOW()
    ↓
user_presence.status = 'offline'
    ↓
Na próxima tentativa de login, Google OAuth falha (conta inexistente)
    ↓
OPUS redireciona para tela de login com mensagem de acesso revogado
```
