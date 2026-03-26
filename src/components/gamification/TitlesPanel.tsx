import { useGamification } from "@/hooks/useGamification";
import { useAuthStore } from "@/store/authStore";
import { Check, Lock, Zap } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  sales: "🏆 Trilha de Vendas",
  quality: "⭐ Trilha de Qualidade",
  innovation: "💡 Trilha de Inovação",
  knowledge: "📚 Trilha de Conhecimento",
};

export function TitlesPanel() {
  const { availableTitles, userTitles, equipTitle } = useGamification();
  const { user } = useAuthStore();

  const earnedIds = new Set(userTitles.map((ut) => ut.title_id));

  const byCategory = availableTitles.reduce<Record<string, typeof availableTitles>>((acc, title) => {
    if (!acc[title.category]) acc[title.category] = [];
    acc[title.category].push(title);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(byCategory).map(([category, titles]) => (
        <div key={category}>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            {CATEGORY_LABELS[category] ?? category}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {titles.map((title) => {
              const earned = earnedIds.has(title.id);
              const isActive = user?.title_active_id === title.id;

              return (
                <div
                  key={title.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isActive
                      ? "bg-primary/10 border-primary/40"
                      : earned
                      ? "glass border-border hover:border-primary/30"
                      : "opacity-40 border-border/30 bg-background"
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <span className="text-2xl">{title.icon}</span>
                    <div className="flex items-center gap-1">
                      {earned ? (
                        <span className="text-green-400">
                          <Check size={14} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          <Lock size={12} />
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-semibold">{title.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{title.criteria}</p>

                  {earned && !isActive && (
                    <button
                      onClick={() => equipTitle(title.id)}
                      className="mt-2 w-full text-xs py-1 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
                    >
                      Usar título
                    </button>
                  )}
                  {isActive && (
                    <span className="mt-2 w-full text-xs py-1 rounded-lg bg-primary/30 text-primary text-center block font-semibold">
                      Título ativo ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
