import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Save, Check, RotateCcw, ZoomIn, ZoomOut, Maximize2, Sparkles, Lock } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeskItemType =
  | "monitor" | "monitor_dual" | "keyboard" | "mouse" | "headset"
  | "mug" | "plant_small" | "lamp" | "notebook" | "phone"
  | "action_figure" | "rubber_duck" | "plushie" | "dice_set"
  | "neon_rgb" | "rgb_strip" | "lego" | "trophy_mini"
  | "sticker_pack" | "frame_photo" | "speaker" | "mic_setup"
  | "mousepad_xl" | "post_its" | "candy_jar" | "hourglass";

interface DeskItemDef {
  type: DeskItemType;
  label: string;
  emoji: string;
  w: number;
  h: number;
  category: "tech" | "vibe" | "comfort" | "collectible";
  rarity: "common" | "rare" | "epic" | "legendary";
  unlockLevel?: number;
}

interface DeskPlacement {
  id: string;
  type: DeskItemType;
  x: number; // 0–1
  y: number;
}

interface DeskConfig {
  theme: DeskTheme;
  items: DeskPlacement[];
  nameplate: string;
  tagline: string;
  bgColor: string;
  roomId: string; // which office room this desk belongs to
}

type DeskTheme = "dark" | "neon" | "minimal" | "cozy" | "rgb" | "nature";

// ─── Office rooms (mirrors OfficeCanvas ROOMS) ────────────────────────────────
const OFFICE_ROOMS = [
  { id: "sales",     name: "Vendas",    icon: "🏆", color: "#8b5cf6" },
  { id: "meetings",  name: "Reuniões",  icon: "📋", color: "#8b5cf6" },
  { id: "direction", name: "Diretoria", icon: "👔", color: "#f59e0b" },
  { id: "lounge",    name: "Lounge",    icon: "☕", color: "#10b981" },
  { id: "oneonone",  name: "1:1",       icon: "💬", color: "#ec4899" },
  { id: "training",  name: "Atlas Lab", icon: "🤖", color: "#6366f1" },
];

// ─── Catalog ──────────────────────────────────────────────────────────────────

