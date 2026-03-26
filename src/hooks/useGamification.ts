import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { LeaderboardEntry, Title, User, UserTitle } from "@/types";

export function useGamification() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userTitles, setUserTitles] = useState<UserTitle[]>([]);
  const [availableTitles, setAvailableTitles] = useState<Title[]>([]);
  const { user, refreshUser } = useAuthStore();

  useEffect(() => {
    loadLeaderboard();
    loadTitles();
    if (user) loadUserTitles();
  }, [user?.id]);

  async function loadLeaderboard() {
    const { data } = await supabase
      .from("users")
      .select("id, name, avatar_url, team, xp, level, title_active:titles(*)")
      .order("xp", { ascending: false })
      .limit(20);

    if (data) {
      setLeaderboard(
        data.map((u, i) => ({
          user_id: u.id,
          user: u as unknown as User,
          xp: u.xp,
          rank: i + 1,
          category: "overall",
          period: "monthly",
        }))
      );
    }
  }

  async function loadTitles() {
    const { data } = await supabase.from("titles").select("*").order("category").order("xp_required");
    if (data) setAvailableTitles(data as Title[]);
  }

  async function loadUserTitles() {
    if (!user) return;
    const { data } = await supabase
      .from("user_titles")
      .select("*, title:titles(*)")
      .eq("user_id", user.id);
    if (data) setUserTitles(data as UserTitle[]);
  }

  async function equipTitle(titleId: string) {
    if (!user) return;
    await supabase
      .from("users")
      .update({ title_active_id: titleId })
      .eq("id", user.id);
    await refreshUser();
  }

  async function checkAndAwardTitles() {
    if (!user) return;

    // Check sales count
    const { count: salesCount } = await supabase
      .from("posts")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("type", "sale");

    // Check innovation posts
    const { count: innovCount } = await supabase
      .from("posts")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .in("type", ["innovation", "ai_solution"]);

    // Check wiki pages
    const { count: wikiCount } = await supabase
      .from("wiki_pages")
      .select("id", { count: "exact" })
      .eq("author_id", user.id);

    const eligibleTitles: string[] = [];

    if ((salesCount ?? 0) >= 5) eligibleTitles.push("prospector");
    if ((salesCount ?? 0) >= 20) eligibleTitles.push("closer");
    if ((innovCount ?? 0) >= 1) eligibleTitles.push("curious_digital");
    if ((innovCount ?? 0) >= 3) eligibleTitles.push("solver");
    if ((innovCount ?? 0) >= 5) eligibleTitles.push("innovator");
    if ((wikiCount ?? 0) >= 5) eligibleTitles.push("documenter");

    for (const slug of eligibleTitles) {
      const title = availableTitles.find((t) => t.id === slug || t.name.toLowerCase().includes(slug));
      if (!title) continue;

      const alreadyHas = userTitles.some((ut) => ut.title_id === title.id);
      if (!alreadyHas) {
        await supabase.from("user_titles").upsert({
          user_id: user.id,
          title_id: title.id,
          earned_at: new Date().toISOString(),
        });
      }
    }

    await loadUserTitles();
  }

  return {
    leaderboard,
    userTitles,
    availableTitles,
    equipTitle,
    checkAndAwardTitles,
    refreshLeaderboard: loadLeaderboard,
  };
}
