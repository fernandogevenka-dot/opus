import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { DirectMessage, User } from "@/types";

export interface DMThread {
  partner: User;
  lastMessage: DirectMessage;
  unread: number;
}

export function useDirect() {
  const [threads, setThreads] = useState<DMThread[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [activePartnerId, setActivePartnerId] = useState<string | null>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;
    loadThreads();

    const channel = supabase
      .channel("dm-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        () => loadThreads()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!activePartnerId || !user) return;
    loadMessages(activePartnerId);
    markRead(activePartnerId);

    const channel = supabase
      .channel(`dm-conv-${activePartnerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        () => { loadMessages(activePartnerId); markRead(activePartnerId); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activePartnerId, user]);

  const loadThreads = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("direct_messages")
      .select("*, from_user:users!direct_messages_from_user_id_fkey(id,name,avatar_url,team,status), to_user:users!direct_messages_to_user_id_fkey(id,name,avatar_url,team,status)")
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!data) return;

    // Group by partner
    const map = new Map<string, DMThread>();
    for (const msg of data as DirectMessage[]) {
      const partner = msg.from_user_id === user.id ? msg.to_user! : msg.from_user!;
      if (!partner) continue;
      if (!map.has(partner.id)) {
        const unread = (data as DirectMessage[]).filter(
          (m) => m.from_user_id === partner.id && m.to_user_id === user.id && !m.read_at
        ).length;
        map.set(partner.id, { partner, lastMessage: msg, unread });
      }
    }
    setThreads(Array.from(map.values()));
  }, [user]);

  async function loadMessages(partnerId: string) {
    if (!user) return;
    const { data } = await supabase
      .from("direct_messages")
      .select("*, from_user:users!direct_messages_from_user_id_fkey(id,name,avatar_url,team), to_user:users!direct_messages_to_user_id_fkey(id,name,avatar_url,team)")
      .or(
        `and(from_user_id.eq.${user.id},to_user_id.eq.${partnerId}),and(from_user_id.eq.${partnerId},to_user_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .limit(100);

    if (data) setMessages(data as DirectMessage[]);
  }

  async function markRead(partnerId: string) {
    if (!user) return;
    await supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("from_user_id", partnerId)
      .eq("to_user_id", user.id)
      .is("read_at", null);
  }

  async function sendMessage(toUserId: string, content: string) {
    if (!user || !content.trim()) return;
    await supabase.from("direct_messages").insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      content: content.trim(),
    });
  }

  function openThread(partnerId: string) {
    setActivePartnerId(partnerId);
  }

  function closeThread() {
    setActivePartnerId(null);
    setMessages([]);
  }

  return {
    threads,
    messages,
    activePartnerId,
    sendMessage,
    openThread,
    closeThread,
  };
}
