import { useState } from "react";
import { updateMyStatus } from "@/lib/presence";
import { getStatusColor, getStatusLabel } from "@/lib/utils";
import type { UserStatus } from "@/types";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUSES: UserStatus[] = ["available", "busy", "in_meeting", "away"];

export function StatusSelector() {
  const [open, setOpen] = useState(false);
  const currentStatus: UserStatus = "available";

  async function handleSelect(status: UserStatus) {
    await updateMyStatus(status);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass hover:bg-secondary/80 transition-colors text-sm"
      >
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: getStatusColor(currentStatus) }}
        />
        <span className="text-xs font-medium">{getStatusLabel(currentStatus)}</span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.1 }}
            className="absolute top-full mt-1 left-0 glass-strong rounded-xl overflow-hidden z-50 min-w-40 shadow-xl"
          >
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => handleSelect(s)}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-secondary/80 transition-colors text-left"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getStatusColor(s) }}
                />
                {getStatusLabel(s)}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
