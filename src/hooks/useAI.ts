import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { AIMessage, AIConversation } from "@/types";

import { ATLAS_SYSTEM_PROMPT } from "@/lib/constants";
const SYSTEM_PROMPT = ATLAS_SYSTEM_PROMPT;

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export function useAI() {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuthStore();

  async function loadConversations() {
    if (!user) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setConversations(data as AIConversation[]);
    setLoadingHistory(false);
  }

  async function loadConversation(id: string) {
    const { data } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("id", id)
      .single();
    if (data) {
      setActiveConversationId(id);
      setMessages(data.messages as AIMessage[]);
    }
  }

  async function newConversation() {
    setActiveConversationId(null);
    setMessages([]);
  }

  async function sendMessage(content: string) {
    if (!user || !content.trim() || streaming) return;

    const userMsg: AIMessage = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStreaming(true);

    const assistantMsg: AIMessage = {
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setMessages([...newMessages, assistantMsg]);

    try {
      abortRef.current = new AbortController();

      const apiMessages = newMessages.map((m) => ({ role: m.role, content: m.content }));

      // Use Supabase Edge Function (has ANTHROPIC_API_KEY as secret)
      await streamFromEdgeFunction(apiMessages, newMessages, assistantMsg);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const errMsg = (err as Error).message ?? "";
        const isCredits = errMsg.toLowerCase().includes("credit") || errMsg.toLowerCase().includes("balance");
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: isCredits
              ? "⚠️ Saldo de créditos Anthropic insuficiente. Adicione créditos em console.anthropic.com/settings/billing e tente novamente."
              : "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.",
          };
          return updated;
        });
      }
    } finally {
      setStreaming(false);
    }
  }

  async function streamFromAnthropic(
    apiMessages: { role: string; content: string }[],
    newMessages: AIMessage[],
    assistantMsg: AIMessage
  ) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: apiMessages,
        stream: true,
      }),
      signal: abortRef.current?.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} — ${errText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === "[DONE]" || data === "event: message_stop") continue;
        try {
          const parsed = JSON.parse(data);
          // Anthropic streaming: content_block_delta with text_delta
          const delta =
            parsed.delta?.text ??
            parsed.choices?.[0]?.delta?.content ??
            "";
          if (delta) {
            fullContent += delta;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: fullContent,
              };
              return updated;
            });
          }
        } catch {
          // ignore parse errors in stream
        }
      }
    }

    const finalMessages = [
      ...newMessages,
      { ...assistantMsg, content: fullContent },
    ];
    await saveConversation(finalMessages, newMessages[0]?.content ?? "");
  }

  async function streamFromEdgeFunction(
    apiMessages: { role: string; content: string }[],
    newMessages: AIMessage[],
    assistantMsg: AIMessage
  ) {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/ai-chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          system: SYSTEM_PROMPT,
        }),
        signal: abortRef.current?.signal,
      }
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      try {
        const parsed = JSON.parse(errBody);
        throw new Error(parsed.error ?? "Edge function error");
      } catch {
        throw new Error(errBody || "Edge function error");
      }
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content ?? parsed.delta?.text ?? "";
          if (delta) {
            fullContent += delta;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: fullContent,
              };
              return updated;
            });
          }
        } catch {
          // ignore parse errors in stream
        }
      }
    }

    const finalMessages = [
      ...newMessages,
      { ...assistantMsg, content: fullContent },
    ];
    await saveConversation(finalMessages, newMessages[0]?.content ?? "");
  }

  async function saveConversation(msgs: AIMessage[], firstMessage: string) {
    if (!user) return;

    const title = firstMessage.slice(0, 60) + (firstMessage.length > 60 ? "..." : "");

    if (activeConversationId) {
      await supabase
        .from("ai_conversations")
        .update({ messages: msgs, updated_at: new Date().toISOString() })
        .eq("id", activeConversationId);
    } else {
      const { data } = await supabase
        .from("ai_conversations")
        .insert({ user_id: user.id, title, messages: msgs })
        .select()
        .single();
      if (data) setActiveConversationId(data.id);
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  return {
    conversations,
    activeConversationId,
    messages,
    streaming,
    loadingHistory,
    loadConversations,
    loadConversation,
    newConversation,
    sendMessage,
    stopStreaming,
  };
}
