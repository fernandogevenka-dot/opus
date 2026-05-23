import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import {
  ClipboardList, Mic2, Send, Loader2, ChevronDown, ChevronUp,
  User, Building2, DollarSign, Target, FileText, Sparkles,
  AlertCircle, CheckCircle2, RefreshCw, Clock, TrendingUp,
  Briefcase, Globe, BookOpen, MessageSquare, Plus, Trash2,
  Copy, Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "pre" | "pos";

interface PreBriefingForm {
  empresa: string;
  segmento: string;
  porte: string;
  website: string;
  decisores: string;
  problema: string;
  historico: string;
  budget_estimado: string;
  origem_lead: string;
  notas_extras: string;
}

const EMPTY_PRE_FORM: PreBriefingForm = {
  empresa: "",
  segmento: "",
  porte: "",
  website: "",
  decisores: "",
  problema: "",
  historico: "",
  budget_estimado: "",
  origem_lead: "",
  notas_extras: "",
};

interface SavedBriefing {
  id: string;
  empresa: string;
  tab: Tab;
  resultado: string;
  created_at: string;
  user_name: string;
}

// ─── API helper ───────────────────────────────────────────────────────────────

const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function callClaude(systemPrompt: string, userMessage: string, onChunk: (t: string) => void) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok || !res.body) {
    // fallback: direct call
    return callClaudeDirect(systemPrompt, userMessage, onChunk);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.delta?.text ?? parsed.choices?.[0]?.delta?.content ?? "";
        if (text) onChunk(text);
      } catch { /* skip */ }
    }
  }
}

async function callClaudeDirect(systemPrompt: string, userMessage: string, onChunk: (t: string) => void) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-calls": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return;
      try {
        const parsed = JSON.parse(data);
        const text = parsed.delta?.text ?? "";
        if (text) onChunk(text);
      } catch { /* skip */ }
    }
  }
}

// ─── System prompts ───────────────────────────────────────────────────────────

const PRE_SYSTEM_PROMPT = `Você é o Sales Intelligence da V4 Oxicore & Co — o assistente estratégico que prepara o Closer para reuniões de vendas.

Seu trabalho:
1. Analisar o perfil do prospect preenchido pelo pré-vendedor
2. Identificar o problema central e os produtos V4 mais adequados
3. Sugerir o roteiro estratégico da reunião
4. Antecipar objeções e como superá-las
5. Recomendar abordagem personalizada por segmento/porte

Portfólio V4 (categorias):
- **SABER** — Diagnóstico, auditoria e análise do time comercial. Para empresas que não sabem onde estão travadas.
- **TER** — Implantação de estrutura comercial, scripts, playbooks, metodologia. Para empresas que precisam construir máquina de vendas.
- **EXECUTAR** — Gestão comercial contínua, treinamento recorrente, acompanhamento de resultado. Para empresas que precisam de execução.
- **DESTRAVA RECEITA** — Ações cirúrgicas rápidas (auditoria de fechamento, prospecção, SDR). Para travar resultado imediato.

Formato de resposta — use markdown rico com:
## 🎯 Diagnóstico do Prospect
## 🏢 Perfil da Empresa (inclua pesquisa do setor/mercado)
## 💡 Produtos Recomendados (top 3, com justificativa)
## 🗺️ Roteiro da Reunião (abertura → descoberta → solução → fechamento)
## ⚡ Objeções Prováveis e Como Responder
## 🚀 Abordagem Estratégica Recomendada
## 📋 Checklist Pré-Call

Seja específico, estratégico e focado em resultado. Não seja genérico.`;

const POS_SYSTEM_PROMPT = `Você é o Sales Intelligence da V4 Oxicore & Co — o assistente que transforma transcrições de calls em material de vendas estruturado.

Seu trabalho:
1. Analisar a transcrição/resumo da reunião
2. Identificar o problema central do cliente
3. Recomendar os produtos V4 mais adequados ao que foi discutido
4. Redigir a proposta comercial estruturada
5. Definir próximos passos e follow-up

Portfólio V4 (categorias):
- **SABER** — Diagnóstico, auditoria e análise do time comercial.
- **TER** — Implantação de estrutura comercial, scripts, playbooks, metodologia.
- **EXECUTAR** — Gestão comercial contínua, treinamento, acompanhamento.
- **DESTRAVA RECEITA** — Ações cirúrgicas rápidas para resultado imediato.

Formato de resposta — use markdown rico com:
## 📋 Resumo da Reunião
## 🎯 Problema Central Identificado
## 💡 Solução Recomendada (produtos V4 + justificativa)
## 📄 Rascunho da Proposta Comercial
## 🤝 Argumentos de Valor (por que V4 resolve esse problema)
## 📅 Próximos Passos e Follow-up
## ⚠️ Pontos de Atenção / Riscos

Seja direto, comercialmente assertivo e focado no ROI para o cliente.`;

