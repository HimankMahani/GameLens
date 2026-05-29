"use client";

import { FC } from "react";
import { X, ChevronRight } from "lucide-react";
import { parsePgnHeaders } from "@/lib/pgnFetch";

interface GameChooserProps {
  games: string[];
  onPick: (pgn: string) => void;
  onClose: () => void;
}

const GameChooser: FC<GameChooserProps> = ({ games, onPick, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <div className="relative bg-surface ring-1 ring-muted/40 rounded-2xl shadow-2xl w-full max-w-lg p-5 animate-[slide-up_240ms_ease-out_both]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-fg">Choose a game</p>
          <p className="text-[10px] text-muted/70">Detected {games.length} games in the PGN</p>
        </div>
        <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
          <X size={16} />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto -mx-1 px-1 space-y-1">
        {games.map((pgn, i) => {
          const h = parsePgnHeaders(pgn);
          const movesPreview = (pgn.match(/1\.\s+\S+(?:\s+\S+)?/)?.[0] ?? "").slice(0, 40);
          return (
            <button
              key={i}
              onClick={() => onPick(pgn)}
              className="group w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-bg/40 hover:bg-bg/70 ring-1 ring-muted/20 hover:ring-muted/40 transition-colors text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-fg truncate">
                  {h.white || "?"}
                  {h.whiteElo && <span className="text-muted"> ({h.whiteElo})</span>}
                  <span className="text-muted/70 px-1.5">vs</span>
                  {h.black || "?"}
                  {h.blackElo && <span className="text-muted"> ({h.blackElo})</span>}
                </p>
                <p className="text-[10px] text-muted/70 truncate">
                  {h.event || "?"}
                  {h.date && ` · ${h.date}`}
                  {h.result && ` · ${h.result}`}
                </p>
                {movesPreview && (
                  <p className="text-[10px] text-muted font-mono truncate mt-0.5">{movesPreview}…</p>
                )}
              </div>
              <ChevronRight
                size={14}
                className="text-muted/40 group-hover:text-fg transition-colors shrink-0"
              />
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default GameChooser;
