# OPUS — Guia de Setup e Deploy

## Pré-requisitos

- Node.js 20+
- Rust + Cargo (para Tauri)
- Conta Supabase (gratuita serve para começar)
- Google Workspace pago (já existe)
- Chave de API Anthropic (Claude)
- Chave de API OpenAI (embeddings para busca no Wiki)

---

## 1. Supabase — Configuração inicial

### 1.1 Criar projeto
1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Salve a URL e a `anon key` — serão usadas no `.env`

### 1.2 Rodar migrations
```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_ID
npx supabase db push
```
Ou execute o arquivo `supabase/migrations/001_initial_schema.sql` diretamente no SQL Editor do Supabase.

### 1.3 Criar Storage buckets
No Supabase Dashboard → Storage → Create Bucket:
- `contracts` (privado)
- `surveys` (privado)
- `avatars` (público)

### 1.4 Deploy das Edge Functions
```bash
npx supabase functions deploy ai-chat
npx supabase functions deploy wiki-search
npx supabase functions deploy parse-contract
npx supabase functions deploy upload-survey
npx supabase functions deploy google-user-sync
npx supabase functions deploy google-user-sync-renew
```

### 1.5 Configurar variáveis das Edge Functions
```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-XXXX
npx supabase secrets set OPENAI_API_KEY=sk-XXXX
npx supabase secrets set GOOGLE_SYNC_SECRET=opus-sync-token-aleatorio-seguro
```

---

## 2. Google Workspace — OAuth

### 2.1 Google Cloud Console
1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um novo projeto: "OPUS"
3. Ative as APIs:
   - Google OAuth 2.0
   - Google Calendar API
   - Google Drive API
   - Admin SDK API
4. Crie credenciais OAuth 2.0:
   - Tipo: Web application
   - Authorized redirect URIs: `https://SEU_PROJETO.supabase.co/auth/v1/callback`
5. Salve o Client ID e Client Secret

### 2.2 Configurar no Supabase
Dashboard → Authentication → Providers → Google:
```
Client ID:     seu-google-client-id
Client Secret: seu-google-client-secret
```

Escopos adicionais (Additional Scopes):
```
https://www.googleapis.com/auth/calendar.readonly
https://www.googleapis.com/auth/drive.readonly
```

---

## 3. Variáveis de ambiente do app

Copie `.env.example` para `.env` e preencha:
```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_GOOGLE_CLIENT_ID=XXXX.apps.googleusercontent.com
VITE_ANTHROPIC_API_KEY=sk-ant-XXXX
```

---

## 4. Instalar dependências e rodar

```bash
npm install

# Desenvolvimento web (browser)
npm run dev

# Desenvolvimento desktop (Tauri)
npm run tauri:dev

# Build desktop
npm run tauri:build
```

---

## 5. Configurar Google Workspace Sync (desativação automática)

Siga as instruções em `supabase/migrations/002_google_sync_setup.md`

---

## 6. Estrutura de arquivos criados

```
opus/
├── src/
│   ├── components/
│   │   ├── ai/           # ChatMessage, LearningTracks
│   │   ├── cs/           # ClientList, ClientDetailPanel, CSStatsBar
│   │   ├── feed/         # PostCard, CreatePostModal
│   │   ├── gamification/ # Leaderboard, TitlesPanel
│   │   ├── office/       # OfficeCanvas, UserPopover, StatusSelector
│   │   ├── shared/       # AppLayout, KnockNotificationBanner
│   │   └── wiki/         # WikiEditor, AISearchBar, ClientsPanel
│   ├── hooks/
│   │   ├── useAI.ts
│   │   ├── useAuth.ts
│   │   ├── useCustomerSuccess.ts
│   │   ├── useFeed.ts
│   │   ├── useGamification.ts
│   │   ├── usePresence.ts
│   │   └── useWiki.ts
│   ├── lib/
│   │   ├── constants.ts  # APP_NAME, AI_NAME, ATLAS_SYSTEM_PROMPT
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── AIPage.tsx
│   │   ├── CustomerSuccessPage.tsx
│   │   ├── FeedPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── MeetingsPage.tsx
│   │   ├── OfficePage.tsx
│   │   ├── WikiPage.tsx
│   │   └── WorkspacePage.tsx
│   ├── store/
│   │   ├── appStore.ts
│   │   ├── authStore.ts
│   │   └── officeStore.ts
│   ├── styles/globals.css
│   ├── types/index.ts
│   ├── App.tsx
│   └── main.tsx
├── supabase/
│   ├── functions/
│   │   ├── ai-chat/          # Atlas streaming chat
│   │   ├── wiki-search/      # RAG semantic search
│   │   ├── parse-contract/   # PDF → produtos (Claude vision)
│   │   ├── upload-survey/    # CSV/PDF → NPS/CSAT score
│   │   ├── google-user-sync/ # Google Workspace webhook
│   │   └── google-user-sync-renew/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_google_sync_setup.md
├── .env.example
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## 7. Módulos do OPUS

| Módulo | Descrição |
|--------|-----------|
| 🏢 Escritório Virtual | Mapa 2D com avatares, presença em tempo real (PixiJS + Supabase Realtime) |
| 📣 Feed Gamificado | Posts de conquistas com XP, reações, leaderboard, títulos |
| 🤖 Atlas (IA) | Chat com Claude, sandbox de código, trilhas de aprendizado |
| 📚 Wiki + Clientes | Base de conhecimento Markdown + base de clientes operacionais |
| 💼 Customer Success | LTV, NPS, contratos (PDF → Atlas extrai produtos), pesquisas, timeline |
| 🎥 Reuniões | Google Meet embutido, salas permanentes e temporárias |
| 🔧 Google Workspace | Google Chat, Gmail, Drive, Calendar, Meet — tudo via iframe SSO |

---

## 8. Próximos passos sugeridos (Fase 2)

- [ ] Avatar builder — personalizar personagem com o rosto da pessoa
- [ ] Integração CRM (HubSpot/Pipedrive) → post automático de venda fechada
- [ ] Automação de churn risk score (Atlas analisa histórico do cliente)
- [ ] Dashboard de liderança — visão agregada de produtividade
- [ ] Notificações push nativas (Tauri plugin-notification)
- [ ] Mobile companion app (React Native)
