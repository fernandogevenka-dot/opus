/**
 * useGoogleCalendar
 *
 * Integra com a Google Calendar API via OAuth2 (popup PKCE).
 * Busca eventos vinculados a um cliente pelo e-mail do contato,
 * e os sincroniza como client_interactions (tipo "meeting"),
 * deduplicando pelo campo google_event_id.
 *
 * Fluxo:
 *   1. requestAccess()  → abre popup OAuth Google
 *   2. syncClientEvents(client) → busca eventos dos últimos 90 dias
 *      que têm o contact_email do cliente como participante
 *   3. Para cada evento novo → insere em client_interactions
 */

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { Client } from "@/types";

// ─── Google OAuth config ──────────────────────────────────────────────────────
// Client ID público (sem segredo — OAuth PKCE/implicit para SPA)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
].join(" ");

const TOKEN_KEY = "google_cal_token";

interface GCalToken {
  access_token: string;
  expires_at: number; // ms timestamp
}

function getStoredToken(): GCalToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as GCalToken;
    if (Date.now() > token.expires_at) { sessionStorage.removeItem(TOKEN_KEY); return null; }
    return token;
  } catch { return null; }
}

function storeToken(accessToken: string, expiresIn: number) {
  const token: GCalToken = { access_token: accessToken, expires_at: Date.now() + expiresIn * 1000 };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

// ─── Google Calendar API helpers ─────────────────────────────────────────────

interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; displayName?: string }[];
  hangoutLink?: string;
  status: "confirmed" | "tentative" | "cancelled";
}

async function fetchEvents(accessToken: string, contactEmail: string): Promise<GCalEvent[]> {
  const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // +2 semanas futuro

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
    q: contactEmail, // busca por texto — funciona para nome/e-mail em eventos
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) throw new Error(`Google Calendar API: ${res.status}`);
  const data = await res.json();

  // Filtrar apenas eventos onde o contactEmail aparece nos attendees
  return (data.items as GCalEvent[]).filter(
    (ev) =>
      ev.status !== "cancelled" &&
      ev.attendees?.some((a) => a.email.toLowerCase() === contactEmail.toLowerCase())
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGoogleCalendar() {
  const [token, setToken] = useState<GCalToken | null>(getStoredToken);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuthStore();

  const isConnected = token !== null;

  // ── OAuth implicit flow (popup) ──────────────────────────────────────────

  function requestAccess(): Promise<GCalToken> {
    return new Promise((resolve, reject) => {
      if (!GOOGLE_CLIENT_ID) {
        reject(new Error("VITE_GOOGLE_CLIENT_ID não configurado no .env"));
        return;
      }

      const redirectUri = `${window.location.origin}/oauth-callback.html`;
      const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&prompt=consent`;

      const popup = window.open(authUrl, "google-oauth", "width=500,height=650,left=200,top=100");

      const handler = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        if (e.data?.type !== "google-oauth-token") return;
        window.removeEventListener("message", handler);
        popup?.close();
        const t = storeToken(e.data.access_token, e.data.expires_in ?? 3600);
        setToken(t);
        resolve(t);
      };

      window.addEventListener("message", handler);

      // Fallback: poll popup closed without posting message
      const check = setInterval(() => {
        if (popup?.closed) {
          clearInterval(check);
          window.removeEventListener("message", handler);
          reject(new Error("Autenticação cancelada"));
        }
      }, 500);
    });
  }

  // ── Sync client events ───────────────────────────────────────────────────

  async function syncClientEvents(client: Client): Promise<void> {
    if (!user) return;
    setError(null);
    setSyncing(true);

    try {
      let activeToken = token;
      if (!activeToken) {
        activeToken = await requestAccess();
      }

      const contactEmail = client.contact_email?.trim();
      if (!contactEmail) throw new Error("Cliente sem e-mail de contato cadastrado");

      const events = await fetchEvents(activeToken.access_token, contactEmail);

      let added = 0;
      let skipped = 0;

      for (const ev of events) {
        // Deduplicate
        const { data: existing } = await supabase
          .from("client_interactions")
          .select("id")
          .eq("google_event_id", ev.id)
          .maybeSingle();

        if (existing) { skipped++; continue; }

        const startRaw = ev.start.dateTime ?? ev.start.date ?? new Date().toISOString();
        const endRaw = ev.end.dateTime ?? ev.end.date ?? startRaw;
        const durationMs = new Date(endRaw).getTime() - new Date(startRaw).getTime();
        const durationMin = Math.round(durationMs / 60000);
        const durationLabel = durationMin > 0 ? ` (${durationMin} min)` : "";

        const attendeeList = (ev.attendees ?? [])
          .map((a) => a.displayName ?? a.email)
          .join(", ");

        const notes = [
          ev.description ? ev.description.slice(0, 500) : "",
          attendeeList ? `Participantes: ${attendeeList}` : "",
          ev.hangoutLink ? `Link: ${ev.hangoutLink}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        await supabase.from("client_interactions").insert({
          client_id: client.id,
          type: "meeting",
          title: (ev.summary ?? "Reunião sem título") + durationLabel,
          notes,
          author_id: user.id,
          happened_at: startRaw,
          google_event_id: ev.id,
        });

        added++;
      }

      setSyncResult({ added, skipped });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  function disconnect() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSyncResult(null);
  }

  return {
    isConnected,
    syncing,
    syncResult,
    error,
    requestAccess,
    syncClientEvents,
    disconnect,
  };
}
