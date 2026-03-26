-- ============================================================
-- client_financials: mapa de receita e margem por cliente/mês
-- ============================================================

CREATE TABLE IF NOT EXISTS client_financials (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  month        DATE NOT NULL,                      -- "2026-03-01" = março/26

  -- Receita
  mrr          NUMERIC(12,2) NOT NULL DEFAULT 0,   -- receita recorrente do mês

  -- Custos
  cac          NUMERIC(12,2) NOT NULL DEFAULT 0,   -- custo de aquisição (1x no primeiro mês)
  cost_to_serve NUMERIC(12,2) NOT NULL DEFAULT 0,  -- remuneração proporcional do time
  ad_spend     NUMERIC(12,2) NOT NULL DEFAULT 0,   -- verba em anúncios

  -- Margem calculada automaticamente
  contribution_margin NUMERIC(12,2)
    GENERATED ALWAYS AS (mrr - cost_to_serve - ad_spend) STORED,

  -- % preenchida por trigger (mrr pode ser 0)
  margin_pct   NUMERIC(6,2) DEFAULT 0,

  notes        TEXT,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),

  UNIQUE(client_id, month)
);

-- ── Trigger: calcular margin_pct ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION calc_margin_pct()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mrr > 0 THEN
    NEW.margin_pct := ROUND(((NEW.mrr - NEW.cost_to_serve - NEW.ad_spend) / NEW.mrr) * 100, 2);
  ELSE
    NEW.margin_pct := 0;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_margin ON client_financials;
CREATE TRIGGER trg_calc_margin
  BEFORE INSERT OR UPDATE ON client_financials
  FOR EACH ROW EXECUTE FUNCTION calc_margin_pct();

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE client_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated team access"
  ON client_financials FOR ALL
  USING (auth.role() = 'authenticated');

-- ── Índices ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cf_client      ON client_financials(client_id);
CREATE INDEX IF NOT EXISTS idx_cf_month       ON client_financials(client_id, month DESC);
CREATE INDEX IF NOT EXISTS idx_cf_margin      ON client_financials(client_id, contribution_margin);

-- ── Coluna google_event_id em client_interactions (deduplicação de agenda) ──

ALTER TABLE client_interactions
  ADD COLUMN IF NOT EXISTS google_event_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_ci_google_event
  ON client_interactions(google_event_id)
  WHERE google_event_id IS NOT NULL;
