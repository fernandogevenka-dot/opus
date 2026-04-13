import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { Client, ClientInteraction } from "@/types";

export interface CSFilters {
  status?: Client["status"] | "all";
  region?: string;
  segment?: string;
  search?: string;
}

export interface ClientProject {
  id: string;
  name: string;
  mrr: number;
  step?: string | null;
  momento?: string;
  squad_name?: string;
  start_date?: string | null;
  end_date?: string | null;
  produtos?: string[];
  estruturacao_estrategica?: number;
  variavel?: number;
  investimento?: number;
  margem_bruta?: number;
}

export interface ClientDetail extends Client {
  interactions: ClientInteraction[];
  contracted_products: ContractedProduct[];
  surveys: Survey[];
  contracts: Contract[];
  team_members: TeamMember[];
  projects: ClientProject[];
}

export interface ContractedProduct {
  id: string;
  client_id: string;
  product: string;
  description: string;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "cancelled" | "suspended" | "renewal_due";
  source: string;
  contract_id: string | null;
  created_at: string;
}

export interface Survey {
  id: string;
  client_id: string;
  title: string;
  type: "nps" | "csat" | "ces" | "custom";
  period: string;
  score: number | null;
  respondent: string;
  answers: Record<string, string>;
  file_path: string | null;
  applied_at: string;
}

export interface Contract {
  id: string;
  client_id: string;
  title: string;
  file_path: string;
  file_name: string;
  signed_date: string | null;
  expiry_date: string | null;
  total_value: number | null;
  status: string;
  products_parsed: boolean;
  parsed_at: string | null;
  created_at: string;
}

export interface TeamMember {
  user_id: string;
  role: string;
  user?: { id: string; name: string; avatar_url: string };
}