// ─── Markdown renderer simples ────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="text-base font-bold text-foreground mt-5 mb-2 flex items-center gap-2">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="text-sm font-semibold text-foreground mt-3 mb-1">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      elements.push(
        <p key={key++} className="text-sm font-semibold text-foreground my-1">
          {line.slice(2, -2)}
        </p>
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      const content = line.slice(2);
      const parts = content.split(/\*\*(.+?)\*\*/g);
      elements.push(
        <li key={key++} className="text-sm text-muted-foreground ml-4 my-0.5 list-disc">
          {parts.map((p, i) =>
            i % 2 === 1 ? <strong key={i} className="text-foreground">{p}</strong> : p
          )}
        </li>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-1" />);
    } else {
      const parts = line.split(/\*\*(.+?)\*\*/g);
      elements.push(
        <p key={key++} className="text-sm text-muted-foreground my-0.5 leading-relaxed">
          {parts.map((p, i) =>
            i % 2 === 1 ? <strong key={i} className="text-foreground">{p}</strong> : p
          )}
        </p>
      );
    }
  }
  return <div className="space-y-0">{elements}</div>;
}

// ─── Pre-Briefing Form ────────────────────────────────────────────────────────

function PreBriefingForm({
  form, setForm, onGenerate, loading,
}: {
  form: PreBriefingForm;
  setForm: (f: PreBriefingForm) => void;
  onGenerate: () => void;
  loading: boolean;
}) {
  const field = (
    label: string,
    key: keyof PreBriefingForm,
    placeholder: string,
    textarea = false,
    icon?: React.ReactNode
  ) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      {textarea ? (
        <textarea
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          rows={3}
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      ) : (
        <input
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder={placeholder}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        />
      )}
    </div>
  );

  const isReady = form.empresa.trim() && form.problema.trim();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {field("Nome da Empresa *", "empresa", "Ex: Acme Ltda", false, <Building2 size={12} />)}
        {field("Segmento / Setor", "segmento", "Ex: SaaS B2B, Varejo, Indústria", false, <Briefcase size={12} />)}
        {field("Porte", "porte", "Ex: Startup 10 funcionários, PME R$5M/ano", false, <TrendingUp size={12} />)}
        {field("Website / LinkedIn", "website", "https://...", false, <Globe size={12} />)}
        {field("Decisores na Reunião", "decisores", "Ex: CEO João, Gerente Comercial Ana", false, <User size={12} />)}
        {field("Budget Estimado", "budget_estimado", "Ex: R$ 30k–50k", false, <DollarSign size={12} />)}
        {field("Origem do Lead", "origem_lead", "Ex: Indicação, LinkedIn, Cold Outbound", false, <Target size={12} />)}
      </div>
      {field("Problema Relatado pelo Lead *", "problema", "Descreva o que o pré-vendedor levantou como principal dor ou necessidade do cliente...", true, <AlertCircle size={12} />)}
      {field("Histórico de Contato", "historico", "Já foi cliente? Tentativas anteriores? Contexto relevante...", true, <Clock size={12} />)}
      {field("Notas Extras", "notas_extras", "Qualquer outra informação relevante para o Closer...", true, <FileText size={12} />)}

      <button
        onClick={onGenerate}
        disabled={!isReady || loading}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-3 text-sm font-semibold transition-colors"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> Gerando briefing...</>
        ) : (
          <><Sparkles size={16} /> Gerar Briefing com IA</>
        )}
      </button>
      {!isReady && (
        <p className="text-xs text-muted-foreground text-center">
          Preencha pelo menos <strong>Nome da Empresa</strong> e <strong>Problema Relatado</strong> para continuar
        </p>
      )}
    </div>
  );
}

// ─── Pos-Reuniao Form ─────────────────────────────────────────────────────────

