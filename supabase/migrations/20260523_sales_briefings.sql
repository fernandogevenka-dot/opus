-- Sales Intelligence: tabela de briefings salvos
create table if not exists public.sales_briefings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  user_name   text not null default '',
  empresa     text not null,
  tab         text not null check (tab in ('pre', 'pos')),
  resultado   text not null,
  form_data   jsonb default '{}',
  created_at  timestamptz default now() not null
);

-- Índices
create index if not exists sales_briefings_user_id_idx on public.sales_briefings(user_id);
create index if not exists sales_briefings_created_at_idx on public.sales_briefings(created_at desc);

-- RLS
alter table public.sales_briefings enable row level security;

-- Todos os usuários autenticados podem ver todos os briefings do time
create policy "authenticated read all briefings"
  on public.sales_briefings for select
  to authenticated
  using (true);

-- Só o autor pode inserir
create policy "owner insert"
  on public.sales_briefings for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Só o autor pode deletar
create policy "owner delete"
  on public.sales_briefings for delete
  to authenticated
  using (auth.uid() = user_id);
