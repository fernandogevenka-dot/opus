import { useState, useRef, useEffect } from "react";
import { useAI } from "@/hooks/useAI";
import { useFeed } from "@/hooks/useFeed";
import { useAuthStore } from "@/store/authStore";
import { ChatMessage } from "@/components/ai/ChatMessage";
import { LearningTracks } from "@/components/ai/LearningTracks";
import {
  Send, Square, Plus, BookOpen, MessageSquare, Sparkles, Share2,
  Flame, Zap, Trophy, Target, Code2, ChevronRight, Lightbulb,
  BarChart3, Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Streak helpers ────────────────────────────────────────────────────────

const STREAK_KEY = "atlas_streak";

interface StreakData {
  count: number;
  lastDate: string; // ISO date "YYYY-MM-DD"
  longestStreak: number;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getStreakData(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw) as StreakData;
  } catch {
    // ignore
  }
  return { count: 0, lastDate: "", longestStreak: 0 };
}

function markStreakToday(): StreakData {
  const today = getTodayStr();
  const data = getStreakData();
  if (data.lastDate === today) return data; // already counted today

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const newCount = data.lastDate === yesterdayStr ? data.count + 1 : 1;
  const updated: StreakData = {
    count: newCount,
    lastDate: today,
    longestStreak: Math.max(data.longestStreak, newCount),
  };
  localStorage.setItem(STREAK_KEY, JSON.stringify(updated));
  return updated;
}

// ─── Desafio do dia ─────────────────────────────────────────────────────────

interface DailyChallenge {
  icon: string;
  title: string;
  description: string;
  prompt: string;
  xp: number;
  tag: string;
}

const DAILY_CHALLENGES: DailyChallenge[] = [
  {
    icon: "🐍",
    title: "Script de automação",
    description: "Crie um script Python que leia um CSV e envie um resumo por e-mail automaticamente.",
    prompt: "Cria um script Python completo que lê um arquivo CSV de dados de vendas, gera um resumo com total de vendas por vendedor e envia por e-mail via SMTP. Explica cada parte do código.",
    xp: 150,
    tag: "Python",
  },
  {
    icon: "📊",
    title: "Dashboard no Sheets",
    description: "Use Apps Script para criar um dashboard automático no Google Sheets com dados de vendas.",
    prompt: "Como criar um Google Apps Script que busca dados de uma API REST, preenche uma planilha do Google Sheets automaticamente e cria um gráfico de linha com os resultados? Me dá o código completo.",
    xp: 120,
    tag: "Apps Script",
  },
  {
    icon: "🔗",
    title: "Integração via Webhook",
    description: "Conecte dois sistemas usando webhooks — sem código complexo.",
    prompt: "Explica como criar um servidor webhook simples com Node.js que recebe dados de um formulário, valida os campos e salva em um banco de dados SQLite. Inclui o código completo e como fazer o deploy gratuito.",
    xp: 130,
    tag: "Node.js",
  },
  {
    icon: "🤖",
    title: "Bot de mensagens",
    description: "Crie um bot para Telegram ou WhatsApp que responde perguntas automaticamente.",
    prompt: "Cria um bot para Telegram com Python que responde perguntas frequentes sobre horário de atendimento, preços e contato. Usa a biblioteca python-telegram-bot e explica como fazer o deploy.",
    xp: 180,
    tag: "Bot",
  },
  {
    icon: "🗄️",
    title: "Query SQL avançada",
    description: "Domine JOINs e agregações para extrair insights de dados de clientes.",
    prompt: "Me ensina a criar uma query SQL avançada que combina dados de clientes, pedidos e produtos usando JOINs, calcula LTV por cliente, agrupa por segmento e filtra os top 20. Usa PostgreSQL e explica cada parte.",
    xp: 100,
    tag: "SQL",
  },
  {
    icon: "📱",
    title: "Automação com n8n",
    description: "Crie um fluxo no n8n que conecta CRM, e-mail e Slack sem escrever código.",
    prompt: "Como criar um workflow no n8n que: (1) monitora novos leads no CRM, (2) envia e-mail de boas-vindas personalizado, (3) cria tarefa no Notion e (4) notifica o time no Slack? Explica cada nó e como configurar.",
    xp: 110,
    tag: "No-code",
  },
  {
    icon: "⚡",
    title: "API REST do zero",
    description: "Crie uma API REST completa com autenticação JWT em menos de 50 linhas.",
    prompt: "Cria uma API REST completa com FastAPI (Python) que tem: autenticação JWT, endpoints CRUD para clientes, validação com Pydantic e documentação automática. O código deve caber em um único arquivo e ser pronto para produção.",
    xp: 200,
    tag: "FastAPI",
  },
];

