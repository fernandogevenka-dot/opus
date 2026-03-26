// wa-webhook — Recebe eventos da Evolution API e persiste no banco
// Deploy: supabase functions deploy wa-webhook --project-ref woroxniivyyyynhoyjwm --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Service role — bypassa RLS
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

type MessageType =
  | "text" | "image" | "video" | "audio" | "document"
  | "sticker" | "location" | "contact" | "reaction"
  | "poll" | "list" | "button" | "unknown";

interface EvolutionPayload {
  event: string;
  instance: string;
  data: unknown;
}

interface MessageData {
  key: { id: string; remoteJid: string; fromMe: boolean; participant?: string };
  message?: Record<string, unknown>;
  pushName?: string;
  messageTimestamp: number;
}

interface GroupData {
  id: string;
  subject?: string;
  desc?: string;
  size?: number;
  participants?: Array<{ id: string; admin?: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const payload: EvolutionPayload = await req.json();
    const { event, instance, data } = payload;

    console.log(`[wa-webhook] ${event} from ${instance}`);

    switch (event) {
      case "MESSAGES_UPSERT":
      case "messages.upsert":
        await handleMessage(instance, data as MessageData);
        break;
      case "MESSAGES_DELETE":
      case "messages.delete":
        await handleMessageDelete(data as { id: { id: string } });
        break;
      case "GROUPS_UPSERT":
      case "groups.upsert":
        await handleGroupUpsert(instance, data as GroupData);
        break;
      case "GROUPS_UPDATE":
      case "groups.update":
        await handleGroupUpdate(instance, data as Partial<GroupData>);
        break;
      case "GROUP_PARTICIPANTS_UPDATE":
      case "groups.participants.update":
        await handleParticipantsUpdate(
          instance,
          data as { id: string; participants: string[]; action: string }
        );
        break;
      case "CONNECTION_UPDATE":
      case "connection.update":
        console.log(`[wa-webhook] Connection update for ${instance}:`, JSON.stringify(data));
        break;
      default:
        break;
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[wa-webhook] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Handlers ──────────────────────────────────────────────────────────────

async function handleMessage(instance: string, data: MessageData) {
  const { key, message, pushName, messageTimestamp } = data;

  // Só grupos
  if (!key.remoteJid.endsWith("@g.us")) return;

  const groupJid = key.remoteJid;
  const senderJid =
    key.participant || (key.fromMe ? `${instance}@s.whatsapp.net` : key.remoteJid);
  const sentAt = new Date(messageTimestamp * 1000).toISOString();

  // Garantir que o grupo existe
  await upsertGroup(instance, groupJid);
  const groupId = await getGroupId(groupJid);
  if (!groupId) return;

  // Extrair conteúdo
  const { messageType, body, mediaUrl, mediaMimeType } = extractMessageContent(message);

  const { error } = await supabase.from("messages").upsert(
    {
      message_id: key.id,
      group_id: groupId,
      sender_jid: senderJid,
      sender_name: pushName || null,
      message_type: messageType,
      body,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      is_from_agent: key.fromMe,
      sent_at: sentAt,
    },
    { onConflict: "message_id", ignoreDuplicates: true }
  );

  if (error) {
    console.error("[wa-webhook] Error inserting message:", error);
    return;
  }

  await supabase.from("groups").update({ last_message_at: sentAt }).eq("jid", groupJid);
}

async function handleMessageDelete(data: { id: { id: string } }) {
  const messageId = data?.id?.id;
  if (!messageId) return;
  await supabase.from("messages").update({ is_deleted: true }).eq("message_id", messageId);
}

async function handleGroupUpsert(instance: string, data: GroupData) {
  if (!data.id) return;
  await upsertGroupFull(instance, data);
}

async function handleGroupUpdate(instance: string, data: Partial<GroupData>) {
  if (!data.id) return;
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.subject) updates.name = data.subject;
  if (data.desc !== undefined) updates.description = data.desc;
  await supabase.from("groups").update(updates).eq("jid", data.id);
}

async function handleParticipantsUpdate(
  _instance: string,
  data: { id: string; participants: string[]; action: string }
) {
  if (!data.id || !data.participants) return;
  const groupId = await getGroupId(data.id);
  if (!groupId) return;

  if (data.action === "add") {
    const rows = data.participants.map((jid) => ({
      group_id: groupId,
      participant_jid: jid,
      member_type: "unknown",
    }));
    await supabase
      .from("group_members")
      .upsert(rows, { onConflict: "group_id,participant_jid", ignoreDuplicates: true });
  } else if (data.action === "remove") {
    for (const jid of data.participants) {
      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("participant_jid", jid);
    }
  } else if (data.action === "promote") {
    for (const jid of data.participants) {
      await supabase
        .from("group_members")
        .update({ is_admin: true })
        .eq("group_id", groupId)
        .eq("participant_jid", jid);
    }
  } else if (data.action === "demote") {
    for (const jid of data.participants) {
      await supabase
        .from("group_members")
        .update({ is_admin: false })
        .eq("group_id", groupId)
        .eq("participant_jid", jid);
    }
  }

  const { count } = await supabase
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("group_id", groupId);
  await supabase
    .from("groups")
    .update({ participant_count: count || 0 })
    .eq("id", groupId);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function getGroupId(jid: string): Promise<string | null> {
  const { data } = await supabase.from("groups").select("id").eq("jid", jid).single();
  return data?.id || null;
}

async function upsertGroup(instance: string, jid: string) {
  const { data: existing } = await supabase
    .from("groups")
    .select("id")
    .eq("jid", jid)
    .single();
  if (!existing) {
    await supabase.from("groups").insert({
      jid,
      name: jid,
      instance_name: instance,
    });
  }
}

async function upsertGroupFull(instance: string, data: GroupData) {
  const groupData = {
    jid: data.id,
    name: data.subject || data.id,
    description: data.desc || null,
    instance_name: instance,
    participant_count: data.participants?.length || data.size || 0,
    updated_at: new Date().toISOString(),
  };

  const { data: upserted } = await supabase
    .from("groups")
    .upsert(groupData, { onConflict: "jid" })
    .select("id")
    .single();

  if (!upserted || !data.participants) return;

  const members = data.participants.map((p) => ({
    group_id: upserted.id,
    participant_jid: p.id,
    is_admin: p.admin === "admin" || p.admin === "superadmin",
    member_type: "unknown",
  }));

  if (members.length > 0) {
    await supabase.from("group_members").upsert(members, {
      onConflict: "group_id,participant_jid",
      ignoreDuplicates: false,
    });
  }
}

function extractMessageContent(message: Record<string, unknown> | undefined): {
  messageType: MessageType;
  body: string | null;
  mediaUrl: string | null;
  mediaMimeType: string | null;
} {
  if (!message)
    return { messageType: "unknown", body: null, mediaUrl: null, mediaMimeType: null };

  const msg = message as Record<string, Record<string, string | null | undefined>>;

  if (msg.conversation) {
    return {
      messageType: "text",
      body: msg.conversation as unknown as string,
      mediaUrl: null,
      mediaMimeType: null,
    };
  }
  if (msg.extendedTextMessage) {
    return {
      messageType: "text",
      body: msg.extendedTextMessage.text ?? null,
      mediaUrl: null,
      mediaMimeType: null,
    };
  }
  if (msg.imageMessage) {
    return {
      messageType: "image",
      body: msg.imageMessage.caption ?? null,
      mediaUrl: msg.imageMessage.mediaUrl ?? msg.imageMessage.url ?? null,
      mediaMimeType: msg.imageMessage.mimetype ?? null,
    };
  }
  if (msg.videoMessage) {
    return {
      messageType: "video",
      body: msg.videoMessage.caption ?? null,
      mediaUrl: msg.videoMessage.mediaUrl ?? msg.videoMessage.url ?? null,
      mediaMimeType: msg.videoMessage.mimetype ?? null,
    };
  }
  if (msg.audioMessage) {
    return {
      messageType: "audio",
      body: null,
      mediaUrl: msg.audioMessage.mediaUrl ?? msg.audioMessage.url ?? null,
      mediaMimeType: msg.audioMessage.mimetype ?? null,
    };
  }
  if (msg.documentMessage) {
    return {
      messageType: "document",
      body: msg.documentMessage.title ?? null,
      mediaUrl: msg.documentMessage.mediaUrl ?? msg.documentMessage.url ?? null,
      mediaMimeType: msg.documentMessage.mimetype ?? null,
    };
  }
  if (msg.stickerMessage) {
    return {
      messageType: "sticker",
      body: null,
      mediaUrl: msg.stickerMessage.mediaUrl ?? msg.stickerMessage.url ?? null,
      mediaMimeType: null,
    };
  }
  if (msg.reactionMessage) {
    return {
      messageType: "reaction",
      body: msg.reactionMessage.text ?? null,
      mediaUrl: null,
      mediaMimeType: null,
    };
  }

  return { messageType: "unknown", body: null, mediaUrl: null, mediaMimeType: null };
}
