-- PIC (Plano de Impacto Conjunto) cycles
-- Each client has recurring 90-day PIC cycles with accumulated history

create table if not exists pic_cycles (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references clients(id) on delete cascade,
  cycle_number int not null default 1,          -- 1, 2, 3, ... (sequential per client)
  start_date  date not null,
  end_date    date not null,                    -- start_date + 90 days
  status      text not null default 'active'    -- active | completed | cancelled
    check (status in ('active', 'completed', 'cancelled')),

  -- O acordo
  objetivo_principal  text,                     -- Qual valor esperado para o cliente
  acoes_acordadas     text,                     -- O que foi acordado ser executado
  metricas_sucesso    text,                     -- Como medir o sucesso

  -- Revisão ao fechar o ciclo
  resultado_atingido  text,                     -- O que foi entregue de fato
  aprendizados        text,                     -- O que aprendemos
  score_entrega       int check (score_entrega between 0 and 10), -- nota de 0-10

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Index for fast per-client queries
create index if not exists pic_cycles_client_id_idx on pic_cycles(client_id);
create index if not exists pic_cycles_status_idx on pic_cycles(status);

-- RLS
alter table pic_cycles enable row level security;
create policy "pic_cycles: authenticated full access" on pic_cycles
  for all to authenticated using (true) with check (true);

-- Auto-update updated_at
create or replace function update_pic_cycles_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger pic_cycles_updated_at
  before update on pic_cycles
  for each row execute function update_pic_cycles_updated_at();
