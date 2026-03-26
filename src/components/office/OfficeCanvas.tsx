import { useEffect, useRef, useState, useCallback } from "react";
import * as PIXI from "pixi.js";
import { useOfficeStore } from "@/store/officeStore";
import { useAuthStore } from "@/store/authStore";
import { moveToRoom } from "@/lib/presence";
import { getStatusColor } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import type { UserPresence } from "@/types";

// ─── Avatar customization config ─────────────────────────────────────────────
export interface AvatarConfig {
  skinIdx:  number; // 0-4
  hairIdx:  number; // 0-7
  shirtIdx: number; // 0-7
}
const DEFAULT_AVATAR_CONFIG: AvatarConfig = { skinIdx: 0, hairIdx: 0, shirtIdx: 0 };

// ─── Seat definition (world-space, generated alongside chairs) ────────────────
interface SeatDef {
  x: number;   // world X
  y: number;   // world Y
  dir: number; // chair direction (used to offset avatar slightly)
  zoneId: string;
}

// ─── Avatar palette constants (shared between buildCharacterSprite & UI) ─────
export const AVATAR_SKIN_TONES   = [0xfde8c8, 0xf4c28f, 0xe8a96a, 0xc68642, 0x8d5524];
export const AVATAR_HAIR_COLORS  = [0x1a0a00, 0x4a2c17, 0x7b4f2e, 0xb87333, 0xffd700, 0x6e3b3b, 0x2c2c5e, 0x888888];
export const AVATAR_SHIRT_COLORS = [0xe11d2a, 0x3b82f6, 0x22c55e, 0x8b5cf6, 0xf97316, 0xec4899, 0x0ea5e9, 0x14b8a6];

// ─── World constants ─────────────────────────────────────────────────────────
const TILE = 40;           // floor tile size
const AVATAR_R = 18;       // avatar radius
const SPEED = 3.2;         // px per frame
// Light theme — Gather.town style
const WALL       = 0x5a4a3a;   // warm brown wall
const FLOOR_A    = 0xe8e4de;   // light warm tile A
const FLOOR_B    = 0xddd8d0;   // light warm tile B
const CORRIDOR   = 0xcfccc5;   // corridor — slightly darker
const GRASS      = 0x7ec850;   // outdoor grass
const GRASS_DARK = 0x6ab842;   // grass shade
const ROOM_FLOOR = 0xdfe8f0;   // inside rooms — blue-tinted light
const WORLD_W = 3600;
const WORLD_H = 1800;

// ─── Room layout ─────────────────────────────────────────────────────────────
// CLOSED rooms: Auditório (1) + Reunião (3) + 1:1 (3) = 7 salas fechadas
// OPEN zones: 7 squads — mesas abertas sem paredes, só carpet colorido
//
// Building left wing (x=60..1360): closed rooms + lounge/kitchen
// Building right/open area (x=1400+): open office squad zones
//
// Corridor at y=400..590 separates top row (y=60..380) from bottom (y=610..980)

interface RoomDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  x: number; y: number;
  w: number; h: number;
  doorX: number; // door center X (along the wall touching corridor)
  doorSide: "top" | "bottom"; // which wall touches corridor
  furniture: FurnitureDef[];
}

interface SquadZoneDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  x: number; y: number;
  w: number; h: number;
  furniture: FurnitureDef[];
}

interface FurnitureDef {
  type: string; x: number; y: number; w: number; h: number; color: number;
  dir?: number; // chair direction: 0=down (back at top), 1=up (back at bottom), 2=right (back at left), 3=left (back at right)
}

// Helper: 9 chairs + workstations around a rectangular table
// Layout: 1 na ponta esquerda + 4 em cima + 4 embaixo = 9 total
// Each seat gets a workstation (monitor + keyboard + mouse) on the table surface.
// Seat dividers are rendered by the "table" case using the tableColor + sideCount.
function makeSquadDesk(tableX: number, tableY: number, tableW: number, tableH: number, color: number, tableColor: number): FurnitureDef[] {
  const cw = 22, ch = 22;
  const gap = 5;
  const items: FurnitureDef[] = [];

  // ── 1 chair on the left end — faces right (dir=2) ─────────────────────────
  items.push({
    type: "chair",
    x: tableX - cw - gap,
    y: tableY + (tableH - ch) / 2,
    w: cw, h: ch, color, dir: 2,
  });

  // ── 4 chairs on top + workstations on top edge of table ───────────────────
  const sideCount = 4;
  const sideStep = tableW / sideCount;
  const wsW = Math.round(sideStep * 0.88); // workstation width per slot
  const wsH = Math.round(tableH * 0.44);   // workstation height (shallow strip)

  for (let i = 0; i < sideCount; i++) {
    const slotX = tableX + sideStep * i;
    // Chair above table
    items.push({
      type: "chair",
      x: slotX + (sideStep - cw) / 2,
      y: tableY - ch - gap,
      w: cw, h: ch, color, dir: 0,
    });
    // Workstation on top portion of table surface
    items.push({
      type: "workstation",
      x: slotX + (sideStep - wsW) / 2,
      y: tableY + 3,
      w: wsW, h: wsH, color: tableColor, dir: 0,
    });
  }

  // ── 4 chairs on bottom + workstations on bottom edge of table ─────────────
  for (let i = 0; i < sideCount; i++) {
    const slotX = tableX + sideStep * i;
    items.push({
      type: "chair",
      x: slotX + (sideStep - cw) / 2,
      y: tableY + tableH + gap,
      w: cw, h: ch, color, dir: 1,
    });
    // Workstation on bottom portion of table surface
    items.push({
      type: "workstation",
      x: slotX + (sideStep - wsW) / 2,
      y: tableY + tableH - wsH - 3,
      w: wsW, h: wsH, color: tableColor, dir: 1,
    });
  }

  // ── Seat dividers — vertical lines on table separating the 4 slots ────────
  // Rendered as thin "divider" furniture items drawn over the table
  for (let i = 1; i < sideCount; i++) {
    items.push({
      type: "seat_divider",
      x: tableX + sideStep * i - 1,
      y: tableY + 2,
      w: 2, h: tableH - 4, color: tableColor,
    });
  }

  return [
    { type: "table", x: tableX, y: tableY, w: tableW, h: tableH, color: tableColor },
    ...items,
  ];
}

// ── Closed rooms ──────────────────────────────────────────────────────────────
const ROOMS: RoomDef[] = [
  // ── Auditório (grande, topo esquerdo) ───────────────────────────────────────
  {
    id: "auditorio", name: "Auditório", icon: "🎭", color: 0xe11d2a,
    x: 60, y: 60, w: 500, h: 320,
    doorX: 310, doorSide: "bottom",
    furniture: [
      // Stage / presentation area
      { type: "whiteboard", x: 180, y: 18, w: 140, h: 28, color: 0xffffff },
      { type: "tv", x: 14, y: 18, w: 140, h: 28, color: 0x111827 },
      // Audience chairs — 4 rows of 6
      ...([0, 1, 2, 3] as const).flatMap((row) =>
        ([0, 1, 2, 3, 4, 5] as const).map((col) => ({
          type: "chair" as const,
          x: 30 + col * 70, y: 80 + row * 52,
          w: 24, h: 24,
          color: (row + col) % 2 === 0 ? 0xe11d2a : 0xb91c1c,
        }))
      ),
      { type: "plant", x: 448, y: 14, w: 28, h: 36, color: 0x15803d },
      { type: "plant", x: 14, y: 260, w: 28, h: 36, color: 0x15803d },
    ],
  },

  // ── Sala de Reunião 1 ────────────────────────────────────────────────────────
  {
    id: "meeting-1", name: "Reunião 1", icon: "📋", color: 0x8b5cf6,
    x: 620, y: 60, w: 280, h: 300,
    doorX: 760, doorSide: "bottom",
    furniture: [
      { type: "table", x: 40, y: 80, w: 200, h: 100, color: 0x4c2d8a },
      ...makeSquadDesk(40, 80, 200, 100, 0x8b5cf6, 0x4c2d8a).slice(1), // just chairs
      { type: "tv", x: 10, y: 20, w: 24, h: 130, color: 0x111827 },
      { type: "plant", x: 228, y: 14, w: 24, h: 32, color: 0x15803d },
    ],
  },

  // ── Sala de Reunião 2 ────────────────────────────────────────────────────────
  {
    id: "meeting-2", name: "Reunião 2", icon: "📋", color: 0x8b5cf6,
    x: 960, y: 60, w: 280, h: 300,
    doorX: 1100, doorSide: "bottom",
    furniture: [
      { type: "table", x: 40, y: 80, w: 200, h: 100, color: 0x4c2d8a },
      ...makeSquadDesk(40, 80, 200, 100, 0x8b5cf6, 0x4c2d8a).slice(1),
      { type: "whiteboard", x: 10, y: 20, w: 100, h: 28, color: 0xf8fafc },
      { type: "plant", x: 228, y: 240, w: 24, h: 32, color: 0x15803d },
    ],
  },

  // ── Sala de Reunião 3 ────────────────────────────────────────────────────────
  {
    id: "meeting-3", name: "Reunião 3", icon: "📋", color: 0x8b5cf6,
    x: 60, y: 630, w: 280, h: 300,
    doorX: 200, doorSide: "top",
    furniture: [
      { type: "table", x: 40, y: 80, w: 200, h: 100, color: 0x4c2d8a },
      ...makeSquadDesk(40, 80, 200, 100, 0x8b5cf6, 0x4c2d8a).slice(1),
      { type: "tv", x: 10, y: 130, w: 24, h: 120, color: 0x111827 },
      { type: "plant", x: 228, y: 14, w: 24, h: 32, color: 0x15803d },
    ],
  },

  // ── Sala 1:1 — A ─────────────────────────────────────────────────────────────
  {
    id: "oneonone-a", name: "1:1 — A", icon: "💬", color: 0xec4899,
    x: 400, y: 630, w: 200, h: 220,
    doorX: 500, doorSide: "top",
    furniture: [
      { type: "desk", x: 20, y: 60, w: 160, h: 50, color: 0x7c3aed },
      { type: "chair", x: 40, y: 108, w: 22, h: 22, color: 0xec4899, dir: 1 },
      { type: "chair", x: 100, y: 108, w: 22, h: 22, color: 0xec4899, dir: 1 },
      { type: "monitor", x: 62, y: 38, w: 36, h: 26, color: 0x1a1a2e },
      { type: "plant", x: 148, y: 160, w: 24, h: 32, color: 0x15803d },
    ],
  },

  // ── Sala 1:1 — B ─────────────────────────────────────────────────────────────
  {
    id: "oneonone-b", name: "1:1 — B", icon: "💬", color: 0xec4899,
    x: 660, y: 630, w: 200, h: 220,
    doorX: 760, doorSide: "top",
    furniture: [
      { type: "desk", x: 20, y: 60, w: 160, h: 50, color: 0x7c3aed },
      { type: "chair", x: 40, y: 108, w: 22, h: 22, color: 0xec4899, dir: 1 },
      { type: "chair", x: 100, y: 108, w: 22, h: 22, color: 0xec4899, dir: 1 },
      { type: "monitor", x: 62, y: 38, w: 36, h: 26, color: 0x1a1a2e },
      { type: "plant", x: 148, y: 160, w: 24, h: 32, color: 0x15803d },
    ],
  },

  // ── Sala 1:1 — C ─────────────────────────────────────────────────────────────
  {
    id: "oneonone-c", name: "1:1 — C", icon: "💬", color: 0xec4899,
    x: 920, y: 630, w: 200, h: 220,
    doorX: 1020, doorSide: "top",
    furniture: [
      { type: "desk", x: 20, y: 60, w: 160, h: 50, color: 0x7c3aed },
      { type: "chair", x: 40, y: 108, w: 22, h: 22, color: 0xec4899, dir: 1 },
      { type: "chair", x: 100, y: 108, w: 22, h: 22, color: 0xec4899, dir: 1 },
      { type: "monitor", x: 62, y: 38, w: 36, h: 26, color: 0x1a1a2e },
      { type: "plant", x: 148, y: 160, w: 24, h: 32, color: 0x15803d },
    ],
  },
];

