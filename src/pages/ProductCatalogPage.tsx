import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  Repeat,
  ShoppingCart,
  Check,
  X,
  AlertCircle,
  Loader2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  BookOpen,
  Briefcase,
  GraduationCap,
  ChevronRight,
  ArrowLeft,
  Clock,
  LayoutGrid,
  List,
  ChevronDown,
  Users,
} from "lucide-react";
import {
  useProducts,
  PRODUCT_CATEGORIES,
  getCategoryConfig,
  type Product,
  type ProductMaterial,
  type ProductFormData,
  type BillingType,
  type MaterialType,
  type ProductTask,
} from "@/hooks/useProducts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MATERIAL_TYPE_CONFIG: Record<
  MaterialType,
  { label: string; color: string; Icon: React.ElementType }
> = {
  comercial:   { label: "Vendas",      color: "#f59e0b", Icon: Briefcase },
  operacional: { label: "Operacional", color: "#22c55e", Icon: BookOpen },
  treinamento: { label: "Treinamento", color: "#8b5cf6", Icon: GraduationCap },
};

function formatPrice(n: number): string {
  if (!n) return "—";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ categoryId }: { categoryId: string }) {
  const cat = getCategoryConfig(categoryId);
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
      style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
    >
      {cat.icon} {cat.label}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
      Disponível
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-secondary/60 text-muted-foreground">
      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 inline-block" />
      Inativo
    </span>
  );
}

// ─── Billing Badge ────────────────────────────────────────────────────────────

function BillingBadge({ billingType }: { billingType: BillingType }) {
  return billingType === "recurring" ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-green-500/12 text-green-400">
      <Repeat size={9} />
      Recorrente
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/12 text-amber-500">
      <ShoppingCart size={9} />
      One-time
    </span>
  );
}

// ─── Product Detail Panel ─────────────────────────────────────────────────────

// ─── Section wrapper — estilo V4: título grande + linha + conteúdo ─────────────

