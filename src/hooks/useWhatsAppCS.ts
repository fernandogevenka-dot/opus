import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WaGroup {
  id: string;
  group_jid: string;
  group_name: string;
  client_id: string | null;
  is_active: boolean;
  client?: { id: string; name: string } | null;
}

export interface WaTeamMember {
  id: string;
  user_id: string;
  phone_number: string;
  jid: string;
  user?: Pick<User, "id" | "name" | "avatar_url" | "team"> | null;
}

export interface WaMessage {
  id: string;
  wa_message_id: string;
  group_jid: string;
  sender_jid: string;
  sender_name: string | null;
  user_id: string | null;
  is_from_team: boolean;
  message_text: string | null;
  message_type: string;
  sent_at: string;
}

// ─── Métricas calculadas ──────────────────────────────────────────────────────

export interface GroupMetrics {
  group_jid:          string;
  group_name:         string;
  client_id:          string | null;
  client_name:        string | null;
  total_messages:     number;
  team_messages:      number;
  client_messages:    number;
  /** Tempo médio de resposta do time em minutos */
  avg_response_min:   number | null;
  /** % de mensagens de clientes que receberam resposta */
  response_rate:      number;
  /** Threads abertas há mais de ALERT_NO_REPLY_HOURS sem resposta */
  unanswered_threads: number;
  /** true se o time iniciou mais de 30% das conversas */
  is_proactive:       boolean;
  /** Frequência de msgs do cliente por semana */
  client_msgs_per_week: number;
  /** Sentimento estimado por keywords */
  sentiment:          "positive" | "neutral" | "negative";
  /** Score de eficiência 0–100 */
  efficiency_score:   number;
  /** Último contato (qualquer mensagem) */
  last_message_at:    string | null;
  /** Horas desde a última msg do cliente sem resposta do time (null se respondido) */
  hours_without_reply: number | null;
}

export interface AccountMetrics {
  user_id:          string;
  user_name:        string;
  avatar_url:       string;
  team:             string;
  total_messages:   number;
  groups_attended:  number;
  avg_response_min: number | null;
  response_rate:    number;
  proactive_rate:   number;
  efficiency_score: number;
}

export interface WaSyncStatus {
  last_sync:        string | null;
  messages_today:   number;
  groups_active:    number;
}

// ─── Sentiment keywords ───────────────────────────────────────────────────────

const NEGATIVE_KEYWORDS = [
  "cancelar", "cancela", "cancelamento", "cancelei",
  "péssimo", "horrível", "terrível", "ruim",
  "problema", "erro", "falhou", "falha", "não funciona",
  "insatisfeito", "decepcionado", "decepção",
  "sair", "saindo", "desistir", "desisto",
  "churn", "encerrar", "encerramento",
  "não recomendo", "arrependido",
  "demora", "demorado", "demora demais",
  "sem retorno", "não responde", "abandono",
];

const POSITIVE_KEYWORDS = [
  "ótimo", "excelente", "parabéns", "incrível", "perfeito",
  "adorei", "amei", "maravilhoso", "muito bom",
  "recomendo", "satisfeito", "feliz", "obrigado",
  "resultado", "crescimento", "cresceu", "melhorou",
  "superou", "entregou", "entregaram",
];

const ALERT_NO_REPLY_HOURS = 6;

function estimateSentiment(messages: WaMessage[]): "positive" | "neutral" | "negative" {
  let pos = 0;
  let neg = 0;
  for (const m of messages) {
    if (!m.message_text || m.is_from_team) continue;
    const text = m.message_text.toLowerCase();
    if (NEGATIVE_KEYWORDS.some((k) => text.includes(k))) neg++;
    if (POSITIVE_KEYWORDS.some((k) => text.includes(k))) neg--;
    if (POSITIVE_KEYWORDS.some((k) => text.includes(k))) pos++;
  }
  if (neg > pos && neg >= 2) return "negative";
  if (pos > neg && pos >= 2) return "positive";
  return "neutral";
}

