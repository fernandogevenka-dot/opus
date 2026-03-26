-- ============================================================
-- Migration: campos de perfil estilo LinkedIn na tabela users
-- Vincula com a tabela Nossos Investidores do Notion
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bio           TEXT,
  ADD COLUMN IF NOT EXISTS phone         TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url  TEXT,
  ADD COLUMN IF NOT EXISTS departamento  TEXT,
  ADD COLUMN IF NOT EXISTS squad         TEXT,
  ADD COLUMN IF NOT EXISTS step          TEXT,
  ADD COLUMN IF NOT EXISTS local         TEXT,     -- '🏭 SBS' | '🏠 Home' | '🧬 Híbrido'
  ADD COLUMN IF NOT EXISTS joined_at     DATE,
  ADD COLUMN IF NOT EXISTS lt            INTEGER,  -- Lifetime em meses
  ADD COLUMN IF NOT EXISTS aging         TEXT,     -- ex: '🔴 +48m'
  ADD COLUMN IF NOT EXISTS cover_url     TEXT,     -- banner de capa
  ADD COLUMN IF NOT EXISTS skills        TEXT[];   -- array de skills/tags

-- Índice para busca por departamento/squad
CREATE INDEX IF NOT EXISTS idx_users_departamento ON public.users(departamento);
CREATE INDEX IF NOT EXISTS idx_users_squad        ON public.users(squad);
