-- Normaliza status dos clientes baseado no campo "Status Cliente" do NocoDB
-- Fonte: API NocoDB tabela mm54ae918llr8n6 consultada em 2026-04-13
-- Resultado: 92 Ativos, 15 Inativos explícitos, 133 Vazios (= inativo)

-- 1. Marcar todos como churned por padrão (vazio = inativo)
UPDATE clients SET status = 'churned' WHERE status IS NULL OR status NOT IN ('active','at_risk','upsell','churned');

-- 2. Marcar os 92 com "Status Cliente = Ativo" como active
UPDATE clients SET status = 'active'
WHERE noco_id IN (
  327,328,330,334,335,336,337,340,343,344,345,346,347,348,349,350,
  351,353,355,358,360,361,362,363,364,365,366,367,62,63,66,71,87,
  92,101,108,111,116,127,129,138,139,189,191,195,200,201,203,204,
  214,216,217,220,224,226,227,232,233,234,245,246,254,257,260,263,
  265,272,273,278,279,284,286,290,295,297,298,299,306,310,311,312,
  313,314,316,317,318,319,322,475,678,682,751
);

-- 3. Marcar os 15 com "Status Cliente = Inativo" como churned (já estão, mas por clareza)
UPDATE clients SET status = 'churned'
WHERE noco_id IN (333,339,342,354,359,81,230,231,241,255,259,281,483,698,777);

-- Resultado esperado: ~92 ativos, ~153 churned
