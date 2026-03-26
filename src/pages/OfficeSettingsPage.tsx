import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Save, Plus, Trash2, Check, X, ZoomIn, ZoomOut, Maximize2, RotateCcw } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FurniturePlacement {
  id: string;
  type: FurnitureType;
  x: number; // 0–1 relative to room width
  y: number; // 0–1 relative to room height
}

type FurnitureType =
  | "desk" | "chair" | "table_round" | "monitor" | "sofa"
  | "coffee_table" | "tv" | "whiteboard" | "plant" | "bookshelf"
  | "coffee_machine" | "arcade" | "bean_bag" | "ping_pong" | "neon_sign"
  | "server_rack" | "locker" | "aquarium" | "trophy_case" | "guitar";

interface RoomConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  capacity: number;
  furniture: FurniturePlacement[];
}

// ─── Furniture catalog (categorized + gamer) ──────────────────────────────────

interface FurnitureCatalogItem {
  type: FurnitureType;
  label: string;
  emoji: string;
  w: number;
  h: number;
  category: "work" | "meet" | "lounge" | "vibe";
  rarity?: "common" | "rare" | "epic";
}

const CATALOG: FurnitureCatalogItem[] = [
  // Work
  { type: "desk",          label: "Mesa",          emoji: "🖥️",  w: 2, h: 1, category: "work",   rarity: "common" },
  { type: "chair",         label: "Cadeira",       emoji: "🪑",  w: 1, h: 1, category: "work",   rarity: "common" },
  { type: "monitor",       label: "Monitor",       emoji: "💻",  w: 1, h: 1, category: "work",   rarity: "common" },
  { type: "whiteboard",    label: "Quadro",        emoji: "🗒️",  w: 2, h: 1, category: "work",   rarity: "common" },
  { type: "server_rack",   label: "Servidor",      emoji: "🖧",   w: 1, h: 2, category: "work",   rarity: "rare"   },
  { type: "locker",        label: "Armário",       emoji: "🗄️",  w: 1, h: 2, category: "work",   rarity: "common" },
  // Meet
  { type: "table_round",   label: "Mesa reunião",  emoji: "⬬",   w: 2, h: 2, category: "meet",   rarity: "common" },
  { type: "tv",            label: "TV / Telão",    emoji: "📺",  w: 3, h: 1, category: "meet",   rarity: "common" },
  // Lounge
  { type: "sofa",          label: "Sofá",          emoji: "🛋️",  w: 3, h: 1, category: "lounge", rarity: "common" },
  { type: "coffee_table",  label: "Mesa centro",   emoji: "🪵",  w: 2, h: 1, category: "lounge", rarity: "common" },
  { type: "coffee_machine",label: "Cafeteira",     emoji: "☕",  w: 1, h: 1, category: "lounge", rarity: "common" },
  { type: "bookshelf",     label: "Estante",       emoji: "📚",  w: 1, h: 2, category: "lounge", rarity: "common" },
  { type: "aquarium",      label: "Aquário",       emoji: "🐠",  w: 2, h: 1, category: "lounge", rarity: "rare"   },
  { type: "plant",         label: "Planta",        emoji: "🌿",  w: 1, h: 1, category: "lounge", rarity: "common" },
  // Vibe (gamer/fun)
  { type: "arcade",        label: "Arcade",        emoji: "🕹️",  w: 1, h: 2, category: "vibe",   rarity: "epic"   },
  { type: "bean_bag",      label: "Puff",          emoji: "🫧",  w: 1, h: 1, category: "vibe",   rarity: "rare"   },
  { type: "ping_pong",     label: "Ping-pong",     emoji: "🏓",  w: 3, h: 2, category: "vibe",   rarity: "epic"   },
  { type: "neon_sign",     label: "Neon",          emoji: "🔆",  w: 2, h: 1, category: "vibe",   rarity: "epic"   },
  { type: "trophy_case",   label: "Troféus",       emoji: "🏆",  w: 2, h: 1, category: "vibe",   rarity: "rare"   },
  { type: "guitar",        label: "Guitarra",      emoji: "🎸",  w: 1, h: 2, category: "vibe",   rarity: "rare"   },
];

