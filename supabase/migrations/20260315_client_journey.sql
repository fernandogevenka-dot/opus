-- ============================================================
-- Jornada do cliente: etapas, produto principal, time
-- ============================================================

-- Etapa da jornada (Onboarding, Mês 01 .. Mês 24)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS journey_stage TEXT DEFAULT 'onboarding'
    CHECK (journey_stage IN (
      'onboarding',
      'month_01','month_02','month_03','month_04','month_05','month_06',
      'month_07','month_08','month_09','month_10','month_11','month_12',
      'month_13','month_14','month_15','month_16','month_17','month_18',
      'month_19','month_20','month_21','month_22','month_23','month_24'
    ));

-- Mês de operação (calculado, mas pode ser forçado manualmente)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS operation_start_date DATE;

-- Produto principal contratado (texto livre ou slug)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS main_product TEXT;

-- Nome do time/squad responsável
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS team_name TEXT;

-- Situação resumida (visível no card)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS situation TEXT; -- ex: "Entregando bem", "Atrasado", "Em risco"

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS situation_color TEXT DEFAULT 'green'
    CHECK (situation_color IN ('green','yellow','red','blue','gray'));

-- Índices úteis para filtros
CREATE INDEX IF NOT EXISTS idx_clients_journey ON clients(journey_stage);
CREATE INDEX IF NOT EXISTS idx_clients_team_name ON clients(team_name);
CREATE INDEX IF NOT EXISTS idx_clients_main_product ON clients(main_product);
