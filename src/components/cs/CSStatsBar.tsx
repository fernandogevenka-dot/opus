import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, AlertTriangle, Star } from "lucide-react";

interface Stats { active: number; atRisk: number; totalMrr: number; totalLtv: number; avgNps: number; }

export function CSStatsBar({ getStats }: { getStats: () => Promise<Stats | null> }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => { getStats().then(setStats); }, []);

  if (!stats) return null;

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="grid grid-cols-4 gap-3 flex-shrink-0">
      {[
        { icon: <TrendingUp size={16} className="text-green-400" />, label: "Clientes Ativos", value: stats.active.toString(), color: "text-green-400" },
        { icon: <AlertTriangle size={16} className="text-yellow-400" />, label: "Em Risco", value: stats.atRisk.toString(), color: "text-yellow-400" },
        { icon: <DollarSign size={16} className="text-brand-400" />, label: "MRR Total", value: fmt(stats.totalMrr), color: "text-brand-400" },
        { icon: <Star size={16} className="text-purple-400" />, label: "NPS Médio", value: stats.avgNps > 0 ? stats.avgNps.toFixed(1) : "—", color: "text-purple-400" },
      ].map((s) => (
        <div key={s.label} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0">
            {s.icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
