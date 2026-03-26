import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { User } from "@/types";

export function useAuth() {
  const { user, session, loading, setUser, setSession, setLoading, signInWithGoogle, signOut } =
    useAuthStore();

  useEffect(() => {
    // Listen for auth changes FIRST (captures the OAuth redirect callback)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[OPUS] onAuthStateChange:", event, session?.user?.email);
      setSession(session);
      if (session?.user) {
        try {
          await upsertAndFetchUser(session);
        } catch (err) {
          console.error("[OPUS] upsertAndFetchUser failed:", err);
        }
      } else {
        setUser(null);
      }
      setLoading(false); // ALWAYS unblock loading, even if upsert fails
    });

    // Safety timeout — unblock loading after 8s no matter what
    const safetyTimer = setTimeout(() => {
      console.warn("[OPUS] safety timeout — forcing setLoading(false)");
      setLoading(false);
    }, 8000);

    // Handle OAuth code in URL (PKCE flow)
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
    const hasCode = params.has("code") || hashParams.has("access_token");

    if (hasCode) {
      console.log("[OPUS] OAuth code/token detected in URL, exchanging...");
      supabase.auth.getSession().then(({ data: { session } }) => {
        console.log("[OPUS] session after code exchange:", session?.user?.email ?? "none");
        if (!session) setLoading(false);
      });
    } else {
      // Normal page load — check for existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        console.log("[OPUS] getSession:", session?.user?.email ?? "no session");
        if (!session) setLoading(false);
      });
    }

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);

  async function upsertAndFetchUser(session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>) {
    const googleUser = session.user;
    const meta = googleUser.user_metadata ?? {};

    // Get google_id from identity data
    const googleIdentity = googleUser.identities?.find(i => i.provider === "google");
    const googleId = googleIdentity?.id ?? googleUser.id;

    try {
      const { data: user, error } = await supabase
        .from("users")
        .upsert(
          {
            id: googleUser.id,
            google_id: googleId,
            name: meta.full_name ?? meta.name ?? googleUser.email ?? "Usuário",
            email: googleUser.email ?? "",
            avatar_url: meta.avatar_url ?? meta.picture ?? "",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select("*, title_active:titles(*)")
        .single();

      if (error) {
        console.error("Erro ao upsert user:", error);
        return;
      }

      if (user) {
        setUser(user as User);

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
