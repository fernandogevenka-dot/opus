-- Adiciona campos de duração de contrato e desconto aplicado aos projetos
-- Execute no Supabase SQL Editor

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS contract_duration TEXT,       -- 'one_time' | '6' | '12'
  ADD COLUMN IF NOT EXISTS desconto_total    NUMERIC(12,2); -- desconto total aplicado (valor absoluto)

-- Índice para radar de renovações: projetos ativos com end_date próxima
CREATE INDEX IF NOT EXISTS idx_projects_end_date
  ON projects (end_date)
  WHERE end_date IS NOT NULL;

COMMENT ON COLUMN projects.contract_duration IS 'Duração do contrato: one_time, 6 (meses), 12 (meses). Usado para calcular end_date e alimentar radar de renovações.';
COMMENT ON COLUMN projects.desconto_total    IS 'Desconto total aplicado sobre o valor de tabela dos produtos no momento da venda.';
