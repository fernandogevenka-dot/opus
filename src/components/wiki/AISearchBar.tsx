import { useState } from "react";
import { Search, Sparkles, ExternalLink } from "lucide-react";
import { AI_NAME } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import type { WikiPage } from "@/types";

interface AISearchBarProps {
  onSearch: (query: string) => Promise<void>;
  answer: string;
  searching: boolean;
  sources: WikiPage[];
}

export function AISearchBar({ onSearch, answer, searching, sources }: AISearchBarProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setOpen(true);
    await onSearch(query);
  }

  return (
    <div className="space-y-2">
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 glass rounded-xl px-3 py-2">
          <Sparkles size={14} className="text-primary flex-shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Pergunte ao ${AI_NAME} sobre a base de conhecimento...`}
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <button
          type="submit"
          disabled={!query.trim() || searching}
          className="px-4 py-2 bg-primary/20 hover:bg-primary/30 disabled:opacity-40 text-primary rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          <Search size={14} />
          {searching ? "Buscando..." : "Buscar"}
        </button>
      </form>

      <AnimatePresence>
        {open && answer && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="glass rounded-xl p-4 border-primary/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-primary" />
              <span className="text-xs font-semibold text-primary">{AI_NAME} encontrou:</span>
            </div>
            <p className="text-sm leading-relaxed">{answer}</p>

            {sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-2">Fontes:</p>
                <div className="flex flex-wrap gap-2">
                  {sources.map((s) => (
                    <span
                      key={s.id}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-secondary/60 text-muted-foreground"
                    >
                      {s.icon} {s.title}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
