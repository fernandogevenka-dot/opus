import { useState } from "react";
import { BookOpen, Lock, CheckCircle, Zap, ChevronRight } from "lucide-react";
import type { LearningTrack } from "@/types";

const MOCK_TRACKS: LearningTrack[] = [
  {
    id: "python-basics",
    title: "Python para Iniciantes",
    description: "Aprenda a programar em Python do zero, com exercícios práticos voltados para automação de tarefas no dia a dia.",
    difficulty: "beginner",
    xp_reward: 60,
    challenges: [],
  },
  {
    id: "google-sheets-pro",
    title: "Google Sheets Avançado",
    description: "Domine fórmulas avançadas, scripts com Google Apps Script e integração com outras ferramentas Google.",
    difficulty: "beginner",
    xp_reward: 60,
    challenges: [],
  },
  {
    id: "apis-rest",
    title: "Integrações com APIs",
    description: "Entenda como funcionam as APIs REST e aprenda a conectar sistemas diferentes usando Python e JavaScript.",
    difficulty: "intermediate",
    xp_reward: 60,
    challenges: [],
  },
  {
    id: "automation-python",
    title: "Automação com Python",
    description: "Crie scripts para automatizar tarefas repetitivas: relatórios, e-mails, planilhas e processamento de dados.",
    difficulty: "intermediate",
    xp_reward: 60,
    challenges: [],
  },
  {
    id: "sql-data",
    title: "SQL e Análise de Dados",
    description: "Consulte bancos de dados, gere insights e crie relatórios poderosos usando SQL.",
    difficulty: "intermediate",
    xp_reward: 60,
    challenges: [],
  },
  {
    id: "ai-workflows",
    title: "IA nos Processos de Negócio",
    description: "Aprenda a integrar IA (Claude, GPT, Gemini) nos processos da empresa para ganhar produtividade.",
    difficulty: "advanced",
    xp_reward: 60,
    challenges: [],
  },
];

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: "text-green-400 bg-green-500/20",
  intermediate: "text-yellow-400 bg-yellow-500/20",
  advanced: "text-red-400 bg-red-500/20",
};

export function LearningTracks() {
  const [completedTracks] = useState<string[]>([]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mb-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <BookOpen size={18} className="text-primary" />
          Trilhas de Aprendizado
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Complete trilhas para ganhar XP e desbloquear o título "Curioso Digital"
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {MOCK_TRACKS.map((track) => {
          const done = completedTracks.includes(track.id);

          return (
            <div
              key={track.id}
              className={`glass rounded-2xl p-4 cursor-pointer hover:border-primary/30 transition-all group ${
                done ? "border-green-500/30 bg-green-500/5" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="font-semibold text-sm">{track.title}</h3>
                    {done && <CheckCircle size={14} className="text-green-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    {track.description}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLOR[track.difficulty]}`}>
                      {DIFFICULTY_LABEL[track.difficulty]}
                    </span>
                    <span className="xp-badge text-xs">
                      <Zap size={10} />
                      +{track.xp_reward} XP
                    </span>
                  </div>
                </div>

                <ChevronRight
                  size={16}
                  className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