const RARITY_STYLE: Record<string, { label: string; color: string; glow: string }> = {
  common: { label: "Common",  color: "#94a3b8", glow: "#94a3b820" },
  rare:   { label: "Rare",    color: "#3b82f6", glow: "#3b82f630" },
  epic:   { label: "Epic",    color: "#a855f7", glow: "#a855f740" },
};

const CATEGORIES = [
  { id: "all",    label: "Todos",   emoji: "🏗️" },
  { id: "work",   label: "Trabalho",emoji: "💼" },
  { id: "meet",   label: "Reunião", emoji: "🤝" },
  { id: "lounge", label: "Lounge",  emoji: "🛋️" },
  { id: "vibe",   label: "Vibe",    emoji: "⚡" },
] as const;

const catalogByType = Object.fromEntries(CATALOG.map((c) => [c.type, c])) as Record<FurnitureType, FurnitureCatalogItem>;

// ─── Icons & colors ───────────────────────────────────────────────────────────

const ICONS = ["🏆","📋","👔","☕","💬","🤖","🎯","💡","🚀","🎮","📊","🔬","🎨","📚","🏋️","🎵","🏢","⚡","🧪","🎬","🗺️","🔮","⚔️","🛸","🏴","🌊"];

const COLORS = [
  "#3b82f6","#8b5cf6","#f59e0b","#10b981","#ec4899","#6366f1",
  "#e11d2a","#14b8a6","#f97316","#84cc16","#06b6d4","#a855f7",
];

// ─── Default rooms ────────────────────────────────────────────────────────────

const DEFAULT_ROOMS: RoomConfig[] = [
  {
    id: "sales", name: "Vendas", icon: "🏆", color: "#3b82f6", capacity: 20,
    furniture: [
      { id: "s1", type: "desk",       x: 0.15, y: 0.22 },
      { id: "s2", type: "desk",       x: 0.50, y: 0.22 },
      { id: "s3", type: "desk",       x: 0.82, y: 0.22 },
      { id: "s4", type: "chair",      x: 0.15, y: 0.42 },
      { id: "s5", type: "chair",      x: 0.50, y: 0.42 },
      { id: "s6", type: "chair",      x: 0.82, y: 0.42 },
      { id: "s7", type: "whiteboard", x: 0.50, y: 0.78 },
      { id: "s8", type: "trophy_case",x: 0.88, y: 0.82 },
    ],
  },
  {
    id: "meetings", name: "Reuniões", icon: "📋", color: "#8b5cf6", capacity: 15,
    furniture: [
      { id: "m1", type: "table_round", x: 0.50, y: 0.45 },
      { id: "m2", type: "chair", x: 0.28, y: 0.30 },
      { id: "m3", type: "chair", x: 0.50, y: 0.20 },
      { id: "m4", type: "chair", x: 0.72, y: 0.30 },
      { id: "m5", type: "chair", x: 0.72, y: 0.60 },
      { id: "m6", type: "chair", x: 0.50, y: 0.72 },
      { id: "m7", type: "chair", x: 0.28, y: 0.60 },
      { id: "m8", type: "tv",    x: 0.50, y: 0.90 },
      { id: "m9", type: "plant", x: 0.88, y: 0.12 },
    ],
  },
  {
    id: "direction", name: "Diretoria", icon: "👔", color: "#f59e0b", capacity: 8,
    furniture: [
      { id: "d1", type: "desk",         x: 0.50, y: 0.22 },
      { id: "d2", type: "chair",        x: 0.50, y: 0.40 },
      { id: "d3", type: "sofa",         x: 0.50, y: 0.72 },
      { id: "d4", type: "coffee_table", x: 0.50, y: 0.58 },
      { id: "d5", type: "plant",        x: 0.08, y: 0.88 },
      { id: "d6", type: "plant",        x: 0.92, y: 0.88 },
    ],
  },
  {
    id: "lounge", name: "Lounge", icon: "☕", color: "#10b981", capacity: 30,
    furniture: [
      { id: "l1", type: "sofa",          x: 0.22, y: 0.55 },
      { id: "l2", type: "sofa",          x: 0.72, y: 0.55 },
      { id: "l3", type: "coffee_table",  x: 0.48, y: 0.55 },
      { id: "l4", type: "coffee_machine",x: 0.50, y: 0.18 },
      { id: "l5", type: "bookshelf",     x: 0.88, y: 0.32 },
      { id: "l6", type: "arcade",        x: 0.10, y: 0.30 },
      { id: "l7", type: "plant",         x: 0.10, y: 0.88 },
    ],
  },
  {
    id: "oneonone", name: "1:1", icon: "💬", color: "#ec4899", capacity: 2,
    furniture: [
      { id: "o1", type: "desk",      x: 0.50, y: 0.30 },
      { id: "o2", type: "chair",     x: 0.35, y: 0.52 },
      { id: "o3", type: "chair",     x: 0.65, y: 0.52 },
      { id: "o4", type: "neon_sign", x: 0.50, y: 0.82 },
    ],
  },
  {
    id: "training", name: "Atlas Lab", icon: "🤖", color: "#6366f1", capacity: 15,
    furniture: [
      { id: "t1", type: "desk",        x: 0.20, y: 0.25 },
      { id: "t2", type: "desk",        x: 0.50, y: 0.25 },
      { id: "t3", type: "desk",        x: 0.80, y: 0.25 },
      { id: "t4", type: "chair",       x: 0.20, y: 0.42 },
      { id: "t5", type: "chair",       x: 0.50, y: 0.42 },
      { id: "t6", type: "chair",       x: 0.80, y: 0.42 },
      { id: "t7", type: "tv",          x: 0.50, y: 0.82 },
      { id: "t8", type: "server_rack", x: 0.08, y: 0.50 },
    ],
  },
];

