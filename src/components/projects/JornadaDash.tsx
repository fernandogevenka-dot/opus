import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import type { Project } from "@/hooks/useProjects";
import { ACTIVE_MOMENTOS, type ProjectMomento } from "@/hooks/useProjects";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JornadaDashProps {
  projects: Project[];   // todos os projetos do setor visível
  setor: string;         // "saber" | "ter" | "executar-*"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `R$ ${(n / 1_000).toFixed(1)}k`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function lifetimeMonths(startDate: string | undefined | null): number {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  const m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return Math.max(0, m);
}

// Gera lista de últimos N meses: [{ label: "Abr/26", year: 2026, month: 3 }, ...]
function lastNMonths(n: number): { label: string; year: number; month: number }[] {
  const now = new Date();
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". ", "/"),
      year: d.getFullYear(),
      month: d.getMonth(),
    });
  }
  return months;
}

// Projetos ativos em um dado mês (start_date <= fim do mês AND (end_date/churn_date nulo ou > início do mês))
function projectsActiveInMonth(projects: Project[], year: number, month: number): Project[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59);

  return projects.filter((p) => {
    if (!p.start_date) return false;
    const start = new Date(p.start_date);
    if (start > monthEnd) return false;

    const endRaw = p.churn_date ?? p.end_date ?? null;
    if (endRaw) {
      const end = new Date(endRaw);
      if (end < monthStart) return false;
    }
    return true;
  });
}

// Projetos que churnearam em determinado mês
function projectsChurnedInMonth(projects: Project[], year: number, month: number): Project[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59);
  return projects.filter((p) => {
    const d = p.churn_date ?? p.end_date ?? null;
    if (!d) return false;
    const dt = new Date(d);
    return dt >= monthStart && dt <= monthEnd;
  });
}

// MRR de expansão = projetos que tiveram mrr aumentado nesse mês (aproximação: novos projetos sem churn)
function expansaoMRR(projects: Project[], year: number, month: number): number {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59);
  return projects
    .filter((p) => {
      if (!p.start_date) return false;
      const start = new Date(p.start_date);
      // "expansão" = projetos que iniciaram neste mês (novo negócio)
      return start >= monthStart && start <= monthEnd;
    })
    .reduce((s, p) => s + (p.mrr ?? 0), 0);
}

// ─── Metric card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  color?: string;
}