const DESK_ITEMS: DeskItemDef[] = [
  // Tech
  { type: "monitor",       label: "Monitor",         emoji: "🖥️",  w: 2, h: 1, category: "tech",        rarity: "common"    },
  { type: "monitor_dual",  label: "Dual Monitor",    emoji: "🖥️",  w: 3, h: 1, category: "tech",        rarity: "rare",      unlockLevel: 5  },
  { type: "keyboard",      label: "Teclado Mech",    emoji: "⌨️",   w: 2, h: 1, category: "tech",        rarity: "common"    },
  { type: "mouse",         label: "Mouse Gamer",     emoji: "🖱️",   w: 1, h: 1, category: "tech",        rarity: "common"    },
  { type: "headset",       label: "Headset",         emoji: "🎧",  w: 1, h: 1, category: "tech",        rarity: "common"    },
  { type: "mic_setup",     label: "Setup de Mic",    emoji: "🎙️",   w: 1, h: 2, category: "tech",        rarity: "rare",      unlockLevel: 8  },
  { type: "speaker",       label: "Caixinha",        emoji: "🔊",  w: 1, h: 1, category: "tech",        rarity: "common"    },
  { type: "mousepad_xl",   label: "Mousepad XL",     emoji: "🟫",  w: 3, h: 1, category: "tech",        rarity: "rare",      unlockLevel: 3  },
  { type: "phone",         label: "Celular",         emoji: "📱",  w: 1, h: 1, category: "tech",        rarity: "common"    },
  // Vibe (gamer/fun)
  { type: "neon_rgb",      label: "Neon RGB",        emoji: "💡",  w: 2, h: 1, category: "vibe",        rarity: "rare",      unlockLevel: 6  },
  { type: "rgb_strip",     label: "Fita LED",        emoji: "🌈",  w: 3, h: 1, category: "vibe",        rarity: "epic",      unlockLevel: 10 },
  { type: "action_figure", label: "Action Figure",   emoji: "🤖",  w: 1, h: 1, category: "vibe",        rarity: "rare"      },
  { type: "rubber_duck",   label: "Patinho Debug",   emoji: "🦆",  w: 1, h: 1, category: "vibe",        rarity: "common"    },
  { type: "plushie",       label: "Pelúcia",         emoji: "🧸",  w: 1, h: 1, category: "vibe",        rarity: "rare"      },
  { type: "dice_set",      label: "Dados D&D",       emoji: "🎲",  w: 1, h: 1, category: "vibe",        rarity: "epic",      unlockLevel: 12 },
  { type: "lego",          label: "LEGO Set",        emoji: "🧱",  w: 2, h: 1, category: "vibe",        rarity: "epic",      unlockLevel: 15 },
  { type: "trophy_mini",   label: "Troféu",          emoji: "🏆",  w: 1, h: 1, category: "collectible", rarity: "legendary", unlockLevel: 20 },
  // Comfort
  { type: "mug",           label: "Caneca",          emoji: "☕",  w: 1, h: 1, category: "comfort",     rarity: "common"    },
  { type: "plant_small",   label: "Planta",          emoji: "🪴",  w: 1, h: 1, category: "comfort",     rarity: "common"    },
  { type: "lamp",          label: "Luminária",       emoji: "💡",  w: 1, h: 1, category: "comfort",     rarity: "common"    },
  { type: "candy_jar",     label: "Pote de Doces",   emoji: "🍬",  w: 1, h: 1, category: "comfort",     rarity: "rare"      },
  { type: "hourglass",     label: "Ampulheta",       emoji: "⏳",  w: 1, h: 1, category: "comfort",     rarity: "rare"      },
  // Collectible
  { type: "sticker_pack",  label: "Stickers",        emoji: "🎨",  w: 1, h: 1, category: "collectible", rarity: "common"    },
  { type: "frame_photo",   label: "Porta-Retrato",   emoji: "🖼️",  w: 1, h: 1, category: "collectible", rarity: "common"    },
  { type: "notebook",      label: "Caderno",         emoji: "📓",  w: 1, h: 1, category: "collectible", rarity: "common"    },
  { type: "post_its",      label: "Post-its",        emoji: "📝",  w: 1, h: 1, category: "collectible", rarity: "common"    },
];

const ITEM_BY_TYPE = Object.fromEntries(DESK_ITEMS.map((d) => [d.type, d])) as Record<DeskItemType, DeskItemDef>;

const RARITY = {
  common:    { label: "Common",    color: "#94a3b8", glow: "#94a3b815", border: "#94a3b830" },
  rare:      { label: "Rare",      color: "#8b5cf6", glow: "#8b5cf620", border: "#8b5cf640" },
  epic:      { label: "Epic",      color: "#a855f7", glow: "#a855f730", border: "#a855f750" },
  legendary: { label: "Legendary", color: "#f59e0b", glow: "#f59e0b30", border: "#f59e0b60" },
};

const CATEGORIES_DESK = [
  { id: "all",         label: "Tudo",       emoji: "🏠" },
  { id: "tech",        label: "Tech",       emoji: "💻" },
  { id: "vibe",        label: "Vibe",       emoji: "⚡" },
  { id: "comfort",     label: "Conforto",   emoji: "☕" },
  { id: "collectible", label: "Coleções",   emoji: "🎲" },
] as const;

const THEMES: { id: DeskTheme; label: string; emoji: string; bg: string; accent: string }[] = [
  { id: "dark",    label: "Dark",    emoji: "🌑", bg: "#0f0f14", accent: "#6366f1" },
  { id: "neon",    label: "Neon",    emoji: "🔆", bg: "#0d0f1a", accent: "#a855f7" },
  { id: "minimal", label: "Clean",   emoji: "⬜", bg: "#1c1c22", accent: "#94a3b8" },
  { id: "cozy",    label: "Cozy",    emoji: "🍵", bg: "#1a1208", accent: "#f59e0b" },
  { id: "rgb",     label: "RGB",     emoji: "🌈", bg: "#0a0a0f", accent: "#ec4899" },
  { id: "nature",  label: "Nature",  emoji: "🌿", bg: "#0d1a10", accent: "#10b981" },
];

const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

// ─── Default desk ─────────────────────────────────────────────────────────────