// ─── RoomPreview with zoom ────────────────────────────────────────────────────

interface RoomPreviewProps {
  room: RoomConfig;
  zoom: number;
  onMove: (id: string, x: number, y: number) => void;
  onRemove: (id: string) => void;
  onDrop: (type: FurnitureType, x: number, y: number) => void;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

function RoomPreview({ room, zoom, onMove, onRemove, onDrop, selected, onSelect }: RoomPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const draggingId = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [dragOver, setDragOver] = useState(false);

  function pxToRel(px: number, py: number, rect: DOMRect) {
    return {
      x: Math.max(0.02, Math.min(0.97, px / rect.width)),
      y: Math.max(0.02, Math.min(0.95, py / rect.height)),
    };
  }

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    draggingId.current = id;

    const rect = previewRef.current!.getBoundingClientRect();
    const placement = room.furniture.find((f) => f.id === id)!;
    if (!placement) return;
    dragOffset.current = {
      x: e.clientX - rect.left - placement.x * rect.width,
      y: e.clientY - rect.top  - placement.y * rect.height,
    };

    const handleMove = (mv: MouseEvent) => {
      if (!draggingId.current || !previewRef.current) return;
      const r = previewRef.current.getBoundingClientRect();
      const { x, y } = pxToRel(
        mv.clientX - r.left - dragOffset.current.x,
        mv.clientY - r.top  - dragOffset.current.y,
        r
      );
      onMove(draggingId.current!, x, y);
    };

    const handleUp = () => {
      draggingId.current = null;
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [room.furniture, onMove]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const type = e.dataTransfer.getData("furniture-type") as FurnitureType;
    if (!type || !previewRef.current) return;
    const rect = previewRef.current.getBoundingClientRect();
    const { x, y } = pxToRel(e.clientX - rect.left, e.clientY - rect.top, rect);
    onDrop(type, x, y);
  };

  const GRID = 44;
  const BASE_H = 320;

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl"
      style={{ height: BASE_H * zoom + 2 }}
    >
      {/* Scaled inner */}
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
          background: `${room.color}0d`,
          border: `2px solid ${dragOver ? room.color : room.color + "44"}`,
          borderRadius: 16,
          boxShadow: dragOver ? `inset 0 0 0 2px ${room.color}60` : undefined,
        }}
      >
        {/* Room label */}
        <div
          className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold z-10 pointer-events-none"
          style={{ background: `${room.color}25`, color: room.color, letterSpacing: "0.03em" }}
        >
          <span>{room.icon}</span>
          <span>{room.name}</span>
        </div>

        {/* Capacity */}
        <div className="absolute top-3 right-3 text-[10px] text-muted-foreground bg-black/30 px-2 py-0.5 rounded-full z-10 pointer-events-none font-mono">
          cap. {room.capacity}
        </div>

        {/* Grid floor */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={`g-${room.id}`} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke={room.color} strokeWidth="0.5" opacity="0.12" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#g-${room.id})`} />
        </svg>

        {/* Drop hint overlay */}
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div
              className="text-sm font-bold px-5 py-2.5 rounded-2xl border"
              style={{
                background: `${room.color}22`,
                borderColor: room.color,
                color: room.color,
                boxShadow: `0 0 20px ${room.color}40`,
              }}
            >
              ⬇ Soltar aqui
            </div>
          </div>
        )}

        {/* Furniture */}
        {room.furniture.map((f) => {
          const cat = catalogByType[f.type];
          const isSelected = selected === f.id;
          const rar = RARITY_STYLE[cat?.rarity ?? "common"];
          const W = (cat?.w ?? 1) * 34;
          const H = (cat?.h ?? 1) * 34;

          return (
            <div
              key={f.id}
              onMouseDown={(e) => handleMouseDown(e, f.id)}
              style={{
                position: "absolute",
                left: `calc(${f.x * 100}% - ${W / 2}px)`,
                top:  `calc(${f.y * 100}% - ${H / 2}px)`,
                width: W,
                height: H,
                zIndex: isSelected ? 30 : 20,
                cursor: "grab",
              }}
            >
              <div
                className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all"
                style={{
                  background: isSelected ? `${rar.color}28` : `${room.color}14`,
                  border: `1.5px solid ${isSelected ? rar.color : room.color + "50"}`,
                  boxShadow: isSelected ? `0 0 10px ${rar.color}60, 0 0 0 1px ${rar.color}40` : "none",
                }}
              >
                <span className="text-sm leading-none">{cat?.emoji ?? "📦"}</span>
                {H >= 48 && (
                  <span className="text-[7px] leading-none opacity-50 text-center px-0.5 mt-0.5">
                    {cat?.label}
                  </span>
                )}
              </div>

              {/* Rarity dot */}
              {cat?.rarity !== "common" && (
                <div
                  className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-background z-30"
                  style={{ backgroundColor: rar.color, boxShadow: `0 0 4px ${rar.color}` }}
                />
              )}

              {/* Remove × */}
              {isSelected && (
                <button
                  onMouseDown={(e) => { e.stopPropagation(); onRemove(f.id); }}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:bg-red-400 z-40 transition-colors"
                >
                  <X size={9} />
                </button>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {room.furniture.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none opacity-30">
            <span className="text-4xl">{room.icon}</span>
            <p className="text-xs text-muted-foreground">Arraste itens do catálogo para equipar a sala</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Furniture Catalog Panel ──────────────────────────────────────────────────

function CatalogPanel() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filtered = useMemo(
    () => activeCategory === "all" ? CATALOG : CATALOG.filter((c) => c.category === activeCategory),
    [activeCategory]
  );

  return (
    <div className="flex flex-col gap-2 h-full">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        Catálogo
      </p>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
              activeCategory === cat.id
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent"
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {filtered.map((item) => {
          const rar = RARITY_STYLE[item.rarity ?? "common"];
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("furniture-type", item.type);
                e.dataTransfer.effectAllowed = "copy";
              }}
              className="group flex items-center gap-2.5 px-2.5 py-2 rounded-xl border cursor-grab active:cursor-grabbing transition-all select-none"
              style={{
                background: `${rar.glow}`,
                borderColor: `${rar.color}30`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = rar.color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${rar.glow}`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${rar.color}30`;
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
              }}
            >
              <span className="text-xl leading-none w-7 text-center flex-shrink-0">{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground font-medium truncate">{item.label}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: rar.color }}>
                  {rar.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-2 flex-wrap pt-1">
        {Object.entries(RARITY_STYLE).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: v.color }} />
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OfficeSettingsPage() {
  const [rooms, setRooms] = useState<RoomConfig[]>(DEFAULT_ROOMS);
  const [selectedRoom, setSelectedRoom] = useState<string>(DEFAULT_ROOMS[0].id);
  const [selectedFurniture, setSelectedFurniture] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [zoom, setZoom] = useState(1);

  const room = rooms.find((r) => r.id === selectedRoom)!;

  function updateRoom(patch: Partial<RoomConfig>) {
    setRooms((prev) => prev.map((r) => (r.id === selectedRoom ? { ...r, ...patch } : r)));
  }

  const moveFurniture = useCallback((id: string, x: number, y: number) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === selectedRoom
          ? { ...r, furniture: r.furniture.map((f) => (f.id === id ? { ...f, x, y } : f)) }
          : r
      )
    );
  }, [selectedRoom]);

  function removeFurniture(id: string) {
    updateRoom({ furniture: room.furniture.filter((f) => f.id !== id) });
    setSelectedFurniture(null);
  }

  function dropFurniture(type: FurnitureType, x: number, y: number) {
    const newItem: FurniturePlacement = { id: `${type}-${Date.now()}`, type, x, y };
    updateRoom({ furniture: [...room.furniture, newItem] });
    setSelectedFurniture(newItem.id);
  }

  function addRoom() {
    const newId = `room-${Date.now()}`;
    setRooms((prev) => [...prev, {
      id: newId, name: "Nova Sala", icon: "🏢", color: "#3b82f6", capacity: 10, furniture: [],
    }]);
    setSelectedRoom(newId);
    setSelectedFurniture(null);
  }

  function deleteRoom(id: string) {
    if (rooms.length <= 1) return;
    const next = rooms.find((r) => r.id !== id);
    setRooms((prev) => prev.filter((r) => r.id !== id));
    if (selectedRoom === id && next) setSelectedRoom(next.id);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  useEffect(() => { setSelectedFurniture(null); }, [selectedRoom]);

  const zoomSteps = [0.6, 0.75, 1, 1.25, 1.5];
  const zoomIdx = zoomSteps.indexOf(zoom);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Configurar Salas</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Arraste itens do catálogo · clique para selecionar · ✕ para remover
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
            saved
              ? "bg-green-500/20 text-green-400 border border-green-500/40"
              : "bg-primary text-white hover:opacity-90"
          }`}
        >
          {saved ? <Check size={14} /> : <Save size={14} />}
          {saved ? "Salvo!" : "Salvar"}
        </button>
      </div>

      {/* ── Body 3 cols ── */}
      <div className="flex flex-1 gap-3 min-h-0 overflow-hidden">

        {/* Col 1 — Room list */}
        <div className="w-44 flex flex-col gap-2 flex-shrink-0">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Salas</p>
          <div className="flex flex-col gap-1 flex-1 overflow-y-auto">
            {rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => { setSelectedRoom(r.id); setSelectedFurniture(null); }}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${
                  r.id === selectedRoom
                    ? "text-foreground font-bold shadow-sm"
                    : "hover:bg-secondary/60 text-muted-foreground"
                }`}
                style={r.id === selectedRoom ? {
                  background: `${r.color}18`,
                  border: `1px solid ${r.color}44`,
                } : { border: "1px solid transparent" }}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                <span className="text-base">{r.icon}</span>
                <span className="flex-1 truncate text-xs">{r.name}</span>
                {r.id === selectedRoom && rooms.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRoom(r.id); }}
                    className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={addRoom}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors border border-dashed border-border/50"
          >
            <Plus size={13} /> Nova sala
          </button>
        </div>

        {/* Col 2 — Preview */}
        <div className="flex-1 flex flex-col gap-2.5 min-w-0 overflow-y-auto">

          {/* Identity bar */}
          <div className="flex items-center gap-2.5 glass rounded-xl px-3 py-2.5">
            {/* Icon picker */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-9 h-9 rounded-xl text-lg flex items-center justify-center border border-border/60 hover:border-primary/50 transition-colors bg-secondary/40"
              >
                {room.icon}
              </button>
              {showIconPicker && (
                <div className="absolute top-11 left-0 z-50 glass-strong rounded-xl p-2 grid grid-cols-8 gap-1 shadow-2xl w-52 border border-border/50">
                  {ICONS.map((ic) => (
                    <button
                      key={ic}
                      onClick={() => { updateRoom({ icon: ic }); setShowIconPicker(false); }}
                      className={`text-lg p-1.5 rounded-lg hover:bg-secondary/70 transition-colors ${room.icon === ic ? "bg-primary/25 ring-1 ring-primary/50" : ""}`}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              value={room.name}
              onChange={(e) => updateRoom({ name: e.target.value })}
              className="flex-1 px-3 py-1.5 rounded-xl bg-secondary/40 border border-border/50 text-sm font-semibold focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="Nome da sala"
              maxLength={32}
            />

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[10px] text-muted-foreground">Cap.</span>
              <input
                type="number" min={1} max={100} value={room.capacity}
                onChange={(e) => updateRoom({ capacity: Math.max(1, parseInt(e.target.value) || 1) })}
                className="w-14 px-2 py-1.5 rounded-xl bg-secondary/40 border border-border/50 text-sm text-center focus:outline-none focus:border-primary/50 transition-colors font-mono"
              />
            </div>
          </div>

          {/* Color + Zoom bar */}
          <div className="flex items-center gap-3 px-0.5">
            <div className="flex gap-1.5 flex-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateRoom({ color: c })}
                  className="w-6 h-6 rounded-lg transition-all hover:scale-110 flex-shrink-0"
                  style={{
                    backgroundColor: c,
                    outline: room.color === c ? `2px solid ${c}` : "none",
                    outlineOffset: 2,
                    boxShadow: room.color === c ? `0 0 8px ${c}` : "none",
                  }}
                />
              ))}
              <input
                type="color" value={room.color}
                onChange={(e) => updateRoom({ color: e.target.value })}
                className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0.5 bg-secondary/40 flex-shrink-0"
              />
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-secondary/40 border border-border/40 rounded-xl px-2 py-1 flex-shrink-0">
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
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-secondary/80 transition-colors ml-0.5"
                title="Reset zoom"
              >
                <Maximize2 size={10} />
              </button>
            </div>
          </div>

          {/* Live preview */}
          <RoomPreview
            room={room}
            zoom={zoom}
            onMove={moveFurniture}
            onRemove={removeFurniture}
            onDrop={dropFurniture}
            selected={selectedFurniture}
            onSelect={setSelectedFurniture}
          />

          <p className="text-[9px] text-muted-foreground text-center opacity-50 -mt-1">
            Clique → seleciona · Arrasta → move · ✕ → remove · Arrasta do catálogo → adiciona
          </p>
        </div>

        {/* Col 3 — Catalog */}
        <div className="w-48 flex-shrink-0 overflow-hidden flex flex-col">
          <CatalogPanel />
        </div>

      </div>
    </div>
  );
}
