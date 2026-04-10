import { useState } from "react";
import { usePIC, type PICCycle } from "@/hooks/usePIC";
import {
  Target, ChevronDown, ChevronUp, Plus, CheckCircle,
  Clock, AlertTriangle, RotateCcw, Star,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  clientId: string;
  clientName: string;
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PICCycle["status"] }) {
  if (status === "active")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
        <Clock size={10} /> Em andamento
      </span>
    );
  if (status === "completed")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
        <CheckCircle size={10} /> Concluído
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400">
      Cancelado
    </span>
  );
}

// ── Score stars ───────────────────────────────────────────────────────────────
function ScoreStars({ score }: { score: number | null }) {
  if (score === null) return null;
  const pct = (score / 10) * 100;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
      <Star size={11} fill="currentColor" />
      {score}/10
      <span className="ml-1 text-gray-500">({pct.toFixed(0)}%)</span>
    </span>
  );
}

// ── Days progress bar ─────────────────────────────────────────────────────────
function DaysProgress({ start, end }: { start: string; end: string }) {
  const total = new Date(end).getTime() - new Date(start).getTime();
  const elapsed = Date.now() - new Date(start).getTime();
  const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const remaining = Math.max(
    0,
    Math.ceil((new Date(end).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );
  const color =
    remaining > 30 ? "bg-blue-500" : remaining > 10 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 whitespace-nowrap">
        {remaining}d restantes
      </span>
    </div>
  );
}

// ── Active cycle form ─────────────────────────────────────────────────────────
function ActiveCycleForm({
  cycle,
  onSave,
  onClose,
}: {
  cycle: PICCycle;
  onSave: (fields: Partial<PICCycle>) => Promise<unknown>;
  onClose: (review: { resultado_atingido: string; aprendizados: string; score_entrega: number }) => Promise<unknown>;
}) {
  const [fields, setFields] = useState({
    objetivo_principal: cycle.objetivo_principal ?? "",
    acoes_acordadas: cycle.acoes_acordadas ?? "",
    metricas_sucesso: cycle.metricas_sucesso ?? "",
  });
  const [review, setReview] = useState({
    resultado_atingido: "",
    aprendizados: "",
    score_entrega: 8,
  });
  const [mode, setMode] = useState<"edit" | "close">("edit");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(fields);
    setSaving(false);
  }

  async function handleClose() {
    setSaving(true);
    await onClose(review);
    setSaving(false);
  }

  return (
    <div className="mt-3 space-y-3">
      {/* Tab toggle */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1 w-fit">
        <button
          onClick={() => setMode("edit")}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            mode === "edit"
              ? "bg-white/10 text-white"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Editar PIC
        </button>
        <button
          onClick={() => setMode("close")}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            mode === "close"
              ? "bg-white/10 text-white"
              : "text-gray-400 hover:text-gray-300"
          }`}
        >
          Fechar ciclo
        </button>
      </div>

      {mode === "edit" ? (
        <>
          <Textarea
            label="Objetivo principal / valor esperado"
            value={fields.objetivo_principal}
            onChange={(v) => setFields((f) => ({ ...f, objetivo_principal: v }))}
            placeholder="Ex: Aumentar em 30% o volume de leads qualificados via conteúdo"
          />
          <Textarea
            label="Ações acordadas"
            value={fields.acoes_acordadas}
            onChange={(v) => setFields((f) => ({ ...f, acoes_acordadas: v }))}
            placeholder="Liste as iniciativas e responsáveis acordados"
          />
          <Textarea
            label="Métricas de sucesso"
            value={fields.metricas_sucesso}
            onChange={(v) => setFields((f) => ({ ...f, metricas_sucesso: v }))}
            placeholder="Como saberemos que o objetivo foi atingido?"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-xs font-medium text-white transition-colors"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </>
      ) : (
        <>
          <Textarea
            label="Resultado atingido"
            value={review.resultado_atingido}
            onChange={(v) => setReview((r) => ({ ...r, resultado_atingido: v }))}
            placeholder="O que foi efetivamente entregue neste ciclo?"
          />
          <Textarea
            label="Aprendizados"
            value={review.aprendizados}
            onChange={(v) => setReview((r) => ({ ...r, aprendizados: v }))}
            placeholder="O que aprendemos e o que faremos diferente?"
          />
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Nota de entrega (0–10)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={10}
                step={1}
                value={review.score_entrega}
                onChange={(e) =>
                  setReview((r) => ({ ...r, score_entrega: Number(e.target.value) }))
                }
                className="flex-1"
              />
              <span className="text-sm font-semibold text-white w-5 text-right">
                {review.score_entrega}
              </span>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={saving || !review.resultado_atingido}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded text-xs font-medium text-white transition-colors flex items-center gap-1.5"
          >
            <CheckCircle size={13} />
            {saving ? "Fechando…" : "Concluir ciclo e abrir próximo"}
          </button>
        </>
      )}
    </div>
  );
}

// ── Past cycle card ───────────────────────────────────────────────────────────
function PastCycleCard({ cycle }: { cycle: PICCycle }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/5 rounded-lg border border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-500">
            Ciclo {cycle.cycle_number}
          </span>
          <span className="text-xs text-gray-400">
            {fmtDate(cycle.start_date)} → {fmtDate(cycle.end_date)}
          </span>
          <StatusBadge status={cycle.status} />
          {cycle.score_entrega !== null && (
            <ScoreStars score={cycle.score_entrega} />
          )}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
              <Field label="Objetivo" value={cycle.objetivo_principal} />
              <Field label="Ações acordadas" value={cycle.acoes_acordadas} />
              <Field label="Métricas de sucesso" value={cycle.metricas_sucesso} />
              {cycle.status === "completed" && (
                <>
                  <hr className="border-white/10" />
                  <Field label="Resultado atingido" value={cycle.resultado_atingido} />
                  <Field label="Aprendizados" value={cycle.aprendizados} />
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main PICPanel ─────────────────────────────────────────────────────────────
export function PICPanel({ clientId, clientName }: Props) {
  const { cycles, activeCycle, loading, openCycle, updateCycle, closeCycle } =
    usePIC(clientId);
  const [opening, setOpening] = useState(false);

  const pastCycles = cycles.filter((c) => c.status !== "active");

  async function handleOpen() {
    setOpening(true);
    await openCycle();
    setOpening(false);
  }

  async function handleClose(review: {
    resultado_atingido: string;
    aprendizados: string;
    score_entrega: number;
  }) {
    if (!activeCycle) return;
    await closeCycle(activeCycle.id, review);
    // Automatically open next cycle
    setTimeout(() => openCycle(), 300);
  }

  if (loading)
    return (
      <div className="text-xs text-gray-500 py-4 text-center">
        Carregando PIC…
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target size={16} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">
            Plano de Impacto Conjunto
          </span>
          {cycles.length > 0 && (
            <span className="text-xs text-gray-500">
              {cycles.length} ciclo{cycles.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {!activeCycle && (
          <button
            onClick={handleOpen}
            disabled={opening}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 rounded text-xs font-medium text-blue-300 transition-colors"
          >
            <Plus size={12} />
            {opening ? "Abrindo…" : cycles.length === 0 ? "Iniciar PIC" : "Novo ciclo"}
          </button>
        )}
      </div>

      {/* No cycles yet */}
      {cycles.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-sm bg-white/3 rounded-lg border border-dashed border-white/10">
          <Target size={24} className="mx-auto mb-2 opacity-30" />
          Nenhum ciclo PIC iniciado para {clientName}.
          <br />
          <span className="text-xs">Ciclos duram 90 dias e ficam registrados no histórico.</span>
        </div>
      )}

      {/* Active cycle */}
      {activeCycle && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400">
                Ciclo {activeCycle.cycle_number}
              </span>
              <StatusBadge status="active" />
            </div>
            <span className="text-xs text-gray-500">
              {fmtDate(activeCycle.start_date)} → {fmtDate(activeCycle.end_date)}
            </span>
          </div>
          <DaysProgress start={activeCycle.start_date} end={activeCycle.end_date} />
          <ActiveCycleForm
            cycle={activeCycle}
            onSave={(fields) => updateCycle(activeCycle.id, fields)}
            onClose={handleClose}
          />
        </div>
      )}

      {/* History */}
      {pastCycles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Histórico
          </p>
          {pastCycles
            .slice()
            .reverse()
            .map((c) => (
              <PastCycleCard key={c.id} cycle={c} />
            ))}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-200 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/50"
      />
    </div>
  );
}
