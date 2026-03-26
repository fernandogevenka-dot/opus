-- ============================================================
-- NocoDB Integration: New tables and columns for OPUS
-- Migration: 20260321_noco_integration.sql
-- ============================================================

-- 1. Extend clients table with NocoDB fields
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS noco_id INTEGER,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS razao_social TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_financeiro TEXT,
  ADD COLUMN IF NOT EXISTS email_faturamento TEXT,
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS cargo_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS operation_start_date DATE,
  ADD COLUMN IF NOT EXISTS churn_date DATE,
  ADD COLUMN IF NOT EXISTS aviso_previo_date DATE,
  ADD COLUMN IF NOT EXISTS ultimo_dia_servico DATE,
  ADD COLUMN IF NOT EXISTS ultimo_pagamento_date DATE,
  ADD COLUMN IF NOT EXISTS ultimo_pagamento_valor NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS problema_financeiro BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS usa BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS journey_stage TEXT DEFAULT 'onboarding',
  ADD COLUMN IF NOT EXISTS situation_color TEXT DEFAULT 'green',
  ADD COLUMN IF NOT EXISTS main_product TEXT,
  ADD COLUMN IF NOT EXISTS team_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS clients_noco_id_idx ON clients(noco_id) WHERE noco_id IS NOT NULL;

-- 2. Squads table
CREATE TABLE IF NOT EXISTS squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE squads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "squads_read" ON squads;
CREATE POLICY "squads_read" ON squads FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "squads_write" ON squads;
CREATE POLICY "squads_write" ON squads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Collaborators (People) table
CREATE TABLE IF NOT EXISTS collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  full_name TEXT,
  role TEXT,
  area TEXT,
  seniority TEXT,
  format TEXT,
  email TEXT,
  whatsapp TEXT,
  cnpj TEXT,
  pix TEXT,
  remuneration NUMERIC(12,2),
  commission_pct NUMERIC(5,2),
  start_date DATE,
  end_date DATE,
  birth_date DATE,
  squad_name TEXT,
  squad_id UUID REFERENCES squads(id),
  user_id UUID REFERENCES auth.users(id),
  ekyte_task_type INTEGER,
  payment_day INTEGER,
  alert_status TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "collaborators_read" ON collaborators;
CREATE POLICY "collaborators_read" ON collaborators FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "collaborators_write" ON collaborators;
CREATE POLICY "collaborators_write" ON collaborators FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  name TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  client_noco_id INTEGER,
  squad_id UUID REFERENCES squads(id),
  squad_name TEXT,
  mrr NUMERIC(12,2) DEFAULT 0,
  estruturacao_estrategica NUMERIC(12,2),
  variavel NUMERIC(12,2),
  investimento NUMERIC(12,2),
  margem_bruta NUMERIC(5,2),
  ticket_medio NUMERIC(12,2),
  gestor_projeto TEXT,
  gestor_trafego TEXT,
  momento TEXT,
  fase_atual TEXT,
  prioridade TEXT,
  risco TEXT,
  tem_social_media TEXT,
  usa BOOLEAN DEFAULT FALSE,
  start_date DATE,
  end_date DATE,
  aviso_previo_date DATE,
  ultimo_dia_servico DATE,
  churn_date DATE,
  inicio_ee DATE,
  fim_ee DATE,
  step TEXT,
  produtos TEXT[],
  pasta_publica TEXT,
  pasta_privada TEXT,
  crm_url TEXT,
  sistema_dados_url TEXT,
  contrato_url TEXT,
  meta_ads_id TEXT,
  google_ads_id TEXT,
  ekyte_id INTEGER,
  wa_group_id TEXT,
  taxa_conversao NUMERIC(5,2),
  proposta_apresentada TEXT,
  noco_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_client_id_idx ON projects(client_id);
CREATE INDEX IF NOT EXISTS projects_momento_idx ON projects(momento);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "projects_read" ON projects;
CREATE POLICY "projects_read" ON projects FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "projects_write" ON projects;
CREATE POLICY "projects_write" ON projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Check-ins table
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  client_id UUID REFERENCES clients(id),
  project_id UUID REFERENCES projects(id),
  data DATE,
  demanda_dentro_expectativa TEXT,
  faturamento_mapeado TEXT,
  stakeholder_consciente TEXT,
  bom_relacionamento TEXT,
  stakeholder_participando TEXT,
  houve_queixa TEXT,
  planejamento_cumprido TEXT,
  motivo_planejamento TEXT,
  motivo_sem_vendas TEXT,
  fechamento_mes TEXT,
  numero_vendas INTEGER,
  faturamento_mes NUMERIC(12,2),
  leads INTEGER,
  oportunidades INTEGER,
  resultado_score TEXT,
  relacionamento_score TEXT,
  entregas_score TEXT,
  relacionamento_status TEXT,
  entregas_status TEXT,
  resultados_status TEXT,
  status_atual TEXT,
  ata TEXT,
  todo TEXT,
  comunicacao_whatsapp TEXT,
  transcricao_url TEXT,
  gravacao_url TEXT,
  squad TEXT,
  account_manager TEXT,
  gestor_trafego TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checkins_client_id_idx ON checkins(client_id);
