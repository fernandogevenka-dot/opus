import { useState, useEffect, useRef } from "react";
import {
  Search, RefreshCw, Send, Info, X, Users, Clock,
  MessageSquare, AlertTriangle, CheckCircle2, Loader2,
  TrendingUp, TrendingDown, Minus, BarChart3, Bell,
  FileText, Mic, Video, ImageIcon, MapPin, Smile,
  ChevronRight, Activity,
} from "lucide-react";
import { useWhatsAppGroups, WAGroup, WAMessage, WAAlert, HealthStatus } from "@/hooks/useWhatsAppGroups";

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = diff / 60000;
  if (m < 1) return "agora";
  if (m < 60) return `${Math.round(m)}min`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtMin(min: number | null): string {
  if (!min || min === 0) return "—";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Componentes menores ──────────────────────────────────────────────────

function HealthBadge({ status }: { status: HealthStatus }) {
  const map = {
    healthy:   { label: "Saudável", cls: "bg-green-100 text-green-700" },
    attention: { label: "Atenção",  cls: "bg-yellow-100 text-yellow-700" },
    risk:      { label: "Risco",    cls: "bg-red-100 text-red-700" },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cls)}>
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#d97706" : "#dc2626";
  return (
    <span
      className="text-xs font-bold px-1.5 py-0.5 rounded-lg"
      style={{ color, backgroundColor: `${color}18` }}
    >
      {score}
    </span>
  );
}

function GroupAvatar({ name, src, size = "md" }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-16 h-16 text-xl" };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover flex-shrink-0", sizeMap[size])}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={cn(
        "rounded-full bg-green-100 text-green-700 font-semibold flex items-center justify-center flex-shrink-0",
        sizeMap[size]
      )}
    >
      {initials}
    </div>
  );
}

// ─── GroupList ─────────────────────────────────────────────────────────────

interface GroupListProps {
  groups: WAGroup[];
  loading: boolean;
  selectedId: string | null;
  search: string;
  onSearch: (v: string) => void;
  statusFilter: HealthStatus | "all";
  onStatusFilter: (v: HealthStatus | "all") => void;
  onSelect: (g: WAGroup) => void;
  onRefresh: () => void;
}

