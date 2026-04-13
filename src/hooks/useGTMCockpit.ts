import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { ACTIVE_MOMENTOS, type Project } from "@/hooks/useProjects";
import { useProducts } from "@/hooks/useProducts";
import type { Client } from "@/types";

// ── Horizonte ──────────────────────────────────────────────────────────────────
export type Horizonte = "H1" | "H2" | "H3" | "H4" | "H5";

export interface HorizonteInfo {
  horizonte: Horizonte;
  label: string;
  range: string;
  benchmarkCrescimento: number; // % mensal ideal
  prazoMax: string;
  fase: "ARMV" | "ARPE" | "ARE";
  modaisLiberados: string[];
}

const HORIZONTES: HorizonteInfo[] = [
  { horizonte: "H1", label: "H1 — Início",          range: "até R$60k/mês",      benchmarkCrescimento: 40, prazoMax: "3 meses",  fase: "ARMV", modaisLiberados: ["Low-Touch"] },
  { horizonte: "H2", label: "H2 — Consistência",    range: "R$60k–R$150k/mês",  benchmarkCrescimento: 30, prazoMax: "6 meses",  fase: "ARMV", modaisLiberados: ["Low-Touch"] },
  { horizonte: "H3", label: "H3 — Gerência Emerg.", range: "R$150k–R$450k/mês", benchmarkCrescimento: 20, prazoMax: "16 meses", fase: "ARPE", modaisLiberados: ["Low-Touch", "Mid-Touch"] },
  { horizonte: "H4", label: "H4 — Escala",          range: "R$450k–R$900k/mês", benchmarkCrescimento: 7,  prazoMax: "24 meses", fase: "ARPE", modaisLiberados: ["Low-Touch", "Mid-Touch"] },
  { horizonte: "H5", label: "H5 — Singular Matura", range: "R$900k+/mês",       benchmarkCrescimento: 2.5,prazoMax: "36 meses", fase: "ARE",  modaisLiberados: ["Low-Touch", "Mid-Touch", "High-Touch"] },
];

function getHorizonte(mrr: number): HorizonteInfo {
  if (mrr < 60000)  return HORIZONTES[0];
  if (mrr < 150000) return HORIZONTES[1];
  if (mrr < 450000) return HORIZONTES[2];
  if (mrr < 900000) return HORIZONTES[3];
  return HORIZONTES[4];
}

// ── Tier do cliente ────────────────────────────────────────────────────────────
export type ClientTier = "Tiny" | "Small" | "Medium" | "Large" | "Enterprise";

function getClientTier(mrrCliente: number): ClientTier {
  // Baseado no faturamento anual estimado (MRR × 12) vs. thresholds V4
  const arrEstimado = mrrCliente * 12;
  if (arrEstimado < 60000)    return "Tiny";      // < R$60k/ano (~R$5k/mês)
  if (arrEstimado < 300000)   return "Small";     // R$60-300k/ano
  if (arrEstimado < 1200000)  return "Medium";    // R$300k-1.2M/ano
  if (arrEstimado < 6000000)  return "Large";     // R$1.2-6M/ano
  return "Enterprise";
}

function getTierModal(tier: ClientTier): string {
  if (tier === "Tiny" || tier === "Small") return "Low-Touch";
  if (tier === "Medium") return "Mid-Touch";
  return "High-Touch";
}

// ── MRR por mês ────────────────────────────────────────────────────────────────
function isoMonth(date: string): string {
  return date.slice(0, 7); // "YYYY-MM"
}

function isActiveInMonth(p: Project, yearMonth: string): boolean {
  if (!ACTIVE_MOMENTOS.includes(p.momento as never)) {
    if (!p.churn_date) return false;
    return isoMonth(p.churn_date) !== yearMonth;
  }
  if (!p.start_date) return false;
  const start = isoMonth(p.start_date);
  if (start > yearMonth) return false;
  if (p.end_date && isoMonth(p.end_date) < yearMonth) return false;
  return true;
}

function getMonthMRR(projects: Project[], yearMonth: string): number {
  return projects
    .filter((p) => isActiveInMonth(p, yearMonth) && p.billing_type !== "one_time")
    .reduce((sum, p) => sum + (p.mrr ?? 0), 0);
}

// Gera os últimos N meses em formato "YYYY-MM"
function lastNMonths(n: number): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

// ── Waterfall mensal ───────────────────────────────────────────────────────────
export interface MonthWaterfall {
  month: string;       // "YYYY-MM"
  label: string;       // "Jan/26"
  mrr: number;         // MRR total no mês
  novo: number;        // MRR de projetos que iniciaram neste mês
  retido: number;      // MRR mantido da base anterior
  expandido: number;   // MRR de projetos novos em clientes já ativos
  churned: number;     // MRR perdido (churn neste mês)
}