CREATE INDEX IF NOT EXISTS checkins_data_idx ON checkins(data);

ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "checkins_read" ON checkins;
CREATE POLICY "checkins_read" ON checkins FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "checkins_write" ON checkins;
CREATE POLICY "checkins_write" ON checkins FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. NPS table
CREATE TABLE IF NOT EXISTS nps_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  client_id UUID REFERENCES clients(id),
  nota INTEGER CHECK (nota >= 0 AND nota <= 10),
  comentario TEXT,
  data DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS nps_client_id_idx ON nps_records(client_id);
ALTER TABLE nps_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nps_read" ON nps_records;
CREATE POLICY "nps_read" ON nps_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "nps_write" ON nps_records;
CREATE POLICY "nps_write" ON nps_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. CSAT table
CREATE TABLE IF NOT EXISTS csat_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  client_id UUID REFERENCES clients(id),
  copys NUMERIC(3,1),
  designs NUMERIC(3,1),
  resultados NUMERIC(3,1),
  prazos NUMERIC(3,1),
  gestao_campanhas NUMERIC(3,1),
  geral NUMERIC(3,1),
  comentario TEXT,
  data DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS csat_client_id_idx ON csat_records(client_id);
ALTER TABLE csat_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "csat_read" ON csat_records;
CREATE POLICY "csat_read" ON csat_records FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "csat_write" ON csat_records;
CREATE POLICY "csat_write" ON csat_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Metas table
CREATE TABLE IF NOT EXISTS metas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  client_id UUID REFERENCES clients(id),
  meta NUMERIC(15,2),
  tipo_meta TEXT,
  data DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS metas_client_id_idx ON metas(client_id);
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metas_read" ON metas;
CREATE POLICY "metas_read" ON metas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "metas_write" ON metas;
CREATE POLICY "metas_write" ON metas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Health Score EE
CREATE TABLE IF NOT EXISTS health_score_ee (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  client_id UUID REFERENCES clients(id),
  data DATE,
  semana_acompanhamento TEXT,
  satisfacao_entregas TEXT,
  entendimento_entregas TEXT,
  acima_expectativas TEXT,
  clareza_estruturacao TEXT,
  relacionamento TEXT,
  participacao_cliente TEXT,
  compreende_proxima_fase TEXT,
  interesse_assessoria TEXT,
  intencao_continuar TEXT,
  classificacao_geral TEXT,
  resumo TEXT,
  transcricao_url TEXT,
  percepcao_valor TEXT,
  relacionamento_score TEXT,
  clareza_interesse TEXT,
  total_final TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS health_score_client_id_idx ON health_score_ee(client_id);
ALTER TABLE health_score_ee ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "health_score_read" ON health_score_ee;
CREATE POLICY "health_score_read" ON health_score_ee FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "health_score_write" ON health_score_ee;
CREATE POLICY "health_score_write" ON health_score_ee FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. Onboarding checklist
CREATE TABLE IF NOT EXISTS onboarding_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  client_id UUID REFERENCES clients(id),
  descricao TEXT,
  comunicacao_inicial_grupo BOOLEAN DEFAULT FALSE,
  reuniao_gc BOOLEAN DEFAULT FALSE,
  reuniao_kickoff BOOLEAN DEFAULT FALSE,
  order_bump BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE onboarding_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "onboarding_read" ON onboarding_checklist;
CREATE POLICY "onboarding_read" ON onboarding_checklist FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "onboarding_write" ON onboarding_checklist;
CREATE POLICY "onboarding_write" ON onboarding_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. 1o1 History
CREATE TABLE IF NOT EXISTS one_on_one_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noco_id INTEGER UNIQUE,
  collaborator_id UUID REFERENCES collaborators(id),
  leader_noco_id INTEGER,
  data DATE,
  pife TEXT,
  growth TEXT,
  foco_quinzena TEXT,
  avancos_aprendizados TEXT,
  desafios_proximos_passos TEXT,
  entregas TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE one_on_one_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "1o1_read" ON one_on_one_history;
CREATE POLICY "1o1_read" ON one_on_one_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "1o1_write" ON one_on_one_history;
CREATE POLICY "1o1_write" ON one_on_one_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Update wa_groups to link with projects
ALTER TABLE wa_groups
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS noco_group_id TEXT;

-- Trigger: updated_at auto-update
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['squads','collaborators','projects','checkins','onboarding_checklist']
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS %I_updated_at ON %I;
      CREATE TRIGGER %I_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t, t, t);
  END LOOP;
END $$;