export function useCustomerSuccess() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<CSFilters>({ status: "all" });
  const [regions, setRegions] = useState<string[]>([]);
  const [segments, setSegments] = useState<string[]>([]);
  const { user } = useAuthStore();

  useEffect(() => {
    loadClients();
    loadFilterOptions();
  }, [filters]);

  async function loadClients() {
    setLoading(true);
    let query = supabase
      .from("clients")
      .select(`
        *,
        account_manager:users!account_manager_id(id, name, avatar_url),
        cs_team:users!cs_team_id(id, name, avatar_url)
      `)
      .order("name");

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters.region) query = query.eq("region", filters.region);
    if (filters.segment) query = query.eq("segment", filters.segment);
    if (filters.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }

    const { data } = await query;
    if (data) {
      // Recalcular journey_stage pelo tempo real decorrido desde operation_start_date.
      // Isso garante que clientes antigos (com journey_stage salvo desatualizado) se
      // movam automaticamente para a coluna correta sem precisar de update manual.
      const withRecalc = (data as Client[]).map((c) => ({
        ...c,
        journey_stage: calcJourneyStage(c.operation_start_date) || c.journey_stage || "onboarding",
      }));
      setClients(withRecalc);
    }
    setLoading(false);
  }

  async function loadFilterOptions() {
    const { data: regionData } = await supabase
      .from("clients")
      .select("region")
      .not("region", "is", null);
    const { data: segmentData } = await supabase
      .from("clients")
      .select("segment")
      .not("segment", "is", null);

    const uniqueRegions = [...new Set((regionData ?? []).map((r) => r.region).filter(Boolean))];
    const uniqueSegments = [...new Set((segmentData ?? []).map((s) => s.segment).filter(Boolean))];
    setRegions(uniqueRegions);
    setSegments(uniqueSegments);
  }

  async function loadClientDetail(clientId: string): Promise<ClientDetail | null> {
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .single();

    if (clientErr) console.warn("loadClientDetail clients error:", clientErr.message);
    if (!client) return null;

    // Recalcular journey_stage no detalhe também
    const clientWithJourney = {
      ...client,
      journey_stage: calcJourneyStage(client.operation_start_date) || client.journey_stage || "onboarding",
    };

    // Tabelas secundárias: tolerante a erros, com timeout de 5s por query
    async function safeQuery<T>(queryPromise: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
      try {
        const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(() => resolve({ data: null, error: new Error("timeout") }), 5000)
        );
        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        if (error) console.warn("loadClientDetail sub-query error:", (error as { message?: string }).message ?? error);
        return data ?? [];
      } catch (e) {
        console.warn("loadClientDetail sub-query exception:", e);
        return [];
      }
    }

    const [interactions, contracted_products, surveys, contracts, team_members, projects] = await Promise.all([
      safeQuery<ClientInteraction>(
        supabase
          .from("client_interactions")
          .select("*, author:users(id, name, avatar_url)")
          .eq("client_id", clientId)
          .order("happened_at", { ascending: false })
      ),
      safeQuery<ContractedProduct>(
        supabase
          .from("contracted_products")
          .select("*")
          .eq("client_id", clientId)
          .eq("status", "active")
      ),
      safeQuery<Survey>(
        supabase
          .from("surveys")
          .select("*")
          .eq("client_id", clientId)
          .order("applied_at", { ascending: false })
      ),
      safeQuery<Contract>(
        supabase
          .from("contracts")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
      ),
      safeQuery<TeamMember>(
        supabase
          .from("client_team_members")
          .select("*, user:users(id, name, avatar_url)")
          .eq("client_id", clientId)
      ),
      safeQuery<ClientProject>(
        supabase
          .from("projects")
          .select("id, name, mrr, step, momento, squad_name, start_date, end_date, produtos, estruturacao_estrategica, variavel, investimento, margem_bruta")
          .eq("client_id", clientId)
          .order("start_date", { ascending: true })
      ),
    ]);

    return {
      ...clientWithJourney,
      interactions,
      contracted_products,
      surveys,
      contracts,
      team_members,
      projects,
    };
  }

  async function addInteraction(
    clientId: string,
    type: ClientInteraction["type"],
    title: string,
    notes: string,
    value?: number,
    product?: string
  ) {
    if (!user) return;
    await supabase.from("client_interactions").insert({
      client_id: clientId,
      type,
      title,
      notes,
      value,
      product,
      author_id: user.id,
      happened_at: new Date().toISOString(),
    });
  }

  async function uploadContract(clientId: string, file: File, title: string, signedDate?: string) {
    if (!user) return null;
    const filePath = `contracts/${clientId}/${Date.now()}_${file.name}`;

    const { error: uploadErr } = await supabase.storage
      .from("contracts")
      .upload(filePath, file);
    if (uploadErr) throw uploadErr;

    const { data } = await supabase.from("contracts").insert({
      client_id: clientId,
      title,
      file_path: filePath,
      file_name: file.name,
      signed_date: signedDate ?? null,
      uploaded_by: user.id,
    }).select().single();

    return data;
  }

  async function parseContractWithAI(contractId: string) {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-contract`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ contract_id: contractId }),
      }
    );
    return resp.json();
  }

  async function uploadSurvey(
    clientId: string,
    file: File,
    type: "nps" | "csat" | "ces" | "custom",
    period: string,
    respondent: string
  ) {
    if (!user) return null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("client_id", clientId);
    formData.append("type", type);
    formData.append("period", period);
    formData.append("respondent", respondent);
    formData.append("applied_by", user.id);

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-survey`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: formData,
      }
    );
    return resp.json();
  }

  /** Calcula o journey_stage a partir da data de início de operação */
  function calcJourneyStage(operationStartDate: string | null | undefined): string {
    if (!operationStartDate) return "onboarding";
    const start  = new Date(operationStartDate);
    const now    = new Date();
    const months = Math.floor(
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth()) +
      (now.getDate() >= start.getDate() ? 0 : -1)
    );
    if (months <= 0) return "onboarding";
    // Sem teto — LT real independente do número de meses
    return `month_${String(months).padStart(2, "0")}`;
  }

  async function saveClient(data: Partial<Client>) {
    if (!user) return null;

    // Sempre recalcular o journey_stage a partir da operation_start_date
    const journeyStage = calcJourneyStage(data.operation_start_date);

    // Colunas que ainda não existem no banco — remover de qualquer operação
    const MISSING_COLUMNS = [
      "main_product",
      "team_name",
      "situation_color",
      "cargo_responsavel",
      "ultimo_pagamento_date",
      "ultimo_pagamento_valor",
      "contrato_url",
      "roi_url",
      "sales_call_url",
    ] as const;

    if (data.id) {
      const cleanUpdate = { ...(data as Record<string, unknown>) };
      for (const col of MISSING_COLUMNS) delete cleanUpdate[col];

      const { data: updated, error } = await supabase
        .from("clients")
        .update({
          ...cleanUpdate,
          journey_stage: journeyStage,
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id)
        .select()
        .single();
      if (error) {
        console.error("saveClient update error:", error);
        throw new Error(error.message ?? "Erro ao atualizar cliente");
      }
      loadClients().catch((e) => console.warn("loadClients after update failed:", e));
      return updated;
    } else {
      const cleanData = { ...(data as Record<string, unknown>) };
      for (const col of MISSING_COLUMNS) delete cleanData[col];

      // Injeta o journey_stage calculado
      (cleanData as Record<string, unknown>).journey_stage = journeyStage;

      const insertData = {
        mrr: 0,
        arr: 0,
        ltv: 0,
        churn_risk_score: 0,
        tags: [],
        notes: "",
        ...cleanData,
      };
      const { data: created, error } = await supabase
        .from("clients")
        .insert(insertData)
        .select("id, name, status, mrr, nps, created_at, journey_stage, operation_start_date")
        .single();
      if (error) {
        console.error("saveClient insert error:", error);
        throw new Error(error.message ?? "Erro ao cadastrar cliente");
      }
      // Reload in background — don't block the modal from closing
      loadClients().catch((e) => console.warn("loadClients after insert failed:", e));
      return created;
    }
  }

  // Stats overview
  async function getCSStats() {
    const { data } = await supabase
      .from("clients")
      .select("status, mrr, ltv, nps");

    if (!data) return null;

    const active = data.filter((c) => c.status === "active");
    const atRisk = data.filter((c) => c.status === "at_risk");
    const totalMrr = data.reduce((sum, c) => sum + (c.mrr ?? 0), 0);
    const totalLtv = data.reduce((sum, c) => sum + (c.ltv ?? 0), 0);
    const avgNps = data.filter((c) => c.nps !== null).reduce((sum, c, _, arr) =>
      sum + (c.nps ?? 0) / arr.length, 0);

    return { active: active.length, atRisk: atRisk.length, totalMrr, totalLtv, avgNps };
  }

  return {
    clients, loading, filters, regions, segments,
    setFilters, loadClients, loadClientDetail,
    addInteraction, uploadContract, parseContractWithAI,
    uploadSurvey, saveClient, getCSStats,
  };
}
