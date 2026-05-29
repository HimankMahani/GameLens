"use client";

import { FC } from "react";
import { Bot, Loader2 } from "lucide-react";
import { ELO_PRESETS } from "@/lib/enginePlay";

interface PlayVsEnginePanelProps {
  playSide: "white" | "black" | null;
  onPlaySideChange: (side: "white" | "black" | null) => void;
  elo: number;
  onEloChange: (elo: number) => void;
  thinking: boolean;
}

const PlayVsEnginePanel: FC<PlayVsEnginePanelProps> = ({
  playSide,
  onPlaySideChange,
  elo,
  onEloChange,
  thinking,
}) => (
  <div className="bg-surface/60 ring-1 ring-muted/20 rounded-2xl overflow-hidden animate-[fade-in_300ms_ease-out]">
    <div className="px-4 py-3 border-b border-muted/25 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Bot size={14} className={playSide ? "text-cyan-300" : "text-muted/70"} />
        <span className="text-xs text-fg/65 font-medium">Play vs engine</span>
        {thinking && (
          <span className="flex items-center gap-1 text-[10px] text-cyan-300 ml-1">
            <Loader2 size={10} className="animate-spin" /> thinking…
          </span>
        )}
      </div>
      {playSide && (
        <button
          onClick={() => onPlaySideChange(null)}
          className="text-[10px] text-muted hover:text-fg/90 transition-colors"
        >
          Stop
        </button>
      )}
    </div>

    <div className="px-4 py-3 space-y-2.5">
      {!playSide ? (
        <>
          <p className="text-[10px] text-muted/70">Pick your side to start a game.</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => onPlaySideChange("white")}
              className="px-3 py-2 rounded-lg bg-bg/60 hover:bg-bg/90 ring-1 ring-muted/30 text-xs text-fg/90 transition-colors"
            >
              Play as ♔ White
            </button>
            <button
              onClick={() => onPlaySideChange("black")}
              className="px-3 py-2 rounded-lg bg-bg/60 hover:bg-bg/90 ring-1 ring-muted/30 text-xs text-fg/90 transition-colors"
            >
              Play as ♚ Black
            </button>
          </div>
        </>
      ) : (
        <div className="text-[10px] text-muted/70">
          You are playing <span className="text-fg/90 capitalize">{playSide}</span>.
          Make a move on the board; the engine will reply.
        </div>
      )}

      <div>
        <p className="text-[10px] text-muted/70 mb-1">Engine strength</p>
        <div className="flex flex-wrap gap-1">
          {ELO_PRESETS.map((e) => (
            <button
              key={e}
              onClick={() => onEloChange(e)}
              className={`px-2 py-1 rounded text-[10px] font-mono transition-colors ${
                elo === e
                  ? "bg-[var(--main)] text-bg"
                  : "text-muted hover:text-fg/80 hover:bg-bg/40"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default PlayVsEnginePanel;
