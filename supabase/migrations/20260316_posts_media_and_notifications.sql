-- ============================================================
-- Posts: adicionar suporte a mídia (imagem/vídeo)
-- ============================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS media_url  TEXT,
  ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video'));

-- ============================================================
-- Bucket para mídia dos posts
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media',
  'post-media',
  true,
  52428800, -- 50 MB
  ARRAY['image/jpeg','image/png','image/gif','image/webp','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Política de leitura pública
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'post-media public read'
  ) THEN
    CREATE POLICY "post-media public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'post-media');
  END IF;
END $$;

-- Política de upload autenticado
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'post-media auth upload'
  ) THEN
    CREATE POLICY "post-media auth upload"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'post-media' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- ============================================================
-- Tabela de preferências de notificação por e-mail
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id           UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  email_on_post     BOOLEAN NOT NULL DEFAULT true,  -- recebe e-mail quando alguém publica
  email_on_mention  BOOLEAN NOT NULL DEFAULT true,
  email_on_reaction BOOLEAN NOT NULL DEFAULT false,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own notification prefs" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id);

-- Cria preferências padrão para todos os usuários existentes
INSERT INTO public.notification_preferences (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;
