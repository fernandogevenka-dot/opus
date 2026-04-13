import { useEffect, useState } from "react";
import { useAppStore, type AppPage, type ProjectsSetor } from "@/store/appStore";
import { useAuthStore } from "@/store/authStore";
import { useGamification } from "@/hooks/useGamification";
import { useOfficeStore } from "@/store/officeStore";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/lib/supabase";
import { APP_NAME, AI_NAME } from "@/lib/constants";
import {
  Building2, TrendingUp, Sparkles, BookOpen, Video,
  LayoutGrid, LogOut, User, Bell, Zap, HeartHandshake,
  Settings2, Armchair, ChevronDown, Users, MessageCircle,
  Briefcase, Shield, UserCheck, ClipboardList, Package,
  ShieldCheck, Lightbulb, Activity, GraduationCap, Box, Settings, CalendarDays,
} from "lucide-react";
import { getStatusColor, getLevelName, getXPForNextLevel, formatXP } from "@/lib/utils";
import { KnockNotificationBanner } from "@/components/shared/KnockNotificationBanner";
import { motion, AnimatePresence } from "framer-motion";

// ─── Nav structure ────────────────────────────────────────────────────────────

interface NavItem {
  id: AppPage;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavGroup {
  label?: string;
  items: Omit<NavItem, "badge">[];
}

// All possible nav items — filtered per-role at runtime
const ALL_NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { id: "office",  label: "Escritório", icon: <Building2 size={15} /> },
      { id: "feed",    label: "Feed",        icon: <TrendingUp size={15} /> },
    ],
  },
  {
    label: "Operação",
    items: [
      { id: "gtm-cockpit",   label: "GTM Cockpit",        icon: <Activity size={15} /> },
      { id: "mbr",           label: "MBR",                icon: <CalendarDays size={15} /> },
      { id: "cs",            label: "Clientes",           icon: <HeartHandshake size={15} /> },
      { id: "projects",      label: "Projetos",           icon: <Briefcase size={15} /> },
      { id: "saber",         label: "Saber",              icon: <GraduationCap size={15} /> },
      { id: "ter",           label: "Ter",                icon: <Box size={15} /> },
      { id: "executar",      label: "Executar",           icon: <Settings size={15} /> },
      { id: "products",      label: "Produtos",           icon: <Package size={15} /> },
      { id: "checkins",      label: "Inteligência",       icon: <ClipboardList size={15} /> },
      { id: "wa-cs",         label: "WhatsApp CS",        icon: <MessageCircle size={15} /> },
    ],
  },
  {
    label: "Time",
    items: [
      { id: "collaborators", label: "Colaboradores",      icon: <UserCheck size={15} /> },
      { id: "squads",        label: "Squads",             icon: <Shield size={15} /> },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { id: "ai",               label: AI_NAME,                  icon: <Sparkles size={15} /> },
      { id: "wiki",             label: "Base de Conhecimento",   icon: <BookOpen size={15} /> },
      { id: "meetings",         label: "Reuniões",               icon: <Video size={15} /> },
      { id: "workspace",        label: "Workspace",              icon: <LayoutGrid size={15} /> },
      { id: "feature-requests", label: "Melhorias",              icon: <Lightbulb size={15} /> },
    ],
  },
  {
    label: "Configurações",
    items: [
      { id: "office-settings", label: "Salas",            icon: <Settings2 size={15} /> },
      { id: "desk-customize",  label: "Minha Mesa",        icon: <Armchair size={15} /> },
      { id: "user-approval",   label: "Aprovação",         icon: <ShieldCheck size={15} /> },
    ],
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

const STEP_SUB_ITEMS: { id: ProjectsSetor; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "saber",    label: "Saber",    icon: <GraduationCap size={12} />, color: "#8b5cf6" },
  { id: "ter",      label: "Ter",      icon: <Box size={12} />,           color: "#06b6d4" },
  { id: "executar", label: "Executar", icon: <Settings size={12} />,      color: "#22c55e" },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { currentPage, setCurrentPage, knockNotification, setKnockNotification, projectsSetor, setProjectsSetor } = useAppStore();
  const { user, signOut } = useAuthStore();
  const { leaderboard } = useGamification();
  const presences = useOfficeStore((s) => s.presences);
  const permissions = usePermissions();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [knockCount, setKnockCount] = useState(0);

  const myRank = leaderboard.findIndex((e) => e.user_id === user?.id) + 1;
  const xpProgress = user ? getXPForNextLevel(user.xp) : null;

  const onlineCount = presences.filter(
    (p) => p.user_id !== user?.id && p.status !== "offline"
  ).length;

  // Filter nav groups based on role permissions
  const allowedIds = new Set(permissions.navItems.map((n) => n.id));
  const NAV_GROUPS: NavGroup[] = ALL_NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowedIds.has(item.id)),
    }))
    .filter((group) => group.items.length > 0);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`knocks-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "knock_notifications",
        filter: `target_user_id=eq.${user.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from("users")
          .select("name, avatar_url")
          .eq("id", payload.new.from_user_id)
          .single();
        if (data) {
          setKnockNotification({
            fromUserId: payload.new.from_user_id,
            fromName: data.name,
            fromAvatar: data.avatar_url,
          });
          setKnockCount((n) => n + 1);
        }
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [user?.id]);

  useEffect(() => {
    if (!knockNotification) setKnockCount(0);
  }, [knockNotification]);

  // Flatten nav items with badge injection
  const getNavItems = (): NavItem[] =>
    NAV_GROUPS.flatMap((g) =>
      g.items.map((item) => {
        if (item.id === "office" && onlineCount > 0) {
          return { ...item, badge: onlineCount };
        }
        return item;
      })
    );
  const allNavItems = getNavItems();

  const currentLabel =
    allNavItems.find((n) => n.id === currentPage)?.label ??
    (currentPage === "profile" ? "Meu Perfil" : currentPage);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background select-none">

      {/* ── Left Sidebar ──────────────────────────────────────────────── */}
      <aside className="w-[220px] flex-shrink-0 flex flex-col overflow-hidden" style={{
        background: "linear-gradient(180deg, #111111 0%, #161616 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-white/10">
            <img src="/v4-logo.jpg" alt="V4 Company" className="w-full h-full object-cover" />
          </div>
          <div>
            <span className="text-white font-bold text-sm tracking-tight block">{APP_NAME}</span>
            <span className="text-white/30 text-xs">V4 Company</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {NAV_GROUPS.map((group, gi) => {
            const groupItems = group.items.map((item) => {
              const withBadge = allNavItems.find((n) => n.id === item.id);
              return withBadge ?? item;
            });

            return (
              <div key={gi}>
                {group.label && (
                  <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/20">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const isActive = currentPage === item.id;
                    const showSub = item.id === "projects" && (isActive || projectsSetor !== "");
                    const stepColor = item.id === "saber" ? "#8b5cf6" : item.id === "ter" ? "#06b6d4" : item.id === "executar" ? "#22c55e" : null;
                    return (
                      <div key={item.id}>
                        <button
                          onClick={() => {
                            setCurrentPage(item.id as AppPage);
                            if (item.id !== "projects") setProjectsSetor("");
                          }}
                          className={`relative w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${
                            isActive
                              ? "bg-white/10 text-white"
                              : "text-white/40 hover:text-white/80 hover:bg-white/5"
                          }`}
                        >
                          {/* Active indicator */}
                          {isActive && (
                            <span
                              className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                              style={{ backgroundColor: stepColor ?? "hsl(var(--primary))" }}
                            />
                          )}
                          <span style={isActive && stepColor ? { color: stepColor } : undefined} className={!stepColor || !isActive ? (isActive ? "text-white" : "text-white/30") : undefined}>
                            {item.icon}
                          </span>
                          <span className="flex-1" style={isActive && stepColor ? { color: stepColor } : undefined}>{item.label}</span>
                          {"badge" in item && (item as NavItem).badge != null && (item as NavItem).badge! > 0 && (
                            <span className="w-5 h-5 rounded-full bg-primary text-[10px] font-bold flex items-center justify-center text-white flex-shrink-0">
                              {(item as NavItem).badge! > 9 ? "9+" : (item as NavItem).badge}
                            </span>
                          )}
                          {item.id === "projects" && (
                            <ChevronDown
                              size={12}
                              className={`transition-transform text-white/30 ${isActive ? "rotate-0" : "-rotate-90"}`}
                            />
                          )}
                        </button>

                        {/* STEP sub-menu under Projetos */}
                        {item.id === "projects" && isActive && (
                          <div className="ml-4 mt-0.5 mb-1 pl-3 border-l border-white/10 space-y-0.5">
                            {STEP_SUB_ITEMS.map((sub) => {
                              const subActive = projectsSetor === sub.id;
                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => setProjectsSetor(subActive ? "" : sub.id)}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                                    subActive
                                      ? "bg-white/8 text-white"
                                      : "text-white/35 hover:text-white/70 hover:bg-white/5"
                                  }`}
                                >
                                  <span style={{ color: subActive ? sub.color : undefined }}>
                                    {sub.icon}
                                  </span>
                                  <span className="flex-1">{sub.label}</span>
                                  {subActive && (
                                    <span
                                      className="w-1 h-1 rounded-full flex-shrink-0"
                                      style={{ backgroundColor: sub.color }}
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Online indicator */}
        {onlineCount > 0 && (
          <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => setCurrentPage("office")}
              className="flex items-center gap-2 text-xs text-white/30 hover:text-white/60 transition-colors w-full"
            >
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span>{onlineCount} colega{onlineCount > 1 ? "s" : ""} online</span>
              </span>
            </button>
          </div>
        )}

        {/* User mini card */}
        <div className="px-3 pb-4">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className="relative w-8 h-8 flex-shrink-0">
              <img
                src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? "?")}&background=333&color=fff`}
                alt={user?.name}
                className="w-full h-full rounded-full object-cover ring-1 ring-white/10"
              />
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-1 ring-[#111]"
                style={{ backgroundColor: getStatusColor("available") }}
              />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-white/80 truncate">{user?.name}</p>
              <p className="text-[10px] text-white/30 truncate">{user?.email}</p>
            </div>
            <ChevronDown size={12} className="text-white/20 flex-shrink-0" />
          </button>
        </div>
      </aside>

      {/* ── Right column ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="flex-shrink-0 h-12 flex items-center justify-between px-5 border-b border-border bg-card">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground/50 font-medium">{APP_NAME}</span>
            <span className="text-muted-foreground/30">›</span>
            <span className="font-semibold text-foreground">{currentLabel}</span>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {user?.title_active && (
              <span className="title-badge hidden md:inline-flex">
                {user.title_active.icon} {user.title_active.name}
              </span>
            )}
            <span className="xp-badge hidden md:inline-flex">
              <Zap size={10} />
              {formatXP(user?.xp ?? 0)} XP
            </span>

            {/* Notifications */}
            <button
              className="relative w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Notificações"
            >
              <Bell size={15} />
              {knockCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>

            {/* Profile shortcut */}
            <button
              onClick={() => setCurrentPage("profile" as AppPage)}
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg hover:bg-secondary transition-colors"
            >
              <div className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-border">
                <img
                  src={user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? "?")}&background=e0e0e0&color=333`}
                  alt={user?.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="h-full p-5 overflow-y-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Knock notification */}
      <KnockNotificationBanner
        notification={knockNotification}
        onDismiss={() => setKnockNotification(null)}
      />

      {/* User dropdown */}
      <AnimatePresence>
        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="fixed bottom-16 left-3 z-50 bg-card rounded-2xl border border-border shadow-xl p-4 w-64"
            >
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-border">
                <img
                  src={user?.avatar_url || ""}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-border"
                  alt={user?.name}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>

              {xpProgress && (
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="flex items-center gap-1 font-medium">
                      <Zap size={11} className="text-primary" />
                      {getLevelName(user?.level ?? 1)}
                    </span>
                    <span className="text-muted-foreground">{formatXP(user?.xp ?? 0)} XP</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${xpProgress.progress}%` }}
                      className="h-full bg-gradient-to-r from-primary to-violet-500 rounded-full"
                    />
                  </div>
                </div>
              )}

              {myRank > 0 && (
                <p className="text-xs text-muted-foreground mb-3">
                  🏅 #{myRank} no ranking do time
                </p>
              )}

              <div className="space-y-0.5">
                <button
                  onClick={() => { setCurrentPage("profile" as AppPage); setShowUserMenu(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-xl hover:bg-secondary text-sm transition-colors"
                >
                  <User size={14} className="text-muted-foreground" />
                  Meu perfil
                </button>
                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-xl hover:bg-red-50 text-red-500 text-sm transition-colors"
                >
                  <LogOut size={14} />
                  Sair
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
