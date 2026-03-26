import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { PostComment } from "@/types";

export function useComments(postId: string) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    loadComments();

    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` },
        () => loadComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  async function loadComments() {
    setLoading(true);
    const { data } = await supabase
      .from("post_comments")
      .select("*, user:users(id, name, avatar_url, team)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data) setComments(data as PostComment[]);
    setLoading(false);
  }

  async function addComment(content: string) {
    if (!user || !content.trim()) return;
    await supabase.from("post_comments").insert({
      post_id: postId,
      user_id: user.id,
      content: content.trim(),
    });
  }

  async function deleteComment(id: string) {
    await supabase.from("post_comments").delete().eq("id", id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  }

  return { comments, loading, addComment, deleteComment };
}
