import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Collaborator {
  id: string;
  noco_id?: number;
  name: string;
  full_name?: string;
  role?: string;
  area?: string;
  seniority?: string;
  format?: string;
  email?: string;
  whatsapp?: string;
  cnpj?: string;
  pix?: string;
  remuneration?: number;
  commission_pct?: number;
  start_date?: string;
  end_date?: string;
  birth_date?: string;
  squad_name?: string;
  squad_id?: string;
  user_id?: string;
  ekyte_task_type?: number;
  payment_day?: number;
  alert_status?: string;
  status: string;
  created_at: string;
  updated_at: string;
  squads?: { name: string };
}

export interface CollaboratorFormData {
  name: string;
  full_name?: string;
  role?: string;
  area?: string;
  seniority?: string;
  format?: string;
  email?: string;
  whatsapp?: string;
  cnpj?: string;
  pix?: string;
  remuneration?: number;
  commission_pct?: number;
  start_date?: string;
  end_date?: string;
  birth_date?: string;
  squad_id?: string;
  squad_name?: string;
  user_id?: string;
  payment_day?: number;
  status?: string;
}

export const AREAS = ["PE&G", "CS", "Financeiro", "Administrativo", "Tech", "Comercial", "RH"];
export const FUNCOES = [
  "Account Manager",
  "Gestor de Tráfego",
  "Designer Gráfico",
  "Social Media",
  "Web Designer",
  "Especialista CRM",
  "Coordenador de PE&G",
  "Coordenador de CS",
  "Gerente",
  "Diretor",
  "Auxiliar Administrativo",
  "Financeiro",
  "Desenvolvedor",
];
export const SENIORIDADES = ["Estagiário", "Junior", "Pleno", "Senior", "Especialista", "Liderança"];
export const FORMATOS = ["CLT", "PJ", "Estágio", "Parceiro"];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCollaborators() {
  const { user } = useAuthStore();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCollaborators = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("collaborators")
        .select(`*, squads:squad_id(name)`)
        .order("name");

      if (err) throw err;

      const mapped = (data || []).map((c: Collaborator & { squads?: { name: string } }) => ({
        ...c,
        squad_name: c.squad_name || c.squads?.name,
      }));

      setCollaborators(mapped);
    } catch (e: unknown) {
      console.error("useCollaborators load error:", e);
      setError(e instanceof Error ? e.message : "Erro ao carregar colaboradores");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadCollaborators();
  }, [user, loadCollaborators]);

  const saveCollaborator = useCallback(async (data: CollaboratorFormData, id?: string) => {
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error: err } = await supabase.from("collaborators").update(payload).eq("id", id);
      if (err) throw err;
    } else {
      const { error: err } = await supabase.from("collaborators").insert([{ ...payload, status: "active" }]);
      if (err) throw err;
    }
    await loadCollaborators();
  }, [loadCollaborators]);

  const deleteCollaborator = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from("collaborators")
      .update({ status: "inactive", end_date: new Date().toISOString().split("T")[0] })
      .eq("id", id);
    if (err) throw err;
    await loadCollaborators();
  }, [loadCollaborators]);

  // Stats
  const active = collaborators.filter((c) => c.status === "active" && !c.end_date);
  const totalRemuneration = active.reduce((sum, c) => sum + (c.remuneration || 0), 0);

  const byArea = AREAS.reduce((acc, area) => {
    acc[area] = active.filter((c) => c.area === area).length;
    return acc;
  }, {} as Record<string, number>);

  const bySquad = collaborators.reduce((acc, c) => {
    const s = c.squad_name || "Sem Squad";
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    collaborators,
    active,
    loading,
    error,
    totalRemuneration,
    byArea,
    bySquad,
    loadCollaborators,
    saveCollaborator,
    deleteCollaborator,
  };
}
