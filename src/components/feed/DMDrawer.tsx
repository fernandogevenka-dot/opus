import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ArrowLeft, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { timeAgo } from "@/lib/utils";
import type { useDirect } from "@/hooks/useDirect";

type DMHook = ReturnType<typeof useDirect>;

interface DMDrawerProps {
  dm: DMHook;
  open: boolean;
  onClose: () => void;
}

export function DMDrawer({ dm, open, onClose }: DMDrawerProps) {
  const { user } = useAuthStore();
  const [input, setInput] = useState("");
  const [view, setView] = useState<"list" | "chat">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activePartner = dm.threads.find((t) => t.partner.id === dm.activePartnerId)?.partner;

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

  function handleClose() {
    setView("list");
    dm.closeThread();
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          {/* Drawer — slides in from right */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-sm glass-strong border-l border-border/50 z-50 flex flex-col shadow-2xl"
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/40">
              {view === "chat" && (
                <button
                  onClick={() => { setView("list"); dm.closeThread(); }}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft size={18} />
                </button>
              )}

              {view === "chat" && activePartner ? (
                <div className="flex items-center gap-2.5 flex-1">
                  <img
                    src={activePartner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.name)}&background=1e2d4a&color=fff&size=40`}
                    alt={activePartner.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-sm leading-none">{activePartner.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{activePartner.team}</p>
                  </div>
                </div>
              ) : (
                <p className="font-semibold flex-1">Mensagens</p>
              )}

              <button onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors ml-auto">
                <X size={18} />
              </button>
            </div>

            {/* ── Thread list ── */}
            {view === "list" && (
              <div className="flex-1 overflow-y-auto">
                {dm.threads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                    <Send size={28} className="opacity-30" />
                    <p className="text-sm">Nenhuma conversa ainda</p>
                  </div>
                ) : (
                  dm.threads.map((t) => (
                    <button
                      key={t.partner.id}
                      onClick={() => { dm.openThread(t.partner.id); setView("chat"); }}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/40 transition-colors border-b border-border/20 text-left"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={t.partner.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.partner.name)}&background=1e2d4a&color=fff&size=40`}
                          alt={t.partner.name}
                          className="w-11 h-11 rounded-full object-cover"
                        />
                        {t.unread > 0 && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                            {t.unread}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm ${t.unread > 0 ? "font-semibold" : "font-medium"}`}>{t.partner.name}</p>
                          <p className="text-xs text-muted-foreground">{timeAgo(t.lastMessage.created_at)}</p>
                        </div>
                        <p className={`text-xs truncate mt-0.5 ${t.unread > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                          {t.lastMessage.from_user_id === user?.id ? "Você: " : ""}{t.lastMessage.content}
                        </p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground/50 shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}

            {/* ── Chat view ── */}
            {view === "chat" && (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {dm.messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                      <p className="text-sm">Comece a conversa!</p>
                    </div>
                  )}
                  {dm.messages.map((msg) => {
                    const isMine = msg.from_user_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"} gap-2`}>
                        {!isMine && (
                          <img
                            src={msg.from_user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.from_user?.name ?? "?")}&background=1e2d4a&color=fff&size=32`}
                            className="w-7 h-7 rounded-full object-cover self-end shrink-0"
                            alt=""
                          />
                        )}
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-secondary/80 rounded-bl-sm"
                        }`}>
                          <p className="leading-relaxed">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {timeAgo(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-border/40">
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-center gap-2 bg-secondary/40 rounded-2xl px-4 py-2.5 border border-border/30"
                  >
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Mensagem..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      className="text-primary disabled:opacity-30 transition-opacity"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
