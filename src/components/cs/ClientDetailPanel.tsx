import { useState, useRef } from "react";
import type { ClientDetail, Survey, Contract, ContractedProduct } from "@/hooks/useCustomerSuccess";
import type { ClientInteraction } from "@/types";
import {
  DollarSign, Star, FileText, Upload, Plus, Package,
  MessageSquare, Phone, Mail, RefreshCw, Sparkles, BookOpen,
  Clock, TrendingUp, ChevronRight, CheckCircle, AlertCircle, Target
} from "lucide-react";
import { timeAgo } from "@/lib/utils";
import { motion } from "framer-motion";
import { AI_NAME } from "@/lib/constants";
import { PICPanel } from "@/components/cs/PICPanel";

type DetailTab = "overview" | "timeline" | "products" | "surveys" | "contracts" | "pic";

const INTERACTION_ICONS: Record<string, string> = {
  meeting: "📋", email: "📧", call: "📞", delivery: "✅",
  feedback: "⭐", note: "📝", upsell: "💰", contract: "📄",
  survey: "📊", onboarding: "🚀",
};
const INTERACTION_LABELS: Record<string, string> = {
  meeting: "Reunião", email: "E-mail", call: "Ligação", delivery: "Entrega",
  feedback: "Feedback", note: "Nota", upsell: "Upsell / Nova Venda",
  contract: "Contrato", survey: "Pesquisa", onboarding: "Onboarding",
};

interface Props {
  client: ClientDetail;
  onAddInteraction: (clientId: string, type: ClientInteraction["type"], title: string, notes: string, value?: number, product?: string) => Promise<void>;
  onUploadContract: (clientId: string, file: File, title: string, signedDate?: string) => Promise<unknown>;
  onParseContract: (contractId: string) => Promise<{ products_count: number; total_mrr: number }>;
  onUploadSurvey: (clientId: string, file: File, type: "nps" | "csat" | "ces" | "custom", period: string, respondent: string) => Promise<unknown>;
  onRefresh: () => void;
}

