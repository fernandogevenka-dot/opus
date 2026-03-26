import { useState } from "react";
import { useWiki } from "@/hooks/useWiki";
import { WikiEditor } from "@/components/wiki/WikiEditor";
import { ClientsPanel } from "@/components/wiki/ClientsPanel";
import { InvestidoresPanel } from "@/components/wiki/InvestidoresPanel";
import { AISearchBar } from "@/components/wiki/AISearchBar";
import {
  BookOpen, Plus, ChevronRight,
  Trash2, Edit3, Database, ChevronDown, Home, TrendingUp,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";

// ── Estrutura estática espelhando o Notion ──────────────────────────────────
interface StaticSection {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  tag?: string;
  children?: StaticSection[];
}

const STATIC_WIKI: StaticSection[] = [
  {
    id: "home",
    icon: "🏭",
    title: "Oxicore | Execução Tática 2026",
    subtitle: "Unidade sócia da matriz. Execução disciplinada do modelo V4.",
  },
  {
    id: "excelencia",
    icon: "🏛️",
    title: "Excelência Operacional",
    subtitle: "Onde a execução acontece com padrão.",
    tag: "NÚCLEO",
    children: [
      { id: "saber",         icon: "🦉", title: "S — SABER" },
      { id: "ter",           icon: "🛠️", title: "T — TER" },
      { id: "executar",      icon: "⚙️", title: "E — EXECUTAR" },
      { id: "potencializar", icon: "📈", title: "P — POTENCIALIZAR" },
      { id: "clientes",      icon: "👥", title: "Nossos Clientes" },
    ],
  },
  {
    id: "receita",
    icon: "🎯",
    title: "Receita (Aquisição + Expansão)",
    subtitle: "Crescer é obrigatório. Crescemos dentro do modelo — não fora dele.",
    tag: "MOTOR",
    children: [
      { id: "aquisicao", icon: "🧲", title: "Aquisição" },
      { id: "expansao",  icon: "📈", title: "Expansão" },
    ],
  },
  {
    id: "governanca",
    icon: "⚙️",
    title: "Governança & Eficiência | Gente & Cultura",
    subtitle: "Estrutura que protege margem, ritmo e escala.",
    tag: "HABILITADOR",
    children: [
      { id: "investidores", icon: "💼", title: "Nossos Investidores" },
    ],
  },
];

// ── Conteúdo estático de cada seção ────────────────────────────────────────
const STATIC_CONTENT: Record<string, React.ReactNode> = {
  home: (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-3">
          <span className="text-2xl">👋</span>
          <div>
            <p className="font-semibold text-sm mb-1">Bem-vindo à equipe V4 Oxicore!</p>
            <p className="text-sm text-muted-foreground">Esse é o Sistema de execução tática da unidade V4 Oxicore.</p>
            <p className="text-sm text-muted-foreground">Ele organiza como pensamos, decidimos e executamos.</p>
            <p className="text-sm text-muted-foreground mt-2">Aplicação prática do EMPS. Operação como Single Entity.</p>
            <p className="text-sm mt-3 font-medium text-foreground/90">Toda iniciativa precisa estar dentro desta arquitetura.</p>
            <p className="text-sm font-bold text-primary/90 mt-1">Tudo que não fortalece Excelência Operacional, Receita ou Habilitadores será descartado, pois nos afasta da meta.</p>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🎯</span>
          <h3 className="font-bold text-sm uppercase tracking-wide">DIREÇÃO 2026</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Horizonte atual", "H4"],
            ["Meta 2026", "H5"],
            ["Receita anual alvo", "R$ 25.529.352,82"],
            ["Foco", "Escalar com eficiência"],
          ].map(([label, value]) => (
            <div key={label} className="bg-background/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
              <p className="text-sm font-semibold">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">🧠 NÚCLEO DO SISTEMA</p>
        <div className="space-y-3">
          {[
            { icon: "🏛️", title: "Excelência Operacional", desc: "Onde a execução acontece com padrão. Entrega com padrão. Margem protegida. Retenção consequência da execução.", tag: "NÚCLEO", color: "bg-purple-500/10 border-purple-500/20 text-purple-300" },
            { icon: "🎯", title: "Receita (Aquisição + Expansão)", desc: "Crescer é obrigatório. Crescemos dentro do modelo — não fora dele. Gera fluxo previsível.", tag: "MOTOR", color: "bg-green-500/10 border-green-500/20 text-green-300" },
            { icon: "⚙️", title: "Governança & Eficiência | Gente & Cultura", desc: "Estrutura não aparece — mas sustenta tudo. Dão ritmo ao sistema. Operar como Single Entity.", tag: "HABILITADOR", color: "bg-orange-500/10 border-orange-500/20 text-orange-300" },
          ].map((s) => (
            <div key={s.title} className={`flex items-start gap-3 p-3 rounded-xl border ${s.color}`}>
              <span className="text-xl mt-0.5">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{s.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-background/40 font-bold tracking-wide">{s.tag}</span>
                </div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),

  excelencia: (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
        <p className="text-sm font-semibold mb-1">Entrega com padrão. Margem protegida. Retenção consequente.</p>
        <p className="text-sm text-muted-foreground">Transformar o STEP em LTV sustentável.</p>
      </div>
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🎯</span>
          <h3 className="font-bold text-sm uppercase tracking-wide">DIREÇÃO DA EXCELÊNCIA 2026</h3>
        </div>
        <div className="space-y-2">
          {["Churn alvo", "Receita por HC alvo", "SLA de onboarding", "% clientes com KPI formal", "Meta de conversão SABER → EXECUTAR"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm p-2.5 rounded-xl bg-background/40">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">1️⃣ 🔄 JORNADA STEP</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "🦉", label: "S — SABER" },
            { icon: "🛠️", label: "T — TER" },
            { icon: "⚙️", label: "E — EXECUTAR" },
            { icon: "📈", label: "P — POTENCIALIZAR" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2 p-3 rounded-xl bg-background/40 border border-border/20">
              <span className="text-xl">{s.icon}</span>
              <span className="text-sm font-medium">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),

  receita: (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
        <p className="text-sm font-semibold mb-1">Venda com critério. Booking responsável. Crescimento disciplinado.</p>
        <p className="text-sm text-muted-foreground">Aplicação fiel do STEP na geração de receita previsível.</p>
      </div>
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🎯</span>
          <h3 className="font-bold text-sm uppercase tracking-wide">DIREÇÃO DA RECEITA 2026</h3>
        </div>
        <div className="space-y-2">
          {["Booking alvo (novo + expansão)", "Ticket médio alvo", "% vendas dentro do ICP", "% vendas no STEP correto", "Expansão apenas em clientes saudáveis", "Previsibilidade mensal de pipeline"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm p-2.5 rounded-xl bg-background/40">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">🔁 FLUXO DE GERAÇÃO DE RECEITA</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-background/40 border border-border/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🧲</span>
              <span className="text-sm font-semibold">Aquisição</span>
            </div>
            <ul className="space-y-1">
              {["Geração de demanda", "Qualificação ICP", "Venda no STEP correto", "Handoff validado"].map((i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />{i}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3 rounded-xl bg-background/40 border border-border/20">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📈</span>
              <span className="text-sm font-semibold">Expansão</span>
            </div>
            <ul className="space-y-1">
              {["Base ativa saudável", "Conversão SABER → EXECUTAR", "Crescimento com margem", "Variável alinhado à retenção"].map((i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />{i}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  ),

  governanca: (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
        <p className="text-sm font-semibold mb-1">Disciplina estrutural. Dados acima de opinião.</p>
        <p className="text-sm text-muted-foreground">Operar como Single Entity. Estrutura que protege margem, ritmo e escala.</p>
      </div>
      <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🎯</span>
          <h3 className="font-bold text-sm uppercase tracking-wide">DIREÇÃO 2026</h3>
        </div>
        <div className="space-y-2">
          {["Forecast mensal confiável", "Receita por HC saudável", "Pipeline de liderança estruturado", "Ritmo de contratação disciplinado"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm p-2.5 rounded-xl bg-background/40">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500/60 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),

  saber:         <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 text-sm text-muted-foreground">Fase S do STEP: garantir que o cliente saiba o que precisa fazer para atingir o resultado. Diagnóstico claro, mapeamento e definição de KPIs.</div>,
  ter:           <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 text-sm text-muted-foreground">Fase T do STEP: garantir que o cliente tenha as ferramentas, recursos e processos necessários para executar.</div>,
  executar:      <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 text-sm text-muted-foreground">Fase E do STEP: garantir que o cliente execute o que foi planejado, com acompanhamento e ajustes em tempo real.</div>,
  potencializar: <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 text-sm text-muted-foreground">Fase P do STEP: maximizar resultados, expandir o escopo e transformar resultado em LTV sustentável.</div>,
  clientes:      <ClientsPanel />,
  aquisicao:     <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 text-sm text-muted-foreground">Processo de geração de demanda e fechamento de novos clientes dentro do ICP, seguindo o STEP correto.</div>,
  expansao:      <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 text-sm text-muted-foreground">Crescimento em base ativa saudável. Conversão SABER → EXECUTAR e upsell com margem protegida.</div>,
  investidores:  <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 text-sm text-muted-foreground">Registro dos investidores da Oxicore e suas participações na operação.</div>,
};

const TAG_COLORS: Record<string, string> = {
  NÚCLEO:      "bg-purple-500/20 text-purple-300",
  MOTOR:       "bg-green-500/20 text-green-300",
  HABILITADOR: "bg-orange-500/20 text-orange-300",
};

// ── Growth & Performance Panel ─────────────────────────────────────────────

function GrowthPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20 px-8">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <TrendingUp size={28} className="text-primary/60" />
      </div>
      <h2 className="text-lg font-bold mb-2">Growth & Performance</h2>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
        Em breve — integração com o software de performance em desenvolvimento.
      </p>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
type WikiTab = "knowledge" | "clients" | "growth";
export function WikiPage() {
  const [activeTab, setActiveTab] = useState<WikiTab>("knowledge");
  // (GrowthPanel tem estado próprio de OKR aberto, sem necessidade de estado aqui)
  const [activeSectionId, setActiveSectionId] = useState<string>("home");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["excelencia", "receita", "governanca"]));
  const [editingPage, setEditingPage] = useState<string | "new" | null>(null);
  const {
    pages, activePage, loading, aiAnswer, aiSearching, searchResults,
    loadPage, savePage, deletePage, aiSearch, setActivePage,
  } = useWiki();

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startNewPage() {
    setActivePage(null);
    setEditingPage("new");
  }

  async function handleSave(title: string, content: unknown, icon: string) {
    await savePage(editingPage === "new" ? null : editingPage!, title, content, null, icon);
    setEditingPage(null);
  }

  const activeSection = findSection(STATIC_WIKI, activeSectionId);

  return (
    <div className="flex h-full gap-4">
      {/* ── Sidebar ── */}
      <div className="w-60 flex-shrink-0 flex flex-col gap-2">
        {/* Tabs */}
        <div className="flex gap-1 mb-1">
          <button
            onClick={() => setActiveTab("knowledge")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === "knowledge" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <BookOpen size={12} />
            Base
          </button>
          <button
            onClick={() => setActiveTab("growth")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === "growth" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <TrendingUp size={12} />
            Growth
          </button>
          <button
            onClick={() => setActiveTab("clients")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-colors ${
              activeTab === "clients" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <Database size={12} />
            Clientes
          </button>
        </div>

        {activeTab === "knowledge" && (
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {/* Static Notion-mirrored tree */}
            {STATIC_WIKI.map((section) => (
              <SidebarItem
                key={section.id}
                section={section}
                activeSectionId={activeSectionId}
                expandedIds={expandedIds}
                onSelect={(id) => { setActiveSectionId(id); setEditingPage(null); setActiveTab("knowledge"); }}
                onToggle={toggleExpand}
                depth={0}
              />
            ))}

            {/* Divider + custom pages */}
            <div className="border-t border-border/30 my-2 pt-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 mb-1">Páginas personalizadas</p>
              {loading ? (
                <div className="space-y-1.5">
                  {[1, 2].map((i) => <div key={i} className="h-7 bg-secondary/40 rounded-lg animate-pulse" />)}
                </div>
              ) : pages.length === 0 ? (
                <button
                  onClick={startNewPage}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  <Plus size={12} /> Nova página
                </button>
              ) : (
                <>
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => { loadPage(page.id); setActiveSectionId("__custom"); setEditingPage(null); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-left transition-colors ${
                        activePage?.id === page.id && activeSectionId === "__custom"
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      }`}
                    >
                      <span className="text-sm flex-shrink-0">{page.icon ?? "📄"}</span>
                      <span className="truncate flex-1">{page.title}</span>
                    </button>
                  ))}
                  <button
                    onClick={startNewPage}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition-colors w-full mt-1"
                  >
                    <Plus size={12} /> Nova página
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {activeTab === "growth" ? (
          <GrowthPanel />
        ) : activeTab === "clients" ? (
          <ClientsPanel />
        ) : editingPage ? (
          <WikiEditor
            page={editingPage === "new" ? null : activePage}
            onSave={handleSave}
            onCancel={() => setEditingPage(null)}
          />
        ) : activeSectionId === "__custom" && activePage ? (
          /* Custom page view */
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{activePage.icon ?? "📄"}</span>
                <div>
                  <h1 className="text-xl font-bold">{activePage.title}</h1>
                  <p className="text-xs text-muted-foreground">
                    Atualizado {timeAgo(activePage.updated_at)} por {activePage.author?.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingPage(activePage.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-secondary/80 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Edit3 size={13} /> Editar
                </button>
                <button onClick={() => deletePage(activePage.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-red-500/20 text-xs text-muted-foreground hover:text-red-400 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <AISearchBar onSearch={aiSearch} answer={aiAnswer} searching={aiSearching} sources={searchResults} />
            <div className="flex-1 mt-4 prose prose-invert prose-sm max-w-none">
              <WikiContentView content={activePage.content} />
            </div>
          </div>
        ) : activeSectionId === "clientes" ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4 flex-shrink-0">
              <span className="text-2xl">👥</span>
              <div>
                <h1 className="text-xl font-bold">Nossos Clientes</h1>
                <p className="text-xs text-muted-foreground">Base de clientes da Oxicore</p>
              </div>
            </div>
            <div className="flex-1 min-h-0"><ClientsPanel /></div>
          </div>
        ) : activeSectionId === "investidores" ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4 flex-shrink-0">
              <span className="text-2xl">👥</span>
              <div>
                <h1 className="text-xl font-bold">Nossos Investidores</h1>
                <p className="text-xs text-muted-foreground">Time Oxicore — {44} membros</p>
              </div>
            </div>
            <div className="flex-1 min-h-0"><InvestidoresPanel /></div>
          </div>
        ) : activeSection ? (
          /* Static Notion-mirrored section */
          <div>
            {/* Breadcrumb */}
            {activeSection.id !== "home" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-4">
                <button onClick={() => setActiveSectionId("home")} className="hover:text-foreground transition-colors flex items-center gap-1">
                  <Home size={11} /> Início
                </button>
                <ChevronRight size={11} />
                <span className="text-foreground">{activeSection.title}</span>
              </div>
            )}

            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <span className="text-4xl leading-none mt-1">{activeSection.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{activeSection.title}</h1>
                  {activeSection.tag && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider ${TAG_COLORS[activeSection.tag] ?? "bg-secondary text-muted-foreground"}`}>
                      {activeSection.tag}
                    </span>
                  )}
                </div>
                {activeSection.subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{activeSection.subtitle}</p>
                )}
              </div>
            </div>

            {/* Sub-sections chips */}
            {activeSection.children && activeSection.children.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {activeSection.children.map((child) => (
                  <button
                    key={child.id}
                    onClick={() => setActiveSectionId(child.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/50 hover:bg-primary/20 hover:text-primary border border-border/30 hover:border-primary/30 text-xs font-medium transition-all"
                  >
                    <span>{child.icon}</span>
                    <span>{child.title}</span>
                    <ChevronRight size={11} className="opacity-50" />
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div>
              {STATIC_CONTENT[activeSection.id] ?? (
                <div className="p-4 rounded-2xl bg-secondary/40 border border-border/30 text-sm text-muted-foreground">
                  Conteúdo em construção.
                </div>
              )}
            </div>

            {/* AI Search */}
            <div className="mt-6">
              <AISearchBar onSearch={aiSearch} answer={aiAnswer} searching={aiSearching} sources={searchResults} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function findSection(tree: StaticSection[], id: string): StaticSection | null {
  for (const s of tree) {
    if (s.id === id) return s;
    if (s.children) {
      const found = findSection(s.children, id);
      if (found) return found;
    }
  }
  return null;
}

function SidebarItem({
  section, activeSectionId, expandedIds, onSelect, onToggle, depth
}: {
  section: StaticSection;
  activeSectionId: string;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  depth: number;
}) {
  const hasChildren = section.children && section.children.length > 0;
  const isExpanded = expandedIds.has(section.id);
  const isActive = activeSectionId === section.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs cursor-pointer transition-colors group ${
          isActive ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        }`}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            className="flex-shrink-0 opacity-60 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onToggle(section.id); }}
          >
            <ChevronDown size={12} className={`transition-transform ${isExpanded ? "" : "-rotate-90"}`} />
          </button>
        ) : (
          <span className="w-3 flex-shrink-0" />
        )}
        <button
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          onClick={() => onSelect(section.id)}
        >
          <span className="flex-shrink-0 text-sm">{section.icon}</span>
          <span className="truncate">{section.title}</span>
        </button>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {section.children!.map((child) => (
            <SidebarItem
              key={child.id}
              section={child}
              activeSectionId={activeSectionId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WikiContentView({ content }: { content: unknown }) {
  if (!content) return <p className="text-muted-foreground italic">Página vazia</p>;
  if (typeof content === "object" && content !== null && "type" in content) {
    return <div className="text-sm text-muted-foreground">[Conteúdo rico — abra em modo de edição para visualizar]</div>;
  }
  if (typeof content === "string") {
    return <div dangerouslySetInnerHTML={{ __html: content }} className="text-sm leading-relaxed" />;
  }
  return null;
}
