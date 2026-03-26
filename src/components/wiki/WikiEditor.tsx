import { useState, useCallback } from "react";
import { Save, X } from "lucide-react";
import type { WikiPage } from "@/types";

const PAGE_ICONS = ["📄", "📋", "🗺️", "⚙️", "🤖", "📊", "💡", "🏆", "👥", "📞", "🔧", "📌", "🎯", "📚", "🌟"];

interface WikiEditorProps {
  page: WikiPage | null;
  onSave: (title: string, content: unknown, icon: string) => Promise<void>;
  onCancel: () => void;
}

export function WikiEditor({ page, onSave, onCancel }: WikiEditorProps) {
  const [title, setTitle] = useState(page?.title ?? "");
  const [icon, setIcon] = useState(page?.icon ?? "📄");
  const [content, setContent] = useState<string>(
    typeof page?.content === "string" ? page.content : ""
  );
  const [saving, setSaving] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    await onSave(title, content, icon);
    setSaving(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        {/* Icon picker */}
        <div className="relative">
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl hover:bg-secondary/80 transition-colors"
          >
            {icon}
          </button>
          {showIconPicker && (
            <div className="absolute top-full mt-1 left-0 glass-strong rounded-xl p-2 z-50 flex flex-wrap gap-1 w-48">
              {PAGE_ICONS.map((i) => (
                <button
                  key={i}
                  onClick={() => { setIcon(i); setShowIconPicker(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary/80 transition-colors text-lg"
                >
                  {i}
                </button>
              ))}
            </div>
          )}
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da página"
          className="flex-1 bg-transparent text-xl font-bold focus:outline-none placeholder:text-muted-foreground/50"
          autoFocus
        />

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-secondary/80 text-xs text-muted-foreground transition-colors"
          >
            <X size={13} />
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-xs font-semibold transition-colors"
          >
            <Save size={13} />
            {saving ? "Salvando..." : page ? "Salvar" : "Criar página"}
          </button>
        </div>
      </div>

      {/* Simple rich textarea — in production replace with TipTap/BlockNote */}
      <div className="flex-1 flex flex-col">
        <div className="flex gap-1 mb-2 pb-2 border-b border-border/30">
          {["**Negrito**", "_Itálico_", "# Título", "## Subtítulo", "- Lista", "```Código```"].map((fmt) => (
            <button
              key={fmt}
              onClick={() => setContent((c) => c + "\n" + fmt)}
              className="px-2 py-1 rounded-lg text-xs text-muted-foreground hover:bg-secondary/80 hover:text-foreground transition-colors font-mono"
            >
              {fmt}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Comece a escrever... Suporte a Markdown: **negrito**, _itálico_, # títulos, - listas, ```código```"
          className="flex-1 bg-transparent text-sm leading-relaxed focus:outline-none resize-none placeholder:text-muted-foreground/40 font-mono"
        />
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        💡 Suporte a Markdown. Editor visual completo (TipTap) disponível na próxima versão.
      </p>
    </div>
  );
}
