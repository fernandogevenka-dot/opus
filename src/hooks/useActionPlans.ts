import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export type ActionPlanStatus = "aberto" | "em_andamento" | "concluido" | "cancelado";
export type GargaloTipo = "retencao" | "expansao" | "aquisicao" | "ok" | "manual";

export interface ActionPlan {
  id: string;
  gargalo_tipo: GargaloTipo;
  problema: string;
  hipotese: string | null;
  acao: string;
  owner: string | null;
  prazo: string | null;        // ISO date
  metrica_sucesso: string | null;
  status: ActionPlanStatus;
  resultado: string | null;
  mbr_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ActionPlanInput = Omit<ActionPlan, "id" | "created_at" | "updated_at">;

const GARGALO_LABELS: Record<GargaloTipo, string> = {
  retencao:  "Retenção",
  expansao:  "Expansão",
  aquisicao: "Aquisição",
  ok:        "Geral",
  manual:    "Manual",
};

export { GARGALO_LABELS };

export function useActionPlans() {
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("action_plans")
      .select("*")
      .order("created_at", { ascending: false });
    setPlans((data as ActionPlan[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const createPlan = useCallback(async (input: Omit<ActionPlanInput, "status" | "resultado">) => {
    const { data, error } = await supabase
      .from("action_plans")
      .insert({ ...input, status: "aberto", resultado: null })
      .select()
      .single();
    if (!error && data) setPlans((prev) => [data as ActionPlan, ...prev]);
    return { data, error };
  }, []);

  const updatePlan = useCallback(async (id: string, fields: Partial<ActionPlan>) => {
    const { data, error } = await supabase
      .from("action_plans")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (!error && data) {
      setPlans((prev) => prev.map((p) => (p.id === id ? (data as ActionPlan) : p)));
    }
    return { data, error };
  }, []);

  const deletePlan = useCallback(async (id: string) => {
    const { error } = await supabase.from("action_plans").delete().eq("id", id);
    if (!error) setPlans((prev) => prev.filter((p) => p.id !== id));
    return { error };
  }, []);

  // Helpers
  const openPlans = plans.filter((p) => p.status === "aberto" || p.status === "em_andamento");
  const closedPlans = plans.filter((p) => p.status === "concluido" || p.status === "cancelado");

  return { plans, openPlans, closedPlans, loading, refetch: fetchPlans, createPlan, updatePlan, deletePlan };
}
