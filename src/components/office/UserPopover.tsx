import { useOfficeStore } from "@/store/officeStore";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import { getStatusColor, getStatusLabel, getLevelName } from "@/lib/utils";
import { MessageSquare, Video, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function UserPopover() {
  const { presences, selectedUserId, setSelectedUser } = useOfficeStore();
  const { user: me } = useAuthStore();

  async function knockOnUser(targetUserId: string) {
    if (!me) return;
    await supabase.from("knock_notifications").insert({
      from_user_id: me.id,
      target_user_id: targetUserId,
      message: `${me.name} quer falar com você`,
    });
  }

  const selectedPresence = presences.find((p) => p.user_id === selectedUserId);
  const selectedUser = selectedPresence?.user;

  function openGoogleChat() {
    if (!selectedUser) return;
    window.open(`https://mail.google.com/chat/u/0/#chat/dm/${selectedUser.email}`, "_blank");
  }

  function startMeet() {
    if (!selectedUser) return;
    const meetId = Math.random().toString(36).substring(2, 12);
    window.open(`https://meet.google.com/${meetId}`, "_blank");
  }

  async function handleKnock() {
    if (!selectedUserId) return;
    await knockOnUser(selectedUserId);
    setSelectedUser(null);
  }

  return (
    <AnimatePresence>
      {selectedUserId && selectedUser && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-4 right-4 z-50 glass-strong rounded-2xl p-4 w-72 shadow-2xl"
        >
          <button
            onClick={() => setSelectedUser(null)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>

          {/* User info */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative">
              <img
                src={selectedUser.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.name)}&background=1e2d4a&color=fff`}
                alt={selectedUser.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-background"
                style={{ backgroundColor: getStatusColor(selectedPresence?.status ?? "offline") }}
              />
            </div>
            <div>
              <p className="font-semibold text-sm">{selectedUser.name}</p>
              <p className="text-xs text-muted-foreground">{selectedUser.team}</p>
              <p className="text-xs mt-0.5" style={{ color: getStatusColor(selectedPresence?.status ?? "offline") }}>
                {getStatusLabel(selectedPresence?.status ?? "offline")}
              </p>
            </div>
          </div>

          {/* Title + Level */}
          <div className="flex items-center gap-2 mb-3">
            {selectedUser.title_active && (
              <span className="title-badge text-xs">
                {selectedUser.title_active.icon} {selectedUser.title_active.name}
              </span>
            )}
            <span className="xp-badge text-xs">
              <Zap size={10} />
              {getLevelName(selectedUser.level)}
            </span>
          </div>

          {/* Actions */}
          {selectedUserId !== me?.id && (
            <div className="flex gap-2">
              <button
                onClick={openGoogleChat}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-medium transition-colors"
              >
                <MessageSquare size={14} />
                Chat
              </button>
              <button
                onClick={startMeet}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium transition-colors"
              >
                <Video size={14} />
                Meet
              </button>
              <button
                onClick={handleKnock}
                className="flex items-center justify-center py-2 px-3 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs font-medium transition-colors"
                title="Bater na porta"
              >
                👋
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
