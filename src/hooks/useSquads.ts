import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";

export interface DeskItem {
  id: string;
  user_id: string;
  type: "plant" | "trophy" | "photo" | "mug" | "book" | "lamp" | "sticky_note" | "custom";
  label: string | null;
  emoji: string | null;
  position: number;
}

export interface DeskSeat {
  id: string;
  desk_id: string;
  seat_index: number;
  label: string | null;
  user_id: string | null;
  user?: {
    id: string;
    name: string;
    avatar_url: string | null;
    team: string | null;
  } | null;
  desk_items?: DeskItem[];
}

export interface SquadDesk {
  id: string;
  squad_id: string;
  position_x: number;
  position_y: number;
  capacity: number;
  desk_name: string | null;
  seats: DeskSeat[];
}

export interface Squad {
  id: string;
  name: string;
  slug: string;
  color: string;
  flag_emoji: string;
  description: string | null;
  dashboard_url: string | null;
  coordinator_id: string | null;
  coordinator?: { id: string; name: string; avatar_url: string | null } | null;
  desks: SquadDesk[];
}

// Fallback: squads estáticos quando o banco ainda não tem os dados
function makeSeats(deskId: string, prefix: string) {
  return Array.from({ length: 9 }, (_, i) => ({
    id: `seat-${prefix}-${i}`,
    desk_id: deskId,
    seat_index: i,
    label: null,
    user_id: null,
    user: null,
    desk_items: [],
  }));
}

const STATIC_SQUADS: Squad[] = [
  {
    id: "squad-cs",
    name: "Customer Success",
    slug: "cs",
    color: "#22c55e",
    flag_emoji: "🟢",
    description: "Time de CS e retenção",
    dashboard_url: null,
    coordinator_id: null,
    coordinator: null,
    desks: [{ id: "desk-cs-1", squad_id: "squad-cs", position_x: 0, position_y: 0, capacity: 9, desk_name: "Mesa CS", seats: makeSeats("desk-cs-1", "cs") }],
  },
  {
    id: "squad-comercial",
    name: "Comercial",
    slug: "comercial",
    color: "#f97316",
    flag_emoji: "🟠",
    description: "Time comercial e aquisição",
    dashboard_url: null,
    coordinator_id: null,
    coordinator: null,
    desks: [{ id: "desk-com-1", squad_id: "squad-comercial", position_x: 1, position_y: 0, capacity: 9, desk_name: "Mesa Comercial", seats: makeSeats("desk-com-1", "com") }],
  },
  {
    id: "squad-midia",
    name: "Mídia",
    slug: "midia",
    color: "#8b5cf6",
    flag_emoji: "🟣",
    description: "Time de mídia e performance",
    dashboard_url: null,
    coordinator_id: null,
    coordinator: null,
    desks: [{ id: "desk-mid-1", squad_id: "squad-midia", position_x: 2, position_y: 0, capacity: 9, desk_name: "Mesa Mídia", seats: makeSeats("desk-mid-1", "mid") }],
  },
  {
    id: "squad-ops",
    name: "Operações",
    slug: "ops",
    color: "#f59e0b",
    flag_emoji: "🟡",
    description: "Time de operações e processos",
    dashboard_url: null,
    coordinator_id: null,
    coordinator: null,
    desks: [{ id: "desk-ops-1", squad_id: "squad-ops", position_x: 0, position_y: 1, capacity: 9, desk_name: "Mesa Operações", seats: makeSeats("desk-ops-1", "ops") }],
  },
  {
    id: "squad-conteudo",
    name: "Conteúdo",
    slug: "conteudo",
    color: "#ec4899",
    flag_emoji: "🩷",
    description: "Time de conteúdo e comunicação",
    dashboard_url: null,
    coordinator_id: null,
    coordinator: null,
    desks: [{ id: "desk-cnt-1", squad_id: "squad-conteudo", position_x: 1, position_y: 1, capacity: 9, desk_name: "Mesa Conteúdo", seats: makeSeats("desk-cnt-1", "cnt") }],
  },
  {
    id: "squad-design",
    name: "Design",
    slug: "design",
    color: "#a855f7",
    flag_emoji: "🟣",
    description: "Time de design e criação",
    dashboard_url: null,
    coordinator_id: null,
    coordinator: null,
    desks: [{ id: "desk-des-1", squad_id: "squad-design", position_x: 2, position_y: 1, capacity: 9, desk_name: "Mesa Design", seats: makeSeats("desk-des-1", "des") }],
  },
  {
    id: "squad-tech",
    name: "Tech & Produto",
    slug: "tech",
    color: "#ef4444",
    flag_emoji: "🔴",
    description: "Time de tecnologia e produto",
    dashboard_url: null,
    coordinator_id: null,
    coordinator: null,
    desks: [{ id: "desk-tec-1", squad_id: "squad-tech", position_x: 0, position_y: 2, capacity: 9, desk_name: "Mesa Tech", seats: makeSeats("desk-tec-1", "tec") }],
  },
];

export function useSquads() {
  const [squads, setSquads] = useState<Squad[]>(STATIC_SQUADS);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    loadSquads();
  }, []);

  async function loadSquads() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("squads")
        .select(`
          *,
          coordinator:users!coordinator_id(id, name, avatar_url),
          desks:squad_desks(
            *,
            seats:desk_seats(
              *,
              user:users(id, name, avatar_url, team)
            )
          )
        `)
        .order("name");

      if (error || !data || data.length === 0) {
        // Tabela não existe ainda ou vazia — usa dados estáticos
        setSquads(STATIC_SQUADS);
      } else {
        // Enrich with desk items
        const enriched = await Promise.all(
          (data as Squad[]).map(async (squad) => {
            const desks = await Promise.all(
              (squad.desks ?? []).map(async (desk) => {
                const seats = await Promise.all(
                  (desk.seats ?? []).map(async (seat) => {
                    if (!seat.user_id) return { ...seat, desk_items: [] };
                    const { data: items } = await supabase
                      .from("desk_items")
                      .select("*")
                      .eq("user_id", seat.user_id)
                      .order("position");
                    return { ...seat, desk_items: items ?? [] };
                  })
                );
                return { ...desk, seats };
              })
            );
            return { ...squad, desks };
          })
        );
        setSquads(enriched);
      }
    } catch {
      setSquads(STATIC_SQUADS);
    }
    setLoading(false);
  }

  async function updateSquad(squadId: string, updates: Partial<Pick<Squad, "name" | "color" | "flag_emoji" | "description" | "dashboard_url">>) {
    await supabase.from("squads").update(updates).eq("id", squadId);
    await loadSquads();
  }

  async function assignSeat(seatId: string, userId: string | null) {
    await supabase.from("desk_seats").update({ user_id: userId }).eq("id", seatId);
    await loadSquads();
  }

  async function addDeskItem(item: Omit<DeskItem, "id">) {
    if (!user) return;
    await supabase.from("desk_items").upsert({ ...item, user_id: user.id }, { onConflict: "user_id,position" });
    await loadSquads();
  }

  async function removeDeskItem(itemId: string) {
    await supabase.from("desk_items").delete().eq("id", itemId);
    await loadSquads();
  }

  return { squads, loading, loadSquads, updateSquad, assignSeat, addDeskItem, removeDeskItem };
}
