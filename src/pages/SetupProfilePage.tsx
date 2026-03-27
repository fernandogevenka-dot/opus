// Tela de onboarding — exibida uma vez após aprovação, quando funcao ainda é null
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Loader2, Rocket, Users2, TrendingUp, Zap } from "lucide-react";

// Cargos conforme nomenclatura da V4
const CARGO_OPTIONS: { value: string; label: string; description: string; icon: string }[] = [
  {
    value: "Diretor",
    label: "Diretor",
    description: "Visão estratégica e gestão da operação",
    icon: "🚀",
  },
  {
    value: "Gerente",
    label: "Gerente",
    description: "Coordena squads e entrega resultados",
    icon: "🎯",
  },
  {
    value: "Coordenador",
    label: "Coordenador",
    description: "Lidera projetos e clientes do seu squad",
    icon: "⚡",
  },
  {
    value: "Investidor",
    label: "Investidor",
    description: "Parte essencial do time que faz acontecer",
    icon: "💎",
  },
];

// Funções disponíveis
const FUNCOES = [
  "Account Manager",
  "Gestor de Tráfego",
  "Designer Gráfico",
  "Social Media",
  "Web Designer",
  "Especialista CRM",
  "Coordenador de PE&G",
  "Coordenador de CS",
  "Gerente",
  "Diretor",
  "Auxiliar Administrativo",
  "Financeiro",
  "Desenvolvedor",
];

// Itens de destaque do Opus — exibidos no lado esquerdo / topo
const HIGHLIGHTS = [
  { icon: <Rocket className="w-4 h-4" />, text: "Acompanhe projetos e resultados em tempo real" },
  { icon: <Users2 className="w-4 h-4" />, text: "Conecte-se com o seu time no escritório virtual" },
  { icon: <TrendingUp className="w-4 h-4" />, text: "Evolua com XP, títulos e rankings" },
  { icon: <Zap className="w-4 h-4" />, text: "IA do time disponível para acelerar sua rotina" },
];

export function SetupProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const [step, setStep] = useState<"cargo" | "funcao">("cargo");
  const [selectedCargo, setSelectedCargo] = useState<string>("");
  const [selectedFuncao, setSelectedFuncao] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user || !selectedCargo || !selectedFuncao) return;
    setSaving(true);
    try {
      await supabase
        .from("users")
        .update({
          cargo_titulo: selectedCargo,
          funcao: selectedFuncao,
        })
        .eq("id", user.id);
      await refreshUser();
    } catch (err) {
      console.error("[SetupProfile] save error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background decoration */}
      <div
        className="fixed inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgb(94 110 245 / 0.4) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/10">
            <img src="/v4-logo.jpg" alt="Opus" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Bem-vindo ao Opus</h1>
            <p className="text-xs text-muted-foreground">
              Olá, {user?.name?.split(" ")[0]}! Você foi aprovado.
            </p>
          </div>
        </div>

        {/* Pitch comercial */}
        <div className="mb-5 mt-3 space-y-1.5">
          {HIGHLIGHTS.map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="flex items-center gap-2.5 text-xs text-muted-foreground"
            >
              <span className="text-primary flex-shrink-0">{h.icon}</span>
              {h.text}
            </motion.div>
          ))}
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-5">
          {(["cargo", "funcao"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold transition-colors flex-shrink-0 ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : i < (step === "funcao" ? 1 : 0)
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs ${step === s ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                {s === "cargo" ? "Cargo" : "Função"}
              </span>
              {i < 1 && <div className="flex-1 h-px bg-border/50" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1 — Cargo */}
          {step === "cargo" && (
            <motion.div
              key="cargo"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-sm font-semibold mb-1">Qual é o seu cargo?</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Essa informação ajuda a personalizar sua experiência no Opus. O nível de acesso será definido pela liderança.
              </p>
              <div className="space-y-2">
                {CARGO_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedCargo(opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      selectedCargo === opt.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/50 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <span className="text-xl w-8 text-center flex-shrink-0">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.description}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                      selectedCargo === opt.value ? "border-primary bg-primary" : "border-border"
                    }`} />
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep("funcao")}
                disabled={!selectedCargo}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Step 2 — Função */}
          {step === "funcao" && (
            <motion.div
              key="funcao"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-sm font-semibold mb-1">Qual é a sua função?</h2>
              <p className="text-xs text-muted-foreground mb-4">
                Selecione a especialidade que você exerce na empresa.
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {FUNCOES.map((f) => (
                  <button
                    key={f}
                    onClick={() => setSelectedFuncao(f)}
                    className={`px-3 py-2 rounded-xl border text-xs text-left transition-all ${
                      selectedFuncao === f
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border/50 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setStep("cargo")}
                  className="flex-1 py-2.5 rounded-xl border border-border/50 text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!selectedFuncao || saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      Acessar o Opus
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
