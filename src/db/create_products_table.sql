-- ============================================================
-- STEP 1: Criar tabela products
-- ============================================================

create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null default 'outros',
  billing_type  text not null default 'recurring'
                constraint products_billing_type_check
                check (billing_type in ('recurring', 'one_time')),
  default_price numeric(12,2) not null default 0,
  description   text,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS
alter table public.products enable row level security;

create policy "allow all authenticated"
  on public.products
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


-- ============================================================
-- STEP 2: Inserir produtos do V4 Product Compass
--
-- Categorias mapeadas:
--   SABER             → 'saber'
--   TER               → 'ter'
--   EXECUTAR          → 'executar'
--   POTENCIALIZAR     → 'potencializar'
--   DESTRAVA RECEITA  → 'destrava'  (nova categoria — adicione no hook se quiser)
-- ============================================================

insert into public.products (name, category, billing_type, default_price, description, active) values

  -- ── EXECUTAR — Profissionais (Recorrente) ──────────────────────────────────
  ('Profissional de Gestão de Mídia Paga',       'executar', 'recurring',  5497.14, 'Gestão estratégica de campanhas em Meta Ads e Google Ads, otimizando ROI e escalando resultados.', true),
  ('Profissional de Designer Gráfico',           'executar', 'recurring',  3500.00, 'Criação de peças visuais para redes sociais, apresentações e materiais de marketing.', true),
  ('Profissional de CRM',                        'executar', 'recurring',  4200.00, 'Implementação, automação e gestão de CRM para aumentar conversões e retenção.', true),
  ('Profissional de Social Media',               'executar', 'recurring',  3200.00, 'Gestão de redes sociais, criação de conteúdo e engajamento de comunidade.', true),
  ('Profissional de Web Design',                 'executar', 'recurring',  3800.00, 'Criação e manutenção de sites, landing pages e experiências digitais.', true),
  ('Profissional de Marketplace',                'executar', 'recurring',  5497.14, 'O Profissional de Marketplace atua como integrador responsável por gerenciar todas as operações em marketplaces digitais.', true),
  ('Gestão de Projetos Avançada',                'executar', 'recurring',  2500.00, 'Gestão dedicada de projetos com metodologia ágil e acompanhamento de entregas.', true),
  ('Google + Social Ads',                        'executar', 'recurring',  4500.00, 'Gestão integrada de campanhas pagas no Google e redes sociais.', true),
  ('Criativos Básicos',                          'executar', 'recurring',  1800.00, 'Produção de criativos estáticos para campanhas pagas.', true),
  ('Ambiente Essencial',                         'executar', 'recurring',  1200.00, 'Configuração e manutenção do ambiente digital essencial do cliente.', true),

  -- ── EXECUTAR — Manutenção (Recorrente) ────────────────────────────────────
  ('Manutenção de CRM (Marketing)',              'executar', 'recurring',   992.01, 'Manutenção preventiva e corretiva do ambiente de CRM de marketing.', true),
  ('Manutenção de Site',                         'executar', 'recurring',  1200.00, 'Manutenção preventiva para sites — atualizações, backups e correções.', true),
  ('Manutenção de Landing Page',                 'executar', 'recurring',   800.00, 'Manutenção e otimização contínua de landing pages.', true),

  -- ── TER — Implementações (One-time) ───────────────────────────────────────
  ('Implementação de CRM',                       'ter',      'one_time',  12000.00, 'Implementação completa de plataforma CRM com automações e integrações.', true),
  ('Implementação de Site',                      'ter',      'one_time',   8500.00, 'Desenvolvimento e entrega de site institucional ou e-commerce.', true),
  ('Implementação de Landing Page',              'ter',      'one_time',   3500.00, 'Criação e configuração de landing page otimizada para conversão.', true),
  ('Implementação de E-commerce (Pro)',           'ter',      'one_time',  30951.83, 'Implementação completa de e-commerce na versão Pro — infraestrutura, integrações e treinamento.', true),
  ('Implementação de E-commerce (Basic)',         'ter',      'one_time',  15000.00, 'Implementação de e-commerce na versão Basic — loja funcional pronta para vender.', true),
  ('Implementação de Chatbot (Pro)',              'ter',      'one_time',   5925.20, 'Implementação de chatbot avançado com IA, integrações e fluxos personalizados.', true),
  ('Implementação de Chatbot (Basic)',            'ter',      'one_time',   2800.00, 'Implementação de chatbot básico com fluxos pré-definidos para atendimento.', true),

  -- ── SABER — Diagnósticos e Estratégia (One-time) ──────────────────────────
  ('Estruturação Estratégica',                   'saber',    'one_time',  15000.00, 'Diagnóstico completo e construção do plano estratégico digital do cliente.', true),
  ('Diagnóstico e Planejamento de Marketing e Vendas no Digital', 'saber', 'one_time', 6500.00, 'Diagnóstico da operação digital com entrega de plano de ação para marketing e vendas.', true),
  ('DR-X',                                       'saber',    'one_time',   8000.00, 'Diagnóstico avançado de resultados com análise de dados e recomendações de melhoria.', true),
  ('DR-O',                                       'saber',    'one_time',   5000.00, 'Diagnóstico operacional com mapeamento de processos e gargalos.', true),

  -- ── DESTRAVA RECEITA — Auditorias (One-time) ──────────────────────────────
  ('Auditoria Técnica de Traqueamento Completo', 'destrava', 'one_time',   6282.81, 'Auditoria completa do ambiente de rastreamento — GA4, GTM, Meta Pixel e integrações.', true),
  ('Auditoria Técnica de Ambientes CRO/SEO',     'destrava', 'one_time',   7090.66, 'Auditoria de CRO e SEO com análise de UX, velocidade, palavras-chave e oportunidades de conversão.', true),

  -- ── POTENCIALIZAR (Recorrente) ────────────────────────────────────────────
  ('Stack Digital',                              'potencializar', 'recurring', 2000.00, 'Gerenciamento e otimização da stack de ferramentas digitais do cliente.', true);


-- ============================================================
-- STEP 3: (Opcional) Adicionar 'destrava' como categoria
-- se quiser exibir no hook, edite PRODUCT_CATEGORIES em:
--   src/hooks/useProducts.ts
-- ============================================================

-- Exemplo de update de preço depois:
-- update public.products set default_price = 6000 where name = 'Estruturação Estratégica';
