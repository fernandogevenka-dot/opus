import { useState, useRef } from "react";
import {
  Pencil, Check, X, Plus, Trash2, Linkedin, Phone, Mail,
  MapPin, Building2, Calendar, Clock, Award, GraduationCap,
  Briefcase, Star, ChevronDown, ChevronUp, Upload, Save,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useProfile } from "@/hooks/useProfile";
import type {
  ProfileSkill, CareerEntry, EducationEntry, CertificationEntry,
  SkillLevel, SkillCategory, Departamento, LocalTrabalho,
} from "@/types";

// ─── Paletas ──────────────────────────────────────────────────────────────────

const DEPT_COLOR: Record<string, string> = {
  "01 - ADM":     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "02 - Receita": "bg-green-500/20 text-green-300 border-green-500/30",
  "03 - PE&G":    "bg-purple-500/20 text-purple-300 border-purple-500/30",
};

const SKILL_LEVEL_LABEL: Record<SkillLevel, string> = {
  basico:        "Básico",
  intermediario: "Intermediário",
  avancado:      "Avançado",
  especialista:  "Especialista",
};

const SKILL_LEVEL_COLOR: Record<SkillLevel, string> = {
  basico:        "bg-secondary/60 text-muted-foreground",
  intermediario: "bg-blue-500/20 text-blue-300",
  avancado:      "bg-green-500/20 text-green-300",
  especialista:  "bg-primary/20 text-primary",
};

const AGING_COLOR: Record<string, string> = {
  "🔴": "text-red-400",
  "🟡": "text-yellow-400",
  "🟢": "text-green-400",
  "🔵": "text-blue-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function agingColor(aging?: string | null) {
  if (!aging) return "text-muted-foreground";
  const emoji = aging.slice(0, 2);
  return AGING_COLOR[emoji] ?? "text-muted-foreground";
}

