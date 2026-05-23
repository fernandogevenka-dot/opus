import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { supabase } from "@/lib/supabase";
import {
  ClipboardList, Mic2, Loader2, ChevronDown, ChevronUp,
  User, Building2, DollarSign, Target, FileText, Sparkles,
  AlertCircle, CheckCircle2, RefreshCw, Clock, TrendingUp,
  Briefcase, Globe, BookOpen, MessageSquare, Trash2,
  Copy, Upload, Zap, Calendar,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "pre" | "pos";

// Campos espelham a metodologia SPICED do FPS SQL
interface PreBriefingForm {
  empresa: string;
  segmento: string;
  porte: string;
  website: string;
  decisores: string;
  // SPICED
  situacao: string;
  problema: string;
  impacto: string;
  critical_event: string;
  decisao: string;
  // Extras
  marketing_atual: string;
  vendas_atual: string;
  budget_estimado: string;
  origem_lead: string;
  observacoes_closer: string;
}

const EMPTY_PRE_FORM: PreBriefingForm = {
  empresa: "",
  segmento: "",
  porte: "",
  website: "",
  decisores: "",
  situacao: "",
  problema: "",
  impacto: "",
  critical_event: "",
  decisao: "",
  marketing_atual: "",
  vendas_atual: "",
  budget_estimado: "",
  origem_lead: "",
  observacoes_closer: "",
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

async function callClaude(
  systemPrompt: string,
  userMessage: string,
  onChunk: (t: string) => void
) {
  // Try proxy first, fallback to direct
  try {
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
    if (res.ok && res.body) {
      return await streamSSE(res.body, onChunk);
    }
  } catch { /* fallback */ }
  return callClaudeDirect(systemPrompt, userMessage, onChunk);
}

async function callClaudeDirect(
  systemPrompt: string,
  userMessage: string,
  onChunk: (t: string) => void
) {
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
  return streamSSE(res.body, onChunk);
}

async function streamSSE(body: ReadableStream<Uint8Array>, onChunk: (t: string) => void) {
  const reader = body.getReader();
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

// ─── PDF extractor via Claude Vision ─────────────────────────────────────────

async function extractFPSFromPDF(base64: string): Promise<Partial<PreBriefingForm>> {
  // Usa Edge Function do Supabase — chave fica no servidor, não no browser
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sales-pdf-extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ base64, mediaType: "application/pdf" }),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("PDF extraction error", res.status, errBody);
    throw new Error(`PDF extraction error ${res.status}: ${errBody}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data as Partial<PreBriefingForm>;
}

// ─── System prompts ───────────────────────────────────────────────────────────

const PRE_SYSTEM_PROMPT = `Você é o Sales Intelligence da V4 Oxicore & Co — o assistente estratégico que prepara o Closer para reuniões de vendas.

Os dados foram coletados pelo pré-vendedor usando a metodologia SPICED:
- S — Situação: contexto geral da empresa
- P — Problema: dores identificadas
- I — Impacto: impacto financeiro quantificado do problema
- C — Critical Event: gatilho de urgência (por que agir agora?)
- E — Decision (Decisão): quem decide e como

Seu trabalho:
1. Analisar o perfil SPICED do prospect
2. Identificar o problema central e os produtos V4 mais adequados
3. Sugerir o roteiro estratégico da reunião
4. Antecipar objeções e como superá-las
5. Recomendar abordagem personalizada por segmento/porte

Portfólio V4 (categorias):
- **SABER** — Diagnóstico, auditoria e análise do time comercial. Para empresas que não sabem onde estão travadas.
- **TER** — Implantação de estrutura comercial, scripts, playbooks, metodologia. Para empresas que precisam construir máquina de vendas.
- **EXECUTAR** — Gestão comercial contínua, treinamento recorrente, acompanhamento de resultado. Para empresas que precisam de execução.
- **DESTRAVA RECEITA** — Ações cirúrgicas rápidas (auditoria de fechamento, prospecção, SDR). Para resultado imediato.

Formato de resposta — use markdown rico com:
## 🎯 Diagnóstico SPICED
## 🏢 Perfil da Empresa e Mercado
## 💡 Produtos Recomendados (top 3, com justificativa baseada no SPICED)
## 🗺️ Roteiro da Reunião (abertura → descoberta → solução → fechamento)
## ⚡ Objeções Prováveis e Como Responder
## 🚀 Abordagem Estratégica Recomendada
## 📋 Checklist Pré-Call

Seja específico, estratégico e focado em resultado. Use os dados SPICED para personalizar cada seção.`;

const POS_SYSTEM_PROMPT = `Você é o Sales Intelligence da V4 Oxicore & Co — o assistente que transforma transcrições de calls em material de vendas estruturado.

Seu trabalho:
1. Analisar a transcrição/resumo da reunião
2. Identificar o problema central do cliente (lente SPICED)
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
## 🎯 Problema Central (análise SPICED)
## 💡 Solução Recomendada (produtos V4 + justificativa)
## 📄 Rascunho da Proposta Comercial
## 🤝 Argumentos de Valor (ROI esperado para o cliente)
## 📅 Próximos Passos e Follow-up
## ⚠️ Pontos de Atenção / Riscos

Seja direto, comercialmente assertivo e focado no ROI para o cliente.`;

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="text-base font-bold text-foreground mt-5 mb-2">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="text-sm font-semibold text-foreground mt-3 mb-1">
          {line.slice(4)}
        </h3>
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

// ─── FPS Upload Button ────────────────────────────────────────────────────────

function FPSUploadButton({
  onExtracted, loading, setLoading,
}: {
  onExtracted: (data: Partial<PreBriefingForm>) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("Selecione um arquivo PDF.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      // Use FileReader to get clean base64 without btoa charset issues
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // result is "data:application/pdf;base64,<data>"
          const b64 = result.split(",")[1];
          if (b64) resolve(b64);
          else reject(new Error("Empty base64"));
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const data = await extractFPSFromPDF(base64);
      onExtracted(data);
    } catch (err) {
      console.error("FPS import error:", err);
      setError("Erro ao ler o PDF. Tente novamente.");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> Lendo FPS SQL...</>
        ) : (
          <><Upload size={16} /> Importar FPS SQL (PDF)</>
        )}
      </button>
      {error && <p className="text-xs text-red-500 mt-1 text-center">{error}</p>}
      {!error && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          Importe o FPS SQL do pré-vendedor para preencher automaticamente com IA
        </p>
      )}
    </div>
  );
}

// ─── Pre-Briefing Form (SPICED) ───────────────────────────────────────────────

function PreBriefingForm({
  form, setForm, onGenerate, loading, extracting, setExtracting,
}: {
  form: PreBriefingForm;
  setForm: (f: PreBriefingForm) => void;
  onGenerate: () => void;
  loading: boolean;
  extracting: boolean;
  setExtracting: (v: boolean) => void;
}) {
  const field = (
    label: string,
    key: keyof PreBriefingForm,
    placeholder: string,
    textarea = false,
    icon?: React.ReactNode,
    badge?: string
  ) => (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
        {icon}
        {label}
        {badge && (
          <span className="ml-auto text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
            {badge}
          </span>
        )}
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
    <div className="space-y-5">
      {/* Upload FPS */}
      <FPSUploadButton
        onExtracted={(data) => setForm({ ...form, ...data })}
        loading={extracting}
        setLoading={setExtracting}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs text-muted-foreground">ou preencha manualmente</span>
        </div>
      </div>

      {/* Dados básicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {field("Nome da Empresa *", "empresa", "Ex: Marques Plastic", false, <Building2 size={12} />)}
        {field("Segmento / Setor", "segmento", "Ex: Indústria plástica, SaaS B2B", false, <Briefcase size={12} />)}
        {field("Porte", "porte", "Ex: PME, R$800k/mês faturamento", false, <TrendingUp size={12} />)}
        {field("Website / Instagram / LinkedIn", "website", "https://...", false, <Globe size={12} />)}
        {field("Decisores na Reunião", "decisores", "Ex: Wellington (CEO), Paulo (sócio)", false, <User size={12} />)}
        {field("Budget Estimado", "budget_estimado", "Ex: R$20k–40k/mês", false, <DollarSign size={12} />)}
        {field("Origem do Lead", "origem_lead", "Ex: Cold outbound, indicação, LinkedIn", false, <Target size={12} />)}
      </div>

      {/* SPICED */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-primary uppercase tracking-widest">Metodologia SPICED</p>
        {field("S — Situação", "situacao", "Contexto geral: tempo de mercado, sócios, equipe, modelo de vendas atual, como chegou até a V4...", true, <FileText size={12} />, "S")}
        {field("P — Problema", "problema", "Dores identificadas: o que está travando o crescimento? Qual a principal frustração? *", true, <AlertCircle size={12} />, "P")}
        {field("I — Impacto", "impacto", "Impacto financeiro: gap entre faturamento atual e capacidade máxima, quanto o problema custa por mês...", true, <TrendingUp size={12} />, "I")}
        {field("C — Critical Event", "critical_event", "Gatilho de urgência: por que agir agora? Nova máquina chegando? Sazonalidade? Concorrente entrando?", true, <Zap size={12} />, "C")}
        {field("E — Decision (Decisão)", "decisao", "Quem decide, como decide, quando: reunião agendada, próximos passos acordados...", true, <Calendar size={12} />, "E")}
      </div>

      {/* Diagnóstico comercial */}
      <div className="space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Diagnóstico Comercial</p>
        {field("Marketing Atual", "marketing_atual", "Redes sociais, site, Google, canais de captação existentes...", true, <Globe size={12} />)}
        {field("Vendas Atual", "vendas_atual", "Número de vendedores, processo, CRM, origem dos leads...", true, <Briefcase size={12} />)}
        {field("Observações para o Closer", "observacoes_closer", "Alertas, pontos de atenção, pendências críticas para a reunião...", true, <MessageSquare size={12} />)}
      </div>

      <button
        onClick={onGenerate}
        disabled={!isReady || loading || extracting}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-4 py-3 text-sm font-semibold transition-colors"
      >
        {loading ? (
          <><Loader2 size={16} className="animate-spin" /> Gerando briefing SPICED...</>
        ) : (
          <><Sparkles size={16} /> Preparar Closer com IA</>
        )}
      </button>
      {!isReady && (
        <p className="text-xs text-muted-foreground text-center">
          Preencha pelo menos <strong>Empresa</strong> e <strong>Problema (P)</strong> para continuar
        </p>
      )}
    </div>
  );
}

// ─── Pos-Reuniao Form ─────────────────────────────────────────────────────────

function PosReuniaoForm({
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [fileError, setFileError] = useState("");

  const ACCEPTED = ".txt,.pdf,.doc,.docx,.md,.vtt,.srt";

  async function handleTranscriptFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError("");
    setUploadingFile(true);
    try {
      // Text-based files: read directly
      const textTypes = ["text/plain", "text/markdown", "text/vtt", "application/octet-stream"];
      const isText = textTypes.some((t) => file.type.startsWith(t)) ||
        file.name.endsWith(".txt") || file.name.endsWith(".md") ||
        file.name.endsWith(".vtt") || file.name.endsWith(".srt");

      if (isText) {
        const text = await file.text();
        setTranscricao(text);
        setUploadedFileName(file.name);
      } else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        // PDF: extrai via Edge Function do Supabase (chave no servidor)
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = (reader.result as string).split(",")[1];
            if (b64) resolve(b64); else reject(new Error("empty"));
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sales-pdf-extract-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ base64, mediaType: "application/pdf" }),
        });
        if (!res.ok) throw new Error(`Edge function error ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        const text = json.text ?? "";
        setTranscricao(text);
        setUploadedFileName(file.name);
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.endsWith(".docx") || file.name.endsWith(".doc")
      ) {
        // DOCX: read as text (best effort) or show message
        try {
          const text = await file.text();
          setTranscricao(text);
          setUploadedFileName(file.name);
        } catch {
          setFileError("Para arquivos .docx, copie e cole o texto da transcrição abaixo.");
        }
      } else {
        const text = await file.text();
        setTranscricao(text);
        setUploadedFileName(file.name);
      }
    } catch (err) {
      console.error("Transcript upload error:", err);
      setFileError("Erro ao ler o arquivo. Tente .txt ou cole o texto abaixo.");
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const isReady = empresa.trim() && transcricao.trim().length > 50;

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1.5">
          <Building2 size={12} /> Nome da Empresa *
        </label>
        <input
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Ex: Marques Plastic"
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
        />
      </div>

      {/* Upload transcrição */}
      <div>
        <input ref={fileInputRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleTranscriptFile} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingFile || loading}
          className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10 text-primary rounded-xl px-4 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploadingFile ? (
            <><Loader2 size={16} className="animate-spin" /> Lendo transcrição...</>
          ) : (
            <><Upload size={16} /> Upload da Transcrição</>
          )}
        </button>
        {uploadedFileName && !fileError && (
          <p className="text-xs text-green-500 mt-1 text-center flex items-center justify-center gap-1">
            <CheckCircle2 size={11} /> {uploadedFileName} carregado — {transcricao.length} caracteres
          </p>
        )}
        {fileError && <p className="text-xs text-red-500 mt-1 text-center">{fileError}</p>}
        {!uploadedFileName && !fileError && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            Aceita .txt, .pdf, .vtt, .srt, .docx — ou cole o texto abaixo
          </p>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <div className="relative flex justify-center">
          <span className="bg-card px-3 text-xs text-muted-foreground">ou cole a transcrição</span>
        </div>
      </div>

      <div>
        <textarea
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
          rows={10}
          placeholder="Cole aqui a transcrição da call, o resumo da reunião, ou os pontos principais discutidos..."
          value={transcricao}
          onChange={(e) => setTranscricao(e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">{transcricao.length} caracteres — mínimo 50</p>
      </div>

      <button
        onClick={onGenerate}
        disabled={!isReady || loading || uploadingFile}
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

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={14} className="text-primary flex-shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">
            {tab === "pre" ? "Briefing Pré-Reunião" : "Análise Pós-Reunião"} — {empresa}
          </span>
          {streaming && (
            <span className="text-xs text-primary animate-pulse flex items-center gap-1 flex-shrink-0">
              <Loader2 size={10} className="animate-spin" /> Gerando...
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigator.clipboard.writeText(result)}
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
              Salvar
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
    <div className="text-center py-8 text-muted-foreground text-sm">Nenhum briefing salvo ainda.</div>
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

  const [preForm, setPreForm] = useState<PreBriefingForm>(EMPTY_PRE_FORM);
  const [extracting, setExtracting] = useState(false);

  const [posEmpresa, setPosEmpresa] = useState("");
  const [posTranscricao, setPosTranscricao] = useState("");

  const [result, setResult] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [resultTab, setResultTab] = useState<Tab>("pre");
  const [resultEmpresa, setResultEmpresa] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

    const msg = `
## Dados SPICED do Prospect

**Empresa:** ${preForm.empresa}
**Segmento:** ${preForm.segmento || "Não informado"}
**Porte:** ${preForm.porte || "Não informado"}
**Website/Redes:** ${preForm.website || "Não informado"}
**Decisores:** ${preForm.decisores || "Não informado"}
**Budget Estimado:** ${preForm.budget_estimado || "Não informado"}
**Origem do Lead:** ${preForm.origem_lead || "Não informado"}

**S — Situação:**
${preForm.situacao || "Não preenchido"}

**P — Problema:**
${preForm.problema}

**I — Impacto:**
${preForm.impacto || "Não preenchido"}

**C — Critical Event:**
${preForm.critical_event || "Não preenchido"}

**E — Decision (Decisão):**
${preForm.decisao || "Não preenchido"}

**Marketing Atual:**
${preForm.marketing_atual || "Não informado"}

**Vendas Atual:**
${preForm.vendas_atual || "Não informado"}

**Observações para o Closer:**
${preForm.observacoes_closer || "Nenhuma"}

---
Prepare o Closer para essa reunião com base no SPICED acima.
    `.trim();

    try {
      await callClaude(PRE_SYSTEM_PROMPT, msg, (chunk) => setResult((p) => p + chunk));
    } catch {
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

    const msg = `## Empresa: ${posEmpresa}\n\n## Transcrição / Resumo da Reunião:\n${posTranscricao}\n\n---\nAnalise essa reunião e prepare o material pós-call.`.trim();

    try {
      await callClaude(POS_SYSTEM_PROMPT, msg, (chunk) => setResult((p) => p + chunk));
    } catch {
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
    if (activeHistoryId === id) { setActiveHistoryId(null); setResult(""); }
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
              Metodologia SPICED · Prepare closers · Formalize propostas
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
            {showHistory && (
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BookOpen size={14} className="text-primary" /> Histórico de Briefings
                  </h3>
                  {loadingHistory && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                </div>
                <HistoryPanel items={history} onSelect={selectHistory} onDelete={deleteHistory} activeId={activeHistoryId} />
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  {tab === "pre" ? (
                    <><ClipboardList size={15} className="text-primary" /> Briefing SPICED do Prospect</>
                  ) : (
                    <><Mic2 size={15} className="text-primary" /> Transcrição da Reunião</>
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
                  extracting={extracting}
                  setExtracting={setExtracting}
                />
              ) : (
                <PosReuniaoForm
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
