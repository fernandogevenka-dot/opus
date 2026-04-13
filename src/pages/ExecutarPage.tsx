import { useState, useMemo } from "react";
import { useProjects, ACTIVE_MOMENTOS, type Project, type ProjectMomento } from "@/hooks/useProjects";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Search, X, Settings, DollarSign, TrendingDown,
  Clock, Users, ChevronDown, Loader2, Edit2, Trash2,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMRR(n: number | undefined | null): string {
  if (!n || n === 0) return "—";
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

function formatDate(d: string | undefined | null): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("pt-BR"); }
  catch { return d; }
}

// ─── Momento badge ─────────────────────────────────────────────────────────────

const MOMENTO_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  "⏳ A Iniciar":          { color: "#06b6d4", bg: "#06b6d418", border: "#06b6d440" },
  "🛫 Onboarding":         { color: "#8b5cf6", bg: "#8b5cf618", border: "#8b5cf640" },
  "⚙️ Implementação":      { color: "#f59e0b", bg: "#f59e0b18", border: "#f59e0b40" },
  "♾️ Ongoing":            { color: "#22c55e", bg: "#22c55e18", border: "#22c55e40" },
  "⏳ Aviso Prévio":       { color: "#f97316", bg: "#f9731618", border: "#f9731640" },
  "💲 Pausado - Financeiro":{ color: "#ef4444", bg: "#ef444418", border: "#ef444440" },
};

function MomentoBadge({ momento }: { momento: string | undefined | null }) {
  const cfg = MOMENTO_CONFIG[momento ?? ""] ?? { color: "#6b7280", bg: "#6b728018", border: "#6b728040" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border"
      style={{ color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border }}
    >
      {momento ?? "—"}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, icon, alert,
}: {
  label: string; value: string | number; sub?: string; color?: string;
  icon?: React.ReactNode; alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-background shadow-sm px-5 py-4 flex flex-col gap-1 ${
        alert ? "border-orange-500/30" : "border-border/50"
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-2xl font-bold tracking-tight" style={color ? { color } : undefined}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground/60">{sub}</span>}
    </div>
  );
}

// ─── Project Row ──────────────────────────────────────────────────────────────

