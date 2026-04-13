-- ── 1. billing_type nos projetos ─────────────────────────────────────────────
-- recurring = entra no MRR da unidade
-- one_time  = receita pontual (não conta no MRR recorrente)
alter table projects
  add column if not exists billing_type text not null default 'recurring'
    check (billing_type in ('recurring', 'one_time'));

-- ── 2. fase_ter — kanban interno do squad JARVIS ──────────────────────────────
-- Representa a fase de desenvolvimento do projeto Ter
alter table projects
  add column if not exists fase_ter text;

-- Valores válidos (ordem do kanban):
-- 'Onboarding'
-- 'Desenvolvimento Preview'
-- 'Apresentação do Preview'
-- 'Ajustes Preview'
-- 'Aprovação'
-- 'Desenvolvimento'
-- 'Revisão'
-- 'Apresentação Final'
-- 'Passar pra Hospedagem'
-- 'Concluído'
-- 'Cancelado / Jurídico'

-- ── 3. fase_saber — kanban interno do squad Spartans Saber ───────────────────
alter table projects
  add column if not exists fase_saber text;

-- Valores válidos (ordem do kanban):
-- '00 - Aguardando / Follow-up'
-- '01 - Onboarding'
-- '02 - Diagnóstico de Criatividade'
-- '03 - Diagnóstico Comercial'
-- '04 - Estratégica de Mkt & Vendas'
-- '05 - Entregáveis + Pitch'
-- 'Concluído - Em negociação'
-- 'Expansão (assinado)'
-- 'Hand-off'
-- 'Concluído - Finalizado'
-- 'Concluído - Churn'
-- 'Concluído - Reembolso'
-- 'Concluído - Venda bookada'

-- ── 4. Índice para filtro rápido por billing_type ────────────────────────────
create index if not exists projects_billing_type_idx on projects(billing_type);
