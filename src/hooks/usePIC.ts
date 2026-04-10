import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface PICCycle {
  id: string;
  client_id: string;
  cycle_number: number;
  start_date: string;       // ISO date
  end_date: string;         // ISO date (start + 90 days)
  status: "active" | "completed" | "cancelled";

  objetivo_principal: string | null;
  acoes_acordadas: string | null;
  metricas_sucesso: string | null;

  resultado_atingido: string | null;
  aprendizados: string | null;
  score_entrega: number | null;   // 0-10

  created_at: string;
  updated_at: string;
}

export type PICCycleInput = Omit<PICCycle, "id" | "created_at" | "updated_at">;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function usePIC(clientId: string) {
  const [cycles, setCycles] = useState<PICCycle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pic_cycles")
      .select("*")
      .eq("client_id", clientId)
      .order("cycle_number", { ascending: true });
    setCycles((data as PICCycle[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    if (clientId) fetch();
  }, [clientId, fetch]);

  // Cycle em aberto (active)
  const activeCycle = cycles.find((c) => c.status === "active") ?? null;

  // Dias restantes no ciclo atual
  const daysRemaining = activeCycle
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeCycle.end_date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  // Abre um novo ciclo (90 dias a partir de hoje)
  const openCycle = useCallback(async () => {
    if (activeCycle) return { error: "Já existe um ciclo ativo." };
    const today = new Date().toISOString().slice(0, 10);
    const nextNumber = cycles.length + 1;
    const { data, error } = await supabase
      .from("pic_cycles")
      .insert({
        client_id: clientId,
        cycle_number: nextNumber,
        start_date: today,
        end_date: addDays(today, 90),
        status: "active",
      })
      .select()
      .single();
    if (!error) setCycles((prev) => [...prev, data as PICCycle]);
    return { data, error };
  }, [clientId, cycles, activeCycle]);

  // Salva campos do ciclo ativo (objetivo, ações, métricas)
  const updateCycle = useCallback(
    async (id: string, fields: Partial<PICCycle>) => {
      const { data, error } = await supabase
        .from("pic_cycles")
        .update(fields)
        .eq("id", id)
        .select()
        .single();
      if (!error) {
        setCycles((prev) =>
          prev.map((c) => (c.id === id ? (data as PICCycle) : c))
        );
      }
      return { data, error };
    },
    []
  );

  // Fecha e revisa o ciclo ativo
  const closeCycle = useCallback(
    async (
      id: string,
      review: {
        resultado_atingido: string;
        aprendizados: string;
        score_entrega: number;
      }
    ) => {
      const { data, error } = await supabase
        .from("pic_cycles")
        .update({ ...review, status: "completed" })
        .eq("id", id)
        .select()
        .single();
      if (!error) {
        setCycles((prev) =>
          prev.map((c) => (c.id === id ? (data as PICCycle) : c))
        );
      }
      return { data, error };
    },
    []
  );

  return {
    cycles,
    activeCycle,
    daysRemaining,
    loading,
    refetch: fetch,
    openCycle,
    updateCycle,
    closeCycle,
  };
}
