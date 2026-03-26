import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import type { ClientFinancial } from "@/types";

interface Props {
  financials: ClientFinancial[];
}

function fmtMonth(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function fmtR(v: number) {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
}

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-xl p-3 border border-border/50 shadow-xl text-xs space-y-1.5 min-w-[160px]">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium">{fmtR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function RevenueMap({ financials }: Props) {
  if (financials.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
        Nenhum dado financeiro ainda. Lance o primeiro mês abaixo.
      </div>
    );
  }

  const data = financials.map((f) => ({
    month: fmtMonth(f.month),
    MRR: f.mrr,
    "Custo de Servir": f.cost_to_serve,
    "Verba Ads": f.ad_spend,
    Margem: f.contribution_margin,
  }));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="gradMrr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f87171" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradMargin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={fmtR} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickLine={false} axisLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" />
          <Area
            type="monotone"
            dataKey="MRR"
            stroke="#22c55e"
            strokeWidth={2}
            fill="url(#gradMrr)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="Custo de Servir"
            stroke="#f87171"
            strokeWidth={1.5}
            fill="url(#gradCost)"
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Area
            type="monotone"
            dataKey="Margem"
            stroke="#60a5fa"
            strokeWidth={2}
            fill="url(#gradMargin)"
            dot={false}
            activeDot={{ r: 4 }}
            strokeDasharray="5 3"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
