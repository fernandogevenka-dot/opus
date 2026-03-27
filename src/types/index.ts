// ─── User & Auth ──────────────────────────────────────────────────────────────

export type UserStatus = "available" | "busy" | "in_meeting" | "away" | "offline";

export type TitleCategory = "sales" | "quality" | "innovation" | "knowledge";

export interface Title {
  id: string;
  name: string;
  category: TitleCategory;
  criteria: string;
  icon: string;
  xp_required: number;
}

export type OpusRole =
  | "admin"
  | "gerencia_peg"
  | "coord_admin"
  | "coord_peg"
  | "colaborador"
  | "pending";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type CargoPrincipal = "Diretor" | "Gerente" | "Coordenador" | "Investidor";

/** Permissões granulares — salvas como JSONB no banco */
export interface UserPermissions {
  ver_todos_projetos: boolean;
  ver_remuneracoes: boolean;
  ver_todos_clientes: boolean;
  ver_financeiro: boolean;
  editar_projetos: boolean;
  editar_colaboradores: boolean;
  gerenciar_squads: boolean;
  aprovar_usuarios: boolean;
  configuracoes: boolean;
}

export interface User {
  id: string;
  google_id: string;
  name: string;
  email: string;
  avatar_url: string;
  team: string;
  role: string;
  opus_role: OpusRole;
  approval_status: ApprovalStatus;
  funcao: string | null;
  cargo_titulo: CargoPrincipal | null;
  squad_id: string | null;
  colaborador_id: string | null;
  permissions: UserPermissions | null;
  title_active_id: string | null;
  title_active?: Title;
  xp: number;
  level: number;
  status: UserStatus;
  created_at: string;
  // Joined via SELECT user_profiles(*) — opcional
  profile?: UserProfile | null;
}

// ─── Profile sub-types ─────────────────────────────────────────────────────────

export type SkillLevel = "basico" | "intermediario" | "avancado" | "especialista";
export type SkillCategory =
  | "trafego"
  | "copy"
  | "crm"
  | "design"
  | "analytics"
  | "gestao"
  | "tech"
  | "vendas"
  | "outro";

export interface ProfileSkill {
  name: string;
  level: SkillLevel;
  category: SkillCategory;
}

export interface CareerEntry {
  company: string;
  role: string;
  start: string;   // "YYYY-MM"
  end: string | null; // null = atual
  description?: string;
}

export interface EducationEntry {
  institution: string;
  degree: string;
  start: string;   // "YYYY"
  end: string | null;
}

export interface CertificationEntry {
  name: string;
  issuer: string;
  date: string;    // "YYYY-MM"
  url?: string;
}

export type Departamento = "01 - ADM" | "02 - Receita" | "03 - PE&G";
export type LocalTrabalho = "🏭 SBS" | "🏠 Home" | "🧬 Híbrido";

/** Perfil rico do usuário — tabela user_profiles (1:1 com users) */
export interface UserProfile {
  user_id: string;

  // Notion link
  notion_email?: string | null;

  // Appearance
  cover_url?: string | null;
  headline?: string | null;   // "Diretor PE&G • Oxicore"
  bio?: string | null;

  // Contact
  phone?: string | null;
  linkedin_url?: string | null;
  secondary_email?: string | null;
  show_phone: boolean;
  show_email: boolean;

  // Oxicore / Notion
  departamento?: Departamento | null;
  squad?: string | null;
  step?: string | null;
  local_trabalho?: LocalTrabalho | null;
  cargo?: string | null;

  // Tenure
  joined_at?: string | null;
  lt_months?: number | null;
  aging_label?: string | null;
  tenure_months?: number | null;  // calculado pela view
  aging_auto?: string | null;     // calculado pela view

  // Structured
  skills: ProfileSkill[];
  career: CareerEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];

  created_at: string;
  updated_at: string;
}

