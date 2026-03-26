import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { UserStatus } from "@/types";

export async function updateMyStatus(status: UserStatus) {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase
    .from("user_presence")
    .update({ status, last_seen: new Date().toISOString() })
    .eq("user_id", user.id);
}

export async function moveToRoom(roomId: string | null, x: number, y: number) {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase
    .from("user_presence")
    .update({ room_id: roomId, x, y, last_seen: new Date().toISOString() })
    .eq("user_id", user.id);
}

export async function knockOnUser(targetUserId: string) {
  const user = useAuthStore.getState().user;
  if (!user) return;
  await supabase.from("knock_notifications").insert({
    from_user_id: user.id,
    target_user_id: targetUserId,
    message: `${user.name} quer falar com você`,
  });
}
