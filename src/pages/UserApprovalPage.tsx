// Tela de aprovação de usuários — visível apenas para admin/gerencia/coord_admin
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import {
  Check, X, Clock, Users, RefreshCw, Search,
  ChevronDown, ChevronUp, Link2,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PendingUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  funcao: string | null;
  cargo_titulo: string | null;
  opus_role: string;
  approval_status: string;
  created_at: string;
  colaborador_id: string | null;
}

interface ColaboradorOption {
  id: string;
  name: string;
  email: string;
  cargo: string | null;
}

// ─── Permissões disponíveis ───────────────────────────────────────────────────

interface PermissionDef {
  key: string;
  label: string;
  description: string;
  group: string;
}

const PERMISSION_DEFS: PermissionDef[] = [
  // Visibilidade
  { key: "ver_todos_projetos",    label: "Ver todos os projetos",          description: "Acessa projetos de qualquer squad, não só o próprio",  group: "Visibilidade" },
  { key: "ver_remuneracoes",      label: "Ver remunerações",               description: "Visualiza salários e comissões dos colaboradores",      group: "Visibilidade" },
  { key: "ver_todos_clientes",    label: "Ver todos os clientes",          description: "Acessa toda a base de clientes, não só a carteira própria", group: "Visibilidade" },
  { key: "ver_financeiro",        label: "Ver dados financeiros",          description: "Acessa MRR, churn financeiro e receita total da empresa", group: "Visibilidade" },
  // Ações
  { key: "editar_projetos",       label: "Editar projetos",                description: "Cria e edita projetos e seus dados",                   group: "Ações" },
  { key: "editar_colaboradores",  label: "Editar colaboradores",           description: "Edita cadastros e dados de outros colaboradores",       group: "Ações" },
  { key: "gerenciar_squads",      label: "Gerenciar squads",               description: "Cria, edita e reorganiza squads e membros",            group: "Ações" },
  // Administração
  { key: "aprovar_usuarios",      label: "Aprovar novos usuários",         description: "Acessa este painel e aprova/rejeita cadastros",        group: "Administração" },
  { key: "configuracoes",         label: "Configurações do sistema",       description: "Acessa e edita salas, configurações e integrações",    group: "Administração" },
];

// Presets por cargo — sugestão que o admin pode ajustar
const PERMISSION_PRESETS: Record<string, Record<string, boolean>> = {
  Diretor: {
    ver_todos_projetos: true, ver_remuneracoes: true, ver_todos_clientes: true,
    ver_financeiro: true, editar_projetos: true, editar_colaboradores: true,
    gerenciar_squads: true, aprovar_usuarios: true, configuracoes: true,
  },
  Gerente: {
    ver_todos_projetos: true, ver_remuneracoes: true, ver_todos_clientes: true,
    ver_financeiro: true, editar_projetos: true, editar_colaboradores: true,
    gerenciar_squads: true, aprovar_usuarios: true, configuracoes: false,
  },
  Coordenador: {
    ver_todos_projetos: false, ver_remuneracoes: true, ver_todos_clientes: false,
    ver_financeiro: false, editar_projetos: true, editar_colaboradores: false,
    gerenciar_squads: false, aprovar_usuarios: false, configuracoes: false,
  },
  Investidor: {
    ver_todos_projetos: false, ver_remuneracoes: false, ver_todos_clientes: false,
    ver_financeiro: false, editar_projetos: false, editar_colaboradores: false,
    gerenciar_squads: false, aprovar_usuarios: false, configuracoes: false,
  },
};

const DEFAULT_PERMISSIONS: Record<string, boolean> = PERMISSION_PRESETS["Investidor"];

// ─── Componente principal ─────────────────────────────────────────────────────

