import { useState, useCallback, useRef, useEffect } from "react";
import {
  ArrowLeft,
  Edit2,
  ExternalLink,
  Share2,
  Flag,
  FolderOpen,
  BarChart2,
  MessageCircle,
  Link2,
  FileText,
  Star,
  TrendingUp,
  ChevronDown,
  Check,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Project } from "@/hooks/useProjects";
import { ACTIVE_MOMENTOS, type ProjectMomento } from "@/hooks/useProjects";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectDetailPageProps {
  project: Project;
  jornadaColor?: string;
  jornadaFases?: string[];
  onBack: () => void;
  onEdit: () => void;
  onFaseChange: (id: string, fase: string | null) => Promise<void>;
  onProjectUpdate?: (updated: Partial<Project>) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(n: number | undefined | null): string {
  if (!n || n === 0) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function lifetimeMonths(startDate: string | undefined | null): number | null {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const m =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return m > 0 ? m : null;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function getSaudeConfig(saude: string | null | undefined) {
  if (saude === "saudavel") return { label: "Saudável", color: "text-green-500", dot: "bg-green-500" };
  if (saude === "atencao")  return { label: "Atenção",  color: "text-yellow-500", dot: "bg-yellow-500" };
  if (saude === "critico")  return { label: "Crítico",  color: "text-red-500",    dot: "bg-red-500"    };
  return { label: "—", color: "text-muted-foreground", dot: "bg-muted-foreground/40" };
}

function getStepLabel(step: string | undefined | null): string {
  if (!step) return "—";
  const map: Record<string, string> = {
    saber: "Diagnósticos",
    ter: "Implementação",
    "executar-onboarding": "Onboarding",
    "executar-implementacoes": "Implementações",
    executar: "Ongoing",
  };
  return map[step.toLowerCase()] ?? step;
}

function getStepColor(step: string | undefined | null): string {
  if (!step) return "#6b7280";
  const map: Record<string, string> = {
    saber: "#8b5cf6",
    ter: "#06b6d4",
    "executar-onboarding": "#22c55e",
    "executar-implementacoes": "#f59e0b",
    executar: "#10b981",
  };
  return map[step.toLowerCase()] ?? "#6b7280";
}

function isActive(p: Project): boolean {
  return ACTIVE_MOMENTOS.includes(p.momento as ProjectMomento);
}

// ─── Inline editable text area ────────────────────────────────────────────────

interface InlineTextAreaProps {
  value: string | null | undefined;
  placeholder: string;
  onSave: (val: string) => Promise<void>;
}

function InlineTextArea({ value, placeholder, onSave }: InlineTextAreaProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setLocal(value ?? ""); }, [value]);

  async function handleBlur() {
    setEditing(false);
    if (local === (value ?? "")) return;
    setSaving(true);
    await onSave(local);
    setSaving(false);
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        autoFocus
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        rows={5}
        className="w-full bg-secondary/30 border border-primary/40 rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 leading-relaxed"
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="group relative min-h-[80px] rounded-lg px-3 py-2 cursor-text hover:bg-secondary/20 transition-colors border border-transparent hover:border-border/30"
    >
      {saving && (
        <Loader2 size={12} className="absolute top-2 right-2 animate-spin text-muted-foreground" />
      )}
      {local ? (
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{local}</p>
      ) : (
        <p className="text-sm text-muted-foreground/50 italic">{placeholder}</p>
      )}
      <Edit2
        size={11}
        className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity text-muted-foreground"
      />
    </div>
  );
}

// ─── Quick link button ────────────────────────────────────────────────────────

interface QuickLinkProps {
  label: string;
  icon: React.ReactNode;
  url: string | undefined | null;
}

function QuickLink({ label, icon, url }: QuickLinkProps) {
  if (!url) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl bg-secondary/20 border border-border/20 opacity-35 cursor-not-allowed select-none">
        <div className="text-muted-foreground [&>svg]:w-6 [&>svg]:h-6">{icon}</div>
        <span className="text-xs text-muted-foreground text-center leading-tight">{label}</span>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl bg-secondary/30 border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all group"
    >
      <div className="text-foreground/50 group-hover:text-primary transition-colors [&>svg]:w-6 [&>svg]:h-6">{icon}</div>
      <span className="text-xs text-foreground/65 group-hover:text-primary text-center leading-tight transition-colors">{label}</span>
    </a>
  );
}

