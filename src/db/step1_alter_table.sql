-- PASSO 1: Adicionar colunas de conteúdo V4
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS descricao_card       text,
  ADD COLUMN IF NOT EXISTS escopo               text,
  ADD COLUMN IF NOT EXISTS formato_entrega      text,
  ADD COLUMN IF NOT EXISTS o_que_entrego        text,
  ADD COLUMN IF NOT EXISTS como_vendo           text,
  ADD COLUMN IF NOT EXISTS para_quem_serve      text,
  ADD COLUMN IF NOT EXISTS como_entrega_valor   text,
  ADD COLUMN IF NOT EXISTS time_envolvido       text,
  ADD COLUMN IF NOT EXISTS duracao              text,
  ADD COLUMN IF NOT EXISTS dono                 text,
  ADD COLUMN IF NOT EXISTS descricao_completa   text,
  ADD COLUMN IF NOT EXISTS como_entrego_dados   jsonb,
  ADD COLUMN IF NOT EXISTS spiced_data          jsonb,
  ADD COLUMN IF NOT EXISTS use_case_map_1_name  text,
  ADD COLUMN IF NOT EXISTS use_case_map_1_data  jsonb,
  ADD COLUMN IF NOT EXISTS use_case_map_2_name  text,
  ADD COLUMN IF NOT EXISTS use_case_map_2_data  jsonb;
