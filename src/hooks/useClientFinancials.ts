import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { ClientFinancial, ClientFinancialSummary } from "@/types";

export function useClientFinancials(clientId: string | null) {
  const [financials, setFinancials] = useState<ClientFinancial[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuthStore();

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("client_financials")
      .select("*")
      .eq("client_id", clientId)
      .order("month", { ascending: true });
    if (!error && data) setFinancials(data as ClientFinancial[]);
    setLoading(false);
  }, [clientId]);

  async function upsert(entry: Omit<ClientFinancial, "id" | "contribution_margin" | "margin_pct" | "created_at" | "updated_at">) {
    if (!clientId || !user) return;
    setSaving(true);

    // month always normalised to first day of month
    const monthNorm = entry.month.slice(0, 7) + "-01";

    const { error } = await supabase
      .from("client_financials")
      .upsert(
        { ...entry, client_id: clientId, month: monthNorm, created_by: user.id },
        { onConflict: "client_id,month" }
      );

    if (!error) await load();
    setSaving(false);
    return error;
  }

  async function remove(id: string) {
    const { error } = await supabase
      .from("client_financials")
      .delete()
      .eq("id", id);
    if (!error) setFinancials((prev) => prev.filter((f) => f.id !== id));
    return error;
  }

  const summary: ClientFinancialSummary | null =
    financials.length === 0
      ? null
      : (() => {
          const ltv_accumulated = financials.reduce((s, f) => s + (f.mrr ?? 0), 0);
          const cac_total = financials.reduce((s, f) => s + (f.cac ?? 0), 0);
          const mrr_values = financials.map((f) => f.mrr).filter((v) => v > 0);
          const mrr_avg = mrr_values.length ? mrr_values.reduce((a, b) => a + b, 0) / mrr_values.length : 0;
          const payback_months = cac_total > 0 && mrr_avg > 0 ? Math.ceil(cac_total / mrr_avg) : null;
          const margins = financials.map((f) => f.margin_pct ?? 0);
          const avg_margin_pct = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
          const sorted_margin = [...financials].sort((a, b) => (b.margin_pct ?? 0) - (a.margin_pct ?? 0));
          const total_ad_spend = financials.reduce((s, f) => s + (f.ad_spend ?? 0), 0);
          const avg_cost_to_serve =
            financials.length
              ? financials.reduce((s, f) => s + (f.cost_to_serve ?? 0), 0) / financials.length
              : 0;

          return {
            ltv_accumulated,
            cac_total,
            payback_months,
            avg_margin_pct,
            best_month: sorted_margin[0] ?? null,
            worst_month: sorted_margin[sorted_margin.length - 1] ?? null,
            total_ad_spend,
            avg_cost_to_serve,
          };
        })();

  return { financials, loading, saving, load, upsert, remove, summary };
}