function buildWaterfall(projects: Project[], months: string[]): MonthWaterfall[] {
  return months.map((month, idx) => {
    const prevMonth = idx > 0 ? months[idx - 1] : null;

    // Projetos ativos neste mês
    const activeNow = projects.filter((p) => isActiveInMonth(p, month));

    // Projetos ativos no mês anterior
    const activePrev = prevMonth
      ? projects.filter((p) => isActiveInMonth(p, prevMonth))
      : [];
    const activePrevIds = new Set(activePrev.map((p) => p.id));
    const activePrevClientIds = new Set(activePrev.map((p) => p.client_id).filter(Boolean));

    // MRR churned: projetos recorrentes com churn_date neste mês
    const churnedProjects = projects.filter(
      (p) => p.churn_date && isoMonth(p.churn_date) === month && p.billing_type !== "one_time"
    );
    const churned = churnedProjects.reduce((s, p) => s + (p.mrr ?? 0), 0);

    // Projetos novos neste mês (start_date neste mês)
    const newProjects = activeNow.filter(
      (p) => p.start_date && isoMonth(p.start_date) === month
    );

    // Novo: projetos novos cujo cliente NÃO tinha projeto ativo no mês anterior
    const novoProjects = newProjects.filter(
      (p) => !activePrevClientIds.has(p.client_id ?? "")
    );
    const novo = novoProjects.reduce((s, p) => s + (p.mrr ?? 0), 0);

    // Expandido: projetos novos cujo cliente JÁ tinha projeto ativo no mês anterior
    const expandidoProjects = newProjects.filter(
      (p) => activePrevClientIds.has(p.client_id ?? "")
    );
    const expandido = expandidoProjects.reduce((s, p) => s + (p.mrr ?? 0), 0);

    // Retido: projetos que existiam antes e continuam ativos
    const retido = activeNow
      .filter((p) => activePrevIds.has(p.id))
      .reduce((s, p) => s + (p.mrr ?? 0), 0);

    const mrr = activeNow.reduce((s, p) => s + (p.mrr ?? 0), 0);

    const monthDate = new Date(parseInt(month.slice(0, 4)), parseInt(month.slice(5, 7)) - 1, 1);
    const label = monthDate.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

    return { month, label, mrr, novo, retido, expandido, churned };
  });
}

// ── GRR / NRR ─────────────────────────────────────────────────────────────────
function calcGRR(waterfall: MonthWaterfall[]): number {
  if (waterfall.length < 2) return 0;
  const last = waterfall[waterfall.length - 1];
  const prev = waterfall[waterfall.length - 2];
  if (prev.mrr === 0) return 0;
  return ((prev.mrr - last.churned) / prev.mrr) * 100;
}

function calcNRR(waterfall: MonthWaterfall[]): number {
  if (waterfall.length < 2) return 0;
  const last = waterfall[waterfall.length - 1];
  const prev = waterfall[waterfall.length - 2];
  if (prev.mrr === 0) return 0;
  return ((prev.mrr + last.expandido - last.churned) / prev.mrr) * 100;
}

// ── Health Score ───────────────────────────────────────────────────────────────
export interface ClientHealthScore {
  clientId: string;
  clientName: string;
  score: number;
  tier: ClientTier;
  modal: string;
  mrr: number;
  status: "saudavel" | "atencao" | "risco" | "critico";
  dimensions: {
    situacao: number;
    financeiro: number;
    nps: number;
    qualidade: number;   // combina risco de projeto + score PIC
    expansao: number;
  };
  picScore: number | null;  // último score_entrega do PIC (0-10), null se não há histórico
}

// Minimal PIC row shape needed for cockpit
interface PICRow {
  client_id: string;
  score_entrega: number | null;
  status: string;
  cycle_number: number;
}

