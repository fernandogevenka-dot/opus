import { useState, useRef, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
import {
  Mail, Calendar, HardDrive, Video, MessageSquare,
  Users, FileText, Presentation, Table2, X, RefreshCw,
} from "lucide-react";

// ─── Tauri detection ──────────────────────────────────────────────────────────

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

// ─── Service definitions ──────────────────────────────────────────────────────

interface ServiceCard {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  url: (email: string) => string;
  featured?: boolean;
}

const SERVICES: ServiceCard[] = [
  {
    id: "chat",
    label: "Google Chat",
    description: "Mensagens e canais da equipe",
    icon: <MessageSquare size={22} />,
    color: "bg-green-500/20 text-green-400",
    url: () => "https://chat.google.com",
    featured: true,
  },
  {
    id: "gmail",
    label: "Gmail",
    description: "E-mail corporativo",
    icon: <Mail size={22} />,
    color: "bg-red-500/20 text-red-400",
    url: (email) => `https://mail.google.com/mail/u/0/?authuser=${email}`,
    featured: true,
  },
  {
    id: "calendar",
    label: "Agenda",
    description: "Calendário e reuniões",
    icon: <Calendar size={22} />,
    color: "bg-blue-500/20 text-blue-400",
    url: (email) => `https://calendar.google.com/calendar/r?authuser=${email}`,
    featured: true,
  },
  {
    id: "meet",
    label: "Google Meet",
    description: "Videochamadas",
    icon: <Video size={22} />,
    color: "bg-emerald-500/20 text-emerald-400",
    url: () => "https://meet.google.com",
    featured: true,
  },
  {
    id: "drive",
    label: "Google Drive",
    description: "Armazenamento e arquivos",
    icon: <HardDrive size={22} />,
    color: "bg-yellow-500/20 text-yellow-400",
    url: (email) => `https://drive.google.com/drive/u/0/?authuser=${email}`,
    featured: true,
  },
  {
    id: "contacts",
    label: "Contatos",
    description: "Contatos do Google Workspace",
    icon: <Users size={22} />,
    color: "bg-purple-500/20 text-purple-400",
    url: (email) => `https://contacts.google.com/?authuser=${email}`,
  },
  {
    id: "docs",
    label: "Google Docs",
    description: "Documentos de texto",
    icon: <FileText size={22} />,
    color: "bg-blue-400/20 text-blue-300",
    url: (email) => `https://docs.google.com/document/u/0/?authuser=${email}`,
  },
  {
    id: "sheets",
    label: "Google Sheets",
    description: "Planilhas",
    icon: <Table2 size={22} />,
    color: "bg-green-400/20 text-green-300",
    url: (email) => `https://docs.google.com/spreadsheets/u/0/?authuser=${email}`,
  },
  {
    id: "slides",
    label: "Google Slides",
    description: "Apresentações",
    icon: <Presentation size={22} />,
    color: "bg-orange-400/20 text-orange-300",
    url: (email) => `https://docs.google.com/presentation/u/0/?authuser=${email}`,
  },
];

const MEET_ROOMS = [
  { name: "Daily de Vendas",      code: "opus-daily-vendas" },
  { name: "Reunião de Liderança", code: "opus-lideranca"    },
  { name: "1:1 Rápido",          code: "opus-oneonone"     },
  { name: "Treinamento Atlas",    code: "opus-atlas-lab"    },
];

// ─── Embedded webview (Tauri only) ────────────────────────────────────────────

interface EmbeddedService {
  id: string;
  label: string;
  url: string;
}

function useEmbeddedWebview(containerRef: React.RefObject<HTMLDivElement | null>, service: EmbeddedService | null) {
  const webviewRef = useRef<unknown>(null);
  const labelRef   = useRef<string | null>(null);

  const destroy = useCallback(async () => {
    if (webviewRef.current) {
      try {
        const wv = webviewRef.current as { close(): Promise<void> };
        await wv.close();
      } catch { /* ignore */ }
      webviewRef.current = null;
      labelRef.current   = null;
    }
  }, []);

  // Atualiza posição/tamanho quando o container muda (resize, scroll)
  const syncBounds = useCallback(async () => {
    if (!webviewRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const wv = webviewRef.current as {
      setPosition(p: unknown): Promise<void>;
      setSize(s: unknown): Promise<void>;
    };
    const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");
    await wv.setPosition(new LogicalPosition(rect.left, rect.top));
    await wv.setSize(new LogicalSize(rect.width, rect.height));
  }, [containerRef]);

  useEffect(() => {
    if (!service || !isTauri()) return;

    let cancelled = false;

    (async () => {
      await destroy();
      if (cancelled || !containerRef.current) return;

      const rect  = containerRef.current.getBoundingClientRect();
      const label = `gsembed-${service.id}-${Date.now()}`;

      const { Webview }        = await import("@tauri-apps/api/webview");
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const { LogicalPosition, LogicalSize } = await import("@tauri-apps/api/dpi");

      if (cancelled) return;

      const wv = new Webview(getCurrentWindow(), label, {
        url:    service.url,
        x:      rect.left,
        y:      rect.top,
        width:  rect.width,
        height: rect.height,
      });

      webviewRef.current = wv;
      labelRef.current   = label;

      // Reposicionar quando a janela for redimensionada
      const { getCurrentWindow: gw } = await import("@tauri-apps/api/window");
      const unlisten = await gw().onResized(() => syncBounds());

      wv.once("tauri://destroyed", () => unlisten());
    })();

    return () => {
      cancelled = true;
      destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id, service?.url]);

  return { destroy, syncBounds };
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

function TabBar({
  active, services, onSelect, onClose, onRefresh,
}: {
  active: string | null;
  services: ServiceCard[];
  onSelect: (s: ServiceCard) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const openTabs = services.filter((s) => s.featured);
  return (
    <div className="flex items-center gap-1 border-b border-border/30 pb-2">
      {openTabs.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
            active === s.id
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          }`}
        >
          {s.icon && <span className="[&_svg]:w-3.5 [&_svg]:h-3.5">{s.icon}</span>}
          {s.label.replace("Google ", "")}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-1">
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          title="Recarregar"
        >
          <RefreshCw size={13} />
        </button>
        {active && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            title="Fechar"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function WorkspacePage() {
  const { user } = useAuthStore();
  const email = user?.email ?? "";

  const [activeService, setActiveService] = useState<EmbeddedService | null>(null);
  const [refreshKey, setRefreshKey]       = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const tauri = isTauri();

  const { destroy } = useEmbeddedWebview(
    containerRef,
    tauri ? activeService : null,
  );

  function openService(s: ServiceCard) {
    const url = s.url(email);
    if (tauri) {
      setActiveService({ id: s.id, label: s.label, url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function openMeetRoom(code: string, name: string) {
    const url = `https://meet.google.com/${code}`;
    if (tauri) {
      setActiveService({ id: `meet-${code}`, label: name, url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function closeService() {
    destroy();
    setActiveService(null);
  }

  function refreshService() {
    if (!activeService) return;
    setActiveService({ ...activeService });
    setRefreshKey((k) => k + 1);
  }

  const featured = SERVICES.filter((s) => s.featured);
  const others   = SERVICES.filter((s) => !s.featured);

  // ── Modo embedded (Tauri com serviço ativo) ──────────────────────────────────
  if (tauri && activeService) {
    return (
      <div className="flex flex-col h-full gap-2">
        <TabBar
          active={activeService.id}
          services={SERVICES}
          onSelect={openService}
          onClose={closeService}
          onRefresh={refreshService}
        />
        {/* Container invisível — o webview Tauri é posicionado em cima dele */}
        <div
          key={refreshKey}
          ref={containerRef}
          className="flex-1 rounded-2xl border border-border/30 bg-background/50 overflow-hidden"
          style={{ minHeight: 0 }}
        />
      </div>
    );
  }

  // ── Modo launcher (grid de atalhos) ──────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 pb-10 space-y-8">

      <div>
        <h2 className="text-lg font-semibold">Workspace</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {tauri
            ? "Clique para abrir qualquer ferramenta aqui dentro."
            : "Clique para abrir qualquer ferramenta em nova aba."}
        </p>
      </div>

      {/* Featured */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {featured.map((s) => (
          <button
            key={s.id}
            onClick={() => openService(s)}
            className="glass group flex flex-col items-center gap-3 p-4 rounded-2xl border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-center"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${s.color} group-hover:scale-110 transition-transform`}>
              {s.icon}
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{s.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{s.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Meet rooms */}
      <div className="glass rounded-2xl border border-border/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Video size={14} className="text-emerald-400" />
          </div>
          <span className="font-semibold text-sm">Salas Meet rápidas</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MEET_ROOMS.map((room) => (
            <button
              key={room.code}
              onClick={() => openMeetRoom(room.code, room.name)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl glass border border-border/30 hover:border-emerald-500/30 hover:text-emerald-400 text-xs font-medium transition-all"
            >
              <Video size={12} className="flex-shrink-0" />
              <span className="truncate">{room.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Others */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Mais ferramentas</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {others.map((s) => (
            <button
              key={s.id}
              onClick={() => openService(s)}
              className="glass group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-all text-left"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                {s.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{s.label}</p>
                <p className="text-xs text-muted-foreground truncate">{s.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
