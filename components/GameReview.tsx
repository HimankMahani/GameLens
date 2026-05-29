"use client";

import { FC, useEffect, useState } from "react";
import { GameSummary, MoveClassification } from "@/lib/analysis";
import {
  CLASSIFICATION_BG,
  CLASSIFICATION_COLORS,
  CLASSIFICATION_LABELS,
  CLASSIFICATION_NAMES,
} from "@/lib/moveClass";

interface GameReviewProps {
  summary: GameSummary;
  whiteName?: string;
  blackName?: string;
  onJumpToMove?: (ply: number) => void;
  /** Map of ply index → classification, used to find example plies for a chip click. */
  classificationsByPly?: Record<number, MoveClassification>;
}

const ROWS: { key: MoveClassification; tone: "good" | "neutral" | "bad" }[] = [
  { key: "brilliant", tone: "good" },
  { key: "great", tone: "good" },
  { key: "best", tone: "good" },
  { key: "excellent", tone: "good" },
  { key: "good", tone: "neutral" },
  { key: "book", tone: "neutral" },
  { key: "inaccuracy", tone: "bad" },
  { key: "mistake", tone: "bad" },
  { key: "miss", tone: "bad" },
  { key: "blunder", tone: "bad" },
];

/** Animated count-up. */
function CountUp({ value, ms = 700 }: { value: number; ms?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <>{v.toFixed(1)}</>;
}

function accuracyColor(acc: number): string {
  if (acc >= 90) return "text-cyan-300";
  if (acc >= 80) return "text-emerald-300";
  if (acc >= 70) return "text-emerald-400";
  if (acc >= 60) return "text-yellow-400";
  if (acc >= 50) return "text-orange-400";
  return "text-red-400";
}

const GameReview: FC<GameReviewProps> = ({
  summary,
  whiteName = "White",
  blackName = "Black",
  onJumpToMove,
  classificationsByPly = {},
}) => {
  const handleChipClick = (cls: MoveClassification, color: "w" | "b") => {
    if (!onJumpToMove) return;
    const entries = Object.entries(classificationsByPly);
    for (const [ply, c] of entries) {
      if (c !== cls) continue;
      const p = parseInt(ply, 10);
      const isWhite = p % 2 === 1; // ply 1 = white's first move
      if ((color === "w") === isWhite) {
        onJumpToMove(p);
        return;
      }
    }
  };

  return (
    <div className="bg-surface/60 rounded-2xl ring-1 ring-muted/20 overflow-hidden animate-[fade-in_300ms_ease-out]">
      <div className="px-4 py-3 border-b border-muted/25 flex items-center justify-between">
        <p className="text-xs text-fg/65 uppercase tracking-[0.18em] font-medium">Game Review</p>
        <p className="text-[10px] text-muted/70">{summary.totalMoves} moves</p>
      </div>

      {/* Accuracy header */}
      <div className="px-4 py-4 border-b border-muted/25 grid grid-cols-2 gap-4">
        <div className="text-center">
          <div className={`text-3xl font-semibold tabular-nums ${accuracyColor(summary.white.accuracy)} animate-[pop-in_500ms_cubic-bezier(0.34,1.56,0.64,1)_both]`}>
            <CountUp value={summary.white.accuracy} />
          </div>
          <p className="text-[10px] text-muted uppercase tracking-wider mt-1">{whiteName}</p>
          <p className="text-[10px] text-muted/70 mt-0.5">ACPL {summary.white.acpl}</p>
        </div>
        <div className="text-center">
          <div
            className={`text-3xl font-semibold tabular-nums ${accuracyColor(summary.black.accuracy)} animate-[pop-in_500ms_cubic-bezier(0.34,1.56,0.64,1)_both]`}
            style={{ animationDelay: "120ms" }}
          >
            <CountUp value={summary.black.accuracy} />
          </div>
          <p className="text-[10px] text-muted uppercase tracking-wider mt-1">{blackName}</p>
          <p className="text-[10px] text-muted/70 mt-0.5">ACPL {summary.black.acpl}</p>
        </div>
      </div>

      {/* Per-classification rows */}
      <div className="px-3 py-2 space-y-0.5">
        {ROWS.map((row, i) => {
          const w = summary.white.counts[row.key] ?? 0;
          const b = summary.black.counts[row.key] ?? 0;
          if (w === 0 && b === 0) return null;
          return (
            <div
              key={row.key}
              className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2 px-2 py-1 rounded-lg hover:bg-surface/60 transition-colors text-xs"
              style={{ animation: `slide-up 280ms ease-out both`, animationDelay: `${i * 35}ms` }}
            >
              <button
                onClick={() => handleChipClick(row.key, "w")}
                disabled={!w || !onJumpToMove}
                className={`tabular-nums text-right font-mono ${w ? CLASSIFICATION_COLORS[row.key] : "text-muted/40"} ${w && onJumpToMove ? "hover:underline cursor-pointer" : ""}`}
              >
                {w}
              </button>
              <div className="flex items-center justify-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${CLASSIFICATION_BG[row.key]}`} />
                <span className={`${CLASSIFICATION_COLORS[row.key]} font-medium`}>
                  {CLASSIFICATION_NAMES[row.key]}
                </span>
                <span className="text-muted/70">{CLASSIFICATION_LABELS[row.key]}</span>
              </div>
              <button
                onClick={() => handleChipClick(row.key, "b")}
                disabled={!b || !onJumpToMove}
                className={`tabular-nums font-mono ${b ? CLASSIFICATION_COLORS[row.key] : "text-muted/40"} ${b && onJumpToMove ? "hover:underline cursor-pointer" : ""}`}
              >
                {b}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameReview;
