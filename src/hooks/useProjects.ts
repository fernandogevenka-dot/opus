import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  noco_id?: number;
  name: string;
  client_id?: string;
  client_name?: string;
  squad_id?: string;
  squad_name?: string;
  mrr: number;
  estruturacao_estrategica?: number;
  variavel?: number;
  investimento?: number;
  margem_bruta?: number;
  ticket_medio?: number;
  gestor_projeto?: string;
  gestor_trafego?: string;
  momento?: string;
  fase_atual?: string;
  prioridade?: string;
  risco?: string;
  tem_social_media?: string;
  usa: boolean;
  start_date?: string;
  end_date?: string;
  aviso_previo_date?: string;
  ultimo_dia_servico?: string;
  churn_date?: string;
  inicio_ee?: string;
  fim_ee?: string;
  step?: string;
  produtos?: string[];
  pasta_publica?: string;
  pasta_privada?: string;
  crm_url?: string;
  sistema_dados_url?: string;
  contrato_url?: string;
  pic_url?: string;
  sprint_url?: string;
  meta_ads_id?: string;
  google_ads_id?: string;
  ekyte_id?: number;
  wa_group_id?: string;
  taxa_conversao?: number;
  proposta_apresentada?: string;
  noco_updated_at?: string;
  billing_type?: "recurring" | "one_time";
  contract_duration?: string | null;
  desconto_total?: number | null;
  fase_ter?: string | null;
  fase_saber?: string | null;
  // Campos de ritmo Saber (espelho do Notion)
  inicio_realizado?: string | null;
  fim_realizado?: string | null;
  proxima_entrega?: string | null;
  semana_atual?: number | null;
  semana_ritmo?: number | null;
  // Jornada HOps
  jornada_fase?: string | null;
  // Campos de detalhe (estilo HOps)
  escopo?: string | null;
  observacoes?: string | null;
  tier?: string | null;
  saude?: "saudavel" | "atencao" | "critico" | null;
  created_at: string;
  updated_at: string;
  // Joined
  clients?: { name: string };
  squads?: { name: string };
}

export interface ProjectFormData {
  name: string;
  client_id?: string;
  squad_id?: string;
  squad_name?: string;
  // Jornada/categoria do projeto: saber | ter | executar | executar-onboarding | executar-implementacoes
  step?: string;
  mrr?: number;
  investimento?: number;
  margem_bruta?: number;
  gestor_projeto?: string;
  gestor_trafego?: string;
  momento?: string;
  prioridade?: string;
  risco?: string;
  usa?: boolean;
  start_date?: string;
  end_date?: string;
  // Duração do contrato (substitui end_date manual): "one_time" | "6" | "12"
  contract_duration?: string;
  // Desconto total aplicado nos produtos (valor absoluto)
  desconto_total?: number;
  // Fase dentro da jornada HOps
  jornada_fase?: string | null;
  produtos?: string[];
  pasta_publica?: string;
  pasta_privada?: string;
  crm_url?: string;
  pic_url?: string;
  sprint_url?: string;
  meta_ads_id?: string;
  google_ads_id?: string;
  wa_group_id?: string;
  taxa_conversao?: number;
}

export type ProjectMomento =
  | "♾️ Ongoing"
  | "🛫 Onboarding"
  | "⚙️ Implementação"
  | "⏳ A Iniciar"
  | "⏳ Aviso Prévio"
  | "💲 Pausado - Financeiro"
  | "🟡 Concluído - Negociação"
  | "🟢 Concluído - Cross Sell"
  | "🟣 Concluído - Churn"
  | "🟣 Concluído - Reembolso"
  | "❌ Cancelado"
  | "⏸️ Inativo";

export const MOMENTO_LABELS: ProjectMomento[] = [
  "⏳ A Iniciar",
  "🛫 Onboarding",
  "⚙️ Implementação",
  "♾️ Ongoing",
  "⏳ Aviso Prévio",
  "💲 Pausado - Financeiro",
  "🟡 Concluído - Negociação",
  "🟢 Concluído - Cross Sell",
  "🟣 Concluído - Churn",
  "🟣 Concluído - Reembolso",
  "❌ Cancelado",
  "⏸️ Inativo",
];

