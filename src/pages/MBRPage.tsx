import { useState } from "react";
import { useMBR, type MBRSession } from "@/hooks/useMBR";
import { useGTMCockpit } from "@/hooks/useGTMCockpit";
import { ActionPlanPanel } from "@/components/cs/ActionPlanPanel";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, ChevronDown, ChevronUp, TrendingUp,
  TrendingDown, Minus, CheckCircle2, AlertTriangle, Plus,
  BarChart3,
} from "lucide-react";
import type { GargaloTipo } from "@/hooks/useActionPlans";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtMRR(v: number | null): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)    return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${v.toLocaleString("pt-BR")}`;
}
function fmtPct(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}%` : "—";
}
function fmtMes(mes: string): string {
  const [y, m] = mes.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

const GARGALO_OPTIONS: { id: GargaloTipo; label: string; color: string }[] = [
  { id: "retencao",  label: "Retenção",  color: "bg-red-500/20 text-red-300 border-red-500/30" },
  { id: "expansao",  label: "Expansão",  color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  { id: "aquisicao", label: "Aquisição", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: "ok",        label: "Saudável",  color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
];

// ── Metric snapshot card ──────────────────────────────────────────────────────
function SnapshotCard({ label, value, benchmark, good }: {
  label: string; value: string; benchmark?: string; good?: boolean | null;
}) {
  const color = good == null ? "text-gray-300"
    : good ? "text-emerald-400" : "text-red-400";
  const Icon = good == null ? Minus : good ? TrendingUp : TrendingDown;
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-3 flex flex-col gap-1">
      <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>
      <div className="flex items-end gap-1.5">
        <span className={`text-xl font-bold ${color}`}>{value}</span>
        <Icon size={13} className={`${color} mb-0.5`} />
      </div>
      {benchmark && <span className="text-[10px] text-gray-600">benchmark {benchmark}</span>}
    </div>
  );
}

// ── MBR form (inline for current month) ──────────────────────────────────────
function MBRForm({ session, mes, snapshot, onSave }: {
  session: MBRSession | null;
  mes: string;
  snapshot: { mrr: number; grr: number; nrr: number; churn: number; crescimento: number; horizonte: string };
  onSave: (fields: Partial<MBRSession>) => Promise<void>;
}) {
  const [gargalo, setGargalo] = useState<GargaloTipo>(session?.gargalo_identificado ?? "ok");
  const [gargaloNotas, setGargaloNotas] = useState(session?.gargalo_notas ?? "");
  const [participantes, setParticipantes] = useState(session?.participantes ?? "");
  const [notas, setNotas] = useState(session?.notas_gerais ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({
      mes,
      mrr_snapshot: snapshot.mrr,
      grr_snapshot: snapshot.grr,
      nrr_snapshot: snapshot.nrr,
      churn_snapshot: snapshot.churn,
      crescimento_snapshot: snapshot.crescimento,
      horizonte_snapshot: snapshot.horizonte,
      gargalo_identificado: gargalo,
      gargalo_notas: gargaloNotas || null,
      participantes: participantes || null,
      notas_gerais: notas || null,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Snapshot automático */}
      <div>
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Snapshot automático</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <SnapshotCard label="MRR" value={fmtMRR(snapshot.mrr)} />
          <SnapshotCard label="GRR" value={fmtPct(snapshot.grr)} benchmark="> 85%" good={snapshot.grr >= 85} />
          <SnapshotCard label="NRR" value={fmtPct(snapshot.nrr)} benchmark="> 100%" good={snapshot.nrr >= 100} />
          <SnapshotCard label="Churn" value={fmtPct(snapshot.churn)} benchmark="< 3%" good={snapshot.churn <= 3} />
          <SnapshotCard label="Crescimento" value={fmtPct(snapshot.crescimento)} />
          <SnapshotCard label="Horizonte" value={snapshot.horizonte} />
        </div>
      </div>

      {/* Gargalo identificado */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Gargalo identificado na reunião</p>
        <div className="flex flex-wrap gap-2">
          {GARGALO_OPTIONS.map((g) => (
            <button key={g.id} onClick={() => setGargalo(g.id)}
              className={`px-3 py-1.5 rounded-full text-xs border font-medium transition-all ${
                gargalo === g.id ? g.color : "border-white/10 text-gray-500 hover:text-gray-300"
              }`}>
              {g.label}
            </button>
          ))}
        </div>
        <textarea value={gargaloNotas} onChange={(e) => setGargaloNotas(e.target.value)}
          placeholder="Anotações sobre o gargalo (opcional)…" rows={2}
          className="mt-2 w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/50" />
      </div>

      {/* Participantes */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Participantes</label>
        <input value={participantes} onChange={(e) => setParticipantes(e.target.value)}
          placeholder="Ex: Fernando, Rodrigo, Ana"
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
      </div>

      {/* Notas gerais */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Notas gerais da reunião</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
          placeholder="Decisões, próximos passos, pontos de atenção…" rows={4}
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/50" />
      </div>

      <button onClick={handleSave} disabled={saving}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2">
        {saving ? "Salvando…" : saved ? <><CheckCircle2 size={14} /> Salvo!</> : "Salvar MBR"}
      </button>
    </div>
  );
}

// ── Past MBR card ─────────────────────────────────────────────────────────────
function PastMBRCard({ session }: { session: MBRSession }) {
  const [open, setOpen] = useState(false);
  const gargaloCfg = GARGALO_OPTIONS.find((g) => g.id === session.gargalo_identificado);
  return (
    <div className="bg-white/5 rounded-xl border border-white/10">
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <CalendarDays size={13} className="text-gray-500 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-200 capitalize flex-1">{fmtMes(session.mes)}</span>
        {gargaloCfg && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] border ${gargaloCfg.color}`}>
            {gargaloCfg.label}
          </span>
        )}
        <span className="text-xs text-gray-500">{fmtMRR(session.mrr_snapshot)}</span>
        {open ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-4">
              {/* Metrics */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <SnapshotCard label="MRR" value={fmtMRR(session.mrr_snapshot)} />
                <SnapshotCard label="GRR" value={fmtPct(session.grr_snapshot)} benchmark="> 85%" good={session.grr_snapshot != null ? session.grr_snapshot >= 85 : null} />
                <SnapshotCard label="NRR" value={fmtPct(session.nrr_snapshot)} benchmark="> 100%" good={session.nrr_snapshot != null ? session.nrr_snapshot >= 100 : null} />
                <SnapshotCard label="Churn" value={fmtPct(session.churn_snapshot)} benchmark="< 3%" good={session.churn_snapshot != null ? session.churn_snapshot <= 3 : null} />
                <SnapshotCard label="Crescimento" value={fmtPct(session.crescimento_snapshot)} />
                <SnapshotCard label="Horizonte" value={session.horizonte_snapshot ?? "—"} />
              </div>
              {session.gargalo_notas && <PField label="Notas do gargalo" value={session.gargalo_notas} />}
              {session.participantes && <PField label="Participantes" value={session.participantes} />}
              {session.notas_gerais && <PField label="Notas gerais" value={session.notas_gerais} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main MBRPage ──────────────────────────────────────────────────────────────
export function MBRPage() {
  const { sessions, currentSession, currentMes, loading: mbrLoading, upsertSession } = useMBR();
  const { data: cockpitData, loading: cockpitLoading } = useGTMCockpit();

  const pastSessions = sessions.filter((s) => s.mes !== currentMes);

  const snapshot = cockpitData
    ? {
        mrr: cockpitData.mrrAtual,
        grr: cockpitData.grr,
        nrr: cockpitData.nrr,
        churn: cockpitData.churnRate,
        crescimento: cockpitData.crescimentoMedio,
        horizonte: cockpitData.horizonteInfo.horizonte,
      }
    : { mrr: 0, grr: 0, nrr: 0, churn: 0, crescimento: 0, horizonte: "—" };

  const loading = mbrLoading || cockpitLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-sm animate-pulse">Carregando MBR…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-6 py-6 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays size={20} className="text-blue-400" />
            Monthly Business Review
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Ritual mensal de identificação de gargalo e alinhamento do plano de ação — GTM Engineering SCIENT
          </p>
        </div>

        {/* MBR do mês atual */}
        <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold capitalize">{fmtMes(currentMes)}</h2>
              <p className="text-xs text-gray-500 mt-0.5">MBR atual</p>
            </div>
            {currentSession && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 size={11} /> Registrado
              </span>
            )}
          </div>

          <MBRForm
            session={currentSession}
            mes={currentMes}
            snapshot={snapshot}
            onSave={(fields) => upsertSession({ mes: currentMes, ...fields }).then(() => {})}
          />
        </section>

        {/* Planos de Ação */}
        <section className="rounded-2xl border border-border/50 bg-card p-5">
          <ActionPlanPanel
            defaultGargalo={currentSession?.gargalo_identificado ?? "manual"}
            defaultProblema={currentSession?.gargalo_notas ?? ""}
          />
        </section>

        {/* Histórico de MBRs */}
        {pastSessions.length > 0 && (
          <section className="rounded-2xl border border-border/50 bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 size={15} className="text-gray-400" />
              Histórico de MBRs
              <span className="text-xs text-gray-500 font-normal">({pastSessions.length})</span>
            </h2>
            <div className="space-y-2">
              {pastSessions.map((s) => (
                <PastMBRCard key={s.id} session={s} />
              ))}
            </div>
          </section>
        )}

        {pastSessions.length === 0 && (
          <div className="text-center py-8 text-gray-600 text-sm">
            <BarChart3 size={28} className="mx-auto mb-2 opacity-20" />
            O histórico de MBRs anteriores aparece aqui.
          </div>
        )}

      </div>
    </div>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────
function PField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-200 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
