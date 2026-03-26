import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { Post, PostType, ReactionEmoji } from "@/types";

export function useFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    loadPosts();

    // Realtime subscription
    const channel = supabase
      .channel("feed-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => {
        loadPosts();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, () => {
        loadPosts();
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  async function loadPosts() {
    setLoading(true);
    const { data } = await supabase
      .from("posts")
      .select(`
        *,
        user:users(id, name, avatar_url, team, xp, level, title_active:titles(*)),
        reactions(id, emoji, user_id, user:users(id, name, avatar_url))
      `)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      // Aggregate reaction counts
      const enriched = data.map((p) => {
        const counts: Record<string, number> = {};
        for (const r of (p.reactions ?? [])) {
          counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
        }
        return { ...p, reaction_counts: counts };
      });
      setPosts(enriched as Post[]);
    }
    setLoading(false);
  }

  async function createPost(
    type: PostType,
    title: string,
    content: string,
    metadata: Record<string, unknown> = {},
    mediaFile?: File | null
  ) {
    if (!user) return null;

    const XP_MAP: Record<PostType, number> = {
      sale: 100,
      feedback: 50,
      delivery: 30,
      innovation: 80,
      ai_solution: 40,
      announcement: 0,
      celebration: 10,
    };

    const xp = XP_MAP[type] ?? 0;

    // Upload media if provided (non-blocking — post is created even if upload fails)
    let media_url: string | null = null;
    let media_type: "image" | "video" | null = null;
    if (mediaFile) {
      try {
        const ext = mediaFile.name.split(".").pop() ?? "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;
        // Race against a 15s timeout so a missing/misconfigured bucket doesn't freeze the UI
        const uploadResult = await Promise.race([
          supabase.storage.from("post-media").upload(path, mediaFile, { upsert: false }),
          new Promise<{ error: { message: string } }>((resolve) =>
            setTimeout(() => resolve({ error: { message: "Upload timeout" } }), 15000)
          ),
        ]);
        const uploadError = (uploadResult as { error: { message: string } | null }).error;
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("post-media").getPublicUrl(path);
          media_url = urlData.publicUrl;
          media_type = mediaFile.type.startsWith("video/") ? "video" : "image";
        } else {
          console.warn("Media upload failed:", uploadError.message);
        }
      } catch (uploadErr) {
        console.warn("Media upload exception:", uploadErr);
      }
    }

    const { data: post, error } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        type,
        title,
        content,
        metadata,
        xp_generated: xp,
        ...(media_url ? { media_url, media_type } : {}),
      })
      .select()
      .single();

    if (error) throw error;

    // Grant XP if applicable (non-blocking — post is already created)
    if (xp > 0) {
      // Fire-and-forget: don't await, so XP errors never block the UI
      void (async () => {
        try {
          await supabase.from("xp_events").insert({
            user_id: user.id,
            type: `${type}_${type === "sale" ? "closed" : type === "feedback" ? "received" : "completed"}`,
            xp,
            reference_id: post.id,
            description: title,
          });
          await supabase.rpc("increment_user_xp", { p_user_id: user.id, p_xp: xp });
        } catch (xpErr) {
          console.warn("XP grant failed (non-critical):", xpErr);
        }
      })();
    }

    // Fire-and-forget: notifica o time por e-mail (não bloqueia publicação)
    fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-post`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          post_id: post.id,
          post_type: type,
          post_title: title,
          post_content: content || undefined,
          author_name: user.name ?? "Alguém do time",
          author_avatar: user.avatar_url ?? undefined,
        }),
      }
    ).catch((err) => console.warn("Email notification failed (non-critical):", err));

    return post;
  }

  async function addReaction(postId: string, emoji: ReactionEmoji) {
    if (!user) return;

    // Optimistic update first — makes UI feel instant
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;

        const reactions = p.reactions ?? [];
        const existing = reactions.find((r) => r.user_id === user.id && r.emoji === emoji);
        const newReactions = existing
          ? reactions.filter((r) => !(r.user_id === user.id && r.emoji === emoji))
          : [...reactions, { id: "optimistic", post_id: postId, user_id: user.id, emoji, created_at: new Date().toISOString() }];

        const counts: Record<string, number> = {};
        for (const r of newReactions) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;

        return { ...p, reactions: newReactions, reaction_counts: counts };
      })
    );

    // Persist to DB
    const { data: existing } = await supabase
      .from("reactions")
      .select("id")
      .eq("post_id", postId)
      .eq("user_id", user.id)
      .eq("emoji", emoji)
      .maybeSingle();

    if (existing) {
      await supabase.from("reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("reactions").insert({ post_id: postId, user_id: user.id, emoji });
    }

    // XP milestone at 10 reactions
    const { count } = await supabase
      .from("reactions")
      .select("id", { count: "exact" })
      .eq("post_id", postId);

    if (count === 10) {
      const post = posts.find((p) => p.id === postId);
      if (post && post.user_id !== user.id) {
        await supabase.from("xp_events").insert({
          user_id: post.user_id,
          type: "post_viral",
          xp: 20,
          reference_id: postId,
          description: "Post atingiu 10 reações",
        });
        await supabase.rpc("increment_user_xp", { p_user_id: post.user_id, p_xp: 20 });
      }
    }
  }

  return { posts, loading, createPost, addReaction };
}
