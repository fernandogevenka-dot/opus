import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Minus, ChevronDown, X } from "lucide-react";
import type { Project } from "@/hooks/useProjects";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JornadaDashProps {
  projects: Project[];
  setor: string;
  filterSquad?: string;
  filterDupla?: string;
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
  return Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
}

function lastNMonths(n: number): { label: string; year: number; month: number }[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". ", "/"),
      year: d.getFullYear(),
      month: d.getMonth(),
    };
  });
}

function projectsActiveInMonth(projects: Project[], year: number, month: number): Project[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0, 23, 59, 59);
  return projects.filter((p) => {
    if (!p.start_date) return false;
    if (new Date(p.start_date) > monthEnd) return false;
    const endRaw = p.churn_date ?? p.end_date ?? null;
    if (endRaw && new Date(endRaw) < monthStart) return false;
    return true;
  });
}

function projectsChurnedInMonth(projects: Project[], year: number, month: number): Project[] {
  const start = new Date(year, month, 1);
  const end   = new Date(year, month + 1, 0, 23, 59, 59);
  return projects.filter((p) => {
    const d = p.churn_date ?? p.end_date ?? null;
    if (!d) return false;
    const dt = new Date(d);
    return dt >= start && dt <= end;
  });
}

function projectsNewInMonth(projects: Project[], year: number, month: number): Project[] {
  const start = new Date(year, month, 1);
  const end   = new Date(year, month + 1, 0, 23, 59, 59);
  return projects.filter((p) => {
    if (!p.start_date) return false;
    const dt = new Date(p.start_date);
    return dt >= start && dt <= end;
  });
}

function pctChange(curr: number, prev: number): string {
  if (!prev) return "";
  const pct = ((curr - prev) / prev) * 100;
  return `${pct >= 0 ? "+" : ""}${fmtNum(pct, 1)}%`;
}

function trendDir(curr: number, prev: number): "up" | "down" | "neutral" {
  if (!prev) return "neutral";
  return curr > prev ? "up" : curr < prev ? "down" : "neutral";
}

// ─── Drill-down modal ─────────────────────────────────────────────────────────

interface DrillModalProps {
  title: string;
  projects: Project[];
  color: string;
  onClose: () => void;
}

