import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppPage = "office" | "feed" | "ai" | "wiki" | "cs" | "meetings" | "workspace" | "office-settings" | "desk-customize" | "profile" | "wa-cs" | "projects" | "products" | "squads" | "collaborators" | "checkins" | "user-approval" | "feature-requests";

interface AppState {
  currentPage: AppPage;
  profileUserId: string | null;
  sidebarOpen: boolean;
  knockNotification: { fromUserId: string; fromName: string; fromAvatar: string } | null;
  setCurrentPage: (page: AppPage) => void;
  navigateToProfile: (userId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setKnockNotification: (
    notif: { fromUserId: string; fromName: string; fromAvatar: string } | null
  ) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: "office",
      profileUserId: null,
      sidebarOpen: true,
      knockNotification: null,
      setCurrentPage: (page) => set({ currentPage: page }),
      navigateToProfile: (userId) => set({ currentPage: "profile", profileUserId: userId }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setKnockNotification: (notif) => set({ knockNotification: notif }),
    }),
    {
      name: "voffice-app",
      partialize: (state) => ({ currentPage: state.currentPage }),
    }
  )
);
