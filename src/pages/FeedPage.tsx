import { useState } from "react";
import { useFeed } from "@/hooks/useFeed";
import { useDirect } from "@/hooks/useDirect";
import { PostCard } from "@/components/feed/PostCard";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { DMSidebar } from "@/components/feed/DMSidebar";
import { Leaderboard } from "@/components/gamification/Leaderboard";
import { useAuthStore } from "@/store/authStore";
import { LayoutGrid, Trophy } from "lucide-react";
import type { PostType } from "@/types";
import { getPostTypeIcon, getPostTypeLabel } from "@/lib/utils";

const POST_TYPES: PostType[] = ["sale", "feedback", "delivery", "innovation", "ai_solution", "celebration"];

export function FeedPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [defaultType, setDefaultType] = useState<PostType>("sale");
  const [activeTab, setActiveTab] = useState<"feed" | "leaderboard">("feed");
  const { posts, loading, createPost, addReaction } = useFeed();
  const { user } = useAuthStore();
  const dm = useDirect();

  function openCreate(type: PostType = "sale") {
    setDefaultType(type);
    setShowCreate(true);
  }

  return (
    <div className="flex h-full gap-4 overflow-hidden">

      {/* ── Feed column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top nav */}
        <div className="flex items-center gap-1 mb-3 px-1">
          <button
            onClick={() => setActiveTab("feed")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "feed" ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={15} />
            Feed
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === "leaderboard" ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy size={15} />
            Ranking
          </button>
        </div>

        {activeTab === "feed" ? (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden max-w-[520px] mx-auto w-full">

            {/* Stories — post type shortcuts */}
            <div className="flex gap-4 mb-4 overflow-x-auto pb-1 scrollbar-hide px-1">
              {/* My avatar = novo post */}
              <button onClick={() => openCreate()} className="flex flex-col items-center gap-1.5 shrink-0 group">
                <div className="w-[54px] h-[54px] rounded-full bg-gradient-to-br from-primary to-purple-500 p-[2.5px]">
                  <div className="w-full h-full rounded-full bg-background overflow-hidden">
                    <img
                      src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? "?")}&background=1e2d4a&color=fff&size=54`}
                      alt={user?.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground w-[54px] text-center truncate">Seu post</span>
              </button>

              {POST_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => openCreate(type)}
                  className="flex flex-col items-center gap-1.5 shrink-0"
                >
                  <div className="w-[54px] h-[54px] rounded-full border-2 border-border/50 hover:border-primary/50 bg-secondary/40 hover:bg-secondary/70 flex items-center justify-center text-2xl transition-all">
                    {getPostTypeIcon(type)}
                  </div>
                  <span className="text-[11px] text-muted-foreground w-[54px] text-center truncate">
                    {getPostTypeLabel(type)}
                  </span>
                </button>
              ))}
            </div>

            <div className="border-t border-border/30 mb-3" />

            {/* Create bar */}
            <button
              onClick={() => openCreate()}
              className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-2xl border border-border/40 hover:border-border/70 bg-secondary/10 hover:bg-secondary/25 transition-all text-left w-full"
            >
              <img
                src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? "?")}&background=1e2d4a&color=fff&size=36`}
                className="w-8 h-8 rounded-full object-cover shrink-0"
                alt=""
              />
              <span className="text-sm text-muted-foreground">Compartilhe uma conquista...</span>
            </button>

            {/* Posts */}
            <div className="flex-1 overflow-y-auto -mx-1 pr-1">
              {loading ? (
                <div className="space-y-4 px-1">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex items-center gap-3 px-1 mb-3">
                        <div className="w-9 h-9 rounded-full bg-secondary" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-3 bg-secondary rounded w-1/4" />
                          <div className="h-2 bg-secondary rounded w-1/6" />
                        </div>
                      </div>
                      <div className="h-36 bg-secondary/40 rounded-2xl mb-3" />
                    </div>
                  ))}
                </div>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                  <span className="text-4xl mb-3">📭</span>
                  <p className="font-medium">Nenhum post ainda</p>
                  <p className="text-sm">Seja o primeiro a compartilhar!</p>
                </div>
              ) : (
                posts.map((post) => (
                  <PostCard key={post.id} post={post} onReact={addReaction} />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <Leaderboard />
          </div>
        )}
      </div>

      {/* ── DM Sidebar — right column ── */}
      <DMSidebar dm={dm} />

      <CreatePostModal
        open={showCreate}
        defaultType={defaultType}
        onClose={() => setShowCreate(false)}
        onCreate={createPost}
      />
    </div>
  );
}