function ProjectRow({
  project,
  onClick,
  onEdit,
  onDelete,
}: {
  project: Project;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isAvisoPrevio = project.momento === "⏳ Aviso Prévio";
  const isPausado = project.momento === "💲 Pausado - Financeiro";

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`border-b border-border/30 hover:bg-secondary/30 cursor-pointer transition-colors ${
        isAvisoPrevio ? "bg-orange-500/5" : isPausado ? "bg-red-500/5" : ""
      }`}
      onClick={onClick}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {(isAvisoPrevio || isPausado) && (
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAvisoPrevio ? "bg-orange-400" : "bg-red-400"}`} />
          )}
          <div>
            <p className="text-sm font-medium leading-tight truncate max-w-[200px]">{project.name}</p>
            <p className="text-[11px] text-muted-foreground">{project.client_name ?? "—"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <MomentoBadge momento={project.momento} />
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
        {formatMRR(project.mrr)}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[120px]">
        {project.gestor_projeto ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[120px]">
        {project.gestor_trafego ?? "—"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {formatDate(project.start_date)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className="w-7 h-7 rounded-lg hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors text-muted-foreground"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition-colors text-muted-foreground"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Squad Group ──────────────────────────────────────────────────────────────

function SquadGroup({
  squadName,
  projects,
  defaultExpanded,
  onRowClick,
  onEdit,
  onDelete,
}: {
  squadName: string;
  projects: Project[];
  defaultExpanded: boolean;
  onRowClick: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const totalMRR = projects.reduce((s, p) => s + (p.mrr ?? 0), 0);
  const avisos = projects.filter((p) => p.momento === "⏳ Aviso Prévio").length;
  const pausados = projects.filter((p) => p.momento === "💲 Pausado - Financeiro").length;

  return (
    <div className="rounded-2xl border border-border/50 bg-background shadow-sm overflow-hidden">
      {/* Squad header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-secondary/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`} />
        <span className="text-sm font-semibold flex-1 text-left">{squadName || "Sem squad"}</span>
        <div className="flex items-center gap-3 flex-shrink-0">
          {avisos > 0 && (
            <span className="text-[10px] font-semibold text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded-full px-2 py-0.5">
              {avisos} aviso{avisos > 1 ? "s" : ""} prévio{avisos > 1 ? "s" : ""}
            </span>
          )}
          {pausados > 0 && (
            <span className="text-[10px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20 rounded-full px-2 py-0.5">
              {pausados} pausado{pausados > 1 ? "s" : ""}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{projects.length} projeto{projects.length !== 1 ? "s" : ""}</span>
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">{formatMRR(totalMRR)}</span>
        </div>
      </button>

      {/* Table */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <table className="w-full text-sm border-t border-border/40">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/20">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Projeto / Cliente</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Momento</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">MRR</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Gestor Projeto</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Gestor Tráfego</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">Início</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {projects.map((p) => (
                    <ProjectRow
                      key={p.id}
                      project={p}
                      onClick={() => onRowClick(p)}
                      onEdit={() => onEdit(p)}
                      onDelete={() => onDelete(p)}
                    />
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Ordem de exibição dos momentos no Executar
const MOMENTO_ORDER = [
  "⏳ Aviso Prévio",
  "💲 Pausado - Financeiro",
  "⏳ A Iniciar",
  "🛫 Onboarding",
  "⚙️ Implementação",
  "♾️ Ongoing",
];

export function ExecutarPage() {
  const { projects, loading, error } = useProjects();
  const [search, setSearch] = useState("");
  const [filterSquad, setFilterSquad] = useState("");
  const [filterMomento, setFilterMomento] = useState("");
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [editProject, setEditProject] = useState<Project | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  // Projetos Executar — step="executar" OU squads Spartans / Templários (não Saber, não JARVIS)
  const executarProjects = useMemo(() => {
    return projects.filter((p) => {
      const squad = (p.squad_name ?? "").toLowerCase();
      const isExecutarStep = p.step === "executar";
      const isExecutarSquad =
        !squad.includes("saber") &&
        !squad.includes("jarvis") &&
        (squad.includes("spartan") || squad.includes("templário") || squad.includes("templario"));
      return (isExecutarStep || isExecutarSquad) && ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento);
    });
  }, [projects]);

  // Squads
  const squadOptions = useMemo(() => {
    const names = new Set(executarProjects.map((p) => p.squad_name).filter(Boolean));
    return Array.from(names).sort() as string[];
  }, [executarProjects]);

  // Filtrados
  const filtered = useMemo(() => {
    return executarProjects.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.client_name ?? "").toLowerCase().includes(q);
      const matchSquad = !filterSquad || p.squad_name === filterSquad;
      const matchMomento = !filterMomento || p.momento === filterMomento;
      return matchSearch && matchSquad && matchMomento;
    });
  }, [executarProjects, search, filterSquad, filterMomento]);

  // KPIs
  const kpis = useMemo(() => {
    const mrrAtivo = filtered.reduce((s, p) => s + (p.mrr ?? 0), 0);
    const avisosPrevios = filtered.filter((p) => p.momento === "⏳ Aviso Prévio");
    const mrrEmRisco = avisosPrevios.reduce((s, p) => s + (p.mrr ?? 0), 0);
    const pausados = filtered.filter((p) => p.momento === "💲 Pausado - Financeiro").length;
    const onboarding = filtered.filter((p) => p.momento === "🛫 Onboarding").length;
    return {
      total: filtered.length,
      mrrAtivo,
      avisosPrevios: avisosPrevios.length,
      mrrEmRisco,
      pausados,
      onboarding,
    };
  }, [filtered]);

  // Agrupamento por squad
  const bySquad = useMemo(() => {
    const map = new Map<string, Project[]>();
    for (const p of filtered) {
      const key = p.squad_name ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Ordenar projetos dentro de cada squad pelo momento
    for (const [, projs] of map) {
      projs.sort((a, b) => {
        const ai = MOMENTO_ORDER.indexOf(a.momento ?? "");
        const bi = MOMENTO_ORDER.indexOf(b.momento ?? "");
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    }
    return map;
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando projetos Executar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="glass rounded-xl p-6 text-center max-w-sm">
          <AlertTriangle size={32} className="text-destructive mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">Erro ao carregar</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#22c55e18" }}>
            <Settings size={18} style={{ color: "#22c55e" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Executar</h1>
            <p className="text-xs text-muted-foreground">Gestão recorrente — Spartans & Templários</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          {squadOptions.length > 1 && (
            <select
              value={filterSquad}
              onChange={(e) => setFilterSquad(e.target.value)}
              className="h-9 bg-background border border-border/50 rounded-xl px-3 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              <option value="">Todos os squads</option>
              {squadOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select
            value={filterMomento}
            onChange={(e) => setFilterMomento(e.target.value)}
            className="h-9 bg-background border border-border/50 rounded-xl px-3 text-sm text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="">Todos os momentos</option>
            {MOMENTO_ORDER.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              className="h-9 w-44 bg-background border border-border/50 rounded-xl pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={11} />
              </button>
            )}
          </div>
          {(search || filterSquad || filterMomento) && (
            <button
              onClick={() => { setSearch(""); setFilterSquad(""); setFilterMomento(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={11} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="flex-shrink-0 grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label="MRR Ativo"
          value={formatMRR(kpis.mrrAtivo)}
          sub={`${kpis.total} projetos ativos`}
          color="#22c55e"
          icon={<DollarSign size={12} />}
        />
        <KpiCard
          label="Avisos Prévios"
          value={kpis.avisosPrevios}
          sub={`${formatMRR(kpis.mrrEmRisco)} em risco`}
          color={kpis.avisosPrevios > 0 ? "#f97316" : undefined}
          alert={kpis.avisosPrevios > 0}
          icon={<Clock size={12} />}
        />
        <KpiCard
          label="Pausados Financeiro"
          value={kpis.pausados}
          sub="inadimplência ativa"
          color={kpis.pausados > 0 ? "#ef4444" : undefined}
          icon={<TrendingDown size={12} />}
        />
        <KpiCard
          label="Em Onboarding"
          value={kpis.onboarding}
          sub="primeiros 90 dias"
          icon={<Users size={12} />}
        />
      </div>

      {/* ── Lista por squad ── */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-0.5">
        {bySquad.size === 0 ? (
          <div className="h-32 flex items-center justify-center text-muted-foreground">
            <p className="text-sm">Nenhum projeto encontrado</p>
          </div>
        ) : (
          Array.from(bySquad.entries()).map(([squad, projs], idx) => (
            <SquadGroup
              key={squad || "__sem_squad__"}
              squadName={squad}
              projects={projs}
              defaultExpanded={idx < 3}
              onRowClick={setDetailProject}
              onEdit={(p) => setEditProject(p)}
              onDelete={(p) => setDeleteConfirm(p)}
            />
          ))
        )}
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass-strong rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-semibold mb-1">Excluir projeto?</p>
              <p className="text-sm text-muted-foreground mb-4">{deleteConfirm.name}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-border/60 text-sm hover:bg-secondary/60 transition-colors">Cancelar</button>
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm hover:bg-destructive/90 transition-colors">Excluir</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {(detailProject || editProject) && null}
    </div>
  );
}
