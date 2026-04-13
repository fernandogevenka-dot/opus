import { useState, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/store/appStore";
import {
  useProjects,
  MOMENTO_LABELS,
  ACTIVE_MOMENTOS,
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

/** Retorna o id do setor de um projeto.
 *  Prioridade: campo `step` (importado do NocoDB) > produtos mapeados */
function getProjectSetor(project: Project): SetorId | null {
  // 1. Usar campo step diretamente (vem do NocoDB)
  if (project.step) {
    const s = project.step.toLowerCase();
    if (s === "saber")         return "saber";
    if (s === "ter")           return "ter";
    if (s === "executar")      return "executar";
    if (s === "potencializar") return "potencializar";
  }
  // 2. Fallback: identificar via produtos cadastrados
  const produtos = project.produtos ?? [];
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
    return { bg: "bg-violet-500/10", text: "text-violet-600 dark:text-violet-400", border: "border-violet-500/20" };
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
      className={`glass rounded-xl p-3 cursor-pointer group relative flex flex-col h-[130px] border ${
        isAvisoPrevio ? "border-orange-400/40" : "border-border/30"
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

      {/* Row 1: setor badge + USA */}
      <div className="flex items-center gap-1 min-h-[16px]">
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
          <span className="text-[9px] font-semibold text-violet-500 bg-violet-500/10 border border-violet-500/20 rounded px-1 py-0.5">
            🇺🇸
          </span>
        )}
        {/* Risco badge no topo direito (quando sem actions) */}
        {!showActions && project.risco && project.risco !== "Baixo" && project.risco !== "baixo" && (
          <span className="ml-auto">
            <RiscoBadge risco={project.risco} />
          </span>
        )}
      </div>

      {/* Row 2: Project name */}
      <p className="text-sm font-semibold leading-snug mt-1 truncate pr-2">{project.name}</p>

      {/* Row 3: Client + Squad */}
      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
        {project.client_name ?? "—"}
        {project.squad_name && <> · {project.squad_name}</>}
      </p>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Row 4: métrica + produtos numa linha */}
      <div className="flex items-center gap-2 mt-1">
        {metric > 0 ? (
          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
            {formatMRR(metric)}
            {filterSetor && <span className="text-[9px] text-muted-foreground font-normal ml-0.5">{metricLabel}</span>}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/40">sem MRR</span>
        )}
        {project.produtos && project.produtos.length > 0 && (
          <div className="flex items-center gap-1 ml-auto">
            {project.produtos.slice(0, 1).map((p) => (
              <ProdutoChip key={p} name={p} />
            ))}
            {project.produtos.length > 1 && (
              <span className="text-[9px] text-muted-foreground">+{project.produtos.length - 1}</span>
            )}
          </div>
        )}
      </div>
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

// ─── Fases Kanban STEP ────────────────────────────────────────────────────────

export const FASES_TER: string[] = [
  "Onboarding",
  "Desenvolvimento Preview",
  "Apresentação do Preview",
  "Ajustes Preview",
  "Aprovação",
  "Desenvolvimento",
  "Revisão",
  "Apresentação Final",
  "Passar pra Hospedagem",
  "Concluído",
  "Cancelado / Jurídico",
];

export const FASES_SABER: string[] = [
  "00 - Aguardando / Follow-up",
  "01 - Onboarding",
  "02 - Diagnóstico de Criatividade",
  "03 - Diagnóstico Comercial",
  "04 - Estratégica de Mkt & Vendas",
  "05 - Entregáveis + Pitch",
  "Concluído - Em negociação",
  "Expansão (assinado)",
  "Hand-off",
  "Concluído - Finalizado",
  "Concluído - Churn",
  "Concluído - Reembolso",
  "Concluído - Venda bookada",
];

// ─── Status de ritmo Saber (replica fórmula Notion) ──────────────────────────

export interface SaberRitmoStatus {
  label: string;
  emoji: string;
  color: string;
  bg: string;
}

export function calcSaberRitmo(project: Project): SaberRitmoStatus | null {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const toDate = (s: string | null | undefined) => {
    if (!s) return null;
    const d = new Date(s);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  };

  const fimRealizado    = toDate(project.fim_realizado);
  const inicioRealizado = toDate(project.inicio_realizado);
  const inicioContrato  = toDate(project.start_date);
  const proximaEntrega  = toDate(project.proxima_entrega);
  const semanaAtual     = project.semana_atual ?? null;
  const semanaRitmo     = project.semana_ritmo ?? null;

  // 1. Churn m0: encerrou no mesmo dia que iniciou
  if (fimRealizado && inicioContrato && fimRealizado.getTime() === inicioContrato.getTime()) {
    return { label: "Churn m0", emoji: "💀", color: "#ef4444", bg: "#ef444418" };
  }

  // 2. Encerrado normalmente
  if (fimRealizado) return null;

  // 3. Projeto iniciado (inicio_realizado preenchido)
  if (inicioRealizado) {
    if (!proximaEntrega) {
      return { label: "Atenção à próxima entrega", emoji: "⚠️", color: "#f59e0b", bg: "#f59e0b18" };
    }
    const diasEntrega = Math.floor((proximaEntrega.getTime() - hoje.getTime()) / 86400000);
    if (diasEntrega < 0) {
      return { label: "Atenção à próxima entrega", emoji: "🚨", color: "#ef4444", bg: "#ef444418" };
    }
    if (diasEntrega <= 1) {
      return { label: "Se prepare para a próxima entrega", emoji: "🟠", color: "#f97316", bg: "#f9731618" };
    }
    // Semana atual vs ritmo
    if (semanaAtual !== null && semanaRitmo !== null) {
      if (semanaAtual > semanaRitmo)  return { label: "Atrasado",  emoji: "🔴", color: "#ef4444", bg: "#ef444418" };
      if (semanaAtual < semanaRitmo)  return { label: "Adiantado", emoji: "🔵", color: "#3b82f6", bg: "#3b82f618" };
      return { label: "No ritmo", emoji: "🟢", color: "#22c55e", bg: "#22c55e18" };
    }
    return null;
  }

  // 4. Projeto não iniciado ainda
  if (!inicioRealizado && inicioContrato) {
    const diasSemInicio = Math.floor((hoje.getTime() - inicioContrato.getTime()) / 86400000);
    if (diasSemInicio >= 0) {
      if (diasSemInicio >= 7) {
        return { label: "Sem onboarding +7d", emoji: "🚨", color: "#ef4444", bg: "#ef444418" };
      }
      return { label: "Bora agendar kickoff", emoji: "🔶", color: "#f59e0b", bg: "#f59e0b18" };
    }
  }

  // Sem dados suficientes para calcular
  if (semanaAtual !== null && semanaRitmo !== null) {
    if (semanaAtual > semanaRitmo)  return { label: "Atrasado",  emoji: "🔴", color: "#ef4444", bg: "#ef444418" };
    if (semanaAtual < semanaRitmo)  return { label: "Adiantado", emoji: "🔵", color: "#3b82f6", bg: "#3b82f618" };
    return { label: "No ritmo", emoji: "🟢", color: "#22c55e", bg: "#22c55e18" };
  }

  return null;
}

// Fases encerradas (não aparecem nas colunas ativas)
const TER_ENCERRADAS = new Set(["Concluído", "Cancelado / Jurídico"]);
const SABER_ENCERRADAS = new Set([
  "Concluído - Em negociação",
  "Expansão (assinado)",
  "Concluído - Finalizado",
  "Concluído - Churn",
  "Concluído - Reembolso",
  "Concluído - Venda bookada",
  "Hand-off",
]);

// Cor de destaque para a fase
function getFaseColor(fase: string | null | undefined, tipo: "ter" | "saber"): string {
  if (!fase) return "#6b7280";
  const encerradas = tipo === "ter" ? TER_ENCERRADAS : SABER_ENCERRADAS;
  if (encerradas.has(fase)) return "#6b7280";
  if (fase.includes("Concluído") || fase.includes("Aprovação")) return "#10b981";
  if (fase.includes("Apresentação") || fase.includes("Pitch") || fase.includes("Diagnóstico")) return "#f59e0b";
  if (fase.includes("Onboarding") || fase.includes("Aguardando")) return "#8b5cf6";
  if (fase.includes("Desenvolvimento") || fase.includes("Entregáveis")) return "#06b6d4";
  if (fase.includes("Ajustes") || fase.includes("Revisão")) return "#ef4444";
  if (fase.includes("Expansão") || fase.includes("Hand-off")) return "#22c55e";
  return "#6b7280";
}

// ─── Step Kanban Card ─────────────────────────────────────────────────────────

interface StepKanbanCardProps {
  project: Project;
  faseField: "fase_ter" | "fase_saber";
  fases: string[];
  tipo: "ter" | "saber";
  onFaseChange: (id: string, field: "fase_ter" | "fase_saber", value: string) => Promise<void>;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function StepKanbanCard({ project, faseField, fases, tipo, onFaseChange, onClick, onEdit, onDelete }: StepKanbanCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [changingFase, setChangingFase] = useState(false);
  const [saving, setSaving] = useState(false);
  const fase = project[faseField] ?? null;
  const faseColor = getFaseColor(fase, tipo);

  async function handleFaseChange(newFase: string) {
    setSaving(true);
    await onFaseChange(project.id, faseField, newFase);
    setSaving(false);
    setChangingFase(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="glass rounded-xl p-3 cursor-pointer group relative flex flex-col gap-2 border border-border/30"
      style={{ borderLeftWidth: 3, borderLeftColor: faseColor }}
      onClick={onClick}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setChangingFase(false); }}
    >
      {/* Actions overlay */}
      <AnimatePresence>
        {showActions && !changingFase && (
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

      {/* Project name */}
      <p className="text-sm font-semibold leading-snug truncate pr-8">{project.name}</p>

      {/* Client + Squad */}
      <p className="text-[11px] text-muted-foreground truncate">
        {project.client_name ?? "—"}
        {project.squad_name && <> · {project.squad_name}</>}
      </p>

      {/* Fase picker */}
      <div onClick={(e) => e.stopPropagation()}>
        {!changingFase ? (
          <button
            onClick={() => setChangingFase(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-medium transition-all hover:opacity-80 w-full"
            style={{
              color: faseColor,
              borderColor: faseColor + "40",
              backgroundColor: faseColor + "15",
            }}
            title="Clique para alterar fase"
          >
            {saving ? (
              <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: faseColor }} />
            )}
            <span className="truncate flex-1 text-left">{fase ?? "— sem fase —"}</span>
            <ChevronDown size={10} className="flex-shrink-0 opacity-60" />
          </button>
        ) : (
          <div className="relative">
            <select
              autoFocus
              className="w-full bg-background border border-primary/40 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
              defaultValue={fase ?? ""}
              onChange={(e) => handleFaseChange(e.target.value)}
              onBlur={() => setChangingFase(false)}
            >
              <option value="" disabled>Selecione a fase...</option>
              {fases.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Ritmo Saber + próxima entrega */}
      {tipo === "saber" && (() => {
        const ritmo = calcSaberRitmo(project);
        const proxEntrega = project.proxima_entrega;
        const semana = project.semana_atual != null && project.semana_ritmo != null
          ? `Semana ${project.semana_atual} de ${project.semana_ritmo}`
          : null;
        return (
          <div className="flex flex-col gap-1">
            {ritmo && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold w-fit"
                style={{ color: ritmo.color, backgroundColor: ritmo.bg }}
              >
                {ritmo.emoji} {ritmo.label}
              </span>
            )}
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {proxEntrega && (
                <span title="Próxima entrega">
                  📅 {new Date(proxEntrega).toLocaleDateString("pt-BR")}
                </span>
              )}
              {semana && <span>{semana}</span>}
            </div>
          </div>
        );
      })()}

      {/* MRR / Valor */}
      {(project.mrr ?? 0) > 0 && (
        <span className="text-[10px] font-semibold text-green-500">
          {formatMRR(project.mrr)} MRR
        </span>
      )}
    </motion.div>
  );
}

// ─── Step Kanban Column ───────────────────────────────────────────────────────

interface StepKanbanColumnProps {
  fase: string;
  projects: Project[];
  faseField: "fase_ter" | "fase_saber";
  fases: string[];
  tipo: "ter" | "saber";
  isEncerrada?: boolean;
  onFaseChange: (id: string, field: "fase_ter" | "fase_saber", value: string) => Promise<void>;
  onCardClick: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}

function StepKanbanColumn({ fase, projects, faseField, fases, tipo, isEncerrada, onFaseChange, onCardClick, onEdit, onDelete }: StepKanbanColumnProps) {
  const color = getFaseColor(fase, tipo);
  const totalMRR = projects.reduce((s, p) => s + (p.mrr ?? 0), 0);

  return (
    <div className="flex flex-col gap-2 min-w-[220px] w-[220px] flex-shrink-0">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span
            className={`text-xs font-semibold truncate max-w-[140px] ${isEncerrada ? "text-muted-foreground" : ""}`}
            style={isEncerrada ? undefined : { color }}
            title={fase}
          >
            {fase}
          </span>
          <span
            className="text-[10px] font-medium rounded-full px-1.5 py-0.5 border flex-shrink-0"
            style={{
              color,
              backgroundColor: color + "18",
              borderColor: color + "40",
            }}
          >
            {projects.length}
          </span>
        </div>
        {totalMRR > 0 && (
          <span className="text-[10px] text-muted-foreground font-medium">{formatMRR(totalMRR)}</span>
        )}
      </div>

      <div className="flex flex-col gap-2 flex-1 min-h-[60px]">
        <AnimatePresence mode="popLayout">
          {projects.map((p) => (
            <StepKanbanCard
              key={p.id}
              project={p}
              faseField={faseField}
              fases={fases}
              tipo={tipo}
              onFaseChange={onFaseChange}
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

// ─── Step Kanban Board ────────────────────────────────────────────────────────

interface StepKanbanBoardProps {
  projects: Project[];
  tipo: "ter" | "saber";
  onFaseChange: (id: string, field: "fase_ter" | "fase_saber", value: string) => Promise<void>;
  onCardClick: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}

export function StepKanbanBoard({ projects, tipo, onFaseChange, onCardClick, onEdit, onDelete }: StepKanbanBoardProps) {
  const fases = tipo === "ter" ? FASES_TER : FASES_SABER;
  const faseField: "fase_ter" | "fase_saber" = tipo === "ter" ? "fase_ter" : "fase_saber";
  const encerradas = tipo === "ter" ? TER_ENCERRADAS : SABER_ENCERRADAS;

  // Projetos sem fase atribuída
  const semFase = projects.filter((p) => !p[faseField]);

  // Colunas ativas (não encerradas) com projetos
  const activeCols = fases
    .filter((f) => !encerradas.has(f))
    .map((f) => ({ fase: f, projects: projects.filter((p) => p[faseField] === f) }))
    .filter((c) => c.projects.length > 0);

  // Colunas encerradas com projetos
  const encerradasCols = fases
    .filter((f) => encerradas.has(f))
    .map((f) => ({ fase: f, projects: projects.filter((p) => p[faseField] === f) }))
    .filter((c) => c.projects.length > 0);

  const [showEncerradas, setShowEncerradas] = useState(false);

  const allActiveCols = [
    ...(semFase.length > 0 ? [{ fase: "— Sem fase —", projects: semFase, isEncerrada: false }] : []),
    ...activeCols.map((c) => ({ ...c, isEncerrada: false })),
  ];

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Kanban ativo */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full pb-2 px-0.5" style={{ minWidth: "max-content" }}>
          {allActiveCols.map((col) => (
            <div key={col.fase} className="flex flex-col h-full overflow-y-auto">
              <StepKanbanColumn
                fase={col.fase}
                projects={col.projects}
                faseField={faseField}
                fases={fases}
                tipo={tipo}
                isEncerrada={col.isEncerrada}
                onFaseChange={onFaseChange}
                onCardClick={onCardClick}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          ))}
          {allActiveCols.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="text-sm font-medium mb-1">Nenhum projeto neste setor</p>
                <p className="text-xs opacity-60">Adicione projetos ou ajuste os filtros</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Encerrados toggle */}
      {encerradasCols.length > 0 && (
        <div className="flex-shrink-0">
          <button
            onClick={() => setShowEncerradas((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            {showEncerradas ? <ChevronDown size={12} /> : <ChevronDown size={12} className="-rotate-90" />}
            {encerradasCols.reduce((s, c) => s + c.projects.length, 0)} projeto(s) encerrado(s) / arquivado(s)
          </button>
          <AnimatePresence>
            {showEncerradas && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ minWidth: "max-content" }}>
                  {encerradasCols.map((col) => (
                    <StepKanbanColumn
                      key={col.fase}
                      fase={col.fase}
                      projects={col.projects}
                      faseField={faseField}
                      fases={fases}
                      tipo={tipo}
                      isEncerrada
                      onFaseChange={onFaseChange}
                      onCardClick={onCardClick}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
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
                      <span className="text-[10px] text-violet-500 font-medium">🇺🇸 USA</span>
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
                  <span className="text-xs font-semibold text-violet-500 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">
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
  const [prodSearch, setProdSearch] = useState("");
  const [prodCat, setProdCat]       = useState<string>("all");

  // Mapa produto → valor negociado (inicializado a partir do projeto existente)
  const [produtoValores, setProdutoValores] = useState<Record<string, number>>(() => {
    if (!project) return {};
    const map: Record<string, number> = {};
    const prods = project.produtos ?? [];
    // distribui mrr/investimento igualmente pelos produtos existentes como ponto de partida
    if (prods.length === 1) {
      const p = activeProducts.find((a) => a.name === prods[0]);
      if (p) map[prods[0]] = p.billing_type === "recurring" ? (project.mrr ?? 0) : (project.investimento ?? 0);
    }
    return map;
  });

  function set<K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleProduto(nome: string) {
    const cur = form.produtos ?? [];
    if (cur.includes(nome)) {
      set("produtos", cur.filter((x) => x !== nome));
      setProdutoValores((v) => { const next = { ...v }; delete next[nome]; return next; });
    } else {
      set("produtos", [...cur, nome]);
      // pré-preenche com preço padrão do catálogo
      const prod = activeProducts.find((p) => p.name === nome);
      if (prod && prod.default_price > 0) {
        setProdutoValores((v) => ({ ...v, [nome]: prod.default_price }));
      }
    }
  }

  function setProdutoValor(nome: string, valor: number) {
    setProdutoValores((v) => ({ ...v, [nome]: valor }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nome do projeto é obrigatório");
      return;
    }
    setSaving(true);
    setError(null);

    // Calcular mrr e investimento a partir dos valores por produto
    const selectedProds = form.produtos ?? [];
    let totalMrr = 0;
    let totalInv = 0;
    for (const nome of selectedProds) {
      const prod  = activeProducts.find((p) => p.name === nome);
      const valor = produtoValores[nome] ?? 0;
      if (prod?.billing_type === "recurring") totalMrr += valor;
      else totalInv += valor;
    }
    // Se não há produtos cadastrados no catálogo, usa os campos diretos do form
    const finalMrr = selectedProds.length > 0 && activeProducts.length > 0 ? (totalMrr || undefined) : form.mrr;
    const finalInv = selectedProds.length > 0 && activeProducts.length > 0 ? (totalInv || undefined) : form.investimento;

    try {
      await onSave({ ...form, mrr: finalMrr, investimento: finalInv }, project?.id);
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
                      ? "bg-violet-500 border-violet-500 text-white"
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
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-border/40">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Produtos do Projeto
                </h4>
                {(form.produtos ?? []).length > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {(form.produtos ?? []).length} selecionado{(form.produtos ?? []).length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Chips + totalizador dos produtos selecionados */}
              {(form.produtos ?? []).length > 0 && (() => {
                const selProds = form.produtos ?? [];
                let sumMrr = 0, sumInv = 0;
                for (const nome of selProds) {
                  const prod = activeProducts.find((p) => p.name === nome);
                  const val  = produtoValores[nome] ?? 0;
                  if (prod?.billing_type === "recurring") sumMrr += val;
                  else sumInv += val;
                }
                return (
                  <div className="mb-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {selProds.map((p) => (
                        <span
                          key={p}
                          className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium"
                        >
                          {p}
                          {produtoValores[p] ? (
                            <span className="text-primary/60 ml-0.5">{formatPrice(produtoValores[p])}</span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => toggleProduto(p)}
                            className="hover:text-red-400 transition-colors ml-0.5"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                    {(sumMrr > 0 || sumInv > 0) && (
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground px-1">
                        {sumMrr > 0 && <span>MRR: <strong className="text-foreground">{formatPrice(sumMrr)}/mês</strong></span>}
                        {sumInv > 0 && <span>One-time: <strong className="text-foreground">{formatPrice(sumInv)}</strong></span>}
                      </div>
                    )}
                  </div>
                );
              })()}

              {activeProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">
                  Nenhum produto no catálogo ainda.{" "}
                  <span className="text-primary">Cadastre produtos na aba "Catálogo de Produtos".</span>
                </p>
              ) : (
                <>
                  {/* Busca + filtro de categoria */}
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                      <input
                        type="text"
                        placeholder="Buscar produto..."
                        value={prodSearch}
                        onChange={(e) => setProdSearch(e.target.value)}
                        className="w-full pl-7 pr-3 py-1.5 text-xs bg-secondary/40 border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40"
                      />
                    </div>
                    <select
                      value={prodCat}
                      onChange={(e) => setProdCat(e.target.value)}
                      className="text-xs bg-secondary/40 border border-border/60 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50 text-muted-foreground"
                    >
                      <option value="all">Todas</option>
                      {PRODUCT_CATEGORIES.filter((cat) => activeProducts.some((p) => p.category === cat.id)).map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Lista filtrada */}
                  {(() => {
                    const q = prodSearch.toLowerCase().trim();
                    const visible = activeProducts.filter((p) => {
                      const matchCat = prodCat === "all" || p.category === prodCat;
                      const matchQ   = !q || p.name.toLowerCase().includes(q);
                      return matchCat && matchQ;
                    });
                    if (visible.length === 0) {
                      return <p className="text-xs text-muted-foreground/50 py-2 text-center">Nenhum produto encontrado</p>;
                    }
                    return (
                      <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
                        {visible.map((prod) => {
                          const checked      = (form.produtos ?? []).includes(prod.name);
                          const isRecurring  = prod.billing_type === "recurring";
                          return (
                            <div
                              key={prod.id}
                              className={`rounded-xl border transition-colors ${checked ? "border-primary/30 bg-primary/5" : "border-border/40 bg-secondary/20"}`}
                            >
                              <div className="flex items-center gap-2.5 px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => toggleProduto(prod.name)}
                                  className={`w-4 h-4 rounded flex items-center justify-center border transition-colors flex-shrink-0 ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border/60 bg-secondary/40"}`}
                                >
                                  {checked && <Check size={10} />}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium">{prod.name}</span>
                                    <span
                                      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                      style={{
                                        color: isRecurring ? "#22c55e" : "#f59e0b",
                                        backgroundColor: isRecurring ? "#22c55e18" : "#f59e0b18",
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
                                {checked && (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <span className="text-xs text-muted-foreground">R$</span>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      placeholder={String(prod.default_price || 0)}
                                      value={produtoValores[prod.name] ?? ""}
                                      onChange={(e) => setProdutoValor(prod.name, parseFloat(e.target.value) || 0)}
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
                    );
                  })()}
                </>
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
                      ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
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
        <div className="glass border border-violet-500/20 rounded-xl p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <ShoppingCart size={16} className="text-violet-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">One-time</p>
            <p className="text-lg font-bold text-violet-400">{onetime.length}</p>
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
              ? "bg-violet-500/15 border-violet-500/40 text-violet-400"
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
                        style={{ backgroundColor: product.billing_type === "recurring" ? "#22c55e18" : "#8b5cf618" }}
                      >
                        {product.billing_type === "recurring"
                          ? <Repeat size={14} className="text-green-400" />
                          : <ShoppingCart size={14} className="text-violet-400" />
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
                              color: product.billing_type === "recurring" ? "#22c55e" : "#a78bfa",
                              backgroundColor: product.billing_type === "recurring" ? "#22c55e18" : "#8b5cf618",
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
  const { projects, loading, error, stats, saveProject, deleteProject, updateFase } = useProjects();
  const clients = useClientOptions();
  const squads = useSquadOptions();

  // Sync filterSetor with sidebar store
  const { projectsSetor, setProjectsSetor } = useAppStore();

  // Page tab
  const [pageTab, setPageTab] = useState<PageTab>("projects");

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [search, setSearch] = useState("");
  const [filterMomento, setFilterMomento] = useState<string>("");
  const [filterSquad, setFilterSquad] = useState<string>("");
  const [filterDupla, setFilterDupla] = useState<string>("");
  // Inativos ocultos por padrão
  const [showInactive, setShowInactive] = useState(false);

  // filterSetor is driven by sidebar; local pills also write to the store
  const filterSetor = projectsSetor as SetorId | "";
  const setFilterSetor = (val: SetorId | "") => setProjectsSetor(val as import("@/store/appStore").ProjectsSetor);

  // Modal state
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [editProject, setEditProject] = useState<Project | null | undefined>(undefined); // undefined = closed, null = new
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  // Unique squads from projects for filter
  const squadOptions = useMemo(() => {
    const names = new Set(projects.map((p) => p.squad_name).filter(Boolean));
    return Array.from(names).sort() as string[];
  }, [projects]);

  // Conta inativos antes de filtrar (para exibir no toggle)
  const inactiveCount = useMemo(
    () => projects.filter((p) => !ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento)).length,
    [projects]
  );

  // Filtered projects
  const filtered = useMemo(() => {
    return projects.filter((p) => {
      // Oculta inativos/encerrados por padrão
      const isInative = !ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento);
      if (!showInactive && isInative) return false;

      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.client_name ?? "").toLowerCase().includes(q) ||
        (p.squad_name ?? "").toLowerCase().includes(q);
      const matchMomento = !filterMomento || p.momento === filterMomento;
      const matchSquad = !filterSquad || p.squad_name === filterSquad;
      const matchDupla = !filterDupla || p.gestor_projeto === filterDupla || p.gestor_trafego === filterDupla;
      // Setor: verifica se algum produto do projeto pertence ao setor selecionado
      const matchSetor = !filterSetor || (() => {
        const setor = getProjectSetor(p);
        // Se não tem produto mapeado mas o setor é "executar", considera pelo MRR
        if (!setor && filterSetor === "executar" && (p.mrr ?? 0) > 0) return true;
        return setor === filterSetor;
      })();
      return matchSearch && matchMomento && matchSquad && matchDupla && matchSetor;
    });
  }, [projects, search, filterMomento, filterSquad, filterDupla, filterSetor, showInactive]);

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


  // Duplas disponíveis (gestor_projeto)
  const duplaOptions = useMemo(() => {
    const names = new Set(projects.map((p) => p.gestor_projeto).filter(Boolean));
    return Array.from(names).sort() as string[];
  }, [projects]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ gap: "6px" }}>

      {/* ── Row 1: Header + Tabs + New button ── */}
      <div className="flex-shrink-0 flex items-center gap-3 min-h-0">
        {/* Page tabs */}
        <button
          onClick={() => setPageTab("projects")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border-b-2 transition-colors ${
            pageTab === "projects" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid size={14} />
          Projetos
        </button>
        <button
          onClick={() => setPageTab("catalog")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold border-b-2 transition-colors ${
            pageTab === "catalog" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Package size={14} />
          Catálogo
        </button>

        {/* STEP pills */}
        {pageTab === "projects" && (
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={() => setFilterSetor("")}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                filterSetor === "" ? "bg-foreground/10 border-foreground/20 text-foreground" : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos <span className="opacity-60">({projects.filter((p) => ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento)).length})</span>
            </button>
            {(["saber", "ter", "executar"] as const).map((sid) => {
              const s = SETORES.find((x) => x.id === sid)!;
              const count = projects.filter((p) => getProjectSetor(p) === sid).length;
              const isActive = filterSetor === sid;
              return (
                <button key={sid} onClick={() => setFilterSetor(isActive ? "" : sid)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${isActive ? "border-transparent text-white shadow-sm" : "border-border/40 text-muted-foreground hover:text-foreground"}`}
                  style={isActive ? { backgroundColor: s.color } : undefined}
                >
                  {s.label} <span className="opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1" />
        {pageTab === "projects" && (
          <button onClick={openNew}
            className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            <Plus size={13} />
            Novo Projeto
          </button>
        )}
      </div>

      {/* ── Catalog Tab ── */}
      {pageTab === "catalog" && <ProductCatalogTab />}

      {/* ── Projects Tab ── */}
      {pageTab === "projects" && <>

      {/* ── Row 2: Filtros em linha única ── */}
      <div className="flex-shrink-0 flex items-center gap-2">

        {/* Squad */}
        <div className="relative flex-1 min-w-0">
          <select value={filterSquad} onChange={(e) => setFilterSquad(e.target.value)}
            className="h-8 w-full px-3 rounded-xl border border-border/50 bg-background text-xs text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30 pr-7"
          >
            <option value="">Squad</option>
            {squadOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Etapa Jornada */}
        <div className="relative flex-1 min-w-0">
          <select value={filterMomento} onChange={(e) => setFilterMomento(e.target.value)}
            className="h-8 w-full px-3 rounded-xl border border-border/50 bg-background text-xs text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30 pr-7"
          >
            <option value="">Etapa Jornada</option>
            {MOMENTO_LABELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Dupla */}
        <div className="relative flex-1 min-w-0">
          <select value={filterDupla} onChange={(e) => setFilterDupla(e.target.value)}
            className="h-8 w-full px-3 rounded-xl border border-border/50 bg-background text-xs text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30 pr-7"
          >
            <option value="">Dupla</option>
            {duplaOptions.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Busca */}
        <div className="relative flex-1 min-w-0">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            className="h-8 w-full bg-background border border-border/50 rounded-xl pl-7 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X size={10} />
            </button>
          )}
        </div>

        {/* Toggle inativos */}
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={`flex items-center gap-1 h-8 px-2.5 rounded-xl border text-xs font-medium transition-all flex-shrink-0 ${
            showInactive ? "bg-secondary text-foreground border-border/80" : "border-border/50 text-muted-foreground hover:text-foreground"
          }`}
        >
          {showInactive ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          Inativos
          {inactiveCount > 0 && <span className="opacity-60">({inactiveCount})</span>}
        </button>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-background border border-border/50 rounded-xl p-0.5 h-8 flex-shrink-0">
          <button onClick={() => setViewMode("kanban")}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${viewMode === "kanban" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Kanban"
          >
            <LayoutGrid size={13} />
          </button>
          <button onClick={() => setViewMode("list")}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Lista"
          >
            <List size={13} />
          </button>
        </div>

        {/* Limpar filtros */}
        {(filterMomento || filterSquad || filterDupla || search || filterSetor) && (
          <button
            onClick={() => { setSearch(""); setFilterMomento(""); setFilterSquad(""); setFilterDupla(""); setFilterSetor(""); }}
            className="flex items-center gap-1 h-8 px-2 text-xs text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* ── Row 3: KPIs mini em linha ── */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-2">
        {[
          { label: "Projetos", value: filteredStats.totalProjetos, sub: `${filteredStats.active} ativos` },
          { label: "Receita Total", value: formatMRR(filteredStats.receitaTotal), sub: "todas as fontes" },
          { label: "MRR Ativo", value: formatMRR(filteredStats.mrrAtivo), sub: "recorrente" },
          { label: "Churn Financeiro", value: formatMRR(filteredStats.churnFinanceiro), sub: `${filtered.filter(p => !!p.churn_date).length} projetos` },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border/50 bg-background px-3 py-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">{kpi.label}</p>
              <p className="text-base font-bold tracking-tight leading-tight">{kpi.value}</p>
            </div>
            <p className="text-[10px] text-muted-foreground/60 text-right leading-tight">{kpi.sub}</p>
          </div>
        ))}
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
            {/* ── Step Kanban para Ter e Saber ── */}
            {viewMode === "kanban" && (filterSetor === "ter" || filterSetor === "saber") ? (
              <motion.div key={`step-kanban-${filterSetor}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                <StepKanbanBoard
                  projects={filtered}
                  tipo={filterSetor as "ter" | "saber"}
                  onFaseChange={updateFase}
                  onCardClick={openDetail}
                  onEdit={openEdit}
                  onDelete={(p) => setDeleteConfirm(p)}
                />
              </motion.div>
            ) : viewMode === "kanban" ? (
              <motion.div key="kanban" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
        <DetailModal project={detailProject} onClose={() => setDetailProject(null)} onEdit={() => openEdit(detailProject)} />
      )}

      {/* ── Form Modal ── */}
      {editProject !== undefined && (
        <FormModal project={editProject} onClose={closeEdit} onSave={handleSave} clients={clients} squads={squads} />
      )}

      {/* ── Delete Confirm ── */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
            <motion.div className="relative z-10 glass-strong rounded-2xl p-6 w-full max-w-sm shadow-2xl" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}>
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
                Tem certeza que deseja excluir <span className="font-semibold text-foreground">{deleteConfirm.name}</span>?
              </p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/60 transition-colors">
                  Cancelar
                </button>
                <button onClick={() => confirmDelete(deleteConfirm)} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors">
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
