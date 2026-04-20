import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppPage = "office" | "feed" | "ai" | "wiki" | "cs" | "meetings" | "workspace" | "office-settings" | "desk-customize" | "profile" | "wa-cs" | "projects" | "products" | "squads" | "collaborators" | "checkins" | "user-approval" | "feature-requests" | "gtm-cockpit" | "mbr";

// Jornada step values — used as sub-tab within ProjectsPage
// "executar-all" = todos os projetos das 3 sub-jornadas Executar juntos
export type ProjectsSetor = "saber" | "ter" | "executar-all" | "executar-onboarding" | "executar-implementacoes" | "executar" | "";

interface AppState {
  currentPage: AppPage;
  profileUserId: string | null;
  sidebarOpen: boolean;
  knockNotification: { fromUserId: string; fromName: string; fromAvatar: string } | null;
  projectsSetor: ProjectsSetor;
  projectsClientFilter: string | null; // client_id para filtrar projetos ao navegar de Clientes
  setCurrentPage: (page: AppPage) => void;
  navigateToProfile: (userId: string) => void;
  setSidebarOpen: (open: boolean) => void;
  setKnockNotification: (
    notif: { fromUserId: string; fromName: string; fromAvatar: string } | null
  ) => void;
  setProjectsSetor: (setor: ProjectsSetor) => void;
  setProjectsClientFilter: (clientId: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentPage: "office",
      profileUserId: null,
      sidebarOpen: true,
      knockNotification: null,
      projectsSetor: "",
      projectsClientFilter: null,
      setCurrentPage: (page) => set({ currentPage: page }),
      navigateToProfile: (userId) => set({ currentPage: "profile", profileUserId: userId }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setKnockNotification: (notif) => set({ knockNotification: notif }),
      setProjectsSetor: (setor) => set({ projectsSetor: setor }),
      setProjectsClientFilter: (clientId) => set({ projectsClientFilter: clientId }),
    }),
    {
      name: "voffice-app",
      partialize: (state) => ({ currentPage: state.currentPage, projectsSetor: state.projectsSetor }),
    }
  )
);
