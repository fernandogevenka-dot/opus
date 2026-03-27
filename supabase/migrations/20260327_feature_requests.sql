-- ─── Feature Requests (Fórum de Melhorias) ──────────────────────────────────

create table if not exists feature_requests (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- Conteúdo
  title       text not null,
  description text,
  category    text not null default 'melhoria'
                check (category in ('melhoria', 'bug', 'novo_recurso', 'integracao', 'outro')),

  -- Status do ciclo de vida
  status      text not null default 'aberto'
                check (status in ('aberto', 'em_analise', 'planejado', 'em_desenvolvimento', 'concluido', 'recusado')),

  -- Autor
  author_id   uuid references users(id) on delete set null,
  author_name text,

  -- Votação (array de user_ids para evitar duplicatas)
  votes       uuid[] not null default '{}',

  -- Prioridade / estimativa (pode ser preenchido por admin)
  priority    text check (priority in ('baixa', 'media', 'alta', null)),
  admin_notes text
);

-- Tabela de comentários do fórum
create table if not exists feature_request_comments (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  feature_request_id uuid not null references feature_requests(id) on delete cascade,
  author_id          uuid references users(id) on delete set null,
  author_name        text,
  content            text not null
);

-- Índices
create index if not exists idx_feature_requests_status   on feature_requests(status);
create index if not exists idx_feature_requests_category on feature_requests(category);
create index if not exists idx_feature_request_comments_fr on feature_request_comments(feature_request_id);

-- RLS
alter table feature_requests          enable row level security;
alter table feature_request_comments  enable row level security;

-- Qualquer usuário autenticado pode ler
create policy "feature_requests_select"
  on feature_requests for select
  using (auth.role() = 'authenticated');

create policy "feature_request_comments_select"
  on feature_request_comments for select
  using (auth.role() = 'authenticated');

-- Qualquer usuário autenticado pode criar
create policy "feature_requests_insert"
  on feature_requests for insert
  with check (auth.role() = 'authenticated');

create policy "feature_request_comments_insert"
  on feature_request_comments for insert
  with check (auth.role() = 'authenticated');

-- Apenas o autor pode atualizar (ou admin via service role)
create policy "feature_requests_update"
  on feature_requests for update
  using (auth.uid() = author_id or auth.role() = 'service_role');

-- Votar: qualquer usuário autenticado pode atualizar o array de votes
create policy "feature_requests_vote"
  on feature_requests for update
  using (auth.role() = 'authenticated');

-- Updated_at automático
create or replace function update_feature_requests_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feature_requests_updated_at on feature_requests;
create trigger feature_requests_updated_at
  before update on feature_requests
  for each row execute function update_feature_requests_updated_at();
