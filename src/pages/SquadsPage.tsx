import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  TrendingUp,
  Plus,
  Edit2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Star,
  DollarSign,
  Layers,
  Shield,
  AlertCircle,
  Loader2,
  BarChart2,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useSquadsData, type Squad, type SquadMember, type SquadProjectDetail } from "@/hooks/useSquadsData";
import { useAuthStore } from "@/store/authStore";
import { useAppStore } from "@/store/appStore";
import { usePermissions } from "@/hooks/usePermissions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMRR(n: number | undefined | null): string {
  if (!n || n === 0) return "R$ 0";
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

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

function getInitials(name: string): string {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// ─── Squad color palette ───────────────────────────────────────────────────────

interface SquadColorConfig {
  bg: string;
  border: string;
  accent: string;
  avatarBg: string;
  avatarText: string;
  badge: string;
  badgeText: string;
  dot: string;
  headerGradient: string;
}

const SQUAD_PALETTE: SquadColorConfig[] = [
  {
    bg: "bg-violet-500/5",
    border: "border-violet-500/20",
    accent: "text-violet-400",
    avatarBg: "bg-violet-500/20",
    avatarText: "text-violet-300",
    badge: "bg-violet-500/15",
    badgeText: "text-violet-300",
    dot: "bg-violet-400",
    headerGradient: "from-violet-600/20 to-violet-500/5",
  },
  {
    bg: "bg-cyan-500/5",
    border: "border-cyan-500/20",
    accent: "text-cyan-400",
    avatarBg: "bg-cyan-500/20",
    avatarText: "text-cyan-300",
    badge: "bg-cyan-500/15",
    badgeText: "text-cyan-300",
    dot: "bg-cyan-400",
    headerGradient: "from-cyan-600/20 to-cyan-500/5",
  },
  {
    bg: "bg-orange-500/5",
    border: "border-orange-500/20",
    accent: "text-orange-400",
    avatarBg: "bg-orange-500/20",
    avatarText: "text-orange-300",
    badge: "bg-orange-500/15",
    badgeText: "text-orange-300",
    dot: "bg-orange-400",
    headerGradient: "from-orange-600/20 to-orange-500/5",
  },
  {
    bg: "bg-emerald-500/5",
    border: "border-emerald-500/20",
    accent: "text-emerald-400",
    avatarBg: "bg-emerald-500/20",
    avatarText: "text-emerald-300",
    badge: "bg-emerald-500/15",
    badgeText: "text-emerald-300",
    dot: "bg-emerald-400",
    headerGradient: "from-emerald-600/20 to-emerald-500/5",
  },
  {
    bg: "bg-rose-500/5",
    border: "border-rose-500/20",
    accent: "text-rose-400",
    avatarBg: "bg-rose-500/20",
    avatarText: "text-rose-300",
    badge: "bg-rose-500/15",
    badgeText: "text-rose-300",
    dot: "bg-rose-400",
    headerGradient: "from-rose-600/20 to-rose-500/5",
  },
  {
    bg: "bg-amber-500/5",
    border: "border-amber-500/20",
    accent: "text-amber-400",
    avatarBg: "bg-amber-500/20",
    avatarText: "text-amber-300",
    badge: "bg-amber-500/15",
    badgeText: "text-amber-300",
    dot: "bg-amber-400",
    headerGradient: "from-amber-600/20 to-amber-500/5",
  },
  {
    bg: "bg-sky-500/5",
    border: "border-sky-500/20",
    accent: "text-sky-400",
    avatarBg: "bg-sky-500/20",
    avatarText: "text-sky-300",
    badge: "bg-sky-500/15",
    badgeText: "text-sky-300",
    dot: "bg-sky-400",
    headerGradient: "from-sky-600/20 to-sky-500/5",
  },
  {
    bg: "bg-pink-500/5",
    border: "border-pink-500/20",
    accent: "text-pink-400",
    avatarBg: "bg-pink-500/20",
    avatarText: "text-pink-300",
    badge: "bg-pink-500/15",
    badgeText: "text-pink-300",
    dot: "bg-pink-400",
    headerGradient: "from-pink-600/20 to-pink-500/5",
  },
];

function getSquadColor(index: number): SquadColorConfig {
  return SQUAD_PALETTE[index % SQUAD_PALETTE.length];
}

// ─── Momento badge ────────────────────────────────────────────────────────────

interface MomentoBadgeProps {
  momento: string | undefined | null;
}

function MomentoBadge({ momento }: MomentoBadgeProps) {
  if (!momento) return null;

  let cls = "bg-muted/40 text-muted-foreground border-border/50";
  if (momento.includes("Ongoing")) cls = "bg-green-500/10 text-green-400 border-green-500/20";
  else if (momento.includes("Onboarding")) cls = "bg-blue-500/10 text-blue-400 border-blue-500/20";
  else if (momento.includes("Implementação")) cls = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  else if (momento.includes("Atrasado")) cls = "bg-red-500/10 text-red-400 border-red-500/20";
  else if (momento.includes("A Iniciar")) cls = "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {momento}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}

function StatCard({ icon, label, value, sub }: StatCardProps) {
  return (
    <div className="glass border border-border/50 rounded-xl p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-secondary/60 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Member Avatar ────────────────────────────────────────────────────────────

interface MemberAvatarProps {
  member: SquadMember;
  color: SquadColorConfig;
  size?: "sm" | "md" | "lg";
}

function MemberAvatar({ member, color, size = "md" }: MemberAvatarProps) {
  const sizeClass = size === "sm" ? "w-7 h-7 text-xs" : size === "lg" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs";
  const displayName = member.full_name || member.name;
  if (member.avatar_url) {
    return (
      <img
        src={member.avatar_url}
        alt={displayName}
        title={displayName}
        className={`${sizeClass} rounded-full object-cover shrink-0 ring-2 ring-background`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full ${color.avatarBg} ${color.avatarText} font-bold flex items-center justify-center shrink-0 ring-2 ring-background`}
      title={displayName}
    >
      {getInitials(displayName)}
    </div>
  );
}

// ─── Squad Card ───────────────────────────────────────────────────────────────

interface SquadCardProps {
  squad: Squad;
  colorIndex: number;
  onSelect: (squad: Squad) => void;
  onEdit: (squad: Squad) => void;
  isAdmin: boolean;
}

function SquadCard({ squad, colorIndex, onSelect, onEdit, isAdmin }: SquadCardProps) {
  const color = getSquadColor(colorIndex);
  const members = squad.members || [];
  const totalRemuneration = members.reduce((acc, m) => acc + (m.remuneration || 0), 0);

  // Margem estimada: MRR ativo × margem bruta média dos projetos − custo mensal do squad
  const activeProjects = (squad.projects || []).filter((p) =>
    ACTIVE_MOMENTOS_PAGE.includes(p.momento ?? "")
  );
  const avgMargemBruta = activeProjects.length > 0
    ? activeProjects.reduce((s, p) => s + (p.margem_bruta ?? 45), 0) / activeProjects.length
    : 45;
  const estimatedMargem = (squad.total_mrr ?? 0) * (avgMargemBruta / 100) - totalRemuneration;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
      className={`glass border ${color.border} rounded-2xl overflow-hidden flex flex-col cursor-pointer group transition-shadow hover:shadow-lg hover:shadow-black/20`}
      onClick={() => onSelect(squad)}
    >
      {/* Header gradient strip */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${color.headerGradient}`} />

      {/* Card body */}
      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl ${color.avatarBg} flex items-center justify-center shrink-0 overflow-hidden`}>
              {squad.avatar_url
                ? <img src={squad.avatar_url} alt={squad.name} className="w-full h-full object-cover" />
                : <Shield className={`w-5 h-5 ${color.avatarText}`} />
              }
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground truncate leading-tight">
                {squad.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {members.length} membro{members.length !== 1 ? "s" : ""}
                {(squad.project_count ?? 0) > 0 && (
                  <> · {squad.project_count} projeto{(squad.project_count ?? 0) !== 1 ? "s" : ""}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(squad);
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                title="Editar squad"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* MRR badge */}
        {(squad.total_mrr ?? 0) > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              {formatMRR(squad.total_mrr)}
              <span className="text-xs font-normal text-green-500/70">MRR</span>
            </span>
            {totalRemuneration > 0 && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border"
                style={{
                  color: estimatedMargem >= 0 ? "#22c55e" : "#ef4444",
                  backgroundColor: estimatedMargem >= 0 ? "#22c55e10" : "#ef444410",
                  borderColor: estimatedMargem >= 0 ? "#22c55e30" : "#ef444430",
                }}
              >
                {estimatedMargem >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {formatMRR(Math.abs(estimatedMargem))}
                <span className="font-normal opacity-70">margem</span>
              </span>
            )}
          </div>
        )}

        {/* Members list — scrollable, all members visible */}
        {members.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              Membros
            </p>
            <div className="overflow-y-auto max-h-52 flex flex-col gap-0.5 pr-0.5">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 py-1 px-1.5 rounded-lg hover:bg-secondary/40 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MemberAvatar member={member} color={color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">
                      {member.full_name || member.name}
                    </p>
                    {member.role && (
                      <p className="text-xs text-muted-foreground truncate">{member.role}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground/60 text-sm py-1">
            <Users className="w-4 h-4" />
            <span>Sem membros ativos</span>
          </div>
        )}

        {/* Footer: total remuneration */}
        {totalRemuneration > 0 && (
          <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Remuneração total</span>
            <span className="text-sm font-semibold text-foreground">{formatCurrency(totalRemuneration)}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

const ACTIVE_MOMENTOS_PAGE = ["♾️ Ongoing", "🛫 Onboarding", "⚙️ Implementação", "⏰ Atrasado", "⏳ A Iniciar", "⏳ Aviso Prévio"];

function calcProjectMonths(p: SquadProjectDetail, isActive: boolean): number {
  if (!p.start_date) return 1;
  const start = new Date(p.start_date);
  const end = isActive ? new Date() : (p.end_date ? new Date(p.end_date) : new Date());
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.44 * 86_400_000)));
}

interface DetailPanelProps {
  squad: Squad;
  colorIndex: number;
  onClose: () => void;
  onEdit: (squad: Squad) => void;
  isAdmin: boolean;
  onMemberClick: (member: SquadMember) => void;
}

function DetailPanel({ squad, colorIndex, onClose, onEdit, isAdmin, onMemberClick }: DetailPanelProps) {
  const color = getSquadColor(colorIndex);
  const members = squad.members || [];
  const totalRemuneration = members.reduce((acc, m) => acc + (m.remuneration || 0), 0);
  const squadProjects = squad.projects || [];

  return (
    <motion.div
      key="detail-panel"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col glass border-l border-border/60 shadow-2xl overflow-hidden"
    >
      {/* Overlay for mobile backdrop */}
      <div
        className="fixed inset-0 -z-10 bg-background/60 backdrop-blur-sm md:hidden"
        onClick={onClose}
      />

      {/* Header */}
      <div className={`bg-gradient-to-br ${color.headerGradient} px-6 pt-6 pb-5 border-b border-border/40`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl ${color.avatarBg} flex items-center justify-center shrink-0 overflow-hidden`}>
              {squad.avatar_url
                ? <img src={squad.avatar_url} alt={squad.name} className="w-full h-full object-cover" />
                : <Shield className={`w-6 h-6 ${color.avatarText}`} />
              }
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{squad.name}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {members.length} membro{members.length !== 1 ? "s" : ""}
                {(squad.project_count ?? 0) > 0 && (
                  <> · {squad.project_count} projeto{(squad.project_count ?? 0) !== 1 ? "s" : ""}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                onClick={() => onEdit(squad)}
                className="p-2 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                title="Editar squad"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="mt-4 flex flex-wrap gap-3">
          {(squad.total_mrr ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-semibold">
              <TrendingUp className="w-3.5 h-3.5" />
              {formatMRR(squad.total_mrr)} MRR
            </div>
          )}
          {totalRemuneration > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/60 border border-border/40 text-foreground text-sm font-medium">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              {formatCurrency(totalRemuneration)}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Members section */}
        <section>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Membros ({members.length})
          </h3>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhum membro ativo encontrado.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => onMemberClick(member)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/40 hover:bg-secondary/50 hover:border-primary/30 transition-colors group text-left"
                >
                  <MemberAvatar member={member} color={color} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {member.full_name || member.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      {member.role && (
                        <span className="text-xs text-muted-foreground">{member.role}</span>
                      )}
                      {member.seniority && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground">{member.seniority}</span>
                        </>
                      )}
                      {member.area && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-md ${color.badge} ${color.badgeText}`}>
                            {member.area}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {member.remuneration != null && member.remuneration > 0 && (
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">Remuneração</p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatCurrency(member.remuneration)}
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Projetos + Margem de Contribuição ── */}
        {squadProjects.length > 0 && (() => {
          const activeProjs = squadProjects.filter((p) => ACTIVE_MOMENTOS_PAGE.includes(p.momento ?? ""));
          const encerradoProjs = squadProjects.filter((p) => !ACTIVE_MOMENTOS_PAGE.includes(p.momento ?? ""));
          const activeCount = activeProjs.length || 1; // evita divisão por zero

          // Custo do squad rateado por projeto ativo
          const custoMensalPorProjeto = totalRemuneration / activeCount;

          // Margem por projeto
          function projectMargin(p: SquadProjectDetail): {
            isAtivo: boolean; meses: number; receita: number;
            custoServir: number; margem: number; margemPct: number;
          } {
            const isAtivo = ACTIVE_MOMENTOS_PAGE.includes(p.momento ?? "");
            const meses = calcProjectMonths(p, isAtivo);
            // Receita: recorrente acumula por meses, one-time o mrr já é o valor total do contrato
            const receita = isAtivo ? (p.mrr ?? 0) * meses : (p.mrr ?? 0);
            // Margem bruta do projeto (%) → custo de servir como % da receita
            const margemPct = p.margem_bruta != null ? p.margem_bruta / 100 : 0.45;
            const custoServir = isAtivo
              ? custoMensalPorProjeto * meses   // custo rateado pelos meses ativos
              : custoMensalPorProjeto;           // custo de um mês de alocação para one-time
            const margem = receita * margemPct - custoServir;
            return { isAtivo, meses, receita, custoServir, margem, margemPct };
          }

          const allWithMargin = squadProjects.map((p) => ({ p, ...projectMargin(p) }));
          const totalMargemSquad = allWithMargin.reduce((s, x) => s + x.margem, 0);
          const totalReceita = allWithMargin.reduce((s, x) => s + x.receita, 0);
          const margemPctSquad = totalReceita > 0 ? (totalMargemSquad / totalReceita) * 100 : 0;

          return (
            <section className="space-y-4">
              {/* Header com sumário de margem do squad */}
              <div className="rounded-xl border border-border/40 bg-secondary/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-muted-foreground" />
                    Margem de Contribuição — Squad
                  </h3>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{
                      color: totalMargemSquad >= 0 ? "#22c55e" : "#ef4444",
                      backgroundColor: totalMargemSquad >= 0 ? "#22c55e18" : "#ef444418",
                    }}
                  >
                    {totalMargemSquad >= 0 ? "Positiva" : "Negativa"}
                  </span>
                </div>
                <div className="grid grid-cols-3 divide-x divide-border/30">
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-muted-foreground">Receita total</p>
                    <p className="text-base font-bold mt-0.5">{formatCurrency(totalReceita)}</p>
                    <p className="text-[9px] text-muted-foreground/50 mt-0.5">{squadProjects.length} projetos</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-muted-foreground">Custo do squad</p>
                    <p className="text-base font-bold mt-0.5 text-red-400">{formatCurrency(totalRemuneration)}</p>
                    <p className="text-[9px] text-muted-foreground/50 mt-0.5">/mês remuneração</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-muted-foreground">Margem líquida</p>
                    <p
                      className="text-base font-bold mt-0.5"
                      style={{ color: totalMargemSquad >= 0 ? "#22c55e" : "#ef4444" }}
                    >
                      {formatCurrency(totalMargemSquad)}
                    </p>
                    <p className="text-[9px] mt-0.5" style={{ color: totalMargemSquad >= 0 ? "#22c55e80" : "#ef444480" }}>
                      {margemPctSquad.toFixed(1)}% s/ receita
                    </p>
                  </div>
                </div>
                {totalRemuneration > 0 && activeCount > 0 && (
                  <div className="px-4 py-2 border-t border-border/20 bg-secondary/10">
                    <p className="text-[10px] text-muted-foreground">
                      Rateio: {formatCurrency(custoMensalPorProjeto)}/mês por projeto ativo ({activeCount} projeto{activeCount !== 1 ? "s" : ""} · {members.length} membro{members.length !== 1 ? "s" : ""})
                    </p>
                  </div>
                )}
              </div>

              {/* Lista de projetos com margem */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Projetos ({squadProjects.length})
                </p>
                <div className="space-y-2">
                  {allWithMargin.map(({ p, isAtivo, meses, receita, margem }) => (
                    <div
                      key={p.id}
                      className="p-3 rounded-xl bg-secondary/30 border border-border/40"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg ${color.avatarBg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <Briefcase className={`w-4 h-4 ${color.avatarText}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                            <span
                              className="text-xs font-semibold shrink-0 flex items-center gap-1"
                              style={{ color: margem >= 0 ? "#22c55e" : "#ef4444" }}
                            >
                              {margem >= 0
                                ? <TrendingUp className="w-3 h-3" />
                                : <TrendingDown className="w-3 h-3" />}
                              {formatCurrency(Math.abs(margem))}
                            </span>
                          </div>
                          {p.client_name && (
                            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.client_name}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            {p.momento && <MomentoBadge momento={p.momento} />}
                            <span className="text-[10px] text-muted-foreground">
                              {meses}m · {formatCurrency(receita)} receita
                            </span>
                            {p.mrr != null && p.mrr > 0 && (
                              <span className="text-[10px] text-green-500/70">
                                {isAtivo ? "rec." : "one-time"} {formatMRR(p.mrr)}{isAtivo ? "/mês" : " total"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          );
        })()}
      </div>
    </motion.div>
  );
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

interface SquadModalProps {
  initial?: Squad | null;
  onSave: (name: string, id?: string, avatar_url?: string | null) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
}

function SquadModal({ initial, onSave, onDelete, onClose }: SquadModalProps) {
  const [name, setName]         = useState(initial?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string>(initial?.avatar_url ?? "");
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("O nome do squad não pode ser vazio."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave(trimmed, initial?.id, avatarUrl.trim() || null);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao salvar squad.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial?.id || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(initial.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao excluir squad.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const inp = "w-full bg-secondary/40 border border-border/60 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition";

  return (
    <motion.div
      key="squad-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="glass border border-border/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">
            {initial ? "Editar Squad" : "Novo Squad"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar preview + URL */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-secondary/60 border border-border/40 flex items-center justify-center shrink-0 overflow-hidden">
              {avatarUrl.trim()
                ? <img src={avatarUrl.trim()} alt="preview" className="w-full h-full object-cover" onError={() => setAvatarUrl("")} />
                : <Shield className="w-7 h-7 text-muted-foreground/40" />
              }
            </div>
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-muted-foreground mb-1">Foto do squad (URL)</label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className={inp}
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nome do Squad</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="Ex: Squad Alpha"
              className={inp}
            />
            {error && (
              <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            {initial && onDelete && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting}
                className="px-3 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors disabled:opacity-40"
                title="Excluir squad"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {confirmDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Confirmar exclusão
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || deleting || !name.trim()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Salvando…</>
              ) : (
                <><Check className="w-3.5 h-3.5" />{initial ? "Salvar" : "Criar Squad"}</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onNew: () => void;
  isAdmin: boolean;
}

function EmptyState({ onNew, isAdmin }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-secondary/60 flex items-center justify-center mb-5">
        <Shield className="w-10 h-10 text-muted-foreground/50" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum squad encontrado</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Squads organizam os membros da equipe em grupos de trabalho focados em projetos.
      </p>
      {isAdmin && (
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Criar primeiro Squad
        </button>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SquadsPage() {
  const { user } = useAuthStore();
  const { navigateToProfile } = useAppStore();
  const { squads, loading, error, totalMRR, totalMembers, saveSquad, deleteSquad } = useSquadsData();
  const permissions = usePermissions();

  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const [editingSquad, setEditingSquad] = useState<Squad | null | undefined>(undefined);
  // undefined = modal closed, null = creating new, Squad = editing existing

  const isAdmin = permissions.gerenciar_squads;

  // Color index map: stable by squad id
  const colorIndexMap = useMemo(() => {
    const map: Record<string, number> = {};
    squads.forEach((sq, i) => {
      map[sq.id] = i;
    });
    return map;
  }, [squads]);

  function handleSelectSquad(squad: Squad) {
    setSelectedSquad((prev) => (prev?.id === squad.id ? null : squad));
  }

  function handleEditSquad(squad: Squad) {
    setEditingSquad(squad);
  }

  function handleNewSquad() {
    setEditingSquad(null);
  }

  function handleCloseModal() {
    setEditingSquad(undefined);
  }

  function handleCloseDetail() {
    setSelectedSquad(null);
  }

  // Margem consolidada de todos os squads
  const totalRemuneracao = useMemo(() =>
    squads.reduce((s, sq) => s + (sq.members || []).reduce((ms, m) => ms + (m.remuneration || 0), 0), 0),
    [squads]
  );
  const totalMargemEstimada = useMemo(() => {
    return squads.reduce((s, sq) => {
      const activeProjs = (sq.projects || []).filter((p) => ACTIVE_MOMENTOS_PAGE.includes(p.momento ?? ""));
      const avgMargem = activeProjs.length > 0
        ? activeProjs.reduce((ms, p) => ms + (p.margem_bruta ?? 45), 0) / activeProjs.length
        : 45;
      const remuneracao = (sq.members || []).reduce((ms, m) => ms + (m.remuneration || 0), 0);
      return s + (sq.total_mrr ?? 0) * (avgMargem / 100) - remuneracao;
    }, 0);
  }, [squads]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Squads</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Estrutura de times, membros e receita sob gestão
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={handleNewSquad}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors self-start shrink-0"
            >
              <Plus className="w-4 h-4" />
              Novo Squad
            </button>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Shield className="w-5 h-5 text-violet-400" />}
            label="Total de Squads"
            value={loading ? "—" : String(squads.length)}
          />
          <StatCard
            icon={<Users className="w-5 h-5 text-cyan-400" />}
            label="Total Membros Ativos"
            value={loading ? "—" : String(totalMembers)}
            sub={totalRemuneracao > 0 ? `Custo: ${formatMRR(totalRemuneracao)}/mês` : undefined}
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-green-400" />}
            label="Total MRR sob gestão"
            value={loading ? "—" : formatMRR(totalMRR)}
            sub={totalMRR > 0 ? `${squads.filter((s) => (s.total_mrr ?? 0) > 0).length} squads com projetos ativos` : undefined}
          />
          <StatCard
            icon={<BarChart2 className={`w-5 h-5 ${totalMargemEstimada >= 0 ? "text-emerald-400" : "text-red-400"}`} />}
            label="Margem estimada (MRR)"
            value={loading ? "—" : formatMRR(Math.abs(totalMargemEstimada))}
            sub={loading ? undefined : totalMargemEstimada >= 0 ? "Positiva — após remunerações" : "Negativa — após remunerações"}
          />
        </div>

        {/* ── Error banner ── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="glass border border-border/40 rounded-2xl p-5 space-y-4 animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/60" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-24 rounded bg-secondary/60" />
                    <div className="h-3 w-16 rounded bg-secondary/40" />
                  </div>
                </div>
                <div className="h-7 w-28 rounded-lg bg-secondary/40" />
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-secondary/60" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-20 rounded bg-secondary/60" />
                        <div className="h-2.5 w-14 rounded bg-secondary/40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Squads grid ── */}
        {!loading && squads.length === 0 && (
          <EmptyState onNew={handleNewSquad} isAdmin={isAdmin} />
        )}

        {!loading && squads.length > 0 && (
          <motion.div
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            <AnimatePresence mode="popLayout">
              {squads.map((squad) => (
                <SquadCard
                  key={squad.id}
                  squad={squad}
                  colorIndex={colorIndexMap[squad.id] ?? 0}
                  onSelect={handleSelectSquad}
                  onEdit={handleEditSquad}
                  isAdmin={isAdmin}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Detail panel ── */}
      <AnimatePresence>
        {selectedSquad && (
          <>
            {/* Desktop backdrop (subtle) */}
            <motion.div
              key="detail-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 hidden md:block bg-background/40 backdrop-blur-[2px]"
              onClick={handleCloseDetail}
            />
            <DetailPanel
              squad={selectedSquad}
              colorIndex={colorIndexMap[selectedSquad.id] ?? 0}
              onClose={handleCloseDetail}
              onEdit={handleEditSquad}
              isAdmin={isAdmin}
              onMemberClick={(member) => {
                const profileId = member.user_id || member.id;
                handleCloseDetail();
                navigateToProfile(profileId);
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Add / Edit modal ── */}
      <AnimatePresence>
        {editingSquad !== undefined && (
          <SquadModal
            key="squad-modal"
            initial={editingSquad}
            onSave={saveSquad}
            onDelete={editingSquad ? deleteSquad : undefined}
            onClose={handleCloseModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default SquadsPage;
