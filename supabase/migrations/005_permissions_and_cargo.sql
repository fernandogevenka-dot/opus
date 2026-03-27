-- ============================================================
-- 005: Permissões granulares (JSONB) + cargo_titulo + colaborador_id
-- ============================================================

-- Cargo exibido pelo usuário no cadastro (informativo, não define acesso)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cargo_titulo TEXT
    CHECK (cargo_titulo IN ('Diretor', 'Gerente', 'Coordenador', 'Investidor')),
  -- Vínculo com o registro de colaborador já existente
  ADD COLUMN IF NOT EXISTS colaborador_id UUID,
  -- Permissões granulares definidas pelo admin no momento da aprovação
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb;

-- Índice para queries em permissions
CREATE INDEX IF NOT EXISTS idx_users_permissions ON users USING gin(permissions);

-- Default de permissões por nível de acesso (referência — aplicado via código na aprovação)
-- Os valores abaixo são apenas documentação; o admin pode customizar qualquer flag.
--
-- Diretor / Gerente (acesso total):
-- { "ver_todos_projetos": true, "ver_remuneracoes": true, "ver_todos_clientes": true,
--   "ver_financeiro": true, "editar_projetos": true, "editar_colaboradores": true,
--   "gerenciar_squads": true, "aprovar_usuarios": true, "configuracoes": true }
--
-- Coordenador:
-- { "ver_todos_projetos": false, "ver_remuneracoes": true, "ver_todos_clientes": false,
--   "ver_financeiro": false, "editar_projetos": true, "editar_colaboradores": false,
--   "gerenciar_squads": false, "aprovar_usuarios": false, "configuracoes": false }
--
-- Investidor (colaborador):
-- { "ver_todos_projetos": false, "ver_remuneracoes": false, "ver_todos_clientes": false,
--   "ver_financeiro": false, "editar_projetos": false, "editar_colaboradores": false,
--   "gerenciar_squads": false, "aprovar_usuarios": false, "configuracoes": false }
