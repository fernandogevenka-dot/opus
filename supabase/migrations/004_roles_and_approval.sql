-- ============================================================
-- Migration 004 — Hierarquia de roles e aprovação de usuários
-- ============================================================

-- 1. Adicionar colunas de hierarquia na tabela users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS opus_role TEXT NOT NULL DEFAULT 'pending'
    CHECK (opus_role IN ('admin', 'gerencia_peg', 'coord_admin', 'coord_peg', 'colaborador', 'pending')),
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS funcao TEXT,        -- função declarada pelo usuário
  ADD COLUMN IF NOT EXISTS squad_id UUID REFERENCES public.squads(id);

-- 2. Você (Fernando) é admin imediatamente — ajuste o email conforme necessário
UPDATE public.users
SET opus_role = 'admin', approval_status = 'approved'
WHERE email = 'fernando.gevenka@v4company.com';

-- 3. View útil para listagem de aprovações pendentes
CREATE OR REPLACE VIEW public.pending_users AS
SELECT
  id, name, email, avatar_url, funcao, opus_role, created_at
FROM public.users
WHERE approval_status = 'pending'
ORDER BY created_at ASC;

-- 4. RLS: admin pode ver e aprovar todos; usuário vê só a si mesmo
-- (já existe policy de SELECT para usuários autenticados — adicionar para UPDATE aprovação)
CREATE POLICY IF NOT EXISTS "admin_approve_users" ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.opus_role IN ('admin', 'gerencia_peg', 'coord_admin')
    )
  );
