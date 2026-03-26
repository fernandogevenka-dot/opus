import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ─── Tipos ─────────────────────────────────────────────────────────────────

export type HealthStatus = "healthy" | "attention" | "risk";

export interface GroupHealth {
  score: number;
  status: HealthStatus;
  avg_response_time_minutes: number | null;
  messages_last_7_days: number | null;
  last_client_message_at: string | null;
  ai_summary: string | null;
  ai_alerts: string[] | null;
  computed_at: string;
}

export interface WAGroup {
  id: string;
  jid: string;
  name: string;
  description: string | null;
  picture_url: string | null;
  instance_name: string;
  participant_count: number;
  is_active: boolean;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  health: GroupHealth | null;
}

export interface WAMessage {
  id: string;
  message_id: string | null;
  group_id: string;
  sender_jid: string;
  sender_name: string | null;
  message_type: string;
  body: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  is_from_agent: boolean;
  is_deleted: boolean;
  sent_at: string;
}

export interface WAAlert {
  id: string;
  group_id: string | null;
  alert_type: string;
  message: string;
  is_resolved: boolean;
  created_at: string;
  groups?: { name: string } | null;
}

export interface DashboardStats {
  total_groups: number;
  healthy_groups: number;
  attention_groups: number;
  risk_groups: number;
  total_messages_today: number;
  avg_response_time_minutes: number;
  active_alerts: number;
}

// ─── Hook principal ────────────────────────────────────────────────────────