function Section({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-border/40">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <span>{emoji}</span>
          {title}
        </h2>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function ProductDetailPanel({
  product,
  onClose,
  onEdit,
}: {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
}) {
  const cat = getCategoryConfig(product.category);

  const grouped: Record<MaterialType, ProductMaterial[]> = {
    comercial:   (product.materials ?? []).filter((m) => m.type === "comercial"),
    operacional: (product.materials ?? []).filter((m) => m.type === "operacional"),
    treinamento: (product.materials ?? []).filter((m) => m.type === "treinamento"),
  };

  const hasMaterials = (product.materials ?? []).length > 0;
  const tasks: ProductTask[] = product.como_entrego_dados ?? [];

  // Group tasks by fase
  const tasksByFase = tasks.reduce<Record<string, ProductTask[]>>((acc, t) => {
    const key = t.fase || t.etapa || "Geral";
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  // Type labels for materials
  const MATERIAL_LABEL: Record<MaterialType, string> = {
    comercial: "Comercial",
    operacional: "Operacional",
    treinamento: "Treinamento",
  };

  return (
    <motion.div
      key="detail-panel"
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="absolute inset-0 z-10 flex flex-col bg-card overflow-hidden"
    >
      {/* ── Top bar ── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-card">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} />
          Painel de Portfólio
        </button>
        <ChevronRight size={13} className="text-border/60" />
        <span className="text-sm text-foreground/60 truncate flex-1">
          {product.name}
        </span>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors flex-shrink-0"
        >
          <Edit2 size={13} />
          Editar
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* ── Hero header ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full text-white"
                style={{ backgroundColor: cat.color }}
              >
                {cat.icon} {cat.label.toUpperCase()}
              </span>
              <StatusBadge active={product.active} />
              <BillingBadge billingType={product.billing_type} />
            </div>
            <h1 className="text-2xl font-bold text-foreground leading-tight">{product.name}</h1>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              {product.default_price > 0 && (
                <span className="font-semibold text-foreground text-lg">
                  {formatPrice(product.default_price)}
                </span>
              )}
              {product.duracao && (
                <span className="flex items-center gap-1.5">
                  <Clock size={13} />
                  {product.duracao}
                </span>
              )}
              {hasMaterials && (
                <span className="flex items-center gap-1.5">
                  <GraduationCap size={13} />
                  {(product.materials ?? []).length} materiais
                </span>
              )}
            </div>
          </div>

          {/* 1 ── Visão Geral ── */}
          {(product.descricao_card || product.description) && (
            <Section emoji="📋" title="Visão Geral">
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                {product.descricao_card || product.description}
              </p>
            </Section>
          )}

          {/* 2 ── Aspectos Técnicos ── */}
          {(product.escopo || product.formato_entrega) && (
            <Section emoji="⚙️" title="Aspectos Técnicos">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {product.escopo && (
                  <div>
                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-2">Escopo:</p>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {product.escopo}
                    </p>
                  </div>
                )}
                {product.formato_entrega && (
                  <div>
                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-2">Formato de entrega:</p>
                    <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                      {product.formato_entrega}
                    </p>
                  </div>
                )}
                {product.time_envolvido && (
                  <div className="md:col-span-2 rounded-xl border border-border/50 bg-secondary/20 p-4">
                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                      <Users size={11} /> Time envolvido:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {product.time_envolvido.split(",").map((p, i) => {
                        const nome = p.trim();
                        if (!nome) return null;
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center text-xs font-medium px-3 py-1 rounded-full bg-card border border-border/50 text-foreground/70"
                          >
                            {nome}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* 3 ── Informações para Vender ── */}
          {(product.como_vendo || product.para_quem_serve || product.como_entrega_valor) && (
            <Section emoji="🎯" title="Informações para Vender">
              <div className="space-y-5">
                {product.para_quem_serve && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pb-5 border-b border-border/40">
                    <div>
                      <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-2">Para quem serve</p>
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                        {product.para_quem_serve}
                      </p>
                    </div>
                    {product.como_entrega_valor && (
                      <div>
                        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-2">Como entregar valor</p>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                          {product.como_entrega_valor}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {product.como_vendo && (
                  <div>
                    <p className="text-xs font-semibold text-foreground/50 uppercase tracking-widest mb-2">"Como eu vendo?"</p>
                    <div className="rounded-xl border border-border/50 bg-secondary/10 px-4 py-4">
                      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                        {product.como_vendo}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* 4 ── Informações para Operar ── */}
          {product.o_que_entrego && (
            <Section emoji="🔧" title="Informações para Operar">
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                {product.o_que_entrego}
              </p>
            </Section>
          )}

          {/* 5 ── Estrutura do Produto ── */}
          {tasks.length > 0 && (
            <Section emoji="📌" title="Estrutura do Produto">
              <div className="space-y-5">
                {Object.entries(tasksByFase).map(([fase, faseTasks]) => (
                  <div key={fase}>
                    {/* Fase header — vermelho com indicador ● */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2 h-2 rounded-full bg-primary inline-block flex-shrink-0" />
                      <span className="text-sm font-bold text-foreground">{fase}</span>
                      <span className="text-xs text-muted-foreground/50">({faseTasks.length} etapas)</span>
                    </div>
                    <div className="space-y-2 pl-4">
                      {faseTasks.map((task, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-border/50 bg-card hover:bg-secondary/20 transition-colors"
                        >
                          <div className="w-5 h-5 rounded-full bg-secondary border border-border/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[9px] font-bold text-muted-foreground">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground/85 leading-snug">{task.tarefa}</p>
                            {task.etapa && task.etapa !== fase && (
                              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{task.etapa}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {task.estimativaHoras && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50 font-medium">
                                <Clock size={9} />
                                {task.estimativaHoras}h
                              </span>
                            )}
                            {task.comoExecutar && (
                              <a
                                href={task.comoExecutar}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors font-semibold"
                              >
                                <ExternalLink size={9} />
                                Como executar
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 6 ── Materiais ── separados por tipo, estilo V4 ── */}
          {hasMaterials && (
            <>
              {(["comercial", "operacional", "treinamento"] as MaterialType[]).map((type) => {
                const items = grouped[type];
                if (!items.length) return null;
                const sectionTitle =
                  type === "comercial" ? "Materiais de Vendas"
                  : type === "operacional" ? "Materiais Operacionais"
                  : "Materiais de Treinamento";
                const sectionEmoji =
                  type === "comercial" ? "💼"
                  : type === "operacional" ? "📄"
                  : "🎓";
                return (
                  <Section key={type} emoji={sectionEmoji} title={sectionTitle}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {items.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-xl border border-border/50 bg-card p-4 flex flex-col gap-2"
                        >
                          {/* Tags row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-flex items-center text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                                type === "comercial"
                                  ? "bg-primary text-white"
                                  : "bg-secondary/80 text-foreground/60 border border-border/60"
                              }`}
                            >
                              {MATERIAL_LABEL[type]}
                            </span>
                            <span className="inline-flex items-center text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-secondary/60 text-foreground/50 border border-border/40">
                              📄 {m.formato ?? "Material"}
                            </span>
                            <a
                              href={m.url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                            >
                              <ExternalLink size={13} />
                            </a>
                          </div>
                          {/* Name */}
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {m.name}
                          </p>
                          {/* Link */}
                          {m.url && (
                            <a
                              href={m.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:text-primary/80 transition-colors truncate"
                            >
                              {m.url}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </Section>
                );
              })}
            </>
          )}

        </div>
      </div>
    </motion.div>
  );
}

// ─── Product Form Drawer (create / edit) ─────────────────────────────────────
// Full-screen drawer with 7 section tabs — mirrors the product detail page

const FORM_TABS = [
  { id: "basico",    emoji: "📦", label: "Básico" },
  { id: "visao",     emoji: "📋", label: "Visão Geral" },
  { id: "tecnico",   emoji: "⚙️",  label: "Aspectos Técnicos" },
  { id: "vender",    emoji: "🎯", label: "Info. para Vender" },
  { id: "operar",    emoji: "🔧", label: "Info. para Operar" },
  { id: "estrutura", emoji: "📌", label: "Estrutura" },
  { id: "posicoes",  emoji: "👥", label: "Posições Alocadas" },
] as const;

type FormTab = typeof FORM_TABS[number]["id"];

interface ProductModalProps {
  initial?: Product | null;
  onSave: (data: ProductFormData, id?: string) => Promise<void>;
  onClose: () => void;
}

function ProductModal({ initial, onSave, onClose }: ProductModalProps) {
  const [activeTab, setActiveTab] = useState<FormTab>("basico");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [form, setForm] = useState<ProductFormData>(() =>
    initial
      ? {
          name:               initial.name,
          category:           initial.category,
          billing_type:       initial.billing_type,
          default_price:      initial.default_price,
          duracao:            initial.duracao ?? "",
          dono:               initial.dono ?? "",
          active:             initial.active,
          descricao_card:     initial.descricao_card ?? "",
          description:        initial.description ?? "",
          escopo:             initial.escopo ?? "",
          formato_entrega:    initial.formato_entrega ?? "",
          time_envolvido:     initial.time_envolvido ?? "",
          para_quem_serve:    initial.para_quem_serve ?? "",
          como_entrega_valor: initial.como_entrega_valor ?? "",
          como_vendo:         initial.como_vendo ?? "",
          o_que_entrego:      initial.o_que_entrego ?? "",
          como_entrego_dados_raw: initial.como_entrego_dados
            ? JSON.stringify(initial.como_entrego_dados, null, 2)
            : "",
        }
      : {
          name: "", category: "outros", billing_type: "recurring",
          default_price: 0, duracao: "", dono: "", active: true,
          descricao_card: "", description: "", escopo: "",
          formato_entrega: "", time_envolvido: "",
          para_quem_serve: "", como_entrega_valor: "",
          como_vendo: "", o_que_entrego: "", como_entrego_dados_raw: "",
        }
  );

  function set<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErr(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setErr("Nome obrigatório");
      setActiveTab("basico");
      return;
    }
    setSaving(true);
    try {
      await onSave(form, initial?.id);
      onClose();
    } catch (e) {
      setErr((e as Error).message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full bg-background border border-border/60 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/40 transition-shadow";
  const textareaCls = inputCls + " resize-none leading-relaxed";
  const labelCls = "block text-xs font-semibold text-muted-foreground/80 uppercase tracking-widest mb-2";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute inset-y-0 right-0 w-full max-w-3xl flex flex-col bg-card shadow-2xl border-l border-border/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Drawer header ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package size={16} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                {initial ? "Editar Produto" : "Novo Produto"}
              </h2>
              {form.name && (
                <p className="text-xs text-muted-foreground truncate max-w-xs">{form.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {err && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle size={12} />
                {err}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* ── Sidebar tabs ── */}
          <div className="flex-shrink-0 w-44 border-r border-border/40 py-4 flex flex-col gap-0.5 bg-secondary/20">
            {FORM_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors rounded-none text-left w-full ${
                  activeTab === tab.id
                    ? "bg-card text-foreground border-r-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                <span className="text-base leading-none">{tab.emoji}</span>
                <span className="leading-tight">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ── Form content ── */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">

              {/* ── Tab: Básico ── */}
              {activeTab === "basico" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold mb-1">📦 Informações Básicas</h3>
                    <p className="text-sm text-muted-foreground">Nome, categoria, tipo de receita e preço.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Nome do produto *</label>
                    <input
                      autoFocus
                      className={inputCls}
                      placeholder="Ex: Gestão de Mídia Paga"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Categoria</label>
                      <select
                        className={inputCls}
                        value={form.category}
                        onChange={(e) => set("category", e.target.value)}
                      >
                        {PRODUCT_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Duração</label>
                      <input
                        className={inputCls}
                        placeholder="Ex: 4 Semanas"
                        value={form.duracao ?? ""}
                        onChange={(e) => set("duracao", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Tipo de receita</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => set("billing_type", "recurring")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                          form.billing_type === "recurring"
                            ? "bg-green-500/15 border-green-500/40 text-green-600"
                            : "border-border/60 text-muted-foreground hover:bg-secondary/60"
                        }`}
                      >
                        <Repeat size={13} /> Recorrente (MRR)
                      </button>
                      <button
                        type="button"
                        onClick={() => set("billing_type", "one_time")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                          form.billing_type === "one_time"
                            ? "bg-amber-500/15 border-amber-500/40 text-amber-600"
                            : "border-border/60 text-muted-foreground hover:bg-secondary/60"
                        }`}
                      >
                        <ShoppingCart size={13} /> One-time
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Preço (R$)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                        <input
                          type="number" min={0} step={0.01}
                          className={inputCls + " pl-8"}
                          placeholder="0,00"
                          value={form.default_price || ""}
                          onChange={(e) => set("default_price", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {form.billing_type === "recurring" ? "Valor/mês" : "Valor único"}
                      </p>
                    </div>
                    <div>
                      <label className={labelCls}>Dono / Responsável</label>
                      <input
                        className={inputCls}
                        placeholder="Ex: Rafael Corazza"
                        value={form.dono ?? ""}
                        onChange={(e) => set("dono", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-secondary/30 border border-border/40">
                    <div>
                      <p className="text-sm font-medium">Produto ativo</p>
                      <p className="text-xs text-muted-foreground">Visível no catálogo e projetos</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => set("active", !form.active)}
                      className={`transition-colors ${form.active ? "text-green-500" : "text-muted-foreground/40"}`}
                    >
                      {form.active ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                    </button>
                  </div>
                </div>
              )}

              {/* ── Tab: Visão Geral ── */}
              {activeTab === "visao" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold mb-1">📋 Visão Geral</h3>
                    <p className="text-sm text-muted-foreground">Descrição resumida exibida no card do catálogo e no topo da página do produto.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Descrição do card (resumo)</label>
                    <textarea
                      className={textareaCls}
                      rows={5}
                      placeholder="Descreva o produto de forma objetiva. Este texto aparece nos cards do catálogo e no início da página do produto."
                      value={form.descricao_card ?? ""}
                      onChange={(e) => set("descricao_card", e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground/60 mt-1">Texto exibido na Visão Geral da página do produto.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Descrição interna (opcional)</label>
                    <textarea
                      className={textareaCls}
                      rows={3}
                      placeholder="Descrição adicional para uso interno..."
                      value={form.description ?? ""}
                      onChange={(e) => set("description", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* ── Tab: Aspectos Técnicos ── */}
              {activeTab === "tecnico" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold mb-1">⚙️ Aspectos Técnicos</h3>
                    <p className="text-sm text-muted-foreground">Escopo, formato de entrega e equipe envolvida.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Escopo</label>
                    <textarea
                      className={textareaCls}
                      rows={6}
                      placeholder="Descreva o que está incluído no escopo deste produto. Ex: Semana 1 - Onboarding e Alinhamento..."
                      value={form.escopo ?? ""}
                      onChange={(e) => set("escopo", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Formato de entrega</label>
                    <textarea
                      className={textareaCls}
                      rows={5}
                      placeholder="Como o produto é entregue ao cliente? Ex: Apresentação de diagnóstico + Playbook de Vendas..."
                      value={form.formato_entrega ?? ""}
                      onChange={(e) => set("formato_entrega", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* ── Tab: Informações para Vender ── */}
              {activeTab === "vender" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold mb-1">🎯 Informações para Vender</h3>
                    <p className="text-sm text-muted-foreground">Para quem é, como vender e como entrega valor ao cliente.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Para quem serve</label>
                    <textarea
                      className={textareaCls}
                      rows={5}
                      placeholder="Perfil do cliente ideal. Ex: PMEs com operação ativa buscando performance..."
                      value={form.para_quem_serve ?? ""}
                      onChange={(e) => set("para_quem_serve", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>"Como eu vendo?" — Argumento de venda</label>
                    <textarea
                      className={textareaCls}
                      rows={6}
                      placeholder="Como abordar este produto na venda consultiva? Gatilhos, argumentos de autoridade, urgência..."
                      value={form.como_vendo ?? ""}
                      onChange={(e) => set("como_vendo", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Como entrega valor</label>
                    <textarea
                      className={textareaCls}
                      rows={4}
                      placeholder="Qual o impacto real para o cliente? Ex: Redução do CAC, aumento de conversão..."
                      value={form.como_entrega_valor ?? ""}
                      onChange={(e) => set("como_entrega_valor", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* ── Tab: Informações para Operar ── */}
              {activeTab === "operar" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold mb-1">🔧 Informações para Operar</h3>
                    <p className="text-sm text-muted-foreground">Como a equipe executa este produto internamente.</p>
                  </div>
                  <div>
                    <label className={labelCls}>O que entrego / Como executo</label>
                    <textarea
                      className={textareaCls}
                      rows={10}
                      placeholder="Descreva como o time executa este produto internamente. Metodologia, ferramentas, dinâmica de trabalho..."
                      value={form.o_que_entrego ?? ""}
                      onChange={(e) => set("o_que_entrego", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* ── Tab: Estrutura do Produto ── */}
              {activeTab === "estrutura" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold mb-1">📌 Estrutura do Produto</h3>
                    <p className="text-sm text-muted-foreground">Etapas e tarefas de execução. Cole o JSON das tarefas abaixo.</p>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-secondary/20 p-4 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Formato esperado:</p>
                    <pre className="text-[10px] text-muted-foreground/70 leading-relaxed overflow-x-auto">{`[
  {
    "fase": "Semana 1",
    "etapa": "Preparação",
    "tarefa": "Setup de Acessos",
    "dri": "Especialista",
    "estimativaHoras": "0.5",
    "comoExecutar": "https://..."
  }
]`}</pre>
                  </div>
                  <div>
                    <label className={labelCls}>Tarefas (JSON)</label>
                    <textarea
                      className={textareaCls + " font-mono text-xs"}
                      rows={14}
                      placeholder='[{"fase": "Semana 1", "etapa": "Preparação", "tarefa": "...", "dri": "", "estimativaHoras": "1", "comoExecutar": ""}]'
                      value={form.como_entrego_dados_raw ?? ""}
                      onChange={(e) => set("como_entrego_dados_raw", e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      Deixe vazio para não exibir a seção "Estrutura do Produto".
                    </p>
                  </div>
                </div>
              )}

              {/* ── Tab: Posições Alocadas ── */}
              {activeTab === "posicoes" && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold mb-1">👥 Posições Alocadas</h3>
                    <p className="text-sm text-muted-foreground">Quais funções/cargos executam este produto.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Time envolvido (separado por vírgula)</label>
                    <textarea
                      className={textareaCls}
                      rows={4}
                      placeholder="Ex: Account Manager, Gerente de PE&G, Consultor Especialista, Profissional de Sales Enablement"
                      value={form.time_envolvido ?? ""}
                      onChange={(e) => set("time_envolvido", e.target.value)}
                    />
                    {form.time_envolvido && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {form.time_envolvido.split(",").map((p, i) => {
                          const nome = p.trim();
                          if (!nome) return null;
                          return (
                            <span key={i} className="inline-flex items-center text-xs font-medium px-3 py-1 rounded-full bg-secondary border border-border/50 text-foreground/70">
                              {nome}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* ── Footer ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-t border-border/40 bg-card">
              {/* Tab navigation */}
              <div className="flex items-center gap-2">
                {activeTab !== "basico" && (
                  <button
                    type="button"
                    onClick={() => {
                      const idx = FORM_TABS.findIndex(t => t.id === activeTab);
                      if (idx > 0) setActiveTab(FORM_TABS[idx - 1].id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                  >
                    <ArrowLeft size={13} /> Anterior
                  </button>
                )}
                {activeTab !== "posicoes" && (
                  <button
                    type="button"
                    onClick={() => {
                      const idx = FORM_TABS.findIndex(t => t.id === activeTab);
                      if (idx < FORM_TABS.length - 1) setActiveTab(FORM_TABS[idx + 1].id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/60 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
                  >
                    Próxima <ChevronRight size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl border border-border/60 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <><Loader2 size={14} className="animate-spin" /> Salvando…</>
                  ) : (
                    <><Check size={14} /> {initial ? "Salvar alterações" : "Criar produto"}</>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ProductCatalogPage() {
  const { products, loading, error, saveProduct, deleteProduct, toggleActive } =
    useProducts();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null | undefined>(undefined);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterBilling, setFilterBilling] = useState<BillingType | "">("");
  const [filterStatus, setFilterStatus] = useState<"" | "active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q);
        const matchCat = !filterCategory || p.category === filterCategory;
        const matchBilling = !filterBilling || p.billing_type === filterBilling;
        const matchStatus =
          !filterStatus ||
          (filterStatus === "active" ? p.active : !p.active);
        return matchSearch && matchCat && matchBilling && matchStatus;
      }),
    [products, search, filterCategory, filterBilling, filterStatus]
  );

  // Group by category for display
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((p) => {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    });
    return map;
  }, [filtered]);

  function handleEditFromDetail(product: Product) {
    setEditingProduct(product);
  }

  const selectCls =
    "h-10 bg-background border border-border/60 rounded-xl px-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none cursor-pointer";

  return (
    <div className="relative flex flex-col h-full gap-4 overflow-hidden">

      {/* ── Catalog view ── */}
      <AnimatePresence>
        {!selectedProduct && (
          <motion.div
            key="catalog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col h-full gap-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0">
              <h1 className="text-2xl font-bold">Painel de Portfólio</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Central de acompanhamento dos produtos e serviços cadastrados.
              </p>
            </div>

            {/* Filter bar */}
            <div className="flex-shrink-0 flex items-center gap-2">

              {/* Search */}
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  className="h-10 bg-background border border-border/60 rounded-xl pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/50 w-52"
                  placeholder="Buscar por produto ou desc..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Categoria dropdown */}
              <div className="relative">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className={selectCls + " w-44"}
                >
                  <option value="">Todas categorias</option>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>

              {/* Status dropdown */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as "" | "active" | "inactive")}
                  className={selectCls + " w-36"}
                >
                  <option value="active">Disponível</option>
                  <option value="">Todos status</option>
                  <option value="inactive">Inativo</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>

              {/* Tipo dropdown */}
              <div className="relative">
                <select
                  value={filterBilling}
                  onChange={(e) => setFilterBilling(e.target.value as BillingType | "")}
                  className={selectCls + " w-32"}
                >
                  <option value="">Todos</option>
                  <option value="recurring">Recorrente</option>
                  <option value="one_time">One-time</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>

              <div className="flex-1" />

              {/* View toggle */}
              <div className="flex items-center rounded-xl border border-border/60 overflow-hidden">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`flex items-center gap-1.5 px-3 h-10 text-sm font-medium transition-colors ${
                    viewMode === "cards"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <LayoutGrid size={14} />
                  Cards
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 h-10 text-sm font-medium transition-colors ${
                    viewMode === "list"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <List size={14} />
                  Lista
                </button>
              </div>

              {/* New product button */}
              <button
                onClick={() => setEditingProduct(null)}
                className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3.5 h-10 text-sm font-medium hover:bg-primary/90 transition-colors flex-shrink-0"
              >
                <Plus size={14} />
                Novo
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={28} className="animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Carregando catálogo...</p>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && products.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Package size={48} className="mx-auto text-muted-foreground/20 mb-4" />
                  <p className="text-base font-semibold text-muted-foreground">
                    Nenhum produto cadastrado
                  </p>
                  <p className="text-sm text-muted-foreground/60 mt-1 mb-5">
                    Crie seu primeiro produto ou importe do V4 Product Compass
                  </p>
                  <button
                    onClick={() => setEditingProduct(null)}
                    className="flex items-center gap-2 mx-auto px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Plus size={14} />
                    Novo Produto
                  </button>
                </div>
              </div>
            )}

            {/* No filter results */}
            {!loading && products.length > 0 && filtered.length === 0 && (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Nenhum produto encontrado para os filtros aplicados
                </p>
              </div>
            )}

            {/* Product list grouped by category */}
            {!loading && filtered.length > 0 && (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-6 pr-0.5">
                {PRODUCT_CATEGORIES.filter((cat) => grouped.has(cat.id)).map((cat) => {
                  const items = grouped.get(cat.id) ?? [];
                  return (
                    <div key={cat.id}>
                      {/* Category header */}
                      <div
                        className="flex items-center gap-2 mb-3 pb-2 border-b"
                        style={{ borderColor: `${cat.color}30` }}
                      >
                        <span
                          className="w-6 h-6 rounded-md flex items-center justify-center text-sm"
                          style={{ backgroundColor: `${cat.color}20` }}
                        >
                          {cat.icon}
                        </span>
                        <h3
                          className="text-xs font-bold uppercase tracking-wider"
                          style={{ color: cat.color }}
                        >
                          {cat.label}
                        </h3>
                        <span className="text-[10px] text-muted-foreground/50">
                          {items.length} produto{items.length !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Cards view */}
                      {viewMode === "cards" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {items.map((product) => (
                            <motion.div
                              key={product.id}
                              layout
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => setSelectedProduct(product)}
                              className={`glass border rounded-2xl p-5 flex flex-col gap-3 cursor-pointer group transition-all ${
                                !product.active ? "opacity-50" : ""
                              }`}
                              style={{ borderColor: `${cat.color}22` }}
                              whileHover={{ borderColor: `${cat.color}55`, y: -2, boxShadow: "0 8px 24px 0 rgba(0,0,0,0.08)" }}
                            >
                              {/* Top row: billing + actions */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <BillingBadge billingType={product.billing_type} />
                                  {!product.active && <StatusBadge active={false} />}
                                </div>
                                <div
                                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => toggleActive(product.id, !product.active)}
                                    className="p-1.5 rounded-lg hover:bg-secondary/80 transition-colors"
                                    title={product.active ? "Desativar" : "Ativar"}
                                  >
                                    {product.active ? (
                                      <ToggleRight size={15} className="text-green-400" />
                                    ) : (
                                      <ToggleLeft size={15} className="text-muted-foreground/40" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setEditingProduct(product)}
                                    className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                                    title="Editar"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => setDeletingProduct(product)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                              {/* Name */}
                              <p className={`text-sm font-bold leading-snug ${!product.active ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {product.name}
                              </p>
                              {/* Preview */}
                              {(product.descricao_card || product.description) && (
                                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                                  {product.descricao_card || product.description}
                                </p>
                              )}
                              {/* Bottom row */}
                              <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/30">
                                <div className="flex items-center gap-3">
                                  {product.default_price > 0 && (
                                    <span className="text-sm font-bold text-foreground">{formatPrice(product.default_price)}</span>
                                  )}
                                  {product.duracao && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                                      <Clock size={9} />
                                      {product.duracao}
                                    </span>
                                  )}
                                  {(product.materials ?? []).length > 0 && (
                                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                                      <GraduationCap size={9} />
                                      {product.materials!.length}
                                    </span>
                                  )}
                                </div>
                                <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground/70 transition-colors" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* List view */}
                      {viewMode === "list" && (
                        <div className="space-y-0.5">
                          {items.map((product) => (
                            <motion.div
                              key={product.id}
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              onClick={() => setSelectedProduct(product)}
                              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer group hover:bg-secondary/30 transition-all ${
                                !product.active ? "opacity-50" : ""
                              }`}
                              style={{ borderColor: `${cat.color}20` }}
                            >
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium truncate ${!product.active ? "line-through text-muted-foreground" : ""}`}>
                                  {product.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <BillingBadge billingType={product.billing_type} />
                                {product.default_price > 0 && (
                                  <span className="text-sm font-bold w-24 text-right">{formatPrice(product.default_price)}</span>
                                )}
                                {(product.materials ?? []).length > 0 && (
                                  <span className="text-[10px] text-muted-foreground/50 w-12 text-right">
                                    {product.materials!.length} mat.
                                  </span>
                                )}
                                <div
                                  className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    onClick={() => toggleActive(product.id, !product.active)}
                                    className="p-1.5 rounded-lg hover:bg-secondary/80 transition-colors"
                                    title={product.active ? "Desativar" : "Ativar"}
                                  >
                                    {product.active ? (
                                      <ToggleRight size={14} className="text-green-400" />
                                    ) : (
                                      <ToggleLeft size={14} className="text-muted-foreground/40" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setEditingProduct(product)}
                                    className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => setDeletingProduct(product)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Detail Panel (overlays the catalog) ── */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailPanel
            key={selectedProduct.id}
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onEdit={() => handleEditFromDetail(selectedProduct)}
          />
        )}
      </AnimatePresence>

      {/* ── Modal criar/editar ── */}
      <AnimatePresence>
        {editingProduct !== undefined && (
          <ProductModal
            key="product-modal"
            initial={editingProduct}
            onSave={saveProduct}
            onClose={() => setEditingProduct(undefined)}
          />
        )}
      </AnimatePresence>

      {/* ── Confirmação de exclusão ── */}
      <AnimatePresence>
        {deletingProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
            onClick={() => setDeletingProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="glass border border-border/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Trash2 size={18} className="text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Excluir produto</p>
                  <p className="text-xs text-muted-foreground">
                    Esta ação não pode ser desfeita
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-5">
                Excluir{" "}
                <span className="font-semibold text-foreground">
                  {deletingProduct.name}
                </span>
                ? Projetos existentes não serão afetados.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setDeletingProduct(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/60 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    await deleteProduct(deletingProduct.id);
                    setDeletingProduct(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
