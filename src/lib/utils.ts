import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatXP(xp: number): string {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}k`;
  return xp.toString();
}

export function getLevelFromXP(xp: number): number {
  const thresholds = [0, 500, 1500, 3000, 6000];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i]) return i + 1;
  }
  return 1;
}

export function getLevelName(level: number): string {
  const names = ["", "Iniciante", "Contribuidor", "Destaque", "Campeão", "Lenda"];
  return names[level] ?? "Lenda";
}

export function getXPForNextLevel(xp: number): { current: number; next: number; progress: number } {
  const thresholds = [0, 500, 1500, 3000, 6000];
  const level = getLevelFromXP(xp);
  const current = thresholds[level - 1] ?? 0;
  const next = thresholds[level] ?? 9999999;
  const progress = next === 9999999 ? 100 : Math.round(((xp - current) / (next - current)) * 100);
  return { current: xp - current, next: next - current, progress };
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    available: "#22c55e",
    busy: "#eab308",
    in_meeting: "#ef4444",
    away: "#6b7280",
    offline: "#374151",
  };
  return colors[status] ?? "#6b7280";
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    available: "Disponível",
    busy: "Ocupado",
    in_meeting: "Em reunião",
    away: "Ausente",
    offline: "Offline",
  };
  return labels[status] ?? "Desconhecido";
}

export function getPostTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    sale: "🏆",
    feedback: "⭐",
    delivery: "✅",
    innovation: "💡",
    ai_solution: "🛠️",
    announcement: "📢",
    celebration: "🎉",
  };
  return icons[type] ?? "📝";
}

export function getPostTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    sale: "Venda Fechada",
    feedback: "Feedback Recebido",
    delivery: "Entrega Concluída",
    innovation: "Inovação",
    ai_solution: "Solução com IA",
    announcement: "Comunicado",
    celebration: "Celebração",
  };
  return labels[type] ?? "Post";
}

export function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d atrás`;
  return d.toLocaleDateString("pt-BR");
}

export function generateRoomColor(type: string): number {
  const colors: Record<string, number> = {
    sales: 0x3b82f6,
    meeting: 0x8b5cf6,
    lounge: 0x10b981,
    direction: 0xf59e0b,
    one_on_one: 0xec4899,
    general: 0x6b7280,
  };
  return colors[type] ?? 0x6b7280;
}