/** UserProfile com campos do usuário enriquecidos (da view user_profiles_enriched) */
export interface UserProfileEnriched extends UserProfile {
  name: string;
  email: string;
  avatar_url: string;
  role: string;
  xp: number;
  level: number;
}

export interface UserPresence {
  user_id: string;
  user?: User;
  room_id: string | null;
  x: number;
  y: number;
  status: UserStatus;
  last_seen: string;
}

// ─── Office / Rooms ───────────────────────────────────────────────────────────

export type RoomType = "sales" | "meeting" | "lounge" | "direction" | "one_on_one" | "general";

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  icon: string;
  participants?: UserPresence[];
}

// ─── Feed & Posts ─────────────────────────────────────────────────────────────

export type PostType =
  | "sale"
  | "feedback"
  | "delivery"
  | "innovation"
  | "ai_solution"
  | "announcement"
  | "celebration";

export interface Post {
  id: string;
  user_id: string;
  user?: User;
  type: PostType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  xp_generated: number;
  reactions?: Reaction[];
  reaction_counts?: Record<string, number>;
  media_url?: string | null;
  media_type?: "image" | "video" | null;
  created_at: string;
}

export type ReactionEmoji = "🔥" | "❤️" | "👏" | "🎯" | "💡";

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  user?: User;
  emoji: ReactionEmoji;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  user?: User;
  content: string;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_user?: User;
  to_user?: User;
  content: string;
  read_at: string | null;
  created_at: string;
}

// ─── Gamification ─────────────────────────────────────────────────────────────

export type XPEventType =
  | "sale_closed"
  | "feedback_received"
  | "delivery_completed"
  | "innovation_implemented"
  | "ai_solution_shared"
  | "learning_track_completed"
  | "post_viral"
  | "daily_presence"
  | "wiki_contribution";

export interface XPEvent {
  id: string;
  user_id: string;
  type: XPEventType;
  xp: number;
  reference_id: string | null;
  description: string;
  created_at: string;
}

export interface UserTitle {
  user_id: string;
  title_id: string;
  title?: Title;
  earned_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  user?: User;
  xp: number;
  rank: number;
  category: TitleCategory | "overall";
  period: "weekly" | "monthly" | "alltime";
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  title: string;
  messages: AIMessage[];
  created_at: string;
  updated_at: string;
}

export interface LearningTrack {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  xp_reward: number;
  challenges: LearningChallenge[];
  completed_by?: string[];
}

export interface LearningChallenge {
  id: string;
  track_id: string;
  order: number;
  title: string;
  description: string;
  initial_code: string;
  language: "python" | "javascript" | "sql";
  solution_hint: string;
}

// ─── Wiki ─────────────────────────────────────────────────────────────────────

export interface WikiPage {
  id: string;
  title: string;
  content: unknown; // TipTap JSON
  parent_id: string | null;
  team_id: string | null;
  author_id: string;
  author?: User;
  icon: string;
  views: number;
  children?: WikiPage[];
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  name: string;
  status: "active" | "at_risk" | "upsell" | "churned" | "prospect";
  nps: number | null;
  csat: number | null;
  mrr: number;
  arr: number;
  ltv: number;
  churn_risk_score: number;
  region: string | null;
  segment: string | null;
  company_size: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  account_manager_id: string | null;
  cs_team_id: string | null;
  team_id: string | null;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Campos do Notion / Oxicore
  start_date?: string | null;
  end_date?: string | null;
  cnpj?: string | null;
  razao_social?: string | null;
  cargo?: string | null;
  cidade?: string | null;
  estado?: string | null;
  stakeholder?: string | null;
  // Jornada do cliente
  journey_stage?: string | null;           // 'onboarding' | 'month_01' .. 'month_24'
  operation_start_date?: string | null;    // data de início da operação
  main_product?: string | null;            // produto principal contratado
  team_name?: string | null;               // nome do squad/time responsável
  situation?: string | null;               // situação resumida
  situation_color?: "green" | "yellow" | "red" | "blue" | "gray" | null;
  // Churn — 3 datas do ciclo de saída
  aviso_previo_date?: string | null;       // dia que o cliente pediu aviso prévio
  ultimo_dia_servico?: string | null;      // até quando vamos trabalhar
  churn_date?: string | null;             // dia do churn financeiro
  financial_churn?: boolean | null;       // churn no mês 1 (redistribui CAC)
  // NocoDB extra fields
  noco_id?: number | null;
  responsavel_financeiro?: string | null;
  cargo_responsavel?: string | null;       // cargo do responsável financeiro
  email_faturamento?: string | null;
  telefone?: string | null;
  problema_financeiro?: boolean | null;
  usa?: boolean | null;
  // Pagamento
  ultimo_pagamento_date?: string | null;
  ultimo_pagamento_valor?: number | null;
  // Documentos do cliente (links externos)
  contrato_url?: string | null;           // link para o contrato assinado
  roi_url?: string | null;                // link para o plano de ROI
  sales_call_url?: string | null;         // link para a gravação da call de vendas
}

