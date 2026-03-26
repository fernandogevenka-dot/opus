// Hook central de permissões — define o que cada role pode ver/fazer
import { useAuthStore } from "@/store/authStore";
import type { OpusRole } from "@/types";

export interface Permissions {
  // Acesso total à plataforma
  isAdmin: boolean;
  isFullAccess: boolean;        // admin, gerencia_peg, coord_admin

  // Acesso a módulos específicos
  canViewAllProjects: boolean;  // isFullAccess
  canViewOwnSquadProjects: boolean; // coord_peg
  canViewOwnProfile: boolean;   // todos aprovados

  canViewAllCollaborators: boolean; // isFullAccess
  canViewOwnSquadCollaborators: boolean; // coord_peg

  canViewFinancials: boolean;   // isFullAccess
  canViewOwnSalary: boolean;    // todos aprovados

  canViewAllClients: boolean;   // isFullAccess
  canViewOwnClients: boolean;   // coord_peg, colaborador

  canManageSquads: boolean;     // isFullAccess
  canViewSquads: boolean;       // todos aprovados

  canApproveUsers: boolean;     // isFullAccess
  canManageSystem: boolean;     // admin only

  // Navegação — quais páginas aparecem no menu
  navItems: NavItem[];
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  section?: "main" | "work" | "admin";
}

const ALL_NAV: NavItem[] = [
  // main
  { id: "office", label: "Escritório", icon: "Building2", section: "main" },
  { id: "feed", label: "Feed", icon: "Rss", section: "main" },
  { id: "ai", label: "IA do Time", icon: "Bot", section: "main" },
  { id: "wiki", label: "Wiki", icon: "BookOpen", section: "main" },
  { id: "meetings", label: "Reuniões", icon: "Video", section: "main" },
  { id: "workspace", label: "Workspace", icon: "LayoutGrid", section: "main" },
  // work
  { id: "projects", label: "Projetos", icon: "FolderKanban", section: "work" },
  { id: "cs", label: "Clientes CS", icon: "Users2", section: "work" },
  { id: "collaborators", label: "Colaboradores", icon: "Users", section: "work" },
  { id: "squads", label: "Squads", icon: "Network", section: "work" },
  { id: "checkins", label: "Check-ins", icon: "ClipboardCheck", section: "work" },
  { id: "products", label: "Produtos", icon: "Package", section: "work" },
  { id: "wa-cs", label: "WhatsApp CS", icon: "MessageCircle", section: "work" },
  // admin
  { id: "user-approval", label: "Aprovação", icon: "ShieldCheck", section: "admin" },
  { id: "office-settings", label: "Configurações", icon: "Settings", section: "admin" },
];

// Items visíveis para cada role
const NAV_BY_ROLE: Record<string, string[]> = {
  admin: ALL_NAV.map((n) => n.id),
  gerencia_peg: ALL_NAV.map((n) => n.id),
  coord_admin: ALL_NAV.map((n) => n.id),
  coord_peg: [
    "office", "feed", "ai", "wiki", "meetings", "workspace",
    "projects", "cs", "collaborators", "squads", "checkins",
  ],
  colaborador: [
    "office", "feed", "ai", "wiki", "meetings", "workspace",
    "cs", "checkins",
  ],
};

export function usePermissions(): Permissions {
  const { user } = useAuthStore();
  const role: OpusRole = user?.opus_role ?? "pending";

  const isAdmin = role === "admin";
  const isFullAccess = ["admin", "gerencia_peg", "coord_admin"].includes(role);
  const isCoordPeg = role === "coord_peg";
  const isColaborador = role === "colaborador";

  const allowedIds = NAV_BY_ROLE[role] ?? [];
  const navItems = ALL_NAV.filter((n) => allowedIds.includes(n.id));

  return {
    isAdmin,
    isFullAccess,

    canViewAllProjects: isFullAccess,
    canViewOwnSquadProjects: isCoordPeg,
    canViewOwnProfile: true,

    canViewAllCollaborators: isFullAccess,
    canViewOwnSquadCollaborators: isCoordPeg,

    canViewFinancials: isFullAccess,
    canViewOwnSalary: true,

    canViewAllClients: isFullAccess,
    canViewOwnClients: isCoordPeg || isColaborador,

    canManageSquads: isFullAccess,
    canViewSquads: true,

    canApproveUsers: isFullAccess,
    canManageSystem: isAdmin,

    navItems,
  };
}
