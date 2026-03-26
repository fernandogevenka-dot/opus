-- ============================================================
-- Escritório Virtual: Squads, Mesas e Cadeiras
-- ============================================================

-- Squads (times/equipes)
CREATE TABLE IF NOT EXISTS public.squads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  color         TEXT NOT NULL DEFAULT '#3b82f6',
  flag_emoji    TEXT NOT NULL DEFAULT '🏳️',
  description   TEXT,
  dashboard_url TEXT,           -- link do dash de resultado (aparece na TV)
  coordinator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mesa de squad (cada squad tem uma mesa grande de até 9 lugares)
CREATE TABLE IF NOT EXISTS public.squad_desks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  squad_id    UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  position_x  INTEGER NOT NULL DEFAULT 0,  -- coluna no grid do escritório
  position_y  INTEGER NOT NULL DEFAULT 0,  -- linha no grid do escritório
  capacity    INTEGER NOT NULL DEFAULT 9,
  desk_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cadeira (lugar fixo dentro de uma mesa)
CREATE TABLE IF NOT EXISTS public.desk_seats (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  desk_id      UUID NOT NULL REFERENCES public.squad_desks(id) ON DELETE CASCADE,
  seat_index   INTEGER NOT NULL,           -- 0–8 (posição dentro da mesa)
  user_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  label        TEXT,                       -- ex: "Dev Senior", "Coord"
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(desk_id, seat_index)
);

-- Personalização da mesa do usuário (items que aparecem na mesa)
CREATE TABLE IF NOT EXISTS public.desk_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('plant','trophy','photo','mug','book','lamp','sticky_note','custom')),
  label      TEXT,
  emoji      TEXT,
  position   INTEGER NOT NULL DEFAULT 0,  -- ordem visual na mesa
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, position)
);

-- Status de presença expandido (para o escritório)
-- (a tabela user_presence já existe, apenas garantindo os campos)
ALTER TABLE public.user_presence
  ADD COLUMN IF NOT EXISTS desk_seat_id UUID REFERENCES public.desk_seats(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_proximity_muted BOOLEAN NOT NULL DEFAULT false;

-- RLS
ALTER TABLE public.squads       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_desks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desk_seats   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.desk_items   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read squads"      ON public.squads      FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "manage squads"    ON public.squads      FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "read desk_desks"  ON public.squad_desks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "manage desks"     ON public.squad_desks FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "read seats"       ON public.desk_seats  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "manage seats"     ON public.desk_seats  FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "own desk items"   ON public.desk_items  FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "read desk items"  ON public.desk_items  FOR SELECT USING (auth.role() = 'authenticated');

-- Dados iniciais: salas especiais (sem mesa)
-- (estas salas são fixas no layout, não precisam de tabela)
