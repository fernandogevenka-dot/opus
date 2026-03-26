# OPUS — Migração NocoDB → Supabase

## Bom dia! 👋

Trabalhei a noite toda e tudo está pronto. Siga os 2 passos abaixo para ativar tudo.

---

## PASSO 1 — Rodar o SQL no Supabase (5 min)

1. Acesse: https://supabase.com/dashboard/project/woroxniivyyyynhoyjwm/sql/new
2. Cole o conteúdo do arquivo: `supabase/migrations/20260321_noco_integration.sql`
3. Clique em **Run**
4. Deve aparecer "Success. No rows returned."

Isso vai criar:
- `squads` — tabela de squads
- `collaborators` — tabela de colaboradores (People)
- `projects` — tabela de projetos (PE&G)
- `checkins` — check-ins por cliente
- `nps_records` — registros de NPS
- `csat_records` — registros de CSAT
- `metas` — metas por cliente
- `health_score_ee` — health score EE
- `onboarding_checklist` — checklist de onboarding
- Colunas novas na tabela `clients`: cnpj, razao_social, operation_start_date, journey_stage, etc.

---

## PASSO 2 — Migrar os dados do NocoDB (2 min)

Após rodar o SQL, no Terminal:

```bash
cd ~/Dev/wa-bridge
node migrate_noco.mjs
```

Isso vai puxar **todos os dados** do NocoDB Oxicore e inserir no Supabase:
- 233 clientes (todos os status)
- 271 projetos com produtos, squad, MRR
- 66 colaboradores com remuneração
- 13 squads
- Todos os check-ins, NPS, CSAT, Metas, Health Score

O script é **idempotente** — pode rodar várias vezes sem duplicar dados.

Para migrar só uma tabela:
```bash
node migrate_noco.mjs --only=clients
node migrate_noco.mjs --only=projects
node migrate_noco.mjs --only=people
```

---

## O que foi implementado no OPUS

### Novas páginas:
- **Projetos** — Kanban por Momento + Lista. Cadastro completo com todos os campos.
- **Colaboradores** — Gestão de people com remuneração, função, área, squad, status.
- **Squads** — Estrutura dos squads com membros, projetos e MRR.
- **Inteligência** — Check-ins, NPS, CSAT, Metas por cliente.
- **WhatsApp CS** — Já estava funcionando (bridge conectado com 540 grupos).

### Navegação reorganizada:
```
OPERAÇÃO: Clientes | Projetos | Inteligência | WhatsApp CS
TIME: Colaboradores | Squads
FERRAMENTAS: Nova IA | Base de Conhecimento | Reuniões | Workspace
```

---

## Grupos WhatsApp do NocoDB

Seus projetos têm o campo `ID do Grupo` com os IDs dos grupos de WhatsApp.
O bridge já conectou e encontrou 540 grupos.

Para vincular os grupos aos projetos automaticamente, após rodar a migração:
O campo `wa_group_id` em `projects` vai ser preenchido com o ID do grupo NocoDB.
Na página WhatsApp CS > Configurações, os grupos vão aparecer para você vincular ao cliente.

---

## Arquivos criados/modificados

```
src/
  hooks/
    useProjects.ts        ← novo
    useCollaborators.ts   ← novo
    useSquadsData.ts      ← novo
    useCheckins.ts        ← novo
  pages/
    ProjectsPage.tsx      ← novo
    CollaboratorsPage.tsx ← novo
    SquadsPage.tsx        ← novo
    CheckinsPage.tsx      ← novo
  store/
    appStore.ts           ← atualizado (novos tipos de página)
  App.tsx                 ← atualizado (novas rotas)
  components/shared/
    AppLayout.tsx         ← atualizado (nova navegação)

supabase/migrations/
  20260321_noco_integration.sql  ← RODAR NO DASHBOARD

~/Dev/wa-bridge/
  migrate_noco.mjs        ← script de migração
```
