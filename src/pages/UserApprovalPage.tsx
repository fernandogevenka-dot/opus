// Tela de aprovação de usuários — visível apenas para admin/gerencia_peg/coord_admin
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { Check, X, Clock, Users, RefreshCw, ChevronDown } from "lucide-react";
import type { OpusRole } from "@/types";

interface PendingUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string;
  funcao: string | null;
  opus_role: OpusRole;
  approval_status: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  gerencia_peg: "Gerência PE&G",
  coord_admin: "Coordenador Administrativo",
  coord_peg: "Coordenador PE&G",
  colaborador: "Colaborador",
};

const APPROVABLE_ROLES: { value: OpusRole; label: string }[] = [
  { value: "gerencia_peg", label: "Gerência PE&G" },
  { value: "coord_admin", label: "Coordenador Administrativo" },
  { value: "coord_peg", label: "Coordenador PE&G" },
  { value: "colaborador", label: "Colaborador" },
];

export function UserApprovalPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);
  const [roleOverride, setRoleOverride] = useState<Record<string, OpusRole>>({});
  const [openRoleDropdown, setOpenRoleDropdown] = useState<string | null>(null);

  async function loadUsers() {
    setLoading(true);
    let query = supabase
      .from("users")
      .select("id, name, email, avatar_url, funcao, opus_role, approval_status, created_at")
      .order("created_at", { ascending: true });

    if (filter !== "all") {
      query = query.eq("approval_status", filter);
    }

    const { data, error } = await query;
    if (error) console.error("[UserApproval] load error:", error);
    setUsers((data as PendingUser[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, [filter]);

  async function handleApprove(targetUser: PendingUser) {
    const finalRole = roleOverride[targetUser.id] ?? targetUser.opus_role ?? "colaborador";
    setProcessing(targetUser.id);
    const { error } = await supabase
      .from("users")
      .update({
        approval_status: "approved",
        opus_role: finalRole,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", targetUser.id);
    if (error) console.error("[UserApproval] approve error:", error);
    setProcessing(null);
    loadUsers();
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
  }

  const pendingCount = users.filter((u) => u.approval_status === "pending").length;

  return (
    <div className="h-full flex flex-col gap-4 p-4 md:p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Aprovação de Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie o acesso dos membros da equipe ao Opus
          </p>
        </div>
        <button
          onClick={loadUsers}
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
          <span className="text-2xl font-bold tracking-tight text-yellow-500">
            {users.filter((u) => filter === "all" ? u.approval_status === "pending" : u.approval_status === "pending").length === 0 && filter !== "pending"
              ? pendingCount
              : users.filter((u) => u.approval_status === "pending").length}
          </span>
        </div>
        <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Aprovados</span>
          <span className="text-2xl font-bold tracking-tight text-green-500">
            {users.filter((u) => u.approval_status === "approved").length}
          </span>
        </div>
        <div className="rounded-2xl border border-border/50 bg-background shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Rejeitados</span>
          <span className="text-2xl font-bold tracking-tight text-red-500">
            {users.filter((u) => u.approval_status === "rejected").length}
          </span>
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
            {f === "pending" && pendingCount > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          Carregando...
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
          <Users className="w-10 h-10 opacity-30" />
          <p className="text-sm">Nenhum usuário nesta categoria</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isProcessing = processing === u.id;
            const selectedRole = roleOverride[u.id] ?? u.opus_role ?? "colaborador";
            const isDropdownOpen = openRoleDropdown === u.id;

            return (
              <div
                key={u.id}
                className="flex items-center gap-4 p-4 rounded-2xl border border-border/50 bg-background"
              >
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
                  <p className="text-sm font-medium truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.funcao && (
                    <p className="text-xs text-muted-foreground/70">{u.funcao}</p>
                  )}
                </div>

                {/* Status badge */}
                <div className="flex-shrink-0">
                  {u.approval_status === "pending" && (
                    <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" />
                      Pendente
                    </span>
                  )}
                  {u.approval_status === "approved" && (
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                      <Check className="w-3 h-3" />
                      Aprovado
                    </span>
                  )}
                  {u.approval_status === "rejected" && (
                    <span className="flex items-center gap-1 text-xs text-red-600 bg-red-500/10 px-2 py-1 rounded-full">
                      <X className="w-3 h-3" />
                      Rejeitado
                    </span>
                  )}
                </div>

                {/* Role selector (for pending/rejected) */}
                {(u.approval_status === "pending" || u.approval_status === "rejected") && (
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setOpenRoleDropdown(isDropdownOpen ? null : u.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 text-xs hover:bg-muted/30 transition-colors"
                    >
                      {ROLE_LABELS[selectedRole] ?? selectedRole}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {isDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1 bg-background border border-border/50 rounded-xl shadow-lg z-50 min-w-[200px] py-1">
                        {APPROVABLE_ROLES.map((r) => (
                          <button
                            key={r.value}
                            onClick={() => {
                              setRoleOverride((prev) => ({ ...prev, [u.id]: r.value }));
                              setOpenRoleDropdown(null);
                            }}
                            className={`w-full text-left px-4 py-2 text-xs hover:bg-muted/30 transition-colors ${
                              selectedRole === r.value ? "text-primary font-medium" : ""
                            }`}
                          >
                            {r.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
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
                        onClick={() => handleApprove(u)}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Aprovar
                      </button>
                    </>
                  )}
                  {(u.approval_status === "approved" || u.approval_status === "rejected") && u.id !== user?.id && (
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
            );
          })}
        </div>
      )}
    </div>
  );
}
