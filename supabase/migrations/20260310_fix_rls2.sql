-- ── Fix upsert: add UPDATE policies ──────────────────────────────────────────

-- users: allow update own row (needed for upsert on conflict)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'update own user row'
  ) THEN
    CREATE POLICY "update own user row" ON public.users
      FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- user_presence: allow update own presence (needed for upsert on conflict)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_presence' AND policyname = 'update own presence'
  ) THEN
    CREATE POLICY "update own presence" ON public.user_presence
      FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── Create increment_user_xp RPC if missing ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_user_xp(p_user_id UUID, p_xp INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET xp    = COALESCE(xp, 0) + p_xp,
      level = GREATEST(1, FLOOR(SQRT(COALESCE(xp, 0) + p_xp) / 10)::INTEGER)
  WHERE id = p_user_id;
END;
$$;

-- ── Make sure rooms table is readable without auth (no RLS) ──────────────────
-- rooms table has no RLS enabled so it's already public
-- but let's be explicit just in case
ALTER TABLE public.rooms DISABLE ROW LEVEL SECURITY;
