import { useState, useEffect } from "react";
import { useCustomerSuccess } from "@/hooks/useCustomerSuccess";
import type { ClientDetail, ClientProject } from "@/hooks/useCustomerSuccess";
import { ACTIVE_MOMENTOS } from "@/hooks/useProjects";
import { useClientFinancials } from "@/hooks/useClientFinancials";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import type { Client } from "@/types";
import { useAppStore } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import {
  Plus, Search, X, TrendingUp, Users, AlertTriangle,
  DollarSign, Star, Phone, Mail, Clock,
  BarChart3, Calendar, RefreshCw, CheckCircle2,
  ChevronDown, Package, UserCheck, Zap, Filter, Layers, Briefcase,
  FileText, Link, Building2, MapPin, CreditCard, Sparkles, Upload, Pencil,
  ToggleLeft, ToggleRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { timeAgo } from "@/lib/utils";
import { FinancialSummary } from "@/components/cs/FinancialSummary";
import { RevenueMap } from "@/components/cs/RevenueMap";
import { FinancialEntryForm } from "@/components/cs/FinancialEntryForm";
import {
  PRODUCT_CATALOG,
  ALL_PRODUCTS,
  getCategoryForProduct,
  type ProductCategory,
} from "@/lib/productCatalog";

// ─── Journey stages ───────────────────────────────────────────────────────────

const JOURNEY_STAGES = [
  { id: "onboarding", label: "Onboarding", short: "ON", color: "#8b5cf6" },
  { id: "month_01",   label: "Mês 01",     short: "M1",  color: "#8b5cf6" },
  { id: "month_02",   label: "Mês 02",     short: "M2",  color: "#8b5cf6" },
  { id: "month_03",   label: "Mês 03",     short: "M3",  color: "#8b5cf6" },
  { id: "month_06",   label: "Mês 06",     short: "M6",  color: "#06b6d4" },
  { id: "month_12",   label: "Mês 12",     short: "M12", color: "#22c55e" },
  { id: "month_18",   label: "Mês 18",     short: "M18", color: "#f59e0b" },
  { id: "month_24",   label: "Mês 24",     short: "M24", color: "#ef4444" },
];

// All months for the full selector
const ALL_JOURNEY_STAGES = [
  { id: "onboarding", label: "Onboarding" },
  ...Array.from({ length: 24 }, (_, i) => ({
    id: `month_${String(i + 1).padStart(2, "0")}`,
    label: `Mês ${String(i + 1).padStart(2, "0")}`,
  })),
];

function getJourneyLabel(id: string | null | undefined): string {
  if (!id) return "—";
  const found = ALL_JOURNEY_STAGES.find((s) => s.id === id);
  return found?.label ?? id;
}

function getJourneyColor(id: string | null | undefined): string {
  if (!id || id === "onboarding") return "#8b5cf6";
  const num = parseInt(id.replace("month_", ""), 10);
  if (num <= 3)  return "#8b5cf6";
  if (num <= 6)  return "#06b6d4";
  if (num <= 12) return "#22c55e";
  if (num <= 18) return "#f59e0b";
  return "#ef4444";
}

// ─── Health status ────────────────────────────────────────────────────────────

const SITUATION_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  green:  { label: "Saudável",   color: "#22c55e", bg: "#22c55e18" },
  yellow: { label: "Atenção",    color: "#f59e0b", bg: "#f59e0b18" },
  red:    { label: "Em Risco",   color: "#ef4444", bg: "#ef444418" },
  blue:   { label: "Upsell",     color: "#8b5cf6", bg: "#8b5cf618" },
  gray:   { label: "Inativo",    color: "#6b7280", bg: "#6b728018" },
};

// ─── Margem operacional por produto (fonte: Fábrica de Receita DR-OTE) ────────
//
// % de margem operacional da UNIDADE sobre a Receita Bruta.
// DRX=46.74%  DR-O=36.61%  DR-T=74.64%  DR-E=84.79%
// Outros produtos estimados conservadoramente em 35%.

const PRODUCT_MARGIN: Record<string, number> = {
  "DR-X":                                 0.4674,
  "DR-O":                                 0.3661,
  "DR-T":                                 0.7464,
  "DR-E":                                 0.8479,
  "Estruturação Estratégica":             0.4674, // proxy DRX
  "Implementação de CRM de Marketing":    0.3500,
  "Site":                                 0.3500,
  "Profissional de Mídia — Compartilhado":0.3500,
  "Profissional de Mídia — Semi Dedicado":0.3500,
  "Profissional de Mídia — Dedicado":     0.3500,
};

function getProductMargin(product: string | null | undefined): number {
  if (!product) return 0.35;
  return PRODUCT_MARGIN[product] ?? 0.35;
}

/** Retorna margem LTV estimada = MRR × meses_ativos × margem_produto */
function estimateLtvMargin(client: Client): number {
  if (!client.mrr || !client.operation_start_date) return 0;
  const start  = new Date(client.operation_start_date);
  const now    = new Date();
  const months = Math.max(1, Math.round((now.getTime() - start.getTime()) / (30.44 * 86_400_000)));
  const gross  = client.mrr * months;
  return gross * getProductMargin(client.main_product);
}

/** Agrupa clientes por safra (trimestre de entrada) */
interface CohortGroup {
  key:     string;   // "2024-Q3"
  label:   string;   // "Q3 2024"
  clients: Client[];
}

