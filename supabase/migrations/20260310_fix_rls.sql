-- Fix RLS: allow authenticated users to insert their own row
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'insert own user'
  ) THEN
    CREATE POLICY "insert own user" ON public.users
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Fix RLS: allow authenticated users to insert their own presence
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_presence' AND policyname = 'insert own presence'
  ) THEN
    CREATE POLICY "insert own presence" ON public.user_presence
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Fix RLS: xp_events
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'xp_events' AND policyname = 'manage own xp'
  ) THEN
    CREATE POLICY "manage own xp" ON public.xp_events
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Fix RLS: knock_notifications
ALTER TABLE public.knock_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'knock_notifications' AND policyname = 'manage knocks'
  ) THEN
    CREATE POLICY "manage knocks" ON public.knock_notifications
      FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
