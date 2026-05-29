"use client";

import { FC, useMemo } from "react";
import { Flame } from "lucide-react";
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from "@/lib/moveClass";
import type { AnalyzedMove } from "@/lib/analysis";

interface CriticalMomentsProps {
  moves: AnalyzedMove[];
  onJumpToMove?: (ply: number) => void;
}

const CriticalMoments: FC<CriticalMomentsProps> = ({ moves, onJumpToMove }) => {
  const top = useMemo(() => {
    return [...moves]
      .map((m) => ({ m, swing: m.winPctLoss }))
      .filter((x) => x.swing >= 5)
      .sort((a, b) => b.swing - a.swing)
      .slice(0, 5)
      .sort((a, b) => a.m.index - b.m.index);
  }, [moves]);

  if (top.length === 0) return null;

  return (
    <div className="bg-surface/60 ring-1 ring-muted/20 rounded-2xl overflow-hidden animate-[fade-in_300ms_ease-out]">
      <div className="px-4 py-3 border-b border-muted/25 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame size={13} style={{ color: "var(--main)" }} />
          <p className="text-xs text-fg/65 uppercase tracking-[0.18em] font-medium">Critical moments</p>
        </div>
        <span className="text-[10px] text-muted/70">{top.length}</span>
      </div>
      <div className="px-3 py-2 space-y-0.5">
        {top.map((x, i) => {
          const moveNum = Math.ceil(x.m.index / 2);
          const isWhite = x.m.color === "w";
          return (
            <button
              key={x.m.index}
              onClick={() => onJumpToMove?.(x.m.index)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg/40 transition-colors text-left text-xs"
              style={{ animation: "slide-up 280ms ease-out both", animationDelay: `${i * 35}ms` }}
            >
              <span className="text-muted/70 tabular-nums w-9 shrink-0">
                {moveNum}{isWhite ? "." : "…"}
              </span>
              <span className={`font-mono w-12 shrink-0 ${CLASSIFICATION_COLORS[x.m.classification]}`}>
                {x.m.san}
              </span>
              <span className={`text-[9px] font-bold shrink-0 ${CLASSIFICATION_COLORS[x.m.classification]}`}>
                {CLASSIFICATION_LABELS[x.m.classification]}
              </span>
              <span className="ml-auto text-[10px] text-muted/70 tabular-nums">
                −{x.swing.toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CriticalMoments;
