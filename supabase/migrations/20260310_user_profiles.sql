-- ============================================================
-- Migration: user_profiles — perfil rico estilo LinkedIn
-- Vincula com tabela Nossos Investidores (Notion) via email
-- ============================================================

-- ─── 1. TABELA PRINCIPAL: user_profiles ──────────────────────
-- Separada de public.users para não poluir a tabela de auth.
-- Relação 1:1 com users via user_id (FK + PK).

CREATE TABLE IF NOT EXISTS public.user_profiles (
  -- Identity
  user_id         UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,

  -- Notion link (campo de fusão: vincula pelo email)
  notion_email    TEXT,   -- email registrado no Notion (pode diferir do Google)

  -- Appearance
  cover_url       TEXT,   -- banner de capa (upload manual)
  headline        TEXT,   -- ex: "Diretor PE&G • Oxicore"
  bio             TEXT,   -- sobre mim

  -- Contact
  phone           TEXT,
  linkedin_url    TEXT,
  secondary_email TEXT,

  -- Oxicore / Notion fields
  departamento    TEXT,   -- '01 - ADM' | '02 - Receita' | '03 - PE&G'
  squad           TEXT,   -- '🈹 Yakuza' | '⚔️ Spartans' | etc.
  step            TEXT,   -- '🧐 S - Saber' | '🛠️ E - Executar' | etc.
  local_trabalho  TEXT,   -- '🏭 SBS' | '🏠 Home' | '🧬 Híbrido'
  cargo           TEXT,   -- cargo oficial (pode divergir do role do Google)

  -- Tenure
  joined_at       DATE,
  lt_months       INTEGER,  -- lifetime em meses (pode ser calculado automaticamente)
  aging_label     TEXT,     -- ex: '🔴 +48m' (gerado pela query)

  -- Structured skills (array de objetos via JSONB)
  -- Formato: [{"name": "Google Ads", "level": "avancado", "category": "trafego"}, ...]
  skills          JSONB    NOT NULL DEFAULT '[]',

  -- Career history (array de experiências)
  -- Formato: [{"company": "V4", "role": "AM", "start": "2022-01", "end": null, "description": "..."}]
  career          JSONB    NOT NULL DEFAULT '[]',

  -- Education
  -- Formato: [{"institution": "USP", "degree": "Adm", "start": "2018", "end": "2022"}]
  education       JSONB    NOT NULL DEFAULT '[]',

  -- Certifications / conquistas
  -- Formato: [{"name": "Google Ads Certified", "issuer": "Google", "date": "2024-03", "url": ""}]
  certifications  JSONB    NOT NULL DEFAULT '[]',

  -- Visibility settings
  show_phone      BOOLEAN  NOT NULL DEFAULT TRUE,
  show_email      BOOLEAN  NOT NULL DEFAULT TRUE,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de busca
CREATE INDEX IF NOT EXISTS idx_profiles_departamento ON public.user_profiles(departamento);
CREATE INDEX IF NOT EXISTS idx_profiles_squad        ON public.user_profiles(squad);
CREATE INDEX IF NOT EXISTS idx_profiles_notion_email ON public.user_profiles(notion_email);
CREATE INDEX IF NOT EXISTS idx_profiles_skills       ON public.user_profiles USING GIN(skills);
CREATE INDEX IF NOT EXISTS idx_profiles_career       ON public.user_profiles USING GIN(career);

-- ─── 2. COMPUTED COLUMN: aging automático ────────────────────
-- View que calcula aging em tempo real sem precisar atualizar a coluna

CREATE OR REPLACE VIEW public.user_profiles_enriched AS
SELECT
  p.*,
  u.name,
  u.email,
  u.avatar_url,
  u.role,
  u.xp,
  u.level,
  -- Calcula aging em meses desde joined_at
  CASE
    WHEN p.joined_at IS NULL THEN NULL
    ELSE EXTRACT(MONTH FROM AGE(NOW(), p.joined_at))::INTEGER +
         EXTRACT(YEAR  FROM AGE(NOW(), p.joined_at))::INTEGER * 12
  END AS tenure_months,
  -- Aging label automático
  CASE
    WHEN p.joined_at IS NULL THEN NULL
    WHEN EXTRACT(MONTH FROM AGE(NOW(), p.joined_at))::INTEGER +
         EXTRACT(YEAR  FROM AGE(NOW(), p.joined_at))::INTEGER * 12 >= 36 THEN '🔴 +36m'
    WHEN EXTRACT(MONTH FROM AGE(NOW(), p.joined_at))::INTEGER +
         EXTRACT(YEAR  FROM AGE(NOW(), p.joined_at))::INTEGER * 12 >= 18 THEN '🟡 +18m'
    WHEN EXTRACT(MONTH FROM AGE(NOW(), p.joined_at))::INTEGER +
         EXTRACT(YEAR  FROM AGE(NOW(), p.joined_at))::INTEGER * 12 >= 6  THEN '🟢 +6m'
    ELSE '🔵 novo'
  END AS aging_auto
FROM public.user_profiles p
JOIN public.users u ON u.id = p.user_id;

-- ─── 3. TRIGGER: updated_at automático ───────────────────────

CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW EXECUTE FUNCTION update_user_profiles_updated_at();

-- ─── 4. FUNÇÃO: upsert de perfil seguro ──────────────────────
-- Garante que o perfil seja criado junto com o usuário

CREATE OR REPLACE FUNCTION ensure_user_profile(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ─── 5. RLS ───────────────────────────────────────────────────

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ler perfis
CREATE POLICY "read profiles"
  ON public.user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Só o próprio usuário pode atualizar seu perfil
CREATE POLICY "update own profile"
  ON public.user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Criação automática (via função ou trigger do auth)
CREATE POLICY "insert own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── 6. PERMISSÕES ───────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT SELECT ON public.user_profiles_enriched TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_user_profile TO authenticated;

-- ─── 7. NOTA: vinculação com Nossos Investidores (Notion) ────
-- O frontend faz a fusão por email:
--   user_profiles.notion_email (ou users.email)  ←→  MEMBROS[].email
-- Não armazenamos dados do Notion no banco (eles são estáticos no frontend).
-- O perfil editável fica em user_profiles; os dados Notion são read-only overlay.
