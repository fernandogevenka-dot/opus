import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  session: import("@supabase/supabase-js").Session | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: import("@supabase/supabase-js").Session | null) => void;
  setLoading: (loading: boolean) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: [
          "openid",
          "profile",
          "email",
          "https://www.googleapis.com/auth/calendar.readonly",
          "https://www.googleapis.com/auth/drive.readonly",
        ].join(" "),
        redirectTo: `${window.location.origin}`,
      },
    });
    if (error) throw error;
  },

  signOut: async () => {
    // Update presence to offline before signing out
    const { user } = get();
    if (user) {
      await supabase
        .from("user_presence")
        .update({ status: "offline", last_seen: new Date().toISOString() })
        .eq("user_id", user.id);
    }
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },

  refreshUser: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data: user } = await supabase
      .from("users")
      .select("*, title_active:titles(*)")
      .eq("id", session.user.id)
      .single();

    if (user) set({ user: user as User });
  },
}));
