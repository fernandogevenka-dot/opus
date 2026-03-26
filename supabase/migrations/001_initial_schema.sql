-- ============================================================
-- OPUS — Schema Completo v1.0
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- fuzzy search

-- ─── USERS ───────────────────────────────────────────────────

CREATE TABLE public.users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_id     TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  avatar_url    TEXT,
  team          TEXT,
  role          TEXT,
  title_active_id TEXT,
  xp            INTEGER NOT NULL DEFAULT 0,
  level         INTEGER NOT NULL DEFAULT 1,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email     ON public.users(email);
CREATE INDEX idx_users_is_active ON public.users(is_active);

-- ─── ROOMS ───────────────────────────────────────────────────

CREATE TABLE public.rooms (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  type     TEXT NOT NULL CHECK (type IN ('sales','meeting','lounge','direction','one_on_one','general')),
  icon     TEXT NOT NULL DEFAULT '🏢',
  x        INTEGER NOT NULL DEFAULT 0,
  y        INTEGER NOT NULL DEFAULT 0,
  width    INTEGER NOT NULL DEFAULT 200,
  height   INTEGER NOT NULL DEFAULT 160,
  capacity INTEGER NOT NULL DEFAULT 20,
  color    TEXT NOT NULL DEFAULT '#3b82f6'
);

-- Seed default rooms
INSERT INTO public.rooms VALUES
  ('sales',     'Sala de Vendas',    'sales',      '🏆', 60,  80,  220, 160, 20, '#3b82f6'),
  ('meetings',  'Sala de Reuniões',  'meeting',    '📋', 320, 80,  200, 160, 15, '#8b5cf6'),
  ('direction', 'Diretoria',         'direction',  '👔', 560, 80,  180, 160, 8,  '#f59e0b'),
  ('lounge',    'Lounge',            'lounge',     '☕', 60,  290, 180, 140, 30, '#10b981'),
  ('oneonone',  '1:1',               'one_on_one', '💬', 280, 290, 140, 140, 2,  '#ec4899'),
  ('training',  'Atlas Lab',         'general',    '🤖', 460, 290, 180, 140, 15, '#6366f1');

-- ─── PRESENCE ────────────────────────────────────────────────

CREATE TABLE public.user_presence (
  user_id   UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  room_id   TEXT REFERENCES public.rooms(id) ON DELETE SET NULL,
  x         FLOAT NOT NULL DEFAULT 400,
  y         FLOAT NOT NULL DEFAULT 300,
  status    TEXT NOT NULL DEFAULT 'available'
              CHECK (status IN ('available','busy','in_meeting','away','offline')),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_presence_status ON public.user_presence(status);

-- ─── TITLES & GAMIFICATION ───────────────────────────────────

CREATE TABLE public.titles (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('sales','quality','innovation','knowledge')),
  icon         TEXT NOT NULL DEFAULT '🏅',
  criteria     TEXT NOT NULL,
  xp_required  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE public.user_titles (
  user_id   UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title_id  TEXT REFERENCES public.titles(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, title_id)
);

CREATE TABLE public.xp_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  xp           INTEGER NOT NULL,
  reference_id TEXT,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_xp_events_user_date ON public.xp_events(user_id, created_at DESC);

-- Function to increment user XP and auto-level
CREATE OR REPLACE FUNCTION increment_user_xp(p_user_id UUID, p_xp INTEGER)
RETURNS VOID AS $$
DECLARE
  new_xp INTEGER;
  new_level INTEGER;
BEGIN
  UPDATE public.users SET xp = xp + p_xp WHERE id = p_user_id
  RETURNING xp INTO new_xp;

  new_level := CASE
    WHEN new_xp >= 6000 THEN 5
    WHEN new_xp >= 3000 THEN 4
    WHEN new_xp >= 1500 THEN 3
    WHEN new_xp >= 500  THEN 2
    ELSE 1
  END;

  UPDATE public.users SET level = new_level WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Seed titles
INSERT INTO public.titles VALUES
  -- Sales
  ('prospector',      'Prospector',             'sales',      '🎯', '5 vendas fechadas', 0),
  ('closer',          'Fechador',               'sales',      '🤝', '20 vendas fechadas', 0),
  ('sales_champion',  'Campeão de Vendas',       'sales',      '🏆', 'Top 3 no ranking mensal', 0),
  ('sales_legend',    'Lenda das Vendas',        'sales',      '👑', 'Top 1 por 3 meses seguidos', 0),
  -- Quality
  ('client_care',     'Cuidador do Cliente',     'quality',    '💚', '5 feedbacks positivos', 0),
  ('excellence_ref',  'Referência de Excelência','quality',    '⭐', 'NPS acima de 9 por 3 meses', 0),
  ('ambassador',      'Embaixador',              'quality',    '🌟', '20 feedbacks 5 estrelas', 0),
  -- Innovation
  ('curious_digital', 'Curioso Digital',         'innovation', '🔍', 'Completou 1 trilha de aprendizado', 0),
  ('solver',          'Solucionador',            'innovation', '🛠️', '3 soluções com IA compartilhadas', 0),
  ('builder',         'Construtor',              'innovation', '⚙️', '1 automação implementada', 0),
  ('innovator',       'Inovador',                'innovation', '💡', '5 inovações documentadas', 0),
  ('senior_innovator','Inovador Sênior',          'innovation', '🚀', '10 inovações + mentorou alguém', 0),
  ('solutions_arch',  'Arquiteto de Soluções',   'innovation', '🏗️', 'Referência técnica reconhecida', 0),
  -- Knowledge
  ('documenter',      'Documentador',            'knowledge',  '📝', '5 páginas criadas no Wiki', 0),
  ('knowledge_guard', 'Guardião do Conhecimento','knowledge',  '🛡️', 'Página com 50+ visualizações', 0),
  ('knowledge_master','Mestre da Base',          'knowledge',  '📚', '20 documentos contribuídos', 0);

-- ─── FEED & POSTS ────────────────────────────────────────────

CREATE TABLE public.posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('sale','feedback','delivery','innovation','ai_solution','announcement','celebration')),
  title         TEXT NOT NULL,
  content       TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  xp_generated  INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_posts_created    ON public.posts(created_at DESC);