export const ACTIVE_MOMENTOS: ProjectMomento[] = [
  "⏳ A Iniciar",
  "🛫 Onboarding",
  "⚙️ Implementação",
  "♾️ Ongoing",
  "⏳ Aviso Prévio",
  "💲 Pausado - Financeiro",
];

export const PRODUTOS_LIST = [
  "Profissional de Gestão de Mídia Paga",
  "Profissional de Designer Gráfico",
  "Profissional de CRM",
  "Profissional de Social Media",
  "Profissional de Web Design",
  "Implementação de CRM",
  "Implementação de Site",
  "Implementação de Landing Page",
  "Manutenção Landing Page",
  "Manutenção Preventiva para Sites",
  "Estruturação Estratégica",
  "Gestão de Projetos Avançada",
  "Criativos Básicos",
  "Ambiente Essencial",
  "Google + Social Ads",
  "Diagnóstico e Planejamento de Marketing e Vendas no Digital",
];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProjects() {
  const { user } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("projects")
        .select(`
          *,
          clients:client_id(name),
          squads:squad_id(name)
        `)
        .order("updated_at", { ascending: false });

      if (err) throw err;

      const mapped = (data || []).map((p: Project & { clients?: { name: string }; squads?: { name: string } }) => ({
        ...p,
        client_name: p.clients?.name,
        squad_name: p.squad_name || p.squads?.name,
      }));

      setProjects(mapped);
    } catch (e: unknown) {
      console.error("useProjects load error:", e);
      setError(e instanceof Error ? e.message : "Erro ao carregar projetos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadProjects();
  }, [user, loadProjects]);

  const saveProject = useCallback(async (data: ProjectFormData, id?: string) => {
    const payload = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    async function tryUpdate(p: Record<string, unknown>) {
      if (id) {
        return supabase.from("projects").update(p).eq("id", id);
      } else {
        return supabase.from("projects").insert([p]);
      }
    }

    let { error: err } = await tryUpdate(payload);

    // Se o erro for de coluna inexistente (contract_duration / desconto_total ainda não migrados),
    // tenta novamente sem esses campos para não bloquear o usuário
    if (err && (err.message?.includes("contract_duration") || err.message?.includes("desconto_total") || err.message?.includes("jornada_fase") || err.code === "PGRST204" || err.code === "42703")) {
      console.warn("saveProject: coluna nova ausente no banco, salvando sem ela:", err.message);
      const { contract_duration: _cd, desconto_total: _dt, jornada_fase: _jf, ...payloadFallback } = payload as typeof payload & { contract_duration?: unknown; desconto_total?: unknown; jornada_fase?: unknown };
      void _cd; void _dt; void _jf;
      const res2 = await tryUpdate(payloadFallback as Record<string, unknown>);
      err = res2.error;
    }

    if (err) {
      console.error("saveProject error:", err);
      throw new Error(err.message || "Erro ao salvar projeto");
    }

    await loadProjects();
  }, [loadProjects]);

  const deleteProject = useCallback(async (id: string) => {
    const { error: err } = await supabase.from("projects").delete().eq("id", id);
    if (err) throw err;
    await loadProjects();
  }, [loadProjects]);

  const updateMomento = useCallback(async (id: string, momento: string) => {
    const { error: err } = await supabase
      .from("projects")
      .update({ momento, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (err) throw err;
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, momento } : p)));
  }, []);

  const updateJornadaFase = useCallback(async (id: string, fase: string | null) => {
    const { error: err } = await supabase
      .from("projects")
      .update({ jornada_fase: fase, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (err) throw err;
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, jornada_fase: fase } : p)));
  }, []);

  const updateFase = useCallback(async (id: string, field: "fase_ter" | "fase_saber", value: string | null) => {
    const { error: err } = await supabase
      .from("projects")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (err) throw err;
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  }, []);

  // Aggregated stats
  const stats = {
    total: projects.length,
    active: projects.filter((p) => ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento)).length,
    totalMRR: projects
      .filter((p) => ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento))
      .reduce((sum, p) => sum + (p.mrr || 0), 0),
    byMomento: MOMENTO_LABELS.reduce((acc, m) => {
      acc[m] = projects.filter((p) => p.momento === m).length;
      return acc;
    }, {} as Record<string, number>),
  };

  return {
    projects,
    loading,
    error,
    stats,
    loadProjects,
    saveProject,
    deleteProject,
    updateMomento,
    updateFase,
    updateJornadaFase,
  };
}
