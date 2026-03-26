import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Checkin {
  id: string;
  noco_id?: number;
  client_id?: string;
  project_id?: string;
  data?: string;
  demanda_dentro_expectativa?: string;
  faturamento_mapeado?: string;
  stakeholder_consciente?: string;
  bom_relacionamento?: string;
  stakeholder_participando?: string;
  houve_queixa?: string;
  planejamento_cumprido?: string;
  numero_vendas?: number;
  faturamento_mes?: number;
  leads?: number;
  oportunidades?: number;
  resultado_score?: string;
  relacionamento_score?: string;
  entregas_score?: string;
  status_atual?: string;
  ata?: string;
  todo?: string;
  comunicacao_whatsapp?: string;
  transcricao_url?: string;
  gravacao_url?: string;
  squad?: string;
  account_manager?: string;
  gestor_trafego?: string;
  created_at: string;
  // joined
  clients?: { name: string };
}

export interface NpsRecord {
  id: string;
  client_id?: string;
  nota?: number;
  comentario?: string;
  data?: string;
  created_at: string;
  clients?: { name: string };
}

export interface CsatRecord {
  id: string;
  client_id?: string;
  copys?: number;
  designs?: number;
  resultados?: number;
  prazos?: number;
  gestao_campanhas?: number;
  geral?: number;
  comentario?: string;
  data?: string;
  created_at: string;
  clients?: { name: string };
}

export interface Meta {
  id: string;
  client_id?: string;
  meta?: number;
  tipo_meta?: string;
  data?: string;
  created_at: string;
  clients?: { name: string };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCheckins(clientId?: string) {
  const { user } = useAuthStore();
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [npsRecords, setNpsRecords] = useState<NpsRecord[]>([]);
  const [csatRecords, setCsatRecords] = useState<CsatRecord[]>([]);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filter = clientId ? { eq: ["client_id", clientId] } : null;

      // Load all in parallel
      const [checkinsRes, npsRes, csatRes, metasRes] = await Promise.all([
        supabase
          .from("checkins")
          .select("*, clients:client_id(name)")
          .order("data", { ascending: false })
          .limit(200),
        supabase
          .from("nps_records")
          .select("*, clients:client_id(name)")
          .order("data", { ascending: false })
          .limit(200),
        supabase
          .from("csat_records")
          .select("*, clients:client_id(name)")
          .order("data", { ascending: false })
          .limit(200),
        supabase
          .from("metas")
          .select("*, clients:client_id(name)")
          .order("data", { ascending: false })
          .limit(200),
      ]);

      const filterByClient = <T extends { client_id?: string }>(data: T[]) =>
        clientId ? data.filter((r) => r.client_id === clientId) : data;

      setCheckins(filterByClient(checkinsRes.data || []));
      setNpsRecords(filterByClient(npsRes.data || []));
      setCsatRecords(filterByClient(csatRes.data || []));
      setMetas(filterByClient(metasRes.data || []));
    } catch (e) {
      console.error("useCheckins load error:", e);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Computed NPS
  const avgNps =
    npsRecords.length > 0
      ? Math.round(npsRecords.reduce((s, r) => s + (r.nota || 0), 0) / npsRecords.length)
      : null;

  const avgCsat =
    csatRecords.length > 0
      ? Math.round(
          (csatRecords.reduce((s, r) => s + (r.geral || 0), 0) / csatRecords.length) * 10
        ) / 10
      : null;

  const saveCheckin = useCallback(
    async (data: Partial<Checkin>, id?: string) => {
      const payload = { ...data, updated_at: new Date().toISOString() };
      if (id) {
        await supabase.from("checkins").update(payload).eq("id", id);
      } else {
        await supabase.from("checkins").insert([payload]);
      }
      await load();
    },
    [load]
  );

  const saveNps = useCallback(
    async (data: Partial<NpsRecord>, id?: string) => {
      if (id) {
        await supabase.from("nps_records").update(data).eq("id", id);
      } else {
        await supabase.from("nps_records").insert([data]);
      }
      await load();
    },
    [load]
  );

  const saveCsat = useCallback(
    async (data: Partial<CsatRecord>, id?: string) => {
      if (id) {
        await supabase.from("csat_records").update(data).eq("id", id);
      } else {
        await supabase.from("csat_records").insert([data]);
      }
      await load();
    },
    [load]
  );

  const saveMeta = useCallback(
    async (data: Partial<Meta>, id?: string) => {
      if (id) {
        await supabase.from("metas").update(data).eq("id", id);
      } else {
        await supabase.from("metas").insert([data]);
      }
      await load();
    },
    [load]
  );

  return {
    checkins,
    npsRecords,
    csatRecords,
    metas,
    loading,
    avgNps,
    avgCsat,
    reload: load,
    saveCheckin,
    saveNps,
    saveCsat,
    saveMeta,
  };
}
