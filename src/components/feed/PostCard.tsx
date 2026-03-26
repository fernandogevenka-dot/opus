import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPostTypeIcon, getPostTypeLabel, timeAgo } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useComments } from "@/hooks/useComments";
import type { Post, ReactionEmoji } from "@/types";
import { Heart, MessageCircle, Zap, Bookmark, Send, Trash2 } from "lucide-react";

const REACTIONS: ReactionEmoji[] = ["🔥", "❤️", "👏", "🎯", "💡"];

const TYPE_GRADIENT: Record<string, string> = {
  sale:         "from-amber-500/30 via-yellow-400/10 to-transparent",
  feedback:     "from-blue-500/30 via-blue-400/10 to-transparent",
  delivery:     "from-emerald-500/30 via-green-400/10 to-transparent",
  innovation:   "from-violet-500/30 via-purple-400/10 to-transparent",
  ai_solution:  "from-cyan-500/30 via-sky-400/10 to-transparent",
  announcement: "from-gray-500/20 via-gray-400/10 to-transparent",
  celebration:  "from-pink-500/30 via-rose-400/10 to-transparent",
};

interface PostCardProps {
  post: Post;
  onReact: (postId: string, emoji: ReactionEmoji) => void;
}

export function PostCard({ post, onReact }: PostCardProps) {
  const { user } = useAuthStore();
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const { comments, addComment, deleteComment } = useComments(showComments ? post.id : "");

  const myReaction = post.reactions?.find((r) => r.user_id === user?.id)?.emoji;
  const totalReactions = Object.values(post.reaction_counts ?? {}).reduce((a, b) => a + b, 0);
  const isLiked = !!myReaction;
  const gradient = TYPE_GRADIENT[post.type] ?? TYPE_GRADIENT.announcement;

  function handleHeartClick() {
    setHeartBurst(true);
    setTimeout(() => setHeartBurst(false), 400);
    onReact(post.id, "❤️");
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentInput.trim()) return;
    await addComment(commentInput.trim());
    setCommentInput("");
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-1 mb-2.5">
        <div style={{ background: "linear-gradient(135deg, var(--primary), #a855f7)" }} className="p-[2px] rounded-full">
          <img
            src={post.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.user?.name ?? "?")}&background=1e2d4a&color=fff&size=40`}
            alt={post.user?.name}
            className="w-9 h-9 rounded-full object-cover ring-[2px] ring-background"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm leading-none truncate">{post.user?.name}</p>
            {post.user?.title_active && (
              <span className="title-badge text-xs shrink-0">
                {post.user.title_active.icon} {post.user.title_active.name}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{post.user?.team}</p>
        </div>

        <span className="text-lg shrink-0">{getPostTypeIcon(post.type)}</span>
      </div>

      {/* ── Cover area ── */}
      <div className={`relative rounded-2xl bg-gradient-to-b ${gradient} border border-border/30 mb-2.5 overflow-hidden ${post.media_url ? "" : "h-36 flex flex-col items-center justify-center px-5"}`}>
        {post.media_url ? (
          post.media_type === "video" ? (
            <video
              src={post.media_url}
              className="w-full max-h-72 object-cover"
              controls
              playsInline
            />
          ) : (
            <img
              src={post.media_url}
              alt={post.title}
              className="w-full max-h-72 object-cover"
            />
          )
        ) : (
          <>
            <div className="text-5xl mb-2 opacity-80">{getPostTypeIcon(post.type)}</div>
            <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground/80 bg-background/40 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
              {getPostTypeLabel(post.type)}
            </span>
          </>
        )}

        {post.type === "sale" && post.metadata && (
          <div className="absolute bottom-2.5 left-3 right-3 flex gap-1.5 justify-center flex-wrap">
            {!!post.metadata.value && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-semibold backdrop-blur-sm">
                💰 {String(post.metadata.value)}
              </span>
            )}
            {!!post.metadata.client && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 backdrop-blur-sm">
                🏢 {String(post.metadata.client)}
              </span>
            )}
          </div>
        )}

        {post.xp_generated > 0 && (
          <div className="absolute top-2.5 right-2.5">
            <span className="xp-badge text-xs flex items-center gap-1">
              <Zap size={9} />+{post.xp_generated} XP
            </span>
          </div>
        )}
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center gap-3 px-1 mb-2">
        {/* Heart */}
        <button onClick={handleHeartClick} className="relative flex items-center transition-transform active:scale-90">
          <AnimatePresence>
            {heartBurst && (
              <motion.div
                key="burst"
                initial={{ scale: 0, opacity: 1 }}
                animate={{ scale: 2.5, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 text-red-500 flex items-center justify-center pointer-events-none"
              >
                <Heart size={18} fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>
          <Heart size={22} className={`transition-colors ${isLiked ? "text-red-500 fill-red-500" : "text-foreground/70 hover:text-foreground"}`} />
        </button>

        {/* Comment toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1"
        >
          <MessageCircle size={22} className={`transition-colors ${showComments ? "text-primary" : "text-foreground/70 hover:text-foreground"}`} />
        </button>

        {/* Emoji reactions */}
        <div className="relative">
          <button onClick={() => setShowReactions(!showReactions)}>
            <span className="text-lg text-foreground/70 hover:text-foreground transition-colors">😊</span>
          </button>
          <AnimatePresence>
            {showReactions && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-2 left-0 flex gap-1 glass-strong rounded-2xl p-1.5 shadow-xl z-20"
              >
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { onReact(post.id, emoji); setShowReactions(false); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-secondary/80 transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button className="ml-auto">
          <Bookmark size={22} className="text-foreground/70 hover:text-foreground transition-colors" />
        </button>
      </div>

      {/* ── Reaction count ── */}
      {totalReactions > 0 && (
        <div className="flex items-center gap-1.5 px-1 mb-1.5">
          <div className="flex -space-x-0.5">
            {Object.entries(post.reaction_counts ?? {}).slice(0, 3).map(([emoji]) => (
              <span key={emoji} className="text-sm">{emoji}</span>
            ))}
          </div>
          <span className="text-sm font-semibold">{totalReactions}</span>
        </div>
      )}

      {/* ── Caption ── */}
      <div className="px-1 mb-2">
        <p className="text-sm leading-relaxed">
          <span className="font-semibold mr-1.5">{post.user?.name?.split(" ")[0]}</span>
          <span className="font-semibold">{post.title}</span>
          {post.content && <span className="text-muted-foreground"> · {post.content}</span>}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(post.created_at)}</p>
      </div>

      {/* ── Comments section ── */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-1 space-y-2 mb-3">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2 group">
                  <img
                    src={c.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.user?.name ?? "?")}&background=1e2d4a&color=fff&size=28`}
                    className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
                    alt=""
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-semibold mr-1.5">{c.user?.name?.split(" ")[0]}</span>
                      {c.content}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">{timeAgo(c.created_at)}</p>
                  </div>
                  {c.user_id === user?.id && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/50 hover:text-red-400 mt-0.5"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Comment input */}
            <form onSubmit={handleComment} className="flex items-center gap-2 px-1 pb-1">
              <img
                src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? "?")}&background=1e2d4a&color=fff&size=28`}
                className="w-7 h-7 rounded-full object-cover shrink-0"
                alt=""
              />
              <div className="flex-1 flex items-center gap-2 bg-secondary/40 rounded-2xl px-3 py-1.5 border border-border/30">
                <input
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder="Adicione um comentário..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
                  maxLength={500}
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim()}
                  className="text-primary disabled:opacity-30 transition-opacity shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-b border-border/20 mt-4" />
    </motion.article>
  );
}