function calcHealthScore(
  client: Client,
  projects: Project[],
  latestPIC: PICRow | null
): ClientHealthScore {
  const clientProjects = projects.filter(
    (p) =>
      p.client_id === client.id &&
      ACTIVE_MOMENTOS.includes(p.momento as never)
  );
  // MRR considera apenas projetos recorrentes
  const mrr = clientProjects
    .filter((p) => p.billing_type !== "one_time")
    .reduce((s, p) => s + (p.mrr ?? 0), 0);

  // Situação (situation_color) — 25%
  const situacaoMap: Record<string, number> = {
    green: 100, blue: 80, gray: 50, yellow: 40, red: 0,
  };
  const situacao = situacaoMap[client.situation_color ?? "gray"] ?? 50;

  // Saúde financeira — 25%
  let financeiro = 80;
  if (client.problema_financeiro) financeiro = 10;
  else if (client.ultimo_pagamento_date) {
    const diasSemPagto = Math.floor(
      (Date.now() - new Date(client.ultimo_pagamento_date).getTime()) / 86400000
    );
    if (diasSemPagto > 60) financeiro = 30;
    else if (diasSemPagto > 30) financeiro = 60;
    else financeiro = 100;
  }

  // NPS — 20%
  let nps = 50; // sem dado
  if (client.nps !== null && client.nps !== undefined) {
    if (client.nps >= 9) nps = 100;
    else if (client.nps >= 7) nps = 65;
    else if (client.nps >= 5) nps = 35;
    else nps = 0;
  }

  // Qualidade de entrega — 15%
  // Usa score PIC (0-10 → 0-100) se disponível; senão usa risco de projeto
  let qualidade: number;
  const picScore = latestPIC?.score_entrega ?? null;
  if (picScore !== null) {
    qualidade = Math.round((picScore / 10) * 100);
  } else {
    const riscos = clientProjects.map((p) => p.risco?.toLowerCase() ?? "");
    qualidade = 80;
    if (riscos.some((r) => r.includes("alto") || r.includes("crítico"))) qualidade = 20;
    else if (riscos.some((r) => r.includes("médio") || r.includes("medio"))) qualidade = 55;
    else if (clientProjects.length > 0) qualidade = 90;
  }

  // Potencial de expansão (status) — 15%
  const expansaoMap: Record<string, number> = {
    upsell: 100, active: 60, at_risk: 20, churned: 0, prospect: 40,
  };
  const expansao = expansaoMap[client.status ?? "active"] ?? 60;

  const score = Math.round(
    situacao  * 0.25 +
    financeiro * 0.25 +
    nps        * 0.20 +
    qualidade  * 0.15 +
    expansao   * 0.15
  );

  const status =
    score >= 80 ? "saudavel" :
    score >= 60 ? "atencao"  :
    score >= 40 ? "risco"    : "critico";

  const tier = getClientTier(mrr);

  return {
    clientId: client.id,
    clientName: client.name,
    score,
    tier,
    modal: getTierModal(tier),
    mrr,
    status,
    picScore,
    dimensions: { situacao, financeiro, nps, qualidade, expansao },
  };
}

// ── Mix de produtos ────────────────────────────────────────────────────────────
export interface ProductMix {
  category: string;
  label: string;
  mrr: number;
  count: number;
  color: string;
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  saber:        { label: "Saber",        color: "#8b5cf6" },
  ter:          { label: "Ter",          color: "#06b6d4" },
  executar:     { label: "Executar",     color: "#10b981" },
  potencializar:{ label: "Potencializar",color: "#f59e0b" },
  destrava:     { label: "Destrava",     color: "#ef4444" },
  outros:       { label: "Outros",       color: "#6b7280" },
};

// ── Gargalo (TOC) ──────────────────────────────────────────────────────────────
export interface Gargalo {
  tipo: "retencao" | "expansao" | "aquisicao" | "ok";
  titulo: string;
  descricao: string;
  acao: string;
  metrica: string;
  valor: string;
  benchmark: string;
}

