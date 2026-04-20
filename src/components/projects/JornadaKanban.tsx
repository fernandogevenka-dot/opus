import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Edit2, Trash2, ChevronDown, Calendar } from "lucide-react";
import type { Project } from "@/hooks/useProjects";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JornadaConfig {
  title: string;
  step: string;            // matches project.step
  colunas: string[];       // ordered phase names
  color: string;           // accent color for this jornada
  encerradas?: Set<string>; // column names treated as "done/archived"
}

interface JornadaKanbanProps {
  config: JornadaConfig;
  projects: Project[];      // already filtered to this jornada's step
  onCardClick: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
  onFaseChange: (id: string, fase: string | null) => Promise<void>;
  onNewProject?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMoney(n: number | undefined | null): string {
  if (!n || n === 0) return "—";
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return `R$ ${n.toLocaleString("pt-BR")}`;
}

function lifetimeMonths(startDate: string | undefined | null): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const m = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return m > 0 ? m : null;
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────

interface CardProps {
  project: Project;
  colunas: string[];
  color: string;
  onCardClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFaseChange: (id: string, fase: string | null) => Promise<void>;
}

function JornadaCard({ project, colunas, color, onCardClick, onEdit, onDelete, onFaseChange }: CardProps) {
  const [hover, setHover] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const fase = project.jornada_fase ?? null;
  const lt = lifetimeMonths(project.start_date);
  const metric = project.mrr || project.investimento || 0;
  const isRec = !!project.mrr;

  async function handleFase(newFase: string) {
    setSaving(true);
    await onFaseChange(project.id, newFase);
    setSaving(false);
    setPicking(false);
  }

  // Saúde badge config
  const saudeCfg = (() => {
    if (project.saude === "saudavel") return { label: "Saudável", bg: "bg-green-500/15", text: "text-green-600 dark:text-green-400", border: "border-green-500/30" };
    if (project.saude === "atencao")  return { label: "Atenção",  bg: "bg-yellow-500/15", text: "text-yellow-600 dark:text-yellow-400", border: "border-yellow-500/30" };
    if (project.saude === "critico")  return { label: "Crítico",  bg: "bg-red-500/15",    text: "text-red-600 dark:text-red-400",       border: "border-red-500/30"    };
    return null;
  })();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-card rounded-xl cursor-pointer group relative flex flex-col border border-border/40 hover:border-border/70 hover:shadow-sm transition-all overflow-hidden"
      onClick={onCardClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPicking(false); }}
    >
      {/* Action buttons — appear on hover */}
      <AnimatePresence>
        {hover && !picking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-2 right-2 flex gap-1 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="w-6 h-6 rounded-md bg-background/90 border border-border/50 hover:bg-primary/10 hover:text-primary hover:border-primary/30 flex items-center justify-center transition-colors"
            >
              <Edit2 size={11} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-6 h-6 rounded-md bg-background/90 border border-border/50 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 flex items-center justify-center transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top section: saúde + tier ── */}
      <div className="px-3 pt-3 pb-2 flex items-center gap-2">
        {saudeCfg ? (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${saudeCfg.bg} ${saudeCfg.text} ${saudeCfg.border}`}>
            {saudeCfg.label}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-muted/30 text-muted-foreground border-border/30">
            —
          </span>
        )}
        {project.tier && (
          <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
            {project.tier}
          </span>
        )}
      </div>

      {/* ── Client name ── */}
      <div className="px-3 pb-2">
        <p className="text-sm font-bold text-foreground leading-snug pr-10">
          {project.client_name ?? project.name}
        </p>
        {project.client_name && project.name !== project.client_name && (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 truncate">{project.name}</p>
        )}
      </div>

      {/* ── Valor + LT chips ── */}
      <div className="px-3 pb-3 flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center rounded-full border border-border/50 bg-secondary/40 px-2.5 py-0.5 text-xs text-foreground/70">
          Valor: {metric > 0 ? formatMoney(metric) : "0,00"}
        </span>
        {lt && (
          <span className="inline-flex items-center rounded-full border border-border/50 bg-secondary/40 px-2.5 py-0.5 text-xs text-foreground/70">
            LT: {lt} {lt === 1 ? "mês" : "meses"}
          </span>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-border/30 mx-0" />

      {/* ── Fase row ── */}
      <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        {!picking ? (
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            title="Clique para alterar fase"
          >
            <Calendar size={11} className="flex-shrink-0 opacity-60" />
            {saving ? (
              <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
            ) : (
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: fase ? color : "#9ca3af" }}
              />
            )}
            <span className="truncate flex-1">{fase ? `Fase: ${fase}` : "Início na fase: —"}</span>
            <ChevronDown size={10} className="flex-shrink-0 opacity-40" />
          </button>
        ) : (
          <select
            autoFocus
            className="w-full bg-background border border-primary/40 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/50"
            defaultValue={fase ?? ""}
            onChange={(e) => handleFase(e.target.value)}
            onBlur={() => setPicking(false)}
          >
            <option value="" disabled>Selecione a fase...</option>
            {colunas.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>
    </motion.div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

interface ColProps {
  fase: string;
  projects: Project[];
  colunas: string[];
  color: string;
  isEncerrada: boolean;
  onCardClick: (p: Project) => void;
  onEdit: (p: Project) => void;
  onDelete: (p: Project) => void;
  onFaseChange: (id: string, fase: string | null) => Promise<void>;
}

function KanbanColumn({ fase, projects, colunas, color, isEncerrada, onCardClick, onEdit, onDelete, onFaseChange }: ColProps) {
  return (
    <div className="flex flex-col w-64 flex-shrink-0 h-full">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-2 px-0.5">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: isEncerrada ? "#6b7280" : color }}
        />
        <h3 className="text-xs font-semibold text-muted-foreground truncate flex-1">{fase}</h3>
        {projects.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{projects.length}</span>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-4">
        <AnimatePresence mode="popLayout">
          {projects.map((p) => (
            <JornadaCard
              key={p.id}
              project={p}
              colunas={colunas}
              color={isEncerrada ? "#6b7280" : color}
              onCardClick={() => onCardClick(p)}
              onEdit={() => onEdit(p)}
              onDelete={() => onDelete(p)}
              onFaseChange={onFaseChange}
            />
          ))}
        </AnimatePresence>
        {projects.length === 0 && (
          <div className="border-2 border-dashed border-border/20 rounded-xl h-20 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground/30">vazio</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Board ───────────────────────────────────────────────────────────────

export function JornadaKanban({ config, projects, onCardClick, onEdit, onDelete, onFaseChange }: JornadaKanbanProps) {
  const [showEncerradas, setShowEncerradas] = useState(false);
  const encerradas = config.encerradas ?? new Set<string>();

  // Group projects by fase
  const byFase = new Map<string, Project[]>();
  for (const col of config.colunas) byFase.set(col, []);

  const semFase: Project[] = [];
  for (const p of projects) {
    const f = p.jornada_fase ?? null;
    if (!f) { semFase.push(p); continue; }
    const bucket = byFase.get(f);
    if (bucket) bucket.push(p);
    else semFase.push(p); // fase unknown — treat as unassigned
  }

  const activeCols = config.colunas
    .filter((c) => !encerradas.has(c))
    .map((c) => ({ fase: c, projects: byFase.get(c) ?? [] }));

  const encerradasCols = config.colunas
    .filter((c) => encerradas.has(c))
    .map((c) => ({ fase: c, projects: byFase.get(c) ?? [] }))
    .filter((c) => c.projects.length > 0);

  const encerradasCount = encerradasCols.reduce((s, c) => s + c.projects.length, 0);

  const allActiveCols = [
    ...(semFase.length > 0 ? [{ fase: "— Sem fase —", projects: semFase, isEncerrada: false }] : []),
    ...activeCols.map((c) => ({ ...c, isEncerrada: false })),
  ];

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Active board */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 h-full pb-2 px-0.5" style={{ minWidth: "max-content" }}>
          {allActiveCols.map((col) => (
            <KanbanColumn
              key={col.fase}
              fase={col.fase}
              projects={col.projects}
              colunas={config.colunas}
              color={config.color}
              isEncerrada={col.isEncerrada}
              onCardClick={onCardClick}
              onEdit={onEdit}
              onDelete={onDelete}
              onFaseChange={onFaseChange}
            />
          ))}
          {allActiveCols.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p className="text-sm">Nenhum projeto nesta jornada</p>
            </div>
          )}
        </div>
      </div>

      {/* Archived toggle */}
      {encerradasCount > 0 && (
        <div className="flex-shrink-0">
          <button
            onClick={() => setShowEncerradas((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ChevronDown size={12} className={`transition-transform ${showEncerradas ? "" : "-rotate-90"}`} />
            {encerradasCount} projeto(s) encerrado(s)
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
                    <KanbanColumn
                      key={col.fase}
                      fase={col.fase}
                      projects={col.projects}
                      colunas={config.colunas}
                      color={config.color}
                      isEncerrada
                      onCardClick={onCardClick}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onFaseChange={onFaseChange}
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