// ── Open squad zones — sem paredes, só carpet + mesa + cadeiras ───────────────
// Layout: 2 linhas × 4 colunas de squad zones no open office
// Mesa retangular 280×80 com 5 cadeiras em cima e 4 embaixo (9 total)
const SQUAD_TABLE_W = 280, SQUAD_TABLE_H = 80;
const SQUAD_ZONE_W = 360, SQUAD_ZONE_H = 280;

const OPEN_SQUADS: SquadZoneDef[] = [
  {
    id: "squad-cs", name: "Customer Success", icon: "🟢", color: 0x22c55e,
    x: 1420, y: 80, w: SQUAD_ZONE_W, h: SQUAD_ZONE_H,
    furniture: [
      ...makeSquadDesk(40, 90, SQUAD_TABLE_W, SQUAD_TABLE_H, 0x22c55e, 0x14532d),
      { type: "monitor", x: 40, y: 80, w: 30, h: 18, color: 0x1a1a2e },
      { type: "plant", x: 300, y: 20, w: 28, h: 36, color: 0x15803d },
    ],
  },
  {
    id: "squad-comercial", name: "Comercial", icon: "🟠", color: 0xf97316,
    x: 1830, y: 80, w: SQUAD_ZONE_W, h: SQUAD_ZONE_H,
    furniture: [
      ...makeSquadDesk(40, 90, SQUAD_TABLE_W, SQUAD_TABLE_H, 0xf97316, 0x7c2d12),
      { type: "whiteboard", x: 8, y: 20, w: 60, h: 32, color: 0xf8fafc },
      { type: "plant", x: 300, y: 20, w: 28, h: 36, color: 0x15803d },
    ],
  },
  {
    id: "squad-midia", name: "Mídia", icon: "🟣", color: 0x8b5cf6,
    x: 2240, y: 80, w: SQUAD_ZONE_W, h: SQUAD_ZONE_H,
    furniture: [
      ...makeSquadDesk(40, 90, SQUAD_TABLE_W, SQUAD_TABLE_H, 0x8b5cf6, 0x3b0764),
      { type: "tv", x: 300, y: 60, w: 26, h: 120, color: 0x111827 },
      { type: "plant", x: 8, y: 20, w: 28, h: 36, color: 0x15803d },
    ],
  },
  {
    id: "squad-tech", name: "Tech & Produto", icon: "🔴", color: 0xef4444,
    x: 2650, y: 80, w: SQUAD_ZONE_W, h: SQUAD_ZONE_H,
    furniture: [
      ...makeSquadDesk(40, 90, SQUAD_TABLE_W, SQUAD_TABLE_H, 0xef4444, 0x7f1d1d),
      { type: "monitor", x: 40, y: 80, w: 30, h: 18, color: 0x1a1a2e },
      { type: "tv", x: 8, y: 40, w: 22, h: 130, color: 0x111827 },
      { type: "plant", x: 300, y: 200, w: 28, h: 36, color: 0x15803d },
    ],
  },
  {
    id: "squad-ops", name: "Operações", icon: "🟡", color: 0xf59e0b,
    x: 1420, y: 650, w: SQUAD_ZONE_W, h: SQUAD_ZONE_H,
    furniture: [
      ...makeSquadDesk(40, 90, SQUAD_TABLE_W, SQUAD_TABLE_H, 0xf59e0b, 0x78350f),
      { type: "monitor", x: 40, y: 80, w: 30, h: 18, color: 0x1a1a2e },
      { type: "plant", x: 300, y: 200, w: 28, h: 36, color: 0x15803d },
    ],
  },
  {
    id: "squad-conteudo", name: "Conteúdo", icon: "🩷", color: 0xec4899,
    x: 1830, y: 650, w: SQUAD_ZONE_W, h: SQUAD_ZONE_H,
    furniture: [
      ...makeSquadDesk(40, 90, SQUAD_TABLE_W, SQUAD_TABLE_H, 0xec4899, 0x831843),
      { type: "whiteboard", x: 8, y: 200, w: 60, h: 32, color: 0xfce7f3 },
      { type: "plant", x: 300, y: 20, w: 28, h: 36, color: 0x15803d },
    ],
  },
  {
    id: "squad-design", name: "Design", icon: "🟣", color: 0xa855f7,
    x: 2240, y: 650, w: SQUAD_ZONE_W, h: SQUAD_ZONE_H,
    furniture: [
      ...makeSquadDesk(40, 90, SQUAD_TABLE_W, SQUAD_TABLE_H, 0xa855f7, 0x4a044e),
      { type: "tv", x: 300, y: 80, w: 26, h: 110, color: 0x111827 },
      { type: "plant", x: 8, y: 200, w: 28, h: 36, color: 0x166534 },
    ],
  },
];

// ─── Pre-compute all world-space seat positions ───────────────────────────────
// Seats are the chair positions in each OPEN_SQUAD zone (world coords)
function computeAllSeats(): SeatDef[] {
  const seats: SeatDef[] = [];
  for (const zone of OPEN_SQUADS) {
    for (const f of zone.furniture) {
      if (f.type === "chair") {
        seats.push({
          x: zone.x + f.x + f.w / 2,
          y: zone.y + f.y + f.h / 2,
          dir: f.dir ?? 0,
          zoneId: zone.id,
        });
      }
    }
  }
  return seats;
}
const ALL_SEATS = computeAllSeats();
const SEAT_SNAP_RADIUS = 38; // px — how close to a seat center to trigger "sit"

const DOOR_W = 56; // door opening width

// Spawn position — center corridor
const SPAWN_X = 680;
const SPAWN_Y = 480;