function identificarGargalo(
  grr: number,
  nrr: number,
  crescimentoMensal: number,
  benchmarkCrescimento: number
): Gargalo {
  // TOC: prioriza pelo pior desvio vs. benchmark
  const desvioGRR = 85 - grr;
  const desvioNRR = 100 - nrr;
  const desvioCrescimento = benchmarkCrescimento - crescimentoMensal;

  if (desvioGRR > 10 && desvioGRR >= desvioNRR && desvioGRR >= desvioCrescimento) {
    return {
      tipo: "retencao",
      titulo: "Gargalo: Retenção",
      descricao: "Seu GRR está abaixo do benchmark de 85%. A base está perdendo receita por churn.",
      acao: "Revise o Health Score dos clientes com status Risco/Crítico. Inicie um Save Plan imediato.",
      metrica: "GRR",
      valor: `${grr.toFixed(1)}%`,
      benchmark: "> 85%",
    };
  }

  if (desvioNRR > 0 && desvioNRR >= desvioCrescimento) {
    return {
      tipo: "expansao",
      titulo: "Gargalo: Expansão",
      descricao: "Seu NRR está abaixo de 100%. A base não está crescendo por upsell/cross-sell.",
      acao: "Identifique clientes com Health Score 🟢 e abra conversas de expansão com novos produtos.",
      metrica: "NRR",
      valor: `${nrr.toFixed(1)}%`,
      benchmark: "> 100%",
    };
  }

  if (desvioCrescimento > 5) {
    return {
      tipo: "aquisicao",
      titulo: "Gargalo: Aquisição",
      descricao: `Crescimento mensal (${crescimentoMensal.toFixed(1)}%) abaixo do benchmark do seu horizonte (${benchmarkCrescimento}%).`,
      acao: "Aumente investimento em geração de demanda (inbound/outbound) e revise o funil de conversão.",
      metrica: "Crescimento MRR",
      valor: `${crescimentoMensal.toFixed(1)}%/mês`,
      benchmark: `> ${benchmarkCrescimento}%/mês`,
    };
  }

  return {
    tipo: "ok",
    titulo: "Operação Saudável",
    descricao: "Suas métricas principais estão dentro dos benchmarks para o horizonte atual.",
    acao: "Foco em escalar: aumente o pipeline de aquisição e identifique oportunidades de expansão.",
    metrica: "GTM-5",
    valor: "✓",
    benchmark: "✓",
  };
}

// ── Hook principal ─────────────────────────────────────────────────────────────
export interface MarketingSpendEntry {
  id: string;
  month: string; // "YYYY-MM-DD" dia 1
  amount: number;
  notes: string | null;
}

