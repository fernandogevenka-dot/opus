-- ── Action Plans (Planos de Ação por Gargalo) ────────────────────────────────
create table if not exists action_plans (
  id           uuid primary key default gen_random_uuid(),
  -- Origem do gargalo que gerou este plano
  gargalo_tipo text not null check (gargalo_tipo in ('retencao', 'expansao', 'aquisicao', 'ok', 'manual')),
  -- Campos obrigatórios (estrutura slide 24)
  problema     text not null,   -- Métrica abaixo do benchmark
  hipotese     text,            -- Por que está acontecendo
  acao         text not null,   -- O que fazer
  owner        text,            -- Responsável
  prazo        date,            -- Data limite
  metrica_sucesso text,         -- Como medir o sucesso
  -- Execução
  status       text not null default 'aberto'
    check (status in ('aberto', 'em_andamento', 'concluido', 'cancelado')),
  resultado    text,            -- O que foi realizado ao concluir
  -- Vínculo opcional com MBR
  mbr_id       uuid references mbr_sessions(id) on delete set null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── MBR Sessions (Monthly Business Reviews) ──────────────────────────────────
create table if not exists mbr_sessions (
  id              uuid primary key default gen_random_uuid(),
  mes             text not null,   -- "YYYY-MM"
  -- Snapshot automático dos GTM-5 no momento do MBR
  mrr_snapshot    numeric,
  grr_snapshot    numeric,
  nrr_snapshot    numeric,
  churn_snapshot  numeric,
  crescimento_snapshot numeric,
  horizonte_snapshot   text,
  -- Gargalo identificado na reunião
  gargalo_identificado text,   -- retencao | expansao | aquisicao | ok
  gargalo_notas        text,   -- anotações livres da reunião
  -- Participantes e notas gerais
  participantes   text,
  notas_gerais    text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique (mes)    -- um MBR por mês
);

-- Foreign key action_plans → mbr_sessions (mbr_sessions criada acima)
alter table action_plans
  add constraint action_plans_mbr_id_fkey
  foreign key (mbr_id) references mbr_sessions(id) on delete set null;

-- Índices
create index if not exists action_plans_status_idx    on action_plans(status);
create index if not exists action_plans_gargalo_idx   on action_plans(gargalo_tipo);
create index if not exists mbr_sessions_mes_idx       on mbr_sessions(mes);

-- RLS
alter table action_plans  enable row level security;
alter table mbr_sessions  enable row level security;
create policy "action_plans: authenticated full access"  on action_plans  for all to authenticated using (true) with check (true);
create policy "mbr_sessions: authenticated full access"  on mbr_sessions  for all to authenticated using (true) with check (true);

-- updated_at triggers
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger action_plans_updated_at  before update on action_plans  for each row execute function update_updated_at_column();
create trigger mbr_sessions_updated_at  before update on mbr_sessions  for each row execute function update_updated_at_column();
