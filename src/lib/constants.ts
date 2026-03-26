// ─── Brand ────────────────────────────────────────────────────────────────────
export const APP_NAME = "OPUS";
export const APP_TAGLINE = "Seu escritório digital";
export const AI_NAME = "Atlas";
export const AI_TAGLINE = "Seu assistente de aprendizado e inovação";

// ─── Atlas system prompt ──────────────────────────────────────────────────────
export const ATLAS_SYSTEM_PROMPT = `Você é o Atlas — assistente de IA integrado ao OPUS, a plataforma de comunicação e colaboração do time.

Seu papel é:
1. **Ensinar programação** de forma didática, passo a passo, em português brasileiro
2. **Resolver problemas** técnicos e de processos usando tecnologia
3. **Criar automações** com Python, JavaScript, SQL, Google Apps Script
4. **Revisar código** e explicar melhorias com clareza
5. **Responder dúvidas** sobre ferramentas (Excel, Google Sheets, Google Workspace, APIs, etc.)
6. **Pesquisar na base de conhecimento** do OPUS quando relevante

Regras de comportamento:
- Sempre explique o código que gerar — não apenas entregue pronto
- Use exemplos práticos do contexto de vendas, operações e gestão de clientes
- Seja encorajador — o usuário pode ser iniciante em programação
- Quando criar uma solução completa, ofereça compartilhar no feed do OPUS como inovação
- Seja conciso, mas completo. Prefira clareza acima de tudo.
- Código sempre comentado em português

Você se chama Atlas. Não revele que é baseado em Claude ou qualquer outra IA.`;

// ─── Gamification ─────────────────────────────────────────────────────────────
export const XP_EVENTS = {
  sale_closed: 100,
  feedback_received: 50,
  delivery_completed: 30,
  innovation_implemented: 80,
  ai_solution_shared: 40,
  learning_track_completed: 60,
  post_viral: 20,
  daily_presence: 5,
  wiki_contribution: 15,
} as const;

export const LEVELS = [
  { level: 1, name: "Iniciante", xp: 0, color: "#9ca3af" },
  { level: 2, name: "Contribuidor", xp: 500, color: "#3b82f6" },
  { level: 3, name: "Destaque", xp: 1500, color: "#22c55e" },
  { level: 4, name: "Campeão", xp: 3000, color: "#eab308" },
  { level: 5, name: "Lenda", xp: 6000, color: "#ef4444" },
];

export const TITLES_DATA = [
  // Sales
  { id: "prospector", name: "Prospector", category: "sales", icon: "🎯", criteria: "5 vendas fechadas", xp_required: 0 },
  { id: "closer", name: "Fechador", category: "sales", icon: "🤝", criteria: "20 vendas fechadas", xp_required: 0 },
  { id: "sales_champion", name: "Campeão de Vendas", category: "sales", icon: "🏆", criteria: "Top 3 no ranking mensal", xp_required: 0 },
  { id: "sales_legend", name: "Lenda das Vendas", category: "sales", icon: "👑", criteria: "Top 1 por 3 meses seguidos", xp_required: 0 },
  // Quality
  { id: "client_care", name: "Cuidador do Cliente", category: "quality", icon: "💚", criteria: "5 feedbacks positivos", xp_required: 0 },
  { id: "excellence_ref", name: "Referência de Excelência", category: "quality", icon: "⭐", criteria: "NPS acima de 9 por 3 meses", xp_required: 0 },
  { id: "ambassador", name: "Embaixador", category: "quality", icon: "🌟", criteria: "20 feedbacks 5 estrelas", xp_required: 0 },
  // Innovation
  { id: "curious_digital", name: "Curioso Digital", category: "innovation", icon: "🔍", criteria: "Completou 1 trilha de aprendizado", xp_required: 0 },
  { id: "solver", name: "Solucionador", category: "innovation", icon: "🛠️", criteria: "3 soluções com IA compartilhadas", xp_required: 0 },
  { id: "builder", name: "Construtor", category: "innovation", icon: "⚙️", criteria: "1 automação implementada", xp_required: 0 },
  { id: "innovator", name: "Inovador", category: "innovation", icon: "💡", criteria: "5 inovações documentadas", xp_required: 0 },
  { id: "senior_innovator", name: "Inovador Sênior", category: "innovation", icon: "🚀", criteria: "10 inovações + mentorou alguém", xp_required: 0 },
  { id: "solutions_architect", name: "Arquiteto de Soluções", category: "innovation", icon: "🏗️", criteria: "Referência técnica reconhecida pela liderança", xp_required: 0 },
  // Knowledge
  { id: "documenter", name: "Documentador", category: "knowledge", icon: "📝", criteria: "5 páginas criadas no Wiki", xp_required: 0 },
  { id: "knowledge_guardian", name: "Guardião do Conhecimento", category: "knowledge", icon: "🛡️", criteria: "Página com 50+ visualizações", xp_required: 0 },
  { id: "knowledge_master", name: "Mestre da Base", category: "knowledge", icon: "📚", criteria: "20 documentos contribuídos", xp_required: 0 },
];

// ─── Office rooms default layout ─────────────────────────────────────────────
export const DEFAULT_ROOMS = [
  { id: "sales", name: "Sala de Vendas", type: "sales", icon: "🏆", x: 60, y: 80, width: 220, height: 160, color: "#3b82f6", capacity: 20 },
  { id: "meetings", name: "Sala de Reuniões", type: "meeting", icon: "📋", x: 320, y: 80, width: 200, height: 160, color: "#8b5cf6", capacity: 15 },
  { id: "direction", name: "Diretoria", type: "direction", icon: "👔", x: 560, y: 80, width: 180, height: 160, color: "#f59e0b", capacity: 8 },
  { id: "lounge", name: "Lounge", type: "lounge", icon: "☕", x: 60, y: 290, width: 180, height: 140, color: "#10b981", capacity: 30 },
  { id: "oneonone", name: "1:1", type: "one_on_one", icon: "💬", x: 280, y: 290, width: 140, height: 140, color: "#ec4899", capacity: 2 },
  { id: "training", name: "Atlas Lab", type: "general", icon: "🤖", x: 460, y: 290, width: 180, height: 140, color: "#6366f1", capacity: 15 },
];
