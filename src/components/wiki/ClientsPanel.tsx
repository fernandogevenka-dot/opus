import { useState } from "react";
import { useWiki } from "@/hooks/useWiki";
import { Plus, Search, Building2, Phone, Mail, AlertTriangle, CheckCircle, Activity, TrendingUp, X, ChevronDown, ChevronUp } from "lucide-react";
import type { Client } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active:   { label: "Ativo",     color: "text-green-400 bg-green-500/15 border-green-500/30",  dot: "bg-green-400" },
  at_risk:  { label: "Em risco",  color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30", dot: "bg-yellow-400" },
  upsell:   { label: "Upsell",    color: "text-blue-400 bg-blue-500/15 border-blue-500/30",    dot: "bg-blue-400" },
  churned:  { label: "Cancelou",  color: "text-red-400 bg-red-500/15 border-red-500/30",      dot: "bg-red-400" },
  prospect: { label: "Prospect",  color: "text-purple-400 bg-purple-500/15 border-purple-500/30", dot: "bg-purple-400" },
};

type SortKey = "name" | "start_date" | "status" | "cidade" | "estado";
type SortDir = "asc" | "desc";

export function ClientsPanel() {
  const { clients, saveClient } = useWiki();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("start_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = clients
    .filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.cnpj ?? "").includes(search) ||
        (c.razao_social ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (c.cidade ?? "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      let va: string | number = "";
      let vb: string | number = "";
      if (sortKey === "name") { va = a.name; vb = b.name; }
      else if (sortKey === "start_date") { va = a.start_date ?? ""; vb = b.start_date ?? ""; }
      else if (sortKey === "status") { va = a.status; vb = b.status; }
      else if (sortKey === "cidade") { va = a.cidade ?? ""; vb = b.cidade ?? ""; }
      else if (sortKey === "estado") { va = a.estado ?? ""; vb = b.estado ?? ""; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function handleSaveClient() {
    if (!form.name?.trim()) return;
    setSaving(true);
    await saveClient(form);
    setSaving(false);
    setShowForm(false);
    setForm({});
  }

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (
      sortDir === "asc" ? <ChevronUp size={11} className="inline ml-0.5" /> : <ChevronDown size={11} className="inline ml-0.5" />
    ) : null;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex-1 flex items-center gap-2 glass rounded-xl px-3 py-2">
          <Search size={13} className="text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, CNPJ, cidade..."
            className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-muted-foreground/60"
          />
          {search && <button onClick={() => setSearch("")}><X size={12} className="text-muted-foreground" /></button>}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="glass rounded-xl px-3 py-2 text-xs focus:outline-none border-0 cursor-pointer"
        >
          <option value="all">Todos os status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>

        <button
          onClick={() => { setShowForm(true); setForm({}); setSelected(null); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors"
        >
          <Plus size={13} /> Novo cliente
        </button>
      </div>

      {/* Count */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
        <Building2 size={12} />
        <span>{filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</span>
        {statusFilter !== "all" && (
          <span className={`px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${STATUS_CONFIG[statusFilter]?.color}`}>
            {STATUS_CONFIG[statusFilter]?.label}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-2xl border border-border/40">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-card border-b border-border/40">
              <Th onClick={() => handleSort("name")} className="w-48">
                Cliente Oxicore <SortIcon k="name" />
              </Th>
              <Th onClick={() => handleSort("start_date")} className="w-28">
                Início <SortIcon k="start_date" />
              </Th>
              <Th onClick={() => handleSort("status")} className="w-28">
                Status <SortIcon k="status" />
              </Th>
              <Th className="w-36">CNPJ</Th>
              <Th className="w-48">Razão Social</Th>
              <Th className="w-32">Encerramento</Th>
              <Th className="w-32">Cargo</Th>
              <Th onClick={() => handleSort("cidade")} className="w-28">
                Cidade <SortIcon k="cidade" />
              </Th>
              <Th onClick={() => handleSort("estado")} className="w-20">
                Estado <SortIcon k="estado" />
              </Th>
              <Th className="w-36">Stakeholder</Th>
              <Th className="w-32">Telefone</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((client, i) => {
              const sc = STATUS_CONFIG[client.status] ?? STATUS_CONFIG.active;
              return (
                <tr
                  key={client.id}
                  onClick={() => { setSelected(client); setShowForm(false); }}
                  className={`border-b border-border/20 cursor-pointer transition-colors hover:bg-secondary/40 ${
                    selected?.id === client.id ? "bg-primary/10" : i % 2 === 0 ? "" : "bg-card/40"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500/30 to-purple-600/30 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                        {client.name[0].toUpperCase()}
                      </div>
                      <span className="font-medium truncate max-w-[130px]">{client.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(client.start_date)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${sc.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">{client.cnpj ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[180px]">
                    <span className="truncate block">{client.razao_social ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{formatDate(client.end_date)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{client.cargo ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{client.cidade ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground text-center">{client.estado ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{client.stakeholder ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{client.contact_phone ?? "—"}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-12 text-muted-foreground">
                  <Building2 size={24} className="mx-auto mb-2 opacity-30" />
                  <p>Nenhum cliente encontrado</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Detail / Form drawer */}
      <AnimatePresence>
        {(selected || showForm) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex-shrink-0 glass-strong rounded-2xl p-5 max-h-72 overflow-y-auto"
          >
            {showForm ? (
              <ClientForm
                form={form}
                setForm={setForm}
                saving={saving}
                onSave={handleSaveClient}
                onCancel={() => { setShowForm(false); setForm({}); }}
              />
            ) : selected ? (
              <ClientDetail
                client={selected}
                onEdit={() => { setForm(selected); setShowForm(true); }}
                onClose={() => setSelected(null)}
              />
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Th({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <th
      className={`px-3 py-2.5 text-left font-semibold text-muted-foreground/80 select-none whitespace-nowrap ${onClick ? "cursor-pointer hover:text-foreground" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </th>
  );
}

function formatDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return d;
  }
}

function ClientDetail({ client, onEdit, onClose }: { client: Client; onEdit: () => void; onClose: () => void }) {
  const sc = STATUS_CONFIG[client.status] ?? STATUS_CONFIG.active;
  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500/30 to-purple-600/30 flex items-center justify-center text-lg font-bold">
            {client.name[0].toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold">{client.name}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium ${sc.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>
            </div>
            {client.razao_social && <p className="text-xs text-muted-foreground">{client.razao_social}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="px-3 py-1.5 rounded-xl glass text-xs hover:bg-secondary/80 transition-colors">Editar</button>
          <button onClick={onClose} className="p-1.5 rounded-xl glass hover:bg-secondary/80 transition-colors text-muted-foreground"><X size={13} /></button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        {[
          ["Início", formatDate(client.start_date)],
          ["Encerramento", formatDate(client.end_date)],
          ["CNPJ", client.cnpj],
          ["Cargo", client.cargo],
          ["Cidade", client.cidade],
          ["Estado", client.estado],
          ["Stakeholder", client.stakeholder],
          ["Telefone", client.contact_phone],
          ["E-mail", client.contact_email],
          ["NPS", client.nps?.toString()],
        ].filter(([, v]) => v).map(([label, value]) => (
          <div key={label} className="bg-background/40 rounded-xl p-2">
            <p className="text-muted-foreground/70 mb-0.5">{label}</p>
            <p className="font-medium truncate">{value}</p>
          </div>
        ))}
      </div>
      {client.notes && (
        <div className="mt-2 bg-background/40 rounded-xl p-2 text-xs text-muted-foreground">{client.notes}</div>
      )}
    </div>
  );
}

function ClientForm({
  form, setForm, saving, onSave, onCancel
}: {
  form: Partial<Client>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Client>>>;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const f = (key: keyof Client) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">{form.id ? "Editar cliente" : "Novo cliente"}</h3>
        <button onClick={onCancel}><X size={14} className="text-muted-foreground" /></button>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        {([
          ["name", "Nome da empresa *", "text"],
          ["razao_social", "Razão Social", "text"],
          ["cnpj", "CNPJ", "text"],
          ["start_date", "Início na Oxicore", "date"],
          ["end_date", "Encerramento", "date"],
          ["cargo", "Cargo", "text"],
          ["cidade", "Cidade", "text"],
          ["estado", "Estado", "text"],
          ["stakeholder", "Stakeholder", "text"],
          ["contact_phone", "Telefone", "text"],
          ["contact_email", "E-mail", "email"],
          ["contact_name", "Nome do contato", "text"],
        ] as [keyof Client, string, string][]).map(([key, label, type]) => (
          <div key={key} className={key === "name" || key === "razao_social" ? "col-span-2" : ""}>
            <label className="text-muted-foreground mb-1 block">{label}</label>
            <input
              type={type}
              value={(form as Record<string, string | number | null | undefined>)[key as string] as string ?? ""}
              onChange={f(key)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        ))}
        <div>
          <label className="text-muted-foreground mb-1 block">Status</label>
          <select
            value={form.status ?? "active"}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Client["status"] }))}
            className="w-full bg-secondary/50 border border-border rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="col-span-3">
          <label className="text-muted-foreground mb-1 block">Notas</label>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
            className="w-full bg-secondary/50 border border-border rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-secondary/80 transition-colors">Cancelar</button>
        <button
          onClick={onSave}
          disabled={!form.name?.trim() || saving}
          className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold transition-colors"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
