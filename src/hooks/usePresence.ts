import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useOfficeStore } from "@/store/officeStore";
import { useAuthStore } from "@/store/authStore";
import type { UserPresence } from "@/types";

// Re-export for convenience
export { updateMyStatus, moveToRoom, knockOnUser } from "@/lib/presence";

export function usePresence() {
  const { user } = useAuthStore();
  const { setPresences, updatePresence, removePresence, setRooms } = useOfficeStore();

  useEffect(() => {
    if (!user) return;

    loadPresences();
    loadRooms();

    const channel = supabase
      .channel("office-presence")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_presence" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            removePresence(payload.old.user_id as string);
          } else {
            const { data } = await supabase
              .from("user_presence")
              .select("*, user:users(id, name, avatar_url, team, title_active_id, xp, level, title_active:titles(*))")
              .eq("user_id", (payload.new as UserPresence).user_id)
              .single();
            if (data) updatePresence(data as UserPresence);
          }
        }
      )
      .subscribe();

    const heartbeat = setInterval(async () => {
      await supabase
        .from("user_presence")
        .update({ last_seen: new Date().toISOString() })
        .eq("user_id", user.id);
    }, 30000);

    const handleBeforeUnload = () => {
      supabase
        .from("user_presence")
        .update({ status: "offline", last_seen: new Date().toISOString() })
        .eq("user_id", user.id);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      channel.unsubscribe();
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [user?.id]);

  async function loadPresences() {
    const { data } = await supabase
      .from("user_presence")
      .select("*, user:users(id, name, avatar_url, team, title_active_id, xp, level, title_active:titles(*))")
      .neq("status", "offline");
    if (data) setPresences(data as UserPresence[]);
  }

  async function loadRooms() {
    const { data } = await supabase.from("rooms").select("*").order("name");
    if (data) setRooms(data);
  }
}