function GroupList({
  groups, loading, selectedId, search, onSearch,
  statusFilter, onStatusFilter, onSelect, onRefresh,
}: GroupListProps) {
  const STATUS_FILTERS: { label: string; value: HealthStatus | "all" }[] = [
    { label: "Todos", value: "all" },
    { label: "🟢 Saudável", value: "healthy" },
    { label: "🟡 Atenção", value: "attention" },
    { label: "🔴 Risco", value: "risk" },
  ];

  return (
    <div className="flex flex-col h-full border-r border-gray-200 bg-white">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-200 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Grupos</h2>
          <button
            onClick={onRefresh}
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar grupo..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => onStatusFilter(f.value)}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded-full whitespace-nowrap transition-colors",
                statusFilter === f.value
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-20 text-gray-400 text-xs">
            Carregando...
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-gray-400 text-xs">
            Nenhum grupo encontrado
          </div>
        ) : (
          groups.map((group) => {
            const isSelected = group.id === selectedId;
            return (
              <button
                key={group.id}
                onClick={() => onSelect(group)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-100 transition-colors",
                  isSelected && "bg-green-50 border-l-2 border-l-green-500"
                )}
              >
                <GroupAvatar name={group.name} src={group.picture_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-medium text-gray-900 truncate">{group.name}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {timeAgo(group.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {group.health?.status && <HealthBadge status={group.health.status} />}
                    {group.health?.score !== undefined && <ScoreBadge score={group.health.score} />}
                    <span className="text-[10px] text-gray-400">{group.participant_count} membros</span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
        <p className="text-[10px] text-gray-500 text-center">{groups.length} grupos</p>
      </div>
    </div>
  );
}

// ─── MessageBubble ─────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: WAMessage }) {
  const isAgent = message.is_from_agent;
  const senderName = message.sender_name || message.sender_jid.split("@")[0];

  if (message.is_deleted) {
    return (
      <div className={cn("flex", isAgent ? "justify-end" : "justify-start")}>
        <div className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 text-xs italic">
          🚫 Mensagem apagada
        </div>
      </div>
    );
  }

  if (message.message_type === "reaction") return null;

  const renderContent = () => {
    switch (message.message_type) {
      case "text":
        return (
          <p className={cn("text-sm whitespace-pre-wrap break-words", isAgent ? "text-white" : "text-gray-900")}>
            {message.body}
          </p>
        );
      case "image":
        return (
          <div>
            {message.media_url ? (
              <img src={message.media_url} alt="Imagem" className="rounded-lg max-w-full max-h-48 object-cover mb-1" />
            ) : (
              <div className={cn("flex items-center gap-1.5", isAgent ? "text-white" : "text-gray-900")}>
                <ImageIcon className="w-4 h-4" /><span className="text-sm">Imagem</span>
              </div>
            )}
            {message.body && <p className={cn("text-sm mt-1", isAgent ? "text-white" : "text-gray-900")}>{message.body}</p>}
          </div>
        );
      case "audio":
        return (
          <div className={cn("flex items-center gap-1.5", isAgent ? "text-white" : "text-gray-900")}>
            <Mic className="w-4 h-4 flex-shrink-0" />
            {message.media_url ? (
              <audio src={message.media_url} controls className="max-w-full h-7" />
            ) : (
              <span className="text-sm">Áudio</span>
            )}
          </div>
        );
      case "video":
        return (
          <div className={cn("flex items-center gap-1.5", isAgent ? "text-white" : "text-gray-900")}>
            <Video className="w-4 h-4 flex-shrink-0" /><span className="text-sm">Vídeo</span>
          </div>
        );
      case "document":
        return (
          <div className={cn("flex items-center gap-1.5", isAgent ? "text-white" : "text-gray-900")}>
            <FileText className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">{message.body || "Documento"}</p>
              {message.media_url && (
                <a href={message.media_url} target="_blank" rel="noopener noreferrer"
                  className={cn("text-xs underline", isAgent ? "text-green-100" : "text-gray-500")}>
                  Baixar
                </a>
              )}
            </div>
          </div>
        );
      case "sticker":
        return (
          <div>
            {message.media_url ? (
              <img src={message.media_url} alt="Sticker" className="w-20 h-20 object-contain" />
            ) : (
              <Smile className={cn("w-6 h-6", isAgent ? "text-white" : "text-gray-900")} />
            )}
          </div>
        );
      case "location":
        return (
          <div className={cn("flex items-center gap-1.5", isAgent ? "text-white" : "text-gray-900")}>
            <MapPin className="w-4 h-4 flex-shrink-0" /><span className="text-sm">Localização</span>
          </div>
        );
      default:
        return <p className={cn("text-sm italic", isAgent ? "text-green-100" : "text-gray-400")}>Mensagem não suportada</p>;
    }
  };

  return (
    <div className={cn("flex flex-col", isAgent ? "items-end" : "items-start")}>
      {!isAgent && (
        <span className="text-[10px] text-green-600 font-medium mb-0.5 ml-1">{senderName}</span>
      )}
      <div
        className={cn(
          "max-w-sm rounded-2xl px-3 py-2 shadow-sm",
          isAgent
            ? "bg-green-500 text-white rounded-tr-sm"
            : "bg-white text-gray-900 border border-gray-100 rounded-tl-sm"
        )}
      >
        {renderContent()}
        <div className={cn("flex justify-end mt-0.5", isAgent ? "text-green-100" : "text-gray-400")}>
          <span className="text-[10px]">{formatMessageTime(message.sent_at)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── ChatWindow ─────────────────────────────────────────────────────────────

interface ChatWindowProps {
  group: WAGroup;
  messages: WAMessage[];
  loading: boolean;
  sending: boolean;
  onSend: (text: string) => Promise<boolean>;
  onOpenInfo: () => void;
}

function ChatWindow({ group, messages, loading, sending, onSend, onOpenInfo }: ChatWindowProps) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    const msg = text.trim();
    setText("");
    await onSend(msg);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
        <GroupAvatar name={group.name} src={group.picture_url} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{group.name}</h2>
            {group.health?.status && <HealthBadge status={group.health.status} />}
            {group.health?.score !== undefined && <ScoreBadge score={group.health.score} />}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              <Users className="w-3 h-3" />
              {group.participant_count} membros
            </span>
            {group.last_message_at && (
              <span className="text-[10px] text-gray-400">
                Última mensagem {timeAgo(group.last_message_at)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onOpenInfo}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          title="Informações do grupo"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {/* Barra IA summary */}
      {group.health?.ai_summary && (
        <div className="px-4 py-1.5 bg-blue-50 border-b border-blue-100 text-xs text-blue-800">
          <span className="font-medium">🤖 IA: </span>{group.health.ai_summary}
        </div>
      )}

      {/* Barra de alertas IA */}
      {group.health?.ai_alerts && group.health.ai_alerts.length > 0 && (
        <div className="px-4 py-1.5 bg-yellow-50 border-b border-yellow-100">
          {group.health.ai_alerts.map((alert, i) => (
            <p key={i} className="text-xs text-yellow-800">⚠️ {alert}</p>
          ))}
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-gray-50">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma mensagem</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-3 py-2.5 bg-white border-t border-gray-200">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent max-h-28 overflow-y-auto"
            style={{ minHeight: "40px" }}
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="w-10 h-10 flex items-center justify-center bg-green-500 text-white rounded-full hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── GroupInfo (painel direito) ─────────────────────────────────────────────

interface GroupInfoProps {
  group: WAGroup;
  onClose: () => void;
}

function GroupInfo({ group, onClose }: GroupInfoProps) {
  const health = group.health;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Informações</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Identidade do grupo */}
        <div className="flex flex-col items-center py-5 px-4 border-b border-gray-200">
          <GroupAvatar name={group.name} src={group.picture_url} size="lg" />
          <h2 className="text-sm font-semibold text-gray-900 text-center mt-2">{group.name}</h2>
          {group.description && (
            <p className="text-xs text-gray-500 text-center mt-1">{group.description}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {health?.status && <HealthBadge status={health.status} />}
            {health?.score !== undefined && <ScoreBadge score={health.score} />}
          </div>
        </div>

        {/* Saúde */}
        {health && (
          <div className="p-4 border-b border-gray-200 space-y-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Saúde do Grupo</p>

            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-500 flex-1">Tempo médio de resposta</span>
              <span className="font-medium text-gray-900">{fmtMin(health.avg_response_time_minutes)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-500 flex-1">Mensagens (7 dias)</span>
              <span className="font-medium text-gray-900">{health.messages_last_7_days || 0}</span>
            </div>
            {health.last_client_message_at && (
              <div className="flex items-center gap-2 text-xs">
                <TrendingUp className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500 flex-1">Último contato cliente</span>
                <span className="font-medium text-gray-900">{timeAgo(health.last_client_message_at)}</span>
              </div>
            )}

            {health.ai_summary && (
              <div className="mt-2 p-2.5 bg-blue-50 rounded-lg">
                <p className="text-[10px] font-medium text-blue-700 mb-1">🤖 Resumo IA</p>
                <p className="text-xs text-blue-800">{health.ai_summary}</p>
              </div>
            )}

            {health.ai_alerts && health.ai_alerts.length > 0 && (
              <div className="mt-1 space-y-1">
                {health.ai_alerts.map((alert, i) => (
                  <div key={i} className="p-2 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-yellow-800">⚠️ {alert}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[10px] text-gray-400">
              Calculado {health.computed_at ? timeAgo(health.computed_at) : "—"} atrás
            </p>
          </div>
        )}

        {/* Atividade */}
        <div className="p-4 border-b border-gray-200 space-y-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Atividade</p>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Última mensagem</span>
            <span className="font-medium text-gray-900">{group.last_message_at ? timeAgo(group.last_message_at) : "—"}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Total de membros</span>
            <span className="font-medium text-gray-900">{group.participant_count}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

function DashboardView({
  stats, alerts, groups, onRecalculate, onResolveAlert, onSelectGroup,
}: {
  stats: ReturnType<typeof useWhatsAppGroups>["stats"];
  alerts: WAAlert[];
  groups: WAGroup[];
  onRecalculate: () => void;
  onResolveAlert: (id: string) => void;
  onSelectGroup: (g: WAGroup) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: <Users className="w-4 h-4 text-blue-500" />, label: "Total de Grupos", value: stats.total_groups, bg: "bg-blue-50" },
          { icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, label: "Saudáveis", value: stats.healthy_groups, bg: "bg-green-50" },
          { icon: <AlertTriangle className="w-4 h-4 text-yellow-500" />, label: "Em Atenção", value: stats.attention_groups, bg: "bg-yellow-50" },
          { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, label: "Em Risco", value: stats.risk_groups, bg: "bg-red-50" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", c.bg)}>{c.icon}</div>
              <div>
                <p className="text-xl font-bold text-gray-900">{c.value}</p>
                <p className="text-[10px] text-gray-500">{c.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-50">
              <Clock className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{fmtMin(stats.avg_response_time_minutes)}</p>
              <p className="text-[10px] text-gray-500">Tempo Médio Resposta</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
              <Bell className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{stats.active_alerts}</p>
              <p className="text-[10px] text-gray-500">Alertas Ativos</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Grupos */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Grupos por saúde</h3>
            <button
              onClick={onRecalculate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Recalcular
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {groups.slice(0, 8).map((g) => (
              <button
                key={g.id}
                onClick={() => onSelectGroup(g)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
              >
                <GroupAvatar name={g.name} src={g.picture_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-900 truncate">{g.name}</span>
                    {g.health?.status && <HealthBadge status={g.health.status} />}
                    {g.health?.score !== undefined && <ScoreBadge score={g.health.score} />}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {timeAgo(g.last_message_at)} · {g.participant_count} membros
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">Alertas</h3>
            {alerts.length > 0 && (
              <span className="w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-100">
            {alerts.length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" />
                <p className="text-xs text-gray-400">Sem alertas ativos</p>
              </div>
            ) : (
              alerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className="px-4 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {alert.groups?.name || "Grupo desconhecido"}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{alert.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{timeAgo(alert.created_at)}</p>
                    </div>
                    <button
                      onClick={() => onResolveAlert(alert.id)}
                      className="text-[10px] text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
                    >
                      Resolver
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

type WaTab = "chat" | "dashboard" | "alerts";

export function WhatsAppCSPage() {
  const [activeTab, setActiveTab] = useState<WaTab>("chat");
  const [showInfo, setShowInfo] = useState(false);

  const wa = useWhatsAppGroups();

  const TABS: { id: WaTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "chat",      label: "Grupos",    icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: "alerts",    label: "Alertas",   icon: <Bell className="w-3.5 h-3.5" />, badge: wa.alerts.length },
  ];

  async function handleSelectGroup(group: WAGroup) {
    setActiveTab("chat");
    await wa.selectGroup(group);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold">WhatsApp CS</h1>
            <p className="text-[10px] text-muted-foreground">Monitoramento de grupos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Activity className="w-3 h-3 text-green-400" />
            <span>{wa.stats.total_groups} grupos · {wa.stats.healthy_groups} saudáveis</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/30 flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors",
              activeTab === t.id
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.icon}
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {/* Tab: Chat (3 colunas) */}
        {activeTab === "chat" && (
          <div className="flex h-full">
            {/* Coluna esquerda — lista de grupos */}
            <div className="w-64 flex-shrink-0 h-full">
              <GroupList
                groups={wa.groups}
                loading={wa.loadingGroups}
                selectedId={wa.selectedGroup?.id ?? null}
                search={wa.search}
                onSearch={wa.setSearch}
                statusFilter={wa.statusFilter}
                onStatusFilter={wa.setStatusFilter}
                onSelect={wa.selectGroup}
                onRefresh={wa.loadGroups}
              />
            </div>

            {/* Centro — chat ou placeholder */}
            <div className="flex-1 h-full min-w-0">
              {wa.selectedGroup ? (
                <ChatWindow
                  group={wa.selectedGroup}
                  messages={wa.messages}
                  loading={wa.loadingMessages}
                  sending={wa.sendingMessage}
                  onSend={wa.sendMessage}
                  onOpenInfo={() => setShowInfo(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                  <MessageSquare className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Selecione um grupo para ver as mensagens</p>
                </div>
              )}
            </div>

            {/* Direita — painel de info (colapsável) */}
            {showInfo && wa.selectedGroup && (
              <div className="w-72 flex-shrink-0 h-full">
                <GroupInfo group={wa.selectedGroup} onClose={() => setShowInfo(false)} />
              </div>
            )}
          </div>
        )}

        {/* Tab: Dashboard */}
        {activeTab === "dashboard" && (
          <DashboardView
            stats={wa.stats}
            alerts={wa.alerts}
            groups={wa.groups}
            onRecalculate={() => wa.recalculateHealth()}
            onResolveAlert={wa.resolveAlert}
            onSelectGroup={handleSelectGroup}
          />
        )}

        {/* Tab: Alertas */}
        {activeTab === "alerts" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {wa.alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-gray-400">
                <CheckCircle2 className="w-8 h-8 opacity-50" />
                <p className="text-sm">Nenhum alerta ativo</p>
              </div>
            ) : (
              wa.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "rounded-xl border px-4 py-3 flex items-start gap-3",
                    alert.alert_type === "no_activity" || alert.alert_type === "response_time_exceeded"
                      ? "border-red-200 bg-red-50"
                      : "border-yellow-200 bg-yellow-50"
                  )}
                >
                  <AlertTriangle
                    className={cn(
                      "w-4 h-4 mt-0.5 flex-shrink-0",
                      alert.alert_type === "no_activity" || alert.alert_type === "response_time_exceeded"
                        ? "text-red-500"
                        : "text-yellow-500"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {alert.groups?.name || "Grupo desconhecido"}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{alert.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(alert.created_at)}</p>
                  </div>
                  <button
                    onClick={() => wa.resolveAlert(alert.id)}
                    className="text-xs text-green-600 hover:text-green-700 font-medium whitespace-nowrap"
                  >
                    Resolver
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
