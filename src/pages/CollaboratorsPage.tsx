import { useState, useMemo, useCallback } from "react";
import {
  useCollaborators,
  AREAS,
  FUNCOES,
  SENIORIDADES,
  FORMATOS,
  type Collaborator,
  type CollaboratorFormData,
} from "@/hooks/useCollaborators";
import { useSquadsData } from "@/hooks/useSquadsData";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Edit2,
  UserX,
  UserCheck,
  Mail,
  Phone,
  X,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Users,
  DollarSign,
  Calendar,
  ExternalLink,
  Building2,
  Briefcase,
  Star,
  Clock,
  CreditCard,
  Percent,
  Hash,
  User,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number | undefined | null): string {
  if (!n && n !== 0) return "—";
  if (n === 0) return "R$ 0,00";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrencyCompact(n: number | undefined | null): string {
  if (!n || n === 0) return "—";
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return formatCurrency(n);
}

function formatDate(d: string | undefined | null): string {
  if (!d) return "—";
  try {
    const date = new Date(d + "T12:00:00");
    return date.toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// ─── Area color config ────────────────────────────────────────────────────────

interface AreaConfig {
  bg: string;
  text: string;
  border: string;
  avatar: string;
  dot: string;
}

const AREA_COLORS: Record<string, AreaConfig> = {
  "PE&G": {
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    border: "border-violet-500/20",
    avatar: "bg-violet-500/20 text-violet-300",
    dot: "bg-violet-400",
  },
  CS: {
    bg: "bg-green-500/10",
    text: "text-green-400",
    border: "border-green-500/20",
    avatar: "bg-green-500/20 text-green-300",
    dot: "bg-green-400",
  },
  Financeiro: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/20",
    avatar: "bg-yellow-500/20 text-yellow-300",
    dot: "bg-yellow-400",
  },
  Administrativo: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/20",
    avatar: "bg-purple-500/20 text-purple-300",
    dot: "bg-purple-400",
  },
  Tech: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/20",
    avatar: "bg-cyan-500/20 text-cyan-300",
    dot: "bg-cyan-400",
  },
  Comercial: {
    bg: "bg-orange-500/10",
    text: "text-orange-400",
    border: "border-orange-500/20",
    avatar: "bg-orange-500/20 text-orange-300",
    dot: "bg-orange-400",
  },
  RH: {
    bg: "bg-pink-500/10",
    text: "text-pink-400",
    border: "border-pink-500/20",
    avatar: "bg-pink-500/20 text-pink-300",
    dot: "bg-pink-400",
  },
};

function getAreaConfig(area: string | undefined | null): AreaConfig {
  if (!area) {
    return {
      bg: "bg-muted/40",
      text: "text-muted-foreground",
      border: "border-border/50",
      avatar: "bg-secondary text-foreground/60",
      dot: "bg-muted-foreground",
    };
  }
  return (
    AREA_COLORS[area] ?? {
      bg: "bg-muted/40",
      text: "text-muted-foreground",
      border: "border-border/50",
      avatar: "bg-secondary text-foreground/60",
      dot: "bg-muted-foreground",
    }
  );
}

// ─── Seniority badge ──────────────────────────────────────────────────────────