function buildCohorts(clients: Client[]): CohortGroup[] {
  const map = new Map<string, Client[]>();

  for (const c of clients) {
    const dateStr = c.operation_start_date ?? c.created_at;
    const d       = new Date(dateStr);
    const year    = d.getFullYear();
    const quarter = Math.ceil((d.getMonth() + 1) / 3);
    const key     = `${year}-Q${quarter}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => {
      const [year, q] = key.split("-");
      return { key, label: `${q} ${year}`, clients: list };
    });
}

// ─── Pipeline status ──────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: "prospect", label: "Prospect",  color: "#6b7280" },
  { id: "active",   label: "Ativo",     color: "#22c55e" },
  { id: "upsell",   label: "Upsell",    color: "#8b5cf6" },
  { id: "at_risk",  label: "Em Risco",  color: "#f59e0b" },
  { id: "churned",  label: "Churned",   color: "#ef4444" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function getNpsColor(nps: number | null): string {
  if (nps === null) return "#6b7280";
  if (nps >= 70) return "#22c55e";
  if (nps >= 30) return "#f59e0b";
  return "#ef4444";
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

// ─── Dados incompletos ────────────────────────────────────────────────────────

interface MissingField {
  label: string;
  tab: DetailTab;
}

/** Retorna lista de campos obrigatórios faltando no cadastro do cliente */
function getMissingData(client: Client): MissingField[] {
  const missing: MissingField[] = [];
  if (!client.contact_name?.trim())        missing.push({ label: "Nome do contato", tab: "overview" });
  if (!client.contact_email?.trim() && !(client as Client & { telefone?: string }).telefone?.trim())
    missing.push({ label: "E-mail ou telefone", tab: "overview" });
  if (!client.main_product?.trim())        missing.push({ label: "Produto principal", tab: "overview" });
  if (!client.team_name?.trim())           missing.push({ label: "Time/Squad", tab: "overview" });
  if (!client.operation_start_date)        missing.push({ label: "Data de início", tab: "overview" });
  if (!(client.mrr > 0))                  missing.push({ label: "MRR", tab: "financial" });
  return missing;
}

// ─── Client card ─────────────────────────────────────────────────────────────

function ClientCard({
  client, isSelected, onSelect, onOpenTab,
}: {
  client: Client;
  isSelected: boolean;
  onSelect: () => void;
  onOpenTab?: (tab: DetailTab) => void;
}) {
  const journeyColor = getJourneyColor(client.journey_stage);
  const lt = ltMonths(client.journey_stage);

  // Churn indicator
  const isChurned = client.status === "churned";
  const isAtRisk  = client.status === "at_risk";

  // LTV acumulado: MRR × meses ativos (estimativa visual no card)
  const ltvAcum = (client.mrr ?? 0) * Math.max(lt, 1);

  // Dados incompletos — não exibir para churned
  const missing = isChurned ? [] : getMissingData(client);
  const hasIncomplete = missing.length > 0;

  // Aba que mais tem campos faltando (para navegar diretamente)
  const primaryMissingTab: DetailTab = missing.find((m) => m.tab === "financial")
    ? "financial"
    : "overview";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      onClick={onSelect}
      className={`glass rounded-xl border p-3 cursor-pointer transition-all hover:border-primary/30 group ${
        isSelected        ? "border-primary/50 bg-primary/5"  :
        hasIncomplete     ? "border-red-500/30"               :
        isChurned         ? "border-red-500/20 opacity-60"    :
        isAtRisk          ? "border-amber-500/30"             :
        "border-border/30"
      }`}
    >
      {/* Alerta dados incompletos */}
      {hasIncomplete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenTab?.(primaryMissingTab);
          }}
          className="w-full flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/25 text-[10px] font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
          title={`Faltando: ${missing.map((m) => m.label).join(", ")}`}
        >
          <AlertTriangle size={9} className="flex-shrink-0" />
          <span className="truncate">Dados incompletos — {missing.map((m) => m.label).join(", ")}</span>
        </button>
      )}

      {/* Row 1: nome + LT badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold leading-tight truncate flex-1">{client.name}</p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
          style={{ color: journeyColor, backgroundColor: `${journeyColor}20` }}
        >
          {`LT${lt}`}
        </span>
      </div>

      {/* Row 2: MRR + LTV acumulado */}
      <div className="flex items-center gap-3 text-xs mb-2">
        {client.mrr > 0 ? (
          <span className="font-semibold text-foreground">
            {formatCurrency(client.mrr)}
            <span className="text-muted-foreground font-normal">/mês</span>
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-[10px]">sem MRR</span>
        )}
        {ltvAcum > 0 && (
          <span className="flex items-center gap-1 text-muted-foreground/60 ml-auto text-[10px]">
            <TrendingUp size={9} />
            {formatCurrency(ltvAcum)}
          </span>
        )}
      </div>

      {/* Row 3: produto + time */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
        {client.main_product && (
          <span className="flex items-center gap-1 truncate">
            <Package size={9} />
            {client.main_product}
          </span>
        )}
        {client.team_name && (
          <span className="flex items-center gap-1 ml-auto flex-shrink-0">
            <UserCheck size={9} />
            {client.team_name}
          </span>
        )}
      </div>

      {/* Churn aviso */}
      {(client as Client & { aviso_previo_date?: string }).aviso_previo_date && !isChurned && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-400">
          <AlertTriangle size={9} />
          Aviso prévio ativo
        </div>
      )}
    </motion.div>
  );
}

// ─── Journey column ────────────────────────────────────────────────────────────

function JourneyColumn({
  stage, clients, selectedId, onSelect, onAddClient, onOpenTab,
}: {
  stage: { id: string; label: string; color: string };
  clients: Client[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddClient: () => void;
  onOpenTab: (clientId: string, tab: DetailTab) => void;
}) {
  const totalMrr = clients.reduce((sum, c) => sum + (c.mrr ?? 0), 0);

  return (
    <div className="flex flex-col gap-2 min-w-[230px] max-w-[260px] flex-1">
      <div
        className="flex items-center justify-between px-3 py-2 rounded-xl"
        style={{ backgroundColor: `${stage.color}18` }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <span className="text-xs font-semibold">{stage.label}</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
            style={{ backgroundColor: `${stage.color}30`, color: stage.color }}
          >
            {clients.length}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {totalMrr > 0 && (
            <span className="text-[10px] text-muted-foreground">{formatCurrency(totalMrr)}</span>
          )}
          <button
            onClick={onAddClient}
            className="p-1 rounded-lg hover:bg-secondary/60 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-0.5">
        <AnimatePresence>
          {clients.length === 0 ? (
            <div
              className="text-center py-6 rounded-xl border-2 border-dashed"
              style={{ borderColor: `${stage.color}22` }}
            >
              <p className="text-[10px] text-muted-foreground/40">Nenhum cliente aqui</p>
            </div>
          ) : (
            clients.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                isSelected={selectedId === c.id}
                onSelect={() => onSelect(c.id)}
                onOpenTab={(tab) => onOpenTab(c.id, tab)}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Quick filters bar ────────────────────────────────────────────────────────

interface ActiveFilters {
  search: string;
  status: string;        // pipeline status
  journey: string;       // journey stage (mês exato)
  ltRange: string;       // "0-6" | "7-12" | "13-18" | "19+"
  team: string;          // team_name (squad)
  segment: string;
  product: string;       // product name
  category: string;      // product category id
  situation: string;     // situation_color
  onlyActiveProject: boolean;
  cohortMonth: string;   // legado — mantido para compatibilidade
  cohortFrom: string;    // "YYYY-MM" início do range de safra
  cohortTo: string;      // "YYYY-MM" fim do range de safra
}

const EMPTY_FILTERS: ActiveFilters = {
  search: "", status: "active", journey: "", ltRange: "", team: "", segment: "",
  product: "", category: "", situation: "", onlyActiveProject: false,
  cohortMonth: "", cohortFrom: "", cohortTo: "",
};

/** Extrai o número de meses a partir de journey_stage ("month_07" → 7, "onboarding" → 0) */
function ltMonths(journeyStage: string | null | undefined): number {
  if (!journeyStage || journeyStage === "onboarding") return 0;
  return parseInt(journeyStage.replace("month_", ""), 10) || 0;
}

const LT_RANGES = [
  { id: "0-6",   label: "LT até 6",  min: 0,  max: 6  },
  { id: "7-12",  label: "LT 7–12",   min: 7,  max: 12 },
  { id: "13-18", label: "LT 13–18",  min: 13, max: 18 },
  { id: "19+",   label: "LT 19+",    min: 19, max: Infinity },
];

// ─── Quick Filters Panel (selects + search + métricas resumo) ────────────────

function QuickFiltersPanel({
  filters,
  onChange,
  clients,
}: {
  filters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  clients: Client[];
}) {
  const teams = [...new Set(clients.map((c) => c.team_name).filter(Boolean))] as string[];

  // Metrics computed from the same filter logic as the main page
  const metricClients = clients.filter((c) => {
    if (filters.status === "active") {
      if (c.status !== "active" && c.status !== "at_risk" && c.status !== "upsell") return false;
    } else if (filters.status === "churned") {
      if (c.status !== "churned") return false;
    }
    if (filters.team && c.team_name !== filters.team) return false;
    if (filters.category) {
      const cat = getCategoryForProduct(c.main_product ?? "");
      if (!cat || cat.id !== filters.category) return false;
    }
    if (c.operation_start_date) {
      const m = c.operation_start_date.slice(0, 7);
      if (filters.cohortFrom && m < filters.cohortFrom) return false;
      if (filters.cohortTo   && m > filters.cohortTo)   return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.contact_name ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalMrr   = metricClients.reduce((s, c) => s + (c.mrr ?? 0), 0);
  const totalLtv   = metricClients.reduce((s, c) => s + estimateLtvMargin(c), 0);
  const avgLt      = metricClients.length
    ? Math.round(metricClients.reduce((s, c) => s + ltMonths(c.journey_stage), 0) / metricClients.length)
    : 0;
  const npsClients = metricClients.filter((c) => c.nps !== null && c.nps !== undefined);
  const avgNps     = npsClients.length
    ? Math.round(npsClients.reduce((s, c) => s + (c.nps ?? 0), 0) / npsClients.length)
    : null;

  const selectCls = "h-11 px-4 rounded-2xl border border-border/50 bg-background shadow-sm text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all pr-9 w-full";
  const monthInputCls = "h-11 px-4 rounded-2xl border border-border/50 bg-background shadow-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all w-full cursor-pointer";

  function clearSafra() {
    onChange({ ...filters, cohortFrom: "", cohortTo: "", cohortMonth: "" });
  }

  const hasRangeActive = !!(filters.cohortFrom || filters.cohortTo);

  const safras = [...new Set(
    clients.map((c) => c.operation_start_date?.slice(0, 7)).filter(Boolean)
  )].sort() as string[];

  function formatSafra(ym: string) {
    return new Date(ym + "-02").toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
  }

  return (
    <div className="flex flex-col gap-4 flex-shrink-0">

      {/* 4 selects */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 items-end">

        {/* Squad */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground px-1">Squad</label>
          <div className="relative">
            <select
              value={filters.team}
              onChange={(e) => onChange({ ...filters, team: e.target.value })}
              className={selectCls}
            >
              <option value="">Todos os squads</option>
              {teams.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Categoria de Produto */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground px-1">Categoria de Produto</label>
          <div className="relative">
            <select
              value={filters.category}
              onChange={(e) => onChange({ ...filters, category: e.target.value, product: "" })}
              className={selectCls}
            >
              <option value="">Todas as categorias</option>
              {PRODUCT_CATALOG.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Safra */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground px-1">
            Safra
            {(filters.cohortFrom || filters.cohortTo) && (
              <button
                onClick={clearSafra}
                className="ml-2 text-[10px] text-primary hover:underline font-normal"
              >
                limpar
              </button>
            )}
          </label>
          <div className={`rounded-2xl border bg-background shadow-sm px-3 h-11 flex items-center gap-2 transition-colors ${
            (filters.cohortFrom || filters.cohortTo) ? "border-primary/40" : "border-border/50"
          }`}>
            <Calendar size={13} className="text-muted-foreground flex-shrink-0" />
            <input
              type="month"
              value={filters.cohortFrom}
              onChange={(e) => onChange({ ...filters, cohortFrom: e.target.value, cohortMonth: "" })}
              placeholder="Início"
              className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none cursor-pointer text-foreground"
            />
            <span className="text-xs text-muted-foreground flex-shrink-0">—</span>
            <input
              type="month"
              value={filters.cohortTo}
              onChange={(e) => onChange({ ...filters, cohortTo: e.target.value, cohortMonth: "" })}
              placeholder="Fim"
              className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none cursor-pointer text-foreground"
            />
          </div>
        </div>

        {/* Clientes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted-foreground px-1">Clientes</label>
          <div className="relative">
            <select
              value={filters.status}
              onChange={(e) => onChange({ ...filters, status: e.target.value })}
              className={selectCls}
            >
              <option value="">Todos</option>
              <option value="active">Ativos</option>
              <option value="churned">Inativos</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Métricas resumo */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Receita</span>
          <span className="text-2xl font-bold tracking-tight">{formatCurrency(totalMrr)}</span>
          <span className="text-[11px] text-muted-foreground/60">{metricClients.length} clientes</span>
        </div>
        <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">LT Médio</span>
          <span className="text-2xl font-bold tracking-tight">{avgLt} <span className="text-sm font-normal text-muted-foreground">meses</span></span>
          <span className="text-[11px] text-muted-foreground/60">tempo médio de vida</span>
        </div>
        <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">LTV (margem)</span>
          <span className="text-2xl font-bold tracking-tight">{formatCurrency(totalLtv)}</span>
          <span className="text-[11px] text-muted-foreground/60">margem acumulada estimada</span>
        </div>
        <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">NPS Médio</span>
          <span className="text-2xl font-bold tracking-tight" style={{ color: getNpsColor(avgNps) }}>
            {avgNps !== null ? avgNps : "—"}
          </span>
          <span className="text-[11px] text-muted-foreground/60">{npsClients.length} respostas</span>
        </div>
      </div>

      {/* Search + toggle inativos */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
          <input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Pesquisar cliente..."
            className="h-11 rounded-2xl border border-border/50 bg-background shadow-sm pl-9 pr-4 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
          />
          {filters.search && (
            <button onClick={() => onChange({ ...filters, search: "" })} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        {/* Toggle inativos/churned */}
        <button
          onClick={() => onChange({ ...filters, status: filters.status === "churned" ? "active" : "churned" })}
          className={`flex items-center gap-1.5 h-11 px-3 rounded-2xl border text-xs font-medium transition-all flex-shrink-0 ${
            filters.status === "churned"
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border/80"
          }`}
          title={filters.status === "churned" ? "Ver apenas ativos" : "Ver inativos/churned"}
        >
          {filters.status === "churned" ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          Inativos
        </button>
      </div>

    </div>
  );
}

function FilterBar({
  filters, onChange, clients,
}: {
  filters: ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  clients: Client[];
}) {
  const teams = [...new Set(clients.map((c) => c.team_name).filter(Boolean))] as string[];

  const hasActive = Object.entries(filters).some(([k, v]) =>
    k === "onlyActiveProject" ? v === true : v !== ""
  );

  function toggleTeam(t: string) {
    onChange({ ...filters, team: filters.team === t ? "" : t });
  }

  // Shared pill style — light card look
  const pill = (active: boolean, activeExtra?: string) =>
    `h-9 px-4 rounded-2xl text-sm font-medium transition-all border flex items-center gap-2 shadow-sm select-none cursor-pointer ${
      active
        ? `bg-foreground text-background border-foreground ${activeExtra ?? ""}`
        : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
    }`;

  const colorPill = (active: boolean, color: string) =>
    `h-9 px-4 rounded-2xl text-sm font-medium transition-all border flex items-center gap-2 shadow-sm select-none cursor-pointer ${
      active
        ? "border-transparent text-white"
        : "bg-background border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
    }`;

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Row 1 — Search + Squad */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Pesquisa */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
          <input
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Pesquisar cliente..."
            className="h-9 rounded-2xl border border-border/50 bg-background shadow-sm pl-9 pr-3 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 focus:w-64 transition-all placeholder:text-muted-foreground/50"
          />
          {filters.search && (
            <button onClick={() => onChange({ ...filters, search: "" })} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Squad */}
        {teams.map((t) => (
          <button key={t} onClick={() => toggleTeam(t)} className={pill(filters.team === t)}>
            <UserCheck size={13} />
            {t}
          </button>
        ))}
      </div>

      {/* Row 2 — Categoria, Safra, Projeto ativo, LT */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Categoria de Produto */}
        {PRODUCT_CATALOG.map((cat) => {
          const active = filters.category === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onChange({ ...filters, category: active ? "" : cat.id, product: "" })}
              className={colorPill(active, cat.color)}
              style={active ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
            >
              <span className="text-base leading-none">{cat.icon}</span>
              {cat.label}
            </button>
          );
        })}

        {/* Safra — native month picker */}
        <div className="relative flex items-center">
          <label
            htmlFor="cohort-month-picker"
            className={pill(!!filters.cohortMonth)}
            style={{ cursor: "pointer" }}
          >
            <Calendar size={13} />
            {filters.cohortMonth
              ? new Date(filters.cohortMonth + "-02").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
              : "Safra"}
            {filters.cohortMonth && (
              <span
                role="button"
                onClick={(e) => { e.preventDefault(); onChange({ ...filters, cohortMonth: "" }); }}
                className="ml-0.5 opacity-60 hover:opacity-100"
              >
                <X size={10} />
              </span>
            )}
          </label>
          <input
            id="cohort-month-picker"
            type="month"
            value={filters.cohortMonth}
            onChange={(e) => onChange({ ...filters, cohortMonth: e.target.value })}
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
          />
        </div>

        {/* Projeto ativo */}
        <button
          onClick={() => onChange({ ...filters, onlyActiveProject: !filters.onlyActiveProject })}
          className={pill(filters.onlyActiveProject)}
        >
          <Briefcase size={13} />
          Projeto ativo
        </button>

        {/* Separador */}
        <div className="w-px h-5 bg-border/50 mx-1" />

        {/* LT range */}
        {LT_RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => onChange({ ...filters, ltRange: filters.ltRange === r.id ? "" : r.id, journey: "" })}
            className={pill(filters.ltRange === r.id)}
          >
            {r.label}
          </button>
        ))}

        {/* Limpar */}
        {hasActive && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-2xl border border-border/40 bg-background text-sm text-muted-foreground/60 hover:text-foreground hover:border-border shadow-sm transition-all"
          >
            <X size={12} />
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Product filter dropdown (grouped by category) ────────────────────────────

function ProductFilterDropdown({
  value, categoryFilter, onChange, onCategoryChange,
}: {
  value: string;
  categoryFilter: string;
  onChange: (v: string) => void;
  onCategoryChange: (cat: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const visibleCategories = categoryFilter
    ? PRODUCT_CATALOG.filter((c) => c.id === categoryFilter)
    : PRODUCT_CATALOG;

  const activeCategory = value ? getCategoryForProduct(value) : undefined;
  const activeCatFilter = PRODUCT_CATALOG.find((c) => c.id === categoryFilter);
  const displayLabel = value || (activeCatFilter ? activeCatFilter.label : "Filtrar por produto");
  const isActive = !!(value || categoryFilter);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
          isActive
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        <Package size={13} />
        <span className="truncate max-w-[120px]">{displayLabel}</span>
        <ChevronDown size={12} className="opacity-60 flex-shrink-0" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full mt-1 left-0 z-20 bg-card rounded-xl border border-border shadow-lg py-1 min-w-[220px]"
            >
              {(value || categoryFilter) && (
                <button
                  onClick={() => { onChange(""); onCategoryChange(""); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors border-b border-border"
                >
                  — Todos os produtos
                </button>
              )}
              {/* Category headers + products */}
              {visibleCategories.map((cat) => (
                <div key={cat.id}>
                  <button
                    onClick={() => { onCategoryChange(cat.id); onChange(""); setOpen(false); }}
                    className="w-full text-left px-3 pt-2.5 pb-1 text-xs font-bold uppercase tracking-wider hover:bg-secondary transition-colors"
                    style={{ color: cat.color }}
                  >
                    {cat.label}
                  </button>
                  {cat.products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { onChange(p.name); setOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        value === p.name
                          ? "font-medium bg-primary/5"
                          : "text-foreground hover:bg-secondary"
                      }`}
                      style={value === p.name ? { color: activeCategory?.color } : {}}
                    >
                      {p.name}
                    </button>
                  ))}
                  {cat.products.length === 0 && (
                    <p className="px-4 py-1.5 text-sm text-muted-foreground/50 italic">
                      Sem produtos cadastrados
                    </p>
                  )}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterDropdown({
  label, icon, value, options, onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = options.find((o) => o.value === value)?.label;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
          value
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-secondary"
        }`}
      >
        {icon}
        <span>{activeLabel || label}</span>
        <ChevronDown size={12} className="opacity-60" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute top-full mt-1 left-0 z-20 bg-card rounded-xl border border-border shadow-lg py-1 min-w-[160px]"
            >
              {value && (
                <button
                  onClick={() => { onChange(""); setOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-secondary transition-colors"
                >
                  — Todos
                </button>
              )}
              {options.map((o) => (
                <button
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    value === o.value ? "text-primary font-medium bg-primary/5" : "text-foreground hover:bg-secondary"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Client detail sidebar ────────────────────────────────────────────────────

type DetailTab = "overview" | "history" | "financial";

function ClientDetailSidebar({
  clientId, loadDetail, onClose, onAddInteraction, onUpdateClient, initialTab,
}: {
  clientId: string;
  loadDetail: (id: string) => Promise<ClientDetail | null>;
  onClose: () => void;
  onAddInteraction: (clientId: string, type: "meeting" | "email" | "call" | "delivery" | "feedback" | "note" | "upsell" | "contract" | "survey" | "onboarding", title: string, notes: string) => Promise<void>;
  onUpdateClient: (data: Partial<Client>) => Promise<unknown>;
  initialTab?: DetailTab;
}) {
  const [detail, setDetail]     = useState<ClientDetail | null>(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab]           = useState<DetailTab>(initialTab ?? "overview");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showChurnModal, setShowChurnModal] = useState(false);
  const [showEditModal, setShowEditModal]   = useState(false);

  const { financials, loading: finLoading, load: loadFin, upsert: saveFin, saving: savingFin, summary } =
    useClientFinancials(clientId);

  const gcal = useGoogleCalendar();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    setLoadError(null);
    setTab(initialTab ?? "overview");

    // Timeout de segurança: 10s
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoadError("Tempo limite excedido. Verifique a conexão e tente novamente.");
        setLoading(false);
      }
    }, 10000);

    loadDetail(clientId)
      .then((d) => {
        if (cancelled) return;
        clearTimeout(timeout);
        if (!d) setLoadError("Cliente não encontrado");
        setDetail(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        clearTimeout(timeout);
        console.error("loadDetail failed:", e);
        setLoadError((e as Error).message ?? "Erro ao carregar cliente");
        setLoading(false);
      });
    loadFin();
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [clientId]);

  async function submitNote() {
    if (!noteText.trim() || !detail) return;
    setAddingNote(true);
    await onAddInteraction(detail.id, "note", "Nota rápida", noteText);
    setNoteText("");
    const updated = await loadDetail(clientId);
    setDetail(updated);
    setAddingNote(false);
  }

  async function handleGCalSync() {
    if (!detail) return;
    await gcal.syncClientEvents(detail as Client);
    const updated = await loadDetail(clientId);
    setDetail(updated);
  }

  const sit = SITUATION_CONFIG[detail?.situation_color ?? "gray"] ?? SITUATION_CONFIG.gray;
  const journeyColor = getJourneyColor(detail?.journey_stage);

  const tabs: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview",  label: "Visão Geral", icon: <Users size={11} /> },
    { id: "history",   label: "Histórico",   icon: <Clock size={11} /> },
    { id: "financial", label: "Financeiro",  icon: <BarChart3 size={11} /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
    <motion.div
      initial={{ scale: 0.96, y: 12, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ scale: 0.96, y: 12, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="glass-strong rounded-2xl border border-border/40 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-border/30 flex-shrink-0">
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-4 w-32 bg-secondary/60 rounded animate-pulse" />
          ) : (
            <>
              <p className="font-semibold text-sm truncate">{detail?.name}</p>
              {/* Journey + situation inline */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {detail?.journey_stage && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: journeyColor, backgroundColor: `${journeyColor}20` }}
                  >
                    {getJourneyLabel(detail.journey_stage)}
                  </span>
                )}
                {detail?.main_product && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Package size={9} />
                    {detail.main_product}
                  </span>
                )}
                {detail?.team_name && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <UserCheck size={9} />
                    {detail.team_name}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
          {detail && !loading && (
            <button
              onClick={() => setShowEditModal(true)}
              className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
              title="Editar dados do cliente"
            >
              <Pencil size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle size={28} className="text-red-400 opacity-70" />
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <button
            onClick={() => {
              setLoading(true);
              setLoadError(null);
              loadDetail(clientId)
                .then((d) => { setDetail(d); setLoading(false); })
                .catch((e) => { setLoadError((e as Error).message ?? "Erro"); setLoading(false); });
            }}
            className="text-xs px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      ) : detail ? (
        <>
          {/* Tabs */}
          <div className="flex border-b border-border/30 flex-shrink-0">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-medium transition-colors ${
                  tab === t.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

            {/* ── Overview ── */}
            {tab === "overview" && (
              <>
                {/* Banner de dados incompletos */}
                {(() => {
                  const missing = getMissingData(detail);
                  if (missing.length === 0) return null;
                  return (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={12} className="text-red-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-red-400">Cadastro incompleto</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {missing.map((m) => (
                          <button
                            key={m.label}
                            onClick={() => setTab(m.tab)}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/25 text-red-300 hover:bg-red-500/25 transition-colors font-medium"
                          >
                            {m.label} →
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* KPI grid */}
                {(() => {
                  const margemEntregue = estimateLtvMargin(detail);
                  const margemPositiva = margemEntregue >= 0;
                  const kpis = [
                    { label: "MRR",   value: detail.mrr > 0 ? formatCurrency(detail.mrr) : "—",   icon: <DollarSign size={12} />, color: undefined },
                    { label: "LTV",   value: detail.ltv > 0 ? formatCurrency(detail.ltv) : "—",   icon: <TrendingUp size={12} />, color: undefined },
                    { label: "NPS",   value: detail.nps !== null ? String(detail.nps) : "—",       icon: <Star size={12} />,       color: detail.nps !== null ? getNpsColor(detail.nps) : undefined },
                    {
                      label: "Margem",
                      value: margemEntregue > 0 ? formatCurrency(margemEntregue) : "—",
                      icon: <TrendingUp size={12} />,
                      color: margemEntregue > 0 ? "#22c55e" : margemEntregue < 0 ? "#ef4444" : undefined,
                    },
                  ];
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {kpis.map((m) => (
                        <div key={m.label} className="p-2.5 rounded-xl bg-secondary/30 text-center">
                          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                            {m.icon}
                            <span className="text-xs">{m.label}</span>
                          </div>
                          <p className="text-sm font-bold" style={m.color ? { color: m.color } : undefined}>{m.value}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Journey progress bar */}
                {detail.journey_stage && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Jornada do cliente
                    </p>
                    <JourneyProgressBar current={detail.journey_stage} />
                    {detail.operation_start_date && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Início: {new Date(detail.operation_start_date).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                )}

                {/* ── Histórico de receita por projeto ── */}
                {(() => {
                  const projects: ClientProject[] = detail.projects ?? [];
                  if (projects.length === 0) return null;

                  const now = new Date();
                  // Data mais antiga entre os projetos para início do eixo
                  const earliest = projects.reduce<Date | null>((acc, p) => {
                    if (!p.start_date) return acc;
                    const d = new Date(p.start_date);
                    return acc === null || d < acc ? d : acc;
                  }, null) ?? new Date(detail.operation_start_date ?? now);

                  // Gerar lista de meses
                  const months: { key: string; label: string; date: Date }[] = [];
                  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
                  while (cursor <= now) {
                    months.push({
                      key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
                      label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
                      date: new Date(cursor),
                    });
                    cursor.setMonth(cursor.getMonth() + 1);
                  }

                  // Paleta de cores — uma cor por projeto
                  const PALETA = ["#22c55e","#8b5cf6","#f59e0b","#8b5cf6","#06b6d4","#ef4444","#ec4899"];
                  const projColor = (idx: number) => PALETA[idx % PALETA.length];

                  // Para cada mês, calcula receita de cada projeto
                  const monthData = months.map((m) => {
                    const mStart = new Date(m.date.getFullYear(), m.date.getMonth(), 1);
                    const mEnd   = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0);

                    const projAtivos = projects.map((p, idx) => {
                      if (!p.start_date) return { p, idx, receita: 0, ativo: false };
                      const ps = new Date(p.start_date);
                      const pe = p.end_date ? new Date(p.end_date) : null;
                      const isRecorrente = ACTIVE_MOMENTOS.includes(p.momento as Parameters<typeof ACTIVE_MOMENTOS["includes"]>[0]);

                      let ativo: boolean;
                      if (isRecorrente) {
                        // Recorrente: aparece em todos os meses entre start e end (ou até hoje)
                        ativo = ps <= mEnd && (!pe || pe >= mStart);
                      } else {
                        // One-time: aparece apenas no mês do start_date (pagamento único)
                        ativo = ps >= mStart && ps <= mEnd;
                      }

                      if (!ativo) return { p, idx, receita: 0, ativo: false };
                      const receita = p.mrr ?? 0;
                      return { p, idx, receita, ativo: true };
                    }).filter((x) => x.ativo && x.receita > 0);

                    const total = projAtivos.reduce((s, x) => s + x.receita, 0);
                    return { ...m, projAtivos, total };
                  });

                  const maxTotal = Math.max(...monthData.map((m) => m.total), 1);

                  // Separa por tipo de projeto
                  const ativos = projects.filter((p) => ACTIVE_MOMENTOS.includes(p.momento as never));
                  const encerrados = projects.filter((p) => !ACTIVE_MOMENTOS.includes(p.momento as never));

                  // Receita recorrente: projetos Executar ativos → mrr
                  const ativosExecutar = ativos.filter((p) => !p.step || p.step.toLowerCase() === "executar");
                  const receitaRecorrente = ativosExecutar.reduce((s, p) => s + (p.mrr ?? 0), 0);

                  // One-time ativo: Saber (EE) + Ter (investimento)
                  const ativosSaber = ativos.filter((p) => p.step?.toLowerCase() === "saber");
                  const ativosTer   = ativos.filter((p) => p.step?.toLowerCase() === "ter");
                  const receitaOnetimeAtivo =
                    ativosSaber.reduce((s, p) => s + (p.estruturacao_estrategica ?? p.mrr ?? 0), 0) +
                    ativosTer.reduce((s, p) => s + (p.investimento ?? p.mrr ?? 0), 0);

                  // One-time acumulado (encerrados)
                  const receitaOnetimeAcum =
                    encerrados.filter((p) => p.step?.toLowerCase() === "saber")
                      .reduce((s, p) => s + (p.estruturacao_estrategica ?? p.mrr ?? 0), 0) +
                    encerrados.filter((p) => p.step?.toLowerCase() === "ter")
                      .reduce((s, p) => s + (p.investimento ?? p.mrr ?? 0), 0) +
                    encerrados.filter((p) => !p.step || p.step.toLowerCase() === "executar")
                      .reduce((s, p) => s + (p.mrr ?? 0), 0);

                  return (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico de Receita</p>

                      {/* Resumo: recorrente vs one-time */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3 py-2">
                          <p className="text-[10px] text-emerald-400/80 font-medium">Recorrente ativo</p>
                          <p className="text-base font-bold text-emerald-400">{formatCurrency(receitaRecorrente)}<span className="text-[10px] font-normal text-emerald-400/60">/mês</span></p>
                          <p className="text-[9px] text-muted-foreground/50 mt-0.5">{ativosExecutar.length} projeto{ativosExecutar.length !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="rounded-xl bg-violet-500/8 border border-violet-500/20 px-3 py-2">
                          <p className="text-[10px] text-violet-400/80 font-medium">One-time ativo</p>
                          <p className="text-base font-bold text-violet-400">{formatCurrency(receitaOnetimeAtivo)}</p>
                          <p className="text-[9px] text-muted-foreground/50 mt-0.5">{ativosSaber.length + ativosTer.length} projeto{(ativosSaber.length + ativosTer.length) !== 1 ? "s" : ""} Saber/Ter</p>
                        </div>
                      </div>
                      {receitaOnetimeAcum > 0 && (
                        <div className="rounded-xl bg-secondary/30 border border-border/30 px-3 py-1.5 flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">One-time acumulado (encerrados)</p>
                          <p className="text-xs font-semibold text-muted-foreground">{formatCurrency(receitaOnetimeAcum)}</p>
                        </div>
                      )}

                      {/* Lista de projetos */}
                      <div className="space-y-1.5">
                        {projects.map((p, idx) => {
                          const isAtivo = ACTIVE_MOMENTOS.includes(p.momento as never);
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs rounded-lg px-2.5 py-2 bg-secondary/30">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projColor(idx) }} />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{p.name}</p>
                                  <p className="text-[9px] text-muted-foreground/60 truncate">
                                    {p.squad_name && `${p.squad_name} · `}{p.momento ?? "—"}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-3">
                                {(() => {
                                  const s = p.step?.toLowerCase();
                                  const isRecorrente = !s || s === "executar";
                                  const valor = s === "saber" ? (p.estruturacao_estrategica ?? p.mrr ?? 0)
                                    : s === "ter" ? (p.investimento ?? p.mrr ?? 0)
                                    : (p.mrr ?? 0);
                                  const label = isRecorrente ? "/mês" : " O.T.";
                                  return (
                                    <>
                                      <p className="font-semibold" style={{ color: isAtivo ? (isRecorrente ? "#22c55e" : "#a78bfa") : "#6b7280" }}>
                                        {formatCurrency(valor)}
                                        <span className="text-[9px] font-normal opacity-60">{label}</span>
                                      </p>
                                      <p className="text-[9px] text-muted-foreground/50">
                                        {isAtivo ? "● ativo" : "○ encerrado"}
                                      </p>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Gráfico de barras mês a mês */}
                      <div className="overflow-x-auto">
                        <div className="flex items-end gap-1" style={{ minWidth: months.length * 36 }}>
                          {monthData.map((m) => (
                            <div key={m.key} className="flex flex-col items-center gap-0.5 flex-shrink-0" style={{ width: 34 }}>
                              <div className="flex flex-col-reverse w-full" style={{ height: 56 }}>
                                {m.projAtivos.map(({ p, idx, receita }) => {
                                  const h = receita > 0 ? Math.max(4, Math.round((receita / maxTotal) * 56)) : 0;
                                  return (
                                    <div
                                      key={p.id}
                                      title={`${p.name}: ${formatCurrency(receita)}`}
                                      style={{ height: h, backgroundColor: projColor(idx), opacity: 0.85 }}
                                      className="w-full rounded-sm"
                                    />
                                  );
                                })}
                                {m.projAtivos.length === 0 && (
                                  <div className="w-full h-0.5 rounded-sm bg-border/20 self-end" />
                                )}
                              </div>
                              <span className="text-[8px] text-muted-foreground/50 leading-none">{m.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Contact */}
                {(detail.contact_name || detail.contact_email || detail.contact_phone) && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</p>
                    {detail.contact_name && (
                      <div className="flex items-center gap-2 text-xs">
                        <Users size={12} className="text-muted-foreground flex-shrink-0" />
                        <span>{detail.contact_name}</span>
                      </div>
                    )}
                    {detail.contact_email && (
                      <div className="flex items-center gap-2 text-xs">
                        <Mail size={12} className="text-muted-foreground flex-shrink-0" />
                        <a href={`mailto:${detail.contact_email}`} className="hover:text-primary transition-colors truncate">
                          {detail.contact_email}
                        </a>
                      </div>
                    )}
                    {detail.contact_phone && (
                      <div className="flex items-center gap-2 text-xs">
                        <Phone size={12} className="text-muted-foreground flex-shrink-0" />
                        <span>{detail.contact_phone}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Products */}
                {(detail.contracted_products ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Produtos ativos</p>
                    {(detail.contracted_products ?? []).map((p) => (
                      <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-secondary/30 text-xs">
                        <span className="font-medium truncate">{p.product}</span>
                        {p.value && <span className="text-muted-foreground flex-shrink-0 ml-2">{formatCurrency(p.value)}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Churn — 3 datas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ciclo de saída</p>
                    <button
                      onClick={() => setShowChurnModal(true)}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-border/40 text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition-colors"
                    >
                      <AlertTriangle size={9} />
                      {detail.status === "churned" ? "Ver/editar" : "Registrar churn"}
                    </button>
                  </div>

                  {(detail.aviso_previo_date || detail.ultimo_dia_servico || detail.churn_date) ? (
                    <div className="space-y-1.5">
                      {detail.aviso_previo_date && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                          <span className="text-amber-400 font-medium w-28 flex-shrink-0">Aviso prévio</span>
                          <span className="text-muted-foreground">{new Date(detail.aviso_previo_date).toLocaleDateString("pt-BR")}</span>
                        </div>
                      )}
                      {detail.ultimo_dia_servico && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                          <span className="text-red-400 font-medium w-28 flex-shrink-0">Último serviço</span>
                          <span className="text-muted-foreground">{new Date(detail.ultimo_dia_servico).toLocaleDateString("pt-BR")}</span>
                        </div>
                      )}
                      {detail.churn_date && (
                        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/40 border border-border/30 text-xs">
                          <span className="text-muted-foreground font-medium w-28 flex-shrink-0">Churn financeiro</span>
                          <span className="text-muted-foreground">{new Date(detail.churn_date).toLocaleDateString("pt-BR")}</span>
                        </div>
                      )}
                      {detail.financial_churn && (
                        <div className="flex items-center gap-1.5 text-[10px] text-red-400 px-1">
                          <AlertTriangle size={9} />
                          Churn financeiro no mês 1 — CAC redistribuído na safra
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-muted-foreground/40 px-1">Nenhuma data de saída registrada</p>
                  )}
                </div>

                {/* Documentos */}
                {(detail.contrato_url || detail.roi_url || detail.sales_call_url) && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documentos</p>
                    {detail.contrato_url && (
                      <a
                        href={detail.contrato_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs group"
                      >
                        <FileText size={12} className="text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 font-medium">Contrato assinado</span>
                        <Briefcase size={10} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </a>
                    )}
                    {detail.roi_url && (
                      <a
                        href={detail.roi_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs group"
                      >
                        <BarChart3 size={12} className="text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 font-medium">Plano de ROI</span>
                        <Briefcase size={10} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </a>
                    )}
                    {detail.sales_call_url && (
                      <a
                        href={detail.sales_call_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs group"
                      >
                        <Phone size={12} className="text-muted-foreground flex-shrink-0" />
                        <span className="flex-1 font-medium">Call de vendas</span>
                        <Briefcase size={10} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </a>
                    )}
                  </div>
                )}

                {/* Team members */}
                {(detail.team_members ?? []).length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</p>
                    {(detail.team_members ?? []).map((m) => (
                      <div key={m.user_id} className="flex items-center gap-2 text-xs">
                        {m.user?.avatar_url ? (
                          <img src={m.user.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                            <span className="text-[9px]">{(m.user?.name ?? "?")[0]}</span>
                          </div>
                        )}
                        <span className="flex-1 truncate">{m.user?.name ?? m.user_id}</span>
                        <span className="text-muted-foreground/60 capitalize">{m.role}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── History ── */}
            {tab === "history" && (
              <>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleGCalSync}
                    disabled={gcal.syncing || !detail.contact_email}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass border border-border/50 text-xs font-medium hover:border-primary/30 disabled:opacity-50 transition-all"
                    title={!detail.contact_email ? "Cliente sem e-mail de contato" : "Sincronizar do Google Agenda"}
                  >
                    {gcal.syncing ? (
                      <RefreshCw size={12} className="animate-spin text-primary" />
                    ) : gcal.isConnected ? (
                      <Calendar size={12} className="text-green-400" />
                    ) : (
                      <Calendar size={12} className="text-muted-foreground" />
                    )}
                    {gcal.syncing ? "Sincronizando…" : "Sincronizar Agenda"}
                  </button>
                  {gcal.syncResult && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle2 size={11} />
                      +{gcal.syncResult.added} reuniões
                    </span>
                  )}
                </div>
                {gcal.error && (
                  <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{gcal.error}</p>
                )}
                {(detail.interactions ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhuma interação registrada</p>
                ) : (
                  <div className="space-y-2">
                    {(detail.interactions ?? []).map((interaction) => {
                      const isGcal = !!interaction.google_event_id;
                      return (
                        <div key={interaction.id} className="flex gap-2.5">
                          <div className="w-0.5 bg-border/30 rounded-full mt-1 flex-shrink-0 ml-1" />
                          <div className="flex-1 pb-2">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-medium">{interaction.title}</p>
                              {isGcal && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">
                                  Google Meet
                                </span>
                              )}
                            </div>
                            {interaction.notes && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{interaction.notes}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground/50">{timeAgo(interaction.happened_at)}</span>
                              {interaction.author && (
                                <span className="text-xs text-muted-foreground/50">· {interaction.author.name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── Financial ── */}
            {tab === "financial" && (
              <>
                {/* ── Painel: Margem de Contribuição Entregue ── */}
                {(() => {
                  const allProjects = detail.projects ?? [];
                  const hasFinancials = financials.length > 0;

                  // Projetos ativos (recorrente) vs encerrados (one-time)
                  const projAtivos = allProjects.filter((p) =>
                    ACTIVE_MOMENTOS.includes(p.momento as Parameters<typeof ACTIVE_MOMENTOS["includes"]>[0])
                  );
                  const projEncerrados = allProjects.filter((p) =>
                    !ACTIVE_MOMENTOS.includes(p.momento as Parameters<typeof ACTIVE_MOMENTOS["includes"]>[0])
                  );

                  // Receita recorrente: projetos ativos acumulados (mrr × meses ativos)
                  const receitaRecorrente = projAtivos.reduce((s, p) => {
                    const meses = p.start_date
                      ? Math.max(1, Math.round((new Date().getTime() - new Date(p.start_date).getTime()) / (30.44 * 86_400_000)))
                      : 1;
                    return s + (p.mrr ?? 0) * meses;
                  }, 0);

                  // One-time: cliente paga uma vez — mrr já é o valor total do contrato, não multiplica por meses
                  const receitaOnetime = projEncerrados.reduce((s, p) => s + (p.mrr ?? 0), 0);

                  // Receita bruta total: financials se disponível, senão projetos
                  const receitaBruta = hasFinancials
                    ? financials.reduce((s, f) => s + (f.mrr ?? 0), 0)
                    : receitaRecorrente + receitaOnetime;

                  // CAC total
                  const cacTotal = hasFinancials
                    ? financials.reduce((s, f) => s + (f.cac ?? 0), 0)
                    : 0;

                  const margemLiquida = receitaBruta - cacTotal;
                  const margemPct = receitaBruta > 0 ? (margemLiquida / receitaBruta) * 100 : 0;
                  const isPositive = margemLiquida >= 0;
                  const hasProjects = allProjects.length > 0;

                  return (
                    <div className="rounded-2xl border border-border/50 bg-background/60 overflow-hidden">
                      {/* Header */}
                      <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold">Margem de Contribuição Entregue</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {hasFinancials ? "Baseado nos lançamentos financeiros" : hasProjects ? "Calculado pelos projetos do cliente" : "Estimativa por produto principal"}
                          </p>
                        </div>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                          style={{
                            color: isPositive ? "#22c55e" : "#ef4444",
                            backgroundColor: isPositive ? "#22c55e18" : "#ef444418",
                          }}
                        >
                          {isPositive ? "Positiva" : "Negativa"}
                        </span>
                      </div>

                      {/* KPIs grid */}
                      <div className="grid grid-cols-2 gap-px bg-border/20">
                        <div className="bg-background/80 px-4 py-3">
                          <p className="text-[10px] text-muted-foreground">Receita bruta acumulada</p>
                          <p className="text-lg font-bold tracking-tight mt-0.5">{formatCurrency(receitaBruta)}</p>
                          {!hasFinancials && hasProjects && (
                            <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                              rec. {formatCurrency(receitaRecorrente)} · 1x {formatCurrency(receitaOnetime)}
                            </p>
                          )}
                        </div>
                        <div className="bg-background/80 px-4 py-3 border border-transparent" style={{ borderColor: isPositive ? "#22c55e30" : "#ef444430", borderWidth: 1 }}>
                          <p className="text-[10px] text-muted-foreground">Receita líquida</p>
                          <p className="text-lg font-bold tracking-tight mt-0.5" style={{ color: isPositive ? "#22c55e" : "#ef4444" }}>
                            {formatCurrency(margemLiquida)}
                          </p>
                          <p className="text-[9px] mt-0.5" style={{ color: isPositive ? "#22c55e80" : "#ef444480" }}>
                            {margemPct.toFixed(1)}% sobre receita
                          </p>
                        </div>
                      </div>

                      {/* Stack de projetos */}
                      {hasProjects && (
                        <div className="px-4 py-3 border-t border-border/30 space-y-2">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Projetos</p>
                          {allProjects.map((p) => {
                            const isAtivo = ACTIVE_MOMENTOS.includes(p.momento as Parameters<typeof ACTIVE_MOMENTOS["includes"]>[0]);
                            const end = p.end_date ? new Date(p.end_date) : new Date();
                            const meses = p.start_date
                              ? Math.max(1, Math.round((isAtivo ? new Date() : end).getTime() - new Date(p.start_date).getTime()) / (30.44 * 86_400_000))
                              : 1;
                            // Recorrente acumula por meses; one-time mrr já é o valor total do contrato
                            const receita = isAtivo ? (p.mrr ?? 0) * meses : (p.mrr ?? 0);
                            const margem = p.margem_bruta != null ? p.margem_bruta / 100 : getProductMargin(undefined);
                            const margemProjeto = receita * margem;
                            return (
                              <div key={p.id} className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: isAtivo ? "#22c55e" : "#06b6d4" }}
                                  />
                                  <span className="truncate text-[11px]">{p.name}</span>
                                  <span className="text-[9px] text-muted-foreground/50 flex-shrink-0">
                                    {isAtivo ? `rec. ${meses}m` : "one-time"}
                                  </span>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                  <span className="text-[11px] font-medium" style={{ color: isAtivo ? "#22c55e" : "#06b6d4" }}>
                                    {formatCurrency(margemProjeto)}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/50 ml-1">margem</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Aviso MRR não configurado */}
                {!(detail.mrr > 0) && !finLoading && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-3 flex items-start gap-2">
                    <AlertTriangle size={12} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-red-400">MRR não configurado</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Lance o primeiro mês financeiro abaixo para registrar o MRR do cliente.</p>
                    </div>
                  </div>
                )}

                {finLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </div>
                ) : (
                  <>
                    {summary && (
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo financeiro</p>
                        <FinancialSummary summary={summary} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mapa de receita e margem</p>
                      <RevenueMap financials={financials} />
                    </div>
                    <div className="space-y-2 pt-2 border-t border-border/30">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lançar mês</p>
                      <FinancialEntryForm
                        clientId={clientId}
                        members={detail.team_members ?? []}
                        onSave={saveFin}
                        saving={savingFin}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Quick note — not on financial tab */}
          {tab !== "financial" && (
            <div className="border-t border-border/30 p-3 flex-shrink-0">
              <div className="flex gap-2">
                <input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitNote()}
                  placeholder="Nota rápida..."
                  className="flex-1 glass rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                />
                <button
                  onClick={submitNote}
                  disabled={!noteText.trim() || addingNote}
                  className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  {addingNote ? "..." : "↵"}
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Edit client modal */}
      <AnimatePresence>
        {showEditModal && detail && (
          <EditClientModal
            client={detail}
            onSave={async (data) => {
              await onUpdateClient(data);
              const updated = await loadDetail(clientId);
              setDetail(updated);
              setShowEditModal(false);
            }}
            onClose={() => setShowEditModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Churn modal — rendered inside sidebar context */}
      <AnimatePresence>
        {showChurnModal && detail && (
          <ChurnModal
            client={detail}
            onSave={async (data) => {
              await onUpdateClient(data);
              const updated = await loadDetail(clientId);
              setDetail(updated);
            }}
            onClose={() => setShowChurnModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
    </motion.div>
  );
}

// ─── Product inline picker (sidebar compact version) ─────────────────────────
//
// Shows current product as a colored badge with an edit button.
// On edit: category pills → product list, compact style.

function ProductInlinePicker({
  value, onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [catId, setCatId] = useState<string | null>(
    () => (value ? (getCategoryForProduct(value)?.id ?? null) : null),
  );
  const activeCat = getCategoryForProduct(value);

  function selectProduct(name: string) {
    onSave(name);
    setEditing(false);
    setCatId(null);
  }

  function clear() {
    onSave("");
    setEditing(false);
    setCatId(null);
  }

  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-muted-foreground w-20 flex items-center gap-1 pt-1">
        <Package size={10} />Produto
      </span>
      <div className="flex-1">
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="w-full text-left px-2 py-1 rounded-lg hover:bg-secondary/60 transition-colors"
          >
            {value ? (
              <span
                className="text-xs font-medium"
                style={{ color: activeCat?.color ?? "#6b7280" }}
              >
                {activeCat?.icon} {value}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground/40">— clicar para editar</span>
            )}
          </button>
        ) : (
          <div className="space-y-1.5">
            {/* Category pills */}
            <div className="flex flex-wrap gap-1">
              {PRODUCT_CATALOG.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCatId(cat.id === catId ? null : cat.id)}
                  className="text-[10px] px-2 py-0.5 rounded-full transition-all"
                  style={
                    catId === cat.id
                      ? { backgroundColor: cat.color, color: "#fff" }
                      : { backgroundColor: `${cat.color}18`, color: cat.color }
                  }
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            {/* Products */}
            {catId && (
              <div className="rounded-lg border border-border/30 overflow-hidden">
                {PRODUCT_CATALOG.find((c) => c.id === catId)?.products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p.name)}
                    className="w-full text-left text-[10px] px-2.5 py-1.5 hover:bg-secondary/60 transition-colors border-b border-border/20 last:border-0"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
            {/* Actions */}
            <div className="flex gap-1">
              {value && (
                <button
                  onClick={clear}
                  className="text-[10px] text-red-400 hover:text-red-300 px-1"
                >
                  Remover
                </button>
              )}
              <button
                onClick={() => { setEditing(false); setCatId(null); }}
                className="text-[10px] text-muted-foreground hover:text-foreground px-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Journey progress bar ─────────────────────────────────────────────────────

function JourneyProgressBar({ current }: { current: string }) {
  const anchors = ["onboarding", "month_03", "month_06", "month_12", "month_18", "month_24"];
  const allIds  = ALL_JOURNEY_STAGES.map((s) => s.id);
  const currentIdx = allIds.indexOf(current);
  const totalIdx   = allIds.length - 1;
  const pct = totalIdx > 0 ? Math.round((currentIdx / totalIdx) * 100) : 0;
  const color = "#22c55e"; // Verde fixo para barra de jornada

  return (
    <div>
      <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
        {anchors.map((a) => {
          const label = a === "onboarding" ? "ON" : a.replace("month_", "M");
          const idx = allIds.indexOf(a);
          const isPast = idx <= currentIdx;
          return (
            <span key={a} style={isPast ? { color } : {}}>{label}</span>
          );
        })}
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">
        {getJourneyLabel(current)} · {pct}% da jornada
      </p>
    </div>
  );
}

// ─── Inline editable field ────────────────────────────────────────────────────

function InlineField({
  label, icon, value, onSave,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20 flex items-center gap-1">
        {icon}{label}
      </span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          className="flex-1 bg-secondary/60 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      ) : (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="flex-1 text-left text-xs px-2 py-1 rounded-lg hover:bg-secondary/60 transition-colors"
        >
          {value || <span className="text-muted-foreground/40">— clicar para editar</span>}
        </button>
      )}
    </div>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ clients }: { clients: Client[] }) {
  const active   = clients.filter((c) => c.status === "active");
  const atRisk   = clients.filter((c) => c.status === "at_risk");
  const totalMrr = clients.reduce((sum, c) => sum + (c.mrr ?? 0), 0);
  const totalLtv = clients.reduce((sum, c) => sum + (c.ltv ?? 0), 0);
  const npsArr   = clients.filter((c) => c.nps !== null);
  const avgNps   = npsArr.length
    ? Math.round(npsArr.reduce((s, c) => s + (c.nps ?? 0), 0) / npsArr.length)
    : null;

  const stats = [
    { label: "MRR Total",       value: formatCurrency(totalMrr), icon: <DollarSign size={14} />, color: "#22c55e" },
    { label: "LTV Total",       value: formatCurrency(totalLtv), icon: <TrendingUp size={14} />,  color: "#8b5cf6" },
    { label: "Clientes Ativos", value: active.length,            icon: <Users size={14} />,       color: "#22c55e" },
    { label: "Em Risco",        value: atRisk.length,            icon: <AlertTriangle size={14} />, color: "#f59e0b" },
    { label: "NPS Médio",       value: avgNps ?? "—",            icon: <Star size={14} />,        color: avgNps !== null ? getNpsColor(avgNps) : "#6b7280" },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {stats.map((s) => (
        <div
          key={s.label}
          className="glass rounded-xl border border-border/30 px-3 py-2 flex items-center gap-2 flex-shrink-0"
        >
          <div className="p-1 rounded-lg" style={{ backgroundColor: `${s.color}22`, color: s.color }}>
            {s.icon}
          </div>
          <div>
            <p className="text-base font-bold leading-tight">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Product category picker ──────────────────────────────────────────────────
//
// Step 1: choose category (color pills)
// Step 2: choose product within that category (list)
// Shows current selection above; clears back to step 1 if user clicks the badge.

function ProductCategoryPicker({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [selectedCat, setSelectedCat] = useState<ProductCategory | null>(
    () => (value ? (getCategoryForProduct(value) ?? null) : null),
  );

  function pickCategory(cat: ProductCategory) {
    setSelectedCat(cat);
    onChange(""); // clear product when switching category
  }

  function pickProduct(name: string) {
    onChange(name);
  }

  function clear() {
    setSelectedCat(null);
    onChange("");
  }

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground block">Produto principal</label>

      {/* Current selection badge */}
      {value && (
        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
            style={{
              color: selectedCat?.color ?? "#6b7280",
              backgroundColor: `${selectedCat?.color ?? "#6b7280"}18`,
            }}
          >
            {selectedCat?.icon} {value}
          </span>
          <button
            onClick={clear}
            className="text-muted-foreground/50 hover:text-foreground"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Category pills */}
      {!value && (
        <div className="flex flex-wrap gap-1.5">
          {PRODUCT_CATALOG.map((cat) => (
            <button
              key={cat.id}
              onClick={() => pickCategory(cat)}
              className="text-xs px-2.5 py-1 rounded-full font-medium transition-all"
              style={
                selectedCat?.id === cat.id
                  ? { backgroundColor: cat.color, color: "#fff" }
                  : { backgroundColor: `${cat.color}18`, color: cat.color }
              }
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Product list within selected category */}
      {!value && selectedCat && (
        <div className="rounded-xl border border-border/40 overflow-hidden">
          {selectedCat.products.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 text-center py-3 italic">
              Nenhum produto nesta categoria
            </p>
          ) : (
            selectedCat.products.map((p) => (
              <button
                key={p.id}
                onClick={() => pickProduct(p.name)}
                className="w-full text-left text-xs px-3 py-2 hover:bg-secondary/60 transition-colors border-b border-border/20 last:border-0"
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Edit Client Modal ────────────────────────────────────────────────────────

function EditClientModal({
  client, onSave, onClose,
}: {
  client: Client;
  onSave: (data: Partial<Client>) => Promise<void>;
  onClose: () => void;
}) {
  type EditTab = "empresa" | "contato" | "financeiro";
  const [tab, setTab] = useState<EditTab>("empresa");
  const [form, setForm] = useState<Partial<Client>>({
    name:                   client.name,
    cnpj:                   client.cnpj ?? "",
    razao_social:           client.razao_social ?? "",
    cidade:                 client.cidade ?? "",
    estado:                 client.estado ?? "",
    segment:                client.segment ?? "",
    operation_start_date:   client.operation_start_date ?? "",
    main_product:           client.main_product ?? "",
    team_name:              client.team_name ?? "",
    contact_name:           client.contact_name ?? "",
    cargo:                  client.cargo ?? "",
    contact_email:          client.contact_email ?? "",
    telefone:               client.telefone ?? "",
    responsavel_financeiro: client.responsavel_financeiro ?? "",
    cargo_responsavel:      client.cargo_responsavel ?? "",
    email_faturamento:      client.email_faturamento ?? "",
    mrr:                    client.mrr ?? 0,
    nps:                    client.nps ?? null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  function setF<K extends keyof Client>(key: K, value: Client[K] | string | number | null) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.name?.trim()) { setTab("empresa"); setError("Nome da empresa é obrigatório"); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ id: client.id, ...form });
    } catch (e) {
      setError((e as Error).message ?? "Erro ao salvar");
      setSaving(false);
    }
  }

  const inp = "glass w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40";
  const lbl = "text-xs text-muted-foreground mb-1 block";

  const editTabs: { id: EditTab; label: string }[] = [
    { id: "empresa",    label: "Empresa" },
    { id: "contato",    label: "Contato" },
    { id: "financeiro", label: "Financeiro" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-strong rounded-2xl border border-border w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-sm">Editar cliente</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{client.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground">
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-1 flex-shrink-0">
          {editTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${tab === t.id ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</div>
          )}

          {tab === "empresa" && (
            <>
              <div>
                <label className={lbl}>Nome da empresa *</label>
                <input value={form.name ?? ""} onChange={(e) => setF("name", e.target.value)} className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>CNPJ</label>
                  <input value={form.cnpj ?? ""} onChange={(e) => setF("cnpj", e.target.value)} placeholder="00.000.000/0001-00" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Razão Social</label>
                  <input value={form.razao_social ?? ""} onChange={(e) => setF("razao_social", e.target.value)} className={inp} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Cidade</label>
                  <input value={form.cidade ?? ""} onChange={(e) => setF("cidade", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Estado</label>
                  <input value={form.estado ?? ""} onChange={(e) => setF("estado", e.target.value)} placeholder="SP" className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>Segmento</label>
                <input value={form.segment ?? ""} onChange={(e) => setF("segment", e.target.value)} placeholder="Ex: Saúde, Educação" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Produto principal</label>
                  <input value={form.main_product ?? ""} onChange={(e) => setF("main_product", e.target.value)} placeholder="Ex: DR-X" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Time responsável</label>
                  <input value={form.team_name ?? ""} onChange={(e) => setF("team_name", e.target.value)} placeholder="Nome do squad" className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>Data de início da operação</label>
                <input type="date" value={form.operation_start_date ?? ""} onChange={(e) => setF("operation_start_date", e.target.value)} className={inp} />
              </div>
            </>
          )}

          {tab === "contato" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Nome do contato</label>
                  <input value={form.contact_name ?? ""} onChange={(e) => setF("contact_name", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Cargo</label>
                  <input value={form.cargo ?? ""} onChange={(e) => setF("cargo", e.target.value)} placeholder="CEO, Diretor..." className={inp} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>E-mail</label>
                  <input type="email" value={form.contact_email ?? ""} onChange={(e) => setF("contact_email", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>WhatsApp / Telefone</label>
                  <input value={form.telefone ?? ""} onChange={(e) => setF("telefone", e.target.value)} placeholder="(11) 99999-9999" className={inp} />
                </div>
              </div>
              <div className="pt-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Responsável Financeiro</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Nome</label>
                    <input value={form.responsavel_financeiro ?? ""} onChange={(e) => setF("responsavel_financeiro", e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Cargo</label>
                    <input value={form.cargo_responsavel ?? ""} onChange={(e) => setF("cargo_responsavel", e.target.value)} className={inp} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className={lbl}>E-mail de faturamento</label>
                  <input type="email" value={form.email_faturamento ?? ""} onChange={(e) => setF("email_faturamento", e.target.value)} className={inp} />
                </div>
              </div>
            </>
          )}

          {tab === "financeiro" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>MRR (R$)</label>
                  <input
                    type="number"
                    value={form.mrr ?? ""}
                    onChange={(e) => setF("mrr", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>NPS</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={form.nps ?? ""}
                    onChange={(e) => setF("nps", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                    placeholder="0–10"
                    className={inp}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-3 border-t border-border/30 flex-shrink-0">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Churn modal — 3 datas do ciclo de saída ──────────────────────────────────

function ChurnModal({
  client, onSave, onClose,
}: {
  client: Client;
  onSave: (data: Partial<Client>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    aviso_previo_date:  (client.aviso_previo_date  ?? "") as string,
    ultimo_dia_servico: (client.ultimo_dia_servico ?? "") as string,
    churn_date:         (client.churn_date         ?? "") as string,
    financial_churn:    client.financial_churn     ?? false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const payload: Partial<Client> = {
      id: client.id,
      aviso_previo_date:  form.aviso_previo_date  || null,
      ultimo_dia_servico: form.ultimo_dia_servico || null,
      churn_date:         form.churn_date         || null,
      financial_churn:    form.financial_churn,
    };
    // Se churn_date foi preenchido, atualiza status para churned
    if (form.churn_date) payload.status = "churned";
    await onSave(payload);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass rounded-2xl border border-border/40 w-full max-w-md p-6 space-y-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Registrar Churn</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{client.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground">
            <X size={14} />
          </button>
        </div>

        {/* Linha do tempo visual */}
        <div className="flex items-center gap-2 py-2">
          {[
            { label: "Aviso Prévio", color: "#f59e0b", filled: !!form.aviso_previo_date },
            { label: "Último Dia", color: "#ef4444", filled: !!form.ultimo_dia_servico },
            { label: "Churn Fin.", color: "#6b7280", filled: !!form.churn_date },
          ].map((step, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-3 h-3 rounded-full border-2 transition-all"
                style={{
                  borderColor: step.color,
                  backgroundColor: step.filled ? step.color : "transparent",
                }}
              />
              <span className="text-[9px] text-muted-foreground text-center leading-tight">{step.label}</span>
              {i < 2 && (
                <div className="absolute" style={{ marginLeft: "calc(33% + 6px)", width: "calc(33% - 12px)", height: "2px", backgroundColor: "#374151", marginTop: "5px" }} />
              )}
            </div>
          ))}
        </div>

        {/* Campos */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              📅 Data do aviso prévio
              <span className="ml-1 text-[10px] text-muted-foreground/50">— dia que o cliente comunicou a saída</span>
            </label>
            <input
              type="date"
              value={form.aviso_previo_date}
              onChange={(e) => setForm({ ...form, aviso_previo_date: e.target.value })}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 border border-border/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              🛑 Último dia de serviço
              <span className="ml-1 text-[10px] text-muted-foreground/50">— último dia que vamos trabalhar</span>
            </label>
            <input
              type="date"
              value={form.ultimo_dia_servico}
              onChange={(e) => setForm({ ...form, ultimo_dia_servico: e.target.value })}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 border border-border/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              💸 Data do churn financeiro
              <span className="ml-1 text-[10px] text-muted-foreground/50">— último pagamento recebido</span>
            </label>
            <input
              type="date"
              value={form.churn_date}
              onChange={(e) => setForm({ ...form, churn_date: e.target.value })}
              className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500/30 border border-border/30"
            />
          </div>

          {/* Churn financeiro no mês 1 */}
          <div
            onClick={() => setForm({ ...form, financial_churn: !form.financial_churn })}
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              form.financial_churn
                ? "border-red-500/40 bg-red-500/10"
                : "border-border/30 hover:border-border/60"
            }`}
          >
            <div className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-colors ${
              form.financial_churn ? "border-red-500 bg-red-500" : "border-muted-foreground/30"
            }`}>
              {form.financial_churn && <span className="text-white text-[9px] font-bold">✓</span>}
            </div>
            <div>
              <p className="text-xs font-medium">Churn financeiro no mês 1</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Marque se o cliente pagou menos de 1 mês completo. O CAC desta safra será redistribuído.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-border/40 text-sm text-muted-foreground hover:bg-secondary/60 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Confirmar churn"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── New client modal ─────────────────────────────────────────────────────────

type ClientFormTab = "empresa" | "contato" | "documentos";

function NewClientModal({
  onSave, onClose,
}: {
  onSave: (data: Partial<Client>) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<ClientFormTab>("empresa");
  const [form, setForm] = useState<Partial<Client>>({
    name: "",
    status: "active",
    journey_stage: "onboarding",
    situation_color: "green",
    operation_start_date: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [aiProcessing, setAiProcessing]   = useState(false);
  const [aiFileName, setAiFileName]       = useState<string | null>(null);
  const [contatoEhFinanceiro, setContatoEhFinanceiro] = useState(false);

  function toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  }

  async function handleAiUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiFileName(file.name);
    setAiProcessing(true);
    setError(null);
    try {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const pdf_base64 = btoa(binary);

      // Call edge function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/parse-client-contract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ pdf_base64 }),
      });

      const json = await res.json() as { success?: boolean; data?: Partial<Client>; error?: string };

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error ?? "Erro na extração");
      }

      // Filter out null values, normalize text strings to Title Case, apply to form
      const textFields = new Set(["name", "razao_social", "contact_name", "cidade", "cargo"]);
      const extracted = Object.fromEntries(
        Object.entries(json.data)
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => [k, textFields.has(k) && typeof v === "string" ? toTitleCase(v) : v])
      ) as Partial<Client>;

      if (Object.keys(extracted).length === 0) {
        setError("Não consegui identificar os dados do contratante neste arquivo.");
      } else {
        setForm((f) => ({ ...f, ...extracted }));
      }
    } catch (err) {
      setError((err as Error).message ?? "Erro ao processar o contrato.");
    } finally {
      setAiProcessing(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    if (!form.name?.trim()) { setTab("empresa"); setError("Nome da empresa é obrigatório"); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      onClose();
    } catch (e) {
      setError((e as Error).message ?? "Erro ao criar cliente");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof Client>(key: K, value: Client[K] | string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const inp = "glass w-full rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40";
  const lbl = "text-xs text-muted-foreground mb-1 block";

  const TABS: { id: ClientFormTab; label: string; icon: React.ReactNode }[] = [
    { id: "empresa",    label: "Empresa",    icon: <Building2 size={13} /> },
    { id: "contato",    label: "Contato",    icon: <Phone size={13} /> },
    { id: "documentos", label: "Documentos", icon: <FileText size={13} /> },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-strong rounded-2xl border border-border w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40 flex-shrink-0">
          <h3 className="font-semibold text-sm">Novo cliente</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>

        {/* ── Banner: IA preenche o cadastro ── */}
        <div className="px-5 pt-4 flex-shrink-0">
          <label className={`flex items-center gap-3 rounded-xl border cursor-pointer transition-colors select-none ${
            aiFileName
              ? "border-primary/40 bg-primary/6"
              : "border-border/50 bg-secondary/30 hover:border-primary/30 hover:bg-primary/4"
          }`}>
            <input
              type="file"
              accept=".pdf,.txt,.doc,.docx"
              className="hidden"
              onChange={handleAiUpload}
            />
            <div className={`ml-3 my-2.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              aiProcessing ? "bg-primary/15 animate-pulse" : aiFileName ? "bg-primary/15" : "bg-primary/10"
            }`}>
              {aiProcessing
                ? <Sparkles size={14} className="text-primary animate-spin" />
                : aiFileName
                ? <Sparkles size={14} className="text-primary" />
                : <Upload size={14} className="text-primary/70" />
              }
            </div>
            <div className="flex-1 py-2.5 min-w-0">
              <p className="text-xs font-semibold text-foreground leading-tight">
                {aiProcessing
                  ? "Analisando contrato..."
                  : aiFileName
                  ? `Dados extraídos de: ${aiFileName}`
                  : "Deixe a I.A cadastrar seu cliente"
                }
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                {aiProcessing
                  ? "Extraindo nome, CNPJ, contato, valor..."
                  : aiFileName
                  ? "Confira e ajuste os campos abaixo"
                  : "Suba o contrato e preenchemos os campos automaticamente"
                }
              </p>
            </div>
            {!aiProcessing && !aiFileName && (
              <span className="mr-3 text-[10px] font-medium text-primary/70 border border-primary/25 rounded-md px-2 py-1 flex-shrink-0">
                Fazer upload
              </span>
            )}
            {aiFileName && !aiProcessing && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setAiFileName(null); }}
                className="mr-3 p-1 rounded-md hover:bg-secondary/60 text-muted-foreground"
              >
                <X size={12} />
              </button>
            )}
          </label>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-5 pt-3 pb-0 flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

          {/* ── Aba Empresa ── */}
          {tab === "empresa" && (
            <>
              <div>
                <label className={lbl}>Nome da empresa *</label>
                <input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Ex: Clínica ABC" autoFocus className={inp} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>CNPJ</label>
                  <input value={form.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Razão Social</label>
                  <input value={form.razao_social ?? ""} onChange={(e) => set("razao_social", e.target.value)} placeholder="Nome jurídico" className={inp} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Cidade</label>
                  <input value={form.cidade ?? ""} onChange={(e) => set("cidade", e.target.value)} placeholder="São Paulo" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Estado</label>
                  <input value={form.estado ?? ""} onChange={(e) => set("estado", e.target.value)} placeholder="SP" className={inp} />
                </div>
              </div>

              <div>
                <label className={lbl}>Segmento</label>
                <input value={form.segment ?? ""} onChange={(e) => set("segment", e.target.value)} placeholder="Ex: Saúde, Educação" className={inp} />
              </div>

              <div>
                <label className={lbl}>Data de início da operação *</label>
                <input
                  type="date"
                  value={form.operation_start_date ?? ""}
                  onChange={(e) => set("operation_start_date", e.target.value)}
                  className={inp}
                />
                <p className="text-[10px] text-muted-foreground mt-1">LT e etapa da jornada calculados automaticamente a partir desta data.</p>
              </div>

            </>
          )}

          {/* ── Aba Contato ── */}
          {tab === "contato" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Nome do contato</label>
                  <input value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} placeholder="Nome" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Cargo</label>
                  <input value={form.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} placeholder="Ex: CEO, Diretor" className={inp} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>E-mail</label>
                  <input type="email" value={form.contact_email ?? ""} onChange={(e) => set("contact_email", e.target.value)} placeholder="email@empresa.com" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Telefone / WhatsApp</label>
                  <input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" className={inp} />
                </div>
              </div>

              <div className="pt-1 pb-0.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Responsável Financeiro</p>
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !contatoEhFinanceiro;
                      setContatoEhFinanceiro(next);
                      if (next) {
                        setForm((f) => ({
                          ...f,
                          responsavel_financeiro: f.contact_name ?? "",
                          cargo_responsavel: f.cargo ?? "",
                          email_faturamento: f.contact_email ?? "",
                        }));
                      }
                    }}
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                      contatoEhFinanceiro ? "bg-primary border-primary text-white" : "border-border/60 bg-secondary/40"
                    }`}
                  >
                    {contatoEhFinanceiro && <span className="text-[7px] font-bold">✓</span>}
                  </button>
                  <span className="text-[11px] text-muted-foreground">Mesmo que o contato</span>
                </label>
              </div>

              {!contatoEhFinanceiro && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={lbl}>Nome</label>
                      <input value={form.responsavel_financeiro ?? ""} onChange={(e) => set("responsavel_financeiro", e.target.value)} placeholder="Nome do resp. financeiro" className={inp} />
                    </div>
                    <div>
                      <label className={lbl}>Cargo</label>
                      <input value={form.cargo_responsavel ?? ""} onChange={(e) => set("cargo_responsavel", e.target.value)} placeholder="Ex: CFO, Financeiro" className={inp} />
                    </div>
                  </div>

                  <div>
                    <label className={lbl}>E-mail de faturamento</label>
                    <input type="email" value={form.email_faturamento ?? ""} onChange={(e) => set("email_faturamento", e.target.value)} placeholder="financeiro@empresa.com" className={inp} />
                  </div>
                </>
              )}

              {contatoEhFinanceiro && (
                <div className="rounded-xl bg-primary/6 border border-primary/20 px-3 py-2.5">
                  <p className="text-xs text-primary/80">
                    Usando <strong>{form.contact_name || "o contato"}</strong> como responsável financeiro.
                  </p>
                </div>
              )}

              <div>
                <label className={lbl}>Stakeholder / Decisor</label>
                <input value={form.stakeholder ?? ""} onChange={(e) => set("stakeholder", e.target.value)} placeholder="Nome do decisor chave" className={inp} />
              </div>

              {/* Problema financeiro flag */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={() => set("problema_financeiro", !form.problema_financeiro)}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                    form.problema_financeiro ? "bg-red-500 border-red-500 text-white" : "border-border/60 bg-secondary/40"
                  }`}
                >
                  {form.problema_financeiro && <span className="text-[8px] font-bold">✓</span>}
                </button>
                <span className="text-sm text-muted-foreground">Problema financeiro registrado</span>
              </label>
            </>
          )}


          {/* ── Aba Documentos ── */}
          {tab === "documentos" && (
            <>
              <p className="text-xs text-muted-foreground">
                Cole os links para os documentos do cliente. Podem ser Google Drive, Notion, Dropbox, etc.
              </p>

              <div>
                <label className={lbl}>
                  <span className="flex items-center gap-1.5"><FileText size={11} /> Contrato assinado</span>
                </label>
                <div className="relative">
                  <Link size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={form.contrato_url ?? ""}
                    onChange={(e) => set("contrato_url", e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={`${inp} pl-8`}
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>
                  <span className="flex items-center gap-1.5"><BarChart3 size={11} /> Plano de ROI</span>
                </label>
                <div className="relative">
                  <Link size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={form.roi_url ?? ""}
                    onChange={(e) => set("roi_url", e.target.value)}
                    placeholder="https://docs.google.com/..."
                    className={`${inp} pl-8`}
                  />
                </div>
              </div>

              <div>
                <label className={lbl}>
                  <span className="flex items-center gap-1.5"><Phone size={11} /> Call de vendas (gravação)</span>
                </label>
                <div className="relative">
                  <Link size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={form.sales_call_url ?? ""}
                    onChange={(e) => set("sales_call_url", e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className={`${inp} pl-8`}
                  />
                </div>
              </div>

              <div className="rounded-xl bg-secondary/30 border border-border/40 p-3 mt-1">
                <p className="text-xs text-muted-foreground/70 leading-relaxed">
                  Os documentos ficam visíveis na aba <strong className="text-foreground/70">Visão Geral</strong> do cliente após criação. Você pode adicionar ou editar os links a qualquer momento.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-4 py-2 mx-5">{error}</p>
        )}

        <div className="flex gap-2 px-5 py-4 border-t border-border/40 flex-shrink-0">
          {/* Tab nav shortcuts */}
          <div className="flex-1 flex items-center gap-1">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-2 h-2 rounded-full transition-colors ${tab === t.id ? "bg-primary" : "bg-border/60 hover:bg-border"}`}
                title={t.label}
              />
            ))}
          </div>
          <button onClick={onClose} className="px-4 py-2 rounded-xl glass text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name?.trim() || saving}
            className="px-5 py-2 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            {saving ? "Criando..." : "Criar cliente"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── CohortView ───────────────────────────────────────────────────────────────