function PosReuniaForm({
  empresa, setEmpresa,
  transcricao, setTranscricao,
  onGenerate, loading,
}: {
  empresa: string;
  setEmpresa: (v: string) => void;
  transcricao: string;
  setTranscricao: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
}) {
  const isReady = empresa.trim() && transcricao.trim().length > 50;
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
          <Building2 size={12} /> Nome da Empresa *
        </label>
        <input
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Ex: Acme Ltda"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
          <MessageSquare size={12} /> Transcrição / Resumo da Reunião *
        </label>
        <textarea
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          rows={12}
          placeholder="Cole aqui a transcrição da call, o resumo da reunião, ou os pontos principais discutidos. Quanto mais detalhado, mais preciso será o resultado..."
          value={transcricao}
          onChange={(e) => setTranscricao(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">{transcricao.length} caracteres — mínimo 50</p>
      </div>
      <button
        onClick={onGenerate}
        disabled={!isReady || loading}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-3 text-sm font-semibold transition-colors"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> Analisando reunião...</>
        ) : (
          <><Sparkles size={16} /> Gerar Análise Pós-Reunião</>
        )}
      </button>
    </div>
  );
}

// ─── Result Panel ─────────────────────────────────────────────────────────────

function ResultPanel({
  result, streaming, empresa, tab, onSave, saving, saved,
}: {
  result: string;
  streaming: boolean;
  empresa: string;
  tab: Tab;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (streaming) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [result, streaming]);

  function copyToClipboard() {
    navigator.clipboard.writeText(result);
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {tab === "pre" ? "Briefing Pré-Reunião" : "Análise Pós-Reunião"} — {empresa}
          </span>
          {streaming && (
            <span className="text-xs text-primary animate-pulse flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Gerando...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
            title="Copiar"
          >
            <Copy size={14} />
          </button>
          {!saved && (
            <button
              onClick={onSave}
              disabled={saving || streaming}
              className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <BookOpen size={12} />}
              Salvar no histórico
            </button>
          )}
          {saved && (
            <span className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle2 size={12} /> Salvo
            </span>
          )}
        </div>
      </div>
      <div className="p-5 max-h-[60vh] overflow-y-auto">
        {renderMarkdown(result)}
        <div ref={endRef} />
      </div>
    </div>
  );
}

// ─── History Panel ────────────────────────────────────────────────────────────

function HistoryPanel({
  items, onSelect, onDelete, activeId,
}: {
  items: SavedBriefing[];
  onSelect: (b: SavedBriefing) => void;
  onDelete: (id: string) => void;
  activeId: string | null;
}) {
  if (items.length === 0) return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      Nenhum briefing salvo ainda.
    </div>
  );
  return (
    <div className="space-y-2">
      {items.map((b) => (
        <div
          key={b.id}
          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${activeId === b.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"}`}
          onClick={() => onSelect(b)}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{b.empresa}</p>
            <p className="text-xs text-muted-foreground">
              {b.tab === "pre" ? "Pré-reunião" : "Pós-reunião"} · {b.user_name} · {new Date(b.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(b.id); }}
            className="ml-2 text-muted-foreground hover:text-red-500 transition-colors p-1 rounded"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SalesIntelligencePage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("pre");
  const [showHistory, setShowHistory] = useState(false);

  // Pre-briefing state
  const [preForm, setPreForm] = useState<PreBriefingForm>(EMPTY_PRE_FORM);

  // Pos-reuniao state
  const [posEmpresa, setPosEmpresa] = useState("");
  const [posTranscricao, setPosTranscricao] = useState("");

  // Result state
  const [result, setResult] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [resultTab, setResultTab] = useState<Tab>("pre");
  const [resultEmpresa, setResultEmpresa] = useState("");

  // Save state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // History
  const [history, setHistory] = useState<SavedBriefing[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  async function loadHistory() {
    setLoadingHistory(true);
    const { data } = await supabase
      .from("sales_briefings")
      .select("id, empresa, tab, resultado, created_at, user_name")
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setHistory(data as SavedBriefing[]);
    setLoadingHistory(false);
  }

  useEffect(() => {
    if (showHistory) loadHistory();
  }, [showHistory]);

  async function generatePre() {
    setStreaming(true);
    setResult("");
    setSaved(false);
    setResultTab("pre");
    setResultEmpresa(preForm.empresa);

    const userMessage = `
## Dados do Prospect

**Empresa:** ${preForm.empresa}
**Segmento:** ${preForm.segmento || "Não informado"}
**Porte:** ${preForm.porte || "Não informado"}
**Website:** ${preForm.website || "Não informado"}
**Decisores na Reunião:** ${preForm.decisores || "Não informado"}
**Budget Estimado:** ${preForm.budget_estimado || "Não informado"}
**Origem do Lead:** ${preForm.origem_lead || "Não informado"}

**Problema Relatado pelo Pré-Vendedor:**
${preForm.problema}

**Histórico de Contato:**
${preForm.historico || "Sem histórico registrado"}

**Notas Extras:**
${preForm.notas_extras || "Nenhuma"}

---
Prepare o Closer para essa reunião.
    `.trim();

    try {
      await callClaude(PRE_SYSTEM_PROMPT, userMessage, (chunk) => {
        setResult((prev) => prev + chunk);
      });
    } catch (err) {
      setResult("Erro ao gerar briefing. Verifique a conexão e tente novamente.");
    } finally {
      setStreaming(false);
    }
  }

  async function generatePos() {
    setStreaming(true);
    setResult("");
    setSaved(false);
    setResultTab("pos");
    setResultEmpresa(posEmpresa);

    const userMessage = `
## Empresa: ${posEmpresa}

## Transcrição / Resumo da Reunião:
${posTranscricao}

---
Analise essa reunião e prepare o material pós-call.
    `.trim();

    try {
      await callClaude(POS_SYSTEM_PROMPT, userMessage, (chunk) => {
        setResult((prev) => prev + chunk);
      });
    } catch (err) {
      setResult("Erro ao analisar reunião. Verifique a conexão e tente novamente.");
    } finally {
      setStreaming(false);
    }
  }

  async function saveResult() {
    if (!result || !user) return;
    setSaving(true);
    await supabase.from("sales_briefings").insert({
      empresa: resultEmpresa,
      tab: resultTab,
      resultado: result,
      user_id: user.id,
      user_name: user.name || user.email || "Usuário",
      form_data: resultTab === "pre" ? preForm : { transcricao: posTranscricao },
    });
    setSaving(false);
    setSaved(true);
    if (showHistory) loadHistory();
  }

  function selectHistory(b: SavedBriefing) {
    setResult(b.resultado);
    setResultEmpresa(b.empresa);
    setResultTab(b.tab as Tab);
    setSaved(true);
    setActiveHistoryId(b.id);
  }

  async function deleteHistory(id: string) {
    await supabase.from("sales_briefings").delete().eq("id", id);
    setHistory((prev) => prev.filter((b) => b.id !== id));
    if (activeHistoryId === id) {
      setActiveHistoryId(null);
      setResult("");
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Target size={18} className="text-primary" />
              Sales Intelligence
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Prepare closers, formalize propostas e acelere o pipeline
            </p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-2 transition-colors"
          >
            <BookOpen size={14} />
            Histórico
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 bg-muted rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("pre")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "pre" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ClipboardList size={14} />
            Pré-Reunião
          </button>
          <button
            onClick={() => setTab("pos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === "pos" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Mic2 size={14} />
            Pós-Reunião
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className={`grid gap-6 p-6 ${result ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-2xl mx-auto"}`}>
          {/* Left: Form */}
          <div className="space-y-6">
            {/* History panel (inline) */}
            {showHistory && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BookOpen size={14} className="text-primary" />
                    Histórico de Briefings
                  </h3>
                  {loadingHistory && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                </div>
                <HistoryPanel
                  items={history}
                  onSelect={selectHistory}
                  onDelete={deleteHistory}
                  activeId={activeHistoryId}
                />
              </div>
            )}

            {/* Form card */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  {tab === "pre" ? (
                    <><ClipboardList size={15} className="text-primary" /> Preencher Briefing do Prospect</>
                  ) : (
                    <><Mic2 size={15} className="text-primary" /> Inserir Transcrição da Reunião</>
                  )}
                </h2>
                {tab === "pre" && (
                  <button
                    onClick={() => setPreForm(EMPTY_PRE_FORM)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    <RefreshCw size={11} /> Limpar
                  </button>
                )}
              </div>

              {tab === "pre" ? (
                <PreBriefingForm
                  form={preForm}
                  setForm={setPreForm}
                  onGenerate={generatePre}
                  loading={streaming && resultTab === "pre"}
                />
              ) : (
                <PosReuniaForm
                  empresa={posEmpresa}
                  setEmpresa={setPosEmpresa}
                  transcricao={posTranscricao}
                  setTranscricao={setPosTranscricao}
                  onGenerate={generatePos}
                  loading={streaming && resultTab === "pos"}
                />
              )}
            </div>
          </div>

          {/* Right: Result */}
          {result && (
            <ResultPanel
              result={result}
              streaming={streaming}
              empresa={resultEmpresa}
              tab={resultTab}
              onSave={saveResult}
              saving={saving}
              saved={saved}
            />
          )}
        </div>
      </div>
    </div>
  );
}
