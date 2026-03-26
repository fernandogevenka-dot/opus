import { useGamification } from "@/hooks/useGamification";
import { formatXP, getLevelName } from "@/lib/utils";
import { Trophy, Zap, RefreshCw } from "lucide-react";

export function Leaderboard() {
  const { leaderboard, refreshLeaderboard } = useGamification();

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Trophy size={18} className="text-yellow-500" />
          Ranking do Mês
        </h2>
        <button
          onClick={refreshLeaderboard}
          className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary/80"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.user_id}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
              index < 3
                ? "glass bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/20"
                : "hover:bg-secondary/40"
            }`}
          >
            {/* Rank */}
            <div className="w-8 text-center">
              {index < 3 ? (
                <span className="text-xl">{medals[index]}</span>
              ) : (
                <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
              )}
            </div>

            {/* Avatar */}
            <img
              src={entry.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.user?.name ?? "?")}&background=1e2d4a&color=fff&size=36`}
              alt={entry.user?.name}
              className="w-9 h-9 rounded-full object-cover"
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">{entry.user?.name}</p>
                {entry.user?.title_active && (
                  <span className="title-badge text-xs hidden md:inline-flex">
                    {entry.user.title_active.icon} {entry.user.title_active.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{entry.user?.team}</p>
            </div>

            {/* XP */}
            <div className="flex items-center gap-1 text-right">
              <div>
                <p className="text-sm font-bold text-primary">{formatXP(entry.xp)} XP</p>
                <p className="text-xs text-muted-foreground">{getLevelName(entry.user?.level ?? 1)}</p>
              </div>
            </div>
          </div>
        ))}

        {leaderboard.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Trophy size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Nenhum dado ainda</p>
          </div>
        )}
      </div>
    </div>
  );
}
