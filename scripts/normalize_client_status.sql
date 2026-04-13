-- Normaliza o campo status dos clientes importados do NocoDB
-- Regra: tem churn_date → 'churned', senão → 'active'

UPDATE clients
SET status = 'churned'
WHERE churn_date IS NOT NULL
  AND (status IS NULL OR status NOT IN ('churned'));

UPDATE clients
SET status = 'active'
WHERE churn_date IS NULL
  AND (status IS NULL OR status NOT IN ('active', 'at_risk', 'upsell'));
