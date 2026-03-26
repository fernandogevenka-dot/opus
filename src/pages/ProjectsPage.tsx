import { useState, useEffect, useMemo } from "react";
import {
  useProjects,
  MOMENTO_LABELS,
  ACTIVE_MOMENTOS,
  PRODUTOS_LIST,
  type Project,
  type ProjectFormData,
  type ProjectMomento,
} from "@/hooks/useProjects";
import {
  useProducts,
  PRODUCT_CATEGORIES,
  getCategoryConfig,
  type Product,
  type ProductFormData,
  type BillingType,
} from "@/hooks/useProducts";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  ExternalLink,
  Edit2,
  Trash2,
  TrendingUp,
  Users,
  DollarSign,
  AlertTriangle,
  ChevronDown,
  X,
  Check,
  Globe,
  Folder,
  Database,
  Megaphone,
  Package,
  RefreshCw,
  Repeat,
  ShoppingCart,
  Tag,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { getCategoryForProduct, PRODUCT_CATALOG } from "@/lib/productCatalog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMRR(n: number | undefined | null): string {
  if (!n || n === 0) return "—";
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

function formatCurrency(n: number | undefined | null): string {
  if (!n || n === 0) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | undefined | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

// ─── Setores STEP ─────────────────────────────────────────────────────────────
//
// Cada setor tem uma métrica financeira diferente:
//   Executar    → MRR (receita recorrente mensal)
//   Saber       → Receita (estruturacao_estrategica)
//   Potencializar → Comissão gerada (variavel)
//   Ter         → Receita (investimento)

const SETORES = [
  { id: "executar",      label: "Executar",       icon: "⚙️", color: "#22c55e",  metricLabel: "MRR"       },
  { id: "saber",         label: "Saber",           icon: "🎓", color: "#8b5cf6",  metricLabel: "Receita"   },
  { id: "potencializar", label: "Potencializar",   icon: "🚀", color: "#f59e0b",  metricLabel: "Comissão"  },
  { id: "ter",           label: "Ter",             icon: "📦", color: "#06b6d4",  metricLabel: "Receita"   },
] as const;

type SetorId = typeof SETORES[number]["id"];

/** Retorna a métrica financeira relevante do projeto para o setor ativo */
function getSetorMetric(project: Project, setorId: SetorId | ""): number {
  switch (setorId) {
    case "executar":      return project.mrr ?? 0;
    case "saber":         return project.estruturacao_estrategica ?? 0;
    case "potencializar": return project.variavel ?? 0;
    case "ter":           return project.investimento ?? 0;
    default:              return project.mrr ?? 0;
  }
}

/** Retorna o id do setor de um projeto baseado nos produtos */
function getProjectSetor(project: Project): SetorId | null {
  const produtos = project.produtos ?? [];
  // Tenta identificar via primeiro produto
  for (const p of produtos) {
    const cat = getCategoryForProduct(p);
    if (cat) return cat.id as SetorId;
  }
  return null;
}

// ─── Momento badge config ─────────────────────────────────────────────────────

interface BadgeConfig {
  bg: string;
  text: string;
  border: string;
}

function getMomentoBadgeConfig(momento: string | undefined | null): BadgeConfig {
  if (!momento) return { bg: "bg-muted/40", text: "text-muted-foreground", border: "border-border/50" };
  if (momento.includes("Ongoing"))
    return { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-400", border: "border-green-500/20" };
  if (momento.includes("Onboarding"))
    return { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/20" };
  if (momento.includes("Implementação"))
    return { bg: "bg-yellow-500/10", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/20" };
  if (momento.includes("Atrasado"))
    return { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/20" };
  if (momento.includes("A Iniciar"))
    return { bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20" };
  if (momento.includes("Aviso Prévio"))
    return { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500/20" };
  if (momento.includes("Pausado"))
    return { bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400", border: "border-red-500/20" };
  if (momento.includes("Concluído - Negociação"))
    return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" };
  if (momento.includes("Concluído - Cross Sell"))
    return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" };
  if (momento.includes("Concluído"))
    return { bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/20" };
  if (momento.includes("Cancelado"))
    return { bg: "bg-muted/40", text: "text-muted-foreground", border: "border-border/50" };
  if (momento.includes("Inativo"))
    return { bg: "bg-muted/40", text: "text-muted-foreground", border: "border-border/50" };
  return { bg: "bg-muted/40", text: "text-muted-foreground", border: "border-border/50" };
}

function MomentoBadge({ momento, size = "sm" }: { momento: string | undefined | null; size?: "xs" | "sm" }) {
  const cfg = getMomentoBadgeConfig(momento);
  const px = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${px} ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      {momento ?? "—"}
    </span>
  );
}

// ─── Risco badge ──────────────────────────────────────────────────────────────

function RiscoBadge({ risco }: { risco: string | undefined | null }) {
  if (!risco || risco === "Baixo" || risco === "baixo") {
    return <span className="text-xs text-green-500 font-medium">{risco ?? "—"}</span>;
  }
  if (risco === "Médio" || risco === "medio" || risco === "médio") {
    return <span className="text-xs text-yellow-500 font-medium">{risco}</span>;
  }
  if (risco === "Alto" || risco === "alto") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-500 font-medium">
        <AlertTriangle size={10} />
        {risco}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">{risco}</span>;
}

// ─── Produto chip ─────────────────────────────────────────────────────────────

function ProdutoChip({ name }: { name: string }) {
  // Shorten for display
  const short = name
    .replace("Profissional de ", "")
    .replace("Implementação de ", "Impl. ")
    .replace("Manutenção ", "Manut. ")
    .replace("Estruturação Estratégica", "EE")
    .replace("Gestão de Projetos Avançada", "GP Avançada")
    .replace("Diagnóstico e Planejamento de Marketing e Vendas no Digital", "Diagnóstico")
    .replace("Manutenção Preventiva para Sites", "Manut. Sites");
  return (
    <span className="inline-flex items-center rounded-md bg-secondary/60 border border-border/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground/70">
      {short}
    </span>
  );
}

// ─── Client/Squad loader ──────────────────────────────────────────────────────

interface ClientOption {
  id: string;
  name: string;
}

interface SquadOption {
  id: string;
  name: string;
}

function useClientOptions() {
  const [clients, setClients] = useState<ClientOption[]>([]);
  useEffect(() => {
    supabase
      .from("clients")
      .select("id, name")
      .order("name")
      .then(({ data }) => setClients(data || []));
  }, []);
  return clients;
}

function useSquadOptions() {
  const [squads, setSquads] = useState<SquadOption[]>([]);
  useEffect(() => {
    supabase
      .from("squads")
      .select("id, name")
      .order("name")
      .then(({ data }) => setSquads(data || []));
  }, []);
  return squads;
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

interface KanbanCardProps {
  project: Project;
  filterSetor: SetorId | "";
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function KanbanCard({ project, filterSetor, onClick, onEdit, onDelete }: KanbanCardProps) {
  const [showActions, setShowActions] = useState(false);

  // Métrica principal conforme setor ativo
  const metric = getSetorMetric(project, filterSetor);
  const metricLabel = SETORES.find((s) => s.id === filterSetor)?.metricLabel ?? "MRR";

  // Badge de setor do projeto
  const projectSetor = getProjectSetor(project);
  const setorConfig = SETORES.find((s) => s.id === projectSetor);

  // Borda colorida para aviso prévio
  const isAvisoPrevio = project.momento === "⏳ Aviso Prévio";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -1 }}
      className={`glass rounded-xl p-3 cursor-pointer group relative ${
        isAvisoPrevio ? "border border-orange-400/40" : ""
      }`}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Actions overlay */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-2 right-2 flex gap-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-6 h-6 rounded-md bg-secondary/80 hover:bg-primary/20 hover:text-primary flex items-center justify-center transition-colors"
            >
              <Edit2 size={11} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-6 h-6 rounded-md bg-secondary/80 hover:bg-destructive/20 hover:text-destructive flex items-center justify-center transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top row: setor badge + USA */}
      {(setorConfig || project.usa) && (
        <div className="flex items-center gap-1 mb-1.5">
          {setorConfig && (
            <span
              className="inline-flex items-center gap-0.5 text-[9px] font-semibold rounded px-1 py-0.5 border"
              style={{
                color: setorConfig.color,
                backgroundColor: setorConfig.color + "18",
                borderColor: setorConfig.color + "40",
              }}
            >
              {setorConfig.icon} {setorConfig.label}
            </span>
          )}
          {project.usa && (
            <span className="text-[9px] font-semibold text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded px-1 py-0.5">
              🇺🇸
            </span>
          )}
        </div>
      )}

      {/* Project name */}
      <p className="text-sm font-semibold leading-snug pr-14 truncate">{project.name}</p>

      {/* Client + Squad */}
      {(project.client_name || project.squad_name) && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {project.client_name}
          {project.client_name && project.squad_name && " · "}
          {project.squad_name}
        </p>
      )}

      {/* Métrica principal */}
      {metric > 0 && (
        <div className="flex items-center gap-1 mt-2">
          <DollarSign size={11} className="text-green-500" />
          <span className="text-xs font-medium text-green-600 dark:text-green-400">
            {formatMRR(metric)}
          </span>
          {filterSetor && (
            <span className="text-[9px] text-muted-foreground">{metricLabel}</span>
          )}
        </div>
      )}

      {/* Gestor */}
      {project.gestor_projeto && (
        <p className="text-[10px] text-muted-foreground mt-1 truncate">
          {project.gestor_projeto}
        </p>
      )}

      {/* Produtos */}
      {project.produtos && project.produtos.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {project.produtos.slice(0, 2).map((p) => (
            <ProdutoChip key={p} name={p} />
          ))}
          {project.produtos.length > 2 && (
            <span className="text-[10px] text-muted-foreground">+{project.produtos.length - 2}</span>
          )}
        </div>
      )}

      {/* Risco (apenas médio/alto) */}
      {project.risco && project.risco !== "Baixo" && project.risco !== "baixo" && (
        <div className="mt-1.5">
          <RiscoBadge risco={project.risco} />
        </div>
      )}
    </motion.div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  title: string;
  projects: Project[];
  filterSetor: SetorId | "";
  isInactive?: boolean;
  onCardClick: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}

function KanbanColumn({ title, projects, filterSetor, isInactive, onCardClick, onEdit, onDelete }: KanbanColumnProps) {
  const cfg = getMomentoBadgeConfig(isInactive ? null : title);
  const totalMetric = projects.reduce((s, p) => s + getSetorMetric(p, filterSetor), 0);

  return (
    <div className="flex flex-col gap-2 min-w-[220px] w-[220px] flex-shrink-0">
      {/* Column header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${isInactive ? "text-muted-foreground" : cfg.text}`}>
            {title}
          </span>
          <span className={`text-[10px] font-medium rounded-full px-1.5 py-0.5 ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
            {projects.length}
          </span>
        </div>
        {totalMetric > 0 && (
          <span className="text-[10px] text-muted-foreground font-medium">{formatMRR(totalMetric)}</span>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1 min-h-[60px]">
        <AnimatePresence mode="popLayout">
          {projects.map((p) => (
            <KanbanCard
              key={p.id}
              project={p}
              filterSetor={filterSetor}
              onClick={() => onCardClick(p)}
              onEdit={() => onEdit(p)}
              onDelete={() => onDelete(p)}
            />
          ))}
        </AnimatePresence>
        {projects.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border/30 p-4 text-center">
            <p className="text-xs text-muted-foreground/40">Nenhum projeto</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sortable Table ───────────────────────────────────────────────────────────

type SortField = "name" | "client_name" | "squad_name" | "mrr" | "momento" | "risco" | "gestor_projeto";
type SortDir = "asc" | "desc";

interface ListViewProps {
  projects: Project[];
  onRowClick: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}

function ListView({ projects, onRowClick, onEdit, onDelete }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...projects].sort((a, b) => {
      let va: string | number = a[sortField] ?? "";
      let vb: string | number = b[sortField] ?? "";
      if (sortField === "mrr") {
        va = a.mrr || 0;
        vb = b.mrr || 0;
        return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
      }
      const sa = String(va).toLowerCase();
      const sb = String(vb).toLowerCase();
      return sortDir === "asc" ? sa.localeCompare(sb, "pt-BR") : sb.localeCompare(sa, "pt-BR");
    });
  }, [projects, sortField, sortDir]);

  function SortHeader({ field, label }: { field: SortField; label: string }) {
    const active = sortField === field;
    return (
      <th
        className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap"
        onClick={() => toggleSort(field)}
      >
        <span className="flex items-center gap-1">
          {label}
          <span className={`transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-50"}`}>
            {sortDir === "asc" ? "↑" : "↓"}
          </span>
        </span>
      </th>
    );
  }

  return (
    <div className="overflow-auto rounded-xl glass">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 group">
            <SortHeader field="name" label="Nome" />
            <SortHeader field="client_name" label="Cliente" />
            <SortHeader field="squad_name" label="Squad" />
            <SortHeader field="mrr" label="MRR" />
            <SortHeader field="momento" label="Momento" />
            <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">Produtos</th>
            <SortHeader field="gestor_projeto" label="Gestor" />
            <SortHeader field="risco" label="Risco" />
            <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Ações</th>
          </tr>
        </thead>
        <tbody>
          <AnimatePresence mode="popLayout">
            {sorted.map((project, idx) => (
              <motion.tr
                key={project.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: idx * 0.015 }}
                className="border-b border-border/30 hover:bg-secondary/30 cursor-pointer transition-colors"
                onClick={() => onRowClick(project)}
              >
                <td className="px-3 py-2.5">
                  <div>
                    <p className="font-medium text-sm leading-tight truncate max-w-[200px]">{project.name}</p>
                    {project.usa && (
                      <span className="text-[10px] text-blue-500 font-medium">🇺🇸 USA</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground truncate max-w-[140px]">
                  {project.client_name ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground truncate max-w-[120px]">
                  {project.squad_name ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-sm font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                  {formatMRR(project.mrr)}
                </td>
                <td className="px-3 py-2.5">
                  <MomentoBadge momento={project.momento} />
                </td>
                <td className="px-3 py-2.5">
                  {project.produtos && project.produtos.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-w-[180px]">
                      {project.produtos.slice(0, 2).map((p) => (
                        <ProdutoChip key={p} name={p} />
                      ))}
                      {project.produtos.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{project.produtos.length - 2}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-sm text-muted-foreground truncate max-w-[130px]">
                  {project.gestor_projeto ?? "—"}
                </td>
                <td className="px-3 py-2.5">
                  <RiscoBadge risco={project.risco} />
                </td>
                <td className="px-3 py-2.5">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onEdit(project)}
                      className="w-7 h-7 rounded-lg hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors text-muted-foreground"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => onDelete(project)}
                      className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors text-muted-foreground"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">
          Nenhum projeto encontrado
        </div>
      )}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  project: Project;
  onClose: () => void;
  onEdit: () => void;
}

function DetailModal({ project, onClose, onEdit }: DetailModalProps) {
  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h4>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">{children}</div>
      </div>
    );
  }

  function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
      <div>
        <p className="text-[10px] text-muted-foreground/60">{label}</p>
        <p className="text-sm font-medium text-foreground/90">{value ?? "—"}</p>
      </div>
    );
  }

  function LinkButton({ href, icon, label }: { href: string | undefined | null; icon: React.ReactNode; label: string }) {
    if (!href) return null;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/40 hover:bg-secondary/80 px-2.5 py-1.5 text-xs font-medium transition-colors"
      >
        {icon}
        {label}
        <ExternalLink size={10} className="text-muted-foreground" />
      </a>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        {/* Panel */}
        <motion.div
          className="relative z-10 glass-strong rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
          initial={{ scale: 0.96, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.96, y: 16 }}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-border/50">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold truncate">{project.name}</h2>
                {project.usa && (
                  <span className="text-xs font-semibold text-blue-500 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">
                    🇺🇸 USA
                  </span>
                )}
                {project.momento && <MomentoBadge momento={project.momento} />}
              </div>
              {(project.client_name || project.squad_name) && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {project.client_name}
                  {project.client_name && project.squad_name && " · "}
                  {project.squad_name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0 ml-3">
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <Edit2 size={12} />
                Editar
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-secondary/60 flex items-center justify-center text-muted-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-5">
            {/* Financial */}
            <Section title="Financeiro">
              <Field label="MRR" value={<span className="text-green-600 dark:text-green-400">{formatMRR(project.mrr)}</span>} />
              <Field label="Investimento" value={formatCurrency(project.investimento)} />
              <Field label="Margem Bruta" value={project.margem_bruta ? `${project.margem_bruta.toFixed(1)}%` : "—"} />
              <Field label="Ticket Médio" value={formatCurrency(project.ticket_medio)} />
            </Section>

            {/* Team */}
            <Section title="Equipe">
              <Field label="Gestor de Projeto" value={project.gestor_projeto} />
              <Field label="Gestor de Tráfego" value={project.gestor_trafego} />
              <Field label="Prioridade" value={project.prioridade} />
              <Field label="Risco" value={<RiscoBadge risco={project.risco} />} />
            </Section>

            {/* Timeline */}
            <Section title="Datas">
              <Field label="Data de Início" value={formatDate(project.start_date)} />
              <Field label="Data de Encerramento" value={formatDate(project.end_date)} />
              <Field label="Aviso Prévio" value={formatDate(project.aviso_previo_date)} />
              <Field label="Último Dia de Serviço" value={formatDate(project.ultimo_dia_servico)} />
            </Section>

            {/* Produtos */}
            {project.produtos && project.produtos.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Produtos</h4>
                <div className="flex flex-wrap gap-1.5">
                  {project.produtos.map((p) => (
                    <ProdutoChip key={p} name={p} />
                  ))}
                </div>
              </div>
            )}

            {/* IDs */}
            <Section title="Identificadores">
              <Field label="Meta Ads ID" value={project.meta_ads_id} />
              <Field label="Google Ads ID" value={project.google_ads_id} />
              <Field label="WA Group ID" value={project.wa_group_id} />
              <Field label="Ekyte ID" value={project.ekyte_id} />
            </Section>

            {/* Links */}
            {(project.crm_url || project.pasta_publica || project.pasta_privada || project.sistema_dados_url || project.contrato_url) && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Links</h4>
                <div className="flex flex-wrap gap-2">
                  <LinkButton href={project.crm_url} icon={<Megaphone size={12} />} label="CRM" />
                  <LinkButton href={project.pasta_publica} icon={<Folder size={12} />} label="Pasta Pública" />
                  <LinkButton href={project.pasta_privada} icon={<Folder size={12} />} label="Pasta Privada" />
                  <LinkButton href={project.sistema_dados_url} icon={<Database size={12} />} label="Sistema de Dados" />
                  <LinkButton href={project.contrato_url} icon={<Globe size={12} />} label="Contrato" />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

interface FormModalProps {
  project?: Project | null;
  onClose: () => void;
  onSave: (data: ProjectFormData, id?: string) => Promise<void>;
  clients: ClientOption[];
  squads: SquadOption[];
}

const EMPTY_FORM: ProjectFormData = {
  name: "",
  client_id: undefined,
  squad_id: undefined,
  squad_name: undefined,
  mrr: undefined,
  investimento: undefined,
  margem_bruta: undefined,
  gestor_projeto: undefined,
  gestor_trafego: undefined,
  momento: undefined,
  prioridade: undefined,
  risco: undefined,
  usa: false,
  start_date: undefined,
  end_date: undefined,
  produtos: [],
  pasta_publica: undefined,
  pasta_privada: undefined,
  crm_url: undefined,
  meta_ads_id: undefined,
  google_ads_id: undefined,
  wa_group_id: undefined,
  taxa_conversao: undefined,
};

function FormModal({ project, onClose, onSave, clients, squads }: FormModalProps) {
  const { activeProducts } = useProducts();
  const [form, setForm] = useState<ProjectFormData>(() => {
    if (!project) return EMPTY_FORM;
    return {
      name: project.name ?? "",
      client_id: project.client_id,
      squad_id: project.squad_id,
      squad_name: project.squad_name,
      mrr: project.mrr,
      investimento: project.investimento,
      margem_bruta: project.margem_bruta,
      gestor_projeto: project.gestor_projeto,
      gestor_trafego: project.gestor_trafego,
      momento: project.momento,
      prioridade: project.prioridade,
      risco: project.risco,
      usa: project.usa ?? false,
      start_date: project.start_date ? project.start_date.slice(0, 10) : undefined,
      end_date: project.end_date ? project.end_date.slice(0, 10) : undefined,
      produtos: project.produtos ?? [],
      pasta_publica: project.pasta_publica,
      pasta_privada: project.pasta_privada,
      crm_url: project.crm_url,
      meta_ads_id: project.meta_ads_id,
      google_ads_id: project.google_ads_id,
      wa_group_id: project.wa_group_id,
      taxa_conversao: project.taxa_conversao,
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleProduto(p: string) {
    const cur = form.produtos ?? [];
    if (cur.includes(p)) {
      set("produtos", cur.filter((x) => x !== p));
    } else {
      set("produtos", [...cur, p]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nome do projeto é obrigatório");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form, project?.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar projeto");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full bg-secondary/40 border border-border/60 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40 transition-colors";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

  function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-1.5 border-b border-border/40">
          {title}
        </h4>
        <div className="grid grid-cols-2 gap-3">{children}</div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />

        <motion.div
          className="relative z-10 glass-strong rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-border/50">
            <h2 className="text-base font-bold">
              {project ? "Editar Projeto" : "Novo Projeto"}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-secondary/60 flex items-center justify-center text-muted-foreground"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-5">
            {/* Básico */}
            <FormSection title="Informações Básicas">
              {/* Nome — full width */}
              <div className="col-span-2">
                <label className={labelCls}>Nome do Projeto *</label>
                <input
                  className={inputCls}
                  placeholder="Ex: Clínica Exemplo - Gestão de Tráfego"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                />
              </div>

              {/* Cliente */}
              <div>
                <label className={labelCls}>Cliente</label>
                <select
                  className={inputCls}
                  value={form.client_id ?? ""}
                  onChange={(e) => set("client_id", e.target.value || undefined)}
                >
                  <option value="">Selecione o cliente</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Squad */}
              <div>
                <label className={labelCls}>Squad</label>
                <select
                  className={inputCls}
                  value={form.squad_id ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || undefined;
                    const name = squads.find((s) => s.id === id)?.name;
                    set("squad_id", id);
                    set("squad_name", name);
                  }}
                >
                  <option value="">Selecione o squad</option>
                  {squads.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Momento */}
              <div>
                <label className={labelCls}>Momento</label>
                <select
                  className={inputCls}
                  value={form.momento ?? ""}
                  onChange={(e) => set("momento", e.target.value || undefined)}
                >
                  <option value="">Selecione o momento</option>
                  {MOMENTO_LABELS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Prioridade */}
              <div>
                <label className={labelCls}>Prioridade</label>
                <select
                  className={inputCls}
                  value={form.prioridade ?? ""}
                  onChange={(e) => set("prioridade", e.target.value || undefined)}
                >
                  <option value="">Selecione</option>
                  <option value="Alta">Alta</option>
                  <option value="Média">Média</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </div>

              {/* Risco */}
              <div>
                <label className={labelCls}>Risco</label>
                <select
                  className={inputCls}
                  value={form.risco ?? ""}
                  onChange={(e) => set("risco", e.target.value || undefined)}
                >
                  <option value="">Selecione</option>
                  <option value="Baixo">Baixo</option>
                  <option value="Médio">Médio</option>
                  <option value="Alto">Alto</option>
                </select>
              </div>

              {/* USA */}
              <div className="flex items-center gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => set("usa", !form.usa)}
                  className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                    form.usa
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "border-border/60 bg-secondary/40"
                  }`}
                >
                  {form.usa && <Check size={11} />}
                </button>
                <label className="text-sm font-medium cursor-pointer" onClick={() => set("usa", !form.usa)}>
                  🇺🇸 Projeto USA
                </label>
              </div>
            </FormSection>

            {/* Financeiro */}
            <FormSection title="Financeiro">
              <div>
                <label className={labelCls}>MRR (R$)</label>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="0"
                  value={form.mrr ?? ""}
                  onChange={(e) => set("mrr", e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div>
                <label className={labelCls}>Investimento (R$)</label>
                <input
                  type="number"
                  className={inputCls}
                  placeholder="0"
                  value={form.investimento ?? ""}
                  onChange={(e) => set("investimento", e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </FormSection>

            {/* Equipe */}
            <FormSection title="Equipe">
              <div>
                <label className={labelCls}>Gestor de Projeto</label>
                <input
                  className={inputCls}
                  placeholder="Nome do gestor"
                  value={form.gestor_projeto ?? ""}
                  onChange={(e) => set("gestor_projeto", e.target.value || undefined)}
                />
              </div>
              <div>
                <label className={labelCls}>Gestor de Tráfego</label>
                <input
                  className={inputCls}
                  placeholder="Nome do gestor"
                  value={form.gestor_trafego ?? ""}
                  onChange={(e) => set("gestor_trafego", e.target.value || undefined)}
                />
              </div>
            </FormSection>

            {/* Datas */}
            <FormSection title="Datas">
              <div>
                <label className={labelCls}>Data de Início</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.start_date ?? ""}
                  onChange={(e) => set("start_date", e.target.value || undefined)}
                />
              </div>
              <div>
                <label className={labelCls}>Data de Encerramento</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.end_date ?? ""}
                  onChange={(e) => set("end_date", e.target.value || undefined)}
                />
              </div>
            </FormSection>

            {/* Produtos */}
            <div>
              <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-border/40">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Produtos do Projeto
                </h4>
                {(form.produtos ?? []).length > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {(form.produtos ?? []).length} selecionado{(form.produtos ?? []).length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {activeProducts.length === 0 ? (
                /* Fallback para lista estática se não houver produtos cadastrados */
                <div className="grid grid-cols-1 gap-1.5">
                  <p className="text-xs text-muted-foreground/60 mb-1">
                    Nenhum produto no catálogo ainda.{" "}
                    <span className="text-primary">Cadastre produtos na aba "Catálogo de Produtos".</span>
                  </p>
                  {PRODUTOS_LIST.map((p) => {
                    const checked = (form.produtos ?? []).includes(p);
                    return (
                      <label key={p} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer hover:bg-secondary/40 transition-colors">
                        <button type="button" onClick={() => toggleProduto(p)}
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border/60 bg-secondary/40"}`}>
                          {checked && <Check size={10} />}
                        </button>
                        <span className="text-sm">{p}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                /* Catálogo dinâmico agrupado por categoria */
                <div className="space-y-3">
                  {PRODUCT_CATEGORIES.filter((cat) => activeProducts.some((p) => p.category === cat.id)).map((cat) => {
                    const catProducts = activeProducts.filter((p) => p.category === cat.id);
                    return (
                      <div key={cat.id}>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                          <span>{cat.icon}</span>{cat.label}
                        </p>
                        <div className="space-y-1">
                          {catProducts.map((prod) => {
                            const checked = (form.produtos ?? []).includes(prod.name);
                            const isRecurring = prod.billing_type === "recurring";
                            return (
                              <div key={prod.id}
                                className={`rounded-xl border transition-colors ${checked ? "border-primary/30 bg-primary/5" : "border-border/40 bg-secondary/20"}`}
                              >
                                <div className="flex items-center gap-2.5 px-3 py-2.5">
                                  {/* Checkbox */}
                                  <button type="button" onClick={() => toggleProduto(prod.name)}
                                    className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border/60 bg-secondary/40"}`}>
                                    {checked && <Check size={10} />}
                                  </button>

                                  {/* Nome + badge tipo */}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm font-medium">{prod.name}</span>
                                      <span
                                        className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                        style={{
                                          color: isRecurring ? "#22c55e" : "#60a5fa",
                                          backgroundColor: isRecurring ? "#22c55e18" : "#3b82f618",
                                        }}
                                      >
                                        {isRecurring ? "Recorrente" : "One-time"}
                                      </span>
                                    </div>
                                    {prod.default_price > 0 && !checked && (
                                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                                        Padrão: {formatPrice(prod.default_price)}{isRecurring ? "/mês" : ""}
                                      </p>
                                    )}
                                  </div>

                                  {/* Campo de valor editável quando selecionado */}
                                  {checked && (
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      <span className="text-xs text-muted-foreground">R$</span>
                                      <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        placeholder={String(prod.default_price || 0)}
                                        value={form.mrr && (form.produtos ?? []).filter(x => {
                                          const pp = activeProducts.find(a => a.name === x);
                                          return pp?.billing_type === "recurring";
                                        }).length === 1 && isRecurring ? (form.mrr ?? "") : ""}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          if (isRecurring) set("mrr", val || undefined);
                                          else set("investimento", val || undefined);
                                        }}
                                        className="w-24 bg-background border border-border/60 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 text-right"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span className="text-[10px] text-muted-foreground/60">
                                        {isRecurring ? "/mês" : "único"}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* URLs */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-1.5 border-b border-border/40">
                Links e URLs
              </h4>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5"><Megaphone size={11} /> URL do CRM</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="https://..."
                    value={form.crm_url ?? ""}
                    onChange={(e) => set("crm_url", e.target.value || undefined)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5"><Folder size={11} /> Pasta Pública</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="https://drive.google.com/..."
                    value={form.pasta_publica ?? ""}
                    onChange={(e) => set("pasta_publica", e.target.value || undefined)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5"><Folder size={11} /> Pasta Privada</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="https://drive.google.com/..."
                    value={form.pasta_privada ?? ""}
                    onChange={(e) => set("pasta_privada", e.target.value || undefined)}
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    <span className="flex items-center gap-1.5"><Database size={11} /> Sistema de Dados</span>
                  </label>
                  <input
                    className={inputCls}
                    placeholder="https://..."
                    value={(form as ProjectFormData & { sistema_dados_url?: string }).sistema_dados_url ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        sistema_dados_url: e.target.value || undefined,
                      } as typeof f))
                    }
                  />
                </div>
              </div>
            </div>

            {/* IDs */}
            <FormSection title="Identificadores de Plataforma">
              <div>
                <label className={labelCls}>Meta Ads ID</label>
                <input
                  className={inputCls}
                  placeholder="Ex: act_123456789"
                  value={form.meta_ads_id ?? ""}
                  onChange={(e) => set("meta_ads_id", e.target.value || undefined)}
                />
              </div>
              <div>
                <label className={labelCls}>Google Ads ID</label>
                <input
                  className={inputCls}
                  placeholder="Ex: 123-456-7890"
                  value={form.google_ads_id ?? ""}
                  onChange={(e) => set("google_ads_id", e.target.value || undefined)}
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>WA Group ID</label>
                <input
                  className={inputCls}
                  placeholder="ID do grupo do WhatsApp"
                  value={form.wa_group_id ?? ""}
                  onChange={(e) => set("wa_group_id", e.target.value || undefined)}
                />
              </div>
            </FormSection>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-border/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/60 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="project-form"
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && (
                <span className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              )}
              {project ? "Salvar Alterações" : "Criar Projeto"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="glass rounded-xl p-3.5 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-base font-bold leading-none">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Product Catalog Tab ──────────────────────────────────────────────────────

function formatPrice(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const EMPTY_PRODUCT_FORM: ProductFormData = {
  name: "", category: "outros", billing_type: "recurring",
  default_price: 0, description: "", active: true,
};

interface ProductModalProps {
  initial?: Product | null;
  onSave: (data: ProductFormData, id?: string) => Promise<void>;
  onClose: () => void;
}

function ProductModal({ initial, onSave, onClose }: ProductModalProps) {
  const [form, setForm] = useState<ProductFormData>(
    initial
      ? { name: initial.name, category: initial.category, billing_type: initial.billing_type,
          default_price: initial.default_price, description: initial.description ?? "", active: initial.active }
      : { ...EMPTY_PRODUCT_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErr(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setErr("Nome obrigatório"); return; }
    setSaving(true);
    try {
      await onSave(form, initial?.id);
      onClose();
    } catch (e) {
      setErr((e as Error).message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full bg-secondary/40 border border-border/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1.5";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="glass border border-border/60 rounded-2xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package size={16} className="text-primary" />
            </div>
            <h2 className="text-base font-semibold">{initial ? "Editar Produto" : "Novo Produto"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Nome */}
          <div>
            <label className={labelCls}>Nome do produto *</label>
            <input
              autoFocus
              className={inputCls}
              placeholder="Ex: Gestão de Mídia Paga"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {/* Categoria + Tipo de cobrança (2 colunas) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Categoria</label>
              <select
                className={inputCls}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tipo de receita</label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => set("billing_type", "recurring")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    form.billing_type === "recurring"
                      ? "bg-green-500/15 border-green-500/40 text-green-400"
                      : "border-border/60 text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Repeat size={12} />
                  Recorrente
                </button>
                <button
                  type="button"
                  onClick={() => set("billing_type", "one_time")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    form.billing_type === "one_time"
                      ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                      : "border-border/60 text-muted-foreground hover:bg-secondary/60"
                  }`}
                >
                  <ShoppingCart size={12} />
                  One-time
                </button>
              </div>
            </div>
          </div>

          {/* Preço padrão */}
          <div>
            <label className={labelCls}>Preço padrão (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <input
                type="number"
                min={0}
                step={0.01}
                className={inputCls + " pl-8"}
                placeholder="0,00"
                value={form.default_price || ""}
                onChange={(e) => set("default_price", parseFloat(e.target.value) || 0)}
              />
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              {form.billing_type === "recurring" ? "Valor cobrado por mês" : "Valor cobrado por entrega (único)"}
            </p>
          </div>

          {/* Descrição */}
          <div>
            <label className={labelCls}>Descrição (opcional)</label>
            <textarea
              className={inputCls + " resize-none"}
              rows={2}
              placeholder="Descreva o produto brevemente..."
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
            <div>
              <p className="text-sm font-medium">Produto ativo</p>
              <p className="text-xs text-muted-foreground">Visível no cadastro de projetos</p>
            </div>
            <button
              type="button"
              onClick={() => set("active", !form.active)}
              className={`transition-colors ${form.active ? "text-green-400" : "text-muted-foreground/40"}`}
            >
              {form.active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            </button>
          </div>

          {err && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle size={12} />
              {err}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !form.name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" />Salvando…</> : <><Check size={14} />{initial ? "Salvar" : "Criar produto"}</>}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function ProductCatalogTab() {
  const { products, loading, error, saveProduct, deleteProduct, toggleActive } = useProducts();
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterBilling, setFilterBilling] = useState<BillingType | "">("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q);
    const matchCat = !filterCategory || p.category === filterCategory;
    const matchBilling = !filterBilling || p.billing_type === filterBilling;
    return matchSearch && matchCat && matchBilling;
  }), [products, search, filterCategory, filterBilling]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((p) => {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    });
    return map;
  }, [filtered]);

  const recurring = products.filter((p) => p.billing_type === "recurring" && p.active);
  const onetime = products.filter((p) => p.billing_type === "one_time" && p.active);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-2 flex-shrink-0">
        <div className="glass border border-border/50 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center">
            <Package size={16} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{products.length}</p>
          </div>
        </div>
        <div className="glass border border-green-500/20 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
            <Repeat size={16} className="text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Recorrentes</p>
            <p className="text-lg font-bold text-green-400">{recurring.length}</p>
          </div>
        </div>
        <div className="glass border border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <ShoppingCart size={16} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">One-time</p>
            <p className="text-lg font-bold text-blue-400">{onetime.length}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="w-full bg-secondary/40 border border-border/60 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40"
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filtro tipo de cobrança */}
        <button
          onClick={() => setFilterBilling(filterBilling === "recurring" ? "" : "recurring")}
          className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
            filterBilling === "recurring"
              ? "bg-green-500/15 border-green-500/40 text-green-400"
              : "border-border/60 text-muted-foreground hover:bg-secondary/60"
          }`}
        >
          <Repeat size={12} /> Recorrente
        </button>
        <button
          onClick={() => setFilterBilling(filterBilling === "one_time" ? "" : "one_time")}
          className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
            filterBilling === "one_time"
              ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
              : "border-border/60 text-muted-foreground hover:bg-secondary/60"
          }`}
        >
          <ShoppingCart size={12} /> One-time
        </button>

        {/* Filtro categoria */}
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 bg-secondary/40 border border-border/60 rounded-lg px-3 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          <option value="">Todas categorias</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>

        <div className="flex-1" />
        <button
          onClick={() => setEditingProduct(null)}
          className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} />
          Novo Produto
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Lista agrupada por categoria */}
      {products.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Package size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum produto cadastrado</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Produto" para começar</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Nenhum produto encontrado para os filtros aplicados</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 pr-0.5">
          {Array.from(grouped.entries()).map(([categoryId, items]) => {
            const cat = getCategoryConfig(categoryId);
            return (
              <div key={categoryId}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{cat.icon}</span>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{cat.label}</h3>
                  <span className="text-[10px] text-muted-foreground/50">{items.length} produto{items.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((product) => (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`glass border rounded-xl px-4 py-3 flex items-center gap-3 transition-opacity ${!product.active ? "opacity-50" : ""}`}
                      style={{ borderColor: `${cat.color}30` }}
                    >
                      {/* Type badge */}
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: product.billing_type === "recurring" ? "#22c55e18" : "#3b82f618" }}
                      >
                        {product.billing_type === "recurring"
                          ? <Repeat size={14} className="text-green-400" />
                          : <ShoppingCart size={14} className="text-blue-400" />
                        }
                      </div>

                      {/* Name + description */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-medium ${!product.active ? "line-through text-muted-foreground" : ""}`}>
                            {product.name}
                          </p>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-md font-medium"
                            style={{
                              color: product.billing_type === "recurring" ? "#22c55e" : "#60a5fa",
                              backgroundColor: product.billing_type === "recurring" ? "#22c55e18" : "#3b82f618",
                            }}
                          >
                            {product.billing_type === "recurring" ? "Recorrente" : "One-time"}
                          </span>
                          {!product.active && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary/60 text-muted-foreground">Inativo</span>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{product.description}</p>
                        )}
                      </div>

                      {/* Preço padrão */}
                      {product.default_price > 0 && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {product.billing_type === "recurring" ? "R$/mês" : "R$ único"}
                          </p>
                          <p className="text-sm font-semibold">{formatPrice(product.default_price)}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleActive(product.id, !product.active)}
                          className="p-1.5 rounded-lg hover:bg-secondary/80 transition-colors"
                          title={product.active ? "Desativar" : "Ativar"}
                        >
                          {product.active
                            ? <ToggleRight size={16} className="text-green-400" />
                            : <ToggleLeft size={16} className="text-muted-foreground/40" />}
                        </button>
                        <button
                          onClick={() => setEditingProduct(product)}
                          className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeletingProduct(product)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação/edição */}
      <AnimatePresence>
        {editingProduct !== undefined && (
          <ProductModal
            key="product-modal"
            initial={editingProduct}
            onSave={saveProduct}
            onClose={() => setEditingProduct(undefined)}
          />
        )}
      </AnimatePresence>

      {/* Confirmação de exclusão */}
      <AnimatePresence>
        {deletingProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
            onClick={() => setDeletingProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass border border-border/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Trash2 size={18} className="text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Excluir produto</p>
                  <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Excluir <span className="font-semibold text-foreground">{deletingProduct.name}</span>?
                Projetos existentes não serão afetados.
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeletingProduct(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/60 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={async () => { await deleteProduct(deletingProduct.id); setDeletingProduct(null); }}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = "kanban" | "list";
type PageTab = "projects" | "catalog";

export function ProjectsPage() {
  const { projects, loading, error, stats, saveProject, deleteProject } = useProjects();
  const clients = useClientOptions();
  const squads = useSquadOptions();

  // Page tab
  const [pageTab, setPageTab] = useState<PageTab>("projects");

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [filterMomento, setFilterMomento] = useState<string>("");
  const [filterSquad, setFilterSquad] = useState<string>("");
  const [filterSetor, setFilterSetor] = useState<SetorId | "">("");
  const [showMomentoDropdown, setShowMomentoDropdown] = useState(false);
  const [showSquadDropdown, setShowSquadDropdown] = useState(false);

  // Modal state
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [editProject, setEditProject] = useState<Project | null | undefined>(undefined); // undefined = closed, null = new
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  // Unique squads from projects for filter
  const squadOptions = useMemo(() => {
    const names = new Set(projects.map((p) => p.squad_name).filter(Boolean));
    return Array.from(names).sort() as string[];
  }, [projects]);

  // Filtered projects
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.client_name ?? "").toLowerCase().includes(q) ||
        (p.squad_name ?? "").toLowerCase().includes(q);
      const matchMomento = !filterMomento || p.momento === filterMomento;
      const matchSquad = !filterSquad || p.squad_name === filterSquad;
      // Setor: verifica se algum produto do projeto pertence ao setor selecionado
      const matchSetor = !filterSetor || (() => {
        const setor = getProjectSetor(p);
        // Se não tem produto mapeado mas o setor é "executar", considera pelo MRR
        if (!setor && filterSetor === "executar" && (p.mrr ?? 0) > 0) return true;
        return setor === filterSetor;
      })();
      return matchSearch && matchMomento && matchSquad && matchSetor;
    });
  }, [projects, search, filterMomento, filterSquad, filterSetor]);

  // Stats dinâmicas baseadas no filtro atual
  const filteredStats = useMemo(() => {
    const activeFiltered = filtered.filter((p) => ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento));
    const churnedFiltered = filtered.filter((p) => !!p.churn_date);

    // Total de projetos (todos os do filtro atual)
    const totalProjetos = filtered.length;

    // Receita Total = soma de todas as fontes de receita de todos os projetos filtrados
    const receitaTotal = filtered.reduce((sum, p) =>
      sum + (p.mrr ?? 0) + (p.estruturacao_estrategica ?? 0) + (p.variavel ?? 0) + (p.investimento ?? 0), 0);

    // MRR Ativo = soma do MRR apenas dos projetos ativos (recorrente puro)
    const mrrAtivo = activeFiltered.reduce((sum, p) => sum + (p.mrr ?? 0), 0);

    // Churn Financeiro = soma do MRR dos projetos que já churnarom
    const churnFinanceiro = churnedFiltered.reduce((sum, p) => sum + (p.mrr ?? 0), 0);

    const setor = SETORES.find((s) => s.id === filterSetor);
    return {
      total: filtered.length,
      active: activeFiltered.length,
      totalProjetos,
      receitaTotal,
      mrrAtivo,
      churnFinanceiro,
      metricLabel: setor?.metricLabel ?? "MRR",
      byMomento: filtered.reduce<Record<string, number>>((acc, p) => {
        const m = p.momento ?? "";
        if (m) acc[m] = (acc[m] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }, [filtered, filterSetor]);

  // Kanban grouping
  const kanbanColumns = useMemo(() => {
    const active = ACTIVE_MOMENTOS.map((m) => ({
      title: m,
      projects: filtered.filter((p) => p.momento === m),
      isInactive: false,
    })).filter((col) => col.projects.length > 0); // oculta colunas ativas vazias
    const inactiveProjects = filtered.filter(
      (p) => !ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento)
    );
    // Só mostra coluna de inativos se tiver projetos
    if (inactiveProjects.length > 0) {
      return [
        ...active,
        { title: "Inativos / Encerrados", projects: inactiveProjects, isInactive: true },
      ];
    }
    return active;
  }, [filtered]);

  // Actions
  function openDetail(p: Project) {
    setDetailProject(p);
  }

  function openEdit(p: Project) {
    setDetailProject(null);
    setEditProject(p);
  }

  function openNew() {
    setEditProject(null);
  }

  function closeEdit() {
    setEditProject(undefined);
  }

  async function handleSave(data: ProjectFormData, id?: string) {
    await saveProject(data, id);
  }

  async function confirmDelete(p: Project) {
    await deleteProject(p.id);
    setDeleteConfirm(null);
  }

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-momento-dropdown]")) setShowMomentoDropdown(false);
      if (!t.closest("[data-squad-dropdown]")) setShowSquadDropdown(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-3 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Projetos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie projetos ativos, encerrados e o catálogo de produtos
          </p>
        </div>
        {pageTab === "projects" && (
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 py-2 text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            <Plus size={15} />
            Novo Projeto
          </button>
        )}
      </div>

      {/* ── Page Tabs ── */}
      <div className="flex-shrink-0 flex items-center gap-1 border-b border-border/40 pb-0">
        <button
          onClick={() => setPageTab("projects")}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            pageTab === "projects"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid size={14} />
          Projetos
        </button>
        <button
          onClick={() => setPageTab("catalog")}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            pageTab === "catalog"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package size={14} />
          Catálogo de Produtos
        </button>
      </div>

      {/* ── Catalog Tab ── */}
      {pageTab === "catalog" && <ProductCatalogTab />}

      {/* ── Projects Tab ── */}
      {pageTab === "projects" && <>

      {/* ── Stats ── */}
      <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard
          icon={<TrendingUp size={16} />}
          label="Total de Projetos"
          value={String(filteredStats.totalProjetos)}
          sub={`${filteredStats.active} ativos`}
          color="bg-green-500/15 text-green-500"
        />
        <StatCard
          icon={<DollarSign size={16} />}
          label="Receita Total"
          value={formatMRR(filteredStats.receitaTotal)}
          sub="todas as fontes"
          color="bg-blue-500/15 text-blue-500"
        />
        <StatCard
          icon={<Repeat size={16} />}
          label="MRR Ativo"
          value={formatMRR(filteredStats.mrrAtivo)}
          sub="só receita recorrente"
          color="bg-purple-500/15 text-purple-500"
        />
        <StatCard
          icon={<AlertTriangle size={16} />}
          label="Churn Financeiro"
          value={formatMRR(filteredStats.churnFinanceiro)}
          sub={`${filtered.filter(p => !!p.churn_date).length} projetos`}
          color="bg-red-500/15 text-red-500"
        />
      </div>

      {/* ── Setor quick filters ── */}
      <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-muted-foreground font-medium">Setor:</span>
        {SETORES.map((s) => (
          <button
            key={s.id}
            onClick={() => setFilterSetor(filterSetor === s.id ? "" : s.id)}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium transition-colors border ${
              filterSetor === s.id
                ? "border-transparent text-white"
                : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
            style={filterSetor === s.id ? { backgroundColor: s.color } : {}}
          >
            <span>{s.icon}</span>
            {s.label}
          </button>
        ))}
        {filterSetor && (
          <span className="text-[10px] text-muted-foreground ml-1">
            — mostrando {filteredStats.metricLabel.toLowerCase()} como métrica principal
          </span>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="w-full bg-secondary/40 border border-border/60 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40"
            placeholder="Buscar projetos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Momento filter */}
        <div className="relative" data-momento-dropdown>
          <button
            onClick={() => setShowMomentoDropdown((v) => !v)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              filterMomento
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary/40 border-border/60 text-foreground/70 hover:bg-secondary/60"
            }`}
          >
            {filterMomento ? filterMomento : "Momento"}
            <ChevronDown size={13} />
          </button>
          <AnimatePresence>
            {showMomentoDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute top-full mt-1 left-0 z-20 glass-strong rounded-xl shadow-xl min-w-[220px] py-1 border border-border/50"
              >
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 text-muted-foreground"
                  onClick={() => { setFilterMomento(""); setShowMomentoDropdown(false); }}
                >
                  Todos os momentos
                </button>
                {MOMENTO_LABELS.map((m) => (
                  <button
                    key={m}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 flex items-center justify-between ${
                      filterMomento === m ? "text-primary font-medium" : ""
                    }`}
                    onClick={() => { setFilterMomento(m); setShowMomentoDropdown(false); }}
                  >
                    <span>{m}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {projects.filter((p) => p.momento === m).length}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Squad filter */}
        {squadOptions.length > 0 && (
          <div className="relative" data-squad-dropdown>
            <button
              onClick={() => setShowSquadDropdown((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                filterSquad
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-secondary/40 border-border/60 text-foreground/70 hover:bg-secondary/60"
              }`}
            >
              {filterSquad || "Squad"}
              <ChevronDown size={13} />
            </button>
            <AnimatePresence>
              {showSquadDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1 left-0 z-20 glass-strong rounded-xl shadow-xl min-w-[160px] py-1 border border-border/50"
                >
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 text-muted-foreground"
                    onClick={() => { setFilterSquad(""); setShowSquadDropdown(false); }}
                  >
                    Todos os squads
                  </button>
                  {squadOptions.map((s) => (
                    <button
                      key={s}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 ${
                        filterSquad === s ? "text-primary font-medium" : ""
                      }`}
                      onClick={() => { setFilterSquad(s); setShowSquadDropdown(false); }}
                    >
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Active filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(filterMomento || filterSquad || search || filterSetor) && (
            <button
              onClick={() => { setSearch(""); setFilterMomento(""); setFilterSquad(""); setFilterSetor(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={11} />
              Limpar filtros
            </button>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Result count */}
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {filtered.length} {filtered.length === 1 ? "projeto" : "projetos"}
        </span>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5 border border-border/40">
          <button
            onClick={() => setViewMode("kanban")}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              viewMode === "kanban"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid size={14} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
              viewMode === "list"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {/* ── Loading / Error states ── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-border border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando projetos...</p>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="glass rounded-xl p-6 text-center max-w-sm">
            <AlertTriangle size={32} className="text-destructive mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">Erro ao carregar projetos</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {!loading && !error && (
        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            {viewMode === "kanban" ? (
              <motion.div
                key="kanban"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-x-auto overflow-y-hidden"
              >
                {kanbanColumns.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm font-medium mb-1">Nenhum projeto encontrado</p>
                      <p className="text-xs opacity-60">Tente ajustar os filtros</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 h-full pb-2 px-0.5" style={{ minWidth: "max-content" }}>
                    {kanbanColumns.map((col) => (
                      <div key={col.title} className="flex flex-col h-full overflow-y-auto">
                        <KanbanColumn
                          title={col.title}
                          projects={col.projects}
                          filterSetor={filterSetor}
                          isInactive={col.isInactive}
                          onCardClick={openDetail}
                          onEdit={openEdit}
                          onDelete={(p) => setDeleteConfirm(p)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full overflow-y-auto pr-0.5"
              >
                <ListView
                  projects={filtered}
                  onRowClick={openDetail}
                  onEdit={openEdit}
                  onDelete={(p) => setDeleteConfirm(p)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailProject && (
        <DetailModal
          project={detailProject}
          onClose={() => setDetailProject(null)}
          onEdit={() => openEdit(detailProject)}
        />
      )}

      {/* ── Form Modal ── */}
      {editProject !== undefined && (
        <FormModal
          project={editProject}
          onClose={closeEdit}
          onSave={handleSave}
          clients={clients}
          squads={squads}
        />
      )}

      {/* ── Delete Confirm ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
            <motion.div
              className="relative z-10 glass-strong rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 size={18} className="text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Excluir projeto</p>
                  <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Tem certeza que deseja excluir o projeto{" "}
                <span className="font-semibold text-foreground">{deleteConfirm.name}</span>?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/60 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => confirmDelete(deleteConfirm)}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </> /* end projects tab */}
    </div>
  );
}
