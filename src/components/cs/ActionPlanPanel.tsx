import { useState } from "react";
import { useActionPlans, GARGALO_LABELS, type ActionPlan, type GargaloTipo, type ActionPlanStatus } from "@/hooks/useActionPlans";
import {
  Plus, ChevronDown, ChevronUp, CheckCircle, Clock,
  XCircle, AlertTriangle, Pencil, Trash2, RotateCcw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ActionPlanStatus, { label: string; color: string; icon: React.ReactNode }> = {
  aberto:       { label: "Aberto",       color: "text-blue-400",   icon: <Clock size={11} /> },
  em_andamento: { label: "Em andamento", color: "text-amber-400",  icon: <RotateCcw size={11} /> },
  concluido:    { label: "Concluído",    color: "text-emerald-400",icon: <CheckCircle size={11} /> },
  cancelado:    { label: "Cancelado",    color: "text-gray-400",   icon: <XCircle size={11} /> },
};

const GARGALO_COLORS: Record<GargaloTipo, string> = {
  retencao:  "bg-red-500/20 text-red-300 border-red-500/30",
  expansao:  "bg-amber-500/20 text-amber-300 border-amber-500/30",
  aquisicao: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  ok:        "bg-gray-500/20 text-gray-300 border-gray-500/30",
  manual:    "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

// ── Form ──────────────────────────────────────────────────────────────────────
interface FormState {
  gargalo_tipo: GargaloTipo;
  problema: string;
  hipotese: string;
  acao: string;
  owner: string;
  prazo: string;
  metrica_sucesso: string;
}

const EMPTY_FORM: FormState = {
  gargalo_tipo: "manual",
  problema: "",
  hipotese: "",
  acao: "",
  owner: "",
  prazo: "",
  metrica_sucesso: "",
};

function PlanForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<FormState>;
  onSave: (f: FormState) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.problema.trim() || !form.acao.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/10">
      {/* Gargalo tipo */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Gargalo originado</label>
        <div className="flex flex-wrap gap-1.5">
          {(["retencao", "expansao", "aquisicao", "manual"] as GargaloTipo[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set("gargalo_tipo", g)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                form.gargalo_tipo === g
                  ? GARGALO_COLORS[g]
                  : "border-white/10 text-gray-500 hover:text-gray-300"
              }`}
            >
              {GARGALO_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      <Field label="Problema *" placeholder="Qual métrica está abaixo do benchmark?">
        <textarea value={form.problema} onChange={(e) => set("problema", e.target.value)}
          placeholder="Ex: GRR de 78%, abaixo do benchmark de 85%" rows={2}
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/50" />
      </Field>

      <Field label="Hipótese" placeholder="Por que está acontecendo?">
        <textarea value={form.hipotese} onChange={(e) => set("hipotese", e.target.value)}
          placeholder="Ex: Clientes Tiny não percebem valor no 1º trimestre por falta de TTFI" rows={2}
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/50" />
      </Field>

      <Field label="Ação *" placeholder="O que fazer?">
        <textarea value={form.acao} onChange={(e) => set("acao", e.target.value)}
          placeholder="Ex: Implementar check-in de 15 dias com todos os clientes em onboarding" rows={2}
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-blue-500/50" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Owner">
          <input value={form.owner} onChange={(e) => set("owner", e.target.value)}
            placeholder="Nome do responsável"
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
        </Field>
        <Field label="Prazo">
          <input type="date" value={form.prazo} onChange={(e) => set("prazo", e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500/50" />
        </Field>
      </div>

      <Field label="Métrica de sucesso">
        <input value={form.metrica_sucesso} onChange={(e) => set("metrica_sucesso", e.target.value)}
          placeholder="Ex: GRR ≥ 85% no próximo MBR"
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50" />
      </Field>

      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={saving || !form.problema.trim() || !form.acao.trim()}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded text-xs font-medium text-white transition-colors">
          {saving ? "Salvando…" : "Salvar plano"}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors">
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ── Plan card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, onUpdate, onDelete }: {
  plan: ActionPlan;
  onUpdate: (id: string, fields: Partial<ActionPlan>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [resultado, setResultado] = useState("");
  const cfg = STATUS_CONFIG[plan.status];

  const isOverdue = plan.prazo && plan.status !== "concluido" && plan.status !== "cancelado"
    && new Date(plan.prazo) < new Date();

  async function handleStatusChange(status: ActionPlanStatus) {
    await onUpdate(plan.id, { status });
  }

  async function handleClose() {
    await onUpdate(plan.id, { status: "concluido", resultado });
    setClosing(false);
  }

  return (
    <div className={`bg-white/5 rounded-xl border ${isOverdue ? "border-red-500/30" : "border-white/10"}`}>
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <span className={`flex items-center gap-1 text-xs ${cfg.color}`}>
          {cfg.icon} {cfg.label}
        </span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${GARGALO_COLORS[plan.gargalo_tipo]}`}>
          {GARGALO_LABELS[plan.gargalo_tipo]}
        </span>
        <span className="flex-1 text-sm text-gray-200 text-left line-clamp-1">{plan.problema}</span>
        {plan.prazo && (
          <span className={`text-[10px] ${isOverdue ? "text-red-400" : "text-gray-500"}`}>
            {fmtDate(plan.prazo)}
          </span>
        )}
        {open ? <ChevronUp size={13} className="text-gray-500 flex-shrink-0" /> : <ChevronDown size={13} className="text-gray-500 flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-3">
              {editing ? (
                <PlanForm
                  initial={{ ...plan, hipotese: plan.hipotese ?? "", owner: plan.owner ?? "", prazo: plan.prazo ?? "", metrica_sucesso: plan.metrica_sucesso ?? "" }}
                  onSave={async (f) => { await onUpdate(plan.id, f); setEditing(false); }}
                  onCancel={() => setEditing(false)}
                />
              ) : (
                <>
                  <PlanField label="Problema" value={plan.problema} />
                  <PlanField label="Hipótese" value={plan.hipotese} />
                  <PlanField label="Ação" value={plan.acao} />
                  <div className="flex gap-6">
                    <PlanField label="Owner" value={plan.owner} />
                    <PlanField label="Prazo" value={plan.prazo ? fmtDate(plan.prazo) : null} />
                  </div>
                  <PlanField label="Métrica de sucesso" value={plan.metrica_sucesso} />
                  {plan.resultado && <PlanField label="Resultado" value={plan.resultado} highlight />}

                  {/* Actions */}
                  {plan.status !== "concluido" && plan.status !== "cancelado" && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {plan.status === "aberto" && (
                        <button onClick={() => handleStatusChange("em_andamento")}
                          className="px-2.5 py-1 text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full hover:bg-amber-500/30 transition-colors">
                          Iniciar
                        </button>
                      )}
                      {!closing ? (
                        <button onClick={() => setClosing(true)}
                          className="px-2.5 py-1 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full hover:bg-emerald-500/30 transition-colors">
                          Concluir
                        </button>
                      ) : (
                        <div className="w-full space-y-2">
                          <textarea value={resultado} onChange={(e) => setResultado(e.target.value)}
                            placeholder="Descreva o resultado obtido…" rows={2}
                            className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-emerald-500/50" />
                          <div className="flex gap-2">
                            <button onClick={handleClose}
                              className="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors">
                              Confirmar conclusão
                            </button>
                            <button onClick={() => setClosing(false)}
                              className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200 transition-colors">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                      <button onClick={() => handleStatusChange("cancelado")}
                        className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                        Cancelar plano
                      </button>
                      <div className="ml-auto flex items-center gap-1">
                        <button onClick={() => setEditing(true)} className="p-1.5 rounded text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors">
                          <Pencil size={12} />
                        </button>
                        <button onClick={() => onDelete(plan.id)} className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-white/5 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main ActionPlanPanel ──────────────────────────────────────────────────────
interface Props {
  defaultGargalo?: GargaloTipo;
  defaultProblema?: string;
  defaultAcao?: string;
}

export function ActionPlanPanel({ defaultGargalo, defaultProblema, defaultAcao }: Props) {
  const { openPlans, closedPlans, loading, createPlan, updatePlan, deletePlan } = useActionPlans();
  const [showForm, setShowForm] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  async function handleCreate(form: {
    gargalo_tipo: GargaloTipo; problema: string; hipotese: string;
    acao: string; owner: string; prazo: string; metrica_sucesso: string;
  }) {
    await createPlan({
      gargalo_tipo: form.gargalo_tipo,
      problema: form.problema,
      hipotese: form.hipotese || null,
      acao: form.acao,
      owner: form.owner || null,
      prazo: form.prazo || null,
      metrica_sucesso: form.metrica_sucesso || null,
      mbr_id: null,
    });
    setShowForm(false);
  }

  if (loading) return <div className="text-xs text-gray-500 py-3 text-center">Carregando planos…</div>;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Planos de Ação</span>
          {openPlans.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {openPlans.length} aberto{openPlans.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/30 rounded text-xs font-medium text-blue-300 transition-colors">
            <Plus size={12} /> Novo plano
          </button>
        )}
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <PlanForm
              initial={{
                gargalo_tipo: defaultGargalo ?? "manual",
                problema: defaultProblema ?? "",
                acao: defaultAcao ?? "",
              }}
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Open plans */}
      {openPlans.length === 0 && !showForm && (
        <div className="text-center py-6 text-gray-500 text-sm bg-white/3 rounded-lg border border-dashed border-white/10">
          <AlertTriangle size={22} className="mx-auto mb-2 opacity-30" />
          Nenhum plano de ação em aberto.
          <br />
          <span className="text-xs">Crie planos a partir dos gargalos identificados no MBR.</span>
        </div>
      )}
      <div className="space-y-2">
        {openPlans.map((p) => (
          <PlanCard key={p.id} plan={p}
            onUpdate={(id, f) => updatePlan(id, f).then(() => {})}
            onDelete={(id) => deletePlan(id).then(() => {})} />
        ))}
      </div>

      {/* Closed plans toggle */}
      {closedPlans.length > 0 && (
        <div>
          <button onClick={() => setShowClosed((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            {showClosed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {closedPlans.length} plano{closedPlans.length !== 1 ? "s" : ""} encerrado{closedPlans.length !== 1 ? "s" : ""}
          </button>
          <AnimatePresence>
            {showClosed && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2 space-y-2">
                {closedPlans.map((p) => (
                  <PlanCard key={p.id} plan={p}
                    onUpdate={(id, f) => updatePlan(id, f).then(() => {})}
                    onDelete={(id) => deletePlan(id).then(() => {})} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

function Field({ label, children, placeholder: _p }: { label: string; children: React.ReactNode; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function PlanField({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={`text-sm whitespace-pre-wrap ${highlight ? "text-emerald-300" : "text-gray-200"}`}>{value}</p>
    </div>
  );
}