export interface ClientDetail extends Client {
  interactions?: ClientInteraction[];
  contracts?: Contract[];
  surveys?: Survey[];
  contracted_products?: ContractedProduct[];
}

export interface ClientInteraction {
  id: string;
  client_id: string;
  type: "meeting" | "email" | "call" | "delivery" | "feedback" | "note" | "upsell" | "contract" | "survey" | "onboarding";
  title: string;
  notes: string;
  value: number | null;
  product: string | null;
  author_id: string;
  author?: User;
  happened_at: string;
  created_at: string;
  google_event_id?: string | null;
}

export interface Contract {
  id: string;
  client_id: string;
  title: string;
  file_path: string;
  file_name: string;
  signed_date: string | null;
  expiry_date: string | null;
  total_value: number | null;
  status: "active" | "expired" | "cancelled" | "pending";
  extracted_text: string | null;
  products_parsed: boolean;
  parsed_at: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ContractedProduct {
  id: string;
  client_id: string;
  product: string;
  description: string | null;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "cancelled" | "suspended" | "renewal_due";
  source: "manual" | "contract_ai" | "crm_sync";
  contract_id: string | null;
  created_at: string;
}

export interface Survey {
  id: string;
  client_id: string;
  title: string;
  type: "nps" | "csat" | "ces" | "custom";
  period: string | null;
  score: number | null;
  respondent: string | null;
  answers: Record<string, unknown>;
  file_path: string | null;
  applied_by: string | null;
  applied_at: string;
  created_at: string;
}

// ─── Client Financials ────────────────────────────────────────────────────────

export interface ClientFinancial {
  id: string;
  client_id: string;
  month: string; // "YYYY-MM-DD" (sempre dia 1 do mês)
  mrr: number;
  cac: number;
  cost_to_serve: number;
  ad_spend: number;
  contribution_margin: number; // gerado pelo banco
  margin_pct: number;          // gerado pelo trigger
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientFinancialSummary {
  ltv_accumulated: number;     // soma de todos os MRR históricos
  cac_total: number;           // soma de todos os CAC lançados
  payback_months: number | null; // cac_total / mrr_avg
  avg_margin_pct: number;      // média das margens mensais
  best_month: ClientFinancial | null;
  worst_month: ClientFinancial | null;
  total_ad_spend: number;
  avg_cost_to_serve: number;
}

export interface TeamCostEntry {
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  role: string;
  hours_month: number;
  hourly_rate: number;
  monthly_cost: number; // calculado: hours × rate
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface KnockNotification {
  from_user_id: string;
  from_user?: User;
  target_user_id: string;
  message: string;
  created_at: string;
}

// ─── Google Workspace ─────────────────────────────────────────────────────────

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  hangoutLink?: string;
  attendees?: { email: string; displayName: string }[];
}