function calcEfficiencyScore(
  responseRate: number,
  avgResponseMin: number | null,
  isProactive: boolean,
  sentiment: "positive" | "neutral" | "negative",
  unansweredThreads: number
): number {
  let score = 0;

  // Taxa de resposta (0–40 pts)
  score += Math.round(responseRate * 40);

  // Tempo de resposta (0–30 pts) — ideal < 30min
  if (avgResponseMin !== null) {
    if (avgResponseMin <= 30)  score += 30;
    else if (avgResponseMin <= 60)  score += 20;
    else if (avgResponseMin <= 120) score += 10;
    else score += 5;
  }

  // Proatividade (0–15 pts)
  if (isProactive) score += 15;

  // Sentimento (0–15 pts)
  if (sentiment === "positive") score += 15;
  else if (sentiment === "neutral") score += 8;

  // Penalidade por threads sem resposta (-5 por thread)
  score -= unansweredThreads * 5;

  return Math.max(0, Math.min(100, score));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useWhatsAppCS() {
  const { user } = useAuthStore();

  const [groups,      setGroups]      = useState<WaGroup[]>([]);
  const [teamMembers, setTeamMembers] = useState<WaTeamMember[]>([]);
  const [messages,    setMessages]    = useState<WaMessage[]>([]);
  const [syncStatus,  setSyncStatus]  = useState<WaSyncStatus>({ last_sync: null, messages_today: 0, groups_active: 0 });
  const [loading,     setLoading]     = useState(true);
  const [period,      setPeriod]      = useState<7 | 14 | 30>(7); // dias

  // ── Loaders ──

  const loadGroups = useCallback(async () => {
    const { data } = await supabase
      .from("wa_groups")
      .select("*, client:clients(id, name)")
      .order("group_name");
    setGroups((data ?? []) as WaGroup[]);
  }, []);

  const loadTeamMembers = useCallback(async () => {
    const { data } = await supabase
      .from("wa_team_members")
      .select("*, user:users(id, name, avatar_url, team)");
    setTeamMembers((data ?? []) as WaTeamMember[]);
  }, []);

  const loadMessages = useCallback(async (days: number) => {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await supabase
      .from("wa_messages")
      .select("*")
      .gte("sent_at", since)
      .order("sent_at", { ascending: true });
    setMessages((data ?? []) as WaMessage[]);
  }, []);

  const loadSyncStatus = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [logRes, countRes, activeGroupsRes] = await Promise.all([
      supabase.from("wa_sync_log").select("synced_at").order("synced_at", { ascending: false }).limit(1),
      supabase.from("wa_messages").select("id", { count: "exact", head: true }).gte("sent_at", `${today}T00:00:00`),
      supabase.from("wa_groups").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    setSyncStatus({
      last_sync:      logRes.data?.[0]?.synced_at ?? null,
      messages_today: countRes.count ?? 0,
      groups_active:  activeGroupsRes.count ?? 0,
    });
  }, []);

  const reload = useCallback(async (days: number) => {
    setLoading(true);
    await Promise.all([loadGroups(), loadTeamMembers(), loadMessages(days), loadSyncStatus()]);
    setLoading(false);
  }, [loadGroups, loadTeamMembers, loadMessages, loadSyncStatus]);

  useEffect(() => { reload(period); }, [period]);

  // ── Métricas por grupo ──

  const groupMetrics: GroupMetrics[] = groups
    .filter((g) => g.is_active)
    .map((g) => {
      const gMsgs    = messages.filter((m) => m.group_jid === g.group_jid);
      const teamMsgs = gMsgs.filter((m) => m.is_from_team);
      const clientMsgs = gMsgs.filter((m) => !m.is_from_team);

      // Tempo médio de resposta
      const responseTimes: number[] = [];
      let unanswered = 0;
      let i = 0;
      while (i < gMsgs.length) {
        const msg = gMsgs[i];
        if (!msg.is_from_team) {
          // Procura a próxima resposta do time
          let j = i + 1;
          let found = false;
          while (j < gMsgs.length && !gMsgs[j].is_from_team) j++;
          if (j < gMsgs.length && gMsgs[j].is_from_team) {
            const diffMin = (new Date(gMsgs[j].sent_at).getTime() - new Date(msg.sent_at).getTime()) / 60_000;
            if (diffMin > 0 && diffMin < 1440) responseTimes.push(diffMin); // ignora > 24h
            found = true;
            i = j + 1;
          } else {
            // Mensagem sem resposta
            const hoursSince = (Date.now() - new Date(msg.sent_at).getTime()) / 3_600_000;
            if (hoursSince >= ALERT_NO_REPLY_HOURS) unanswered++;
            i++;
          }
          if (!found) i++;
        } else { i++; }
      }

      const avgResponseMin = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length)
        : null;

      const responseRate = clientMsgs.length > 0
        ? (responseTimes.length) / clientMsgs.length
        : 0;

      // Proatividade: % de "threads" iniciadas pelo time
      // Simplificado: conta blocos consecutivos iniciados pelo time
      let teamInitiated = 0;
      let totalThreads  = 0;
      let lastWasTeam   = false;
      for (const m of gMsgs) {
        if (!lastWasTeam && m.is_from_team) { teamInitiated++; totalThreads++; }
        else if (!lastWasTeam && !m.is_from_team) totalThreads++;
        lastWasTeam = m.is_from_team;
      }
      const isProactive = totalThreads > 0 && teamInitiated / totalThreads >= 0.3;

      // Frequência cliente (msgs/semana)
      const weeksInPeriod = period / 7;
      const clientMsgsPerWeek = clientMsgs.length / weeksInPeriod;

      const sentiment = estimateSentiment(gMsgs);
      const efficiencyScore = calcEfficiencyScore(responseRate, avgResponseMin, isProactive, sentiment, unanswered);

      // Última mensagem + horas sem resposta
      const lastMsg = gMsgs[gMsgs.length - 1];
      const lastClientMsg = [...clientMsgs].reverse().find(Boolean);
      const lastTeamMsg   = [...teamMsgs].reverse().find(Boolean);

      let hoursWithoutReply: number | null = null;
      if (lastClientMsg && (!lastTeamMsg || new Date(lastClientMsg.sent_at) > new Date(lastTeamMsg.sent_at))) {
        hoursWithoutReply = (Date.now() - new Date(lastClientMsg.sent_at).getTime()) / 3_600_000;
      }

      return {
        group_jid:           g.group_jid,
        group_name:          g.group_name,
        client_id:           g.client_id,
        client_name:         g.client?.name ?? null,
        total_messages:      gMsgs.length,
        team_messages:       teamMsgs.length,
        client_messages:     clientMsgs.length,
        avg_response_min:    avgResponseMin,
        response_rate:       responseRate,
        unanswered_threads:  unanswered,
        is_proactive:        isProactive,
        client_msgs_per_week: Math.round(clientMsgsPerWeek * 10) / 10,
        sentiment,
        efficiency_score:    efficiencyScore,
        last_message_at:     lastMsg?.sent_at ?? null,
        hours_without_reply: hoursWithoutReply,
      };
    });

  // ── Métricas por account (membro do time) ──

  const accountMetrics: AccountMetrics[] = teamMembers.map((tm) => {
    if (!tm.user) return null;
    const userMsgs = messages.filter((m) => m.user_id === tm.user_id);
    const userGroups = new Set(userMsgs.map((m) => m.group_jid));

    // Calcula métricas de resposta deste account em seus grupos
    let totalResponseTimes: number[] = [];
    let totalClientMsgs = 0;
    let totalReplied    = 0;
    let teamInitTotal   = 0;
    let totalThreads    = 0;

    for (const jid of userGroups) {
      const gMsgs    = messages.filter((m) => m.group_jid === jid);
      const gMetrics = groupMetrics.find((gm) => gm.group_jid === jid);
      if (gMetrics) {
        totalResponseTimes.push(...(gMetrics.avg_response_min !== null ? [gMetrics.avg_response_min] : []));
        totalClientMsgs += gMetrics.client_messages;
      }

      // Proatividade por account
      let last = false;
      for (const m of gMsgs) {
        if (m.user_id === tm.user_id) {
          if (!last) { teamInitTotal++; totalThreads++; }
          last = true;
        } else if (!m.is_from_team) {
          if (last) totalThreads++;
          last = false;
        }
      }
    }

    const avgResponseMin = totalResponseTimes.length > 0
      ? Math.round(totalResponseTimes.reduce((s, v) => s + v, 0) / totalResponseTimes.length)
      : null;

    const responseRate  = totalClientMsgs > 0 ? Math.min(1, userMsgs.length / totalClientMsgs) : 0;
    const proactiveRate = totalThreads > 0 ? teamInitTotal / totalThreads : 0;

    // Score simplificado para o account
    const efficiencyScore = calcEfficiencyScore(
      responseRate,
      avgResponseMin,
      proactiveRate >= 0.3,
      "neutral", // sem análise por membro — usa global
      0
    );

    return {
      user_id:          tm.user_id,
      user_name:        tm.user.name,
      avatar_url:       tm.user.avatar_url,
      team:             tm.user.team ?? "",
      total_messages:   userMsgs.length,
      groups_attended:  userGroups.size,
      avg_response_min: avgResponseMin,
      response_rate:    responseRate,
      proactive_rate:   proactiveRate,
      efficiency_score: efficiencyScore,
    } as AccountMetrics;
  }).filter(Boolean) as AccountMetrics[];

  // ── Alertas ──

  interface WaAlert {
    type: "no_reply" | "negative_sentiment" | "low_score" | "high_risk";
    group_jid: string;
    group_name: string;
    client_name: string | null;
    message: string;
    severity: "warning" | "critical";
    hours?: number;
  }

  const alerts: WaAlert[] = [];
  for (const gm of groupMetrics) {
    if (gm.hours_without_reply !== null && gm.hours_without_reply >= ALERT_NO_REPLY_HOURS) {
      alerts.push({
        type: "no_reply",
        group_jid:   gm.group_jid,
        group_name:  gm.group_name,
        client_name: gm.client_name,
        message:     `Sem resposta há ${Math.round(gm.hours_without_reply)}h`,
        severity:    gm.hours_without_reply >= 24 ? "critical" : "warning",
        hours:       Math.round(gm.hours_without_reply),
      });
    }
    if (gm.sentiment === "negative") {
      alerts.push({
        type: "negative_sentiment",
        group_jid:   gm.group_jid,
        group_name:  gm.group_name,
        client_name: gm.client_name,
        message:     "Sentimento negativo detectado",
        severity:    "warning",
      });
    }
    if (gm.efficiency_score < 40 && gm.total_messages >= 5) {
      alerts.push({
        type: "low_score",
        group_jid:   gm.group_jid,
        group_name:  gm.group_name,
        client_name: gm.client_name,
        message:     `Score de eficiência baixo (${gm.efficiency_score}/100)`,
        severity:    gm.efficiency_score < 20 ? "critical" : "warning",
      });
    }
  }
  alerts.sort((a, b) => (b.severity === "critical" ? 1 : -1) - (a.severity === "critical" ? 1 : -1));

  // ── Controle de visibilidade por role ──
  // coordinator → só vê seu squad (filtra por team)
  // manager / admin → vê tudo

  const userRole = user?.role ?? "";
  const userTeam = user?.team ?? "";
  const isManager = ["manager", "admin", "gerente", "diretor"].includes(userRole.toLowerCase());
  const isCoordinator = ["coordinator", "coordenador"].includes(userRole.toLowerCase());

  function filterByRole<T extends { team?: string; user?: { team?: string } | null }>(items: T[]): T[] {
    if (isManager) return items;
    if (isCoordinator) return items.filter((i) => (i.team ?? i.user?.team ?? "") === userTeam);
    return items.filter((i) => (i as unknown as { user_id?: string }).user_id === user?.id);
  }

  const visibleAccounts = filterByRole(accountMetrics.map((a) => ({ ...a, team: a.team })));

  // ── CRUD helpers ──

  const linkGroupToClient = useCallback(async (groupJid: string, clientId: string) => {
    await supabase.from("wa_groups").update({ client_id: clientId }).eq("group_jid", groupJid);
    await loadGroups();
  }, [loadGroups]);

  const setGroupActive = useCallback(async (groupJid: string, active: boolean) => {
    await supabase.from("wa_groups").update({ is_active: active }).eq("group_jid", groupJid);
    await loadGroups();
  }, [loadGroups]);

  const saveTeamMember = useCallback(async (userId: string, phone: string) => {
    const clean = phone.replace(/\D/g, "");
    await supabase.from("wa_team_members").upsert({ user_id: userId, phone_number: clean }, { onConflict: "user_id" });
    await loadTeamMembers();
  }, [loadTeamMembers]);

  const removeTeamMember = useCallback(async (userId: string) => {
    await supabase.from("wa_team_members").delete().eq("user_id", userId);
    await loadTeamMembers();
  }, [loadTeamMembers]);

  return {
    // Data
    groups,
    teamMembers,
    messages,
    syncStatus,
    loading,
    period,
    setPeriod,
    // Computed
    groupMetrics,
    accountMetrics: visibleAccounts,
    alerts,
    isManager,
    isCoordinator,
    // Actions
    reload:            () => reload(period),
    linkGroupToClient,
    setGroupActive,
    saveTeamMember,
    removeTeamMember,
  };
}
