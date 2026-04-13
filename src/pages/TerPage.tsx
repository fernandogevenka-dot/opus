import { useState, useMemo } from "react";
import { useProjects, ACTIVE_MOMENTOS, type Project, type ProjectMomento } from "@/hooks/useProjects";
import { FASES_TER, StepKanbanBoard } from "@/pages/ProjectsPage";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, Search, X, Box, DollarSign, CheckCircle2, Loader2, Clock,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number | undefined | null): string {
  if (!n || n === 0) return "—";
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, icon,
}: {
  label: string; value: string | number; sub?: string; color?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
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

// ─── Fases que indicam gargalo (projeto parado aguardando aprovação/revisão) ──
const FASES_GARGALO = new Set(["Aprovação", "Revisão", "Ajustes Preview", "Apresentação do Preview", "Apresentação Final"]);

// Fases concluídas neste mês
function concluidoEsteMes(project: Project): boolean {
  if (!project.fase_ter) return false;
  if (!project.fase_ter.toLowerCase().includes("concluído")) return false;
  // usa updated_at como proxy
  if (!project.updated_at) return false;
  const upd = new Date(project.updated_at);
  const agora = new Date();
  return upd.getFullYear() === agora.getFullYear() && upd.getMonth() === agora.getMonth();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TerPage() {
  const { projects, loading, error, updateFase, deleteProject } = useProjects();
  const [search, setSearch] = useState("");
  const [filterSquad, setFilterSquad] = useState("");
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [editProject, setEditProject] = useState<Project | null | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<Project | null>(null);

  // Projetos Ter ativos — step="ter" OU squad JARVIS OU fase_ter preenchida
  const terProjects = useMemo(() => {
    return projects.filter((p) => {
      const squad = (p.squad_name ?? "").toLowerCase();
      const hasFase = !!p.fase_ter;
      const isTerStep = p.step === "ter";
      const isTerSquad = squad.includes("jarvis");
      return (isTerStep || isTerSquad || hasFase) && ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento);
    });
  }, [projects]);

  // Squads disponíveis para filtro
  const squadOptions = useMemo(() => {
    const names = new Set(terProjects.map((p) => p.squad_name).filter(Boolean));
    return Array.from(names).sort() as string[];
  }, [terProjects]);

  // Filtrados
  const filtered = useMemo(() => {
    return terProjects.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.client_name ?? "").toLowerCase().includes(q);
      const matchSquad = !filterSquad || p.squad_name === filterSquad;
      return matchSearch && matchSquad;
    });
  }, [terProjects, search, filterSquad]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filtered.length;
    const valorTotal = filtered.reduce((s, p) => s + (p.investimento ?? p.mrr ?? 0), 0);
    const gargalo = filtered.filter((p) => p.fase_ter && FASES_GARGALO.has(p.fase_ter)).length;
    const concluidosMes = filtered.filter(concluidoEsteMes).length;
    return { total, valorTotal, gargalo, concluidosMes };
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando projetos Ter...</p>
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
      <div className="flex-shrink-0 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#06b6d418" }}>
            <Box size={18} style={{ color: "#06b6d4" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Ter</h1>
            <p className="text-xs text-muted-foreground">Projetos de implementação — JARVIS</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-shrink-0">
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
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              className="h-9 w-48 bg-background border border-border/50 rounded-xl pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/40"
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
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="flex-shrink-0 grid grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiCard
          label="Projetos ativos"
          value={kpis.total}
          sub="em andamento"
          icon={<Box size={12} />}
        />
        <KpiCard
          label="Valor em andamento"
          value={formatCurrency(kpis.valorTotal)}
          sub="soma dos projetos ativos"
          icon={<DollarSign size={12} />}
        />
        <KpiCard
          label="Em gargalo"
          value={kpis.gargalo}
          sub="aprovação / revisão / ajustes"
          color={kpis.gargalo > 0 ? "#f97316" : undefined}
          icon={<Clock size={12} />}
        />
        <KpiCard
          label="Concluídos este mês"
          value={kpis.concluidosMes}
          sub="atualizados como concluído"
          color={kpis.concluidosMes > 0 ? "#22c55e" : undefined}
          icon={<CheckCircle2 size={12} />}
        />
      </div>

      {/* ── Kanban ── */}
      <div className="flex-1 min-h-0">
        <StepKanbanBoard
          projects={filtered}
          tipo="ter"
          onFaseChange={updateFase}
          onCardClick={setDetailProject}
          onEdit={(p) => setEditProject(p)}
          onDelete={(p) => setDeleteConfirm(p)}
        />
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
                <button
                  onClick={async () => {
                    await deleteProject(deleteConfirm.id);
                    setDeleteConfirm(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm hover:bg-destructive/90 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {(detailProject || editProject) && null}
    </div>
  );
}