export function ClientDetailPanel({ client, onAddInteraction, onUploadContract, onParseContract, onUploadSurvey, onRefresh }: Props) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [showUploadContract, setShowUploadContract] = useState(false);
  const [showUploadSurvey, setShowUploadSurvey] = useState(false);
  const [parsingContract, setParsingContract] = useState<string | null>(null);

  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);

  const STATUS_COLOR: Record<string, string> = {
    active: "text-green-400 bg-green-500/20", at_risk: "text-yellow-400 bg-yellow-500/20",
    upsell: "text-blue-400 bg-blue-500/20", churned: "text-red-400 bg-red-500/20",
    prospect: "text-purple-400 bg-purple-500/20",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Client header */}
      <div className="flex items-start gap-4 mb-4 pb-4 border-b border-border/30">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/30 to-purple-600/30 flex items-center justify-center text-2xl font-black flex-shrink-0">
          {client.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-lg">{client.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[client.status]}`}>
              {client.status === "active" ? "Ativo" : client.status === "at_risk" ? "Em Risco" : client.status === "upsell" ? "Oportunidade" : client.status === "churned" ? "Cancelou" : "Prospect"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
            {client.region && <span>📍 {client.region}</span>}
            {client.segment && <span>🏭 {client.segment}</span>}
            {client.contact_email && (
              <a href={`mailto:${client.contact_email}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                <Mail size={11} />{client.contact_email}
              </a>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="flex gap-3 flex-shrink-0">
          {[
            { label: "MRR", value: client.mrr > 0 ? fmt(client.mrr) : "—", color: "text-brand-400" },
            { label: "LTV", value: client.ltv > 0 ? fmt(client.ltv) : "—", color: "text-green-400" },
            { label: "NPS", value: client.nps !== null ? String(client.nps) : "—", color: client.nps !== null && client.nps >= 9 ? "text-green-400" : client.nps !== null && client.nps >= 7 ? "text-yellow-400" : "text-red-400" },
          ].map((k) => (
            <div key={k.label} className="text-center glass rounded-xl px-3 py-2">
              <p className={`text-base font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3 flex-shrink-0">
        {([
          { id: "overview", label: "Visão Geral", icon: <TrendingUp size={13} /> },
          { id: "pic", label: "PIC", icon: <Target size={13} /> },
          { id: "timeline", label: "Timeline", icon: <Clock size={13} /> },
          { id: "products", label: `Produtos (${client.contracted_products.length})`, icon: <Package size={13} /> },
          { id: "surveys", label: `Pesquisas (${client.surveys.length})`, icon: <Star size={13} /> },
          { id: "contracts", label: `Contratos (${client.contracts.length})`, icon: <FileText size={13} /> },
        ] as { id: DetailTab; label: string; icon: React.ReactNode }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              activeTab === tab.id ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
        <button onClick={onRefresh} className="ml-auto p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors">
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* CS Team */}
            {client.team_members.length > 0 && (
              <div className="glass rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Time de Atendimento</p>
                <div className="flex gap-3 flex-wrap">
                  {client.team_members.map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2">
                      <img src={m.user?.avatar_url ?? ""} className="w-7 h-7 rounded-full" alt="" />
                      <div>
                        <p className="text-xs font-medium">{m.user?.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{m.role.replace("_", " ")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active products summary */}
            {client.contracted_products.length > 0 && (
              <div className="glass rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Produtos Contratados</p>
                <div className="space-y-1.5">
                  {client.contracted_products.map((p) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle size={12} className="text-green-400" />
                        <span className="text-sm">{p.product}</span>
                        {p.source === "contract_ai" && (
                          <span className="text-xs text-primary/60 flex items-center gap-0.5">
                            <Sparkles size={9} />IA
                          </span>
                        )}
                      </div>
                      {p.value && <span className="text-xs text-muted-foreground">{fmt(p.value)}/mês</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last interaction */}
            {client.interactions.length > 0 && (
              <div className="glass rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Última Interação</p>
                <div className="flex items-start gap-3">
                  <span className="text-xl">{INTERACTION_ICONS[client.interactions[0].type]}</span>
                  <div>
                    <p className="text-sm font-medium">{client.interactions[0].title}</p>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(client.interactions[0].happened_at)} · {(client.interactions[0] as { author?: { name: string } }).author?.name}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            {client.notes && (
              <div className="glass rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Notas</p>
                <p className="text-sm leading-relaxed">{client.notes}</p>
              </div>
            )}

            <AddInteractionButton onClick={() => setShowAddInteraction(true)} />
          </div>
        )}

        {/* TIMELINE */}
        {activeTab === "timeline" && (
          <div className="space-y-2">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowAddInteraction(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors"
              >
                <Plus size={13} />
                Registrar interação
              </button>
            </div>

            {client.interactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma interação registrada ainda</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-px bg-border/50" />
                {client.interactions.map((interaction, i) => (
                  <motion.div
                    key={interaction.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-4 pb-4"
                  >
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-base flex-shrink-0 relative z-10">
                      {INTERACTION_ICONS[interaction.type]}
                    </div>
                    <div className="flex-1 glass rounded-xl p-3 mt-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{interaction.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {INTERACTION_LABELS[interaction.type]} · {timeAgo(interaction.happened_at)} · {(interaction as { author?: { name: string } }).author?.name}
                          </p>
                        </div>
                        {interaction.value && (
                          <span className="text-xs font-bold text-green-400">{fmt(interaction.value)}</span>
                        )}
                      </div>
                      {interaction.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{interaction.notes}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS */}
        {activeTab === "products" && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                {client.contracted_products.length} produto{client.contracted_products.length !== 1 ? "s" : ""} ativo{client.contracted_products.length !== 1 ? "s" : ""}
              </p>
              {client.contracts.some((c) => !c.products_parsed) && (
                <button className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary">
                  <Sparkles size={12} />
                  Extrair de contrato com {AI_NAME}
                </button>
              )}
            </div>

            {client.contracted_products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum produto contratado</p>
                <p className="text-xs mt-1">Suba um contrato PDF para o {AI_NAME} extrair automaticamente</p>
                <button onClick={() => setShowUploadContract(true)} className="mt-3 text-xs text-primary hover:underline">
                  Subir contrato →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {client.contracted_products.map((p) => (
                  <div key={p.id} className="glass rounded-xl p-3.5 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{p.product}</p>
                        {p.source === "contract_ai" && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/20 text-primary flex items-center gap-0.5">
                            <Sparkles size={9} />{AI_NAME}
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${p.status === "active" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                          {p.status === "active" ? "Ativo" : "Cancelado"}
                        </span>
                      </div>
                      {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                      {(p.start_date || p.end_date) && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {p.start_date && `Início: ${new Date(p.start_date).toLocaleDateString("pt-BR")}`}
                          {p.end_date && ` · Venc: ${new Date(p.end_date).toLocaleDateString("pt-BR")}`}
                        </p>
                      )}
                    </div>
                    {p.value && (
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-brand-400">{fmt(p.value)}</p>
                        <p className="text-xs text-muted-foreground">/mês</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SURVEYS */}
        {activeTab === "surveys" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setShowUploadSurvey(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors"
              >
                <Upload size={13} />
                Subir pesquisa
              </button>
            </div>

            {client.surveys.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Star size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhuma pesquisa registrada</p>
                <p className="text-xs mt-1">Suba CSV ou PDF — o {AI_NAME} extrai os resultados</p>
              </div>
            ) : (
              client.surveys.map((survey) => (
                <SurveyCard key={survey.id} survey={survey} />
              ))
            )}
          </div>
        )}

        {/* PIC */}
        {activeTab === "pic" && (
          <div className="py-1">
            <PICPanel clientId={client.id} clientName={client.name} />
          </div>
        )}

        {/* CONTRACTS */}
        {activeTab === "contracts" && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                onClick={() => setShowUploadContract(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors"
              >
                <Upload size={13} />
                Subir contrato
              </button>
            </div>

            {client.contracts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nenhum contrato cadastrado</p>
              </div>
            ) : (
              client.contracts.map((contract) => (
                <ContractCard
                  key={contract.id}
                  contract={contract}
                  onParse={async () => {
                    setParsingContract(contract.id);
                    await onParseContract(contract.id);
                    setParsingContract(null);
                    onRefresh();
                  }}
                  parsing={parsingContract === contract.id}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddInteraction && (
        <AddInteractionModal
          clientId={client.id}
          onAdd={async (type, title, notes, value, product) => {
            await onAddInteraction(client.id, type, title, notes, value, product);
            onRefresh();
            setShowAddInteraction(false);
          }}
          onClose={() => setShowAddInteraction(false)}
        />
      )}

      {showUploadContract && (
        <UploadContractModal
          clientId={client.id}
          onUpload={async (file, title, signedDate) => {
            await onUploadContract(client.id, file, title, signedDate);
            onRefresh();
            setShowUploadContract(false);
          }}
          onClose={() => setShowUploadContract(false)}
        />
      )}

      {showUploadSurvey && (
        <UploadSurveyModal
          clientId={client.id}
          onUpload={async (file, type, period, respondent) => {
            await onUploadSurvey(client.id, file, type, period, respondent);
            onRefresh();
            setShowUploadSurvey(false);
          }}
          onClose={() => setShowUploadSurvey(false)}
        />
      )}
    </div>
  );
}

function AddInteractionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 rounded-xl border-2 border-dashed border-border/50 hover:border-primary/30 text-muted-foreground hover:text-primary text-sm transition-all flex items-center justify-center gap-2"
    >
      <Plus size={16} />
      Registrar interação
    </button>
  );
}

function SurveyCard({ survey }: { survey: Survey }) {
  const typeLabel = { nps: "NPS", csat: "CSAT", ces: "CES", custom: "Customizada" };
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-sm">{survey.title}</p>
          <p className="text-xs text-muted-foreground">{survey.period} · {typeLabel[survey.type]} · {survey.respondent}</p>
        </div>
        {survey.score !== null && (
          <div className="text-right">
            <p className={`text-2xl font-black ${survey.score >= 50 ? "text-green-400" : survey.score >= 0 ? "text-yellow-400" : "text-red-400"}`}>
              {survey.type === "nps" ? (survey.score > 0 ? `+${Math.round(survey.score)}` : Math.round(survey.score)) : survey.score.toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">{typeLabel[survey.type]}</p>
          </div>
        )}
      </div>
      {survey.answers?.summary && (
        <p className="text-xs text-muted-foreground italic">"{survey.answers.summary}"</p>
      )}
    </div>
  );
}

function ContractCard({ contract, onParse, parsing }: { contract: Contract; onParse: () => void; parsing: boolean }) {
  const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n);
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-semibold text-sm">{contract.title}</p>
          <p className="text-xs text-muted-foreground">{contract.file_name}</p>
          {contract.signed_date && (
            <p className="text-xs text-muted-foreground">Assinado em {new Date(contract.signed_date).toLocaleDateString("pt-BR")}</p>
          )}
          {contract.total_value && (
            <p className="text-xs text-green-400 font-medium">{fmt(contract.total_value)} total</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {contract.products_parsed ? (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle size={12} />
              Produtos extraídos
            </span>
          ) : (
            <button
              onClick={onParse}
              disabled={parsing}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors disabled:opacity-50"
            >
              {parsing ? (
                <RefreshCw size={11} className="animate-spin" />
              ) : (
                <Sparkles size={11} />
              )}
              {parsing ? "Extraindo..." : `Extrair com ${AI_NAME}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddInteractionModal({ clientId, onAdd, onClose }: {
  clientId: string;
  onAdd: (type: ClientInteraction["type"], title: string, notes: string, value?: number, product?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [type, setType] = useState<ClientInteraction["type"]>("note");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [value, setValue] = useState("");
  const [product, setProduct] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="font-semibold mb-4">Registrar Interação</h3>
        <div className="space-y-3">
          <select value={type} onChange={(e) => setType(e.target.value as ClientInteraction["type"])}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none">
            {Object.entries(INTERACTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título *"
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none" />
          {(type === "upsell" || type === "delivery") && (
            <div className="grid grid-cols-2 gap-2">
              <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Valor (R$)"
                className="bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none" />
              <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Produto"
                className="bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none" />
            </div>
          )}
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" rows={3}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" />
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-secondary/80">Cancelar</button>
          <button onClick={async () => { if (!title) return; setSaving(true); await onAdd(type, title, notes, value ? parseFloat(value) : undefined, product || undefined); setSaving(false); }}
            disabled={!title || saving} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadContractModal({ clientId, onUpload, onClose }: {
  clientId: string; onUpload: (f: File, t: string, d?: string) => Promise<void>; onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [signedDate, setSignedDate] = useState("");
  const [uploading, setUploading] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl p-6 w-full max-w-md">
        <h3 className="font-semibold mb-4">Subir Contrato</h3>
        <div className="space-y-3">
          <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary/20 file:text-primary file:text-xs file:font-medium" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do contrato *"
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none" />
          <input type="date" value={signedDate} onChange={(e) => setSignedDate(e.target.value)}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none" />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles size={11} className="text-primary" />
            Após subir, use "{AI_NAME}" para extrair os produtos automaticamente
          </p>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-secondary/80">Cancelar</button>
          <button onClick={async () => { if (!file || !title) return; setUploading(true); await onUpload(file, title, signedDate || undefined); setUploading(false); }}
            disabled={!file || !title || uploading} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {uploading ? "Subindo..." : "Subir"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadSurveyModal({ clientId, onUpload, onClose }: {
  clientId: string; onUpload: (f: File, t: "nps" | "csat" | "ces" | "custom", p: string, r: string) => Promise<void>; onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<"nps" | "csat" | "ces" | "custom">("nps");
  const [period, setPeriod] = useState("");
  const [respondent, setRespondent] = useState("");
  const [uploading, setUploading] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-strong rounded-2xl p-6 w-full max-w-md">
        <h3 className="font-semibold mb-4">Subir Pesquisa de Satisfação</h3>
        <div className="space-y-3">
          <input type="file" accept=".csv,.pdf,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-muted-foreground file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary/20 file:text-primary file:text-xs file:font-medium" />
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none">
            <option value="nps">NPS (-100 a 100)</option>
            <option value="csat">CSAT (1-5)</option>
            <option value="ces">CES (1-7)</option>
            <option value="custom">Customizada</option>
          </select>
          <input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="Período (ex: Q1 2026, Jan 2026) *"
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none" />
          <input value={respondent} onChange={(e) => setRespondent(e.target.value)} placeholder="Nome do respondente"
            className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none" />
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles size={11} className="text-primary" />
            {AI_NAME} vai extrair automaticamente o score e os insights
          </p>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-secondary/80">Cancelar</button>
          <button onClick={async () => { if (!file || !period) return; setUploading(true); await onUpload(file, type, period, respondent); setUploading(false); }}
            disabled={!file || !period || uploading} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
            {uploading ? "Processando..." : "Subir"}
          </button>
        </div>
      </div>
    </div>
  );
}
