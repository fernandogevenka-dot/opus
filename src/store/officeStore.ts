import { create } from "zustand";
import type { Room, UserPresence } from "@/types";

interface OfficeState {
  rooms: Room[];
  presences: UserPresence[];
  selectedUserId: string | null;
  myPosition: { x: number; y: number };
  setRooms: (rooms: Room[]) => void;
  setPresences: (presences: UserPresence[]) => void;
  updatePresence: (presence: UserPresence) => void;
  removePresence: (userId: string) => void;
  setSelectedUser: (userId: string | null) => void;
  setMyPosition: (x: number, y: number) => void;
}

export const useOfficeStore = create<OfficeState>((set) => ({
  rooms: [],
  presences: [],
  selectedUserId: null,
  myPosition: { x: 400, y: 300 },

  setRooms: (rooms) => set({ rooms }),
  setPresences: (presences) => set({ presences }),

  updatePresence: (presence) =>
    set((state) => {
      const idx = state.presences.findIndex((p) => p.user_id === presence.user_id);
      if (idx >= 0) {
        const updated = [...state.presences];
        updated[idx] = presence;
        return { presences: updated };
      }
      return { presences: [...state.presences, presence] };
    }),

  removePresence: (userId) =>
    set((state) => ({
      presences: state.presences.filter((p) => p.user_id !== userId),
    })),

  setSelectedUser: (userId) => set({ selectedUserId: userId }),
  setMyPosition: (x, y) => set({ myPosition: { x, y } }),
}));
