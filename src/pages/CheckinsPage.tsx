import { useState, useEffect, useMemo } from "react";
import {
  useCheckins,
  type Checkin,
  type NpsRecord,
  type CsatRecord,
  type Meta,
} from "@/hooks/useCheckins";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  X,
  ChevronDown,
  BarChart3,
  Star,
  TrendingUp,
  Users,
  Target,
  CheckSquare,
  MessageSquare,
  Calendar,
  DollarSign,
  Eye,
  Filter,
  RefreshCw,
  ChevronRight,
  Clipboard,
  ClipboardList,
  Award,
  Layers,
  ShoppingCart,
  Megaphone,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ClientOption {
  id: string;
  name: string;
}

function formatDate(d: string | undefined | null): string {
  if (!d) return "—";
  try {
    const parts = d.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  } catch {
    return d;
  }
}

function formatCurrency(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(n: number | undefined | null): string {
  if (n === undefined || n === null) return "—";
  return n.toLocaleString("pt-BR");
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Score dot ────────────────────────────────────────────────────────────────

function ScoreDot({ value, label }: { value: string | undefined | null; label?: string }) {
  let color = "bg-zinc-500";
  let title = value ?? "—";
  if (value === "Sim") color = "bg-green-500";
  else if (value === "Não") color = "bg-red-500";
  else if (value === "Parcialmente") color = "bg-yellow-400";

  return (
    <span className="inline-flex items-center gap-1.5" title={`${label ? label + ": " : ""}${title}`}>
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </span>
  );
}

// ─── NPS color helper ─────────────────────────────────────────────────────────

function npsColor(nota: number | undefined | null): string {
  if (nota === undefined || nota === null) return "text-muted-foreground";
  if (nota >= 9) return "text-green-400";
  if (nota >= 7) return "text-yellow-400";
  return "text-red-400";
}

function npsBg(nota: number | undefined | null): string {
  if (nota === undefined || nota === null) return "bg-zinc-700/40";
  if (nota >= 9) return "bg-green-500/15 border border-green-500/25";
  if (nota >= 7) return "bg-yellow-400/15 border border-yellow-400/25";
  return "bg-red-500/15 border border-red-500/25";
}

function csatColor(v: number | undefined | null, max = 5): string {
  if (v === undefined || v === null) return "text-muted-foreground";
  const ratio = v / max;
  if (ratio >= 0.8) return "text-green-400";
  if (ratio >= 0.6) return "text-yellow-400";
  return "text-red-400";
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl p-4 flex items-start gap-3 border border-border/50">
      <div className="p-2 rounded-lg bg-secondary/60">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <div className="flex items-center gap-2">
          <p className="text-xl font-semibold text-foreground leading-none">{value}</p>
          {badge}
        </div>
      </div>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className={`relative z-10 w-full ${wide ? "max-w-3xl" : "max-w-lg"} bg-background border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]`}
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-muted-foreground mb-1">{children}</label>;
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  step,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className="w-full px-3 py-2 text-sm bg-secondary/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition"
    />
  );
}

function SelectInput({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm bg-secondary/40 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition appearance-none"
    >
      {children}
    </select>
  );
}

function TextareaInput({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm bg-secondary/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition resize-none"
    />
  );
}

// ─── Client select ────────────────────────────────────────────────────────────

function ClientSelect({
  value,
  onChange,
  clients,
  placeholder = "Selecionar cliente",
}: {
  value: string;
  onChange: (v: string) => void;
  clients: ClientOption[];
  placeholder?: string;
}) {
  return (
    <SelectInput value={value} onChange={onChange}>
      <option value="">{placeholder}</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </SelectInput>
  );
}

// ─── Score select (Sim/Não/Parcialmente) ──────────────────────────────────────

const SCORE_OPTIONS = ["", "Sim", "Não", "Parcialmente"];

function ScoreSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <SelectInput value={value} onChange={onChange}>
        <option value="">—</option>
        {SCORE_OPTIONS.filter(Boolean).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </SelectInput>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "checkins", label: "Check-ins", icon: ClipboardList },
  { id: "nps", label: "NPS", icon: Star },
  { id: "csat", label: "CSAT", icon: Award },
  { id: "metas", label: "Metas", icon: Target },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── NPS badge (header) ───────────────────────────────────────────────────────

function NpsBadge({ avg }: { avg: number | null }) {
  if (avg === null) return <span className="text-xs text-muted-foreground">—</span>;
  let cls = "text-xs font-bold px-2 py-0.5 rounded-full ";
  if (avg >= 9) cls += "bg-green-500/20 text-green-400";
  else if (avg >= 6) cls += "bg-yellow-400/20 text-yellow-400";
  else cls += "bg-red-500/20 text-red-400";
  return <span className={cls}>{avg}</span>;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | undefined | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  let cls = "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ";
  const s = status.toLowerCase();
  if (s.includes("ativo") || s.includes("ok") || s.includes("saudável"))
    cls += "bg-green-500/10 text-green-400 border-green-500/20";
  else if (s.includes("risco") || s.includes("atenção"))
    cls += "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
  else if (s.includes("critico") || s.includes("crítico") || s.includes("churn"))
    cls += "bg-red-500/10 text-red-400 border-red-500/20";
  else cls += "bg-secondary/60 text-muted-foreground border-border/50";
  return <span className={cls}>{status}</span>;
}

// ─── Checkin detail panel ─────────────────────────────────────────────────────

function CheckinDetailPanel({
  checkin,
  onClose,
}: {
  checkin: Checkin;
  onClose: () => void;
}) {
  const clientName = checkin.clients?.name ?? "—";

  const scoreFields: Array<{ key: keyof Checkin; label: string }> = [
    { key: "demanda_dentro_expectativa", label: "Demanda dentro da expectativa" },
    { key: "faturamento_mapeado", label: "Faturamento mapeado" },
    { key: "stakeholder_consciente", label: "Stakeholder consciente" },
    { key: "bom_relacionamento", label: "Bom relacionamento" },
    { key: "stakeholder_participando", label: "Stakeholder participando" },
    { key: "houve_queixa", label: "Houve queixa" },
    { key: "planejamento_cumprido", label: "Planejamento cumprido" },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-40 flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="absolute right-0 top-0 bottom-0 w-full max-w-xl bg-background border-l border-border shadow-2xl flex flex-col overflow-hidden"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30 shrink-0">
          <div>
            <p className="text-base font-semibold text-foreground">{clientName}</p>
            <p className="text-xs text-muted-foreground">{formatDate(checkin.data)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-secondary/40 p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Faturamento</p>
              <p className="text-sm font-semibold text-foreground">{formatCurrency(checkin.faturamento_mes)}</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Vendas</p>
              <p className="text-sm font-semibold text-foreground">{formatNumber(checkin.numero_vendas)}</p>
            </div>
            <div className="rounded-xl bg-secondary/40 p-3 border border-border/50">
              <p className="text-xs text-muted-foreground mb-1">Leads</p>
              <p className="text-sm font-semibold text-foreground">{formatNumber(checkin.leads)}</p>
            </div>
          </div>

          {/* Scores aggregados */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scores</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-secondary/40 p-3 border border-border/50 flex flex-col items-center gap-1">
                <ScoreDot value={checkin.resultado_score} />
                <p className="text-xs text-muted-foreground text-center">Resultado</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3 border border-border/50 flex flex-col items-center gap-1">
                <ScoreDot value={checkin.relacionamento_score} />
                <p className="text-xs text-muted-foreground text-center">Relacionamento</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3 border border-border/50 flex flex-col items-center gap-1">
                <ScoreDot value={checkin.entregas_score} />
                <p className="text-xs text-muted-foreground text-center">Entregas</p>
              </div>
            </div>
          </div>

          {/* Score fields */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Avaliação detalhada</p>
            <div className="space-y-2">
              {scoreFields.map(({ key, label }) => {
                const val = checkin[key] as string | undefined;
                return (
                  <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <span className="text-sm text-foreground/80">{label}</span>
                    <ScoreDot value={val} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Squad / AM */}
          {(checkin.squad || checkin.account_manager) && (
            <div className="grid grid-cols-2 gap-3">
              {checkin.squad && (
                <div className="rounded-xl bg-secondary/40 p-3 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Squad</p>
                  <p className="text-sm font-medium text-foreground">{checkin.squad}</p>
                </div>
              )}
              {checkin.account_manager && (
                <div className="rounded-xl bg-secondary/40 p-3 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-1">Account Manager</p>
                  <p className="text-sm font-medium text-foreground">{checkin.account_manager}</p>
                </div>
              )}
            </div>
          )}

          {/* WhatsApp */}
          {checkin.comunicacao_whatsapp && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Comunicação WhatsApp</p>
              <div className="rounded-xl bg-secondary/40 p-3 border border-border/50">
                <p className="text-sm text-foreground/80 whitespace-pre-wrap">{checkin.comunicacao_whatsapp}</p>
              </div>
            </div>
          )}

          {/* ATA */}
          {checkin.ata && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ata da Reunião</p>
              <div className="rounded-xl bg-secondary/40 p-4 border border-border/50">
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{checkin.ata}</p>
              </div>
            </div>
          )}

          {/* TODO */}
          {checkin.todo && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">To-do / Próximos passos</p>
              <div className="rounded-xl bg-secondary/40 p-4 border border-border/50">
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{checkin.todo}</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Checkin modal ────────────────────────────────────────────────────────────

interface CheckinFormState {
  client_id: string;
  data: string;
  status_atual: string;
  resultado_score: string;
  relacionamento_score: string;
  entregas_score: string;
  demanda_dentro_expectativa: string;
  faturamento_mapeado: string;
  stakeholder_consciente: string;
  bom_relacionamento: string;
  stakeholder_participando: string;
  houve_queixa: string;
  planejamento_cumprido: string;
  faturamento_mes: string;
  numero_vendas: string;
  leads: string;
  squad: string;
  account_manager: string;
  comunicacao_whatsapp: string;
  ata: string;
  todo: string;
}

const defaultCheckinForm = (): CheckinFormState => ({
  client_id: "",
  data: todayISO(),
  status_atual: "",
  resultado_score: "",
  relacionamento_score: "",
  entregas_score: "",
  demanda_dentro_expectativa: "",
  faturamento_mapeado: "",
  stakeholder_consciente: "",
  bom_relacionamento: "",
  stakeholder_participando: "",
  houve_queixa: "",
  planejamento_cumprido: "",
  faturamento_mes: "",
  numero_vendas: "",
  leads: "",
  squad: "",
  account_manager: "",
  comunicacao_whatsapp: "",
  ata: "",
  todo: "",
});

function CheckinModal({
  open,
  onClose,
  onSave,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Checkin>) => Promise<void>;
  clients: ClientOption[];
}) {
  const [form, setForm] = useState<CheckinFormState>(defaultCheckinForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(defaultCheckinForm());
  }, [open]);

  const set = (key: keyof CheckinFormState) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const handleSave = async () => {
    if (!form.client_id || !form.data) return;
    setSaving(true);
    try {
      await onSave({
        client_id: form.client_id,
        data: form.data,
        status_atual: form.status_atual || undefined,
        resultado_score: form.resultado_score || undefined,
        relacionamento_score: form.relacionamento_score || undefined,
        entregas_score: form.entregas_score || undefined,
        demanda_dentro_expectativa: form.demanda_dentro_expectativa || undefined,
        faturamento_mapeado: form.faturamento_mapeado || undefined,
        stakeholder_consciente: form.stakeholder_consciente || undefined,
        bom_relacionamento: form.bom_relacionamento || undefined,
        stakeholder_participando: form.stakeholder_participando || undefined,
        houve_queixa: form.houve_queixa || undefined,
        planejamento_cumprido: form.planejamento_cumprido || undefined,
        faturamento_mes: form.faturamento_mes ? parseFloat(form.faturamento_mes) : undefined,
        numero_vendas: form.numero_vendas ? parseInt(form.numero_vendas) : undefined,
        leads: form.leads ? parseInt(form.leads) : undefined,
        squad: form.squad || undefined,
        account_manager: form.account_manager || undefined,
        comunicacao_whatsapp: form.comunicacao_whatsapp || undefined,
        ata: form.ata || undefined,
        todo: form.todo || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo Check-in" wide>
      <div className="space-y-4">
        {/* Row 1 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Cliente *</FieldLabel>
            <ClientSelect value={form.client_id} onChange={set("client_id")} clients={clients} />
          </div>
          <div>
            <FieldLabel>Data *</FieldLabel>
            <TextInput type="date" value={form.data} onChange={set("data")} />
          </div>
        </div>

        {/* Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Status Atual</FieldLabel>
            <TextInput value={form.status_atual} onChange={set("status_atual")} placeholder="Ex: Saudável, Risco..." />
          </div>
          <div>
            <FieldLabel>Squad</FieldLabel>
            <TextInput value={form.squad} onChange={set("squad")} placeholder="Nome do squad" />
          </div>
        </div>

        <div>
          <FieldLabel>Account Manager</FieldLabel>
          <TextInput value={form.account_manager} onChange={set("account_manager")} placeholder="Nome do account manager" />
        </div>

        {/* Scores principais */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Scores Principais</p>
          <div className="grid grid-cols-3 gap-3">
            <ScoreSelect value={form.resultado_score} onChange={set("resultado_score")} label="Score Resultado" />
            <ScoreSelect value={form.relacionamento_score} onChange={set("relacionamento_score")} label="Score Relacionamento" />
            <ScoreSelect value={form.entregas_score} onChange={set("entregas_score")} label="Score Entregas" />
          </div>
        </div>

        {/* Scores detalhados */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Avaliação Detalhada</p>
          <div className="grid grid-cols-2 gap-3">
            <ScoreSelect value={form.demanda_dentro_expectativa} onChange={set("demanda_dentro_expectativa")} label="Demanda dentro da expectativa" />
            <ScoreSelect value={form.faturamento_mapeado} onChange={set("faturamento_mapeado")} label="Faturamento mapeado" />
            <ScoreSelect value={form.stakeholder_consciente} onChange={set("stakeholder_consciente")} label="Stakeholder consciente" />
            <ScoreSelect value={form.bom_relacionamento} onChange={set("bom_relacionamento")} label="Bom relacionamento" />
            <ScoreSelect value={form.stakeholder_participando} onChange={set("stakeholder_participando")} label="Stakeholder participando" />
            <ScoreSelect value={form.houve_queixa} onChange={set("houve_queixa")} label="Houve queixa" />
            <ScoreSelect value={form.planejamento_cumprido} onChange={set("planejamento_cumprido")} label="Planejamento cumprido" />
          </div>
        </div>

        {/* KPIs */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">KPIs do Mês</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>Faturamento (R$)</FieldLabel>
              <TextInput type="number" value={form.faturamento_mes} onChange={set("faturamento_mes")} placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <FieldLabel>Nº de Vendas</FieldLabel>
              <TextInput type="number" value={form.numero_vendas} onChange={set("numero_vendas")} placeholder="0" min="0" />
            </div>
            <div>
              <FieldLabel>Leads</FieldLabel>
              <TextInput type="number" value={form.leads} onChange={set("leads")} placeholder="0" min="0" />
            </div>
          </div>
        </div>

        {/* WhatsApp */}
        <div>
          <FieldLabel>Comunicação WhatsApp</FieldLabel>
          <TextareaInput value={form.comunicacao_whatsapp} onChange={set("comunicacao_whatsapp")} placeholder="Observações sobre comunicação..." rows={2} />
        </div>

        {/* ATA */}
        <div>
          <FieldLabel>Ata da Reunião</FieldLabel>
          <TextareaInput value={form.ata} onChange={set("ata")} placeholder="Resumo da reunião..." rows={4} />
        </div>

        {/* TODO */}
        <div>
          <FieldLabel>To-do / Próximos Passos</FieldLabel>
          <TextareaInput value={form.todo} onChange={set("todo")} placeholder="Ações a executar..." rows={3} />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.client_id || !form.data}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar Check-in"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── NPS Modal ────────────────────────────────────────────────────────────────

interface NpsFormState {
  client_id: string;
  nota: string;
  comentario: string;
  data: string;
}

const defaultNpsForm = (): NpsFormState => ({
  client_id: "",
  nota: "",
  comentario: "",
  data: todayISO(),
});

function NpsModal({
  open,
  onClose,
  onSave,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<NpsRecord>) => Promise<void>;
  clients: ClientOption[];
}) {
  const [form, setForm] = useState<NpsFormState>(defaultNpsForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(defaultNpsForm());
  }, [open]);

  const set = (key: keyof NpsFormState) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const handleSave = async () => {
    if (!form.client_id || !form.nota) return;
    setSaving(true);
    try {
      await onSave({
        client_id: form.client_id,
        nota: parseInt(form.nota),
        comentario: form.comentario || undefined,
        data: form.data,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const nota = form.nota ? parseInt(form.nota) : null;

  return (
    <Modal open={open} onClose={onClose} title="Registrar NPS">
      <div className="space-y-4">
        <div>
          <FieldLabel>Cliente *</FieldLabel>
          <ClientSelect value={form.client_id} onChange={set("client_id")} clients={clients} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Nota (0–10) *</FieldLabel>
            <TextInput type="number" value={form.nota} onChange={set("nota")} placeholder="0–10" min="0" max="10" />
          </div>
          <div>
            <FieldLabel>Data</FieldLabel>
            <TextInput type="date" value={form.data} onChange={set("data")} />
          </div>
        </div>

        {/* Visual nota preview */}
        {nota !== null && (
          <div className="flex items-center gap-2">
            <span className={`text-3xl font-bold ${npsColor(nota)}`}>{nota}</span>
            <span className="text-sm text-muted-foreground">
              {nota >= 9 ? "Promotor" : nota >= 7 ? "Neutro" : "Detrator"}
            </span>
          </div>
        )}

        <div>
          <FieldLabel>Comentário</FieldLabel>
          <TextareaInput value={form.comentario} onChange={set("comentario")} placeholder="Feedback do cliente..." rows={3} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.client_id || !form.nota}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Salvando...</> : "Salvar NPS"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── CSAT Modal ───────────────────────────────────────────────────────────────

interface CsatFormState {
  client_id: string;
  geral: string;
  copys: string;
  designs: string;
  resultados: string;
  prazos: string;
  gestao_campanhas: string;
  comentario: string;
  data: string;
}

const defaultCsatForm = (): CsatFormState => ({
  client_id: "",
  geral: "",
  copys: "",
  designs: "",
  resultados: "",
  prazos: "",
  gestao_campanhas: "",
  comentario: "",
  data: todayISO(),
});

function CsatModal({
  open,
  onClose,
  onSave,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<CsatRecord>) => Promise<void>;
  clients: ClientOption[];
}) {
  const [form, setForm] = useState<CsatFormState>(defaultCsatForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(defaultCsatForm());
  }, [open]);

  const set = (key: keyof CsatFormState) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const handleSave = async () => {
    if (!form.client_id) return;
    setSaving(true);
    try {
      await onSave({
        client_id: form.client_id,
        geral: form.geral ? parseFloat(form.geral) : undefined,
        copys: form.copys ? parseFloat(form.copys) : undefined,
        designs: form.designs ? parseFloat(form.designs) : undefined,
        resultados: form.resultados ? parseFloat(form.resultados) : undefined,
        prazos: form.prazos ? parseFloat(form.prazos) : undefined,
        gestao_campanhas: form.gestao_campanhas ? parseFloat(form.gestao_campanhas) : undefined,
        comentario: form.comentario || undefined,
        data: form.data,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const csatFields: Array<{ key: keyof CsatFormState; label: string }> = [
    { key: "geral", label: "Geral (1-10)" },
    { key: "copys", label: "Copys (1-5)" },
    { key: "designs", label: "Designs (1-5)" },
    { key: "resultados", label: "Resultados (1-5)" },
    { key: "prazos", label: "Prazos (1-5)" },
    { key: "gestao_campanhas", label: "Gestão de Campanhas (1-5)" },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Registrar CSAT">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Cliente *</FieldLabel>
            <ClientSelect value={form.client_id} onChange={set("client_id")} clients={clients} />
          </div>
          <div>
            <FieldLabel>Data</FieldLabel>
            <TextInput type="date" value={form.data} onChange={set("data")} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Notas</p>
          <div className="grid grid-cols-2 gap-3">
            {csatFields.map(({ key, label }) => (
              <div key={key}>
                <FieldLabel>{label}</FieldLabel>
                <TextInput
                  type="number"
                  value={form[key]}
                  onChange={set(key)}
                  placeholder="—"
                  min="1"
                  max={key === "geral" ? "10" : "5"}
                  step="0.1"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Comentário</FieldLabel>
          <TextareaInput value={form.comentario} onChange={set("comentario")} placeholder="Observações..." rows={3} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.client_id}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Salvando...</> : "Salvar CSAT"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Meta Modal ───────────────────────────────────────────────────────────────

interface MetaFormState {
  client_id: string;
  meta: string;
  tipo_meta: string;
  data: string;
}

const TIPO_META_OPTIONS = ["Revenue", "Leads", "Vendas", "ROAS", "CAC", "LTV", "Outro"];

const defaultMetaForm = (): MetaFormState => ({
  client_id: "",
  meta: "",
  tipo_meta: "",
  data: todayISO(),
});

function MetaModal({
  open,
  onClose,
  onSave,
  clients,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Meta>) => Promise<void>;
  clients: ClientOption[];
}) {
  const [form, setForm] = useState<MetaFormState>(defaultMetaForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(defaultMetaForm());
  }, [open]);

  const set = (key: keyof MetaFormState) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const handleSave = async () => {
    if (!form.client_id || !form.meta) return;
    setSaving(true);
    try {
      await onSave({
        client_id: form.client_id,
        meta: parseFloat(form.meta),
        tipo_meta: form.tipo_meta || undefined,
        data: form.data,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar Meta">
      <div className="space-y-4">
        <div>
          <FieldLabel>Cliente *</FieldLabel>
          <ClientSelect value={form.client_id} onChange={set("client_id")} clients={clients} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel>Meta (valor) *</FieldLabel>
            <TextInput type="number" value={form.meta} onChange={set("meta")} placeholder="0.00" min="0" step="0.01" />
          </div>
          <div>
            <FieldLabel>Tipo da Meta</FieldLabel>
            <SelectInput value={form.tipo_meta} onChange={set("tipo_meta")}>
              <option value="">Selecionar tipo</option>
              {TIPO_META_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </SelectInput>
          </div>
        </div>

        <div>
          <FieldLabel>Data</FieldLabel>
          <TextInput type="date" value={form.data} onChange={set("data")} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.client_id || !form.meta}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Salvando...</> : "Salvar Meta"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── NPS Bar chart ────────────────────────────────────────────────────────────

function NpsDistributionBar({ records }: { records: NpsRecord[] }) {
  const total = records.length;
  if (total === 0) return null;

  const promotores = records.filter((r) => (r.nota ?? 0) >= 9).length;
  const neutros = records.filter((r) => (r.nota ?? 0) >= 7 && (r.nota ?? 0) <= 8).length;
  const detratores = records.filter((r) => (r.nota ?? 0) <= 6).length;

  const pPro = Math.round((promotores / total) * 100);
  const pNeu = Math.round((neutros / total) * 100);
  const pDet = Math.round((detratores / total) * 100);

  const npsScore = pPro - pDet;

  return (
    <div className="glass rounded-xl p-5 border border-border/50 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Distribuição NPS</p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Score NPS:</span>
          <span className={`text-lg font-bold ${npsScore >= 50 ? "text-green-400" : npsScore >= 0 ? "text-yellow-400" : "text-red-400"}`}>
            {npsScore > 0 ? `+${npsScore}` : npsScore}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
          <p className="text-2xl font-bold text-green-400">{promotores}</p>
          <p className="text-xs text-green-400/80 mt-0.5">Promotores</p>
          <p className="text-xs text-muted-foreground">nota 9–10</p>
        </div>
        <div className="rounded-lg bg-yellow-400/10 border border-yellow-400/20 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-400">{neutros}</p>
          <p className="text-xs text-yellow-400/80 mt-0.5">Neutros</p>
          <p className="text-xs text-muted-foreground">nota 7–8</p>
        </div>
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
          <p className="text-2xl font-bold text-red-400">{detratores}</p>
          <p className="text-xs text-red-400/80 mt-0.5">Detratores</p>
          <p className="text-xs text-muted-foreground">nota 0–6</p>
        </div>
      </div>

      {/* Bar */}
      <div className="flex rounded-full overflow-hidden h-3 bg-secondary/60">
        {pPro > 0 && (
          <div
            className="bg-green-500 transition-all duration-700"
            style={{ width: `${pPro}%` }}
            title={`Promotores: ${pPro}%`}
          />
        )}
        {pNeu > 0 && (
          <div
            className="bg-yellow-400 transition-all duration-700"
            style={{ width: `${pNeu}%` }}
            title={`Neutros: ${pNeu}%`}
          />
        )}
        {pDet > 0 && (
          <div
            className="bg-red-500 transition-all duration-700"
            style={{ width: `${pDet}%` }}
            title={`Detratores: ${pDet}%`}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{pPro}% promotores</span>
        <span>{pNeu}% neutros</span>
        <span>{pDet}% detratores</span>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-secondary/60 flex items-center justify-center mb-3">
        <Layers className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ─── Table header cell ────────────────────────────────────────────────────────

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3 ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm ${className}`}>{children}</td>;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function CheckinsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("checkins");

  // Hook
  const { checkins, npsRecords, csatRecords, metas, loading, avgNps, avgCsat, reload, saveCheckin, saveNps, saveCsat, saveMeta } =
    useCheckins();

  // Clients list
  const [clients, setClients] = useState<ClientOption[]>([]);

  useEffect(() => {
    supabase.from("clients").select("id, name").order("name").then(({ data }) => {
      if (data) setClients(data);
    });
  }, []);

  // Modals
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showNpsModal, setShowNpsModal] = useState(false);
  const [showCsatModal, setShowCsatModal] = useState(false);
  const [showMetaModal, setShowMetaModal] = useState(false);

  // Selected checkin for detail panel
  const [selectedCheckin, setSelectedCheckin] = useState<Checkin | null>(null);

  // Filters – Check-ins
  const [ciSearch, setCiSearch] = useState("");
  const [ciClient, setCiClient] = useState("");
  const [ciDateFrom, setCiDateFrom] = useState("");
  const [ciDateTo, setCiDateTo] = useState("");

  // Filters – NPS
  const [npsSearch, setNpsSearch] = useState("");
  const [npsClient, setNpsClient] = useState("");

  // Filters – CSAT
  const [csatSearch, setCsatSearch] = useState("");
  const [csatClient, setCsatClient] = useState("");

  // Filters – Metas
  const [metasSearch, setMetasSearch] = useState("");
  const [metasClient, setMetasClient] = useState("");

  // ── Filtered data ──────────────────────────────────────────────────────────

  const filteredCheckins = useMemo(() => {
    return checkins.filter((c) => {
      if (ciClient && c.client_id !== ciClient) return false;
      if (ciDateFrom && c.data && c.data < ciDateFrom) return false;
      if (ciDateTo && c.data && c.data > ciDateTo) return false;
      if (ciSearch) {
        const q = ciSearch.toLowerCase();
        const name = c.clients?.name?.toLowerCase() ?? "";
        const ata = c.ata?.toLowerCase() ?? "";
        const am = c.account_manager?.toLowerCase() ?? "";
        const squad = c.squad?.toLowerCase() ?? "";
        if (!name.includes(q) && !ata.includes(q) && !am.includes(q) && !squad.includes(q)) return false;
      }
      return true;
    });
  }, [checkins, ciClient, ciDateFrom, ciDateTo, ciSearch]);

  const filteredNps = useMemo(() => {
    return npsRecords.filter((r) => {
      if (npsClient && r.client_id !== npsClient) return false;
      if (npsSearch) {
        const q = npsSearch.toLowerCase();
        const name = r.clients?.name?.toLowerCase() ?? "";
        const comentario = r.comentario?.toLowerCase() ?? "";
        if (!name.includes(q) && !comentario.includes(q)) return false;
      }
      return true;
    });
  }, [npsRecords, npsClient, npsSearch]);

  const filteredCsat = useMemo(() => {
    return csatRecords.filter((r) => {
      if (csatClient && r.client_id !== csatClient) return false;
      if (csatSearch) {
        const q = csatSearch.toLowerCase();
        const name = r.clients?.name?.toLowerCase() ?? "";
        const comentario = r.comentario?.toLowerCase() ?? "";
        if (!name.includes(q) && !comentario.includes(q)) return false;
      }
      return true;
    });
  }, [csatRecords, csatClient, csatSearch]);

  const filteredMetas = useMemo(() => {
    return metas.filter((m) => {
      if (metasClient && m.client_id !== metasClient) return false;
      if (metasSearch) {
        const q = metasSearch.toLowerCase();
        const name = m.clients?.name?.toLowerCase() ?? "";
        const tipo = m.tipo_meta?.toLowerCase() ?? "";
        if (!name.includes(q) && !tipo.includes(q)) return false;
      }
      return true;
    });
  }, [metas, metasClient, metasSearch]);

  // ── Header stats ───────────────────────────────────────────────────────────

  const clientsWithMeta = useMemo(
    () => new Set(metas.map((m) => m.client_id)).size,
    [metas]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ── Page header ───────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inteligência de Clientes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              NPS, CSAT, Check-ins e Metas agregados por cliente
            </p>
          </div>
          <button
            onClick={reload}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border/50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={ClipboardList}
            label="Total Check-ins"
            value={checkins.length.toString()}
          />
          <StatCard
            icon={Star}
            label="Média NPS"
            value={avgNps !== null ? avgNps.toString() : "—"}
            badge={<NpsBadge avg={avgNps} />}
          />
          <StatCard
            icon={Award}
            label="Média CSAT"
            value={avgCsat !== null ? avgCsat.toString() : "—"}
          />
          <StatCard
            icon={Target}
            label="Clientes com Meta"
            value={clientsWithMeta.toString()}
          />
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-secondary/40 rounded-xl border border-border/50 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-background text-foreground shadow-sm border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ───────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {/* ════════════════════════════════════════════ CHECK-INS ══════════ */}
          {activeTab === "checkins" && (
            <motion.div
              key="checkins"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente, squad, ata..."
                    value={ciSearch}
                    onChange={(e) => setCiSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
                  />
                </div>

                {/* Client filter */}
                <div className="relative min-w-[160px]">
                  <SelectInput value={ciClient} onChange={setCiClient}>
                    <option value="">Todos os clientes</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </SelectInput>
                </div>

                {/* Date range */}
                <input
                  type="date"
                  value={ciDateFrom}
                  onChange={(e) => setCiDateFrom(e.target.value)}
                  className="px-3 py-2 text-sm bg-secondary/40 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
                  title="Data de"
                />
                <input
                  type="date"
                  value={ciDateTo}
                  onChange={(e) => setCiDateTo(e.target.value)}
                  className="px-3 py-2 text-sm bg-secondary/40 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
                  title="Data até"
                />

                {/* Clear filters */}
                {(ciSearch || ciClient || ciDateFrom || ciDateTo) && (
                  <button
                    onClick={() => { setCiSearch(""); setCiClient(""); setCiDateFrom(""); setCiDateTo(""); }}
                    className="px-3 py-2 text-xs rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Limpar
                  </button>
                )}

                <button
                  onClick={() => setShowCheckinModal(true)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Novo Check-in
                </button>
              </div>

              {/* Table */}
              <div className="glass rounded-xl border border-border/50 overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCheckins.length === 0 ? (
                  <EmptyState message="Nenhum check-in encontrado" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border/50 bg-secondary/20">
                        <tr>
                          <Th>Data</Th>
                          <Th>Cliente</Th>
                          <Th>Status</Th>
                          <Th>Resultado</Th>
                          <Th>Relac.</Th>
                          <Th>Entregas</Th>
                          <Th>Squad</Th>
                          <Th>Account Manager</Th>
                          <Th className="max-w-[200px]">Ata</Th>
                          <Th></Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {filteredCheckins.map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedCheckin(c)}
                            className="hover:bg-secondary/30 transition-colors cursor-pointer group"
                          >
                            <Td className="text-muted-foreground whitespace-nowrap">{formatDate(c.data)}</Td>
                            <Td>
                              <span className="font-medium text-foreground">
                                {c.clients?.name ?? "—"}
                              </span>
                            </Td>
                            <Td>
                              <StatusBadge status={c.status_atual} />
                            </Td>
                            <Td><ScoreDot value={c.resultado_score} /></Td>
                            <Td><ScoreDot value={c.relacionamento_score} /></Td>
                            <Td><ScoreDot value={c.entregas_score} /></Td>
                            <Td className="text-muted-foreground">{c.squad ?? "—"}</Td>
                            <Td className="text-muted-foreground">{c.account_manager ?? "—"}</Td>
                            <Td className="max-w-[200px]">
                              {c.ata ? (
                                <span className="text-muted-foreground line-clamp-1 text-xs">
                                  {c.ata.slice(0, 80)}{c.ata.length > 80 ? "…" : ""}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40 text-xs">—</span>
                              )}
                            </Td>
                            <Td>
                              <span className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground transition-colors text-xs">
                                <Eye className="w-3.5 h-3.5" />
                                Ver
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Row count */}
              {!loading && filteredCheckins.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {filteredCheckins.length} check-in{filteredCheckins.length !== 1 ? "s" : ""}
                </p>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════ NPS ════════════════ */}
          {activeTab === "nps" && (
            <motion.div
              key="nps"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Distribution bar */}
              <NpsDistributionBar records={npsRecords} />

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente ou comentário..."
                    value={npsSearch}
                    onChange={(e) => setNpsSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
                  />
                </div>

                <div className="relative min-w-[160px]">
                  <SelectInput value={npsClient} onChange={setNpsClient}>
                    <option value="">Todos os clientes</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </SelectInput>
                </div>

                {(npsSearch || npsClient) && (
                  <button
                    onClick={() => { setNpsSearch(""); setNpsClient(""); }}
                    className="px-3 py-2 text-xs rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Limpar
                  </button>
                )}

                <button
                  onClick={() => setShowNpsModal(true)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Registrar NPS
                </button>
              </div>

              {/* Table */}
              <div className="glass rounded-xl border border-border/50 overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredNps.length === 0 ? (
                  <EmptyState message="Nenhum registro de NPS encontrado" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border/50 bg-secondary/20">
                        <tr>
                          <Th>Data</Th>
                          <Th>Cliente</Th>
                          <Th>Nota</Th>
                          <Th>Categoria</Th>
                          <Th>Comentário</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {filteredNps.map((r) => (
                          <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                            <Td className="text-muted-foreground whitespace-nowrap">{formatDate(r.data)}</Td>
                            <Td>
                              <span className="font-medium text-foreground">{r.clients?.name ?? "—"}</span>
                            </Td>
                            <Td>
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${npsBg(r.nota)} ${npsColor(r.nota)}`}>
                                {r.nota ?? "—"}
                              </span>
                            </Td>
                            <Td>
                              {r.nota !== undefined && r.nota !== null ? (
                                <span className={`text-xs font-medium ${npsColor(r.nota)}`}>
                                  {r.nota >= 9 ? "Promotor" : r.nota >= 7 ? "Neutro" : "Detrator"}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </Td>
                            <Td>
                              <span className="text-sm text-muted-foreground line-clamp-2">
                                {r.comentario ?? "—"}
                              </span>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {!loading && filteredNps.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {filteredNps.length} registro{filteredNps.length !== 1 ? "s" : ""}
                </p>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════ CSAT ═══════════════ */}
          {activeTab === "csat" && (
            <motion.div
              key="csat"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente ou comentário..."
                    value={csatSearch}
                    onChange={(e) => setCsatSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
                  />
                </div>

                <div className="relative min-w-[160px]">
                  <SelectInput value={csatClient} onChange={setCsatClient}>
                    <option value="">Todos os clientes</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </SelectInput>
                </div>

                {(csatSearch || csatClient) && (
                  <button
                    onClick={() => { setCsatSearch(""); setCsatClient(""); }}
                    className="px-3 py-2 text-xs rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Limpar
                  </button>
                )}

                <button
                  onClick={() => setShowCsatModal(true)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Registrar CSAT
                </button>
              </div>

              {/* Table */}
              <div className="glass rounded-xl border border-border/50 overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredCsat.length === 0 ? (
                  <EmptyState message="Nenhum registro de CSAT encontrado" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border/50 bg-secondary/20">
                        <tr>
                          <Th>Data</Th>
                          <Th>Cliente</Th>
                          <Th>Geral</Th>
                          <Th>Copys</Th>
                          <Th>Designs</Th>
                          <Th>Resultados</Th>
                          <Th>Prazos</Th>
                          <Th>Gest. Campanhas</Th>
                          <Th>Comentário</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {filteredCsat.map((r) => {
                          const ScoreCell = ({ v, max = 5 }: { v: number | undefined | null; max?: number }) => (
                            <Td>
                              <span className={`font-semibold ${csatColor(v, max)}`}>
                                {v !== undefined && v !== null ? v : "—"}
                              </span>
                            </Td>
                          );
                          return (
                            <tr key={r.id} className="hover:bg-secondary/30 transition-colors">
                              <Td className="text-muted-foreground whitespace-nowrap">{formatDate(r.data)}</Td>
                              <Td>
                                <span className="font-medium text-foreground">{r.clients?.name ?? "—"}</span>
                              </Td>
                              <ScoreCell v={r.geral} max={10} />
                              <ScoreCell v={r.copys} />
                              <ScoreCell v={r.designs} />
                              <ScoreCell v={r.resultados} />
                              <ScoreCell v={r.prazos} />
                              <ScoreCell v={r.gestao_campanhas} />
                              <Td>
                                <span className="text-sm text-muted-foreground line-clamp-2">
                                  {r.comentario ?? "—"}
                                </span>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {!loading && filteredCsat.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {filteredCsat.length} registro{filteredCsat.length !== 1 ? "s" : ""}
                </p>
              )}
            </motion.div>
          )}

          {/* ════════════════════════════════════════════ METAS ══════════════ */}
          {activeTab === "metas" && (
            <motion.div
              key="metas"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por cliente ou tipo de meta..."
                    value={metasSearch}
                    onChange={(e) => setMetasSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-secondary/40 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition"
                  />
                </div>

                <div className="relative min-w-[160px]">
                  <SelectInput value={metasClient} onChange={setMetasClient}>
                    <option value="">Todos os clientes</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </SelectInput>
                </div>

                {(metasSearch || metasClient) && (
                  <button
                    onClick={() => { setMetasSearch(""); setMetasClient(""); }}
                    className="px-3 py-2 text-xs rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Limpar
                  </button>
                )}

                <button
                  onClick={() => setShowMetaModal(true)}
                  className="ml-auto flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Registrar Meta
                </button>
              </div>

              {/* Table */}
              <div className="glass rounded-xl border border-border/50 overflow-hidden">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredMetas.length === 0 ? (
                  <EmptyState message="Nenhuma meta registrada" />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b border-border/50 bg-secondary/20">
                        <tr>
                          <Th>Data</Th>
                          <Th>Cliente</Th>
                          <Th>Meta</Th>
                          <Th>Tipo da Meta</Th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {filteredMetas.map((m) => {
                          const isRevenue = !m.tipo_meta || m.tipo_meta === "Revenue";
                          return (
                            <tr key={m.id} className="hover:bg-secondary/30 transition-colors">
                              <Td className="text-muted-foreground whitespace-nowrap">{formatDate(m.data)}</Td>
                              <Td>
                                <span className="font-medium text-foreground">{m.clients?.name ?? "—"}</span>
                              </Td>
                              <Td>
                                <span className="font-semibold text-foreground">
                                  {m.meta !== undefined && m.meta !== null
                                    ? isRevenue
                                      ? formatCurrency(m.meta)
                                      : formatNumber(m.meta)
                                    : "—"}
                                </span>
                              </Td>
                              <Td>
                                {m.tipo_meta ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                    {m.tipo_meta}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {!loading && filteredMetas.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {filteredMetas.length} meta{filteredMetas.length !== 1 ? "s" : ""}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedCheckin && (
          <CheckinDetailPanel
            key={selectedCheckin.id}
            checkin={selectedCheckin}
            onClose={() => setSelectedCheckin(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Modals ────────────────────────────────────────────────────────────── */}
      <CheckinModal
        open={showCheckinModal}
        onClose={() => setShowCheckinModal(false)}
        onSave={saveCheckin}
        clients={clients}
      />

      <NpsModal
        open={showNpsModal}
        onClose={() => setShowNpsModal(false)}
        onSave={saveNps}
        clients={clients}
      />

      <CsatModal
        open={showCsatModal}
        onClose={() => setShowCsatModal(false)}
        onSave={saveCsat}
        clients={clients}
      />

      <MetaModal
        open={showMetaModal}
        onClose={() => setShowMetaModal(false)}
        onSave={saveMeta}
        clients={clients}
      />
    </div>
  );
}
