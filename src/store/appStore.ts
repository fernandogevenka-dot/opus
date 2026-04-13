import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppPage = "office" | "feed" | "ai" | "wiki" | "cs" | "meetings" | "workspace" | "office-settings" | "desk-customize" | "profile" | "wa-cs" | "projects" | "products" | "squads" | "collaborators" | "checkins" | "user-approval" | "feature-requests" | "gtm-cockpit" | "mbr" | "saber" | "ter" | "executar";

export type ProjectsSetor = "saber" | "ter" | "executar" | "";

interface AppState {
  currentPage: AppPage;
  profileUserId: string | null;
  sidebarOpen: boolean;
  knockNotification: { fromUserId: string; fromName: string; fromAvatar: string } | null;
  projectsSetor: ProjectsSetor;
  setCurrentPage: (page: AppPage) => void;
  navigateToProfile: (userId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setKnockNotification: (
    notif: { fromUserId: string; fromName: string; fromAvatar: string } | null
  ) => void;
  setProjectsSetor: (setor: ProjectsSetor) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: "office",
      profileUserId: null,
      sidebarOpen: true,
      knockNotification: null,
      projectsSetor: "",
      setCurrentPage: (page) => set({ currentPage: page }),
      navigateToProfile: (userId) => set({ currentPage: "profile", profileUserId: userId }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setKnockNotification: (notif) => set({ knockNotification: notif }),
      setProjectsSetor: (setor) => set({ projectsSetor: setor }),
    }),
    {
      name: "voffice-app",
      partialize: (state) => ({ currentPage: state.currentPage, projectsSetor: state.projectsSetor }),
    }
  )
);
