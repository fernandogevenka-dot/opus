import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Squad {
  id: string;
  noco_id?: number;
  name: string;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
  // enriched
  member_count?: number;
  project_count?: number;
  total_mrr?: number;
  members?: SquadMember[];
  projects?: SquadProjectDetail[];
}

export interface SquadMember {
  id: string;
  user_id?: string | null;
  name: string;
  full_name?: string;
  role?: string;
  area?: string;
  seniority?: string;
  remuneration?: number;
  email?: string;
  whatsapp?: string;
  avatar_url?: string | null;
}

export interface SquadProjectDetail {
  id: string;
  name: string;
  client_name?: string;
  mrr?: number;
  momento?: string;
  squad_id?: string;
  squad_name?: string;
  start_date?: string | null;
  end_date?: string | null;
  margem_bruta?: number | null; // percentual, ex: 65 = 65%
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSquadsData() {
  const { user } = useAuthStore();
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSquads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Load squads
      const { data: squadsData, error: squadsErr } = await supabase
        .from("squads")
        .select("*")
        .order("name");

      if (squadsErr) throw squadsErr;

      // Load collaborators with squad info
      const { data: collabs } = await supabase
        .from("collaborators")
        .select("id, user_id, name, full_name, role, area, seniority, remuneration, email, whatsapp, squad_id, squad_name, status")
        .eq("status", "active");

      // Load all projects with squad info (active + historical for margin view)
      const { data: projs } = await supabase
        .from("projects")
        .select("id, name, mrr, squad_id, squad_name, momento, client_name, start_date, end_date, margem_bruta")
        .order("start_date", { ascending: false });

      const ACTIVE_MOMENTOS = ["♾️ Ongoing", "🛫 Onboarding", "⚙️ Implementação", "⏰ Atrasado", "⏳ A Iniciar", "⏳ Aviso Prévio"];

      const enriched = (squadsData || []).map((squad: Squad) => {
        const members = (collabs || []).filter(
          (c) => c.squad_id === squad.id || c.squad_name === squad.name
        );
        const squadProjects = (projs || []).filter(
          (p) => p.squad_id === squad.id || p.squad_name === squad.name
        ) as SquadProjectDetail[];
        const activeProjects = squadProjects.filter((p) =>
          ACTIVE_MOMENTOS.includes(p.momento ?? "")
        );
        return {
          ...squad,
          members,
          projects: squadProjects,
          member_count: members.length,
          project_count: activeProjects.length,
          total_mrr: activeProjects.reduce((s, p) => s + (p.mrr || 0), 0),
        };
      });

      setSquads(enriched);
    } catch (e: unknown) {
      console.error("useSquadsData load error:", e);
      setError(e instanceof Error ? e.message : "Erro ao carregar squads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadSquads();
  }, [user, loadSquads]);

  const saveSquad = useCallback(async (name: string, id?: string, avatar_url?: string | null) => {
    if (id) {
      const payload: Record<string, unknown> = { name, updated_at: new Date().toISOString() };
      if (avatar_url !== undefined) payload.avatar_url = avatar_url;
      const { error: err } = await supabase.from("squads").update(payload).eq("id", id);
      if (err) throw err;
    } else {
      const { error: err } = await supabase.from("squads").insert([{ name, avatar_url: avatar_url ?? null }]);
      if (err) throw err;
    }
    await loadSquads();
  }, [loadSquads]);

  const deleteSquad = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("squads").delete().eq("id", id);
    if (err) throw err;
    await loadSquads();
  }, [loadSquads]);

  const totalMRR = squads.reduce((s, sq) => s + (sq.total_mrr || 0), 0);
  const totalMembers = squads.reduce((s, sq) => s + (sq.member_count || 0), 0);

  return {
    squads,
    loading,
    error,
    totalMRR,
    totalMembers,
    loadSquads,
    saveSquad,
    deleteSquad,
  };
}