//
// Exibe clientes agrupados por safra (trimestre de entrada), mostrando:
//  • marcador de produto (pill colorida)
//  • margem LTV estimada acumulada
//  • taxa de retenção e status de saúde

function CohortView({
  clients,
  selectedId,
  onSelect,
}: {
  clients:    Client[];
  selectedId: string | null;
  onSelect:   (id: string) => void;
}) {
  const cohorts = buildCohorts(clients);

  if (cohorts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Nenhum cliente com data de operação definida para analisar por safra.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-6 min-w-0 pr-1">
      {/* Summary header */}
      <CohortSummaryHeader cohorts={cohorts} />

      {/* Per-cohort cards */}
      {cohorts.map((cohort) => (
        <CohortCard
          key={cohort.key}
          cohort={cohort}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function CohortSummaryHeader({ cohorts }: { cohorts: CohortGroup[] }) {
  const allClients  = cohorts.flatMap((c) => c.clients);
  const totalMrr    = allClients.reduce((s, c) => s + (c.mrr ?? 0), 0);
  const totalLtvMgn = allClients.reduce((s, c) => s + estimateLtvMargin(c), 0);
  const active      = allClients.filter((c) => c.status !== "churned").length;
  const churned     = allClients.filter((c) => c.status === "churned").length;
  const retention   = allClients.length > 0
    ? Math.round((active / allClients.length) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: "Safras",              value: cohorts.length,            icon: <Layers size={14} />,       color: "#8b5cf6" },
        { label: "MRR Ativo",           value: formatCurrency(totalMrr),  icon: <DollarSign size={14} />,   color: "#22c55e" },
        { label: "Margem LTV Acum.",    value: formatCurrency(totalLtvMgn), icon: <TrendingUp size={14} />,   color: "#8b5cf6" },
        { label: "Retenção",            value: `${retention}%`,           icon: <Users size={14} />,        color: retention >= 80 ? "#22c55e" : retention >= 60 ? "#f59e0b" : "#ef4444" },
      ].map((s) => (
        <div
          key={s.label}
          className="glass rounded-xl border border-border/30 px-3 py-2 flex items-center gap-2"
        >
          <div className="p-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: `${s.color}22`, color: s.color }}>
            {s.icon}
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight truncate">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CohortCard({
  cohort, selectedId, onSelect,
}: {
  cohort:     CohortGroup;
  selectedId: string | null;
  onSelect:   (id: string) => void;
}) {
  const totalMrr    = cohort.clients.reduce((s, c) => s + (c.mrr ?? 0), 0);
  const totalLtvMgn = cohort.clients.reduce((s, c) => s + estimateLtvMargin(c), 0);
  const active      = cohort.clients.filter((c) => c.status !== "churned");
  const churned     = cohort.clients.filter((c) => c.status === "churned");
  const retention   = cohort.clients.length > 0
    ? Math.round((active.length / cohort.clients.length) * 100)
    : 0;
  const avgMarginPct = cohort.clients.length > 0
    ? cohort.clients.reduce((s, c) => s + getProductMargin(c.main_product), 0) / cohort.clients.length
    : 0;

  // Retenção color
  const retColor = retention >= 80 ? "#22c55e" : retention >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="glass rounded-2xl border border-border/30 overflow-hidden">
      {/* Cohort header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-secondary/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-muted-foreground" />
            <span className="font-semibold text-sm">Safra {cohort.label}</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
            {cohort.clients.length} cliente{cohort.clients.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Cohort KPIs */}
        <div className="flex items-center gap-4 text-xs">
          <div className="text-right">
            <p className="font-bold text-foreground">{formatCurrency(totalMrr)}<span className="font-normal text-muted-foreground">/mês</span></p>
            <p className="text-[10px] text-muted-foreground">MRR ativo</p>
          </div>
          <div className="text-right">
            <p className="font-bold" style={{ color: "#8b5cf6" }}>{formatCurrency(totalLtvMgn)}</p>
            <p className="text-[10px] text-muted-foreground">Margem LTV</p>
          </div>
          <div className="text-right">
            <p className="font-bold" style={{ color: retColor }}>{retention}%</p>
            <p className="text-[10px] text-muted-foreground">Retenção</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-foreground">{(avgMarginPct * 100).toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">Margem média</p>
          </div>
        </div>
      </div>

      {/* Product distribution bar */}
      <CohortProductBar clients={cohort.clients} />

      {/* Client rows */}
      <div className="divide-y divide-border/15">
        {cohort.clients.map((c) => (
          <CohortClientRow
            key={c.id}
            client={c}
            isSelected={selectedId === c.id}
            onSelect={() => onSelect(c.id)}
          />
        ))}
      </div>
    </div>
  );
}

/** Barra de distribuição de produtos dentro da safra */
function CohortProductBar({ clients }: { clients: Client[] }) {
  // Count by product category
  const byCategory = new Map<string, { label: string; color: string; count: number }>();

  for (const c of clients) {
    const cat = getCategoryForProduct(c.main_product ?? "");
    const key = cat?.id ?? "sem_produto";
    if (!byCategory.has(key)) {
      byCategory.set(key, {
        label: cat?.label ?? "Sem produto",
        color: cat?.color ?? "#6b7280",
        count: 0,
      });
    }
    byCategory.get(key)!.count++;
  }

  const segments = Array.from(byCategory.values());
  const total    = clients.length;

  return (
    <div className="px-4 py-2 flex items-center gap-2">
      {/* Bar */}
      <div className="flex-1 flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map((seg) => (
          <div
            key={seg.label}
            title={`${seg.label}: ${seg.count}`}
            className="transition-all"
            style={{
              backgroundColor: seg.color,
              width: `${(seg.count / total) * 100}%`,
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
            {seg.label} ({seg.count})
          </span>
        ))}
      </div>
    </div>
  );
}

/** Linha de cliente dentro da safra */
function CohortClientRow({
  client, isSelected, onSelect,
}: {
  client:     Client;
  isSelected: boolean;
  onSelect:   () => void;
}) {
  const ltvMargin   = estimateLtvMargin(client);
  const marginPct   = getProductMargin(client.main_product);
  const sit         = SITUATION_CONFIG[client.situation_color ?? "gray"] ?? SITUATION_CONFIG.gray;
  const cat         = getCategoryForProduct(client.main_product ?? "");
  const journeyColor = getJourneyColor(client.journey_stage);

  // Meses ativos
  const dateStr  = client.operation_start_date ?? client.created_at;
  const start    = new Date(dateStr);
  const months   = Math.max(1, Math.round((Date.now() - start.getTime()) / (30.44 * 86_400_000)));

  const isChurned = client.status === "churned";

  return (
    <motion.div
      layout
      onClick={onSelect}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-secondary/30 ${
        isSelected ? "bg-primary/5" : ""
      } ${isChurned ? "opacity-50" : ""}`}
    >
      {/* Client name + journey */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium truncate ${isChurned ? "line-through" : ""}`}>
            {client.name}
          </span>
          {isChurned && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium flex-shrink-0">
              Churned
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-[10px] font-bold px-1.5 py-px rounded-full"
            style={{ color: journeyColor, backgroundColor: `${journeyColor}20` }}
          >
            {getJourneyLabel(client.journey_stage)}
          </span>
          <span className="text-[10px] text-muted-foreground/50">{months}m ativos</span>
        </div>
      </div>

      {/* Product badge */}
      <div className="flex-shrink-0 w-36 min-w-0">
        {client.main_product ? (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full truncate max-w-full"
            style={{ color: cat?.color ?? "#6b7280", backgroundColor: `${cat?.color ?? "#6b7280"}18` }}
          >
            <span>{cat?.icon}</span>
            <span className="truncate">{client.main_product}</span>
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/40 italic">Sem produto</span>
        )}
      </div>

      {/* MRR */}
      <div className="flex-shrink-0 w-20 text-right">
        <p className="text-xs font-semibold">{client.mrr > 0 ? formatCurrency(client.mrr) : "—"}</p>
        <p className="text-[10px] text-muted-foreground">/mês</p>
      </div>

      {/* Margem % do produto */}
      <div className="flex-shrink-0 w-14 text-right">
        <p className="text-xs font-semibold">{(marginPct * 100).toFixed(0)}%</p>
        <p className="text-[10px] text-muted-foreground">margem</p>
      </div>

      {/* Margem LTV acumulada */}
      <div className="flex-shrink-0 w-24 text-right">
        <p className="text-xs font-bold text-violet-400">{ltvMargin > 0 ? formatCurrency(ltvMargin) : "—"}</p>
        <p className="text-[10px] text-muted-foreground">margem LTV</p>
      </div>

      {/* Health */}
      <div className="flex-shrink-0 w-16 text-right">
        {client.situation_color ? (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ color: sit.color, backgroundColor: sit.bg }}
          >
            {sit.label}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/30">—</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── CAC Modal ───────────────────────────────────────────────────────────────

function CACModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const [month, setMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSave() {
    const val = parseFloat(amount.replace(/\./g, "").replace(",", "."));
    if (!val || val <= 0) { setError("Informe um valor válido."); return; }
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("marketing_spend").upsert({
      month: `${month}-01`,
      amount: val,
      notes: notes || null,
      created_by: user?.id ?? null,
    }, { onConflict: "month" });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
    setTimeout(onClose, 1200);
  }

  // Month options — últimos 13 meses
  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="glass rounded-2xl border border-border/50 p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold">Lançar CAC do mês</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Investimento total em marketing no mês</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Mês de referência</label>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-sm appearance-none"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor investido (R$)</label>
            <input
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 8.500,00"
              className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações (opcional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Google Ads + Meta Ads"
              className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
          {success && <p className="text-xs text-green-500">Salvo com sucesso!</p>}

          <button
            onClick={handleSave}
            disabled={saving || success}
            className="w-full h-9 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando…" : success ? "Salvo!" : "Salvar"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Client Row (lista simplificada) ─────────────────────────────────────────

function ClientRow({
  client,
  onSelect,
  onGoToProjects,
}: {
  client: Client;
  onSelect: () => void;
  onGoToProjects: () => void;
}) {
  const isActive = client.status === "active" || client.status === "at_risk" || client.status === "upsell";
  const isChurned = !isActive;

  // LTV acumulado — soma de tudo que o cliente já pagou (mrr histórico + EE + variável)
  const ltv = client.ltv ?? client.mrr ?? 0;

  // Data de cadastro formatada
  const cadastro = client.operation_start_date
    ? new Date(client.operation_start_date).toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })
    : "—";

  // Data de churn formatada
  const churn = client.churn_date
    ? new Date(client.churn_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
    : null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/30 bg-background hover:border-border/60 transition-colors cursor-pointer group"
      onClick={onSelect}
    >
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
        isChurned ? "bg-muted-foreground/40" : isActive ? "bg-green-500" : "bg-yellow-500"
      }`} />

      {/* Nome */}
      <p className="text-sm font-medium flex-1 truncate">{client.name}</p>

      {/* Produto principal */}
      {client.main_product && (
        <span className="text-[10px] text-muted-foreground/70 truncate max-w-[120px] flex-shrink-0 hidden sm:block">
          {client.main_product}
        </span>
      )}

      {/* Projetos ativos */}
      {(client as Client & { active_projects_count?: number }).active_projects_count !== undefined && (
        <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden md:block w-16 text-center">
          {(client as Client & { active_projects_count?: number }).active_projects_count ?? 0} proj.
        </span>
      )}

      {/* LTV */}
      {ltv > 0 ? (
        <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex-shrink-0 w-20 text-right">
          {formatCurrency(ltv)}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground/40 flex-shrink-0 w-20 text-right">—</span>
      )}

      {/* Data cadastro */}
      <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden lg:block w-16 text-center">{cadastro}</span>

      {/* Churn */}
      {churn && (
        <span className="text-[10px] text-red-400 flex-shrink-0 w-20 text-right">{churn}</span>
      )}

      {/* Botão ir para projetos */}
      <button
        onClick={(e) => { e.stopPropagation(); onGoToProjects(); }}
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors opacity-0 group-hover:opacity-100"
        title="Ver projetos do cliente"
      >
        <Briefcase size={13} />
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CustomerSuccessPage() {
  const cs = useCustomerSuccess();
  const { setCurrentPage, setProjectsClientFilter, setProjectsSetor } = useAppStore();

  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [sidebarInitialTab, setSidebarInitialTab] = useState<DetailTab>("overview");
  const [showNewModal, setShowNewModal]      = useState(false);
  const [showCACModal, setShowCACModal]      = useState(false);

  // Filtros simplificados
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState<"all" | "active" | "churned">("all");
  const [sortBy, setSortBy]                 = useState<"name" | "cadastro" | "churn" | "ltv">("cadastro");
  const [filterCadastroFrom, setFilterCadastroFrom] = useState("");
  const [filterCadastroTo, setFilterCadastroTo]     = useState("");
  const [filterChurnFrom, setFilterChurnFrom]       = useState("");
  const [filterChurnTo, setFilterChurnTo]           = useState("");

  // Status: só é ativo se tiver status explícito active/at_risk/upsell
  // null/vazio = não marcado no NocoDB = considerar inativo
  function isClientActive(c: Client): boolean {
    return c.status === "active" || c.status === "at_risk" || c.status === "upsell";
  }
  function isClientChurned(c: Client): boolean {
    return c.status === "churned" || !!c.churn_date || !c.status;
  }

  // Filtered + sorted
  const filtered = cs.clients.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !(c.contact_name ?? "").toLowerCase().includes(q)) return false;
    }
    if (statusFilter === "active" && !isClientActive(c)) return false;
    if (statusFilter === "churned" && !isClientChurned(c)) return false;
    // Filtro por data de cadastro
    if (filterCadastroFrom && c.operation_start_date && c.operation_start_date < filterCadastroFrom) return false;
    if (filterCadastroTo   && c.operation_start_date && c.operation_start_date > filterCadastroTo + "-31") return false;
    // Filtro por data de churn
    if (filterChurnFrom && (!c.churn_date || c.churn_date < filterChurnFrom)) return false;
    if (filterChurnTo   && (!c.churn_date || c.churn_date > filterChurnTo + "-31")) return false;
    return true;
  }).sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name, "pt-BR");
    if (sortBy === "ltv") return (b.ltv ?? 0) - (a.ltv ?? 0);
    if (sortBy === "churn") return (b.churn_date ?? "").localeCompare(a.churn_date ?? "");
    // cadastro (padrão)
    return (b.operation_start_date ?? "").localeCompare(a.operation_start_date ?? "");
  });

  const activeCount  = cs.clients.filter(isClientActive).length;
  const churnedCount = cs.clients.filter(isClientChurned).length;

  function goToProjects(client: Client) {
    setProjectsClientFilter(client.id);
    setProjectsSetor("");
    setCurrentPage("projects");
  }

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Row 1: filtros + ações ── */}
      <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {(["all", "active", "churned"] as const).map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === s ? "bg-foreground/10 border-foreground/20 text-foreground" : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}>
              {s === "all" ? `Todos (${cs.clients.length})` : s === "active" ? `Ativos (${activeCount})` : `Inativos (${churnedCount})`}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative flex-1 min-w-[160px]">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="h-8 w-full bg-background border border-border/50 rounded-xl pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X size={10} /></button>}
        </div>

        {/* Filtro cadastro de — até */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">Cadastro</span>
          <input type="month" value={filterCadastroFrom} onChange={(e) => setFilterCadastroFrom(e.target.value)}
            className="h-8 px-2 rounded-xl border border-border/50 bg-background text-xs focus:outline-none" />
          <span className="text-[10px] text-muted-foreground">–</span>
          <input type="month" value={filterCadastroTo} onChange={(e) => setFilterCadastroTo(e.target.value)}
            className="h-8 px-2 rounded-xl border border-border/50 bg-background text-xs focus:outline-none" />
        </div>

        {/* Filtro churn de — até */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">Churn</span>
          <input type="month" value={filterChurnFrom} onChange={(e) => setFilterChurnFrom(e.target.value)}
            className="h-8 px-2 rounded-xl border border-border/50 bg-background text-xs focus:outline-none" />
          <span className="text-[10px] text-muted-foreground">–</span>
          <input type="month" value={filterChurnTo} onChange={(e) => setFilterChurnTo(e.target.value)}
            className="h-8 px-2 rounded-xl border border-border/50 bg-background text-xs focus:outline-none" />
        </div>

        {/* Sort */}
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="h-8 px-2 rounded-xl border border-border/50 bg-background text-xs appearance-none flex-shrink-0">
          <option value="cadastro">Mais recentes</option>
          <option value="name">Nome A–Z</option>
          <option value="ltv">Maior LTV</option>
          <option value="churn">Churn recente</option>
        </select>

        <div className="flex-1" />

        {/* Lançar CAC */}
        <button onClick={() => setShowCACModal(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl border border-border/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors flex-shrink-0">
          <DollarSign size={12} />
          CAC do mês
        </button>

        {/* Novo cliente */}
        <button onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex-shrink-0">
          <Plus size={13} />
          Novo cliente
        </button>
      </div>

      {/* ── Table header ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-3 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wide">
        <div className="w-2 flex-shrink-0" />
        <span className="flex-1">Cliente</span>
        <span className="hidden sm:block w-[120px]">Produto principal</span>
        <span className="hidden md:block w-16 text-center">Projetos</span>
        <span className="w-20 text-right">LTV total</span>
        <span className="hidden lg:block w-16 text-center">Cadastro</span>
        <span className="w-20 text-right">Churn</span>
        <div className="w-7 flex-shrink-0" />
      </div>

      {/* ── Lista de clientes ── */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1">
        {cs.loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm animate-pulse">Carregando clientes…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhum cliente encontrado.</div>
        ) : (
          filtered.map((c) => (
            <ClientRow
              key={c.id}
              client={c}
              onSelect={() => { setSelectedId(c.id); setSidebarInitialTab("overview"); }}
              onGoToProjects={() => goToProjects(c)}
            />
          ))
        )}
      </div>

      {/* ── Detail Sidebar ── */}
      <AnimatePresence>
        {selectedId && (
          <ClientDetailSidebar
            key={`${selectedId}-${sidebarInitialTab}`}
            clientId={selectedId}
            loadDetail={cs.loadClientDetail}
            onClose={() => setSelectedId(null)}
            onAddInteraction={cs.addInteraction}
            onUpdateClient={cs.saveClient}
            initialTab={sidebarInitialTab}
          />
        )}
      </AnimatePresence>

      {/* ── New Client Modal ── */}
      <AnimatePresence>
        {showNewModal && (
          <NewClientModal
            onSave={async (data) => {
              const result = await cs.saveClient(data);
              if (!result) throw new Error("Erro ao cadastrar cliente — verifique os dados e tente novamente");
            }}
            onClose={() => setShowNewModal(false)}
          />
        )}
      </AnimatePresence>

      {/* ── CAC Modal ── */}
      <AnimatePresence>
        {showCACModal && <CACModal onClose={() => setShowCACModal(false)} />}
      </AnimatePresence>
    </div>
  );
}
