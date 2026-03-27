import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Check, ChevronUp, MessageSquare, Tag,
  Lightbulb, Bug, Zap, Link2, HelpCircle, Filter,
  ArrowUpDown, Loader2, Send, AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = "melhoria" | "bug" | "novo_recurso" | "integracao" | "outro";
type Status   = "aberto" | "em_analise" | "planejado" | "em_desenvolvimento" | "concluido" | "recusado";
type SortKey  = "votes" | "recent";

interface FeatureRequest {
  id: string;
  created_at: string;
  title: string;
  description: string | null;
  category: Category;
  status: Status;
  author_id: string | null;
  author_name: string | null;
  votes: string[];
  priority: string | null;
  admin_notes: string | null;
}

interface Comment {
  id: string;
  created_at: string;
  feature_request_id: string;
  author_id: string | null;
  author_name: string | null;
  content: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Category, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  melhoria:    { label: "Melhoria",       icon: <Zap size={11} />,         color: "#8b5cf6", bg: "#8b5cf618" },
  bug:         { label: "Bug",            icon: <Bug size={11} />,         color: "#ef4444", bg: "#ef444418" },
  novo_recurso:{ label: "Novo Recurso",   icon: <Lightbulb size={11} />,   color: "#f59e0b", bg: "#f59e0b18" },
  integracao:  { label: "Integração",     icon: <Link2 size={11} />,       color: "#22c55e", bg: "#22c55e18" },
  outro:       { label: "Outro",          icon: <HelpCircle size={11} />,  color: "#6b7280", bg: "#6b728018" },
};

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  aberto:           { label: "Aberto",           color: "#6b7280", bg: "#6b728018" },
  em_analise:       { label: "Em Análise",        color: "#f59e0b", bg: "#f59e0b18" },
  planejado:        { label: "Planejado",          color: "#3b82f6", bg: "#3b82f618" },
  em_desenvolvimento:{ label: "Em Dev",           color: "#8b5cf6", bg: "#8b5cf618" },
  concluido:        { label: "Concluído",          color: "#22c55e", bg: "#22c55e18" },
  recusado:         { label: "Recusado",           color: "#ef4444", bg: "#ef444418" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useFeatureRequests() {
  const [items, setItems]   = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase
      .from("feature_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setItems(data as FeatureRequest[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create(payload: { title: string; description: string; category: Category; author_id: string; author_name: string }) {
    const { data, error } = await supabase
      .from("feature_requests")
      .insert({ ...payload, votes: [], status: "aberto" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setItems((prev) => [data as FeatureRequest, ...prev]);
    return data as FeatureRequest;
  }

  async function toggleVote(id: string, userId: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const hasVoted = item.votes.includes(userId);
    const newVotes = hasVoted ? item.votes.filter((v) => v !== userId) : [...item.votes, userId];
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, votes: newVotes } : i));
    const { error } = await supabase
      .from("feature_requests")
      .update({ votes: newVotes })
      .eq("id", id);
    if (error) {
      // Revert
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, votes: item.votes } : i));
    }
  }

  async function updateStatus(id: string, status: Status, adminNotes?: string) {
    const { error } = await supabase
      .from("feature_requests")
      .update({ status, ...(adminNotes !== undefined ? { admin_notes: adminNotes } : {}) })
      .eq("id", id);
    if (error) throw new Error(error.message);
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status, ...(adminNotes !== undefined ? { admin_notes: adminNotes } : {}) } : i));
  }

  return { items, loading, create, toggleVote, updateStatus, reload: load };
}

function useComments(featureRequestId: string | null) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    if (!featureRequestId) { setComments([]); return; }
    setLoading(true);
    supabase
      .from("feature_request_comments")
      .select("*")
      .eq("feature_request_id", featureRequestId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setComments(data as Comment[]);
        setLoading(false);
      });
  }, [featureRequestId]);

  async function addComment(content: string, authorId: string, authorName: string) {
    if (!featureRequestId) return;
    const { data, error } = await supabase
      .from("feature_request_comments")
      .insert({ feature_request_id: featureRequestId, content, author_id: authorId, author_name: authorName })
      .select()
      .single();
    if (error) throw new Error(error.message);
    setComments((prev) => [...prev, data as Comment]);
  }

  return { comments, loading, addComment };
}

// ─── New Request Modal ────────────────────────────────────────────────────────

function NewRequestModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: { title: string; description: string; category: Category }) => Promise<void> }) {
  const [title, setTitle]       = useState("");
  const [desc, setDesc]         = useState("");
  const [cat, setCat]           = useState<Category>("melhoria");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Título é obrigatório"); return; }
    setSaving(true);
    setError(null);
    try {
      await onCreate({ title: title.trim(), description: desc.trim(), category: cat });
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao criar");
      setSaving(false);
    }
  }

  const inp = "w-full bg-secondary/40 border border-border/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="glass-strong rounded-2xl border border-border w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border/40">
            <h3 className="font-semibold text-sm">Nova solicitação</h3>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground">
              <X size={14} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            {error && <div className="text-xs text-red-400 bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Título *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Adicionar filtro por squad na tela de projetos" autoFocus className={inp} />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Descrição</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Descreva o problema ou a melhoria que você gostaria de ver..."
                rows={4}
                className={`${inp} resize-none`}
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Categoria</label>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][]).map(([id, cfg]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCat(id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-all"
                    style={cat === id ? { color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}50` } : { borderColor: "var(--border)" }}
                  >
                    {cfg.icon}{cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 pb-5 pt-3 border-t border-border/30">
            <button type="button" onClick={onClose} className="text-xs px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="text-xs px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {saving ? "Enviando..." : "Enviar solicitação"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  item, userId, userName, isAdmin,
  onVote, onClose, onUpdateStatus,
}: {
  item: FeatureRequest;
  userId: string;
  userName: string;
  isAdmin: boolean;
  onVote: (id: string) => void;
  onClose: () => void;
  onUpdateStatus: (id: string, s: Status, notes?: string) => Promise<void>;
}) {
  const { comments, loading: commLoading, addComment } = useComments(item.id);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending]         = useState(false);
  const [editStatus, setEditStatus]   = useState<Status>(item.status);
  const [adminNotes, setAdminNotes]   = useState(item.admin_notes ?? "");
  const [savingStatus, setSavingStatus] = useState(false);

  const cat     = CATEGORY_CONFIG[item.category];
  const st      = STATUS_CONFIG[item.status];
  const hasVoted = item.votes.includes(userId);

  async function submitComment() {
    if (!commentText.trim()) return;
    setSending(true);
    try {
      await addComment(commentText.trim(), userId, userName);
      setCommentText("");
    } finally {
      setSending(false);
    }
  }

  async function saveStatus() {
    setSavingStatus(true);
    try {
      await onUpdateStatus(item.id, editStatus, adminNotes);
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
        className="glass-strong border-l border-border/40 w-full sm:max-w-md h-full flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border/30 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: cat.color, backgroundColor: cat.bg }}>
                {cat.icon}{cat.label}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: st.color, backgroundColor: st.bg }}>
                {st.label}
              </span>
            </div>
            <p className="font-semibold text-sm leading-snug">{item.title}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {item.author_name ?? "Anônimo"} · {timeAgo(item.created_at)}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground flex-shrink-0">
            <X size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Descrição */}
          {item.description && (
            <div className="px-5 py-4 border-b border-border/20">
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{item.description}</p>
            </div>
          )}

          {/* Votos */}
          <div className="px-5 py-3 border-b border-border/20">
            <button
              onClick={() => onVote(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                hasVoted
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-primary"
              }`}
            >
              <ChevronUp size={15} className={hasVoted ? "fill-primary" : ""} />
              {item.votes.length} {item.votes.length === 1 ? "voto" : "votos"}
              {hasVoted && <span className="text-[10px] opacity-60">— clique para remover</span>}
            </button>
          </div>

          {/* Admin: alterar status */}
          {isAdmin && (
            <div className="px-5 py-4 border-b border-border/20 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gestão (admin)</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([id, cfg]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEditStatus(id)}
                    className="text-[10px] px-2 py-1.5 rounded-lg border text-left transition-all"
                    style={editStatus === id ? { color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}50` } : { borderColor: "var(--border)" }}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Notas internas (visível para todos)..."
                rows={2}
                className="w-full bg-secondary/40 border border-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40 resize-none"
              />
              <button
                onClick={saveStatus}
                disabled={savingStatus}
                className="text-xs px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingStatus ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                Salvar status
              </button>
            </div>
          )}

          {/* Nota do admin (visível para todos) */}
          {!isAdmin && item.admin_notes && (
            <div className="px-5 py-3 border-b border-border/20">
              <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-primary mb-1">Nota do time Opus</p>
                <p className="text-xs text-muted-foreground">{item.admin_notes}</p>
              </div>
            </div>
          )}

          {/* Comentários */}
          <div className="px-5 py-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <MessageSquare size={10} />
              Comentários {comments.length > 0 && `(${comments.length})`}
            </p>

            {commLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 size={16} className="animate-spin text-muted-foreground/40" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground/40 text-center py-2">Nenhum comentário ainda. Seja o primeiro!</p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5">
                      {getInitials(c.author_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-medium">{c.author_name ?? "Anônimo"}</span>
                        <span className="text-[10px] text-muted-foreground/50">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Input de comentário */}
        <div className="px-5 py-3 border-t border-border/30 flex-shrink-0">
          <div className="flex gap-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); }}}
              placeholder="Adicionar comentário..."
              className="flex-1 bg-secondary/40 border border-border/60 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/40"
            />
            <button
              onClick={submitComment}
              disabled={!commentText.trim() || sending}
              className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function FeatureRequestsPage() {
  const user = useAuthStore((s) => s.user);
  const { items, loading, create, toggleVote, updateStatus } = useFeatureRequests();

  const [showNew, setShowNew]         = useState(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [filterCat, setFilterCat]     = useState<Category | "all">("all");
  const [filterStatus, setFilterStatus] = useState<Status | "all">("all");
  const [sortKey, setSortKey]         = useState<SortKey>("votes");

  const isAdmin = user?.opus_role === "admin" || user?.opus_role === "gerencia_peg";

  const filtered = useMemo(() => {
    let list = [...items];
    if (filterCat !== "all") list = list.filter((i) => i.category === filterCat);
    if (filterStatus !== "all") list = list.filter((i) => i.status === filterStatus);
    list.sort((a, b) =>
      sortKey === "votes"
        ? b.votes.length - a.votes.length
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return list;
  }, [items, filterCat, filterStatus, sortKey]);

  // Contadores por status para os tabs
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const s of Object.keys(STATUS_CONFIG)) {
      counts[s] = items.filter((i) => i.status === s).length;
    }
    return counts;
  }, [items]);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  async function handleCreate(d: { title: string; description: string; category: Category }) {
    if (!user) return;
    await create({ ...d, author_id: user.id, author_name: user.name ?? user.email ?? "Usuário" });
  }

  const sel = "text-xs px-3 py-1.5 rounded-xl bg-secondary/40 border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary/40 text-muted-foreground";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/30">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">Melhorias do Opus</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Vote nas ideias que você quer ver implementadas ou sugira novas
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Plus size={13} />
            Nova solicitação
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <div className="flex items-center gap-1 text-muted-foreground/50">
            <Filter size={11} />
          </div>

          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value as Category | "all")} className={sel}>
            <option value="all">Todas categorias</option>
            {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][]).map(([id, cfg]) => (
              <option key={id} value={id}>{cfg.label}</option>
            ))}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as Status | "all")} className={sel}>
            <option value="all">Todos status ({statusCounts.all})</option>
            {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([id, cfg]) => (
              <option key={id} value={id}>{cfg.label} ({statusCounts[id] ?? 0})</option>
            ))}
          </select>

          <button
            onClick={() => setSortKey((k) => k === "votes" ? "recent" : "votes")}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-border/60 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpDown size={11} />
            {sortKey === "votes" ? "Mais votados" : "Mais recentes"}
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={20} className="animate-spin text-muted-foreground/40" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Lightbulb size={32} className="text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">Nenhuma solicitação encontrada</p>
            <button onClick={() => setShowNew(true)} className="text-xs text-primary hover:underline">
              Criar a primeira
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const cat     = CATEGORY_CONFIG[item.category];
              const st      = STATUS_CONFIG[item.status];
              const hasVoted = user ? item.votes.includes(user.id) : false;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-2xl border border-border/40 bg-secondary/10 hover:bg-secondary/20 transition-colors cursor-pointer group"
                  onClick={() => setSelectedId(item.id)}
                >
                  {/* Botão de voto */}
                  <button
                    onClick={(e) => { e.stopPropagation(); if (user) toggleVote(item.id, user.id); }}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border transition-all flex-shrink-0 min-w-[44px] ${
                      hasVoted
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "border-border/40 text-muted-foreground hover:border-primary/30 hover:text-primary"
                    }`}
                  >
                    <ChevronUp size={14} className={hasVoted ? "fill-primary" : ""} />
                    <span className="text-[11px] font-bold leading-none">{item.votes.length}</span>
                  </button>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: cat.color, backgroundColor: cat.bg }}>
                        {cat.icon}{cat.label}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: st.color, backgroundColor: st.bg }}>
                        {st.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/60">
                      <span>{item.author_name ?? "Anônimo"}</span>
                      <span>{timeAgo(item.created_at)}</span>
                      {/* comentários — placeholder, poderia ser contador real */}
                      <span className="flex items-center gap-0.5"><MessageSquare size={9} /> comentários</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showNew && (
          <NewRequestModal onClose={() => setShowNew(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedItem && user && (
          <DetailPanel
            item={selectedItem}
            userId={user.id}
            userName={user.name ?? user.email ?? "Usuário"}
            isAdmin={isAdmin}
            onVote={(id) => toggleVote(id, user.id)}
            onClose={() => setSelectedId(null)}
            onUpdateStatus={updateStatus}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
