import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Video, X } from "lucide-react";

interface KnockProps {
  notification: { fromUserId: string; fromName: string; fromAvatar: string } | null;
  onDismiss: () => void;
}

export function KnockNotificationBanner({ notification, onDismiss }: KnockProps) {
  // Auto-dismiss after 8s
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [notification]);

  function openChat() {
    // Opens Google Chat DM — user object needed for email
    onDismiss();
  }

  function openMeet() {
    window.open(`https://meet.google.com/opus-quick-${notification?.fromUserId.slice(0, 6)}`, "_blank");
    onDismiss();
  }

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: 80, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 80, x: "-50%" }}
          transition={{ type: "spring", damping: 20 }}
          className="fixed bottom-6 left-1/2 z-50 glass-strong rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-4 border border-yellow-500/30"
          style={{ minWidth: 340 }}
        >
          {/* Knock wave animation */}
          <div className="relative flex-shrink-0">
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="absolute inset-0 rounded-full bg-yellow-500/20"
            />
            <img
              src={notification.fromAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.fromName)}&background=1e2d4a&color=fff`}
              className="w-10 h-10 rounded-full object-cover relative z-10"
              alt={notification.fromName}
            />
          </div>

          <div className="flex-1">
            <p className="font-semibold text-sm">
              👋 {notification.fromName} quer falar com você
            </p>
            <p className="text-xs text-muted-foreground">Toque para responder</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={openChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-500/20 hover:bg-brand-500/30 text-brand-400 text-xs font-medium transition-colors"
            >
              <MessageSquare size={13} />
              Chat
            </button>
            <button
              onClick={openMeet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs font-medium transition-colors"
            >
              <Video size={13} />
              Meet
            </button>
          </div>

          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
