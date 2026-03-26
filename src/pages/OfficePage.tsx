import { usePresence } from "@/hooks/usePresence";
import { OfficeCanvas } from "@/components/office/OfficeCanvas";
import { StatusSelector } from "@/components/office/StatusSelector";
import { useOfficeStore } from "@/store/officeStore";

export function OfficePage() {
  usePresence();
  const { presences } = useOfficeStore();
  const online = presences.filter((p) => p.status !== "offline").length;

  return (
    <div className="flex flex-col h-full gap-2 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold">
              {online}{" "}
              <span className="font-normal text-muted-foreground">online</span>
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:block">
            Use <kbd className="bg-secondary px-1 rounded text-[10px] font-mono">W A S D</kbd> ou setas para navegar
          </span>
        </div>
        <StatusSelector />
      </div>

      {/* Game canvas — fills all remaining space */}
      <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-border/30">
        <OfficeCanvas />
      </div>
    </div>
  );
}