export function OfficeCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const worldRef = useRef<PIXI.Container | null>(null);
  const myAvatarRef = useRef<PIXI.Container | null>(null);
  const avatarSpritesRef = useRef<Map<string, PIXI.Container>>(new Map());
  const texturesRef = useRef<Map<string, PIXI.Texture>>(new Map());
  const keysRef = useRef<Set<string>>(new Set());
  const posRef = useRef({ x: SPAWN_X, y: SPAWN_Y });
  const tickerRef = useRef<PIXI.Ticker | null>(null);
  const roomBoundsRef = useRef<Array<{ id: string; x: number; y: number; w: number; h: number }>>([]);

  const zoomRef = useRef(0.7); // start zoomed out so office fits screen
  const [zoomDisplay, setZoomDisplay] = useState(0.7);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const worldOffsetRef = useRef({ x: 0, y: 0 });

  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [roomPopup, setRoomPopup] = useState<{ roomId: string } | null>(null);
  const [selectedUserId, setSelectedUserIdLocal] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);

  // Avatar customization
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [showAvatarPanel, setShowAvatarPanel] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const avatarConfigRef = useRef<AvatarConfig>(DEFAULT_AVATAR_CONFIG);

  // Seated state
  const [seatedAt, setSeatedAt] = useState<SeatDef | null>(null);
  const seatedAtRef = useRef<SeatDef | null>(null);

  const { presences, setSelectedUser } = useOfficeStore();
  const { user } = useAuthStore();

  // ─── Init PixiJS ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    let destroyed = false;
    const app = new PIXI.Application();

    app.init({
      width: canvasRef.current.clientWidth || 1000,
      height: canvasRef.current.clientHeight || 620,
      backgroundColor: GRASS,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    }).then(() => {
      if (destroyed || !canvasRef.current) return;
      canvasRef.current.appendChild(app.canvas);
      appRef.current = app;

      // World container — camera pans by offsetting this
      const world = new PIXI.Container();
      worldRef.current = world;
      app.stage.addChild(world);

      // ─── Floor ───────────────────────────────────────────────────────────
      const floorLayer = new PIXI.Graphics();
      world.addChild(floorLayer);
      drawWorld(floorLayer);

      // ─── Rooms ───────────────────────────────────────────────────────────
      const roomLayer = new PIXI.Container();
      world.addChild(roomLayer);
      // Draw open squad zones first (under everything)
      OPEN_SQUADS.forEach((z) => drawSquadZone(roomLayer, z));
      // Then draw closed rooms on top
      ROOMS.forEach((r) => drawRoom(roomLayer, r));

      // Store room + zone bounds for entry detection (collision still uses ROOMS for walls)
      const allZones = [
        ...ROOMS.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h })),
        ...OPEN_SQUADS.map((z) => ({ id: z.id, x: z.x, y: z.y, w: z.w, h: z.h })),
      ];
      roomBoundsRef.current = allZones;

      // ─── Avatars layer ────────────────────────────────────────────────────
      const avatarLayer = new PIXI.Container();
      avatarLayer.name = "avatars";
      avatarLayer.zIndex = 10;
      world.addChild(avatarLayer);

      // ─── My avatar ───────────────────────────────────────────────────────
      const myAv = buildMyAvatar(user);
      myAv.x = SPAWN_X;
      myAv.y = SPAWN_Y;
      myAvatarRef.current = myAv;
      avatarLayer.addChild(myAv);

      // Other presences already loaded
      const currentPresences = useOfficeStore.getState().presences;
      currentPresences
        .filter((p) => p.user_id !== user?.id)
        .forEach((p) => {
          const av = buildOtherAvatar(p);
          avatarLayer.addChild(av);
          avatarSpritesRef.current.set(p.user_id, av);
        });

      // ─── Minimap ─────────────────────────────────────────────────────────
      const mm = buildMinimap(app);
      app.stage.addChild(mm);

      // ─── Camera + movement ticker ─────────────────────────────────────────
      const ticker = new PIXI.Ticker();
      tickerRef.current = ticker;
      ticker.add(() => {
        // If seated, WASD makes you stand up first
        if (seatedAtRef.current) {
          const anyKey = keysRef.current.has("ArrowLeft") || keysRef.current.has("a") || keysRef.current.has("A")
                      || keysRef.current.has("ArrowRight") || keysRef.current.has("d") || keysRef.current.has("D")
                      || keysRef.current.has("ArrowUp") || keysRef.current.has("w") || keysRef.current.has("W")
                      || keysRef.current.has("ArrowDown") || keysRef.current.has("s") || keysRef.current.has("S");
          if (anyKey) standUp();
          return;
        }

        const dx = (keysRef.current.has("ArrowLeft") || keysRef.current.has("a") || keysRef.current.has("A") ? -1 : 0)
                 + (keysRef.current.has("ArrowRight") || keysRef.current.has("d") || keysRef.current.has("D") ? 1 : 0);
        const dy = (keysRef.current.has("ArrowUp") || keysRef.current.has("w") || keysRef.current.has("W") ? -1 : 0)
                 + (keysRef.current.has("ArrowDown") || keysRef.current.has("s") || keysRef.current.has("S") ? 1 : 0);

        if (dx !== 0 || dy !== 0) {
          const nx = posRef.current.x + dx * SPEED;
          const ny = posRef.current.y + dy * SPEED;

          if (!isColliding(nx, ny)) {
            posRef.current.x = nx;
            posRef.current.y = ny;
          } else if (!isColliding(nx, posRef.current.y)) {
            posRef.current.x = nx;
          } else if (!isColliding(posRef.current.x, ny)) {
            posRef.current.y = ny;
          }

          if (myAvatarRef.current) {
            myAvatarRef.current.x = posRef.current.x;
            myAvatarRef.current.y = posRef.current.y;
          }

          // Check room entry
          checkRoomEntry();

          // Update minimap dot
          const mmDot = mm.getChildByName("meDot") as PIXI.Graphics;
          if (mmDot) {
            const s = 165 / 2400;
            mmDot.x = posRef.current.x * s;
            mmDot.y = posRef.current.y * s;
          }

          // Throttle DB update (every 2s handled in presence hook)
        }

        // Camera follows my avatar — clamp to world bounds
        const cw = app.screen.width;
        const ch = app.screen.height;
        const targetX = cw / 2 - posRef.current.x;
        const targetY = ch / 2 - posRef.current.y;
        world.x += (targetX - world.x) * 0.12;
        world.y += (targetY - world.y) * 0.12;
      });
      ticker.start();

      // ─── Apply initial zoom ───────────────────────────────────────────
      app.stage.scale.set(zoomRef.current);

      // ─── Resize ────────────────────────────────────────────────────────
      const onResize = () => {
        if (!canvasRef.current || !appRef.current) return;
        app.renderer.resize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
        mm.x = app.screen.width - 175;
        mm.y = app.screen.height - 148;
      };
      window.addEventListener("resize", onResize);

      // ─── Wheel zoom ────────────────────────────────────────────────────
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const ZOOM_SPEED = 0.001;
        const newZoom = Math.max(0.35, Math.min(1.6, zoomRef.current - e.deltaY * ZOOM_SPEED));
        zoomRef.current = newZoom;
        app.stage.scale.set(newZoom);
        setZoomDisplay(newZoom);
      };
      canvasRef.current?.addEventListener("wheel", onWheel, { passive: false });

      // ─── Mouse pan (drag to scroll map) ──────────────────────────────────
      const onMouseDown = (e: MouseEvent) => {
        // Only pan on left button, and only if NOT clicking on a room popup / UI overlay
        if (e.button !== 0) return;
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        const world = worldRef.current;
        if (world) worldOffsetRef.current = { x: world.x, y: world.y };
        (e.currentTarget as HTMLElement).style.cursor = "grabbing";
      };
      const onMouseMove = (e: MouseEvent) => {
        if (!isPanningRef.current) return;
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        const world = worldRef.current;
        if (!world) return;
        world.x = worldOffsetRef.current.x + dx;
        world.y = worldOffsetRef.current.y + dy;
        // Sync posRef so camera lerp doesn't fight the drag
        const cw = app.screen.width;
        const ch = app.screen.height;
        posRef.current.x = (cw / 2 - world.x);
        posRef.current.y = (ch / 2 - world.y);
        if (myAvatarRef.current) {
          myAvatarRef.current.x = posRef.current.x;
          myAvatarRef.current.y = posRef.current.y;
        }
      };
      const onMouseUp = (e: MouseEvent) => {
        if (!isPanningRef.current) return;
        isPanningRef.current = false;
        (e.currentTarget as HTMLElement).style.cursor = "default";
      };
      const onMouseLeave = () => {
        isPanningRef.current = false;
        if (canvasRef.current) canvasRef.current.style.cursor = "default";
      };
      // ─── Double-click to sit/stand ──────────────────────────────────────
      const onDblClick = (e: MouseEvent) => {
        // If already seated, stand up
        if (seatedAtRef.current) { standUp(); return; }

        // Convert screen coords → world coords
        const rect = canvasRef.current!.getBoundingClientRect();
        const sx = (e.clientX - rect.left) / zoomRef.current;
        const sy = (e.clientY - rect.top)  / zoomRef.current;
        const worldX = sx - (worldRef.current?.x ?? 0) / zoomRef.current;
        const worldY = sy - (worldRef.current?.y ?? 0) / zoomRef.current;

        // Find nearest seat within snap radius
        let nearest: SeatDef | null = null;
        let nearestDist = SEAT_SNAP_RADIUS;
        for (const seat of ALL_SEATS) {
          const d = Math.hypot(seat.x - worldX, seat.y - worldY);
          if (d < nearestDist) { nearest = seat; nearestDist = d; }
        }
        if (nearest) sitDown(nearest);
      };

      canvasRef.current?.addEventListener("mousedown", onMouseDown);
      canvasRef.current?.addEventListener("mousemove", onMouseMove);
      canvasRef.current?.addEventListener("mouseup", onMouseUp);
      canvasRef.current?.addEventListener("mouseleave", onMouseLeave);
      canvasRef.current?.addEventListener("dblclick", onDblClick);

      return () => {
        window.removeEventListener("resize", onResize);
        canvasRef.current?.removeEventListener("wheel", onWheel);
        canvasRef.current?.removeEventListener("mousedown", onMouseDown);
        canvasRef.current?.removeEventListener("mousemove", onMouseMove);
        canvasRef.current?.removeEventListener("mouseup", onMouseUp);
        canvasRef.current?.removeEventListener("mouseleave", onMouseLeave);
        canvasRef.current?.removeEventListener("dblclick", onDblClick);
      };
    });

    // Keyboard listeners
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)) {
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      destroyed = true;
      tickerRef.current?.destroy();
      tickerRef.current = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  // ─── Load avatar config from profile ──────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_profiles")
      .select("avatar_config")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.avatar_config) {
          const cfg = data.avatar_config as AvatarConfig;
          setAvatarConfig(cfg);
          avatarConfigRef.current = cfg;
          rebuildMyAvatar(cfg, seatedAtRef.current !== null);
        }
      });
  }, [user?.id]);

  // ─── Recreate my avatar when user loads (async after PixiJS init) ────────
  useEffect(() => {
    rebuildMyAvatar(avatarConfigRef.current, seatedAtRef.current !== null);
  }, [user?.id, user?.avatar_url]);

  function rebuildMyAvatar(config: AvatarConfig, seated: boolean) {
    const world = worldRef.current;
    if (!world || !user) return;
    const avatarLayer = world.getChildByName("avatars") as PIXI.Container | null;
    if (!avatarLayer) return;
    if (myAvatarRef.current) {
      avatarLayer.removeChild(myAvatarRef.current);
      myAvatarRef.current.destroy();
    }
    const myAv = buildMyAvatar(user, config, seated);
    myAv.x = posRef.current.x;
    myAv.y = posRef.current.y;
    myAvatarRef.current = myAv;
    avatarLayer.addChild(myAv);
  }

  // ─── Room popup trigger ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeRoom) {
      // Small delay so entry feels natural, not instant
      const t = setTimeout(() => setRoomPopup({ roomId: activeRoom }), 600);
      return () => clearTimeout(t);
    } else {
      setRoomPopup(null);
    }
  }, [activeRoom]);

  // ─── Update other avatars on presence change ──────────────────────────────
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const avatarLayer = world.getChildByName("avatars") as PIXI.Container;
    if (!avatarLayer) return;

    const existingIds = new Set(avatarSpritesRef.current.keys());
    for (const p of presences) {
      if (p.user_id === user?.id) continue; // my avatar is managed separately
      existingIds.delete(p.user_id);
      if (avatarSpritesRef.current.has(p.user_id)) {
        const av = avatarSpritesRef.current.get(p.user_id)!;
        smoothMove(av, p.x, p.y);
        updateRing(av, p.status);
      } else {
        const av = buildOtherAvatar(p);
        avatarLayer.addChild(av);
        avatarSpritesRef.current.set(p.user_id, av);
      }
    }
    for (const leftId of existingIds) {
      const av = avatarSpritesRef.current.get(leftId);
      if (av) { av.parent?.removeChild(av); av.destroy(); }
      avatarSpritesRef.current.delete(leftId);
    }
  }, [presences, user?.id]);

  // ─── Sit / stand ─────────────────────────────────────────────────────────
  function sitDown(seat: SeatDef) {
    // Move avatar to seat position
    posRef.current.x = seat.x;
    posRef.current.y = seat.y;
    if (myAvatarRef.current) {
      myAvatarRef.current.x = seat.x;
      myAvatarRef.current.y = seat.y;
    }
    seatedAtRef.current = seat;
    setSeatedAt(seat);
    rebuildMyAvatar(avatarConfigRef.current, true);
  }

  function standUp() {
    seatedAtRef.current = null;
    setSeatedAt(null);
    rebuildMyAvatar(avatarConfigRef.current, false);
  }

  // ─── Collision detection ──────────────────────────────────────────────────
  function isColliding(x: number, y: number): boolean {
    const r = AVATAR_R - 2;
    // World bounds
    if (x - r < 0 || x + r > WORLD_W || y - r < 0 || y + r > WORLD_H) return true;

    for (const room of ROOMS) {
      const inside = x > room.x && x < room.x + room.w && y > room.y && y < room.y + room.h;
      if (!inside) continue;
      // Check if avatar is passing through a wall (not the door opening)
      const atDoor = isDoorPassage(x, y, room);
      if (!atDoor) {
        // Check which wall is being hit
        const hitWall = isHittingRoomWall(x, y, room);
        if (hitWall) return true;
      }
    }
    return false;
  }

  function isDoorPassage(x: number, y: number, room: RoomDef): boolean {
    const halfDoor = DOOR_W / 2;
    if (room.doorSide === "bottom") {
      // Bottom wall of room
      if (y > room.y + room.h - 16 && y < room.y + room.h + 16) {
        return Math.abs(x - room.doorX) < halfDoor;
      }
    } else {
      // Top wall of room
      if (y > room.y - 16 && y < room.y + 16) {
        return Math.abs(x - room.doorX) < halfDoor;
      }
    }
    return false;
  }

  function isHittingRoomWall(x: number, y: number, room: RoomDef): boolean {
    const r = AVATAR_R - 2;
    const wallT = 10; // wall thickness
    // Top wall
    if (y - r < room.y + wallT && room.doorSide !== "top") return true;
    if (y - r < room.y + wallT && room.doorSide === "top" && Math.abs(x - room.doorX) > DOOR_W / 2) return true;
    // Bottom wall
    if (y + r > room.y + room.h - wallT && room.doorSide !== "bottom") return true;
    if (y + r > room.y + room.h - wallT && room.doorSide === "bottom" && Math.abs(x - room.doorX) > DOOR_W / 2) return true;
    // Left wall
    if (x - r < room.x + wallT) return true;
    // Right wall
    if (x + r > room.x + room.w - wallT) return true;
    return false;
  }

  // ─── Room entry detection ─────────────────────────────────────────────────
  function checkRoomEntry() {
    const { x, y } = posRef.current;
    let newRoom: string | null = null;
    for (const r of ROOMS) {
      if (x > r.x + 10 && x < r.x + r.w - 10 && y > r.y + 10 && y < r.y + r.h - 10) {
        newRoom = r.id;
        break;
      }
    }
    setActiveRoom((prev) => {
      if (prev !== newRoom) {
        if (newRoom) {
          moveToRoom(newRoom, posRef.current.x, posRef.current.y);
        }
        return newRoom;
      }
      return prev;
    });
  }

  // ─── Draw world (floor + corridor) ────────────────────────────────────────
  function drawWorld(g: PIXI.Graphics) {
    // ── Outdoor grass area (entire world base) ──────────────────────────────
    g.rect(0, 0, WORLD_W, WORLD_H).fill({ color: GRASS });

    // Grass texture — subtle diagonal variation
    for (let tx = 0; tx < WORLD_W; tx += TILE) {
      for (let ty = 0; ty < WORLD_H; ty += TILE) {
        const shade = ((tx / TILE + ty / TILE) % 2 === 0) ? GRASS : GRASS_DARK;
        g.rect(tx, ty, TILE, TILE).fill({ color: shade, alpha: 0.3 });
      }
    }

    // ── Indoor building floor (the building footprint) ──────────────────────
    // Building zone: rooms above + below corridor + corridor itself
    // Two row spans: y=40..400 (top rooms) and y=590..1000 (bottom rooms)
    // Corridor: y=400..590
    // Full building strip x=60..1360
    g.roundRect(60, 40, 1300, 960, 6).fill({ color: FLOOR_A });

    // Checkerboard floor tiles inside building
    for (let tx = 60; tx < 1360; tx += TILE) {
      for (let ty = 40; ty < 1000; ty += TILE) {
        const shade = ((Math.floor(tx / TILE) + Math.floor(ty / TILE)) % 2 === 0) ? FLOOR_A : FLOOR_B;
        g.rect(tx, ty, TILE - 1, TILE - 1).fill({ color: shade });
      }
    }

    // Subtle tile grout lines
    g.setStrokeStyle({ color: 0xb8b0a4, width: 0.5, alpha: 0.5 });
    for (let tx = 60; tx <= 1360; tx += TILE) g.moveTo(tx, 40).lineTo(tx, 1000);
    for (let ty = 40; ty <= 1000; ty += TILE) g.moveTo(60, ty).lineTo(1360, ty);
    g.stroke();

    // ── Corridor separator lines ─────────────────────────────────────────────
    g.rect(60, 400, 1300, 2).fill({ color: 0xb8b0a4, alpha: 0.6 });
    g.rect(60, 588, 1300, 2).fill({ color: 0xb8b0a4, alpha: 0.6 });

    // ── Squad open-office zone (east side) ───────────────────────────────────
    g.roundRect(1360, 40, 2200, 980, 6).fill({ color: FLOOR_B });
    for (let tx = 1360; tx < 3560; tx += TILE) {
      for (let ty = 40; ty < 1020; ty += TILE) {
        const shade = ((Math.floor(tx / TILE) + Math.floor(ty / TILE)) % 2 === 0) ? FLOOR_B : FLOOR_A;
        g.rect(tx, ty, TILE - 1, TILE - 1).fill({ color: shade });
      }
    }
    g.setStrokeStyle({ color: 0xb8b0a4, width: 0.5, alpha: 0.35 });
    for (let tx = 1360; tx <= 3560; tx += TILE) g.moveTo(tx, 40).lineTo(tx, 1020);
    for (let ty = 40; ty <= 1020; ty += TILE) g.moveTo(1360, ty).lineTo(3560, ty);
    g.stroke();

    // ── Building exterior walls (thick border) ───────────────────────────────
    const bw = 10;
    g.rect(60, 40, 1300, bw).fill({ color: WALL });          // top
    g.rect(60, 1000 - bw, 1300, bw).fill({ color: WALL });   // bottom
    g.rect(60, 40, bw, 960).fill({ color: WALL });            // left
    g.rect(1350, 40, bw, 960).fill({ color: WALL });          // right (div between zones)
    // East wing outer walls
    g.rect(1360, 40, 2200, bw).fill({ color: WALL });
    g.rect(1360, 1010, 2200, bw).fill({ color: WALL });
    g.rect(3550, 40, bw, 980).fill({ color: WALL });

    // Window strips on outer walls (Gather style — blue-tinted panes)
    drawWindowStrip(g, 100, 40, 1220);   // top wall windows
    drawWindowStrip(g, 100, 992, 1220);  // bottom wall windows
    drawWindowStrip(g, 1400, 40, 2100);  // top east wing
    drawWindowStrip(g, 1400, 1002, 2100); // bottom east wing

    // ── Decorative trees on grass ────────────────────────────────────────────
    // Corridor trees (in building hallway area)
    drawTree(g, 390, 470);
    drawTree(g, 750, 470);
    drawTree(g, 1120, 470);
    // Outdoor grass trees
    drawTree(g, 80, 60);
    drawTree(g, 1290, 60);
    drawTree(g, 80, 910);
    drawTree(g, 1290, 910);
    // More outdoor trees scattered on east grass edges
    drawTree(g, 3480, 80);
    drawTree(g, 3480, 900);
    // Grass decorations — small bushes
    drawBush(g, 180, 30);
    drawBush(g, 500, 30);
    drawBush(g, 900, 30);
    drawBush(g, 1100, 1020);
    drawBush(g, 400, 1020);
  }

  function drawWindowStrip(g: PIXI.Graphics, startX: number, wallY: number, totalW: number) {
    const winW = 28, winH = 8, winGap = 16;
    const isTop = wallY < 100;
    const wy = isTop ? wallY + 1 : wallY + 1;
    for (let wx = startX; wx < startX + totalW - winW; wx += winW + winGap) {
      g.roundRect(wx, wy, winW, winH, 2).fill({ color: 0x93c5fd, alpha: 0.7 });
      g.roundRect(wx + 1, wy + 1, winW - 2, 3, 1).fill({ color: 0xffffff, alpha: 0.5 });
    }
  }

  function drawTree(g: PIXI.Graphics, x: number, y: number) {
    // Shadow
    g.ellipse(x + 18, y + 56, 20, 7).fill({ color: 0x000000, alpha: 0.2 });
    // Trunk
    g.roundRect(x + 12, y + 34, 12, 22, 3).fill({ color: 0x92400e });
    g.roundRect(x + 14, y + 35, 4, 18, 2).fill({ color: 0xb45309, alpha: 0.5 });
    // Foliage layers (dark → light → highlight)
    g.circle(x + 18, y + 26, 22).fill({ color: 0x15803d });
    g.circle(x + 10, y + 20, 16).fill({ color: 0x16a34a });
    g.circle(x + 26, y + 20, 14).fill({ color: 0x16a34a });
    g.circle(x + 18, y + 12, 18).fill({ color: 0x22c55e });
    g.circle(x + 18, y + 5, 12).fill({ color: 0x4ade80 });
    // Highlight
    g.circle(x + 14, y + 4, 5).fill({ color: 0x86efac, alpha: 0.5 });
  }

  function drawBush(g: PIXI.Graphics, x: number, y: number) {
    g.circle(x + 10, y + 10, 8).fill({ color: 0x15803d });
    g.circle(x + 18, y + 8, 7).fill({ color: 0x16a34a });
    g.circle(x + 14, y + 5, 6).fill({ color: 0x22c55e });
  }

  // ─── Draw open squad zone (no walls — just carpet + label + furniture) ────
  function drawSquadZone(container: PIXI.Container, zone: SquadZoneDef) {
    const g = new PIXI.Container();
    g.x = zone.x;
    g.y = zone.y;

    // Carpet fill — clean light tint of squad color, no pattern noise
    const carpetColor = mixColor(zone.color, 0xffffff, 0.82);
    const carpet = new PIXI.Graphics();
    carpet.roundRect(0, 0, zone.w, zone.h, 10).fill({ color: carpetColor });
    // Single clean border
    carpet.roundRect(0, 0, zone.w, zone.h, 10).stroke({ color: zone.color, width: 2.5, alpha: 0.35 });
    g.addChild(carpet);

    // Squad name label — pill badge at top-left
    const label = new PIXI.Text({
      text: `${zone.icon} ${zone.name}`,
      style: new PIXI.TextStyle({ fontSize: 11, fill: 0xffffff, fontFamily: "Inter, sans-serif", fontWeight: "700" }),
    });
    const labelBg = new PIXI.Graphics();
    const lw = label.width + 14;
    labelBg.roundRect(8, 6, lw, 20, 6).fill({ color: zone.color });
    g.addChild(labelBg);
    label.x = 14; label.y = 8;
    g.addChild(label);

    // Furniture
    const fG = new PIXI.Graphics();
    zone.furniture.forEach((f) => drawFurniture(fG, f));
    g.addChild(fG);

    container.addChild(g);
  }

  // ─── Draw a room ──────────────────────────────────────────────────────────
  function drawRoom(container: PIXI.Container, room: RoomDef) {
    const g = new PIXI.Container();
    g.x = room.x;
    g.y = room.y;

    const isSquad = room.id.startsWith("squad-");
    const floor = new PIXI.Graphics();
    const WT = 10; // wall thickness

    // ── Room floor fill ──────────────────────────────────────────────────────
    if (isSquad) {
      // Colored carpet for squad rooms
      const carpetColor = mixColor(room.color, 0xffffff, 0.82); // very light tint of squad color
      floor.roundRect(WT, WT, room.w - WT * 2, room.h - WT * 2, 3).fill({ color: carpetColor });
      // Carpet tile pattern
      const CTILE = 24;
      for (let tx = WT; tx < room.w - WT; tx += CTILE) {
        for (let ty = WT; ty < room.h - WT; ty += CTILE) {
          const even = ((Math.floor(tx / CTILE) + Math.floor(ty / CTILE)) % 2 === 0);
          if (even) {
            floor.rect(tx, ty, CTILE - 1, CTILE - 1).fill({ color: room.color, alpha: 0.06 });
          }
        }
      }
      // Carpet border
      floor.rect(WT, WT, room.w - WT * 2, 4).fill({ color: room.color, alpha: 0.3 });
      floor.rect(WT, room.h - WT - 4, room.w - WT * 2, 4).fill({ color: room.color, alpha: 0.3 });
      floor.rect(WT, WT, 4, room.h - WT * 2).fill({ color: room.color, alpha: 0.3 });
      floor.rect(room.w - WT - 4, WT, 4, room.h - WT * 2).fill({ color: room.color, alpha: 0.3 });
    } else {
      // Light wood floor for regular rooms
      floor.roundRect(WT, WT, room.w - WT * 2, room.h - WT * 2, 3).fill({ color: ROOM_FLOOR });
      // Plank lines — horizontal
      const PLANK = 20;
      for (let ty = WT; ty < room.h - WT; ty += PLANK) {
        floor.rect(WT, ty, room.w - WT * 2, 1).fill({ color: 0xc8d4e0, alpha: 0.5 });
      }
      // Vertical plank offsets alternating
      for (let ty = WT; ty < room.h - WT; ty += PLANK * 2) {
        floor.rect(WT + (room.w / 4), ty, 1, PLANK).fill({ color: 0xc8d4e0, alpha: 0.4 });
        floor.rect(WT + (room.w * 3 / 4), ty + PLANK, 1, PLANK).fill({ color: 0xc8d4e0, alpha: 0.4 });
      }
    }
    g.addChild(floor);

    // ── Walls ────────────────────────────────────────────────────────────────
    drawRoomWalls(g, room);

    // ── Room name label (small tag on wall) ──────────────────────────────────
    const label = new PIXI.Text({
      text: `${room.icon} ${room.name}`,
      style: new PIXI.TextStyle({
        fontSize: 10,
        fill: 0xffffff,
        fontFamily: "Inter, sans-serif",
        fontWeight: "700",
        dropShadow: { color: 0x000000, blur: 2, distance: 1, alpha: 0.5 },
      }),
    });
    const labelBg = new PIXI.Graphics();
    const lw = label.width + 12;
    labelBg.roundRect(WT + 2, WT + 2, lw, 18, 4).fill({ color: room.color });
    g.addChild(labelBg);
    label.x = WT + 6;
    label.y = WT + 3;
    g.addChild(label);

    // ── Furniture ────────────────────────────────────────────────────────────
    const fG = new PIXI.Graphics();
    room.furniture.forEach((f) => drawFurniture(fG, f));
    g.addChild(fG);

    container.addChild(g);
  }

  function drawRoomWalls(g: PIXI.Container, room: RoomDef) {
    const walls = new PIXI.Graphics();
    const WT = 10; // wall thickness
    const c = room.color;

    // ── Shadow under room ────────────────────────────────────────────────────
    const shadow = new PIXI.Graphics();
    shadow.roundRect(4, 4, room.w, room.h, 4).fill({ color: 0x000000, alpha: 0.18 });
    g.addChild(shadow);

    // ── Wall faces ───────────────────────────────────────────────────────────
    // Top wall (exterior face — darker, visible from corridor)
    walls.rect(0, 0, room.w, WT).fill({ color: WALL });
    // Bottom wall
    walls.rect(0, room.h - WT, room.w, WT).fill({ color: WALL });
    // Left wall
    walls.rect(0, WT, WT, room.h - WT * 2).fill({ color: WALL });
    // Right wall
    walls.rect(room.w - WT, WT, WT, room.h - WT * 2).fill({ color: WALL });

    // ── Wall top-face highlight (gives 3D depth — lighter strip on top) ──────
    walls.rect(0, 0, room.w, 3).fill({ color: 0x8a7a6a, alpha: 0.5 });
    walls.rect(0, 0, 3, room.h).fill({ color: 0x8a7a6a, alpha: 0.4 });

    // ── Window panes on outer wall (not door wall) ───────────────────────────
    const winW = 22, winH = 6;
    const outerWall = room.doorSide === "bottom" ? "top" : "bottom";
    const winY = outerWall === "top" ? 2 : room.h - WT + 2;
    const dxLocal = room.doorX - room.x - DOOR_W / 2;
    for (let wx = WT + 8; wx < room.w - WT - winW; wx += winW + 10) {
      // Skip the door opening area
      if (Math.abs(wx + winW / 2 - dxLocal - DOOR_W / 2) < DOOR_W + 10) continue;
      walls.roundRect(wx, winY, winW, winH, 2).fill({ color: 0x93c5fd, alpha: 0.8 });
      walls.roundRect(wx + 2, winY + 1, winW - 4, 2, 1).fill({ color: 0xffffff, alpha: 0.6 });
    }

    g.addChild(walls);

    // ── Color accent stripe ──────────────────────────────────────────────────
    const stripe = new PIXI.Graphics();
    stripe.rect(0, 0, room.w, 3).fill({ color: c });
    g.addChild(stripe);

    // ── Door gap ─────────────────────────────────────────────────────────────
    const door = new PIXI.Graphics();
    const floorColor = room.id.startsWith("squad-")
      ? mixColor(room.color, 0xffffff, 0.82)
      : ROOM_FLOOR;
    if (room.doorSide === "bottom") {
      door.rect(dxLocal, room.h - WT - 1, DOOR_W, WT + 2).fill({ color: FLOOR_B });
      // Door threshold
      door.rect(dxLocal, room.h - WT - 1, DOOR_W, 3).fill({ color: floorColor });
    } else {
      door.rect(dxLocal, -1, DOOR_W, WT + 2).fill({ color: FLOOR_B });
      door.rect(dxLocal, WT - 2, DOOR_W, 3).fill({ color: floorColor });
    }

    // Door frame jambs
    const df = new PIXI.Graphics();
    df.setStrokeStyle({ color: darken(WALL, 0.75), width: 2 });
    if (room.doorSide === "bottom") {
      df.moveTo(dxLocal, room.h - WT).lineTo(dxLocal, room.h + 2);
      df.moveTo(dxLocal + DOOR_W, room.h - WT).lineTo(dxLocal + DOOR_W, room.h + 2);
    } else {
      df.moveTo(dxLocal, WT).lineTo(dxLocal, -2);
      df.moveTo(dxLocal + DOOR_W, WT).lineTo(dxLocal + DOOR_W, -2);
    }
    df.stroke();

    g.addChild(door);
    g.addChild(df);
  }

  // Mix two hex colors: 0=all colorA, 1=all colorB
  function mixColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (Math.round(ar + (br - ar) * t) << 16)
         | (Math.round(ag + (bg - ag) * t) << 8)
         | Math.round(ab + (bb - ab) * t);
  }

  // ─── Furniture drawing ────────────────────────────────────────────────────
  function drawFurniture(g: PIXI.Graphics, f: FurnitureDef) {
    const { type, x, y, w, h, color } = f;
    switch (type) {

      // ── Seat divider — thin vertical line separating seats on a table ───────
      case "seat_divider": {
        // Subtle semi-transparent line — darker than table color
        g.rect(x, y, w, h).fill({ color: darken(color, 0.55), alpha: 0.35 });
        break;
      }

      // ── Workstation — monitor + keyboard + mouse (compact, on desk surface) ─
      // dir: 0=facing down (viewed from top, monitor at back/top edge)
      //      1=facing up (monitor at bottom edge)
      case "workstation": {
        const dir2 = f.dir ?? 0;
        // Monitor (small flat-screen) — positioned at the back edge of the slot
        const mW = Math.round(w * 0.62), mH = 7;
        const mX = x + (w - mW) / 2;
        const mY = dir2 === 0 ? y + 1 : y + h - mH - 1;
        // Monitor bezel
        g.roundRect(mX, mY, mW, mH, 2).fill({ color: 0x1e293b }).stroke({ color: 0x374151, width: 0.5 });
        // Screen (blue glow)
        g.roundRect(mX + 1, mY + 1, mW - 2, mH - 2, 1).fill({ color: 0x1e4d7b });
        // Screen content — tiny colored lines
        g.rect(mX + 2, mY + 2, mW * 0.5, 1).fill({ color: 0x60a5fa, alpha: 0.8 });
        g.rect(mX + 2, mY + 4, mW * 0.35, 1).fill({ color: 0xffffff, alpha: 0.3 });
        // Monitor stand base (1px stub)
        g.roundRect(mX + mW / 2 - 3, dir2 === 0 ? mY + mH : mY - 2, 6, 2, 1).fill({ color: 0x374151 });

        // Keyboard — flat strip in the middle zone
        const kW = Math.round(w * 0.72), kH = 5;
        const kX = x + (w - kW) / 2;
        const kY = dir2 === 0 ? y + mH + 4 : y + h - mH - kH - 7;
        g.roundRect(kX, kY, kW, kH, 1).fill({ color: 0x334155 });
        // Key rows — 2 thin lines
        g.rect(kX + 1, kY + 1, kW - 2, 1).fill({ color: 0x4b5563 });
        g.rect(kX + 1, kY + 3, kW - 2, 1).fill({ color: 0x4b5563 });

        // Mouse — small rounded rectangle to the right of keyboard
        const msX = kX + kW + 2;
        const msY = kY;
        g.roundRect(msX, msY, 5, 7, 2).fill({ color: 0x475569 });
        g.roundRect(msX + 1, msY + 1, 3, 3, 1).fill({ color: 0x64748b });

        break;
      }

      // ── Desk ──────────────────────────────────────────────────────────────
      case "desk": {
        // Drop shadow
        g.roundRect(x + 3, y + 3, w, h, 5).fill({ color: 0x000000, alpha: 0.35 });
        // Main surface — wood gradient simulation (3 stripes)
        g.roundRect(x, y, w, h, 5).fill({ color }).stroke({ color: darken(color, 0.5), width: 1.5 });
        g.roundRect(x + 2, y + 2, w - 4, h * 0.25, 3).fill({ color: lighten(color, 1.22), alpha: 0.18 });
        // Wood grain lines
        for (let i = 0; i < 5; i++) {
          const gy = y + 5 + i * (h - 10) / 5;
          g.moveTo(x + 4, gy).lineTo(x + w - 4, gy);
        }
        g.setStrokeStyle({ color: lighten(color, 1.3), width: 0.5, alpha: 0.12 });
        g.stroke();
        // Drawer handle
        g.roundRect(x + w * 0.35, y + h - 9, w * 0.3, 5, 2).fill({ color: darken(color, 0.55) });
        g.roundRect(x + w * 0.38, y + h - 8, w * 0.24, 3, 1).fill({ color: lighten(color, 1.5), alpha: 0.3 });
        // Keyboard tray
        g.roundRect(x + w * 0.12, y + h * 0.5, w * 0.6, h * 0.22, 2).fill({ color: 0x374151 });
        g.roundRect(x + w * 0.14, y + h * 0.52, w * 0.56, h * 0.16, 1).fill({ color: 0x4b5563 });
        break;
      }

      // ── Monitor ───────────────────────────────────────────────────────────
      case "monitor": {
        // Stand base
        g.roundRect(x + w / 2 - 9, y + h - 4, 18, 5, 2).fill({ color: 0x4b5563 });
        g.roundRect(x + w / 2 - 3, y + h - 8, 6, 5, 1).fill({ color: 0x6b7280 });
        // Bezel
        g.roundRect(x, y, w, h - 6, 4).fill({ color: 0x111827 }).stroke({ color: 0x374151, width: 1 });
        // Screen glow — blue/teal
        g.roundRect(x + 2, y + 2, w - 4, h - 10, 3).fill({ color: 0x0f2d4e });
        // Screen content lines (simulated UI)
        g.rect(x + 3, y + 4, w - 8, 2).fill({ color: 0x60a5fa, alpha: 0.6 });
        g.rect(x + 3, y + 8, w - 14, 1).fill({ color: 0xffffff, alpha: 0.2 });
        g.rect(x + 3, y + 11, w - 18, 1).fill({ color: 0xffffff, alpha: 0.15 });
        // Screen reflection
        g.roundRect(x + 3, y + 2, (w - 6) * 0.4, (h - 10) * 0.3, 2).fill({ color: 0xffffff, alpha: 0.05 });
        // Power LED
        g.circle(x + w - 5, y + h - 9, 2).fill({ color: 0x22c55e });
        break;
      }

      // ── Chair — top-down real chair (seat + backrest) ────────────────────
      case "chair": {
        // dir: 0=down (back at top), 1=up (back at bottom), 2=right (back at left), 3=left (back at right)
        const dir = f.dir ?? 0;
        const cx = x + w / 2;
        const cy = y + h / 2;

        // Drop shadow
        g.roundRect(x + 2, y + 3, w, h, 4).fill({ color: 0x000000, alpha: 0.22 });

        // Legs (4 small squares at corners, dark)
        const legS = 4, legC = darken(color, 0.45);
        g.roundRect(x + 2, y + 2, legS, legS, 1).fill({ color: legC });
        g.roundRect(x + w - 2 - legS, y + 2, legS, legS, 1).fill({ color: legC });
        g.roundRect(x + 2, y + h - 2 - legS, legS, legS, 1).fill({ color: legC });
        g.roundRect(x + w - 2 - legS, y + h - 2 - legS, legS, legS, 1).fill({ color: legC });

        // Seat cushion — takes up most of the chair area (slightly inset from edges)
        const seatPad = 4;
        g.roundRect(x + seatPad, y + seatPad, w - seatPad * 2, h - seatPad * 2, 4)
          .fill({ color })
          .stroke({ color: darken(color, 0.55), width: 1 });

        // Cushion highlight (top-left sheen)
        g.roundRect(x + seatPad + 2, y + seatPad + 2, (w - seatPad * 2) * 0.55, (h - seatPad * 2) * 0.38, 3)
          .fill({ color: lighten(color, 1.4), alpha: 0.32 });

        // Backrest — thick bar on one side based on direction
        const bT = 6; // backrest thickness
        const bC = darken(color, 0.6);
        const bHL = lighten(color, 1.2); // backrest highlight
        if (dir === 0) {
          // Chair faces DOWN → backrest at TOP
          g.roundRect(x + 2, y, w - 4, bT + 2, 3).fill({ color: bC });
          g.roundRect(x + 4, y + 1, w - 8, 2, 1).fill({ color: bHL, alpha: 0.3 });
        } else if (dir === 1) {
          // Chair faces UP → backrest at BOTTOM
          g.roundRect(x + 2, y + h - bT - 2, w - 4, bT + 2, 3).fill({ color: bC });
          g.roundRect(x + 4, y + h - bT - 1, w - 8, 2, 1).fill({ color: bHL, alpha: 0.3 });
        } else if (dir === 2) {
          // Chair faces RIGHT → backrest at LEFT
          g.roundRect(x, y + 2, bT + 2, h - 4, 3).fill({ color: bC });
          g.roundRect(x + 1, y + 4, 2, h - 8, 1).fill({ color: bHL, alpha: 0.3 });
        } else {
          // Chair faces LEFT → backrest at RIGHT
          g.roundRect(x + w - bT - 2, y + 2, bT + 2, h - 4, 3).fill({ color: bC });
          g.roundRect(x + w - bT - 1, y + 4, 2, h - 8, 1).fill({ color: bHL, alpha: 0.3 });
        }

        break;
      }

      // ── Conference/squad table ────────────────────────────────────────────
      case "table": {
        // Drop shadow
        g.roundRect(x + 4, y + 4, w, h, 8).fill({ color: 0x000000, alpha: 0.4 });
        // Table body
        g.roundRect(x, y, w, h, 8).fill({ color }).stroke({ color: darken(color, 0.5), width: 2 });
        // Top light reflection band
        g.roundRect(x + 4, y + 4, w - 8, h * 0.18, 5).fill({ color: lighten(color, 1.5), alpha: 0.2 });
        // Wood grain lines (horizontal)
        for (let i = 0; i < 6; i++) {
          const gy = y + 10 + i * (h - 20) / 6;
          g.moveTo(x + 8, gy).lineTo(x + w - 8, gy);
        }
        g.setStrokeStyle({ color: lighten(color, 1.4), width: 0.6, alpha: 0.1 });
        g.stroke();
        // Edge bevel (bottom edge shadow gives 3D depth)
        g.roundRect(x + 2, y + h - 8, w - 4, 6, 4).fill({ color: darken(color, 0.55), alpha: 0.5 });
        // Center detail (logo area or slight texture)
        g.roundRect(x + w * 0.3, y + h * 0.35, w * 0.4, h * 0.3, 4).fill({ color: darken(color, 0.75), alpha: 0.2 });
        // Corner feet/legs visible
        const legSize = 5;
        const legColor = darken(color, 0.5);
        g.roundRect(x + 3, y + 3, legSize, legSize, 1).fill({ color: legColor });
        g.roundRect(x + w - 8, y + 3, legSize, legSize, 1).fill({ color: legColor });
        g.roundRect(x + 3, y + h - 8, legSize, legSize, 1).fill({ color: legColor });
        g.roundRect(x + w - 8, y + h - 8, legSize, legSize, 1).fill({ color: legColor });
        break;
      }

      // ── Sofa ──────────────────────────────────────────────────────────────
      case "sofa": {
        // Shadow
        g.roundRect(x + 3, y + 3, w, h, 6).fill({ color: 0x000000, alpha: 0.3 });
        // Seat base
        g.roundRect(x, y + h * 0.38, w, h * 0.62, 6).fill({ color }).stroke({ color: darken(color, 0.5), width: 1 });
        // Seat cushions (divided)
        const cw3 = (w - 8) / 3;
        for (let i = 0; i < 3; i++) {
          g.roundRect(x + 4 + i * (cw3 + 2), y + h * 0.42, cw3, h * 0.5, 4).fill({ color: lighten(color, 1.1) });
          g.roundRect(x + 6 + i * (cw3 + 2), y + h * 0.44, cw3 - 4, h * 0.15, 3).fill({ color: lighten(color, 1.3), alpha: 0.3 });
        }
        // Backrest
        g.roundRect(x, y, w, h * 0.48, 6).fill({ color: darken(color, 0.75) }).stroke({ color: darken(color, 0.5), width: 1 });
        g.roundRect(x + 3, y + 2, w - 6, h * 0.18, 4).fill({ color: lighten(color, 1.2), alpha: 0.18 });
        // Armrests
        g.roundRect(x - 4, y, 9, h, 5).fill({ color: darken(color, 0.68) });
        g.roundRect(x + w - 5, y, 9, h, 5).fill({ color: darken(color, 0.68) });
        // Armrest tops
        g.roundRect(x - 3, y + 1, 7, h * 0.35, 3).fill({ color: lighten(color, 1.15), alpha: 0.2 });
        g.roundRect(x + w - 4, y + 1, 7, h * 0.35, 3).fill({ color: lighten(color, 1.15), alpha: 0.2 });
        break;
      }

      // ── Coffee table ──────────────────────────────────────────────────────
      case "coffee_table": {
        g.roundRect(x + 3, y + 2, w, h, 8).fill({ color: 0x000000, alpha: 0.28 });
        g.roundRect(x, y, w, h, 8).fill({ color }).stroke({ color: darken(color, 0.5), width: 1.5 });
        g.roundRect(x + 4, y + 3, w - 8, h - 6, 5).fill({ color: lighten(color, 1.2), alpha: 0.08 });
        // Coffee mug on table
        g.circle(x + w * 0.65, y + h * 0.45, 4).fill({ color: 0xe11d2a, alpha: 0.75 });
        g.circle(x + w * 0.65, y + h * 0.45, 2.5).fill({ color: 0x7f1d1d, alpha: 0.8 });
        break;
      }

      // ── TV ────────────────────────────────────────────────────────────────
      case "tv": {
        // Mount bracket
        if (w < h) {
          // Vertical TV (wall-mounted)
          g.roundRect(x + w * 0.35, y + 3, w * 0.3, h - 6, 2).fill({ color: 0x374151 });
          g.roundRect(x, y, w, h, 4).fill({ color: 0x0d1117 }).stroke({ color: 0x374151, width: 1.5 });
          g.roundRect(x + 2, y + 2, w - 4, h - 4, 3).fill({ color: 0x071428 });
          // Screen content (presentation)
          g.roundRect(x + 3, y + 8, w - 6, h * 0.12, 2).fill({ color: 0xe11d2a, alpha: 0.6 });
          for (let i = 0; i < 4; i++) {
            g.rect(x + 4, y + 14 + i * 8, w - 8, 2).fill({ color: 0xffffff, alpha: 0.12 });
          }
          g.circle(x + w / 2, y + h - 8, 3).fill({ color: 0x22c55e });
        } else {
          // Horizontal TV
          g.roundRect(x, y, w, h, 4).fill({ color: 0x0d1117 }).stroke({ color: 0x374151, width: 1.5 });
          g.roundRect(x + 2, y + 2, w - 4, h - 4, 3).fill({ color: 0x071428 });
          g.rect(x + 4, y + 4, w - 10, 2).fill({ color: 0xe11d2a, alpha: 0.5 });
          g.circle(x + w - 5, y + h - 5, 2).fill({ color: 0x22c55e });
        }
        // Screen reflection
        g.roundRect(x + 2, y + 2, (w - 4) * 0.35, (h - 4) * 0.28, 2).fill({ color: 0xffffff, alpha: 0.04 });
        break;
      }

      // ── Whiteboard ────────────────────────────────────────────────────────
      case "whiteboard": {
        // Frame
        g.roundRect(x, y, w, h, 3).fill({ color: 0xe5e7eb }).stroke({ color: 0x9ca3af, width: 1.5 });
        // Board surface
        g.rect(x + 3, y + 3, w - 6, h - 8).fill({ color: 0xffffff });
        // Writing lines
        g.rect(x + 5, y + 7,  w - 12, 1.5).fill({ color: 0x3b82f6, alpha: 0.55 });
        g.rect(x + 5, y + 11, w - 18, 1.5).fill({ color: 0x3b82f6, alpha: 0.35 });
        g.rect(x + 5, y + 15, w - 22, 1.5).fill({ color: 0xec4899, alpha: 0.4 });
        // Tray at bottom
        g.rect(x + 2, y + h - 5, w - 4, 4).fill({ color: 0xd1d5db });
        g.roundRect(x + 5, y + h - 4, 6, 2, 1).fill({ color: 0x3b82f6 });
        g.roundRect(x + 13, y + h - 4, 6, 2, 1).fill({ color: 0xe11d2a });
        break;
      }

      // ── Plant ─────────────────────────────────────────────────────────────
      case "plant": {
        // Shadow
        g.ellipse(x + w / 2 + 2, y + h + 2, w * 0.42, 6).fill({ color: 0x000000, alpha: 0.25 });
        // Pot
        g.roundRect(x + w * 0.28, y + h * 0.64, w * 0.44, h * 0.36, 3).fill({ color: 0x78350f });
        g.roundRect(x + w * 0.24, y + h * 0.62, w * 0.52, 5, 2).fill({ color: 0x92400e });
        g.roundRect(x + w * 0.3, y + h * 0.65, w * 0.4, 4, 1).fill({ color: lighten(0x78350f, 1.3), alpha: 0.25 });
        // Leaves — layered circles
        g.circle(x + w / 2, y + h * 0.46, w * 0.42).fill({ color: darken(color, 0.75) });
        g.circle(x + w * 0.32, y + h * 0.38, w * 0.28).fill({ color });
        g.circle(x + w * 0.68, y + h * 0.38, w * 0.28).fill({ color });
        g.circle(x + w / 2, y + h * 0.28, w * 0.34).fill({ color });
        g.circle(x + w / 2, y + h * 0.2, w * 0.24).fill({ color: lighten(color, 1.25) });
        // Highlight on top leaf
        g.circle(x + w / 2 - 2, y + h * 0.17, w * 0.1).fill({ color: lighten(color, 1.5), alpha: 0.4 });
        break;
      }

      // ── Bookshelf ─────────────────────────────────────────────────────────
      case "bookshelf": {
        g.roundRect(x + 2, y + 2, w, h, 3).fill({ color: 0x000000, alpha: 0.25 });
        g.roundRect(x, y, w, h, 3).fill({ color: 0x92400e }).stroke({ color: 0x78350f, width: 1.5 });
        // Shelf dividers
        g.rect(x + 2, y + h * 0.5, w - 4, 2).fill({ color: 0x78350f });
        // Books top row
        const topBooks = [0xe11d2a, 0x22c55e, 0xf59e0b, 0x8b5cf6, 0xec4899];
        const bwT = (w - 6) / topBooks.length;
        topBooks.forEach((bc, i) => {
          g.roundRect(x + 3 + i * bwT, y + 3, bwT - 1, h * 0.44, 1).fill({ color: bc });
          g.roundRect(x + 3 + i * bwT, y + 3, bwT - 1, 3, 1).fill({ color: lighten(bc, 1.3), alpha: 0.35 });
        });
        // Books bottom row
        const botBooks = [0xf97316, 0xa855f7, 0xef4444, 0x10b981, 0xeab308];
        const bwB = (w - 6) / botBooks.length;
        botBooks.forEach((bc, i) => {
          g.roundRect(x + 3 + i * bwB, y + h * 0.54, bwB - 1, h * 0.43, 1).fill({ color: bc });
          g.roundRect(x + 3 + i * bwB, y + h * 0.54, bwB - 1, 3, 1).fill({ color: lighten(bc, 1.3), alpha: 0.35 });
        });
        break;
      }

      // ── Coffee machine ────────────────────────────────────────────────────
      case "coffee_machine": {
        g.roundRect(x + 2, y + 2, w, h, 5).fill({ color: 0x000000, alpha: 0.3 });
        g.roundRect(x, y, w, h, 5).fill({ color }).stroke({ color: darken(color, 0.5), width: 1 });
        // Water tank (top)
        g.roundRect(x + 4, y + 3, w - 8, h * 0.35, 4).fill({ color: 0x1f2937 });
        g.roundRect(x + 5, y + 4, w - 10, 5, 3).fill({ color: lighten(0x1f2937, 1.3), alpha: 0.2 });
        // Cup platform
        g.roundRect(x + 6, y + h * 0.55, w - 12, h * 0.28, 3).fill({ color: 0x111827 });
        // Cup on platform
        g.roundRect(x + w / 2 - 6, y + h * 0.56, 12, h * 0.25, 2).fill({ color: 0xffffff, alpha: 0.12 });
        // Status light
        g.circle(x + w - 7, y + 6, 3).fill({ color: 0x22c55e });
        g.circle(x + w - 7, y + 6, 1.5).fill({ color: 0x86efac });
        break;
      }
    }
  }

  function darken(color: number, factor = 0.68): number {
    const f = Math.min(1, Math.max(0, factor));
    return (Math.floor(((color >> 16) & 0xff) * f) << 16)
         | (Math.floor(((color >> 8) & 0xff) * f) << 8)
         | Math.floor((color & 0xff) * f);
  }

  function lighten(color: number, factor = 1.35): number {
    const f = Math.max(1, factor);
    return (Math.min(255, Math.floor(((color >> 16) & 0xff) * f)) << 16)
         | (Math.min(255, Math.floor(((color >> 8) & 0xff) * f)) << 8)
         | Math.min(255, Math.floor((color & 0xff) * f));
  }

  // ─── Minimap ──────────────────────────────────────────────────────────────
  function buildMinimap(app: PIXI.Application): PIXI.Container {
    const mm = new PIXI.Container();
    mm.x = app.screen.width - 175;
    mm.y = app.screen.height - 148;

    const bg = new PIXI.Graphics();
    bg.roundRect(0, 0, 165, 132, 8)
      .fill({ color: 0xffffff, alpha: 0.88 })
      .stroke({ color: 0xd1cec8, width: 1 });
    mm.addChild(bg);

    // Minimap grass background
    const mmGrass = new PIXI.Graphics();
    mmGrass.roundRect(2, 16, 161, 114, 6).fill({ color: GRASS, alpha: 0.5 });
    mm.addChild(mmGrass);

    const ttl = new PIXI.Text({ text: "MAPA", style: new PIXI.TextStyle({ fontSize: 8, fill: 0x6b7280, fontFamily: "Inter, sans-serif", fontWeight: "700", letterSpacing: 1.5 }) });
    ttl.x = 7; ttl.y = 5;
    mm.addChild(ttl);

    const scale = 165 / WORLD_W;
    const roomsMini = new PIXI.Graphics();
    ROOMS.forEach((r) => {
      roomsMini.roundRect(r.x * scale, r.y * scale + 16, r.w * scale, r.h * scale, 1.5)
        .fill({ color: r.color, alpha: 0.55 })
        .stroke({ color: darken(r.color, 0.7), width: 1, alpha: 0.9 });
    });
    OPEN_SQUADS.forEach((z) => {
      roomsMini.roundRect(z.x * scale, z.y * scale + 16, z.w * scale, z.h * scale, 1)
        .fill({ color: z.color, alpha: 0.3 })
        .stroke({ color: z.color, width: 0.5, alpha: 0.6 });
    });
    mm.addChild(roomsMini);

    // My dot
    const meDot = new PIXI.Graphics();
    meDot.name = "meDot";
    meDot.circle(0, 16, 4.5).fill({ color: 0xe11d2a });
    meDot.circle(0, 16, 2).fill({ color: 0xffffff });
    meDot.x = SPAWN_X * scale;
    meDot.y = SPAWN_Y * scale;
    mm.addChild(meDot);

    return mm;
  }

  // ─── Avatar builders — top-down character sprite ─────────────────────────
  //
  // Each avatar is a mini top-down figure (Stardew/RPG style):
  //   shadow → legs → body/shirt → arms → neck → head → hair → eyes/mouth
  //   + status dot (bottom-right)
  //   + name pill below
  //
  // Skin tones cycle deterministically from the name hash so every person
  // looks slightly different. Shirt colors come from squad/status color or
  // a palette derived from the name.

  function buildCharacterSprite(
    name: string,
    statusHex: number,
    isMe: boolean,
    config?: AvatarConfig,
    seated?: boolean,
  ): PIXI.Graphics {
    const g = new PIXI.Graphics();

    // ── Palette — use config if provided, else deterministic from name hash ──
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = ((h << 5) + h) ^ name.charCodeAt(i);
    h = Math.abs(h);

    const skin  = AVATAR_SKIN_TONES[config?.skinIdx  ?? (h % AVATAR_SKIN_TONES.length)];
    const hair  = AVATAR_HAIR_COLORS[config?.hairIdx  ?? ((h >> 3) % AVATAR_HAIR_COLORS.length)];
    const shirt = isMe
      ? AVATAR_SHIRT_COLORS[config?.shirtIdx ?? 0]
      : AVATAR_SHIRT_COLORS[config?.shirtIdx ?? ((h >> 6) % AVATAR_SHIRT_COLORS.length)];
    const pants = darken(shirt, 0.5);

    // ── Body proportions (top-down, slight 3/4 perspective) ─────────
    // Origin = center of feet.  Head is "up" on screen (negative Y).
    // Standing total height ≈ 34px. Seated: no legs, body shifted up.

    if (!seated) {
      // Ground shadow
      g.ellipse(0, 2, 10, 4).fill({ color: 0x000000, alpha: 0.18 });

      // Legs
      g.roundRect(-5, -4, 4, 10, 2).fill({ color: pants });
      g.roundRect(1,  -4, 4, 10, 2).fill({ color: pants });
      // Shoes
      g.roundRect(-6, 4, 5, 4, 2).fill({ color: darken(pants, 0.55) });
      g.roundRect(1,  4, 5, 4, 2).fill({ color: darken(pants, 0.55) });
    } else {
      // Seated shadow — smaller, centered
      g.ellipse(0, 0, 7, 3).fill({ color: 0x000000, alpha: 0.15 });
    }

    // Body / shirt — seated version is shifted up (no legs below)
    const bodyY = seated ? -20 : -16;
    g.roundRect(-7, bodyY, 14, 14, 3).fill({ color: shirt });
    // Shirt highlight (shoulder area)
    g.roundRect(-6, bodyY, 12, 4, 2).fill({ color: lighten(shirt, 1.3), alpha: 0.35 });
    // Collar / neck
    g.roundRect(-2, bodyY - 2, 4, 4, 2).fill({ color: skin });

    // Arms — seated: arms rest forward (horizontal, over table)
    if (seated) {
      g.roundRect(-10, bodyY + 6, 20, 4, 2).fill({ color: shirt });
      g.circle(-11, bodyY + 8, 3).fill({ color: skin });
      g.circle(11,  bodyY + 8, 3).fill({ color: skin });
    } else {
      g.roundRect(-11, -15, 5, 8, 2).fill({ color: shirt });
      g.roundRect(6,   -15, 5, 8, 2).fill({ color: shirt });
      g.circle(-9, -6, 3).fill({ color: skin });
      g.circle(9,  -6, 3).fill({ color: skin });
    }

    // Head position relative to body
    const headY = bodyY - 8;

    // Head (slightly oval — top-down perspective gives it width)
    g.ellipse(0, headY, 9, 10).fill({ color: skin });
    g.setStrokeStyle({ color: darken(skin, 0.7), width: 0.8 });
    g.ellipse(0, headY, 9, 10).stroke();

    // Hair
    g.ellipse(0, headY - 4, 9, 7).fill({ color: hair });
    g.roundRect(-9, headY - 6, 3, 10, 2).fill({ color: hair });
    g.roundRect(6,  headY - 6, 3, 10, 2).fill({ color: hair });

    // Eyes
    g.circle(-3, headY, 1.8).fill({ color: 0x1a1a1a });
    g.circle(3,  headY, 1.8).fill({ color: 0x1a1a1a });
    g.circle(-2.4, headY - 0.6, 0.7).fill({ color: 0xffffff, alpha: 0.7 });
    g.circle(3.6,  headY - 0.6, 0.7).fill({ color: 0xffffff, alpha: 0.7 });

    // Mouth
    g.setStrokeStyle({ color: darken(skin, 0.65), width: 1.2 });
    g.arc(0, headY + 3, 2.5, 0.2, Math.PI - 0.2);
    g.stroke();

    // Crown above head for my avatar
    if (isMe) {
      const crownY = headY - 12;
      g.setStrokeStyle({ width: 0 });
      for (let i = -1; i <= 1; i++) {
        g.poly([i * 4, crownY - 4, i * 4 - 2.5, crownY, i * 4 + 2.5, crownY]).fill({ color: 0xffd700 });
      }
      g.roundRect(-6, crownY, 12, 4, 1).fill({ color: 0xffd700 });
    }

    // Status dot
    const dotY = seated ? bodyY + 10 : -2;
    g.circle(8, dotY, 5).fill({ color: 0xffffff });
    g.circle(8, dotY, 3.5).fill({ color: statusHex });
    // Store dot ref name on the graphic so updateRing can find it
    g.name = "charSprite";

    return g;
  }

  function buildMyAvatar(u: typeof user, config?: AvatarConfig, seated?: boolean): PIXI.Container {
    const group = new PIXI.Container();
    const statusHex = parseInt(getStatusColor(u?.status ?? "available").replace("#", ""), 16);
    const sprite = buildCharacterSprite(u?.name ?? "Eu", statusHex, true, config, seated);
    sprite.name = "sprite";
    group.addChild(sprite);
    addNamePill(group, u?.name ?? "Eu", true);
    return group;
  }

  function buildOtherAvatar(p: UserPresence): PIXI.Container {
    const group = new PIXI.Container();
    group.x = p.x;
    group.y = p.y;

    const statusHex = parseInt(getStatusColor(p.status).replace("#", ""), 16);
    const sprite = buildCharacterSprite(p.user?.name ?? "?", statusHex, false);
    sprite.name = "sprite";
    group.addChild(sprite);
    addNamePill(group, p.user?.name ?? "...", false);

    group.eventMode = "static";
    group.cursor = "pointer";
    group.on("pointertap", (e: PIXI.FederatedPointerEvent) => {
      e.stopPropagation();
      setSelectedUser(p.user_id);
      setSelectedUserIdLocal(p.user_id);
      setPopoverPos({ x: e.globalX, y: e.globalY });
    });

    return group;
  }

  function addNamePill(group: PIXI.Container, name: string, isMe: boolean) {
    const first = name.split(" ")[0];
    const nameTxt = new PIXI.Text({
      text: first,
      style: new PIXI.TextStyle({
        fontSize: 10,
        fill: isMe ? 0xffffff : 0x1e293b,
        fontFamily: "Inter, sans-serif",
        fontWeight: "700",
      }),
    });
    nameTxt.anchor.set(0.5, 0);
    const pillW = Math.max(nameTxt.width + 14, 36);
    const pill = new PIXI.Graphics();
    pill.roundRect(-pillW / 2, 8, pillW, 15, 5)
      .fill({ color: isMe ? 0xe11d2a : 0xffffff, alpha: isMe ? 0.92 : 0.88 });
    if (!isMe) {
      pill.roundRect(-pillW / 2, 8, pillW, 15, 5)
        .stroke({ color: 0x000000, width: 0.5, alpha: 0.12 });
    }
    group.addChild(pill);
    nameTxt.x = 0;
    nameTxt.y = 10;
    group.addChild(nameTxt);
  }

  function updateRing(group: PIXI.Container, status: string) {
    // For character sprites, we just redraw the status dot on the sprite
    const sprite = group.getChildByName("sprite") as PIXI.Graphics | null;
    if (!sprite) return;
    const c = parseInt(getStatusColor(status).replace("#", ""), 16);
    // Clear and redraw only the status dot circles (last 2 draw calls)
    // Easiest: tint the sprite slightly — but instead, rebuild sprite in place
    const parent = sprite.parent;
    if (!parent) return;
    const idx = parent.getChildIndex(sprite);
    const name2 = group.children
      .find((ch) => ch instanceof PIXI.Text) as PIXI.Text | undefined;
    const charName = name2?.text ?? "?";
    const newSprite = buildCharacterSprite(charName, c, false);
    newSprite.name = "sprite";
    parent.removeChildAt(idx);
    parent.addChildAt(newSprite, idx);
  }

  function smoothMove(sprite: PIXI.Container, tx: number, ty: number) {
    const dx = tx - sprite.x, dy = ty - sprite.y;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    let t = 0;
    const ticker = new PIXI.Ticker();
    ticker.add(() => {
      t = Math.min(t + 0.1, 1);
      sprite.x += dx * 0.1;
      sprite.y += dy * 0.1;
      if (t >= 1) ticker.destroy();
    });
    ticker.start();
  }

  async function loadTexture(url: string): Promise<PIXI.Texture | null> {
    if (texturesRef.current.has(url)) return texturesRef.current.get(url)!;
    try {
      const tex = await PIXI.Assets.load(url);
      texturesRef.current.set(url, tex);
      return tex;
    } catch { return null; }
  }

  function getInitials(name: string) {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  }

  // ─── Avatar config save ───────────────────────────────────────────────────
  const saveAvatarConfig = useCallback(async (cfg: AvatarConfig) => {
    if (!user) return;
    setSavingAvatar(true);
    try {
      await supabase
        .from("user_profiles")
        .upsert({ user_id: user.id, avatar_config: cfg }, { onConflict: "user_id" });
      avatarConfigRef.current = cfg;
      setAvatarConfig(cfg);
      rebuildMyAvatar(cfg, seatedAtRef.current !== null);
    } catch (e) {
      console.warn("Failed to save avatar config:", e);
    } finally {
      setSavingAvatar(false);
    }
  }, [user]);

  // ─── Zoom helpers ─────────────────────────────────────────────────────────
  function applyZoom(delta: number) {
    const newZoom = Math.max(0.35, Math.min(1.6, zoomRef.current + delta));
    zoomRef.current = newZoom;
    if (appRef.current) appRef.current.stage.scale.set(newZoom);
    setZoomDisplay(newZoom);
  }

  const selectedPresence = presences.find((p) => p.user_id === selectedUserId);
  const ALL_ZONES = [...ROOMS, ...OPEN_SQUADS];
  const activeRoomDef = ALL_ZONES.find((r) => r.id === activeRoom);
  const roomPopupDef = roomPopup ? ALL_ZONES.find((r) => r.id === roomPopup.roomId) : null;
  const roomOccupants = roomPopup
    ? presences.filter((p) => p.room_id === roomPopup.roomId && p.user_id !== user?.id)
    : [];

  return (
    <div className="relative w-full h-full" tabIndex={0}
      onFocus={(e) => e.currentTarget.querySelector("canvas")?.focus()}
    >
      {/* Canvas */}
      <div
        ref={canvasRef}
        className="w-full h-full rounded-xl overflow-hidden"
        style={{ minHeight: 500, cursor: "grab" }}
        onClick={() => canvasRef.current?.focus()}
      />

      {/* Zoom controls — bottom right */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 glass rounded-xl px-2 py-1.5 select-none z-20">
        <button
          onClick={() => applyZoom(-0.1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors text-base"
          title="Diminuir zoom"
        >−</button>
        <span
          className="text-[10px] font-mono w-9 text-center text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
          onClick={() => applyZoom(0.7 - zoomRef.current)}
          title="Reset zoom"
        >
          {Math.round(zoomDisplay * 100)}%
        </span>
        <button
          onClick={() => applyZoom(0.1)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors text-base"
          title="Aumentar zoom"
        >+</button>
      </div>

      {/* Controls hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 glass rounded-full px-4 py-1.5 text-xs text-muted-foreground pointer-events-none select-none">
        {seatedAt
          ? <><span className="font-mono bg-secondary/60 px-1.5 rounded mr-1">WASD</span>levantar · <span className="font-mono bg-secondary/60 px-1.5 rounded mr-1">2× clique</span>levantar</>
          : <><span className="font-mono bg-secondary/60 px-1.5 rounded mr-1">W A S D</span>mover · arrastar mapa · scroll zoom · <span className="font-mono bg-secondary/60 px-1.5 rounded mr-1">2× clique</span>sentar</>
        }
      </div>

      {/* ── Avatar customization button ──────────────────────────────────── */}
      <button
        onClick={() => setShowAvatarPanel((v) => !v)}
        className="absolute top-3 left-3 z-20 flex items-center gap-1.5 glass rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-secondary/80 transition-colors"
        title="Personalizar avatar"
      >
        🎨 Meu avatar
      </button>

      {/* ── Sit/stand indicator ──────────────────────────────────────────── */}
      {seatedAt && (
        <button
          onClick={standUp}
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 glass rounded-xl px-3 py-1.5 text-xs font-semibold text-primary hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
        >
          🪑 Sentado · clique para levantar
        </button>
      )}

      {/* ── Avatar customization panel ───────────────────────────────────── */}
      {showAvatarPanel && (
        <div className="absolute top-12 left-3 z-30 glass-strong rounded-2xl p-4 shadow-2xl w-64">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">Personalizar avatar</span>
            <button onClick={() => setShowAvatarPanel(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
          </div>

          {/* Skin tone */}
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Tom de pele</p>
            <div className="flex gap-1.5">
              {AVATAR_SKIN_TONES.map((c, i) => (
                <button
                  key={i}
                  onClick={() => saveAvatarConfig({ ...avatarConfig, skinIdx: i })}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: `#${c.toString(16).padStart(6, "0")}`,
                    borderColor: avatarConfig.skinIdx === i ? "#e11d2a" : "transparent",
                    transform: avatarConfig.skinIdx === i ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Hair color */}
          <div className="mb-3">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Cabelo</p>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_HAIR_COLORS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => saveAvatarConfig({ ...avatarConfig, hairIdx: i })}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: `#${c.toString(16).padStart(6, "0")}`,
                    borderColor: avatarConfig.hairIdx === i ? "#e11d2a" : "transparent",
                    transform: avatarConfig.hairIdx === i ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Shirt color */}
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">Camiseta</p>
            <div className="flex flex-wrap gap-1.5">
              {AVATAR_SHIRT_COLORS.map((c, i) => (
                <button
                  key={i}
                  onClick={() => saveAvatarConfig({ ...avatarConfig, shirtIdx: i })}
                  className="w-8 h-8 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: `#${c.toString(16).padStart(6, "0")}`,
                    borderColor: avatarConfig.shirtIdx === i ? "#e11d2a" : "transparent",
                    transform: avatarConfig.shirtIdx === i ? "scale(1.15)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>

          {savingAvatar && (
            <p className="text-xs text-muted-foreground text-center">Salvando...</p>
          )}
        </div>
      )}

      {/* ── Room entry popup ─────────────────────────────────────────────── */}
      {roomPopup && roomPopupDef && (
        <div
          className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
        >
          <div
            className="pointer-events-auto glass-strong rounded-2xl p-6 w-80 shadow-2xl"
            style={{ border: `1px solid ${colorToHex(roomPopupDef.color)}44` }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: `${colorToHex(roomPopupDef.color)}22` }}
              >
                {roomPopupDef.icon}
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: colorToHex(roomPopupDef.color) }}>
                  {roomPopupDef.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {roomOccupants.length === 0
                    ? "Sala vazia — você está sozinho"
                    : `${roomOccupants.length} pessoa${roomOccupants.length > 1 ? "s" : ""} aqui`}
                </p>
              </div>
              <button
                onClick={() => setRoomPopup(null)}
                className="ml-auto text-muted-foreground hover:text-foreground text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Occupants */}
            {roomOccupants.length > 0 && (
              <div className="mb-4 space-y-2">
                {roomOccupants.slice(0, 4).map((p) => (
                  <div key={p.user_id} className="flex items-center gap-2.5">
                    <div className="relative flex-shrink-0">
                      <img
                        src={p.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user?.name ?? "?")}&size=32&background=1e2d4a&color=fff`}
                        className="w-8 h-8 rounded-full object-cover"
                        alt={p.user?.name}
                      />
                      <span
                        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-1 ring-background"
                        style={{ backgroundColor: getStatusColor(p.status) }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{p.user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.user?.role}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { window.open(`https://mail.google.com/chat/u/0/#chat/dm/${p.user?.email}`, "_blank"); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-secondary hover:bg-secondary/70 text-xs transition-colors"
                        title="Chat"
                      >💬</button>
                      <button
                        onClick={() => { window.open(`https://meet.google.com/new`, "_blank"); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10 hover:bg-primary/20 text-xs transition-colors"
                        title="Meet"
                      >📹</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Main actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { window.open("https://chat.google.com", "_blank"); setRoomPopup(null); }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: `${colorToHex(roomPopupDef.color)}18`, color: colorToHex(roomPopupDef.color), border: `1px solid ${colorToHex(roomPopupDef.color)}33` }}
              >
                💬 Chat da Sala
              </button>
              <button
                onClick={() => {
                  const meetId = Math.random().toString(36).substring(2, 12);
                  window.open(`https://meet.google.com/${meetId}`, "_blank");
                  setRoomPopup(null);
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500/15 text-green-400 text-sm font-medium border border-green-500/25 transition-colors hover:bg-green-500/25"
              >
                📹 Iniciar Meet
              </button>
            </div>

            <button
              onClick={() => setRoomPopup(null)}
              className="w-full mt-2 py-1.5 rounded-xl hover:bg-secondary/40 text-xs text-muted-foreground transition-colors"
            >
              Continuar explorando
            </button>
          </div>
        </div>
      )}

      {/* ── Active room top banner (when popup dismissed) ─────────────────── */}
      {activeRoomDef && !roomPopup && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 rounded-xl px-4 py-2 flex items-center gap-2 text-sm font-semibold shadow-lg cursor-pointer"
          style={{ background: `${colorToHex(activeRoomDef.color)}22`, border: `1px solid ${colorToHex(activeRoomDef.color)}55`, color: colorToHex(activeRoomDef.color) }}
          onClick={() => setRoomPopup({ roomId: activeRoom! })}
        >
          <span>{activeRoomDef.icon}</span>
          <span>{activeRoomDef.name}</span>
          {roomOccupants.length > 0 && (
            <span className="ml-1 text-xs opacity-70">· {roomOccupants.length + 1} pessoas</span>
          )}
          <span className="ml-1 text-xs opacity-50">↗</span>
        </div>
      )}

      {/* ── Avatar click popover ──────────────────────────────────────────── */}
      {popoverPos && selectedPresence && selectedPresence.user_id !== user?.id && (
        <div
          className="absolute z-50 glass-strong rounded-xl p-3 shadow-xl"
          style={{ left: Math.min(popoverPos.x, window.innerWidth - 200), top: Math.max(8, popoverPos.y - 90), minWidth: 180 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-secondary flex-shrink-0">
              {selectedPresence.user?.avatar_url
                ? <img src={selectedPresence.user.avatar_url} className="w-full h-full object-cover" />
                : <span className="flex items-center justify-center h-full text-xs font-bold">{getInitials(selectedPresence.user?.name ?? "?")}</span>
              }
            </div>
            <div>
              <div className="text-xs font-semibold">{selectedPresence.user?.name}</div>
              <div className="text-xs text-muted-foreground">{selectedPresence.user?.role}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { window.open("https://chat.google.com", "_blank"); setPopoverPos(null); }}
              className="flex-1 py-1.5 rounded-lg bg-secondary hover:bg-secondary/70 text-xs transition-colors">
              💬 Chat
            </button>
            <button onClick={() => { window.open("https://meet.google.com/new", "_blank"); setPopoverPos(null); }}
              className="flex-1 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-xs text-primary transition-colors">
              📹 Meet
            </button>
          </div>
          <button onClick={() => setPopoverPos(null)} className="w-full mt-1.5 py-1 rounded-lg hover:bg-secondary/50 text-xs text-muted-foreground transition-colors">
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}

function colorToHex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}
