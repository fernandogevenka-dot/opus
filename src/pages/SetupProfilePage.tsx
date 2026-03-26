// Tela de setup de função — exibida uma vez após aprovação, quando funcao ainda é null
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { ChevronRight, Loader2 } from "lucide-react";

const ROLE_OPTIONS: { value: string; label: string; description: string; icon: string }[] = [
  {
    value: "gerencia_peg",
    label: "Gerência PE&G",
    description: "Acesso total à plataforma",
    icon: "👑",
  },
  {
    value: "coord_admin",
    label: "Coordenador Administrativo",
    description: "Acesso total à plataforma",
    icon: "⚙️",
  },
  {
    value: "coord_peg",
    label: "Coordenador PE&G",
    description: "Seus projetos, squads, time e remunerações do seu time",
    icon: "🎯",
  },
  {
    value: "colaborador",
    label: "Colaborador",
    description: "Seu cadastro, clientes da sua carteira e áreas do sistema",
    icon: "👤",
  },
];

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

export function SetupProfilePage() {
  const { user, refreshUser } = useAuthStore();
  const [step, setStep] = useState<"role" | "funcao">("role");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedFuncao, setSelectedFuncao] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user || !selectedRole || !selectedFuncao) return;
    setSaving(true);
    try {
      await supabase
        .from("users")
        .update({ opus_role: selectedRole, funcao: selectedFuncao })
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
      <div
        className="fixed inset-0 opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgb(94 110 245 / 0.4) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-strong rounded-3xl p-8 max-w-md w-full relative z-10 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
            <img src="/v4-logo.jpg" alt="Opus" className="w-full h-full object-cover" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Bem-vindo ao Opus</h1>
            <p className="text-xs text-muted-foreground">
              Olá, {user?.name?.split(" ")[0]}! Configure seu perfil para começar.
            </p>
          </div>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          {["role", "funcao"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-semibold transition-colors ${
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : i < ["role", "funcao"].indexOf(step)
                    ? "bg-green-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              {i < 1 && <div className="flex-1 h-px bg-border/50" />}
            </div>
          ))}
        </div>

        {/* Step 1 — Hierarquia */}
        {step === "role" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-sm font-semibold mb-1">Qual é seu nível de acesso?</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Selecione sua hierarquia na empresa. A liderança validará sua escolha.
            </p>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedRole(opt.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                    selectedRole === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <span className="text-xl">{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </div>
                  {selectedRole === opt.value && (
                    <div className="w-4 h-4 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep("funcao")}
              disabled={!selectedRole}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Continuar
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Step 2 — Função */}
        {step === "funcao" && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <h2 className="text-sm font-semibold mb-1">Qual é sua função?</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Selecione o cargo que você exerce na empresa.
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
              {FUNCOES.map((f) => (
                <button
                  key={f}
                  onClick={() => setSelectedFuncao(f)}
                  className={`px-3 py-2 rounded-xl border text-xs text-left transition-colors ${
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
                onClick={() => setStep("role")}
                className="flex-1 py-2.5 rounded-xl border border-border/50 text-sm text-muted-foreground hover:bg-muted/30 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleSave}
                disabled={!selectedFuncao || saving}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar no Opus"}
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
