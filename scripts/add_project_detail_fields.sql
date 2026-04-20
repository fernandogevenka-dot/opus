-- Adiciona campos de detalhe HOps aos projetos
-- Execute no Supabase SQL Editor

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS escopo      TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS tier        TEXT,
  ADD COLUMN IF NOT EXISTS saude       TEXT CHECK (saude IN ('saudavel', 'atencao', 'critico'));

COMMENT ON COLUMN projects.escopo      IS 'Descrição do escopo do projeto (editável inline na tela de detalhe)';
COMMENT ON COLUMN projects.observacoes IS 'Observações internas e contexto relevante';
COMMENT ON COLUMN projects.tier        IS 'Tier/nível do projeto (ex: Gold, Silver, Bronze)';
COMMENT ON COLUMN projects.saude       IS 'Saúde do projeto: saudavel | atencao | critico';
