// wa-health — Calcula o health score dos grupos WhatsApp
// Deploy: supabase functions deploy wa-health --project-ref woroxniivyyyynhoyjwm --no-verify-jwt
//
// POST { group_id: "uuid" }  → calcula para um grupo
// POST { all: true }         → calcula para todos os grupos ativos
// GET  ?group_id=uuid        → busca score mais recente

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verificar secret opcional
  const secret = req.headers.get("x-webhook-secret") ||
    new URL(req.url).searchParams.get("secret");
  const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
  if (expectedSecret && secret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (req.method === "GET") {
      const groupId = new URL(req.url).searchParams.get("group_id");
      if (!groupId) {
        return new Response(JSON.stringify({ error: "group_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data } = await supabase
        .from("group_health_scores")
        .select("*")
        .eq("group_id", groupId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .single();
      return new Response(JSON.stringify({ health: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // POST
    const body = await req.json();
    const { group_id, all } = body;

    if (all) {
      const { data: groups } = await supabase
        .from("groups")
        .select("id, name")
        .eq("is_active", true);

      const results = [];
      for (const group of groups || []) {
        const score = await computeHealthScore(group.id);
        results.push({ group_id: group.id, name: group.name, score: score.score, status: score.status });
      }
      return new Response(JSON.stringify({ computed: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!group_id) {
      return new Response(JSON.stringify({ error: "group_id or all required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const score = await computeHealthScore(group_id);
    return new Response(JSON.stringify(score), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[wa-health] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Engine de cálculo ─────────────────────────────────────────────────────

interface Message {
  sent_at: string;
  is_from_agent: boolean;
  sender_jid: string;
  message_type: string;
  body: string | null;
}

async function computeHealthScore(groupId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: messages } = await supabase
    .from("messages")
    .select("sent_at, is_from_agent, sender_jid, message_type, body")
    .eq("group_id", groupId)
    .eq("is_deleted", false)
    .gte("sent_at", sevenDaysAgo)
    .order("sent_at", { ascending: true });

  const msgs: Message[] = messages || [];

  // --- Recência (30%) ---
  const lastMsg = msgs[msgs.length - 1];
  let recencyScore = 0;
  if (lastMsg?.sent_at) {
    const hoursAgo =
      (now.getTime() - new Date(lastMsg.sent_at).getTime()) / (1000 * 60 * 60);
    if (hoursAgo < 24) recencyScore = 100;
    else if (hoursAgo < 48) recencyScore = 80;
    else if (hoursAgo < 72) recencyScore = 60;
    else if (hoursAgo < 120) recencyScore = 40;
    else recencyScore = 20;
  }

  // --- Tempo de resposta do agente (25%) ---
  let responseTimeScore = 50;
  let avgResponseTimeMinutes = 0;
  const responseTimes: number[] = [];
  for (let i = 1; i < msgs.length; i++) {
    const prev = msgs[i - 1];
    const curr = msgs[i];
    if (!prev.is_from_agent && curr.is_from_agent) {
      const diffMinutes =
        (new Date(curr.sent_at).getTime() - new Date(prev.sent_at).getTime()) / 60000;
      if (diffMinutes < 1440) responseTimes.push(diffMinutes);
    }
  }
  if (responseTimes.length > 0) {
    avgResponseTimeMinutes = Math.round(
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    );
    if (avgResponseTimeMinutes < 15) responseTimeScore = 100;
    else if (avgResponseTimeMinutes < 60) responseTimeScore = 80;
    else if (avgResponseTimeMinutes < 240) responseTimeScore = 60;
    else if (avgResponseTimeMinutes < 480) responseTimeScore = 40;
    else responseTimeScore = 20;
  }

  // --- Engajamento (20%) ---
  const { count: totalParticipants } = await supabase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);
  const activeSenders = new Set(
    msgs.filter((m) => !m.is_from_agent).map((m) => m.sender_jid)
  ).size;
  const engagementRatio = (totalParticipants || 1) > 0 ? activeSenders / (totalParticipants || 1) : 0;
  const engagementScore = Math.round(Math.min(engagementRatio * 150, 100));

  // --- Sentimento via Claude (15%) ---
  let sentimentScore = 60;
  let aiSummary: string | null = null;
  let aiAlerts: string[] = [];

  const textMessages = msgs
    .filter((m) => m.message_type === "text" && m.body)
    .slice(-30);

  if (textMessages.length > 3) {
    const aiResult = await analyzeWithClaude(
      textMessages.map((m) => ({ text: m.body!, isAgent: m.is_from_agent }))
    );
    sentimentScore = aiResult.sentimentScore;
    aiSummary = aiResult.summary;
    aiAlerts = aiResult.alerts;
  }

  // --- Tendência de atividade (10%) ---
  const msgsLast7Days = msgs.length;
  const { data: prevMsgs } = await supabase
    .from("messages")
    .select("id", { count: "exact" })
    .eq("group_id", groupId)
    .gte("sent_at", new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString())
    .lt("sent_at", sevenDaysAgo);

  const msgsLastWeek = prevMsgs?.length || 0;
  let activityTrendScore = 50;
  if (msgsLastWeek === 0 && msgsLast7Days > 0) activityTrendScore = 80;
  else if (msgsLastWeek > 0) {
    const ratio = msgsLast7Days / msgsLastWeek;
    if (ratio >= 1.2) activityTrendScore = 100;
    else if (ratio >= 0.8) activityTrendScore = 70;
    else if (ratio >= 0.5) activityTrendScore = 50;
    else activityTrendScore = 30;
  }

  // --- Score final ---
  const score = Math.round(
    recencyScore * 0.3 +
    responseTimeScore * 0.25 +
    engagementScore * 0.2 +
    sentimentScore * 0.15 +
    activityTrendScore * 0.1
  );
  const status = score >= 70 ? "healthy" : score >= 40 ? "attention" : "risk";

  // Alertas rule-based
  if (recencyScore <= 40) aiAlerts.push("Grupo sem atividade há mais de 3 dias");
  if (responseTimeScore <= 40)
    aiAlerts.push(`Tempo médio de resposta alto: ${avgResponseTimeMinutes} minutos`);
  if (engagementScore <= 30) aiAlerts.push("Baixo engajamento do cliente no grupo");

  const healthData = {
    group_id: groupId,
    score,
    status,
    recency_score: recencyScore,
    response_time_score: responseTimeScore,
    engagement_score: engagementScore,
    sentiment_score: sentimentScore,
    activity_trend_score: activityTrendScore,
    avg_response_time_minutes: avgResponseTimeMinutes,
    messages_last_7_days: msgsLast7Days,
    last_client_message_at:
      msgs.filter((m) => !m.is_from_agent).pop()?.sent_at || null,
    last_agent_message_at:
      msgs.filter((m) => m.is_from_agent).pop()?.sent_at || null,
    ai_summary: aiSummary,
    ai_alerts: aiAlerts.length > 0 ? aiAlerts : null,
    computed_at: now.toISOString(),
  };

  await supabase.from("group_health_scores").insert(healthData);

  // Criar alerta se em risco
  if (status === "risk") {
    await supabase.from("alerts").insert({
      group_id: groupId,
      alert_type: "no_activity",
      message: `Grupo em estado de risco (score: ${score}). ${aiAlerts[0] || ""}`,
    });
  }

  return healthData;
}

async function analyzeWithClaude(
  messages: Array<{ text: string; isAgent: boolean }>
): Promise<{ sentimentScore: number; summary: string; alerts: string[] }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return { sentimentScore: 60, summary: "", alerts: [] };

  const conversation = messages
    .map((m) => `[${m.isAgent ? "AGENTE" : "CLIENTE"}]: ${m.text}`)
    .join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `Você é um analista de qualidade de atendimento. Analise esta conversa de grupo de WhatsApp e retorne um JSON com:
- sentimentScore: 0-100 (100 = muito positivo, 0 = muito negativo)
- summary: resumo em 1-2 frases do estado atual do relacionamento
- alerts: array com até 3 alertas críticos detectados (array vazio se nenhum)

Responda APENAS com JSON válido, sem markdown.

Conversa:
${conversation}`,
          },
        ],
      }),
    });

    if (!response.ok) return { sentimentScore: 60, summary: "", alerts: [] };
    const result = await response.json();
    const content = result.content?.[0]?.text;
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, "").trim());
    return {
      sentimentScore: Math.max(0, Math.min(100, parsed.sentimentScore || 60)),
      summary: parsed.summary || "",
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts.slice(0, 3) : [],
    };
  } catch {
    return { sentimentScore: 60, summary: "", alerts: [] };
  }
}