function DrillModal({ title, projects, color, onClose }: DrillModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-background border border-border/60 rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="text-sm font-semibold">{title}</h2>
            <span className="text-xs text-muted-foreground bg-secondary/50 rounded-full px-2 py-0.5">
              {projects.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-secondary/60 text-muted-foreground"
          >
            <X size={14} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {projects.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum projeto neste período
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {projects.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.client_name ?? "—"}
                      {p.squad_name ? ` · ${p.squad_name}` : ""}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {(p.mrr ?? 0) > 0 && (
                      <p className="text-sm font-semibold" style={{ color }}>
                        {fmt(p.mrr ?? 0)}<span className="text-xs font-normal text-muted-foreground">/mês</span>
                      </p>
                    )}
                    {p.gestor_projeto && (
                      <p className="text-[10px] text-muted-foreground">{p.gestor_projeto.split(" ")[0]}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  prevLabel?: string;
  color?: string;
  clickable?: boolean;
  onClick?: () => void;
}

function MetricCard({ label, value, sub, trend, trendLabel, prevLabel, color, clickable, onClick }: MetricCardProps) {
  return (
    <div
      className={`flex flex-col gap-1 px-4 py-3 rounded-xl border border-border/40 bg-secondary/20 w-[170px] flex-shrink-0 ${
        clickable ? "cursor-pointer hover:border-border/70 hover:bg-secondary/35 transition-colors" : ""
      }`}
      onClick={clickable ? onClick : undefined}
      title={clickable ? "Clique para ver projetos" : undefined}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      <p className="text-lg font-bold leading-tight truncate" style={color ? { color } : undefined}>
        {value}
      </p>
      <div className="flex flex-col gap-0.5 mt-0.5">
        {/* Linha de tendência vs mês anterior */}
        {(trend || trendLabel) && (
          <div className="flex items-center gap-1">
            {trend === "up"      && <TrendingUp  size={10} className="text-green-500 flex-shrink-0" />}
            {trend === "down"    && <TrendingDown size={10} className="text-red-500   flex-shrink-0" />}
            {trend === "neutral" && <Minus        size={10} className="text-muted-foreground flex-shrink-0" />}
            {trendLabel && (
              <span className={`text-[10px] font-semibold leading-tight ${
                trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"
              }`}>
                {trendLabel}
              </span>
            )}
          </div>
        )}
        {/* Valor do mês anterior */}
        {prevLabel && (
          <span className="text-[10px] text-muted-foreground/60 leading-tight">{prevLabel}</span>
        )}
        {sub && <span className="text-[10px] text-muted-foreground leading-tight">{sub}</span>}
        {clickable && (
          <span className="text-[10px] text-muted-foreground/40 mt-0.5">Ver projetos →</span>
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function JornadaDash({ projects, setor, filterSquad, filterDupla }: JornadaDashProps) {
  const months = useMemo(() => lastNMonths(13), []);
  const [selectedIdx, setSelectedIdx] = useState(months.length - 1);
  const [drill, setDrill] = useState<{ title: string; projects: Project[]; color: string } | null>(null);

  const sel  = months[selectedIdx];
  const prev = selectedIdx > 0 ? months[selectedIdx - 1] : null;

  const isExecutar = setor === "executar" || setor === "executar-all" || setor === "executar-onboarding" || setor === "executar-implementacoes";
  const isSaber    = setor === "saber";
  const isTer      = setor === "ter";

  const filtered = useMemo(() => projects.filter((p) => {
    if (filterSquad && p.squad_name !== filterSquad) return false;
    if (filterDupla && p.gestor_projeto !== filterDupla && p.gestor_trafego !== filterDupla) return false;
    return true;
  }), [projects, filterSquad, filterDupla]);

  // ── Executar metrics ───────────────────────────────────────────────────────
  const em = useMemo(() => {
    if (!isExecutar) return null;

    const active     = projectsActiveInMonth(filtered, sel.year, sel.month);
    const prevActive = prev ? projectsActiveInMonth(filtered, prev.year, prev.month) : [];

    const mrr     = active.reduce((s, p) => s + (p.mrr ?? 0), 0);
    const prevMrr = prevActive.reduce((s, p) => s + (p.mrr ?? 0), 0);

    const lt = active.length > 0
      ? active.reduce((s, p) => s + lifetimeMonths(p.start_date), 0) / active.length
      : 0;

    const churned     = projectsChurnedInMonth(filtered, sel.year, sel.month);
    const prevChurned = prev ? projectsChurnedInMonth(filtered, prev.year, prev.month) : [];
    const churnMRR    = churned.reduce((s, p) => s + (p.mrr ?? 0), 0);
    const prevChurnMRR = prevChurned.reduce((s, p) => s + (p.mrr ?? 0), 0);

    const newProjects     = projectsNewInMonth(filtered, sel.year, sel.month);
    const prevNewProjects = prev ? projectsNewInMonth(filtered, prev.year, prev.month) : [];
    const expansao        = newProjects.reduce((s, p) => s + (p.mrr ?? 0), 0);
    const prevExpansao    = prevNewProjects.reduce((s, p) => s + (p.mrr ?? 0), 0);

    const ticketMedio = active.length > 0 ? mrr / active.length : 0;

    return {
      mrr, prevMrr, lt,
      churnMRR, prevChurnMRR, churned,
      expansao, prevExpansao, newProjects,
      ticketMedio, activeCount: active.length,
    };
  }, [filtered, sel, prev, isExecutar]);

  // ── Saber metrics ─────────────────────────────────────────────────────────
  const sm = useMemo(() => {
    if (!isSaber) return null;
    const active      = projectsActiveInMonth(filtered, sel.year, sel.month);
    const prevActive  = prev ? projectsActiveInMonth(filtered, prev.year, prev.month) : [];
    const receita     = active.reduce((s, p) => s + (p.estruturacao_estrategica ?? p.investimento ?? 0), 0);
    const prevReceita = prevActive.reduce((s, p) => s + (p.estruturacao_estrategica ?? p.investimento ?? 0), 0);
    return { receita, prevReceita, count: active.length };
  }, [filtered, sel, prev, isSaber]);

  // ── Ter metrics ────────────────────────────────────────────────────────────
  const tm = useMemo(() => {
    if (!isTer) return null;
    const active      = projectsActiveInMonth(filtered, sel.year, sel.month);
    const prevActive  = prev ? projectsActiveInMonth(filtered, prev.year, prev.month) : [];
    const receita     = active.reduce((s, p) => s + (p.investimento ?? 0), 0);
    const prevReceita = prevActive.reduce((s, p) => s + (p.investimento ?? 0), 0);
    return { receita, prevReceita, count: active.length };
  }, [filtered, sel, prev, isTer]);

  return (
    <>
      <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">

        {/* Filtro de mês */}
        <div className="relative flex-shrink-0">
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
        {em && (
          <>
            <MetricCard
              label="MRR"
              value={fmt(em.mrr)}
              trend={trendDir(em.mrr, em.prevMrr)}
              trendLabel={prev ? pctChange(em.mrr, em.prevMrr) : undefined}
              prevLabel={prev ? `Ant: ${fmt(em.prevMrr)}` : undefined}
              color="#10b981"
            />
            <MetricCard
              label="Ticket Médio"
              value={fmt(em.ticketMedio)}
              sub={`${em.activeCount} clientes`}
            />
            <MetricCard
              label="LT Médio"
              value={`${fmtNum(em.lt, 1)} meses`}
            />
            <MetricCard
              label="Churn Financeiro"
              value={em.churnMRR > 0 ? fmt(em.churnMRR) : "R$ 0"}
              trend={em.churnMRR > 0 ? trendDir(em.churnMRR, em.prevChurnMRR) : "neutral"}
              trendLabel={prev && em.churnMRR > 0 ? pctChange(em.churnMRR, em.prevChurnMRR) : undefined}
              prevLabel={prev && em.prevChurnMRR > 0 ? `Ant: ${fmt(em.prevChurnMRR)}` : undefined}
              color={em.churnMRR > 0 ? "#ef4444" : undefined}
              clickable={em.churned.length > 0}
              onClick={() => setDrill({ title: "Churn Financeiro", projects: em.churned, color: "#ef4444" })}
            />
            <MetricCard
              label="Expansão"
              value={em.expansao > 0 ? fmt(em.expansao) : "R$ 0"}
              trend={em.expansao > 0 ? trendDir(em.expansao, em.prevExpansao) : "neutral"}
              trendLabel={prev && em.expansao > 0 ? pctChange(em.expansao, em.prevExpansao) : undefined}
              prevLabel={prev && em.prevExpansao > 0 ? `Ant: ${fmt(em.prevExpansao)}` : undefined}
              color={em.expansao > 0 ? "#10b981" : undefined}
              clickable={em.newProjects.length > 0}
              onClick={() => setDrill({ title: "Expansão (novos projetos)", projects: em.newProjects, color: "#10b981" })}
            />
          </>
        )}

        {/* ── Saber metrics ── */}
        {sm && (
          <>
            <MetricCard
              label="Receita"
              value={fmt(sm.receita)}
              trend={trendDir(sm.receita, sm.prevReceita)}
              trendLabel={prev ? pctChange(sm.receita, sm.prevReceita) : undefined}
              prevLabel={prev ? `Ant: ${fmt(sm.prevReceita)}` : undefined}
              color="#8b5cf6"
            />
            <MetricCard label="Diagnósticos ativos" value={fmtNum(sm.count)} />
          </>
        )}

        {/* ── Ter metrics ── */}
        {tm && (
          <>
            <MetricCard
              label="Receita"
              value={fmt(tm.receita)}
              trend={trendDir(tm.receita, tm.prevReceita)}
              trendLabel={prev ? pctChange(tm.receita, tm.prevReceita) : undefined}
              prevLabel={prev ? `Ant: ${fmt(tm.prevReceita)}` : undefined}
              color="#06b6d4"
            />
            <MetricCard label="Implementações ativas" value={fmtNum(tm.count)} />
          </>
        )}
      </div>

      {/* Drill-down modal */}
      {drill && (
        <DrillModal
          title={drill.title}
          projects={drill.projects}
          color={drill.color}
          onClose={() => setDrill(null)}
        />
      )}
    </>
  );
}
