import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/types";

export function useAuth() {
  const { user, session, loading, setUser, setSession, setLoading, signInWithGoogle, signOut } =
    useAuthStore();

  useEffect(() => {
    let cancelled = false;

    // Safety timeout — unblock loading after 8s no matter what
    const safetyTimer = setTimeout(() => {
      console.warn("[OPUS] safety timeout — forcing setLoading(false)");
      if (!cancelled) setLoading(false);
    }, 8000);

    // Step 1: Eagerly restore session from storage on mount.
    // This avoids the flash-to-login on reload in Tauri WebView.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log("[OPUS] getSession:", session?.user?.email ?? "no session");
      if (cancelled) return;
      if (session?.user) {
        setSession(session);
        try {
          await upsertAndFetchUser(session);
        } catch (err) {
          console.error("[OPUS] upsertAndFetchUser (getSession) failed:", err);
          setUser({
            id: session.user.id,
            email: session.user.email ?? "",
            name: session.user.user_metadata?.full_name ?? session.user.email ?? "",
            avatar_url: session.user.user_metadata?.avatar_url ?? "",
            opus_role: "pending",
            approval_status: "pending",
          } as import("@/types").User);
        } finally {
          if (!cancelled) setLoading(false);
        }
      } else {
        // No session — show login immediately, don't wait for onAuthStateChange
        if (!cancelled) setLoading(false);
      }
    });

    // Step 2: Listen for auth changes (captures OAuth callback + token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[OPUS] onAuthStateChange:", event, session?.user?.email);
      if (cancelled) return;

      // Ignore INITIAL_SESSION — already handled by getSession above
      if (event === "INITIAL_SESSION") return;

      setSession(session);
      if (session?.user) {
        try {
          await upsertAndFetchUser(session);
        } catch (err) {
          console.error("[OPUS] upsertAndFetchUser failed:", err);
          setUser({
            id: session.user.id,
            email: session.user.email ?? "",
            name: session.user.user_metadata?.full_name ?? session.user.email ?? "",
            avatar_url: session.user.user_metadata?.avatar_url ?? "",
            opus_role: "pending",
            approval_status: "pending",
          } as import("@/types").User);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  async function upsertAndFetchUser(session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>) {
    const googleUser = session.user;
    const meta = googleUser.user_metadata ?? {};
    const email = googleUser.email ?? "";

    // ── Restrição de domínio ──────────────────────────────────────────────
    const ALLOWED_DOMAIN = "v4company.com";
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      console.warn("[OPUS] Domínio não autorizado:", email);
      await supabase.auth.signOut();
      setUser(null);
      return;
    }

    // Get google_id from identity data
    const googleIdentity = googleUser.identities?.find(i => i.provider === "google");
    const googleId = googleIdentity?.id ?? googleUser.id;

    try {
      // Verificar se usuário já existe (preserva opus_role/approval_status)
      const { data: existing } = await supabase
        .from("users")
        .select("*, title_active:titles(*)")
        .eq("id", googleUser.id)
        .single();

      let user;
      if (existing) {
        // Já existe — atualiza só campos do Google
        const { data: updated, error } = await supabase
          .from("users")
          .update({
            name: meta.full_name ?? meta.name ?? email,
            avatar_url: meta.avatar_url ?? meta.picture ?? existing.avatar_url ?? "",
            updated_at: new Date().toISOString(),
          })
          .eq("id", googleUser.id)
          .select("*, title_active:titles(*)")
          .single();
        if (error) { console.error("Erro ao update user:", error); return; }
        user = updated;
      } else {
        // Novo usuário — cria como pending aguardando aprovação
        const { data: created, error } = await supabase
          .from("users")
          .insert({
            id: googleUser.id,
            google_id: googleId,
            name: meta.full_name ?? meta.name ?? email,
            email,
            avatar_url: meta.avatar_url ?? meta.picture ?? "",
            opus_role: "pending",
            approval_status: "pending",
          })
          .select("*, title_active:titles(*)")
          .single();
        if (error) { console.error("Erro ao insert user:", error); return; }
        user = created;
      }

      if (user) {
        setUser(user as User);

        // Só configura presença e XP para usuários aprovados
        if (user.approval_status === "approved") {
          // Upsert presence as online — spawn at corridor center (matches OfficeCanvas SPAWN)
          try {
            await supabase.from("user_presence").upsert(
              {
                user_id: user.id,
                status: "available",
                x: 680,
                y: 480,
                last_seen: new Date().toISOString(),
              },
              { onConflict: "user_id" }
            );
          } catch (presenceErr) {
            console.warn("[OPUS] presence upsert failed (non-fatal):", presenceErr);
          }

          // Give daily presence XP — non-fatal
          try {
            await grantDailyXP(user.id);
          } catch (xpErr) {
            console.warn("[OPUS] daily XP grant failed (non-fatal):", xpErr);
          }
        }
      }
    } catch (err) {
      console.error("[OPUS] Erro no upsertAndFetchUser:", err);
    }
  }

  async function grantDailyXP(userId: string) {
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("xp_events")
      .select("id")
      .eq("user_id", userId)
      .eq("type", "daily_presence")
      .gte("created_at", `${today}T00:00:00`)
      .maybeSingle();

    if (!existing) {
      await supabase.from("xp_events").insert({
        user_id: userId,
        type: "daily_presence",
        xp: 5,
        description: "Presença diária",
      });

      // RPC may not exist yet — ignore error
      const { error: rpcErr } = await supabase.rpc("increment_user_xp", { p_user_id: userId, p_xp: 5 });
      if (rpcErr) console.warn("[OPUS] increment_user_xp RPC:", rpcErr.message);
    }
  }

  return { user, session, loading, signInWithGoogle, signOut };
}