CREATE INDEX idx_posts_user       ON public.posts(user_id);
CREATE INDEX idx_posts_type       ON public.posts(type);

CREATE TABLE public.reactions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL CHECK (emoji IN ('🔥','❤️','👏','🎯','💡')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id, emoji)
);

-- ─── KNOCK NOTIFICATIONS ─────────────────────────────────────

CREATE TABLE public.knock_notifications (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message        TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knocks_target ON public.knock_notifications(target_user_id, created_at DESC);

-- ─── AI CONVERSATIONS ────────────────────────────────────────

CREATE TABLE public.ai_conversations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user ON public.ai_conversations(user_id, updated_at DESC);

-- ─── WIKI ────────────────────────────────────────────────────

CREATE TABLE public.wiki_pages (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  content    TEXT,
  parent_id  UUID REFERENCES public.wiki_pages(id) ON DELETE CASCADE,
  team_id    UUID,
  author_id  UUID NOT NULL REFERENCES public.users(id),
  icon       TEXT NOT NULL DEFAULT '📄',
  is_case_study BOOLEAN NOT NULL DEFAULT FALSE,  -- cases de sucesso
  views      INTEGER NOT NULL DEFAULT 0,
  tags       TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wiki_pages_parent    ON public.wiki_pages(parent_id);
CREATE INDEX idx_wiki_pages_case      ON public.wiki_pages(is_case_study) WHERE is_case_study = TRUE;
CREATE INDEX idx_wiki_pages_tags      ON public.wiki_pages USING GIN(tags);
CREATE INDEX idx_wiki_title_search    ON public.wiki_pages USING GIN(to_tsvector('portuguese', title));

-- Vector embeddings for AI search
CREATE TABLE public.wiki_embeddings (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_id   UUID NOT NULL REFERENCES public.wiki_pages(id) ON DELETE CASCADE,
  chunk     TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wiki_embeddings_page    ON public.wiki_embeddings(page_id);
CREATE INDEX idx_wiki_embeddings_vector  ON public.wiki_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Function: similarity search
CREATE OR REPLACE FUNCTION search_wiki(
  query_embedding VECTOR(1536),
  match_count     INTEGER DEFAULT 5,
  threshold       FLOAT   DEFAULT 0.7
)
RETURNS TABLE (
  page_id   UUID,
  chunk     TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.page_id,
    we.chunk,
    1 - (we.embedding <=> query_embedding) AS similarity
  FROM public.wiki_embeddings we
  WHERE 1 - (we.embedding <=> query_embedding) > threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ─── CLIENTS & CUSTOMER SUCCESS HUB ─────────────────────────

CREATE TABLE public.clients (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','at_risk','upsell','churned','prospect')),
  -- Contact
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  -- Segmentation
  region          TEXT,        -- ex: 'Sul', 'Nordeste', 'SP Capital', etc.
  segment         TEXT,        -- área de atuação: ex: 'Saúde', 'Varejo', 'Indústria'
  company_size    TEXT,        -- 'micro','small','medium','large','enterprise'
  -- Financials & LTV
  mrr             NUMERIC(12,2) DEFAULT 0,   -- receita mensal recorrente
  arr             NUMERIC(12,2) DEFAULT 0,   -- receita anual recorrente
  ltv             NUMERIC(12,2) DEFAULT 0,   -- lifetime value calculado
  churn_risk_score INTEGER DEFAULT 0,        -- 0-100 (IA pode calcular)
  -- Satisfaction
  nps             INTEGER CHECK (nps IS NULL OR (nps >= 0 AND nps <= 10)),
  csat            NUMERIC(3,1) CHECK (csat IS NULL OR (csat >= 0 AND csat <= 5)),
  -- Relations
  account_manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  cs_team_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
  team_id            UUID,
  -- Metadata
  notes           TEXT,
  tags            TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_status   ON public.clients(status);
CREATE INDEX idx_clients_region   ON public.clients(region);
CREATE INDEX idx_clients_segment  ON public.clients(segment);
CREATE INDEX idx_clients_tags     ON public.clients USING GIN(tags);
CREATE INDEX idx_clients_name_search ON public.clients USING GIN(to_tsvector('portuguese', name));

-- ─── CONTRACTED PRODUCTS (lidos do contrato via IA) ─────────

CREATE TABLE public.contracted_products (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product     TEXT NOT NULL,           -- nome do produto/serviço
  description TEXT,
  value       NUMERIC(12,2),           -- valor mensal do produto
  start_date  DATE,
  end_date    DATE,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','cancelled','suspended','renewal_due')),
  source      TEXT DEFAULT 'manual'
                CHECK (source IN ('manual','contract_ai','crm_sync')),
  contract_id UUID,                    -- referência ao contrato de origem
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracted_client ON public.contracted_products(client_id);

-- ─── CONTRACTS (upload PDF) ──────────────────────────────────

CREATE TABLE public.contracts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id       UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  file_path       TEXT NOT NULL,       -- Supabase Storage path
  file_name       TEXT NOT NULL,
  signed_date     DATE,
  expiry_date     DATE,
  total_value     NUMERIC(12,2),
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','expired','cancelled','pending')),
  extracted_text  TEXT,                -- full text after OCR/parse
  products_parsed BOOLEAN DEFAULT FALSE,
  parsed_at       TIMESTAMPTZ,
  uploaded_by     UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contracts_client ON public.contracts(client_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);

-- ─── SATISFACTION SURVEYS ────────────────────────────────────

CREATE TABLE public.surveys (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id   UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'nps'
                CHECK (type IN ('nps','csat','ces','custom')),
  period      TEXT,                    -- ex: 'Q1 2026', 'Jan 2026'
  score       NUMERIC(4,1),            -- NPS: -100 a 100; CSAT: 1-5
  respondent  TEXT,                    -- nome do respondente
  answers     JSONB NOT NULL DEFAULT '{}',
  file_path   TEXT,                    -- upload original (CSV/PDF)
  applied_by  UUID REFERENCES public.users(id),
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_surveys_client  ON public.surveys(client_id);
CREATE INDEX idx_surveys_type    ON public.surveys(type);
CREATE INDEX idx_surveys_applied ON public.surveys(applied_at DESC);

-- ─── CLIENT INTERACTIONS (timeline) ─────────────────────────

CREATE TABLE public.client_interactions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id  UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
               CHECK (type IN ('meeting','email','call','delivery','feedback','note','upsell','contract','survey','onboarding')),
  title      TEXT NOT NULL,
  notes      TEXT,
  value      NUMERIC(12,2),           -- para upsell/nova venda
  product    TEXT,                    -- produto envolvido
  author_id  UUID NOT NULL REFERENCES public.users(id),
  happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interactions_client ON public.client_interactions(client_id, happened_at DESC);
CREATE INDEX idx_interactions_type   ON public.client_interactions(type);

-- ─── CS TEAM (relaciona clientes a colaboradores) ────────────

CREATE TABLE public.client_team_members (
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('account_manager','cs','support','sales')),
  PRIMARY KEY (client_id, user_id)
);

-- ─── LTV CALCULATION FUNCTION ────────────────────────────────

CREATE OR REPLACE FUNCTION recalculate_client_ltv(p_client_id UUID)
RETURNS VOID AS $$
DECLARE
  total_revenue  NUMERIC;
  months_active  INTEGER;
  avg_mrr        NUMERIC;
BEGIN
  -- Sum all interaction values (sales, upsells)
  SELECT COALESCE(SUM(value), 0) INTO total_revenue
  FROM public.client_interactions
  WHERE client_id = p_client_id AND value IS NOT NULL;

  -- Months since first interaction
  SELECT GREATEST(1, EXTRACT(MONTH FROM AGE(NOW(), MIN(happened_at))))::INTEGER
  INTO months_active
  FROM public.client_interactions
  WHERE client_id = p_client_id;

  avg_mrr := total_revenue / months_active;

  UPDATE public.clients
  SET
    ltv = total_revenue,
    arr = avg_mrr * 12,
    mrr = avg_mrr,
    updated_at = NOW()
  WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-recalc LTV on new interaction with value
CREATE OR REPLACE FUNCTION trigger_recalc_ltv()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.value IS NOT NULL THEN
    PERFORM recalculate_client_ltv(NEW.client_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_interaction_insert
AFTER INSERT ON public.client_interactions
FOR EACH ROW EXECUTE FUNCTION trigger_recalc_ltv();

-- ─── GOOGLE WORKSPACE USER SYNC ──────────────────────────────

CREATE TABLE public.google_sync_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type    TEXT NOT NULL,          -- 'user_deleted', 'user_suspended', 'user_created'
  google_email  TEXT NOT NULL,
  user_id       UUID REFERENCES public.users(id),
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details       JSONB DEFAULT '{}'
);

-- Function: deactivate user when Google account is deleted
CREATE OR REPLACE FUNCTION deactivate_user_by_email(p_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.users
  SET
    is_active      = FALSE,
    deactivated_at = NOW(),
    updated_at     = NOW()
  WHERE email = p_email AND is_active = TRUE;

  -- Set presence to offline
  UPDATE public.user_presence
  SET status = 'offline', last_seen = NOW()
  WHERE user_id = (SELECT id FROM public.users WHERE email = p_email);
END;
$$ LANGUAGE plpgsql;

-- ─── ROW-LEVEL SECURITY ──────────────────────────────────────

ALTER TABLE public.users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_pages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_interactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracted_products  ENABLE ROW LEVEL SECURITY;

-- Users: anyone authenticated can read active users; only own row to update
CREATE POLICY "read active users" ON public.users
  FOR SELECT USING (is_active = TRUE AND auth.role() = 'authenticated');

CREATE POLICY "update own user" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Presence: all authenticated can read; own to update
CREATE POLICY "read presence" ON public.user_presence
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "upsert own presence" ON public.user_presence
  FOR ALL USING (auth.uid() = user_id);

-- Posts: all authenticated can read/insert
CREATE POLICY "read posts"   ON public.posts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "insert posts" ON public.posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own posts" ON public.posts FOR DELETE USING (auth.uid() = user_id);

-- Reactions
CREATE POLICY "read reactions"   ON public.reactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "manage reactions" ON public.reactions FOR ALL   USING (auth.uid() = user_id);

-- AI conversations: private per user
CREATE POLICY "own conversations" ON public.ai_conversations
  FOR ALL USING (auth.uid() = user_id);

-- Wiki: all authenticated can read/write
CREATE POLICY "read wiki"   ON public.wiki_pages FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write wiki"  ON public.wiki_pages FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "update wiki" ON public.wiki_pages FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "delete wiki" ON public.wiki_pages FOR DELETE USING (auth.uid() = author_id);

-- Clients, interactions, surveys, contracts: all authenticated team members
CREATE POLICY "read clients"    ON public.clients             FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write clients"   ON public.clients             FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "read interactions" ON public.client_interactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write interactions" ON public.client_interactions FOR ALL  USING (auth.role() = 'authenticated');
CREATE POLICY "read surveys"    ON public.surveys              FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write surveys"   ON public.surveys              FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "read contracts"  ON public.contracts            FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write contracts" ON public.contracts            FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "read products"   ON public.contracted_products  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "write products"  ON public.contracted_products  FOR ALL    USING (auth.role() = 'authenticated');

-- Grant to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