function MetricCard({ label, value, sub, trend, trendLabel, color }: MetricCardProps) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl border border-border/40 bg-secondary/20 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p
        className="text-xl font-bold leading-tight truncate"
        style={color ? { color } : undefined}
      >
        {value}
      </p>
      {(sub || trendLabel) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {trend === "up"      && <TrendingUp  size={11} className="text-green-500 flex-shrink-0" />}
          {trend === "down"    && <TrendingDown size={11} className="text-red-500   flex-shrink-0" />}
          {trend === "neutral" && <Minus        size={11} className="text-muted-foreground flex-shrink-0" />}
          {trendLabel && (
            <span className={`text-[10px] font-medium ${
              trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
            }`}>
              {trendLabel}
            </span>
          )}
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function JornadaDash({ projects, setor }: JornadaDashProps) {
  const months = useMemo(() => lastNMonths(13), []);
  const [selectedIdx, setSelectedIdx] = useState(months.length - 1); // default = mês atual

  const sel = months[selectedIdx];
  const prev = selectedIdx > 0 ? months[selectedIdx - 1] : null;

  const isExecutar = setor === "executar" || setor === "executar-onboarding" || setor === "executar-implementacoes";
  const isSaber    = setor === "saber";
  const isTer      = setor === "ter";

  // ── Executar metrics ───────────────────────────────────────────────────────
  const executarMetrics = useMemo(() => {
    if (!isExecutar) return null;

    const active     = projectsActiveInMonth(projects, sel.year, sel.month);
    const prevActive = prev ? projectsActiveInMonth(projects, prev.year, prev.month) : [];

    const mrr      = active.reduce((s, p) => s + (p.mrr ?? 0), 0);
    const prevMrr  = prevActive.reduce((s, p) => s + (p.mrr ?? 0), 0);
    const mrrDelta = mrr - prevMrr;

    const lt = active.length > 0
      ? active.reduce((s, p) => s + lifetimeMonths(p.start_date), 0) / active.length
      : 0;

    const churned    = projectsChurnedInMonth(projects, sel.year, sel.month);
    const churnMRR   = churned.reduce((s, p) => s + (p.mrr ?? 0), 0);

    const expansao   = expansaoMRR(projects, sel.year, sel.month);

    const ticketMedio = active.length > 0 ? mrr / active.length : 0;

    return { mrr, prevMrr, mrrDelta, lt, churnMRR, expansao, ticketMedio, activeCount: active.length, churnCount: churned.length };
  }, [projects, sel, prev, isExecutar]);

  // ── Saber metrics ─────────────────────────────────────────────────────────
  const saberMetrics = useMemo(() => {
    if (!isSaber) return null;
    const active = projectsActiveInMonth(projects, sel.year, sel.month);
    const receita = active.reduce((s, p) => s + (p.estruturacao_estrategica ?? p.investimento ?? 0), 0);
    const prevActive = prev ? projectsActiveInMonth(projects, prev.year, prev.month) : [];
    const prevReceita = prevActive.reduce((s, p) => s + (p.estruturacao_estrategica ?? p.investimento ?? 0), 0);
    return { receita, prevReceita, count: active.length };
  }, [projects, sel, prev, isSaber]);

  // ── Ter metrics ────────────────────────────────────────────────────────────
  const terMetrics = useMemo(() => {
    if (!isTer) return null;
    const active = projectsActiveInMonth(projects, sel.year, sel.month);
    const receita = active.reduce((s, p) => s + (p.investimento ?? 0), 0);
    const prevActive = prev ? projectsActiveInMonth(projects, prev.year, prev.month) : [];
    const prevReceita = prevActive.reduce((s, p) => s + (p.investimento ?? 0), 0);
    return { receita, prevReceita, count: active.length };
  }, [projects, sel, prev, isTer]);

  function trendDir(curr: number, prevVal: number): "up" | "down" | "neutral" {
    if (!prevVal) return "neutral";
    if (curr > prevVal) return "up";
    if (curr < prevVal) return "down";
    return "neutral";
  }

  function pctLabel(curr: number, prevVal: number): string {
    if (!prevVal) return "";
    const pct = ((curr - prevVal) / prevVal) * 100;
    return `${pct >= 0 ? "+" : ""}${fmtNum(pct, 1)}% vs mês ant.`;
  }

  return (
    <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">

      {/* Filtro de mês */}
      <div className="relative">
        <select
          value={selectedIdx}
          onChange={(e) => setSelectedIdx(Number(e.target.value))}
          className="h-8 pl-3 pr-7 rounded-xl border border-border/50 bg-background text-xs text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30 font-medium"
        >
          {months.map((m, i) => (
            <option key={i} value={i}>{m.label}</option>
          ))}
        </select>
        <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>

      <div className="w-px h-5 bg-border/40 flex-shrink-0" />

      {/* ── Executar metrics ── */}
      {executarMetrics && (
        <>
          <MetricCard
            label="MRR"
            value={fmt(executarMetrics.mrr)}
            trend={trendDir(executarMetrics.mrr, executarMetrics.prevMrr)}
            trendLabel={prev ? pctLabel(executarMetrics.mrr, executarMetrics.prevMrr) : undefined}
            color="#10b981"
          />
          <MetricCard
            label="Ticket Médio"
            value={fmt(executarMetrics.ticketMedio)}
            sub={`${executarMetrics.activeCount} clientes`}
          />
          <MetricCard
            label="LT Médio"
            value={`${fmtNum(executarMetrics.lt, 1)} meses`}
          />
          <MetricCard
            label="Churn Financeiro"
            value={executarMetrics.churnMRR > 0 ? fmt(executarMetrics.churnMRR) : "R$ 0"}
            sub={executarMetrics.churnCount > 0 ? `${executarMetrics.churnCount} projeto(s)` : undefined}
            trend={executarMetrics.churnMRR > 0 ? "down" : "neutral"}
            color={executarMetrics.churnMRR > 0 ? "#ef4444" : undefined}
          />
          <MetricCard
            label="Expansão"
            value={executarMetrics.expansao > 0 ? fmt(executarMetrics.expansao) : "R$ 0"}
            trend={executarMetrics.expansao > 0 ? "up" : "neutral"}
            color={executarMetrics.expansao > 0 ? "#10b981" : undefined}
          />
        </>
      )}

      {/* ── Saber metrics ── */}
      {saberMetrics && (
        <>
          <MetricCard
            label="Receita"
            value={fmt(saberMetrics.receita)}
            trend={trendDir(saberMetrics.receita, saberMetrics.prevReceita)}
            trendLabel={prev ? pctLabel(saberMetrics.receita, saberMetrics.prevReceita) : undefined}
            color="#8b5cf6"
          />
          <MetricCard
            label="Diagnósticos ativos"
            value={fmtNum(saberMetrics.count)}
          />
        </>
      )}

      {/* ── Ter metrics ── */}
      {terMetrics && (
        <>
          <MetricCard
            label="Receita"
            value={fmt(terMetrics.receita)}
            trend={trendDir(terMetrics.receita, terMetrics.prevReceita)}
            trendLabel={prev ? pctLabel(terMetrics.receita, terMetrics.prevReceita) : undefined}
            color="#06b6d4"
          />
          <MetricCard
            label="Implementações ativas"
            value={fmtNum(terMetrics.count)}
          />
        </>
      )}
    </div>
  );
}