function getDailyChallenge(): DailyChallenge {
  const dayOfYear = Math.floor(Date.now() / 86400000);
  return DAILY_CHALLENGES[dayOfYear % DAILY_CHALLENGES.length];
}

// ─── Sugestões proativas ───────────────────────────────────────────────────

interface ProactiveSuggestion {
  icon: string;
  category: string;
  text: string;
  prompt: string;
}

const PROACTIVE_SUGGESTIONS: ProactiveSuggestion[] = [
  {
    icon: "📈",
    category: "Vendas",
    text: "Automatizar follow-up de leads",
    prompt: "Cria um script Python que verifica leads sem follow-up há mais de 3 dias no meu CRM e envia um e-mail personalizado para cada um.",
  },
  {
    icon: "📊",
    category: "Analytics",
    text: "Dashboard de métricas em tempo real",
    prompt: "Como criar um dashboard simples com Streamlit que exibe métricas de vendas em tempo real buscando dados de uma planilha do Google Sheets?",
  },
  {
    icon: "🔄",
    category: "Automação",
    text: "Relatório semanal automático",
    prompt: "Cria um script que roda toda segunda-feira, busca os dados de vendas da semana anterior e envia um relatório formatado para o time via e-mail.",
  },
  {
    icon: "🤝",
    category: "CS",
    text: "Alertas de churn com IA",
    prompt: "Como criar um modelo simples de machine learning que identifica clientes com risco de churn baseado em dados de uso e histórico de interações?",
  },
  {
    icon: "💬",
    category: "Comunicação",
    text: "Templates de mensagem com IA",
    prompt: "Cria um sistema simples que gera templates personalizados de mensagens para diferentes situações de vendas usando a API do Claude.",
  },
  {
    icon: "🔍",
    category: "Dados",
    text: "Enriquecer dados de clientes",
    prompt: "Como enriquecer automaticamente minha base de leads com dados públicos (LinkedIn, site da empresa, CNPJ) usando Python e web scraping?",
  },
];

// ─── Componente ────────────────────────────────────────────────────────────

