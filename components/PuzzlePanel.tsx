"use client";

import { FC } from "react";
import { Target, X, CheckCircle2, RotateCcw, Eye } from "lucide-react";
import type { AnalyzedMove } from "@/lib/analysis";

interface PuzzlePanelProps {
  move: AnalyzedMove;
  attempted: string | null;
  solved: boolean;
  failed: boolean;
  revealed: boolean;
  onReveal: () => void;
  onRetry: () => void;
  onExit: () => void;
  onNext?: () => void;
  /** Session stats: number solved / total attempted in this run. */
  session?: { solved: number; attempted: number };
}

const PuzzlePanel: FC<PuzzlePanelProps> = ({
  move,
  attempted,
  solved,
  failed,
  revealed,
  onReveal,
  onRetry,
  onExit,
  onNext,
  session,
}) => {
  const sideName = move.color === "w" ? "White" : "Black";

  return (
    <div className="bg-surface/70 ring-2 ring-cyan-500/40 rounded-2xl p-5 animate-[pop-in_320ms_cubic-bezier(0.34,1.56,0.64,1)_both]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-cyan-300" />
          <p className="text-xs uppercase tracking-[0.18em] font-medium text-cyan-300">
            Puzzle · {sideName} to move
          </p>
        </div>
        <div className="flex items-center gap-2">
          {session && session.attempted > 0 && (
            <span className="text-[10px] text-muted/70 tabular-nums">
              {session.solved}/{session.attempted}
            </span>
          )}
          <button onClick={onExit} className="text-muted hover:text-fg transition-colors" title="Exit puzzle">
            <X size={14} />
          </button>
        </div>
      </div>

      {!solved && !failed && !revealed && (
        <>
          <p className="text-sm text-fg/90 leading-snug">
            Find {sideName === "White" ? "White's" : "Black's"} best move. The game
            played <span className="font-mono text-orange-300">{move.san}</span> here — a {move.classification}.
          </p>
          <p className="text-[10px] text-muted/70 mt-2">
            Drag a piece on the board to attempt.
          </p>
        </>
      )}

      {solved && (
        <div className="flex items-start gap-2 animate-[fade-in_220ms_ease-out]">
          <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-emerald-300 font-medium">Solved!</p>
            <p className="text-[11px] text-fg/80 mt-0.5">
              You found <span className="font-mono">{move.bestMoveSan ?? move.bestMoveUci}</span>.
            </p>
          </div>
        </div>
      )}

      {failed && !revealed && (
        <div className="space-y-2 animate-[fade-in_220ms_ease-out]">
          <p className="text-sm text-orange-300">
            Not the best. You tried <span className="font-mono">{attempted}</span>.
          </p>
          <p className="text-[11px] text-fg/65">Try again or reveal the answer.</p>
        </div>
      )}

      {revealed && (
        <div className="space-y-1 animate-[fade-in_220ms_ease-out]">
          <p className="text-sm text-fg">
            Engine's best: <span className="font-mono text-emerald-300">{move.bestMoveSan ?? move.bestMoveUci}</span>
          </p>
          {move.bestPv.length > 1 && (
            <p className="text-[11px] text-muted truncate">
              line: {move.bestPv.slice(1, 6).join(" ")}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 mt-4">
        {!solved && !revealed && (
          <button
            onClick={onReveal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg/50 hover:bg-bg/80 ring-1 ring-muted/30 text-xs text-fg/80 transition-colors"
          >
            <Eye size={12} /> Reveal
          </button>
        )}
        {(failed || revealed || solved) && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg/50 hover:bg-bg/80 ring-1 ring-muted/30 text-xs text-fg/80 transition-colors"
          >
            <RotateCcw size={12} /> Reset
          </button>
        )}
        {(solved || revealed) && onNext ? (
          <button
            onClick={onNext}
            className="ml-auto px-3 py-1.5 rounded-lg bg-[var(--main)] text-bg text-xs font-medium hover:brightness-110 transition-all"
          >
            Next puzzle →
          </button>
        ) : (
          <button
            onClick={onExit}
            className="ml-auto px-3 py-1.5 rounded-lg bg-[var(--main)] text-bg text-xs font-medium hover:brightness-110 transition-all"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
};

export default PuzzlePanel;
