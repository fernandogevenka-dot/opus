-- Campos de acompanhamento de ritmo para projetos Saber
-- Replicam a lógica do Notion: inicio_realizado, fim_realizado, proxima_entrega, semana_atual, semana_ritmo

alter table projects
  add column if not exists inicio_realizado   date,
  add column if not exists fim_realizado      date,
  add column if not exists proxima_entrega    date,
  add column if not exists semana_atual       int,
  add column if not exists semana_ritmo       int;

-- Índices para queries de filtragem por data
create index if not exists projects_proxima_entrega_idx on projects(proxima_entrega);
create index if not exists projects_inicio_realizado_idx on projects(inicio_realizado);
