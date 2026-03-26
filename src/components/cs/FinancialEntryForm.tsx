import { useState } from "react";
import type { ClientFinancial, TeamCostEntry } from "@/types";
import type { TeamMember } from "@/hooks/useCustomerSuccess";
import { TeamCostBreaker } from "./TeamCostBreaker";
import { Save, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  clientId: string;
  members: TeamMember[];
  onSave: (entry: Omit<ClientFinancial, "id" | "contribution_margin" | "margin_pct" | "created_at" | "updated_at">) => Promise<unknown>;
  saving: boolean;
  prefill?: Partial<ClientFinancial>;
}

export function FinancialEntryForm({ clientId, members, onSave, saving, prefill }: Props) {
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const [month, setMonth] = useState(prefill?.month?.slice(0, 7) ?? currentMonth);
  const [mrr, setMrr] = useState(String(prefill?.mrr ?? ""));
  const [cac, setCac] = useState(String(prefill?.cac ?? ""));
  const [adSpend, setAdSpend] = useState(String(prefill?.ad_spend ?? ""));
  const [costToServe, setCostToServe] = useState(String(prefill?.cost_to_serve ?? ""));
  const [notes, setNotes] = useState(prefill?.notes ?? "");
  const [showTeam, setShowTeam] = useState(false);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function handleTeamCost(total: number, _entries: TeamCostEntry[]) {
    setCostToServe(String(total));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    // month state is "YYYY-MM" — hook will normalise to first day
    const result = await onSave({
      client_id: clientId,
      month: month, // send as-is; upsert normalises to YYYY-MM-01
      mrr: parseFloat(mrr) || 0,
      cac: parseFloat(cac) || 0,
      cost_to_serve: parseFloat(costToServe) || 0,
      ad_spend: parseFloat(adSpend) || 0,
      notes: notes.trim() || null,
      created_by: null,
    });
    const err = result as { message?: string } | null | undefined;
    if (err && typeof err === "object" && err.message) {
      setSaveError(err.message);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    }
  }

  const marginPreview =
    (parseFloat(mrr) || 0) - (parseFloat(costToServe) || 0) - (parseFloat(adSpend) || 0);
  const marginPct =
    (parseFloat(mrr) || 0) > 0
      ? ((marginPreview / (parseFloat(mrr) || 1)) * 100).toFixed(1)
      : "0";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Month */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Mês de referência</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            required
            className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Revenue + costs */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">MRR (R$)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0,00"
            value={mrr}
            onChange={(e) => setMrr(e.target.value)}
            className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">CAC (R$)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0,00"
            value={cac}
            onChange={(e) => setCac(e.target.value)}
            className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Verba Ads (R$)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0,00"
            value={adSpend}
            onChange={(e) => setAdSpend(e.target.value)}
            className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Custo de Servir (R$)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            placeholder="0,00"
            value={costToServe}
            onChange={(e) => setCostToServe(e.target.value)}
            className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Team cost calculator */}
      {members.length > 0 && (
        <div className="glass rounded-xl p-3 border border-border/40">
          <button
            type="button"
            onClick={() => setShowTeam(!showTeam)}
            className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>Calcular custo de servir pelo time</span>
            {showTeam ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showTeam && (
            <div className="mt-3">
              <TeamCostBreaker members={members} onCostChange={handleTeamCost} />
            </div>
          )}
        </div>
      )}

      {/* Margin preview */}
      {(parseFloat(mrr) || 0) > 0 && (
        <div className={`flex items-center justify-between text-xs px-3 py-2 rounded-xl ${
          marginPreview >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
        }`}>
          <span>Margem de contribuição prévia</span>
          <span className="font-bold">
            R$ {marginPreview.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} ({marginPct}%)
          </span>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Observações (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Contexto do mês, ações realizadas..."
          className="w-full bg-secondary/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
        />
      </div>

      {saveError && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{saveError}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-medium transition-colors"
      >
        <Save size={13} />
        {saving ? "Salvando…" : success ? "✓ Salvo!" : "Salvar mês"}
      </button>
    </form>
  );
}