export function useGTMCockpit() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [picCycles, setPicCycles] = useState<PICRow[]>([]);
  const [marketingSpend, setMarketingSpend] = useState<MarketingSpendEntry[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingPIC, setLoadingPIC] = useState(true);
  const { products, loading: loadingProducts } = useProducts();

  useEffect(() => {
    supabase
      .from("clients")
      .select("*")
      .then(({ data }) => {
        if (data) setClients(data as Client[]);
        setLoadingClients(false);
      });
  }, []);

  useEffect(() => {
    supabase
      .from("projects")
      .select("*")
      .then(({ data }) => {
        if (data) setProjects(data as Project[]);
        setLoadingProjects(false);
      });
  }, []);

  useEffect(() => {
    supabase
      .from("pic_cycles")
      .select("client_id, score_entrega, status, cycle_number")
      .eq("status", "completed")
      .order("cycle_number", { ascending: false })
      .then(({ data }) => {
        if (data) setPicCycles(data as PICRow[]);
        setLoadingPIC(false);
      });
  }, []);

  useEffect(() => {
    supabase
      .from("marketing_spend")
      .select("id, month, amount, notes")
      .order("month", { ascending: true })
      .then(({ data }) => {
        if (data) setMarketingSpend(data as MarketingSpendEntry[]);
      });
  }, []);

  const loading = loadingClients || loadingProjects || loadingProducts || loadingPIC;

  const result = useMemo(() => {
    if (!clients.length && !projects.length) return null;

    const months6 = lastNMonths(6);
    const months3 = lastNMonths(3);

    // Waterfall dos últimos 6 meses
    const waterfall = buildWaterfall(projects, months6);

    // MRR atual (mês corrente)
    const currentMonth = months6[months6.length - 1];
    const mrrAtual = getMonthMRR(projects, currentMonth);

    // Crescimento médio últimos 3 meses
    const mrrs3 = months3.map((m) => getMonthMRR(projects, m));
    const crescimentos3: number[] = [];
    for (let i = 1; i < mrrs3.length; i++) {
      if (mrrs3[i - 1] > 0) {
        crescimentos3.push(((mrrs3[i] - mrrs3[i - 1]) / mrrs3[i - 1]) * 100);
      }
    }
    const crescimentoMedio =
      crescimentos3.length > 0
        ? crescimentos3.reduce((a, b) => a + b, 0) / crescimentos3.length
        : 0;

    // Horizonte
    const horizonteInfo = getHorizonte(mrrAtual);

    // GRR / NRR
    const grr = calcGRR(waterfall);
    const nrr = calcNRR(waterfall);

    // Clientes ativos (status !== "churned")
    const activeClients = clients.filter((c) => c.status !== "churned");
    const churnedThisMonth = clients.filter(
      (c) => c.churn_date && isoMonth(c.churn_date) === currentMonth
    );
    const churnRate =
      activeClients.length > 0
        ? (churnedThisMonth.length / (activeClients.length + churnedThisMonth.length)) * 100
        : 0;

    // Latest completed PIC per client (already ordered by cycle_number desc)
    const latestPICByClient = new Map<string, PICRow>();
    for (const row of picCycles) {
      if (!latestPICByClient.has(row.client_id)) {
        latestPICByClient.set(row.client_id, row);
      }
    }

    // Health Scores
    const healthScores: ClientHealthScore[] = activeClients
      .map((c) => calcHealthScore(c, projects, latestPICByClient.get(c.id) ?? null))
      .sort((a, b) => a.score - b.score); // pior primeiro

    // Distribuição por tier
    const tierCounts: Record<ClientTier, { count: number; mrr: number }> = {
      Tiny: { count: 0, mrr: 0 },
      Small: { count: 0, mrr: 0 },
      Medium: { count: 0, mrr: 0 },
      Large: { count: 0, mrr: 0 },
      Enterprise: { count: 0, mrr: 0 },
    };
    healthScores.forEach((hs) => {
      tierCounts[hs.tier].count++;
      tierCounts[hs.tier].mrr += hs.mrr;
    });

    // Modal dominante
    const modalCounts: Record<string, number> = {};
    healthScores.forEach((hs) => {
      modalCounts[hs.modal] = (modalCounts[hs.modal] ?? 0) + hs.mrr;
    });
    const modalDominante =
      Object.entries(modalCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Low-Touch";

    // Mix de produtos por categoria (via projetos ativos + catálogo)
    const activeProjects = projects.filter((p) =>
      ACTIVE_MOMENTOS.includes(p.momento as never)
    );
    const productCategoryMap: Record<string, string> = {};
    products.forEach((prod) => {
      productCategoryMap[prod.name] = prod.category;
    });

    const mixMap: Record<string, { mrr: number; count: number }> = {};
    activeProjects.forEach((proj) => {
      const produtos = proj.produtos ?? [];
      const mrrPorProduto = produtos.length > 0 ? (proj.mrr ?? 0) / produtos.length : 0;
      if (produtos.length === 0) {
        // sem produto listado → "outros"
        const cat = "outros";
        if (!mixMap[cat]) mixMap[cat] = { mrr: 0, count: 0 };
        mixMap[cat].mrr += proj.mrr ?? 0;
        mixMap[cat].count++;
      } else {
        produtos.forEach((prodNome) => {
          const cat = productCategoryMap[prodNome] ?? "outros";
          if (!mixMap[cat]) mixMap[cat] = { mrr: 0, count: 0 };
          mixMap[cat].mrr += mrrPorProduto;
          mixMap[cat].count++;
        });
      }
    });

    const productMix: ProductMix[] = Object.entries(mixMap)
      .map(([cat, { mrr, count }]) => ({
        category: cat,
        label: CATEGORY_META[cat]?.label ?? cat,
        mrr: Math.round(mrr),
        count,
        color: CATEGORY_META[cat]?.color ?? "#6b7280",
      }))
      .sort((a, b) => b.mrr - a.mrr);

    // Gargalo TOC
    const gargalo = identificarGargalo(grr, nrr, crescimentoMedio, horizonteInfo.benchmarkCrescimento);

    // Distribuição health
    const healthDist = {
      saudavel: healthScores.filter((h) => h.status === "saudavel").length,
      atencao:  healthScores.filter((h) => h.status === "atencao").length,
      risco:    healthScores.filter((h) => h.status === "risco").length,
      critico:  healthScores.filter((h) => h.status === "critico").length,
    };

    // CAC por mês: investimento_marketing / novos_clientes_no_mês
    const cacByMonth = months6.map((m) => {
      const spend = marketingSpend.find((s) => s.month.slice(0, 7) === m);
      const novos = waterfall.find((w) => w.month === m)?.novo ?? 0;
      const investimento = spend?.amount ?? 0;
      const cac = novos > 0 && investimento > 0 ? investimento / novos : null;
      return { month: m, investimento, novos, cac };
    });

    // CAC médio últimos 6 meses com dados
    const cacComDados = cacByMonth.filter((c) => c.cac !== null);
    const cacMedio = cacComDados.length
      ? cacComDados.reduce((s, c) => s + (c.cac ?? 0), 0) / cacComDados.length
      : null;

    return {
      // Posição
      mrrAtual,
      crescimentoMedio,
      horizonteInfo,
      modalDominante,
      // Retenção
      grr,
      nrr,
      churnRate,
      waterfall,
      // Health
      healthScores,
      healthDist,
      totalAtivos: activeClients.length,
      // Mix
      productMix,
      tierCounts,
      // Gargalo
      gargalo,
      // CAC
      cacByMonth,
      cacMedio,
    };
  }, [clients, projects, products, marketingSpend]);

  return { data: result, loading };
}
