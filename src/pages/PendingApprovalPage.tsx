import { useAuthStore } from "@/store/authStore";
import { motion } from "framer-motion";
import { Clock, LogOut } from "lucide-react";

export function PendingApprovalPage() {
  const { user, signOut } = useAuthStore();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background grid */}
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
        className="glass-strong rounded-3xl p-10 max-w-sm w-full text-center relative z-10 shadow-2xl"
      >
        <motion.div
          initial={{ scale: 0.5 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", damping: 15 }}
          className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-6 shadow-lg"
        >
          <img src="/v4-logo.jpg" alt="Opus" className="w-full h-full object-cover" />
        </motion.div>

        <div className="w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-amber-500" />
        </div>

        <h1 className="text-xl font-bold mb-2">Acesso em análise</h1>
        <p className="text-sm text-muted-foreground mb-1">
          Olá, <span className="font-medium text-foreground">{user?.name?.split(" ")[0]}</span>!
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Seu cadastro foi recebido e está aguardando aprovação da liderança. Você receberá acesso em breve.
        </p>

        <div className="glass rounded-2xl px-4 py-3 text-left mb-6 space-y-1">
          <p className="text-xs text-muted-foreground">Conta cadastrada</p>
          <p className="text-sm font-medium truncate">{user?.email}</p>
        </div>

        <button
          onClick={() => signOut()}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground border border-border/50 hover:bg-muted/30 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </motion.div>
    </div>
  );
}