export function UserApprovalPage() {
  const { user: adminUser } = useAuthStore();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Per-user state: permissions checklist + colaborador link
  const [permissionsMap, setPermissionsMap] = useState<Record<string, Record<string, boolean>>>({});
  const [colaboradorMap, setColaboradorMap] = useState<Record<string, string | null>>({});
  const [colaboradorOptions, setColaboradorOptions] = useState<ColaboradorOption[]>([]);
  const [colaboradorSearch, setColaboradorSearch] = useState<Record<string, string>>({});
  const [showColaboradorDropdown, setShowColaboradorDropdown] = useState<string | null>(null);

  // Stats from full table regardless of filter
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });

  async function loadStats() {
    const { data } = await supabase
      .from("users")
      .select("approval_status");
    if (data) {
      setStats({
        pending: data.filter((u) => u.approval_status === "pending").length,
        approved: data.filter((u) => u.approval_status === "approved").length,
        rejected: data.filter((u) => u.approval_status === "rejected").length,
      });
    }
  }

  async function loadUsers() {
    setLoading(true);
    let query = supabase
      .from("users")
      .select("id, name, email, avatar_url, funcao, cargo_titulo, opus_role, approval_status, created_at, colaborador_id")
      .order("created_at", { ascending: true });
    if (filter !== "all") query = query.eq("approval_status", filter);
    const { data, error } = await query;
    if (error) console.error("[UserApproval] load error:", error);
    const list = (data as PendingUser[]) ?? [];
    setUsers(list);

    // Inicializar permissões com preset baseado no cargo_titulo
    setPermissionsMap((prev) => {
      const next = { ...prev };
      list.forEach((u) => {
        if (!next[u.id]) {
          next[u.id] = PERMISSION_PRESETS[u.cargo_titulo ?? ""] ?? { ...DEFAULT_PERMISSIONS };
        }
      });
      return next;
    });
    // Inicializar colaborador
    setColaboradorMap((prev) => {
      const next = { ...prev };
      list.forEach((u) => {
        if (next[u.id] === undefined) next[u.id] = u.colaborador_id ?? null;
      });
      return next;
    });
    setLoading(false);
  }

  async function loadColaboradores(search: string) {
    const { data } = await supabase
      .from("collaborators")
      .select("id, name, email, cargo")
      .ilike("name", `%${search}%`)
      .limit(10);
    setColaboradorOptions((data as ColaboradorOption[]) ?? []);
  }

  useEffect(() => { loadUsers(); loadStats(); }, [filter]);

  const togglePermission = useCallback((userId: string, key: string) => {
    setPermissionsMap((prev) => ({
      ...prev,
      [userId]: { ...prev[userId], [key]: !prev[userId]?.[key] },
    }));
  }, []);

  async function handleApprove(targetUser: PendingUser) {
    const permissions = permissionsMap[targetUser.id] ?? DEFAULT_PERMISSIONS;
    const colaboradorId = colaboradorMap[targetUser.id] ?? null;

    // Mapear permissões para opus_role (compatibilidade com usePermissions)
    const p = permissions;
    let opus_role = "colaborador";
    if (p.aprovar_usuarios && p.configuracoes) opus_role = "gerencia_peg";
    else if (p.aprovar_usuarios) opus_role = "coord_admin";
    else if (p.ver_remuneracoes || p.editar_projetos) opus_role = "coord_peg";

    setProcessing(targetUser.id);
    const { error } = await supabase
      .from("users")
      .update({
        approval_status: "approved",
        opus_role,
        permissions,
        colaborador_id: colaboradorId,
        approved_by: adminUser?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", targetUser.id);
    if (error) console.error("[UserApproval] approve error:", error);
    setProcessing(null);
    setExpandedId(null);
    loadUsers();
    loadStats();
  }

  async function handleReject(targetUser: PendingUser) {
    setProcessing(targetUser.id);
    const { error } = await supabase
      .from("users")
      .update({ approval_status: "rejected" })
      .eq("id", targetUser.id);
    if (error) console.error("[UserApproval] reject error:", error);
    setProcessing(null);
    loadUsers();
    loadStats();
  }

  async function handleRevoke(targetUser: PendingUser) {
    setProcessing(targetUser.id);
    const { error } = await supabase
      .from("users")
      .update({ approval_status: "pending", opus_role: "pending" })
      .eq("id", targetUser.id);
    if (error) console.error("[UserApproval] revoke error:", error);
    setProcessing(null);
    loadUsers();
    loadStats();
  }

  // Agrupar permissões por grupo
  const permGrouped = PERMISSION_DEFS.reduce<Record<string, PermissionDef[]>>((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col gap-4 p-4 md:p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Aprovação de Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Vincule cadastros, defina permissões e libere acesso ao Opus
          </p>
        </div>
        <button
          onClick={() => { loadUsers(); loadStats(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 text-sm hover:bg-muted/30 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Aguardando</span>
          <span className="text-2xl font-bold tracking-tight text-yellow-500">{stats.pending}</span>
        </div>
        <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Aprovados</span>
          <span className="text-2xl font-bold tracking-tight text-green-500">{stats.approved}</span>
        </div>
        <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Rejeitados</span>
          <span className="text-2xl font-bold tracking-tight text-red-500">{stats.rejected}</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "pending" ? "Pendentes" : f === "approved" ? "Aprovados" : f === "rejected" ? "Rejeitados" : "Todos"}
            {f === "pending" && stats.pending > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                {stats.pending}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
          <Users className="w-10 h-10 opacity-30" />
          <p className="text-sm">Nenhum usuário nesta categoria</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isProcessing = processing === u.id;
            const isExpanded = expandedId === u.id;
            const perms = permissionsMap[u.id] ?? DEFAULT_PERMISSIONS;
            const selectedColaboradorId = colaboradorMap[u.id] ?? null;
            const selectedColaborador = colaboradorOptions.find((c) => c.id === selectedColaboradorId);
            const activeCount = Object.values(perms).filter(Boolean).length;

            return (
              <div
                key={u.id}
                className="rounded-2xl border border-border/50 bg-background overflow-hidden"
              >
                {/* Row header */}
                <div className="flex items-center gap-3 p-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-muted">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-muted-foreground">
                        {u.name?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      {u.cargo_titulo && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                          {u.cargo_titulo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    {u.funcao && <p className="text-xs text-muted-foreground/60">{u.funcao}</p>}
                  </div>

                  {/* Status badge */}
                  <div className="flex-shrink-0">
                    {u.approval_status === "pending" && (
                      <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded-full">
                        <Clock className="w-3 h-3" />Pendente
                      </span>
                    )}
                    {u.approval_status === "approved" && (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                        <Check className="w-3 h-3" />Aprovado
                      </span>
                    )}
                    {u.approval_status === "rejected" && (
                      <span className="flex items-center gap-1 text-xs text-red-600 bg-red-500/10 px-2 py-1 rounded-full">
                        <X className="w-3 h-3" />Rejeitado
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {u.approval_status === "pending" && (
                      <>
                        <button
                          onClick={() => handleReject(u)}
                          disabled={isProcessing}
                          className="p-2 rounded-lg border border-border/50 text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          title="Rejeitar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : u.id)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isExpanded ? "Fechar" : `Configurar (${activeCount} permissões)`}
                        </button>
                      </>
                    )}
                    {(u.approval_status === "approved" || u.approval_status === "rejected") && u.id !== adminUser?.id && (
                      <button
                        onClick={() => handleRevoke(u)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 rounded-lg border border-border/50 text-xs text-muted-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
                      >
                        {isProcessing ? "..." : "Reverter"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded: Colaborador link + Permission checklist */}
                {isExpanded && (
                  <div className="border-t border-border/50 p-4 bg-muted/10 space-y-5">

                    {/* Vincular colaborador */}
                    <div>
                      <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                        Vincular ao colaborador cadastrado
                      </p>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Opcional — conecta este usuário ao registro de colaborador já existente no sistema.
                      </p>
                      <div className="relative">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-background">
                          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <input
                            type="text"
                            placeholder="Buscar colaborador..."
                            value={colaboradorSearch[u.id] ?? (selectedColaborador?.name ?? "")}
                            onChange={(e) => {
                              setColaboradorSearch((prev) => ({ ...prev, [u.id]: e.target.value }));
                              setShowColaboradorDropdown(u.id);
                              loadColaboradores(e.target.value);
                            }}
                            onFocus={() => {
                              setShowColaboradorDropdown(u.id);
                              loadColaboradores(colaboradorSearch[u.id] ?? "");
                            }}
                            className="flex-1 bg-transparent text-xs outline-none"
                          />
                          {selectedColaboradorId && (
                            <button
                              onClick={() => {
                                setColaboradorMap((prev) => ({ ...prev, [u.id]: null }));
                                setColaboradorSearch((prev) => ({ ...prev, [u.id]: "" }));
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {showColaboradorDropdown === u.id && colaboradorOptions.length > 0 && (
                          <div className="absolute top-full mt-1 left-0 right-0 bg-background border border-border/50 rounded-xl shadow-lg z-50 py-1 max-h-40 overflow-y-auto">
                            {colaboradorOptions.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setColaboradorMap((prev) => ({ ...prev, [u.id]: c.id }));
                                  setColaboradorSearch((prev) => ({ ...prev, [u.id]: c.name }));
                                  setShowColaboradorDropdown(null);
                                }}
                                className="w-full text-left px-4 py-2 text-xs hover:bg-muted/30 transition-colors"
                              >
                                <span className="font-medium">{c.name}</span>
                                {c.cargo && <span className="text-muted-foreground ml-2">{c.cargo}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedColaboradorId && (
                        <p className="text-[11px] text-green-600 mt-1.5 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Vinculado com sucesso
                        </p>
                      )}
                    </div>

                    {/* Checklist de permissões */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold">Permissões de acesso</p>
                        {u.cargo_titulo && PERMISSION_PRESETS[u.cargo_titulo] && (
                          <button
                            onClick={() =>
                              setPermissionsMap((prev) => ({
                                ...prev,
                                [u.id]: { ...PERMISSION_PRESETS[u.cargo_titulo!] },
                              }))
                            }
                            className="text-[11px] text-primary hover:underline"
                          >
                            Aplicar preset {u.cargo_titulo}
                          </button>
                        )}
                      </div>

                      <div className="space-y-4">
                        {Object.entries(permGrouped).map(([group, items]) => (
                          <div key={group}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                              {group}
                            </p>
                            <div className="space-y-1">
                              {items.map((perm) => (
                                <label
                                  key={perm.key}
                                  className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/30 cursor-pointer transition-colors"
                                >
                                  <div
                                    onClick={() => togglePermission(u.id, perm.key)}
                                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors cursor-pointer ${
                                      perms[perm.key]
                                        ? "border-primary bg-primary"
                                        : "border-border"
                                    }`}
                                  >
                                    {perms[perm.key] && <Check className="w-2.5 h-2.5 text-white" />}
                                  </div>
                                  <div className="flex-1 min-w-0" onClick={() => togglePermission(u.id, perm.key)}>
                                    <p className="text-xs font-medium">{perm.label}</p>
                                    <p className="text-[11px] text-muted-foreground">{perm.description}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botão confirmar aprovação */}
                    <button
                      onClick={() => handleApprove(u)}
                      disabled={isProcessing}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                      {isProcessing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Aprovar com {activeCount} permissão{activeCount !== 1 ? "ões" : ""}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
