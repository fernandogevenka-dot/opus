import { useState } from "react";
import { useOfficeStore } from "@/store/officeStore";
import { Video, Users, Plus, Lock, Unlock, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface MeetingRoom {
  id: string;
  name: string;
  icon: string;
  meetCode: string;
  participants: string[];
  isPrivate: boolean;
  description: string;
}

const PERMANENT_ROOMS: MeetingRoom[] = [
  { id: "1", name: "Daily de Vendas", icon: "🏆", meetCode: "opus-daily-vendas", participants: [], isPrivate: false, description: "Reunião diária do time de vendas" },
  { id: "2", name: "Liderança", icon: "👔", meetCode: "opus-lideranca", participants: [], isPrivate: true, description: "Reunião de diretoria e líderes" },
  { id: "3", name: "Atendimento", icon: "📞", meetCode: "opus-atendimento", participants: [], isPrivate: false, description: "Suporte e atendimento ao cliente" },
  { id: "4", name: "1:1 Rápido", icon: "💬", meetCode: "opus-oneonone", participants: [], isPrivate: false, description: "Conversas rápidas entre dois" },
  { id: "5", name: "Atlas Lab", icon: "🤖", meetCode: "opus-atlas-lab", participants: [], isPrivate: false, description: "Sessões de treinamento e inovação" },
  { id: "6", name: "All Hands", icon: "🌐", meetCode: "opus-all-hands", participants: [], isPrivate: false, description: "Reunião geral da empresa" },
];

export function MeetingsPage() {
  const [activeMeet, setActiveMeet] = useState<string | null>(null);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const { presences } = useOfficeStore();

  function joinRoom(room: MeetingRoom) {
    setActiveMeet(room.meetCode);
  }

  function openInNewWindow(meetCode: string) {
    window.open(`https://meet.google.com/${meetCode}`, "_blank");
  }

  return (
    <div className="flex h-full gap-4">
      {/* Rooms list */}
      <div className="w-64 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Salas de Reunião</h2>
          <button
            onClick={() => setShowNewRoom(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex-1 space-y-1.5">
          {PERMANENT_ROOMS.map((room) => {
            const inRoom = presences.filter((p) => p.room_id === room.id);
            const isActive = activeMeet === room.meetCode;

            return (
              <motion.button
                key={room.id}
                onClick={() => joinRoom(room)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className={`w-full p-3 rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-primary/20 border border-primary/40"
                    : "glass border-border/50 hover:border-primary/30"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{room.icon}</span>
                  <span className="text-sm font-medium flex-1 truncate">{room.name}</span>
                  {room.isPrivate ? (
                    <Lock size={11} className="text-muted-foreground flex-shrink-0" />
                  ) : (
                    <Unlock size={11} className="text-muted-foreground flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-tight">{room.description}</p>

                {inRoom.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    <div className="flex -space-x-1">
                      {inRoom.slice(0, 3).map((p) => (
                        <img
                          key={p.user_id}
                          src={p.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user?.name ?? "?")}&size=20&background=1e2d4a&color=fff`}
                          className="w-5 h-5 rounded-full ring-1 ring-background"
                          alt=""
                        />
                      ))}
                    </div>
                    <span className="text-xs text-green-400">{inRoom.length} dentro</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>

        {/* New room form */}
        {showNewRoom && (
          <div className="glass rounded-xl p-3 space-y-2">
            <p className="text-xs font-medium">Nova sala temporária</p>
            <input
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              placeholder="Nome da sala"
              className="w-full bg-secondary/50 border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-1">
              <button
                onClick={() => {
                  if (newRoomName.trim()) {
                    const code = `opus-temp-${newRoomName.toLowerCase().replace(/\s+/g, "-")}`;
                    setActiveMeet(code);
                    setShowNewRoom(false);
                    setNewRoomName("");
                  }
                }}
                className="flex-1 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-xs font-medium transition-colors"
              >
                Criar
              </button>
              <button onClick={() => setShowNewRoom(false)} className="px-2 rounded-lg hover:bg-secondary/80 text-muted-foreground text-xs transition-colors">
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Meet embed */}
      <div className="flex-1 flex flex-col">
        {activeMeet ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-medium">Em reunião</span>
                <code className="text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-lg">{activeMeet}</code>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openInNewWindow(activeMeet)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink size={12} />
                  Nova janela
                </button>
                <button
                  onClick={() => setActiveMeet(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-medium transition-colors"
                >
                  Sair
                </button>
              </div>
            </div>

            <div className="flex-1 rounded-2xl overflow-hidden border border-border/50">
              <iframe
                src={`https://meet.google.com/${activeMeet}`}
                className="w-full h-full border-0"
                allow="camera; microphone; display-capture; autoplay; clipboard-read; clipboard-write"
                allowFullScreen
                title="Google Meet"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500/20 to-purple-600/20 flex items-center justify-center">
              <Video size={36} className="text-primary opacity-60" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground text-lg">Salas de Reunião</p>
              <p className="text-sm mt-1">Selecione uma sala à esquerda para entrar</p>
              <p className="text-xs mt-1 opacity-60">Google Meet integrado — áudio e vídeo direto no OPUS</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