export function AIPage() {
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<"chat" | "tracks">("chat");
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [challengeAccepted, setChallengeAccepted] = useState(false);
  const [streakData, setStreakData] = useState<StreakData>(getStreakData);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuthStore();
  const {
    messages,
    streaming,
    conversations,
    activeConversationId,
    loadConversations,
    newConversation,
    loadConversation,
    sendMessage,
    stopStreaming,
  } = useAI();

  const { createPost } = useFeed();

  const dailyChallenge = getDailyChallenge();

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const msg = text ?? input;
    if (!msg.trim() || streaming) return;
    setInput("");

    // Mark streak on first message of the day
    const updated = markStreakToday();
    setStreakData(updated);

    await sendMessage(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function acceptChallenge() {
    setChallengeAccepted(true);
    setInput(dailyChallenge.prompt);
    inputRef.current?.focus();
  }

  async function shareToFeed() {
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    await createPost(
      "ai_solution",
      "Solução criada com IA",
      lastAssistant.content.slice(0, 300) + (lastAssistant.content.length > 300 ? "..." : ""),
      { conversation_id: activeConversationId }
    );
    setShowShareConfirm(true);
    setTimeout(() => setShowShareConfirm(false), 3000);
  }

  const hasMessages = messages.length > 0;
  const firstName = user?.name?.split(" ")[0] ?? "Você";
  const streakActive = streakData.lastDate === getTodayStr();

  return (
    <div className="flex h-full gap-4">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <div className="w-56 flex-shrink-0 flex flex-col gap-2">

        {/* Streak card */}
        <div className={`glass rounded-2xl p-3 border ${streakActive ? "border-orange-500/30 bg-orange-500/5" : "border-border/50"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Flame size={14} className={streakActive ? "text-orange-400" : "text-muted-foreground"} />
            <span className="text-xs font-semibold text-foreground">Sequência Atlas</span>
          </div>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-bold ${streakActive ? "text-orange-400" : "text-muted-foreground"}`}>
              {streakData.count}
            </span>
            <span className="text-xs text-muted-foreground mb-1">dias seguidos</span>
          </div>
          {!streakActive && streakData.count > 0 && (
            <p className="text-xs text-orange-400/70 mt-1">⚠️ Use hoje para não perder!</p>
          )}
          {streakActive && (
            <p className="text-xs text-orange-400/70 mt-1">🔥 Ativo hoje!</p>
          )}
          {streakData.longestStreak > 1 && (
            <p className="text-xs text-muted-foreground mt-1">
              Recorde: {streakData.longestStreak} dias
            </p>
          )}
        </div>

        {/* New conversation */}
        <button
          onClick={newConversation}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 hover:bg-secondary/80 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Plus size={14} />
          Nova conversa
        </button>

        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "chat" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare size={12} />
            Chat
          </button>
          <button
            onClick={() => setActiveTab("tracks")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === "tracks" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen size={12} />
            Trilhas
          </button>
        </div>

        {/* Conversation history */}
        {activeTab === "chat" && (
          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-2">Nenhuma conversa ainda.</p>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors truncate ${
                    activeConversationId === conv.id
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  }`}
                >
                  {conv.title}
                </button>
              ))
            )}
          </div>
        )}

        {/* Stats footer */}
        <div className="glass rounded-xl p-2 space-y-1.5 mt-auto">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Trophy size={10} /> Recorde
            </span>
            <span className="text-xs font-medium text-yellow-400">{streakData.longestStreak}d</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <BarChart3 size={10} /> Conversas
            </span>
            <span className="text-xs font-medium">{conversations.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock size={10} /> Hoje
            </span>
            <span className="text-xs font-medium">{streakActive ? "✓ Ativo" : "—"}</span>
          </div>
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeTab === "tracks" ? (
          <LearningTracks />
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Atlas AI</p>
                  <p className="text-xs text-muted-foreground">Seu co-piloto de tecnologia e automação</p>
                </div>
              </div>

              {hasMessages && (
                <div className="relative">
                  <button
                    onClick={shareToFeed}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border/50 hover:bg-secondary/80 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Share2 size={13} />
                    Compartilhar no feed
                  </button>
                  <AnimatePresence>
                    {showShareConfirm && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full mt-1 right-0 bg-green-500/20 text-green-400 text-xs px-3 py-1.5 rounded-lg border border-green-500/30 whitespace-nowrap"
                      >
                        ✓ Publicado no feed! +40 XP
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
              {!hasMessages ? (
                <div className="flex flex-col gap-4 h-full overflow-y-auto">

                  {/* Greeting */}
                  <div className="text-center pt-2">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center mx-auto mb-3">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    <h2 className="font-semibold text-base mb-0.5">
                      {streakActive
                        ? `${streakData.count} dias seguidos, ${firstName}! 🔥`
                        : `Olá, ${firstName}. Pronto para aprender?`}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Automações, código, dados — pergunte qualquer coisa.
                    </p>
                  </div>

                  {/* Desafio do dia */}
                  <div className={`glass rounded-2xl p-4 border ${challengeAccepted ? "border-primary/40 bg-primary/5" : "border-border/50"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Target size={14} className="text-primary" />
                        <span className="text-xs font-semibold text-foreground">Desafio do Dia</span>
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                          {dailyChallenge.tag}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-yellow-400 font-semibold">
                        <Zap size={10} />
                        +{dailyChallenge.xp} XP
                      </span>
                    </div>
                    <p className="text-sm font-medium mb-1">
                      {dailyChallenge.icon} {dailyChallenge.title}
                    </p>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      {dailyChallenge.description}
                    </p>
                    <button
                      onClick={acceptChallenge}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        challengeAccepted
                          ? "bg-primary/20 text-primary"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                    >
                      <Code2 size={12} />
                      {challengeAccepted ? "Desafio no campo de texto ↓" : "Aceitar desafio"}
                      {!challengeAccepted && <ChevronRight size={12} />}
                    </button>
                  </div>

                  {/* Sugestões proativas */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Lightbulb size={12} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Sugestões para o seu time</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {PROACTIVE_SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(s.prompt)}
                          className="flex items-start gap-2 p-3 rounded-xl glass border-border/50 hover:border-primary/30 hover:bg-secondary/40 text-left text-xs text-muted-foreground hover:text-foreground transition-all"
                        >
                          <span className="text-base flex-shrink-0">{s.icon}</span>
                          <div>
                            <span className="block text-[10px] text-primary font-medium mb-0.5">{s.category}</span>
                            <span className="leading-relaxed">{s.text}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <ChatMessage
                      key={i}
                      message={msg}
                      streaming={streaming && i === messages.length - 1 && msg.role === "assistant"}
                    />
                  ))}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="mt-3 glass-strong rounded-2xl p-3 flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte qualquer coisa… (Enter para enviar)"
                rows={1}
                className="flex-1 bg-transparent text-sm focus:outline-none resize-none max-h-32 placeholder:text-muted-foreground"
                style={{ minHeight: "24px" }}
              />

              {streaming ? (
                <button
                  onClick={stopStreaming}
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 flex items-center justify-center transition-colors"
                >
                  <Square size={14} />
                </button>
              ) : (
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="flex-shrink-0 w-9 h-9 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-primary-foreground flex items-center justify-center transition-colors"
                >
                  <Send size={14} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
