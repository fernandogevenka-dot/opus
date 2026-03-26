import { useState } from "react";
import { Search, Plus, Filter, ChevronDown } from "lucide-react";
import type { Client } from "@/types";
import type { CSFilters } from "@/hooks/useCustomerSuccess";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_LABEL: Record<string, string> = {
  all: "Todos", active: "Ativo", at_risk: "Em risco",
  upsell: "Upsell", churned: "Cancelou", prospect: "Prospect",
};
const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  at_risk: "bg-yellow-500/20 text-yellow-400",
  upsell: "bg-blue-500/20 text-blue-400",
  churned: "bg-red-500/20 text-red-400",
  prospect: "bg-purple-500/20 text-purple-400",
};

interface ClientListProps {
  clients: Client[];
  loading: boolean;
  filters: CSFilters;
  regions: string[];
  segments: string[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onFilterChange: (f: CSFilters) => void;
  onSave: (data: Partial<Client>) => Promise<unknown>;
}

export function ClientList({ clients, loading, filters, regions, segments, selectedId, onSelect, onFilterChange, onSave }: ClientListProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    await onSave({ name: newName.trim(), status: "active" });
    setNewName("");
    setShowNewForm(false);
  }

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="w-72 flex-shrink-0 flex flex-col gap-2">
      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 glass rounded-xl px-3 py-2">
          <Search size={13} className="text-muted-foreground flex-shrink-0" />
          <input
            value={filters.search ?? ""}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            placeholder="Buscar cliente..."
            className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${showFilters ? "bg-primary/20 text-primary" : "glass text-muted-foreground hover:text-foreground"}`}
        >
          <Filter size={14} />
        </button>
        <button
          onClick={() => setShowNewForm(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl p-3 space-y-2 overflow-hidden"
          >
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <div className="flex flex-wrap gap-1">
                {(["all", "active", "at_risk", "upsell", "churned", "prospect"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => onFilterChange({ ...filters, status: s })}
                    className={`text-xs px-2 py-0.5 rounded-full transition-colors ${filters.status === s ? "bg-primary/30 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {regions.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Região</label>
                <select
                  value={filters.region ?? ""}
                  onChange={(e) => onFilterChange({ ...filters, region: e.target.value || undefined })}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="">Todas</option>
                  {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}

            {segments.length > 0 && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Área de Atuação</label>
                <select
                  value={filters.segment ?? ""}
                  onChange={(e) => onFilterChange({ ...filters, segment: e.target.value || undefined })}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1 text-xs focus:outline-none"
                >
                  <option value="">Todas</option>
                  {segments.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New client quick form */}
      <AnimatePresence>
        {showNewForm && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="glass rounded-xl p-3 flex gap-2"
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nome do cliente"
              autoFocus
              className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/60"
            />
            <button onClick={handleCreate} className="text-xs text-primary hover:text-primary/80 font-medium">
              Criar
            </button>
            <button onClick={() => setShowNewForm(false)} className="text-xs text-muted-foreground">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Client items */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-secondary/30 animate-pulse" />
          ))
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-xs">Nenhum cliente encontrado</p>
          </div>
        ) : (
          clients.map((client) => (
            <button
              key={client.id}
              onClick={() => onSelect(client.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors ${
                selectedId === client.id ? "bg-primary/20 border border-primary/30" : "hover:bg-secondary/60"
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500/30 to-purple-600/30 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {client.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{client.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLOR[client.status]}`}>
                    {STATUS_LABEL[client.status]}
                  </span>
                  {client.mrr > 0 && (
                    <span className="text-xs text-muted-foreground">{fmt(client.mrr)}/mês</span>
                  )}
                </div>
              </div>
              {client.nps !== null && (
                <span className={`text-xs font-bold ${client.nps >= 9 ? "text-green-400" : client.nps >= 7 ? "text-yellow-400" : "text-red-400"}`}>
                  {client.nps}
                </span>
              )}
            </button>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">{clients.length} cliente{clients.length !== 1 ? "s" : ""}</p>
    </div>
  );
}
