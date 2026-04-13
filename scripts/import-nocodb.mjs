/**
 * Import NocoDB → Supabase
 *
 * Faz upsert dos projetos do NocoDB para a tabela `projects` do Supabase.
 * Usa `noco_id` como chave de deduplicação.
 *
 * Como rodar:
 *   SUPABASE_SERVICE_KEY=xxx node scripts/import-nocodb.mjs
 *
 * A service key está em: Supabase Dashboard → Settings → API → service_role key
 */

import { createClient } from "@supabase/supabase-js";

// ─── Config ────────────────────────────────────────────────────────────────────
const NOCO_BASE_URL = "https://noco-nocodb.g87jz7.easypanel.host";
const NOCO_API_TOKEN = "xh-4pMKpOzzebUtXsMGUFRBFgrIkMCXNoAy64PWq";
const NOCO_TABLE_ID  = "m6a5ndjmza8432f";

const SUPABASE_URL = "https://woroxniivyyyynhoyjwm.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌  Defina SUPABASE_SERVICE_KEY como variável de ambiente.");
  console.error("    Supabase Dashboard → Settings → API → service_role key");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Mapeamentos ───────────────────────────────────────────────────────────────

/**
 * NocoDB "Squad" → squad_name canônico no Supabase
 * Normaliza variações de nome.
 */
function mapSquad(nocoSquad) {
  if (!nocoSquad) return null;
  const s = nocoSquad.trim();
  if (s.includes("Saber"))   return "Spartans | Saber";
  if (s.includes("Spartans")) return "Spartans";
  if (s.includes("JARVIS") || s.toUpperCase().includes("J.A.R.V.I.S")) return "J.A.R.V.I.S.";
  if (s.includes("Templários") || s.includes("Templarios")) return "Templários";
  if (s === "USA") return "USA";
  return s;
}

/**
 * NocoDB "STEP" → step canônico
 * Exemplos: "S - Saber" → "saber", "T - Ter" → "ter"
 */
function mapStep(nocoStep) {
  if (!nocoStep) return null;
  const s = nocoStep.toLowerCase();
  if (s.includes("saber"))      return "saber";
  if (s.includes("ter"))        return "ter";
  if (s.includes("executar") || s.startsWith("e -")) return "executar";
  if (s.includes("potencializar") || s.startsWith("p -")) return "potencializar";
  return nocoStep;
}

/**
 * NocoDB "Momento" → momento canônico no Supabase
 * Os emojis e textos devem bater com ProjectMomento em useProjects.ts
 */
function mapMomento(nocoMomento) {
  if (!nocoMomento) return null;
  const map = {
    "⏳ A Iniciar":               "⏳ A Iniciar",
    "🛫 Onboarding":              "🛫 Onboarding",
    "⚙️ Implementação":           "⚙️ Implementação",
    "♾️ Ongoing":                 "♾️ Ongoing",
    "⏳ Aviso Prévio":            "⏳ Aviso Prévio",
    "💲 Pausado - Financeiro":    "💲 Pausado - Financeiro",
    "🟡 Concluído - Negociação":  "🟡 Concluído - Negociação",
    "🟢 Concluído - Cross Sell":  "🟢 Concluído - Cross Sell",
    "🟣 Concluído - Churn":       "🟣 Concluído - Churn",
    "🟣 Concluído - Reembolso":   "🟣 Concluído - Reembolso",
    "⏸️ Inativo":                 "⏸️ Inativo",
  };
  return map[nocoMomento] ?? nocoMomento;
}

/**
 * NocoDB "Fase Atual" → fase_atual
 * Mantém o texto original — é usado como fase de produção no Ter.
 */
function mapFaseAtual(nocoFase) {
  return nocoFase ?? null;
}

/**
 * Converte um registro NocoDB para o formato da tabela projects do Supabase.
 */
