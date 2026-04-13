-- Tabela de investimento em marketing por mês (CAC geral sem vinculação a cliente)
-- Usada para calcular CAC médio no GTM Cockpit

CREATE TABLE IF NOT EXISTS marketing_spend (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month       date NOT NULL,           -- sempre dia 1 do mês (ex: 2026-04-01)
  amount      numeric(12,2) NOT NULL,  -- valor investido em marketing nesse mês
  notes       text,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (month)
);

-- RLS
ALTER TABLE marketing_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read marketing_spend"
  ON marketing_spend FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert marketing_spend"
  ON marketing_spend FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update marketing_spend"
  ON marketing_spend FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete marketing_spend"
  ON marketing_spend FOR DELETE TO authenticated USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_marketing_spend_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER marketing_spend_updated_at
  BEFORE UPDATE ON marketing_spend
  FOR EACH ROW EXECUTE FUNCTION update_marketing_spend_updated_at();