function getSeniorityConfig(s: string | undefined | null): { bg: string; text: string; border: string } {
  if (!s) return { bg: "bg-muted/30", text: "text-muted-foreground", border: "border-border/40" };
  if (s === "Estagiário") return { bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/20" };
  if (s === "Junior") return { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20" };
  if (s === "Pleno") return { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" };
  if (s === "Senior") return { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" };
  if (s === "Especialista") return { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" };
  if (s === "Liderança") return { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" };
  return { bg: "bg-muted/30", text: "text-muted-foreground", border: "border-border/40" };
}

// ─── Shared input class ───────────────────────────────────────────────────────

const INPUT_CLS =
  "w-full bg-secondary/40 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40 transition-colors text-foreground";
const SELECT_CLS =
  "w-full bg-secondary/40 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors text-foreground";

// ─── Field row helper ─────────────────────────────────────────────────────────

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-foreground/90">{value ?? "—"}</span>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-1.5 border-b border-border/40">
      {children}
    </h4>
  );
}

// ─── Sort types ───────────────────────────────────────────────────────────────

type SortKey = "name" | "remuneration" | "start_date";
type SortDir = "asc" | "desc";

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="glass rounded-xl p-4 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color ?? "bg-primary/10"}`}>
        <Icon size={16} className={color ? "text-current" : "text-primary"} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Collaborator card ────────────────────────────────────────────────────────

function CollaboratorCard({
  c,
  onClick,
  onEdit,
  onToggleStatus,
}: {
  c: Collaborator;
  onClick: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const area = getAreaConfig(c.area);
  const seniority = getSeniorityConfig(c.seniority);
  const isActive = c.status === "active" && !c.end_date;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass rounded-xl p-4 cursor-pointer group relative hover:border-border/80 transition-all"
      onClick={onClick}
    >
      {/* Action buttons on hover */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="w-7 h-7 rounded-lg bg-secondary/80 hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-colors"
          title="Editar"
        >
          <Edit2 size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleStatus();
          }}
          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
            isActive
              ? "bg-secondary/80 hover:bg-destructive/20 hover:text-destructive"
              : "bg-secondary/80 hover:bg-green-500/20 hover:text-green-400"
          }`}
          title={isActive ? "Desativar" : "Reativar"}
        >
          {isActive ? <UserX size={13} /> : <UserCheck size={13} />}
        </button>
      </div>

      {/* Status indicator */}
      <div
        className={`absolute top-3 left-3 w-2 h-2 rounded-full ${isActive ? "bg-green-400" : "bg-muted-foreground/40"}`}
      />

      {/* Avatar + name */}
      <div className="flex flex-col items-center text-center mb-3 pt-1">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold mb-2 ${area.avatar}`}
        >
          {getInitials(c.name)}
        </div>
        <p className="text-sm font-semibold text-foreground leading-tight line-clamp-1">{c.name}</p>
        {c.role && (
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{c.role}</p>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
        {c.area && (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${area.bg} ${area.text} ${area.border}`}
          >
            {c.area}
          </span>
        )}
        {c.seniority && (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${seniority.bg} ${seniority.text} ${seniority.border}`}
          >
            {c.seniority}
          </span>
        )}
        {c.squad_name && (
          <span className="inline-flex items-center rounded-full border border-border/40 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-foreground/60">
            {c.squad_name}
          </span>
        )}
      </div>

      {/* Remuneration */}
      {c.remuneration != null && (
        <div className="text-center mb-2">
          <span className="text-sm font-semibold text-foreground/80">
            {formatCurrencyCompact(c.remuneration)}
          </span>
        </div>
      )}

      {/* Footer: dates + contacts */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30">
        <span className="text-[10px] text-muted-foreground">
          {c.start_date ? formatDate(c.start_date) : "—"}
        </span>
        <div className="flex items-center gap-1">
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded-md bg-secondary/60 hover:bg-violet-500/20 hover:text-violet-400 flex items-center justify-center transition-colors"
              title={c.email}
            >
              <Mail size={11} />
            </a>
          )}
          {c.whatsapp && (
            <a
              href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-6 h-6 rounded-md bg-secondary/60 hover:bg-green-500/20 hover:text-green-400 flex items-center justify-center transition-colors"
              title={c.whatsapp}
            >
              <Phone size={11} />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Table view ───────────────────────────────────────────────────────────────

function SortIcon({ field, sortKey, sortDir }: { field: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== field) return <ChevronsUpDown size={12} className="text-muted-foreground/40" />;
  return sortDir === "asc" ? (
    <ChevronUp size={12} className="text-primary" />
  ) : (
    <ChevronDown size={12} className="text-primary" />
  );
}

function CollaboratorsTable({
  collaborators,
  onRowClick,
  onEdit,
  onToggleStatus,
  sortKey,
  sortDir,
  onSort,
}: {
  collaborators: Collaborator[];
  onRowClick: (c: Collaborator) => void;
  onEdit: (c: Collaborator) => void;
  onToggleStatus: (c: Collaborator) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const sortableCols: { key: SortKey; label: string }[] = [
    { key: "name", label: "Nome" },
  ];

  const thCls =
    "px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground select-none whitespace-nowrap";
  const sortableTh = (key: SortKey, label: string) => (
    <th
      className={`${thCls} cursor-pointer hover:text-foreground transition-colors`}
      onClick={() => onSort(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon field={key} sortKey={sortKey} sortDir={sortDir} />
      </div>
    </th>
  );

  return (
    <div className="overflow-auto rounded-xl glass">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50">
            {sortableTh("name", "Nome")}
            <th className={thCls}>Função</th>
            <th className={thCls}>Área</th>
            <th className={thCls}>Squad</th>
            <th className={thCls}>Senioridade</th>
            <th className={thCls}>Formato</th>
            <th
              className={`${thCls} cursor-pointer hover:text-foreground transition-colors`}
              onClick={() => onSort("remuneration")}
            >
              <div className="flex items-center gap-1">
                Remuneração
                <SortIcon field="remuneration" sortKey={sortKey} sortDir={sortDir} />
              </div>
            </th>
            <th
              className={`${thCls} cursor-pointer hover:text-foreground transition-colors`}
              onClick={() => onSort("start_date")}
            >
              <div className="flex items-center gap-1">
                Início
                <SortIcon field="start_date" sortKey={sortKey} sortDir={sortDir} />
              </div>
            </th>
            <th className={thCls}>Status</th>
            <th className={thCls}>Ações</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {collaborators.map((c) => {
              const area = getAreaConfig(c.area);
              const seniority = getSeniorityConfig(c.seniority);
              const isActive = c.status === "active" && !c.end_date;

              return (
                <motion.tr
                  key={c.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="border-b border-border/30 hover:bg-secondary/30 cursor-pointer transition-colors"
                  onClick={() => onRowClick(c)}
                >
                  {/* Nome */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${area.avatar}`}
                      >
                        {getInitials(c.name)}
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm leading-tight">{c.name}</p>
                        {c.email && (
                          <p className="text-[10px] text-muted-foreground">{c.email}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Função */}
                  <td className="px-3 py-2.5 text-xs text-foreground/80">{c.role ?? "—"}</td>

                  {/* Área */}
                  <td className="px-3 py-2.5">
                    {c.area ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${area.bg} ${area.text} ${area.border}`}
                      >
                        {c.area}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>

                  {/* Squad */}
                  <td className="px-3 py-2.5 text-xs text-foreground/70">{c.squad_name ?? "—"}</td>

                  {/* Senioridade */}
                  <td className="px-3 py-2.5">
                    {c.seniority ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${seniority.bg} ${seniority.text} ${seniority.border}`}
                      >
                        {c.seniority}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>

                  {/* Formato */}
                  <td className="px-3 py-2.5 text-xs text-foreground/70">{c.format ?? "—"}</td>

                  {/* Remuneração */}
                  <td className="px-3 py-2.5 text-xs font-medium text-foreground/80">
                    {formatCurrencyCompact(c.remuneration)}
                  </td>

                  {/* Início */}
                  <td className="px-3 py-2.5 text-xs text-foreground/70">
                    {formatDate(c.start_date)}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                        isActive
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-muted/40 text-muted-foreground border-border/40"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-400" : "bg-muted-foreground/50"}`}
                      />
                      {isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>

                  {/* Ações */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(c);
                        }}
                        className="w-7 h-7 rounded-lg bg-secondary/60 hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStatus(c);
                        }}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          isActive
                            ? "bg-secondary/60 hover:bg-destructive/20 hover:text-destructive"
                            : "bg-secondary/60 hover:bg-green-500/20 hover:text-green-400"
                        }`}
                        title={isActive ? "Desativar" : "Reativar"}
                      >
                        {isActive ? <UserX size={12} /> : <UserCheck size={12} />}
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </AnimatePresence>
        </tbody>
      </table>

      {collaborators.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">
          Nenhum colaborador encontrado.
        </div>
      )}
    </div>
  );
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

const EMPTY_FORM: CollaboratorFormData = {
  name: "",
  full_name: "",
  role: "",
  area: "",
  seniority: "",
  format: "",
  email: "",
  whatsapp: "",
  cnpj: "",
  pix: "",
  remuneration: undefined,
  commission_pct: undefined,
  start_date: "",
  end_date: "",
  birth_date: "",
  squad_id: "",
  squad_name: "",
  payment_day: undefined,
  status: "active",
};

function CollaboratorModal({
  collaborator,
  squads,
  onClose,
  onSave,
}: {
  collaborator: Collaborator | null; // null = new
  squads: { id: string; name: string }[];
  onClose: () => void;
  onSave: (data: CollaboratorFormData, id?: string) => Promise<void>;
}) {
  const isNew = collaborator === null;

  const [form, setForm] = useState<CollaboratorFormData>(() => {
    if (isNew) return { ...EMPTY_FORM };
    return {
      name: collaborator?.name ?? "",
      full_name: collaborator?.full_name ?? "",
      role: collaborator?.role ?? "",
      area: collaborator?.area ?? "",
      seniority: collaborator?.seniority ?? "",
      format: collaborator?.format ?? "",
      email: collaborator?.email ?? "",
      whatsapp: collaborator?.whatsapp ?? "",
      cnpj: collaborator?.cnpj ?? "",
      pix: collaborator?.pix ?? "",
      remuneration: collaborator?.remuneration,
      commission_pct: collaborator?.commission_pct,
      start_date: collaborator?.start_date ?? "",
      end_date: collaborator?.end_date ?? "",
      birth_date: collaborator?.birth_date ?? "",
      squad_id: collaborator?.squad_id ?? "",
      squad_name: collaborator?.squad_name ?? "",
      payment_day: collaborator?.payment_day,
      status: collaborator?.status ?? "active",
    };
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CollaboratorFormData>(key: K, value: CollaboratorFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form };
      // Sync squad_name from selected squad id
      if (payload.squad_id) {
        const found = squads.find((s) => s.id === payload.squad_id);
        if (found) payload.squad_name = found.name;
      } else {
        payload.squad_name = "";
      }
      await onSave(payload, collaborator?.id);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const isInactive = form.status === "inactive";

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        className="relative z-10 glass-strong rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {isNew ? "Novo Colaborador" : `Editar — ${collaborator?.name}`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isNew ? "Preencha os dados do novo membro do time" : "Atualize as informações do colaborador"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-secondary/60 flex items-center justify-center text-muted-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Identificação */}
            <div>
              <SectionLabel>Identificação</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-muted-foreground mb-1">
                    Nome (apelido) <span className="text-destructive">*</span>
                  </label>
                  <input
                    className={INPUT_CLS}
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs text-muted-foreground mb-1">Nome Completo</label>
                  <input
                    className={INPUT_CLS}
                    value={form.full_name ?? ""}
                    onChange={(e) => set("full_name", e.target.value)}
                    placeholder="Nome completo legal"
                  />
                </div>
              </div>
            </div>

            {/* Cargo e área */}
            <div>
              <SectionLabel>Cargo & Área</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Função</label>
                  <select
                    className={SELECT_CLS}
                    value={form.role ?? ""}
                    onChange={(e) => set("role", e.target.value)}
                  >
                    <option value="">Selecionar…</option>
                    {FUNCOES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Área</label>
                  <select
                    className={SELECT_CLS}
                    value={form.area ?? ""}
                    onChange={(e) => set("area", e.target.value)}
                  >
                    <option value="">Selecionar…</option>
                    {AREAS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Senioridade</label>
                  <select
                    className={SELECT_CLS}
                    value={form.seniority ?? ""}
                    onChange={(e) => set("seniority", e.target.value)}
                  >
                    <option value="">Selecionar…</option>
                    {SENIORIDADES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Formato</label>
                  <select
                    className={SELECT_CLS}
                    value={form.format ?? ""}
                    onChange={(e) => set("format", e.target.value)}
                  >
                    <option value="">Selecionar…</option>
                    {FORMATOS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-muted-foreground mb-1">Squad</label>
                  <select
                    className={SELECT_CLS}
                    value={form.squad_id ?? ""}
                    onChange={(e) => set("squad_id", e.target.value)}
                  >
                    <option value="">Sem squad</option>
                    {squads.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Contato */}
            <div>
              <SectionLabel>Contato</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">E-mail</label>
                  <input
                    className={INPUT_CLS}
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => set("email", e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">WhatsApp</label>
                  <input
                    className={INPUT_CLS}
                    value={form.whatsapp ?? ""}
                    onChange={(e) => set("whatsapp", e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>
            </div>

            {/* Financeiro */}
            <div>
              <SectionLabel>Financeiro</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Remuneração (R$)</label>
                  <input
                    className={INPUT_CLS}
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.remuneration ?? ""}
                    onChange={(e) =>
                      set("remuneration", e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Comissão (%)</label>
                  <input
                    className={INPUT_CLS}
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={form.commission_pct ?? ""}
                    onChange={(e) =>
                      set("commission_pct", e.target.value ? parseFloat(e.target.value) : undefined)
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">CNPJ</label>
                  <input
                    className={INPUT_CLS}
                    value={form.cnpj ?? ""}
                    onChange={(e) => set("cnpj", e.target.value)}
                    placeholder="XX.XXX.XXX/XXXX-XX"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">PIX</label>
                  <input
                    className={INPUT_CLS}
                    value={form.pix ?? ""}
                    onChange={(e) => set("pix", e.target.value)}
                    placeholder="Chave PIX"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Dia de Pagamento</label>
                  <input
                    className={INPUT_CLS}
                    type="number"
                    min={1}
                    max={31}
                    value={form.payment_day ?? ""}
                    onChange={(e) =>
                      set("payment_day", e.target.value ? parseInt(e.target.value) : undefined)
                    }
                    placeholder="1–31"
                  />
                </div>
              </div>
            </div>

            {/* Datas */}
            <div>
              <SectionLabel>Datas</SectionLabel>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data de Início</label>
                  <input
                    className={INPUT_CLS}
                    type="date"
                    value={form.start_date ?? ""}
                    onChange={(e) => set("start_date", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Data de Nascimento</label>
                  <input
                    className={INPUT_CLS}
                    type="date"
                    value={form.birth_date ?? ""}
                    onChange={(e) => set("birth_date", e.target.value)}
                  />
                </div>
                {(isInactive || form.end_date) && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Data de Saída</label>
                    <input
                      className={INPUT_CLS}
                      type="date"
                      value={form.end_date ?? ""}
                      onChange={(e) => set("end_date", e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            {!isNew && (
              <div>
                <SectionLabel>Status</SectionLabel>
                <div className="flex items-center gap-3">
                  {["active", "inactive"].map((s) => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={form.status === s}
                        onChange={() => set("status", s)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-foreground/80">
                        {s === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border/50 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/60 transition-colors text-foreground/70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Salvando…" : isNew ? "Criar Colaborador" : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  collaborator,
  onClose,
  onEdit,
  onToggleStatus,
}: {
  collaborator: Collaborator;
  onClose: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  const area = getAreaConfig(collaborator.area);
  const seniority = getSeniorityConfig(collaborator.seniority);
  const isActive = collaborator.status === "active" && !collaborator.end_date;

  return (
    <motion.div
      className="fixed inset-0 z-40 flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Side panel */}
      <motion.div
        className="w-full max-w-sm h-full glass-strong border-l border-border/60 flex flex-col overflow-hidden shadow-2xl"
        initial={{ x: 80, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 32 }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 flex-shrink-0">
          <span className="text-sm font-semibold text-foreground">Perfil</span>
          <div className="flex items-center gap-1">
            <button
              onClick={onEdit}
              className="w-7 h-7 rounded-lg hover:bg-secondary/60 flex items-center justify-center text-muted-foreground transition-colors"
              title="Editar"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg hover:bg-secondary/60 flex items-center justify-center text-muted-foreground transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Avatar section */}
          <div className="p-5 flex flex-col items-center text-center border-b border-border/30">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mb-3 ${area.avatar}`}
            >
              {getInitials(collaborator.name)}
            </div>

            <div className="flex items-center gap-1.5 mb-1">
              <div
                className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400" : "bg-muted-foreground/40"}`}
              />
              <h2 className="text-lg font-bold text-foreground">{collaborator.name}</h2>
            </div>

            {collaborator.full_name && collaborator.full_name !== collaborator.name && (
              <p className="text-xs text-muted-foreground mb-1">{collaborator.full_name}</p>
            )}

            {collaborator.role && (
              <p className="text-sm text-muted-foreground mb-3">{collaborator.role}</p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {collaborator.area && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${area.bg} ${area.text} ${area.border}`}
                >
                  {collaborator.area}
                </span>
              )}
              {collaborator.seniority && (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${seniority.bg} ${seniority.text} ${seniority.border}`}
                >
                  {collaborator.seniority}
                </span>
              )}
              {collaborator.format && (
                <span className="inline-flex items-center rounded-full border border-border/40 bg-secondary/50 px-2.5 py-0.5 text-xs font-medium text-foreground/60">
                  {collaborator.format}
                </span>
              )}
            </div>

            <span
              className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                isActive
                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : "bg-muted/40 text-muted-foreground border-border/40"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-green-400" : "bg-muted-foreground/40"}`} />
              {isActive ? "Ativo" : "Inativo"}
            </span>
          </div>

          <div className="p-5 space-y-5">
            {/* Contact */}
            <div>
              <SectionLabel>Contato</SectionLabel>
              <div className="space-y-2">
                {collaborator.email ? (
                  <a
                    href={`mailto:${collaborator.email}`}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-secondary/40 transition-colors group"
                  >
                    <Mail size={14} className="text-muted-foreground group-hover:text-violet-400 transition-colors" />
                    <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                      {collaborator.email}
                    </span>
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground px-2.5">Sem e-mail cadastrado</p>
                )}
                {collaborator.whatsapp && (
                  <a
                    href={`https://wa.me/${collaborator.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-secondary/40 transition-colors group"
                  >
                    <Phone size={14} className="text-muted-foreground group-hover:text-green-400 transition-colors" />
                    <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                      {collaborator.whatsapp}
                    </span>
                  </a>
                )}
              </div>
            </div>

            {/* Squad */}
            {collaborator.squad_name && (
              <div>
                <SectionLabel>Squad</SectionLabel>
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-secondary/30 border border-border/30">
                  <Users size={13} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground/80">{collaborator.squad_name}</span>
                </div>
              </div>
            )}

            {/* Financial */}
            <div>
              <SectionLabel>Financeiro</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-secondary/30 border border-border/30 px-3 py-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Remuneração</p>
                  <p className="text-sm font-semibold text-foreground">
                    {formatCurrency(collaborator.remuneration)}
                  </p>
                </div>
                {collaborator.commission_pct != null && (
                  <div className="rounded-lg bg-secondary/30 border border-border/30 px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Comissão</p>
                    <p className="text-sm font-semibold text-foreground">{collaborator.commission_pct}%</p>
                  </div>
                )}
                {collaborator.payment_day != null && (
                  <div className="rounded-lg bg-secondary/30 border border-border/30 px-3 py-2.5">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Dia Pagamento</p>
                    <p className="text-sm font-semibold text-foreground">Dia {collaborator.payment_day}</p>
                  </div>
                )}
                {collaborator.pix && (
                  <div className="rounded-lg bg-secondary/30 border border-border/30 px-3 py-2.5 col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">PIX</p>
                    <p className="text-xs font-medium text-foreground/80 break-all">{collaborator.pix}</p>
                  </div>
                )}
                {collaborator.cnpj && (
                  <div className="rounded-lg bg-secondary/30 border border-border/30 px-3 py-2.5 col-span-2">
                    <p className="text-[10px] text-muted-foreground mb-0.5">CNPJ</p>
                    <p className="text-xs font-medium text-foreground/80">{collaborator.cnpj}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Dates */}
            <div>
              <SectionLabel>Datas</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {collaborator.start_date && (
                  <FieldRow label="Início" value={formatDate(collaborator.start_date)} />
                )}
                {collaborator.birth_date && (
                  <FieldRow label="Nascimento" value={formatDate(collaborator.birth_date)} />
                )}
                {collaborator.end_date && (
                  <FieldRow label="Saída" value={formatDate(collaborator.end_date)} />
                )}
              </div>
            </div>

            {/* eKyte link */}
            {collaborator.ekyte_task_type && (
              <div>
                <SectionLabel>Links</SectionLabel>
                <a
                  href={`https://app.ekyte.com/tasks?type=${collaborator.ekyte_task_type}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 hover:bg-secondary/80 px-2.5 py-1.5 text-xs font-medium transition-colors"
                >
                  <ExternalLink size={12} />
                  Ver no eKyte
                </a>
              </div>
            )}

            {/* History placeholder */}
            <div>
              <SectionLabel>Histórico de 1:1</SectionLabel>
              <div className="rounded-xl border-2 border-dashed border-border/30 p-5 text-center">
                <Clock size={20} className="text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma reunião registrada ainda.</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Em breve disponível</p>
              </div>
            </div>

            {/* Deactivate / reactivate */}
            <div className="pb-4">
              <button
                onClick={onToggleStatus}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors border ${
                  isActive
                    ? "border-destructive/30 text-destructive hover:bg-destructive/10"
                    : "border-green-500/30 text-green-400 hover:bg-green-500/10"
                }`}
              >
                {isActive ? "Desativar Colaborador" : "Reativar Colaborador"}
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ViewMode = "cards" | "table";
type StatusFilter = "all" | "active" | "inactive";

export function CollaboratorsPage() {
  const {
    collaborators,
    active,
    loading,
    error,
    totalRemuneration,
    byArea,
    bySquad,
    saveCollaborator,
    deleteCollaborator,
  } = useCollaborators();

  const { squads } = useSquadsData();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterSquad, setFilterSquad] = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("active");

  // Sort (table)
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Modal / panel state
  const [editTarget, setEditTarget] = useState<Collaborator | null | undefined>(undefined); // undefined = closed, null = new
  const [detailTarget, setDetailTarget] = useState<Collaborator | null>(null);

  // Handlers
  function openNew() {
    setEditTarget(null);
  }

  function openEdit(c: Collaborator) {
    setDetailTarget(null);
    setEditTarget(c);
  }

  function openDetail(c: Collaborator) {
    setDetailTarget(c);
  }

  const handleToggleStatus = useCallback(
    async (c: Collaborator) => {
      const isActive = c.status === "active" && !c.end_date;
      if (isActive) {
        await deleteCollaborator(c.id);
      } else {
        await saveCollaborator(
          {
            ...c,
            status: "active",
            end_date: "",
          },
          c.id
        );
      }
      setDetailTarget(null);
    },
    [deleteCollaborator, saveCollaborator]
  );

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = collaborators.filter((c) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.role ?? "").toLowerCase().includes(q);
      const matchArea = !filterArea || c.area === filterArea;
      const matchSquad = !filterSquad || c.squad_name === filterSquad || c.squad_id === filterSquad;
      const isActive = c.status === "active" && !c.end_date;
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && isActive) ||
        (filterStatus === "inactive" && !isActive);
      return matchSearch && matchArea && matchSquad && matchStatus;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name, "pt-BR");
      if (sortKey === "remuneration") cmp = (a.remuneration ?? 0) - (b.remuneration ?? 0);
      if (sortKey === "start_date")
        cmp = (a.start_date ?? "").localeCompare(b.start_date ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [collaborators, search, filterArea, filterSquad, filterStatus, sortKey, sortDir]);

  // Unique squads from collaborators for filter dropdown
  const squadOptions = useMemo(() => {
    const names = new Set(
      collaborators.map((c) => c.squad_name).filter(Boolean) as string[]
    );
    return Array.from(names).sort();
  }, [collaborators]);

  // Area counts for stats (active only)
  const topAreas = useMemo(() => {
    return AREAS.filter((a) => (byArea[a] ?? 0) > 0)
      .map((a) => ({ area: a, count: byArea[a] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [byArea]);

  // Squads count
  const squadCount = Object.keys(bySquad).length;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando colaboradores…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="glass rounded-xl p-6 max-w-sm text-center">
          <p className="text-destructive font-medium mb-1">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen bg-background px-4 py-6 md:px-6 lg:px-8 space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={22} className="text-primary" />
            Colaboradores
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gestão de pessoas e equipes da V4 Company
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus size={16} />
          Novo Colaborador
        </button>
      </div>

      {/* ── Stats row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Total Ativos"
          value={active.length}
          sub={`de ${collaborators.length} total`}
          color="bg-green-500/10 text-green-400"
        />
        <StatCard
          icon={DollarSign}
          label="Total Remuneração"
          value={formatCurrencyCompact(totalRemuneration)}
          sub="base mensal"
          color="bg-yellow-500/10 text-yellow-400"
        />
        <StatCard
          icon={Building2}
          label="Áreas"
          value={topAreas.map((a) => `${a.area} (${a.count})`).join(" · ") || "—"}
          sub={`${AREAS.filter((a) => (byArea[a] ?? 0) > 0).length} áreas ativas`}
          color="bg-violet-500/10 text-violet-400"
        />
        <StatCard
          icon={Briefcase}
          label="Squads"
          value={squadCount}
          sub="com colaboradores"
          color="bg-purple-500/10 text-purple-400"
        />
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="w-full pl-8 pr-3 py-2 bg-secondary/40 border border-border/60 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40 transition-colors text-foreground"
            placeholder="Buscar por nome, e-mail ou função…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Area filter */}
        <div className="relative">
          <select
            className="appearance-none bg-secondary/40 border border-border/60 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors text-foreground min-w-[130px]"
            value={filterArea}
            onChange={(e) => setFilterArea(e.target.value)}
          >
            <option value="">Todas Áreas</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Squad filter */}
        <div className="relative">
          <select
            className="appearance-none bg-secondary/40 border border-border/60 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors text-foreground min-w-[130px]"
            value={filterSquad}
            onChange={(e) => setFilterSquad(e.target.value)}
          >
            <option value="">Todos Squads</option>
            {squadOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Status filter */}
        <div className="flex items-center rounded-lg border border-border/60 overflow-hidden">
          {(["active", "all", "inactive"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                filterStatus === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
            >
              {s === "active" ? "Ativos" : s === "inactive" ? "Inativos" : "Todos"}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-border/60 overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode("cards")}
            className={`w-9 h-9 flex items-center justify-center transition-colors ${
              viewMode === "cards"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
            }`}
            title="Cards"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`w-9 h-9 flex items-center justify-center transition-colors ${
              viewMode === "table"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
            }`}
            title="Tabela"
          >
            <List size={15} />
          </button>
        </div>
      </div>

      {/* ── Result count ─────────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground -mt-2">
        {filtered.length === collaborators.length
          ? `${collaborators.length} colaboradores`
          : `${filtered.length} de ${collaborators.length} colaboradores`}
      </p>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {viewMode === "cards" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((c) => (
              <CollaboratorCard
                key={c.id}
                c={c}
                onClick={() => openDetail(c)}
                onEdit={() => openEdit(c)}
                onToggleStatus={() => handleToggleStatus(c)}
              />
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground text-sm">
              Nenhum colaborador encontrado.
            </div>
          )}
        </div>
      ) : (
        <CollaboratorsTable
          collaborators={filtered}
          onRowClick={openDetail}
          onEdit={openEdit}
          onToggleStatus={handleToggleStatus}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      )}

      {/* ── Modals & Panels ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {/* Add/Edit Modal */}
        {editTarget !== undefined && (
          <CollaboratorModal
            key="collaborator-modal"
            collaborator={editTarget}
            squads={squads}
            onClose={() => setEditTarget(undefined)}
            onSave={saveCollaborator}
          />
        )}

        {/* Detail panel */}
        {detailTarget && (
          <DetailPanel
            key={`detail-${detailTarget.id}`}
            collaborator={detailTarget}
            onClose={() => setDetailTarget(null)}
            onEdit={() => openEdit(detailTarget)}
            onToggleStatus={() => handleToggleStatus(detailTarget)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
