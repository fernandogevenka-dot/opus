import { useState } from "react";
import type { TeamMember } from "@/hooks/useCustomerSuccess";
import type { TeamCostEntry } from "@/types";
import { Users, Calculator } from "lucide-react";

interface Props {
  members: TeamMember[];
  onCostChange: (totalCost: number, entries: TeamCostEntry[]) => void;
}

export function TeamCostBreaker({ members, onCostChange }: Props) {
  const [entries, setEntries] = useState<Record<string, { hours: number; rate: number }>>(
    () =>
      Object.fromEntries(
        members.map((m) => [m.user_id, { hours: 0, rate: 0 }])
      )
  );

  function update(userId: string, field: "hours" | "rate", raw: string) {
    const value = parseFloat(raw) || 0;
    const next = { ...entries, [userId]: { ...entries[userId], [field]: value } };
    setEntries(next);

    const costEntries: TeamCostEntry[] = members.map((m) => {
      const e = next[m.user_id] ?? { hours: 0, rate: 0 };
      return {
        user_id: m.user_id,
        user_name: m.user?.name ?? "—",
        user_avatar: m.user?.avatar_url ?? null,
        role: m.role,
        hours_month: e.hours,
        hourly_rate: e.rate,
        monthly_cost: e.hours * e.rate,
      };
    });

    const total = costEntries.reduce((s, c) => s + c.monthly_cost, 0);
    onCostChange(total, costEntries);
  }

  if (members.length === 0) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-1.5 py-2">
        <Users size={12} />
        Nenhum membro vinculado a este cliente.
      </div>
    );
  }

  const totalCost = members.reduce((s, m) => {
    const e = entries[m.user_id] ?? { hours: 0, rate: 0 };
    return s + e.hours * e.rate;
  }, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Calculator size={12} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Custo de servir — time alocado</span>
      </div>

      <div className="space-y-1.5">
        {members.map((m) => {
          const e = entries[m.user_id] ?? { hours: 0, rate: 0 };
          const cost = e.hours * e.rate;
          return (
            <div key={m.user_id} className="flex items-center gap-2">
              {m.user?.avatar_url ? (
                <img src={m.user.avatar_url} className="w-6 h-6 rounded-full object-cover flex-shrink-0" alt="" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                  <span className="text-[9px] font-bold">{(m.user?.name ?? "?")[0]}</span>
                </div>
              )}
              <span className="text-xs flex-1 truncate">{m.user?.name ?? m.user_id}</span>
              <span className="text-[10px] text-muted-foreground w-16 truncate">{m.role}</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  placeholder="h/mês"
                  value={e.hours || ""}
                  onChange={(ev) => update(m.user_id, "hours", ev.target.value)}
                  className="w-14 bg-secondary/60 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <span className="text-[10px] text-muted-foreground">×</span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  placeholder="R$/h"
                  value={e.rate || ""}
                  onChange={(ev) => update(m.user_id, "rate", ev.target.value)}
                  className="w-16 bg-secondary/60 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <span className="text-xs font-medium text-foreground w-16 text-right">
                  {cost > 0 ? `R$ ${cost.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "—"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-border/30 mt-1">
        <span className="text-xs text-muted-foreground">Total custo de servir</span>
        <span className="text-sm font-bold text-foreground">
          R$ {totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
}
