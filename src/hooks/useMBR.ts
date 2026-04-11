import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { GargaloTipo } from "./useActionPlans";

export interface MBRSession {
  id: string;
  mes: string;                     // "YYYY-MM"
  mrr_snapshot: number | null;
  grr_snapshot: number | null;
  nrr_snapshot: number | null;
  churn_snapshot: number | null;
  crescimento_snapshot: number | null;
  horizonte_snapshot: string | null;
  gargalo_identificado: GargaloTipo | null;
  gargalo_notas: string | null;
  participantes: string | null;
  notas_gerais: string | null;
  created_at: string;
  updated_at: string;
}

export type MBRInput = Omit<MBRSession, "id" | "created_at" | "updated_at">;

export function useMBR() {
  const [sessions, setSessions] = useState<MBRSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("mbr_sessions")
      .select("*")
      .order("mes", { ascending: false });
    setSessions((data as MBRSession[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Current month "YYYY-MM"
  const currentMes = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();

  const currentSession = sessions.find((s) => s.mes === currentMes) ?? null;

  const upsertSession = useCallback(async (fields: Partial<MBRInput> & { mes: string }) => {
    const existing = sessions.find((s) => s.mes === fields.mes);
    if (existing) {
      const { data, error } = await supabase
        .from("mbr_sessions")
        .update(fields)
        .eq("id", existing.id)
        .select()
        .single();
      if (!error && data) {
        setSessions((prev) => prev.map((s) => (s.id === existing.id ? (data as MBRSession) : s)));
      }
      return { data, error };
    } else {
      const { data, error } = await supabase
        .from("mbr_sessions")
        .insert(fields)
        .select()
        .single();
      if (!error && data) {
        setSessions((prev) => [data as MBRSession, ...prev]);
      }
      return { data, error };
    }
  }, [sessions]);

  return { sessions, currentSession, currentMes, loading, refetch: fetchSessions, upsertSession };
}