function formatYearMonth(ym: string | null): string {
  if (!ym) return "Presente";
  const [year, month] = ym.split("-");
  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function tenureLabel(months?: number | null): string {
  if (!months) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}m`;
  if (m === 0) return `${y}a`;
  return `${y}a ${m}m`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon, children, action }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-5 border border-border/30">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 rounded-lg hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
    >
      <Pencil size={13} />
    </button>
  );
}

function InlineField({ label, value, onChange, multiline }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="glass rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export function UserProfilePage({ viewUserId }: { viewUserId?: string }) {
  const { user } = useAuthStore();
  const targetId = viewUserId ?? user?.id;
  const isOwn    = !viewUserId || viewUserId === user?.id;

  const {
    profile, notionData, loading, saving,
    saveProfile, addSkill, removeSkill,
    addCareerEntry, removeCareerEntry,
    addEducation, removeEducation,
    addCertification, removeCertification,
  } = useProfile(targetId);

  // ── Edit states ──────────────────────────────────────────────────────────────
  const [editingAbout,    setEditingAbout]   = useState(false);
  const [editingContact,  setEditingContact] = useState(false);
  const [editingOxicore,  setEditingOxicore] = useState(false);
  const [showSkillForm,   setShowSkillForm]  = useState(false);
  const [showCareerForm,  setShowCareerForm] = useState(false);
  const [showEduForm,     setShowEduForm]    = useState(false);
  const [showCertForm,    setShowCertForm]   = useState(false);

  // ── Draft states ─────────────────────────────────────────────────────────────
  const [draftAbout,   setDraftAbout]   = useState({ headline: "", bio: "" });
  const [draftContact, setDraftContact] = useState({ phone: "", linkedin_url: "", secondary_email: "" });
  const [draftOxicore, setDraftOxicore] = useState({
    cargo: "", departamento: "" as Departamento | "",
    squad: "", step: "", local_trabalho: "" as LocalTrabalho | "",
    joined_at: "",
  });

  // ── Skill form ───────────────────────────────────────────────────────────────
  const [skillDraft, setSkillDraft] = useState<ProfileSkill>({
    name: "", level: "intermediario", category: "outro",
  });

  // ── Career form ──────────────────────────────────────────────────────────────
  const [careerDraft, setCareerDraft] = useState<CareerEntry>({
    company: "", role: "", start: "", end: null, description: "",
  });

  // ── Education form ───────────────────────────────────────────────────────────
  const [eduDraft, setEduDraft] = useState<EducationEntry>({
    institution: "", degree: "", start: "", end: null,
  });

  // ── Certification form ───────────────────────────────────────────────────────
  const [certDraft, setCertDraft] = useState<CertificationEntry>({
    name: "", issuer: "", date: "", url: "",
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function startEditAbout() {
    setDraftAbout({ headline: profile?.headline ?? "", bio: profile?.bio ?? "" });
    setEditingAbout(true);
  }

  async function saveAbout() {
    await saveProfile({ headline: draftAbout.headline || null, bio: draftAbout.bio || null });
    setEditingAbout(false);
  }

  function startEditContact() {
    setDraftContact({
      phone: profile?.phone ?? "",
      linkedin_url: profile?.linkedin_url ?? "",
      secondary_email: profile?.secondary_email ?? "",
    });
    setEditingContact(true);
  }

  async function saveContact() {
    await saveProfile({
      phone: draftContact.phone || null,
      linkedin_url: draftContact.linkedin_url || null,
      secondary_email: draftContact.secondary_email || null,
    });
    setEditingContact(false);
  }

  function startEditOxicore() {
    setDraftOxicore({
      cargo:          profile?.cargo          ?? "",
      departamento:   (profile?.departamento  ?? "") as Departamento | "",
      squad:          profile?.squad          ?? "",
      step:           profile?.step           ?? "",
      local_trabalho: (profile?.local_trabalho ?? "") as LocalTrabalho | "",
      joined_at:      profile?.joined_at      ?? "",
    });
    setEditingOxicore(true);
  }

  async function saveOxicore() {
    await saveProfile({
      cargo:          draftOxicore.cargo          || null,
      departamento:   draftOxicore.departamento   as Departamento || null,
      squad:          draftOxicore.squad          || null,
      step:           draftOxicore.step           || null,
      local_trabalho: draftOxicore.local_trabalho as LocalTrabalho || null,
      joined_at:      draftOxicore.joined_at      || null,
    });
    setEditingOxicore(false);
  }

  async function submitSkill() {
    if (!skillDraft.name.trim()) return;
    await addSkill(skillDraft);
    setSkillDraft({ name: "", level: "intermediario", category: "outro" });
    setShowSkillForm(false);
  }

  async function submitCareer() {
    if (!careerDraft.company.trim() || !careerDraft.role.trim()) return;
    await addCareerEntry(careerDraft);
    setCareerDraft({ company: "", role: "", start: "", end: null, description: "" });
    setShowCareerForm(false);
  }

  async function submitEdu() {
    if (!eduDraft.institution.trim()) return;
    await addEducation(eduDraft);
    setEduDraft({ institution: "", degree: "", start: "", end: null });
    setShowEduForm(false);
  }

  async function submitCert() {
    if (!certDraft.name.trim()) return;
    await addCertification(certDraft);
    setCertDraft({ name: "", issuer: "", date: "", url: "" });
    setShowCertForm(false);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-sm animate-pulse">Carregando perfil...</div>
      </div>
    );
  }

  const displayName  = profile?.name  ?? user?.name  ?? "—";
  const displayEmail = profile?.email ?? user?.email ?? "—";
  const avatarUrl    = profile?.avatar_url ?? user?.avatar_url ?? "";
  const coverUrl     = profile?.cover_url ?? null;
  const notionPhoto  = (profile as (typeof profile & { _notion_photo?: string }))?._notion_photo;

  // Tenure
  const tenure = profile?.tenure_months ?? profile?.lt_months ?? null;
  const agingDisplay = profile?.aging_auto ?? profile?.aging_label ?? null;

  return (
    <div className="max-w-3xl mx-auto px-4 pb-10 space-y-4">

      {/* ── Hero card ── */}
      <div className="glass rounded-2xl border border-border/30 overflow-hidden">
        {/* Cover */}
        <div
          className="h-32 bg-gradient-to-r from-primary/30 via-purple-600/20 to-blue-600/20 relative"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
        >
          {isOwn && (
            <label className="absolute top-3 right-3 cursor-pointer bg-black/40 hover:bg-black/60 rounded-lg p-1.5 text-white transition-colors">
              <Upload size={13} />
              <input type="file" className="hidden" accept="image/*" />
            </label>
          )}
        </div>

        {/* Avatar row */}
        <div className="px-5 pb-4">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <div className="relative">
              <img
                src={notionPhoto || avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1e2d4a&color=fff&size=96`}
                alt={displayName}
                className="w-20 h-20 rounded-2xl border-4 border-card object-cover shadow-lg"
              />
              {isOwn && (
                <label className="absolute bottom-0 right-0 cursor-pointer bg-primary rounded-full p-1 shadow">
                  <Pencil size={10} className="text-white" />
                  <input type="file" className="hidden" accept="image/*" />
                </label>
              )}
            </div>
            {isOwn && (
              <button
                onClick={startEditAbout}
                className="glass rounded-xl px-3 py-1.5 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-1.5 border border-border/30"
              >
                <Pencil size={11} />
                Editar perfil
              </button>
            )}
          </div>

          {/* Name + headline */}
          {editingAbout && isOwn ? (
            <div className="space-y-3">
              <InlineField label="Nome" value={profile?.name ?? displayName} onChange={() => {}} />
              <InlineField label="Headline" value={draftAbout.headline} onChange={(v) => setDraftAbout((d) => ({ ...d, headline: v }))} />
              <InlineField label="Bio / Sobre" value={draftAbout.bio} onChange={(v) => setDraftAbout((d) => ({ ...d, bio: v }))} multiline />
              <div className="flex gap-2">
                <button onClick={saveAbout} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  <Save size={11} /> {saving ? "Salvando..." : "Salvar"}
                </button>
                <button onClick={() => setEditingAbout(false)} className="px-3 py-1.5 rounded-xl glass text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold leading-tight">{displayName}</h1>
              {profile?.headline && (
                <p className="text-sm text-muted-foreground mt-0.5">{profile.headline}</p>
              )}
              {profile?.bio && (
                <p className="text-sm mt-2 text-foreground/80 whitespace-pre-line">{profile.bio}</p>
              )}
            </>
          )}

          {/* Tags rápidas */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {profile?.departamento && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${DEPT_COLOR[profile.departamento] ?? "bg-secondary/60 text-foreground border-border/30"}`}>
                {profile.departamento}
              </span>
            )}
            {profile?.squad && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary/60 text-xs border border-border/30">
                {profile.squad}
              </span>
            )}
            {profile?.step && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/15 text-primary/90 text-xs border border-primary/20">
                {profile.step}
              </span>
            )}
            {profile?.local_trabalho && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-secondary/60 text-xs border border-border/30">
                {profile.local_trabalho}
              </span>
            )}
            {agingDisplay && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full bg-secondary/60 text-xs border border-border/30 ${agingColor(agingDisplay)}`}>
                <Clock size={10} className="mr-1" />
                {agingDisplay}
                {tenure && <span className="ml-1 text-muted-foreground">({tenureLabel(tenure)})</span>}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Oxicore / Notion (dados da empresa) ── */}
      <SectionCard title="Oxicore" icon={<Building2 size={14} />} action={isOwn ? <EditBtn onClick={startEditOxicore} /> : null}>
        {editingOxicore && isOwn ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <InlineField label="Cargo" value={draftOxicore.cargo} onChange={(v) => setDraftOxicore((d) => ({ ...d, cargo: v }))} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Departamento</label>
                <select
                  value={draftOxicore.departamento}
                  onChange={(e) => setDraftOxicore((d) => ({ ...d, departamento: e.target.value as Departamento | "" }))}
                  className="glass rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="01 - ADM">01 - ADM</option>
                  <option value="02 - Receita">02 - Receita</option>
                  <option value="03 - PE&G">03 - PE&G</option>
                </select>
              </div>
              <InlineField label="Squad" value={draftOxicore.squad} onChange={(v) => setDraftOxicore((d) => ({ ...d, squad: v }))} />
              <InlineField label="STEP" value={draftOxicore.step} onChange={(v) => setDraftOxicore((d) => ({ ...d, step: v }))} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Local</label>
                <select
                  value={draftOxicore.local_trabalho}
                  onChange={(e) => setDraftOxicore((d) => ({ ...d, local_trabalho: e.target.value as LocalTrabalho | "" }))}
                  className="glass rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="🏭 SBS">🏭 SBS</option>
                  <option value="🏠 Home">🏠 Home</option>
                  <option value="🧬 Híbrido">🧬 Híbrido</option>
                </select>
              </div>
              <InlineField label="Data de entrada" value={draftOxicore.joined_at} onChange={(v) => setDraftOxicore((d) => ({ ...d, joined_at: v }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveOxicore} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                <Save size={11} /> {saving ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setEditingOxicore(false)} className="px-3 py-1.5 rounded-xl glass text-xs text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {[
              { label: "Cargo",        value: profile?.cargo         },
              { label: "Departamento", value: profile?.departamento  },
              { label: "Squad",        value: profile?.squad         },
              { label: "STEP",         value: profile?.step          },
              { label: "Local",        value: profile?.local_trabalho },
              { label: "Entrada",      value: profile?.joined_at     },
            ].map(({ label, value }) => value ? (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-24 flex-shrink-0">{label}</span>
                <span className="text-sm">{value}</span>
              </div>
            ) : null)}
            {/* Dados do Notion (read-only overlay) */}
            {notionData && !profile?.cargo && (
              <div className="col-span-2 mt-2 p-2 rounded-lg bg-secondary/30 text-xs text-muted-foreground flex items-center gap-2">
                <span className="text-yellow-400">⚡</span>
                Dados pré-preenchidos do Notion — clique em editar para confirmar.
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Contato ── */}
      <SectionCard title="Contato" icon={<Phone size={14} />} action={isOwn ? <EditBtn onClick={startEditContact} /> : null}>
        {editingContact && isOwn ? (
          <div className="space-y-3">
            <InlineField label="Telefone" value={draftContact.phone} onChange={(v) => setDraftContact((d) => ({ ...d, phone: v }))} />
            <InlineField label="LinkedIn URL" value={draftContact.linkedin_url} onChange={(v) => setDraftContact((d) => ({ ...d, linkedin_url: v }))} />
            <InlineField label="E-mail secundário" value={draftContact.secondary_email} onChange={(v) => setDraftContact((d) => ({ ...d, secondary_email: v }))} />
            <div className="flex gap-2">
              <button onClick={saveContact} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                <Save size={11} /> {saving ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setEditingContact(false)} className="px-3 py-1.5 rounded-xl glass text-xs text-muted-foreground hover:text-foreground transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail size={13} />
              <span>{displayEmail}</span>
            </div>
            {profile?.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={13} />
                <a href={`tel:${profile.phone}`} className="hover:text-foreground transition-colors">{profile.phone}</a>
              </div>
            )}
            {profile?.linkedin_url && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Linkedin size={13} />
                <a href={profile.linkedin_url.startsWith("http") ? profile.linkedin_url : `https://${profile.linkedin_url}`} target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors truncate">
                  {profile.linkedin_url}
                </a>
              </div>
            )}
            {(!profile?.phone && !profile?.linkedin_url) && (
              <p className="text-xs text-muted-foreground/60 italic">
                {isOwn ? "Adicione seus contatos clicando em editar." : "Contato não informado."}
              </p>
            )}
          </div>
        )}
      </SectionCard>

      {/* ── Skills ── */}
      <SectionCard
        title="Habilidades"
        icon={<Star size={14} />}
        action={isOwn ? (
          <button onClick={() => setShowSkillForm((v) => !v)} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus size={12} /> Adicionar
          </button>
        ) : null}
      >
        {/* Form */}
        {showSkillForm && isOwn && (
          <div className="mb-4 p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <InlineField label="Skill" value={skillDraft.name} onChange={(v) => setSkillDraft((d) => ({ ...d, name: v }))} />
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Nível</label>
                <select value={skillDraft.level} onChange={(e) => setSkillDraft((d) => ({ ...d, level: e.target.value as SkillLevel }))} className="glass rounded-xl px-2 py-2 text-xs focus:outline-none">
                  <option value="basico">Básico</option>
                  <option value="intermediario">Intermediário</option>
                  <option value="avancado">Avançado</option>
                  <option value="especialista">Especialista</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Categoria</label>
                <select value={skillDraft.category} onChange={(e) => setSkillDraft((d) => ({ ...d, category: e.target.value as SkillCategory }))} className="glass rounded-xl px-2 py-2 text-xs focus:outline-none">
                  <option value="trafego">Tráfego</option>
                  <option value="copy">Copy</option>
                  <option value="crm">CRM</option>
                  <option value="design">Design</option>
                  <option value="analytics">Analytics</option>
                  <option value="gestao">Gestão</option>
                  <option value="tech">Tech</option>
                  <option value="vendas">Vendas</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submitSkill} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors">
                <Check size={11} /> Adicionar
              </button>
              <button onClick={() => setShowSkillForm(false)} className="px-3 py-1.5 rounded-xl glass text-xs text-muted-foreground transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {(profile?.skills ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">
            {isOwn ? "Adicione suas habilidades clicando em + Adicionar." : "Nenhuma habilidade cadastrada."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(profile?.skills ?? []).map((s) => (
              <div
                key={s.name}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/30 text-xs ${SKILL_LEVEL_COLOR[s.level]}`}
              >
                <span className="font-medium">{s.name}</span>
                <span className="opacity-60">· {SKILL_LEVEL_LABEL[s.level]}</span>
                {isOwn && (
                  <button onClick={() => removeSkill(s.name)} className="opacity-40 hover:opacity-100 ml-0.5">
                    <X size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Experiência ── */}
      <SectionCard
        title="Experiência"
        icon={<Briefcase size={14} />}
        action={isOwn ? (
          <button onClick={() => setShowCareerForm((v) => !v)} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus size={12} /> Adicionar
          </button>
        ) : null}
      >
        {showCareerForm && isOwn && (
          <div className="mb-4 p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <InlineField label="Empresa" value={careerDraft.company} onChange={(v) => setCareerDraft((d) => ({ ...d, company: v }))} />
              <InlineField label="Cargo" value={careerDraft.role} onChange={(v) => setCareerDraft((d) => ({ ...d, role: v }))} />
              <InlineField label="Início (AAAA-MM)" value={careerDraft.start} onChange={(v) => setCareerDraft((d) => ({ ...d, start: v }))} />
              <InlineField label="Término (AAAA-MM ou vazio)" value={careerDraft.end ?? ""} onChange={(v) => setCareerDraft((d) => ({ ...d, end: v || null }))} />
            </div>
            <InlineField label="Descrição" value={careerDraft.description ?? ""} onChange={(v) => setCareerDraft((d) => ({ ...d, description: v }))} multiline />
            <div className="flex gap-2">
              <button onClick={submitCareer} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors">
                <Check size={11} /> Adicionar
              </button>
              <button onClick={() => setShowCareerForm(false)} className="px-3 py-1.5 rounded-xl glass text-xs text-muted-foreground transition-colors">Cancelar</button>
            </div>
          </div>
        )}

        {(profile?.career ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">
            {isOwn ? "Adicione sua experiência profissional." : "Nenhuma experiência cadastrada."}
          </p>
        ) : (
          <div className="space-y-4">
            {(profile?.career ?? []).map((c, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Briefcase size={14} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{c.role}</p>
                      <p className="text-xs text-muted-foreground">{c.company}</p>
                      <p className="text-xs text-muted-foreground/60 mt-0.5">
                        {formatYearMonth(c.start)} — {formatYearMonth(c.end)}
                      </p>
                    </div>
                    {isOwn && (
                      <button onClick={() => removeCareerEntry(i)} className="text-muted-foreground/40 hover:text-destructive transition-colors flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground/70 mt-1">{c.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Educação ── */}
      <SectionCard
        title="Educação"
        icon={<GraduationCap size={14} />}
        action={isOwn ? (
          <button onClick={() => setShowEduForm((v) => !v)} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus size={12} /> Adicionar
          </button>
        ) : null}
      >
        {showEduForm && isOwn && (
          <div className="mb-4 p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <InlineField label="Instituição" value={eduDraft.institution} onChange={(v) => setEduDraft((d) => ({ ...d, institution: v }))} />
              <InlineField label="Curso / Grau" value={eduDraft.degree} onChange={(v) => setEduDraft((d) => ({ ...d, degree: v }))} />
              <InlineField label="Início (AAAA)" value={eduDraft.start} onChange={(v) => setEduDraft((d) => ({ ...d, start: v }))} />
              <InlineField label="Término (AAAA)" value={eduDraft.end ?? ""} onChange={(v) => setEduDraft((d) => ({ ...d, end: v || null }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={submitEdu} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors">
                <Check size={11} /> Adicionar
              </button>
              <button onClick={() => setShowEduForm(false)} className="px-3 py-1.5 rounded-xl glass text-xs text-muted-foreground transition-colors">Cancelar</button>
            </div>
          </div>
        )}

        {(profile?.education ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">
            {isOwn ? "Adicione sua formação acadêmica." : "Nenhuma formação cadastrada."}
          </p>
        ) : (
          <div className="space-y-3">
            {(profile?.education ?? []).map((e, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={14} className="text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{e.institution}</p>
                      <p className="text-xs text-muted-foreground">{e.degree}</p>
                      <p className="text-xs text-muted-foreground/60">{e.start} — {e.end ?? "Presente"}</p>
                    </div>
                    {isOwn && (
                      <button onClick={() => removeEducation(i)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Certificações ── */}
      <SectionCard
        title="Certificações"
        icon={<Award size={14} />}
        action={isOwn ? (
          <button onClick={() => setShowCertForm((v) => !v)} className="flex items-center gap-1 text-xs text-primary hover:underline">
            <Plus size={12} /> Adicionar
          </button>
        ) : null}
      >
        {showCertForm && isOwn && (
          <div className="mb-4 p-3 rounded-xl bg-secondary/30 border border-border/30 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <InlineField label="Nome" value={certDraft.name} onChange={(v) => setCertDraft((d) => ({ ...d, name: v }))} />
              <InlineField label="Emissor" value={certDraft.issuer} onChange={(v) => setCertDraft((d) => ({ ...d, issuer: v }))} />
              <InlineField label="Data (AAAA-MM)" value={certDraft.date} onChange={(v) => setCertDraft((d) => ({ ...d, date: v }))} />
              <InlineField label="URL (opcional)" value={certDraft.url ?? ""} onChange={(v) => setCertDraft((d) => ({ ...d, url: v }))} />
            </div>
            <div className="flex gap-2">
              <button onClick={submitCert} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors">
                <Check size={11} /> Adicionar
              </button>
              <button onClick={() => setShowCertForm(false)} className="px-3 py-1.5 rounded-xl glass text-xs text-muted-foreground transition-colors">Cancelar</button>
            </div>
          </div>
        )}

        {(profile?.certifications ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic">
            {isOwn ? "Adicione suas certificações." : "Nenhuma certificação cadastrada."}
          </p>
        ) : (
          <div className="space-y-2">
            {(profile?.certifications ?? []).map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/20 border border-border/20">
                <Award size={14} className="text-yellow-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.issuer} · {c.date}</p>
                </div>
                {c.url && (
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex-shrink-0">
                    Ver
                  </a>
                )}
                {isOwn && (
                  <button onClick={() => removeCertification(i)} className="text-muted-foreground/40 hover:text-destructive transition-colors">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

    </div>
  );
}
