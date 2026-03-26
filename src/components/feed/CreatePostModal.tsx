import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Zap, ImagePlus, Film, Trash2 } from "lucide-react";
import { getPostTypeIcon, getPostTypeLabel } from "@/lib/utils";
import type { PostType } from "@/types";

const POST_TYPES: { type: PostType; xp: number }[] = [
  { type: "sale", xp: 100 },
  { type: "feedback", xp: 50 },
  { type: "delivery", xp: 30 },
  { type: "innovation", xp: 80 },
  { type: "ai_solution", xp: 40 },
  { type: "announcement", xp: 0 },
  { type: "celebration", xp: 10 },
];

interface CreatePostModalProps {
  open: boolean;
  defaultType?: PostType;
  onClose: () => void;
  onCreate: (type: PostType, title: string, content: string, metadata: Record<string, unknown>, mediaFile?: File | null) => Promise<void>;
}

export function CreatePostModal({ open, defaultType = "sale", onClose, onCreate }: CreatePostModalProps) {
  const [type, setType] = useState<PostType>(defaultType);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saleValue, setSaleValue] = useState("");
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setMediaFile(file);
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
  }

  function clearMedia() {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError(null);

    const metadata: Record<string, unknown> = {};
    if (type === "sale") {
      if (saleValue) metadata.value = saleValue;
      if (clientName) metadata.client = clientName;
    }

    try {
      await onCreate(type, title, content, metadata, mediaFile);
      setTitle("");
      setContent("");
      setSaleValue("");
      setClientName("");
      clearMedia();
      onClose();
    } catch (err) {
      console.error("Erro ao publicar:", err);
      setError((err as Error)?.message ?? "Erro ao publicar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const selectedTypeInfo = POST_TYPES.find((t) => t.type === type);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg"
          >
            <div className="glass-strong rounded-2xl p-6 shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold">Compartilhar no Feed</h2>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Type selector */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-2 block">Tipo de post</label>
                  <div className="grid grid-cols-4 gap-2">
                    {POST_TYPES.map(({ type: t, xp }) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs transition-colors ${
                          type === t
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "hover:bg-secondary/80 text-muted-foreground border border-transparent"
                        }`}
                      >
                        <span className="text-lg">{getPostTypeIcon(t)}</span>
                        <span className="text-center leading-tight">{getPostTypeLabel(t)}</span>
                        {xp > 0 && <span className="text-xs text-primary/70">+{xp}xp</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sale fields */}
                {type === "sale" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor da venda</label>
                      <input
                        value={saleValue}
                        onChange={(e) => setSaleValue(e.target.value)}
                        placeholder="R$ 50.000"
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Cliente</label>
                      <input
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Nome do cliente"
                        className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Título *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`Ex: ${type === "sale" ? "Venda fechada para Empresa X" : type === "innovation" ? "Automatizei o processo de Y" : "Descreva brevemente"}`}
                    required
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Detalhes</label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Conte mais sobre isso para o time..."
                    rows={3}
                    className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>

                {/* Media upload */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {mediaPreview ? (
                    <div className="relative rounded-2xl overflow-hidden border border-border/40">
                      {mediaFile?.type.startsWith("video/") ? (
                        <video
                          src={mediaPreview}
                          className="w-full max-h-56 object-cover"
                          controls
                        />
                      ) : (
                        <img
                          src={mediaPreview}
                          alt="Preview"
                          className="w-full max-h-56 object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={clearMedia}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-border/50 hover:border-primary/40 hover:bg-secondary/30 transition-colors text-sm text-muted-foreground"
                    >
                      <ImagePlus size={16} className="shrink-0" />
                      <span>Adicionar foto ou vídeo</span>
                      <Film size={14} className="ml-auto opacity-40" />
                    </button>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <div className="flex items-center justify-between pt-1">
                  {selectedTypeInfo && selectedTypeInfo.xp > 0 && (
                    <span className="xp-badge">
                      <Zap size={12} />
                      Ganhar +{selectedTypeInfo.xp} XP ao publicar
                    </span>
                  )}
                  <div className="ml-auto">
                    <button
                      type="submit"
                      disabled={loading || !title.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground rounded-xl text-sm font-semibold transition-colors"
                    >
                      <Send size={14} />
                      {loading ? "Publicando..." : "Publicar"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