// ─── Saúde selector ───────────────────────────────────────────────────────────

interface SaudeSelectorProps {
  value: "saudavel" | "atencao" | "critico" | null | undefined;
  onChange: (v: "saudavel" | "atencao" | "critico") => Promise<void>;
}

function SaudeSelector({ value, onChange }: SaudeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const cfg = getSaudeConfig(value);
  const options: { key: "saudavel" | "atencao" | "critico"; label: string; color: string }[] = [
    { key: "saudavel", label: "Saudável", color: "text-green-500"  },
    { key: "atencao",  label: "Atenção",  color: "text-yellow-500" },
    { key: "critico",  label: "Crítico",  color: "text-red-500"    },
  ];

  async function pick(k: "saudavel" | "atencao" | "critico") {
    setOpen(false);
    setSaving(true);
    await onChange(k);
    setSaving(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition-opacity"
      >
        {saving ? (
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        ) : (
          <span className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0`} />
        )}
        <span className={cfg.color}>{cfg.label}</span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[120px]">
          {options.map((o) => (
            <button
              key={o.key}
              onClick={() => pick(o.key)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 flex items-center gap-2 ${o.color}`}
            >
              {value === o.key && <Check size={12} />}
              {value !== o.key && <span className="w-3" />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fase selector ────────────────────────────────────────────────────────────

interface FaseSelectorProps {
  value: string | null | undefined;
  fases: string[];
  color: string;
  onChange: (fase: string | null) => Promise<void>;
}

function FaseSelector({ value, fases, color, onChange }: FaseSelectorProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pick(f: string) {
    setOpen(false);
    setSaving(true);
    await onChange(f);
    setSaving(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all hover:opacity-80"
        style={{
          color: value ? color : "#6b7280",
          borderColor: (value ? color : "#6b7280") + "40",
          backgroundColor: (value ? color : "#6b7280") + "15",
        }}
      >
        {saving ? (
          <Loader2 size={13} className="animate-spin flex-shrink-0" />
        ) : (
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: value ? color : "#6b7280" }} />
        )}
        <span className="truncate">{value ?? "Sem fase"}</span>
        <ChevronDown size={12} className="flex-shrink-0 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[240px] max-h-64 overflow-y-auto">
          {fases.map((f) => (
            <button
              key={f}
              onClick={() => pick(f)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/50 flex items-center gap-2"
            >
              {value === f ? <Check size={12} style={{ color }} /> : <span className="w-3" />}
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ProjectDetailPage({
  project: initialProject,
  jornadaColor = "#6b7280",
  jornadaFases = [],
  onBack,
  onEdit,
  onFaseChange,
  onProjectUpdate,
}: ProjectDetailPageProps) {
  const [project, setProject] = useState(initialProject);

  // Sync if parent updates the project
  useEffect(() => { setProject(initialProject); }, [initialProject]);

  const stepColor = getStepColor(project.step);
  const lt = lifetimeMonths(project.start_date);
  const active = isActive(project);

  // ── Field updaters ──────────────────────────────────────────────────────────

  async function patchField(field: string, value: unknown) {
    const { error } = await supabase
      .from("projects")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", project.id);
    if (error) throw error;
    const update = { [field]: value } as Partial<Project>;
    setProject((p) => ({ ...p, ...update }));
    onProjectUpdate?.(update);
  }

  const saveEscopo = useCallback(
    (v: string) => patchField("escopo", v || null),
    [project.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const saveObservacoes = useCallback(
    (v: string) => patchField("observacoes", v || null),
    [project.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function handleSaudeChange(saude: "saudavel" | "atencao" | "critico") {
    await patchField("saude", saude);
  }

  async function handleFaseChange(fase: string | null) {
    await onFaseChange(project.id, fase);
    setProject((p) => ({ ...p, jornada_fase: fase }));
  }

  // ── Links config ─────────────────────────────────────────────────────────────

  const links = [
    {
      label: "Planejamento",
      icon: <BarChart2 size={18} />,
      url: project.pasta_publica,
    },
    {
      label: "Drive",
      icon: <FolderOpen size={18} />,
      url: project.pasta_privada,
    },
    {
      label: "CRM",
      icon: <TrendingUp size={18} />,
      url: project.crm_url,
    },
    {
      label: "Relatório de BI",
      icon: <BarChart2 size={18} />,
      url: project.sistema_dados_url,
    },
    {
      label: "Contrato",
      icon: <FileText size={18} />,
      url: project.contrato_url,
    },
    {
      label: "WhatsApp",
      icon: <MessageCircle size={18} />,
      url: project.wa_group_id
        ? `https://api.whatsapp.com/send?phone=${project.wa_group_id}`
        : null,
    },
    {
      label: "Meta Ads",
      icon: <Star size={18} />,
      url: project.meta_ads_id
        ? `https://business.facebook.com/adsmanager/manage/campaigns?act=${project.meta_ads_id}`
        : null,
    },
    {
      label: "Google Ads",
      icon: <Link2 size={18} />,
      url: project.google_ads_id
        ? `https://ads.google.com/aw/campaigns?__u=${project.google_ads_id}`
        : null,
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pt-5 pb-4 border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="flex items-start gap-4">

          {/* Back button */}
          <button
            onClick={onBack}
            className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} />
          </button>

          {/* Avatar */}
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: stepColor }}
          >
            {initials(project.client_name ?? project.name)}
          </div>

          {/* Name + tags */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-foreground leading-tight truncate">{project.name}</h1>

              {/* Step/jornada tag */}
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ color: stepColor, backgroundColor: stepColor + "18", border: `1px solid ${stepColor}35` }}
              >
                {getStepLabel(project.step)}
              </span>

              {/* Tier tag */}
              {project.tier && (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-secondary/60 border border-border/50 text-foreground/70">
                  {project.tier}
                </span>
              )}

              {/* Active/Churn */}
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  active ? "bg-green-500/10 text-green-600 border border-green-500/20" : "bg-muted/40 text-muted-foreground border border-border/40"
                }`}
              >
                {active ? "Ativo" : "Encerrado"}
              </span>

              {/* Lifetime */}
              {lt && (
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs bg-secondary/40 text-muted-foreground border border-border/30">
                  há {lt} {lt === 1 ? "mês" : "meses"}
                </span>
              )}
            </div>

            {/* Client + Squad */}
            <p className="text-sm text-muted-foreground mt-1">
              {project.client_name ?? "—"}
              {project.squad_name && <> · <span className="opacity-70">{project.squad_name}</span></>}
            </p>

            {/* Responsáveis */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {project.gestor_projeto && (
                <span className="text-xs text-muted-foreground">
                  <span className="opacity-60">Gestor:</span> {project.gestor_projeto}
                </span>
              )}
              {project.gestor_trafego && (
                <span className="text-xs text-muted-foreground">
                  <span className="opacity-60">Tráfego:</span> {project.gestor_trafego}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/60 text-sm text-foreground/80 transition-colors"
            >
              <Edit2 size={13} />
              Editar
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-secondary/30 hover:bg-secondary/60 text-sm text-foreground/80 transition-colors">
              <Share2 size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Body — 2 columns ──────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="grid grid-cols-[1fr_320px] gap-0 h-full">

          {/* ── Left column ─────────────────────────────────────────────────── */}
          <div className="overflow-y-auto px-6 py-5 border-r border-border/30 space-y-6">

            {/* Links rápidos — topo da coluna esquerda */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Links rápidos</h2>
              <div className="grid grid-cols-4 gap-3">
                {links.map((l) => (
                  <QuickLink key={l.label} label={l.label} icon={l.icon} url={l.url} />
                ))}
              </div>
            </section>

            {/* Contexto section */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Contexto</h2>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <span className="w-1 h-3 rounded-full bg-primary/60" />
                    Escopo
                  </h3>
                  <InlineTextArea
                    value={project.escopo}
                    placeholder="Descreva o escopo do projeto... (clique para editar)"
                    onSave={saveEscopo}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                    <span className="w-1 h-3 rounded-full bg-yellow-500/60" />
                    Observações
                  </h3>
                  <InlineTextArea
                    value={project.observacoes}
                    placeholder="Anotações internas, contexto relevante... (clique para editar)"
                    onSave={saveObservacoes}
                  />
                </div>
              </div>
            </section>

            {/* Objetivos e KRs */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Objetivos e KRs</h2>
              <div className="rounded-xl border-2 border-dashed border-border/25 py-8 flex items-center justify-center">
                <p className="text-sm text-muted-foreground/40">Em breve</p>
              </div>
            </section>

            {/* Produtos */}
            {project.produtos && project.produtos.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Produtos</h2>
                <div className="flex flex-wrap gap-2">
                  {project.produtos.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center rounded-lg border border-border/50 bg-secondary/50 px-2.5 py-1 text-xs font-medium text-foreground/70"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Right column ─────────────────────────────────────────────────── */}
          <div className="overflow-y-auto px-5 py-5 space-y-5">

            {/* Metric cards */}
            <div className="space-y-2.5">

              {/* Saúde */}
              <div className="rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Flag size={14} />
                  Saúde
                </div>
                <SaudeSelector value={project.saude} onChange={handleSaudeChange} />
              </div>

              {/* Step */}
              <div className="rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ExternalLink size={14} />
                  Jornada
                </div>
                <span
                  className="text-sm font-medium"
                  style={{ color: stepColor }}
                >
                  {getStepLabel(project.step)}
                </span>
              </div>

              {/* Valor */}
              <div className="rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs font-bold">R$</span>
                  Valor
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {project.mrr
                    ? `${formatMoney(project.mrr)}/mês`
                    : formatMoney(project.investimento || project.estruturacao_estrategica)}
                </span>
              </div>

              {/* Momento */}
              <div className="rounded-xl border border-border/40 bg-secondary/20 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-xs">📍</span>
                  Momento
                </div>
                <span className="text-sm font-medium text-foreground/80">{project.momento ?? "—"}</span>
              </div>
            </div>

            {/* Informações da fase atual */}
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Fase atual
              </h2>
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 space-y-3">

                {/* Jornada + fase badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{ color: jornadaColor, backgroundColor: jornadaColor + "18", border: `1px solid ${jornadaColor}35` }}
                  >
                    {getStepLabel(project.step)}
                  </span>
                  {project.jornada_fase && (
                    <>
                      <span className="text-muted-foreground/40 text-xs">→</span>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {project.jornada_fase}
                      </span>
                    </>
                  )}
                </div>

                {/* Fase dropdown */}
                {jornadaFases.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Alterar fase</p>
                    <FaseSelector
                      value={project.jornada_fase}
                      fases={jornadaFases}
                      color={jornadaColor}
                      onChange={handleFaseChange}
                    />
                  </div>
                )}

                {/* Phase-specific fields */}
                {project.start_date && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Início</span>
                    <span className="text-foreground/70">
                      {new Date(project.start_date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
                {project.end_date && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Encerramento</span>
                    <span className="text-foreground/70">
                      {new Date(project.end_date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
                {project.aviso_previo_date && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Aviso prévio</span>
                    <span className="text-orange-500/80">
                      {new Date(project.aviso_previo_date).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
