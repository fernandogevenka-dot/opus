-- Normaliza o campo status dos clientes importados do NocoDB
-- Regra: Status Cliente preenchido como "Ativo" no NocoDB → 'active'
--        Status Cliente vazio/nulo no NocoDB → 'churned'  (não marcado = inativo)
--        Tem churn_date independente do status → 'churned'

-- Clientes com churn_date → churned
UPDATE clients
SET status = 'churned'
WHERE churn_date IS NOT NULL
  AND (status IS NULL OR status NOT IN ('churned'));

-- Clientes sem status explícito e sem churn_date → churned (campo vazio = inativo no NocoDB)
UPDATE clients
SET status = 'churned'
WHERE status IS NULL AND churn_date IS NULL;

-- Nota: clientes que tinham "Status Cliente = Ativo" no NocoDB já foram importados
-- com status = 'active' se o campo foi mapeado. Verifique quais foram preservados.
-- Para marcar manualmente os ativos reais, use:
-- UPDATE clients SET status = 'active' WHERE id IN (...);