function mapRecord(r) {
  return {
    noco_id:                r["Id"],
    name:                   r["Projeto"] || `(sem nome #${r["Id"]})`,
    squad_name:             mapSquad(r["Squad"]),
    mrr:                    r["Valor (R$)"] ?? 0,
    estruturacao_estrategica: r["Estruturação Estratégica"] ?? null,
    variavel:               r["Variável"] ?? null,
    investimento:           r["Investimento"] ?? null,
    margem_bruta:           r["Margem Bruta"] ?? null,
    ticket_medio:           r["Ticket Médio"] ?? null,
    gestor_projeto:         r["Gestor projeto"] ?? null,
    gestor_trafego:         r["Gestor trafego"] ?? null,
    momento:                mapMomento(r["Momento"]),
    fase_atual:             mapFaseAtual(r["Fase Atual"]),
    prioridade:             r["Prioridade"] ?? null,
    risco:                  r["Risco"] ?? null,
    tem_social_media:       r["Tem Social Media?"] ?? null,
    usa:                    r["USA"] === true,
    start_date:             r["Inicio do projeto"] ?? null,
    end_date:               r["Data fim do projeto"] ?? null,
    aviso_previo_date:      r["Data inicio aviso prévio"] ?? null,
    ultimo_dia_servico:     r["Data ultimo dia de serviço"] ?? null,
    churn_date:             r["Data do Churn"] ?? null,
    inicio_ee:              r["Início EE"] ?? null,
    fim_ee:                 r["Fim EE"] ?? null,
    step:                   mapStep(r["STEP"]),
    pasta_publica:          r["Pasta Pública"] ?? null,
    pasta_privada:          r["Pasta Privada"] ?? null,
    crm_url:                r["CRM"] ?? null,
    taxa_conversao:         r["Taxa de Conversão"] ?? null,
    proposta_apresentada:   r["Proposta apresentada"] ?? null,
    meta_ads_id:            r["MetaAds_ID"] ?? null,
    google_ads_id:          r["GoogleAds_ID"] ?? null,
    // billing_type: "recurring" por padrão (all one_time precisam ser marcados manualmente)
    billing_type:           "recurring",
    // fase_ter: usa "Fase Atual" para projetos T - Ter
    fase_ter:               (mapStep(r["STEP"]) === "ter") ? mapFaseAtual(r["Fase Atual"]) : null,
    // fase_saber: null por padrão (não vem do NocoDB desta view)
    fase_saber:             null,
    noco_updated_at:        r["UpdatedAt"] ?? null,
    updated_at:             new Date().toISOString(),
  };
}

// ─── Fetch NocoDB ──────────────────────────────────────────────────────────────

async function fetchAllRecords() {
  const PAGE_SIZE = 200;
  let offset = 0;
  let allRows = [];

  while (true) {
    const url = `${NOCO_BASE_URL}/api/v2/tables/${NOCO_TABLE_ID}/records?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, { headers: { "xc-token": NOCO_API_TOKEN } });
    if (!res.ok) throw new Error(`NocoDB ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const rows = json.list ?? [];
    allRows = allRows.concat(rows);
    console.log(`  📥 Lidos ${allRows.length}/${json.pageInfo?.totalRows ?? "?"} registros`);
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return allRows;
}

// ─── Upsert Supabase ───────────────────────────────────────────────────────────

async function upsertBatch(records) {
  const BATCH = 50;
  let inserted = 0, updated = 0, errors = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { data, error } = await supabase
      .from("projects")
      .upsert(batch, {
        onConflict: "noco_id",
        ignoreDuplicates: false,
      })
      .select("id, noco_id, name");

    if (error) {
      console.error(`  ❌ Batch ${i}-${i + batch.length}: ${error.message}`);
      errors += batch.length;
    } else {
      inserted += data?.length ?? 0;
      console.log(`  ✅ Batch ${i + 1}-${i + batch.length}: ${data?.length ?? 0} upserted`);
    }
  }

  return { inserted, errors };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Importando NocoDB → Supabase...\n");

  // 1. Buscar do NocoDB
  console.log("1️⃣  Buscando registros do NocoDB...");
  const rows = await fetchAllRecords();
  console.log(`   Total: ${rows.length} registros\n`);

  // 2. Mapear
  console.log("2️⃣  Mapeando campos...");
  const mapped = rows.map(mapRecord);

  // Resumo antes do upsert
  const byStep  = mapped.reduce((acc, r) => { acc[r.step ?? "null"] = (acc[r.step ?? "null"] ?? 0) + 1; return acc; }, {});
  const byMomento = mapped.reduce((acc, r) => { acc[r.momento ?? "null"] = (acc[r.momento ?? "null"] ?? 0) + 1; return acc; }, {});
  console.log("   Por STEP:", byStep);
  console.log("   Por Momento (top):", Object.entries(byMomento).sort((a,b) => b[1]-a[1]).slice(0,6).map(([k,v]) => `${k}: ${v}`).join(" | "));
  console.log();

  // 3. Upsert
  console.log("3️⃣  Fazendo upsert no Supabase...");
  const { inserted, errors } = await upsertBatch(mapped);

  console.log(`\n✅ Concluído!`);
  console.log(`   Upserted: ${inserted}`);
  if (errors > 0) console.warn(`   Erros: ${errors}`);

  // 4. Verificar resultado
  const { count } = await supabase.from("projects").select("*", { count: "exact", head: true });
  console.log(`   Total projetos no Supabase agora: ${count}`);
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
