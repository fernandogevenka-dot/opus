import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, ArrowLeft, Edit2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { timeAgo } from "@/lib/utils";
import type { useDirect } from "@/hooks/useDirect";
import type { User } from "@/types";

type DMHook = ReturnType<typeof useDirect>;

interface DMSidebarProps {
  dm: DMHook;
}

export function DMSidebar({ dm }: DMSidebarProps) {
  const { user } = useAuthStore();
  const [input, setInput] = useState("");
  const [view, setView] = useState<"list" | "chat">("list");
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showNewDM, setShowNewDM] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activePartner = dm.threads.find((t) => t.partner.id === dm.activePartnerId)?.partner
    ?? allUsers.find((u) => u.id === dm.activePartnerId);

  // Load all users for new DM
  useEffect(() => {
    supabase
      .from("users")
      .select("id, name, avatar_url, team, status")
      .neq("id", user?.id ?? "")
      .order("name")
      .limit(50)
      .then(({ data }) => { if (data) setAllUsers(data as User[]); });
  }, [user]);

  useEffect(() => {
    if (dm.activePartnerId) setView("chat");
  }, [dm.activePartnerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dm.messages]);

  async function handleSend() {
    if (!input.trim() || !dm.activePartnerId) return;
    await dm.sendMessage(dm.activePartnerId, input.trim());
    setInput("");
  }

  function openChat(partnerId: string) {
    dm.openThread(partnerId);
    setView("chat");
    setShowNewDM(false);
  }

  const STATUS_DOT: Record<string, string> = {
    available: "bg-green-500",
    busy: "bg-yellow-500",
    in_meeting: "bg-red-500",
    away: "bg-gray-400",
    offline: "bg-gray-600",
  };

  return (
    <div className="w-72 shrink-0 flex flex-col h-full glass rounded-2xl border border-border/40 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        {view === "chat" ? (
          <>
            <button
              onClick={() => { setView("list"); dm.closeThread(); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            {activePartner && (
              <div className="flex items-center gap-2 flex-1 mx-2 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={activePartner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.name)}&background=1e2d4a&color=fff&size=32`}
                    className="w-7 h-7 rounded-full object-cover"
                    alt=""
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-background ${STATUS_DOT[activePartner.status] ?? STATUS_DOT.offline}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate leading-none">{activePartner.name.split(" ")[0]}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{activePartner.team}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="font-semibold text-sm">Mensagens</p>
            <button
              onClick={() => setShowNewDM(!showNewDM)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Nova conversa"
            >
              <Edit2 size={15} />
            </button>
          </>
        )}
      </div>

      {/* ── New DM user picker ── */}
      <AnimatePresence>
        {showNewDM && view === "list" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border/30"
          >
            <div className="px-3 py-2">
              <p className="text-xs text-muted-foreground mb-2">Nova conversa</p>
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {allUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openChat(u.id)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=1e2d4a&color=fff&size=32`}
                        className="w-7 h-7 rounded-full object-cover"
                        alt=""
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-background ${STATUS_DOT[u.status] ?? STATUS_DOT.offline}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.team}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Thread list ── */}
      {view === "list" && (
        <div className="flex-1 overflow-y-auto">
          {dm.threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground px-4 text-center">
              <Send size={24} className="opacity-30" />
              <p className="text-xs">Nenhuma conversa ainda.</p>
              <button
                onClick={() => setShowNewDM(true)}
                className="text-xs text-primary hover:underline"
              >
                Iniciar uma conversa
              </button>
            </div>
          ) : (
            dm.threads.map((t) => (
              <button
                key={t.partner.id}
                onClick={() => openChat(t.partner.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors border-b border-border/20 text-left"
              >
                <div className="relative shrink-0">
                  <img
                    src={t.partner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.partner.name)}&background=1e2d4a&color=fff&size=40`}
                    className="w-9 h-9 rounded-full object-cover"
                    alt=""
                  />
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${STATUS_DOT[t.partner.status] ?? STATUS_DOT.offline}`} />
                  {t.unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                      {t.unread > 9 ? "9+" : t.unread}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-sm truncate ${t.unread > 0 ? "font-semibold" : "font-medium"}`}>
                      {t.partner.name.split(" ")[0]} {t.partner.name.split(" ").slice(-1)[0]}
                    </p>
                    <p className="text-[10px] text-muted-foreground shrink-0 ml-1">{timeAgo(t.lastMessage.created_at)}</p>
                  </div>
                  <p className={`text-xs truncate ${t.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                    {t.lastMessage.from_user_id === user?.id ? "Você: " : ""}
                    {t.lastMessage.content}
                  </p>
                </div>
              </button>
            ))
          )}

          {/* Suggested — all users not yet in threads */}
          {dm.threads.length < 5 && (
            <div className="px-4 pt-3 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Sugeridos</p>
              {allUsers
                .filter((u) => !dm.threads.find((t) => t.partner.id === u.id))
                .slice(0, 5)
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => openChat(u.id)}
                    className="w-full flex items-center gap-2.5 px-1 py-2 rounded-xl hover:bg-secondary/30 transition-colors text-left"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={u.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=1e2d4a&color=fff&size=36`}
                        className="w-8 h-8 rounded-full object-cover"
                        alt=""
                      />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-background ${STATUS_DOT[u.status] ?? STATUS_DOT.offline}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{u.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{u.team}</p>
                    </div>
                    <Send size={12} className="text-muted-foreground/50 shrink-0" />
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Chat view ── */}
      {view === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {dm.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-28 text-muted-foreground gap-1">
                {activePartner && (
                  <img
                    src={activePartner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.name)}&background=1e2d4a&color=fff&size=48`}
                    className="w-12 h-12 rounded-full object-cover mb-1"
                    alt=""
                  />
                )}
                <p className="text-xs text-center">Comece uma conversa com<br /><span className="font-semibold">{activePartner?.name.split(" ")[0]}</span></p>
              </div>
            )}
            {dm.messages.map((msg) => {
              const isMine = msg.from_user_id === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-secondary/70 rounded-bl-sm"
                  }`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <p className={`text-[9px] mt-0.5 ${isMine ? "text-primary-foreground/50" : "text-muted-foreground/60"}`}>
                      {timeAgo(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-border/30">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2 bg-secondary/30 rounded-2xl px-3 py-1.5 border border-border/20"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Mensagem para ${activePartner?.name.split(" ")[0] ?? "..."}...`}
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
                autoFocus
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="text-primary disabled:opacity-30 transition-opacity"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
