import type { ClientFinancialSummary } from "@/types";
import { TrendingUp, TrendingDown, DollarSign, Clock, Target, BarChart3 } from "lucide-react";

interface Props {
  summary: ClientFinancialSummary;
}

function formatR(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function formatPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function FinancialSummary({ summary }: Props) {
  const tiles = [
    {
      icon: <DollarSign size={14} />,
      label: "LTV Acumulado",
      value: formatR(summary.ltv_accumulated),
      sub: "Receita total histórica",
      color: "text-green-400",
      bg: "bg-green-500/10",
    },
    {
      icon: <Target size={14} />,
      label: "CAC Investido",
      value: formatR(summary.cac_total),
      sub: "Custo de aquisição total",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: <Clock size={14} />,
      label: "Payback",
      value: summary.payback_months != null ? `${summary.payback_months} meses` : "—",
      sub: "Para recuperar o CAC",
      color: summary.payback_months != null && summary.payback_months <= 12 ? "text-green-400" : "text-amber-400",
      bg: summary.payback_months != null && summary.payback_months <= 12 ? "bg-green-500/10" : "bg-amber-500/10",
    },
    {
      icon: <BarChart3 size={14} />,
      label: "Margem Média",
      value: formatPct(summary.avg_margin_pct),
      sub: "Margem de contribuição",
      color: summary.avg_margin_pct >= 0 ? "text-green-400" : "text-red-400",
      bg: summary.avg_margin_pct >= 0 ? "bg-green-500/10" : "bg-red-500/10",
    },
    {
      icon: <TrendingUp size={14} />,
      label: "Melhor Mês",
      value: summary.best_month ? formatR(summary.best_month.contribution_margin) : "—",
      sub: summary.best_month
        ? new Date(summary.best_month.month + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        : "—",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      icon: <TrendingDown size={14} />,
      label: "Pior Mês",
      value: summary.worst_month ? formatR(summary.worst_month.contribution_margin) : "—",
      sub: summary.worst_month
        ? new Date(summary.worst_month.month + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
        : "—",
      color: "text-rose-400",
      bg: "bg-rose-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <div key={t.label} className={`glass rounded-xl p-3 border border-border/40 ${t.bg}`}>
          <div className={`flex items-center gap-1.5 mb-1 ${t.color}`}>
            {t.icon}
            <span className="text-[10px] font-semibold uppercase tracking-wide">{t.label}</span>
          </div>
          <p className={`text-base font-bold ${t.color}`}>{t.value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t.sub}</p>
        </div>
      ))}
    </div>
  );
}
