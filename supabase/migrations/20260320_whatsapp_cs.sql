-- ─── WhatsApp CS Intelligence ────────────────────────────────────────────────
-- Tabelas para análise de atendimento via grupos de WhatsApp

-- Grupos de WhatsApp vinculados a clientes
CREATE TABLE IF NOT EXISTS public.wa_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_jid    TEXT UNIQUE NOT NULL,          -- ex: "120363295648424210@g.us"
  group_name   TEXT NOT NULL,
  client_id    UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  is_active    BOOLEAN DEFAULT true,
  linked_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  linked_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Mapeamento: número de telefone → usuário da plataforma (para identificar team members)
CREATE TABLE IF NOT EXISTS public.wa_team_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,                 -- ex: "5511999990000"
  jid          TEXT GENERATED ALWAYS AS (phone_number || '@s.whatsapp.net') STORED,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(phone_number)
);

-- Mensagens sincronizadas dos grupos
CREATE TABLE IF NOT EXISTS public.wa_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id  TEXT UNIQUE NOT NULL,        -- ID nativo da mensagem no WhatsApp
  group_jid      TEXT NOT NULL,
  sender_jid     TEXT NOT NULL,
  sender_name    TEXT,
  user_id        UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_from_team   BOOLEAN DEFAULT false,
  message_text   TEXT,
  message_type   TEXT DEFAULT 'text'
    CHECK (message_type IN ('text','image','audio','video','document','sticker','reaction','other')),
  sent_at        TIMESTAMPTZ NOT NULL,
  synced_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Log de sincronizações
CREATE TABLE IF NOT EXISTS public.wa_sync_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at         TIMESTAMPTZ DEFAULT NOW(),
  groups_processed  INT DEFAULT 0,
  messages_added    INT DEFAULT 0,
  error_message     TEXT
);

-- Índices para queries de análise
CREATE INDEX IF NOT EXISTS idx_wa_messages_group_jid   ON public.wa_messages(group_jid);
CREATE INDEX IF NOT EXISTS idx_wa_messages_sent_at     ON public.wa_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_user_id     ON public.wa_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_is_team     ON public.wa_messages(is_from_team);
CREATE INDEX IF NOT EXISTS idx_wa_groups_client        ON public.wa_groups(client_id);

-- RLS
ALTER TABLE public.wa_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_team_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wa_sync_log      ENABLE ROW LEVEL SECURITY;

-- Políticas: usuários autenticados leem tudo (controle granular feito no frontend por role)
CREATE POLICY "wa_groups_read"       ON public.wa_groups        FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_groups_write"      ON public.wa_groups        FOR ALL    TO authenticated USING (true);
CREATE POLICY "wa_team_members_read" ON public.wa_team_members  FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_team_members_all"  ON public.wa_team_members  FOR ALL    TO authenticated USING (true);
CREATE POLICY "wa_messages_read"     ON public.wa_messages      FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_messages_insert"   ON public.wa_messages      FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "wa_sync_log_read"     ON public.wa_sync_log      FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_sync_log_insert"   ON public.wa_sync_log      FOR INSERT TO authenticated WITH CHECK (true);
