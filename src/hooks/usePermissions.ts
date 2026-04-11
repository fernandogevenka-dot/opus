// Hook central de permissões — lê o JSONB permissions do usuário
// Combina permissões granulares (banco) com fallback por opus_role
import { useAuthStore } from "@/store/authStore";
import type { OpusRole, UserPermissions } from "@/types";

export interface Permissions extends UserPermissions {
  // Conveniência derivada
  isAdmin: boolean;
  isFullAccess: boolean;

  // Navegação — IDs das páginas visíveis
  navItems: NavItem[];
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  section?: "main" | "work" | "admin";
}

// Permissões padrão por role (fallback quando permissions JSONB é null)
const ROLE_DEFAULTS: Record<string, UserPermissions> = {
  admin: {
    ver_todos_projetos: true, ver_remuneracoes: true, ver_todos_clientes: true,
    ver_financeiro: true, editar_projetos: true, editar_colaboradores: true,
    gerenciar_squads: true, aprovar_usuarios: true, configuracoes: true,
  },
  gerencia_peg: {
    ver_todos_projetos: true, ver_remuneracoes: true, ver_todos_clientes: true,
    ver_financeiro: true, editar_projetos: true, editar_colaboradores: true,
    gerenciar_squads: true, aprovar_usuarios: true, configuracoes: true,
  },
  coord_admin: {
    ver_todos_projetos: true, ver_remuneracoes: true, ver_todos_clientes: true,
    ver_financeiro: true, editar_projetos: true, editar_colaboradores: true,
    gerenciar_squads: true, aprovar_usuarios: true, configuracoes: false,
  },
  coord_peg: {
    ver_todos_projetos: false, ver_remuneracoes: true, ver_todos_clientes: false,
    ver_financeiro: false, editar_projetos: true, editar_colaboradores: false,
    gerenciar_squads: false, aprovar_usuarios: false, configuracoes: false,
  },
  colaborador: {
    ver_todos_projetos: false, ver_remuneracoes: false, ver_todos_clientes: false,
    ver_financeiro: false, editar_projetos: false, editar_colaboradores: false,
    gerenciar_squads: false, aprovar_usuarios: false, configuracoes: false,
  },
  pending: {
    ver_todos_projetos: false, ver_remuneracoes: false, ver_todos_clientes: false,
    ver_financeiro: false, editar_projetos: false, editar_colaboradores: false,
    gerenciar_squads: false, aprovar_usuarios: false, configuracoes: false,
  },
};

const ALL_NAV: NavItem[] = [
  { id: "office",         label: "Escritório",           icon: "Building2",    section: "main" },
  { id: "feed",           label: "Feed",                 icon: "TrendingUp",   section: "main" },
  { id: "ai",             label: "IA do Time",           icon: "Bot",          section: "main" },
  { id: "wiki",           label: "Wiki",                 icon: "BookOpen",     section: "main" },
  { id: "meetings",       label: "Reuniões",             icon: "Video",        section: "main" },
  { id: "workspace",      label: "Workspace",            icon: "LayoutGrid",   section: "main" },
  { id: "cs",             label: "Clientes CS",          icon: "Users2",       section: "work" },
  { id: "projects",       label: "Projetos",             icon: "FolderKanban", section: "work" },
  { id: "products",       label: "Produtos",             icon: "Package",      section: "work" },
  { id: "collaborators",  label: "Colaboradores",        icon: "Users",        section: "work" },
  { id: "squads",         label: "Squads",               icon: "Network",      section: "work" },
  { id: "checkins",       label: "Inteligência",         icon: "ClipboardCheck", section: "work" },
  { id: "wa-cs",          label: "WhatsApp CS",          icon: "MessageCircle", section: "work" },
  { id: "user-approval",  label: "Aprovação",            icon: "ShieldCheck",  section: "admin" },
  { id: "office-settings",label: "Configurações",        icon: "Settings",     section: "admin" },
  { id: "desk-customize",    label: "Minha Mesa",        icon: "Armchair",     section: "admin" },
  { id: "feature-requests",  label: "Melhorias",         icon: "Lightbulb",    section: "main"  },
  { id: "gtm-cockpit",       label: "GTM Cockpit",        icon: "Activity",     section: "work"  },
  { id: "mbr",               label: "MBR",                icon: "CalendarDays", section: "work"  },
];

export function usePermissions(): Permissions {
  const { user } = useAuthStore();
  const role: OpusRole = user?.opus_role ?? "pending";

  // Usar permissões do banco se disponíveis e não vazias, senão fallback por role
  const hasStoredPermissions =
    user?.permissions != null && Object.keys(user.permissions).length > 0;
  const p: UserPermissions = hasStoredPermissions
    ? user!.permissions!
    : ROLE_DEFAULTS[role] ?? ROLE_DEFAULTS["pending"];

  const isAdmin = role === "admin";
  const isFullAccess = p.aprovar_usuarios && p.ver_financeiro;

  // Montar nav baseado nas permissões granulares
  const navItems = ALL_NAV.filter((item) => {
    switch (item.id) {
      // Sempre visíveis para aprovados
      case "office":
      case "feed":
      case "ai":
      case "wiki":
      case "meetings":
      case "workspace":
      case "checkins":
      case "desk-customize":
      case "feature-requests":
      case "gtm-cockpit":
      case "mbr":
        return true;
      // Depende de permissões
      case "cs":             return true; // todos veem (filtragem é na página)
      case "projects":       return p.ver_todos_projetos || p.editar_projetos;
      case "products":       return p.ver_todos_projetos;
      case "collaborators":  return p.editar_colaboradores || p.ver_remuneracoes;
      case "squads":         return p.gerenciar_squads || p.ver_remuneracoes;
      case "wa-cs":          return p.ver_todos_clientes;
      case "user-approval":  return p.aprovar_usuarios;
      case "office-settings":return p.configuracoes;
      default:               return false;
    }
  });

  return {
    ...p,
    isAdmin,
    isFullAccess,
    navItems,
  };
}
