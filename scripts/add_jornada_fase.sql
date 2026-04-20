-- Adiciona campo de fase da jornada HOps aos projetos
-- Execute no Supabase SQL Editor

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS jornada_fase TEXT;

-- Índice para queries por jornada + fase
CREATE INDEX IF NOT EXISTS idx_projects_step_jornada_fase
  ON projects (step, jornada_fase)
  WHERE step IS NOT NULL;

COMMENT ON COLUMN projects.jornada_fase IS 'Fase atual do projeto dentro da jornada HOps. Exemplos: "Kickoff", "GO Live e Ativação", "CHECK - Controle de qualidade".';