const DEFAULT_DESK: DeskConfig = {
  theme: "dark",
  bgColor: "#0f0f14",
  roomId: "sales",
  nameplate: "",
  tagline: "Full Stack · Level 1",
  items: [
    { id: "d1", type: "monitor",    x: 0.50, y: 0.22 },
    { id: "d2", type: "keyboard",   x: 0.50, y: 0.52 },
    { id: "d3", type: "mouse",      x: 0.78, y: 0.52 },
    { id: "d4", type: "mug",        x: 0.82, y: 0.28 },
    { id: "d5", type: "plant_small",x: 0.12, y: 0.20 },
    { id: "d6", type: "rubber_duck",x: 0.12, y: 0.55 },
  ],
};

// ─── DeskPreview ──────────────────────────────────────────────────────────────

interface DeskPreviewProps {
  config: DeskConfig;
  zoom: number;
  userLevel: number;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  onDrop: (type: DeskItemType, x: number, y: number) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

function DeskPreview({ config, zoom, userLevel, onMove, onRemove, onDrop, selected, onSelect }: DeskPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [dragOver, setDragOver] = useState(false);
  const theme = THEME_BY_ID[config.theme];

  function pxToRel(px: number, py: number, rect: DOMRect) {
    return {
      x: Math.max(0.02, Math.min(0.97, px / rect.width)),
      y: Math.max(0.02, Math.min(0.94, py / rect.height)),
    };
  }

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    draggingId.current = id;
    const rect = previewRef.current!.getBoundingClientRect();
    const item = config.items.find((f) => f.id === id)!;
    if (!item) return;
    dragOffset.current = {
      x: e.clientX - rect.left - item.x * rect.width,
      y: e.clientY - rect.top  - item.y * rect.height,
    };
    const handleMove = (mv: MouseEvent) => {
      if (!draggingId.current || !previewRef.current) return;
      const r = previewRef.current.getBoundingClientRect();
      const { x, y } = pxToRel(mv.clientX - r.left - dragOffset.current.x, mv.clientY - r.top - dragOffset.current.y, r);
      onMove(draggingId.current!, x, y);
    };
    const handleUp = () => {
      draggingId.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [config.items, onMove]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const type = e.dataTransfer.getData("desk-item-type") as DeskItemType;
    if (!type || !previewRef.current) return;
    const itemDef = ITEM_BY_TYPE[type];
    if (itemDef?.unlockLevel && userLevel < itemDef.unlockLevel) return;
    const rect = previewRef.current.getBoundingClientRect();
    const { x, y } = pxToRel(e.clientX - rect.left, e.clientY - rect.top, rect);
    onDrop(type, x, y);
  };

  const BASE_H = 340;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl" style={{ height: BASE_H * zoom + 2 }}>
      <div
        ref={previewRef}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => onSelect(null)}
        className="absolute inset-0 origin-top-left select-none"
        style={{
          width:  `${100 / zoom}%`,
          height: `${100 / zoom}%`,
          transform: `scale(${zoom})`,
          background: config.bgColor,
          borderRadius: 16,
          border: `2px solid ${dragOver ? theme.accent : theme.accent + "30"}`,
          boxShadow: `inset 0 0 60px ${theme.accent}08`,
        }}
      >
        {/* Desk surface gradient */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: "55%",
            background: `linear-gradient(to top, ${theme.accent}12 0%, transparent 100%)`,
            borderTop: `1px solid ${theme.accent}20`,
          }}
        />

        {/* Scanline texture overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.025]"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 3px)",
          }}
        />

        {/* Nameplate */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 z-10 pointer-events-none">
          <div
            className="px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase"
            style={{
              background: `${theme.accent}22`,
              border: `1px solid ${theme.accent}50`,
              color: theme.accent,
              boxShadow: `0 0 12px ${theme.accent}30`,
              fontFamily: "monospace",
            }}
          >
            {config.nameplate || "Sua Mesa"}
          </div>
          {config.tagline && (
            <p className="text-[9px] opacity-40 font-mono" style={{ color: theme.accent }}>
              {config.tagline}
            </p>
          )}
        </div>

        {/* Grid lines (subtle) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="deskgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke={theme.accent} strokeWidth="0.4" opacity="0.06" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#deskgrid)" />
        </svg>

        {/* Drop hint */}
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div
              className="text-sm font-bold px-5 py-2 rounded-2xl border font-mono"
              style={{
                background: `${theme.accent}22`,
                borderColor: theme.accent,
                color: theme.accent,
                boxShadow: `0 0 24px ${theme.accent}50`,
              }}
            >
              ⬇ Soltar na mesa
            </div>
          </div>
        )}

        {/* Items */}
        {config.items.map((f) => {
          const def = ITEM_BY_TYPE[f.type];
          const isSelected = selected === f.id;
          const rar = RARITY[def?.rarity ?? "common"];
          const W = (def?.w ?? 1) * 36;
          const H = (def?.h ?? 1) * 36;

          return (
            <div
              key={f.id}
              onMouseDown={(e) => handleMouseDown(e, f.id)}
              style={{
                position: "absolute",
                left:   `calc(${f.x * 100}% - ${W / 2}px)`,
                top:    `calc(${f.y * 100}% - ${H / 2}px)`,
                width: W,
                height: H,
                zIndex: isSelected ? 30 : 20,
                cursor: "grab",
              }}
            >
              <div
                className="w-full h-full rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all"
                style={{
                  background: isSelected ? `${rar.color}22` : `${rar.glow}`,
                  border: `1.5px solid ${isSelected ? rar.color : rar.border}`,
                  boxShadow: isSelected
                    ? `0 0 14px ${rar.color}60, 0 0 0 1px ${rar.color}40`
                    : def?.rarity === "legendary"
                    ? `0 0 8px ${rar.color}40`
                    : "none",
                }}
              >
                <span className="text-lg leading-none">{def?.emoji ?? "📦"}</span>
                {H >= 50 && (
                  <span className="text-[7px] leading-none opacity-40 text-center px-0.5 mt-0.5 font-mono">
                    {def?.label}
                  </span>
                )}
              </div>

              {/* Rarity indicator */}
              {def?.rarity !== "common" && (
                <div
                  className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-background z-30"
                  style={{ backgroundColor: rar.color, boxShadow: `0 0 5px ${rar.color}` }}
                />
              )}

              {/* Remove */}
              {isSelected && (
                <button
                  onMouseDown={(e) => { e.stopPropagation(); onRemove(f.id); }}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-400 z-40 transition-colors"
                >
                  <span className="text-[9px] font-bold">✕</span>
                </button>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {config.items.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none opacity-20">
            <span className="text-5xl">🪑</span>
            <p className="text-xs font-mono" style={{ color: theme.accent }}>Mesa vazia — arraste itens para decorar</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Catalog Panel ────────────────────────────────────────────────────────────

function DeskCatalogPanel({ userLevel }: { userLevel: number }) {
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(
    () => cat === "all" ? DESK_ITEMS : DESK_ITEMS.filter((d) => d.category === cat),
    [cat]
  );

  return (
    <div className="flex flex-col gap-2 h-full">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Itens</p>

      <div className="flex flex-wrap gap-1">
        {CATEGORIES_DESK.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
              cat === c.id
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent"
            }`}
          >
            <span>{c.emoji}</span>
            <span>{c.label}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {filtered.map((item) => {
          const rar = RARITY[item.rarity];
          const locked = item.unlockLevel ? userLevel < item.unlockLevel : false;

          return (
            <div
              key={item.type}
              draggable={!locked}
              onDragStart={(e) => {
                if (locked) { e.preventDefault(); return; }
                e.dataTransfer.setData("desk-item-type", item.type);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl border transition-all select-none"
              style={{
                background: locked ? "transparent" : rar.glow,
                borderColor: locked ? "rgba(255,255,255,0.06)" : rar.border,
                cursor: locked ? "not-allowed" : "grab",
                opacity: locked ? 0.45 : 1,
              }}
              onMouseEnter={(e) => {
                if (locked) return;
                (e.currentTarget as HTMLElement).style.borderColor = rar.color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 10px ${rar.glow}`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = rar.border;
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <span className="text-xl leading-none w-7 text-center flex-shrink-0">
                {locked ? "🔒" : item.emoji}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground font-medium truncate">{item.label}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: rar.color }}>
                  {rar.label}
                  {locked && item.unlockLevel && (
                    <span className="text-muted-foreground ml-1 normal-case">· lv.{item.unlockLevel}</span>
                  )}
                </p>
              </div>
              {locked && <Lock size={10} className="text-muted-foreground/40 flex-shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Rarity legend */}
      <div className="flex gap-2 flex-wrap pt-1 border-t border-border/30">
        {Object.entries(RARITY).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.color, boxShadow: `0 0 3px ${v.color}` }} />
            <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wide">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function DeskCustomizePage() {
  const user = useAuthStore((s) => s.user);
  const userLevel = user?.level ?? 1;

  const [config, setConfig] = useState<DeskConfig>(() => ({
    ...DEFAULT_DESK,
    nameplate: user?.name ?? "",
    tagline: `${user?.role ?? "Membro"} · Level ${userLevel}`,
  }));
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Keep nameplate in sync when user loads
  useEffect(() => {
    if (user?.name) {
      setConfig((prev) => ({
        ...prev,
        nameplate: prev.nameplate || user.name,
        tagline: prev.tagline.includes("Level") ? prev.tagline : `${user.role ?? "Membro"} · Level ${userLevel}`,
      }));
    }
  }, [user?.name]);

  const moveItem = useCallback((id: string, x: number, y: number) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.map((f) => f.id === id ? { ...f, x, y } : f),
    }));
  }, []);

  function removeItem(id: string) {
    setConfig((prev) => ({ ...prev, items: prev.items.filter((f) => f.id !== id) }));
    setSelectedItem(null);
  }

  function dropItem(type: DeskItemType, x: number, y: number) {
    const newItem: DeskPlacement = { id: `${type}-${Date.now()}`, type, x, y };
    setConfig((prev) => ({ ...prev, items: [...prev.items, newItem] }));
    setSelectedItem(newItem.id);
  }

  function resetDesk() {
    setConfig({ ...DEFAULT_DESK, nameplate: user?.name ?? "", tagline: `${user?.role ?? "Membro"} · Level ${userLevel}` });
    setSelectedItem(null);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const currentTheme = THEME_BY_ID[config.theme];
  const zoomSteps = [0.6, 0.75, 1, 1.25, 1.5];
  const zoomIdx = zoomSteps.indexOf(zoom);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Sparkles size={16} className="text-yellow-400" />
              Minha Mesa
              {(() => {
                const sel = OFFICE_ROOMS.find((r) => r.id === config.roomId);
                return sel ? (
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${sel.color}20`, color: sel.color, border: `1px solid ${sel.color}40` }}
                  >
                    {sel.icon} {sel.name}
                  </span>
                ) : null;
              })()}
            </h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Personalize seu espaço · itens raros desbloqueiam por nível
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetDesk}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors border border-border/40"
          >
            <RotateCcw size={12} />
            Reset
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              saved
                ? "bg-green-500/20 text-green-400 border border-green-500/40"
                : "bg-primary text-white hover:opacity-90"
            }`}
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? "Salvo!" : "Salvar mesa"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 gap-3 min-h-0 overflow-hidden">

        {/* Col 1 — Identity & theme */}
        <div className="w-48 flex flex-col gap-3 flex-shrink-0 overflow-y-auto">
          {/* Level badge */}
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
            style={{ background: `${currentTheme.accent}15`, border: `1px solid ${currentTheme.accent}30` }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0"
              style={{ background: `${currentTheme.accent}25`, color: currentTheme.accent }}
            >
              {userLevel}
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: currentTheme.accent }}>Level {userLevel}</p>
              <p className="text-[10px] text-muted-foreground">{user?.xp ?? 0} XP</p>
            </div>
          </div>

          {/* Room selector */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sala</p>
            <div className="grid grid-cols-2 gap-1.5">
              {OFFICE_ROOMS.map((r) => {
                const isActive = config.roomId === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setConfig((p) => ({ ...p, roomId: r.id }))}
                    className="flex items-center gap-1.5 px-2 py-2 rounded-xl text-left transition-all"
                    style={{
                      background: isActive ? `${r.color}20` : "transparent",
                      border: `1.5px solid ${isActive ? r.color : "rgba(255,255,255,0.06)"}`,
                      boxShadow: isActive ? `0 0 8px ${r.color}30` : "none",
                    }}
                  >
                    <span className="text-base leading-none">{r.icon}</span>
                    <span
                      className="text-[10px] font-semibold truncate"
                      style={{ color: isActive ? r.color : undefined }}
                    >
                      {r.name}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Selected room indicator */}
            {(() => {
              const sel = OFFICE_ROOMS.find((r) => r.id === config.roomId);
              return sel ? (
                <p className="text-[9px] text-muted-foreground font-mono opacity-60">
                  Mesa em: {sel.icon} {sel.name}
                </p>
              ) : null;
            })()}
          </div>

          {/* Nameplate / tagline */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Placa</p>
            <input
              value={config.nameplate}
              onChange={(e) => setConfig((p) => ({ ...p, nameplate: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-xl bg-secondary/40 border border-border/50 text-xs focus:outline-none focus:border-primary/50 transition-colors font-semibold"
              placeholder="Seu nome"
              maxLength={24}
            />
            <input
              value={config.tagline}
              onChange={(e) => setConfig((p) => ({ ...p, tagline: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-xl bg-secondary/40 border border-border/50 text-xs focus:outline-none focus:border-primary/50 transition-colors text-muted-foreground"
              placeholder="Cargo · Level X"
              maxLength={36}
            />
          </div>

          {/* Theme picker */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tema</p>
            <div className="grid grid-cols-3 gap-1.5">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setConfig((p) => ({ ...p, theme: t.id, bgColor: t.bg }))}
                  className="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all"
                  style={{
                    background: config.theme === t.id ? `${t.accent}20` : "transparent",
                    border: `1.5px solid ${config.theme === t.id ? t.accent : "rgba(255,255,255,0.06)"}`,
                    boxShadow: config.theme === t.id ? `0 0 8px ${t.accent}40` : "none",
                  }}
                >
                  <span className="text-base">{t.emoji}</span>
                  <span className="text-[9px] font-bold" style={{ color: config.theme === t.id ? t.accent : undefined }}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* BG color custom */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cor de fundo</p>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.bgColor}
                onChange={(e) => setConfig((p) => ({ ...p, bgColor: e.target.value }))}
                className="w-8 h-8 rounded-xl cursor-pointer border-0 p-0.5 bg-secondary/40"
              />
              <span className="text-[10px] font-mono text-muted-foreground">{config.bgColor}</span>
            </div>
          </div>
        </div>

        {/* Col 2 — Desk preview */}
        <div className="flex-1 flex flex-col gap-2.5 min-w-0 overflow-y-auto">

          {/* Zoom bar */}
          <div className="flex items-center justify-end gap-1 bg-secondary/30 border border-border/30 rounded-xl px-2.5 py-1.5 self-end">
            <button
              onClick={() => setZoom(zoomSteps[Math.max(0, zoomIdx - 1)])}
              disabled={zoomIdx <= 0}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-secondary/80 disabled:opacity-30 transition-colors"
            >
              <ZoomOut size={12} />
            </button>
            <span className="text-[10px] font-mono w-8 text-center text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(zoomSteps[Math.min(zoomSteps.length - 1, zoomIdx + 1)])}
              disabled={zoomIdx >= zoomSteps.length - 1}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-secondary/80 disabled:opacity-30 transition-colors"
            >
              <ZoomIn size={12} />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <Maximize2 size={10} />
            </button>
          </div>

          <DeskPreview
            config={config}
            zoom={zoom}
            userLevel={userLevel}
            onMove={moveItem}
            onRemove={removeItem}
            onDrop={dropItem}
            selected={selectedItem}
            onSelect={setSelectedItem}
          />

          <p className="text-[9px] text-muted-foreground text-center opacity-40 font-mono -mt-1">
            CLIQUE → SELECIONA · ARRASTA → MOVE · ✕ → REMOVE · ARRASTA DO PAINEL → ADICIONA
          </p>
        </div>

        {/* Col 3 — Item catalog */}
        <div className="w-48 flex-shrink-0 overflow-hidden flex flex-col">
          <DeskCatalogPanel userLevel={userLevel} />
        </div>

      </div>
    </div>
  );
}