export function useWhatsAppGroups() {
  const [groups, setGroups] = useState<WAGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<WAGroup | null>(null);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [alerts, setAlerts] = useState<WAAlert[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    total_groups: 0,
    healthy_groups: 0,
    attention_groups: 0,
    risk_groups: 0,
    total_messages_today: 0,
    avg_response_time_minutes: 0,
    active_alerts: 0,
  });
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HealthStatus | "all">("all");
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Carregar grupos ──────────────────────────────────────────────────

  const loadGroups = useCallback(async () => {
    setLoadingGroups(true);
    try {
      let query = supabase
        .from("groups")
        .select(`
          *,
          health:group_health_scores(
            score, status, avg_response_time_minutes,
            messages_last_7_days, last_client_message_at,
            ai_summary, ai_alerts, computed_at
          )
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let groupsWithHealth = (data || []).map((g) => {
        const healthArr = Array.isArray(g.health) ? g.health : [];
        // Pegar o score mais recente
        const latestHealth = healthArr.length > 0
          ? healthArr.reduce((prev: GroupHealth, curr: GroupHealth) =>
              new Date(curr.computed_at) > new Date(prev.computed_at) ? curr : prev
            )
          : null;
        return { ...g, health: latestHealth } as WAGroup;
      });

      // Filtro por status de saúde no frontend
      if (statusFilter !== "all") {
        groupsWithHealth = groupsWithHealth.filter(
          (g) => g.health?.status === statusFilter
        );
      }

      setGroups(groupsWithHealth);
    } catch (err) {
      console.error("[useWhatsAppGroups] loadGroups error:", err);
    } finally {
      setLoadingGroups(false);
    }
  }, [search, statusFilter]);

  // ─── Carregar mensagens ───────────────────────────────────────────────

  const loadMessages = useCallback(async (groupId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("group_id", groupId)
        .eq("is_deleted", false)
        .order("sent_at", { ascending: true })
        .limit(60);

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("[useWhatsAppGroups] loadMessages error:", err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // ─── Carregar alertas ─────────────────────────────────────────────────

  const loadAlerts = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("alerts")
        .select("*, groups(name)")
        .eq("is_resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);
      setAlerts((data || []) as WAAlert[]);
    } catch (err) {
      console.error("[useWhatsAppGroups] loadAlerts error:", err);
    }
  }, []);

  // ─── Calcular stats ───────────────────────────────────────────────────

  const computeStats = useCallback((groupList: WAGroup[], alertList: WAAlert[]) => {
    const healthy = groupList.filter((g) => g.health?.status === "healthy").length;
    const attention = groupList.filter((g) => g.health?.status === "attention").length;
    const risk = groupList.filter((g) => g.health?.status === "risk").length;

    const responseTimes = groupList
      .map((g) => g.health?.avg_response_time_minutes)
      .filter((t): t is number => t !== null && t !== undefined && t > 0);
    const avgResponse =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

    setStats({
      total_groups: groupList.length,
      healthy_groups: healthy,
      attention_groups: attention,
      risk_groups: risk,
      total_messages_today: 0, // calculado separado se necessário
      avg_response_time_minutes: avgResponse,
      active_alerts: alertList.length,
    });
  }, []);

  // ─── Selecionar grupo ─────────────────────────────────────────────────

  const selectGroup = useCallback(
    async (group: WAGroup) => {
      setSelectedGroup(group);
      await loadMessages(group.id);
      setupMessagesRealtime(group.id);
    },
    [loadMessages]
  );

  // ─── Realtime mensagens ───────────────────────────────────────────────

  function setupMessagesRealtime(groupId: string) {
    // Limpar canal anterior
    if (realtimeRef.current) {
      supabase.removeChannel(realtimeRef.current);
    }

    const channel = supabase
      .channel(`wa-chat-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as WAMessage]);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? (payload.new as WAMessage) : m))
          );
        }
      )
      .subscribe();

    realtimeRef.current = channel;
  }

  // ─── Enviar mensagem ──────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      if (!selectedGroup || !text.trim() || sendingMessage) return false;
      setSendingMessage(true);
      try {
        // Buscar configurações da Evolution API do banco
        const { data: urlSetting } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "evolution_api_url")
          .single();
        const { data: keySetting } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "evolution_api_key")
          .single();

        const evolutionUrl = urlSetting?.value?.replace(/"/g, "") || "";
        const evolutionKey = keySetting?.value?.replace(/"/g, "") || "";

        if (!evolutionUrl || !evolutionKey) {
          console.warn("[sendMessage] Evolution API não configurada");
          return false;
        }

        const res = await fetch(
          `${evolutionUrl}/message/sendText/${selectedGroup.instance_name}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: evolutionKey,
            },
            body: JSON.stringify({
              number: selectedGroup.jid,
              text: text.trim(),
            }),
          }
        );

        return res.ok;
      } catch (err) {
        console.error("[useWhatsAppGroups] sendMessage error:", err);
        return false;
      } finally {
        setSendingMessage(false);
      }
    },
    [selectedGroup, sendingMessage]
  );

  // ─── Resolver alerta ──────────────────────────────────────────────────

  const resolveAlert = useCallback(async (alertId: string) => {
    await supabase
      .from("alerts")
      .update({ is_resolved: true, resolved_at: new Date().toISOString() })
      .eq("id", alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  // ─── Recalcular health ────────────────────────────────────────────────

  const recalculateHealth = useCallback(async (groupId?: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const body = groupId ? { group_id: groupId } : { all: true };
    try {
      await fetch(`${supabaseUrl}/functions/v1/wa-health`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify(body),
      });
      await loadGroups();
    } catch (err) {
      console.error("[useWhatsAppGroups] recalculateHealth error:", err);
    }
  }, [loadGroups]);

  // ─── Effects ──────────────────────────────────────────────────────────

  useEffect(() => {
    loadGroups();
    loadAlerts();
  }, [loadGroups, loadAlerts]);

  // Atualizar stats quando grupos ou alertas mudarem
  useEffect(() => {
    computeStats(groups, alerts);
  }, [groups, alerts, computeStats]);

  // Realtime: atualizar lista de grupos quando grupos mudarem
  useEffect(() => {
    const channel = supabase
      .channel("wa-groups-list")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "groups" }, () => {
        loadGroups();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts" }, () => {
        loadAlerts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadGroups, loadAlerts]);

  // Cleanup canal realtime ao desmontar
  useEffect(() => {
    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
      }
    };
  }, []);

  return {
    // Estado
    groups,
    selectedGroup,
    messages,
    alerts,
    stats,
    // Loading
    loadingGroups,
    loadingMessages,
    sendingMessage,
    // Filtros
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    // Ações
    loadGroups,
    selectGroup,
    sendMessage,
    resolveAlert,
    recalculateHealth,
  };
}
