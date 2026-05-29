"use client";

import { FC, useEffect, useMemo, useRef, useState } from "react";
import { Move } from "chess.js";
import { MessageSquare } from "lucide-react";
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS, MoveClassification } from "@/lib/moveClass";

type Filter = "all" | "mistakes" | "white" | "black";

interface MoveListProps {
  moves: Move[];
  currentIndex: number;
  onMoveClick: (index: number) => void;
  annotations?: Record<number, string>;
  classifications?: Record<number, MoveClassification>;
  onAnnotationClick?: (index: number, currentText: string) => void;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "mistakes", label: "Mistakes" },
  { id: "white", label: "♔" },
  { id: "black", label: "♚" },
];

const isMistake = (c?: MoveClassification) =>
  c === "blunder" || c === "mistake" || c === "miss" || c === "inaccuracy";

const MoveList: FC<MoveListProps> = ({
  moves,
  currentIndex,
  onMoveClick,
  annotations = {},
  classifications = {},
  onAnnotationClick,
}) => {
  const [hoveredMove, setHoveredMove] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const activeRef = useRef<HTMLDivElement | null>(null);

  // Active-move pulse: bump a key whenever currentIndex jumps by more than 1.
  const lastIndex = useRef(currentIndex);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (Math.abs(currentIndex - lastIndex.current) > 1) setPulseKey((k) => k + 1);
    lastIndex.current = currentIndex;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex]);

  const visible = useMemo(() => {
    return moves
      .map((m, idx) => ({ m, idx, moveNum: idx + 1 }))
      .filter(({ moveNum, idx }) => {
        if (filter === "mistakes") return isMistake(classifications[moveNum]);
        if (filter === "white") return idx % 2 === 0;
        if (filter === "black") return idx % 2 === 1;
        return true;
      });
  }, [moves, filter, classifications]);

  const filterCounts = useMemo(() => {
    let mistakes = 0;
    for (const [, cls] of Object.entries(classifications)) {
      if (isMistake(cls)) mistakes++;
    }
    return { mistakes };
  }, [classifications]);

  return (
    <div className="w-full bg-surface/50 rounded-xl ring-1 ring-muted/20 overflow-hidden flex flex-col h-full">
      <div className="px-3.5 py-2.5 border-b border-muted/25 flex items-center justify-between">
        <p className="text-[11px] text-muted uppercase tracking-wider">Moves</p>
        <div className="flex items-center gap-2">
          {Object.keys(annotations).length > 0 && (
            <span className="text-[10px] text-muted/70">{Object.keys(annotations).length}n</span>
          )}
        </div>
      </div>

      {/* Filter chips */}
      {moves.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-2 border-b border-muted/20 bg-bg/30">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const disabled = f.id === "mistakes" && filterCounts.mistakes === 0;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                disabled={disabled}
                className={`flex-1 min-h-7 px-1.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  active
                    ? "bg-[var(--main)] text-bg"
                    : disabled
                      ? "text-muted/40 cursor-not-allowed"
                      : "text-muted hover:text-fg hover:bg-surface"
                }`}
              >
                {f.label}
                {f.id === "mistakes" && filterCounts.mistakes > 0 && (
                  <span className="ml-1 opacity-70">{filterCounts.mistakes}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {moves.length === 0 ? (
          <p className="text-xs text-muted/70 text-center py-4">No moves yet</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-muted/70 text-center py-4">No {filter} moves</p>
        ) : (
          <div className="space-y-0.5">
            {visible.map(({ m: move, idx, moveNum }, rowIdx) => {
              const hasAnnotation = !!annotations[moveNum];
              const classification = classifications[moveNum];
              const isActive = idx === currentIndex - 1;
              const isHovered = hoveredMove === idx;

              return (
                <div
                  key={idx}
                  ref={isActive ? activeRef : undefined}
                  data-pulse={isActive ? pulseKey : undefined}
                  className={`group flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] cursor-pointer transition-all duration-150 ${
                    isActive
                      ? "bg-[var(--main)]/20 text-fg font-semibold ring-1 ring-[var(--main)]/40 scale-[1.02]"
                      : isHovered
                        ? "bg-surface text-fg/90 translate-x-0.5"
                        : "text-fg/80"
                  }`}
                  style={
                    isActive
                      ? { animation: "pop-in 220ms cubic-bezier(0.34,1.56,0.64,1) both" }
                      : {
                          animation: "slide-up 260ms ease-out both",
                          animationDelay: `${Math.min(rowIdx * 14, 500)}ms`,
                        }
                  }
                  onClick={() => onMoveClick(idx + 1)}
                  onMouseEnter={() => setHoveredMove(idx)}
                  onMouseLeave={() => setHoveredMove(null)}
                >
                  {/* Move number — show "Ν..." for black filter so context stays clear */}
                  <span className={`w-7 text-right shrink-0 tabular-nums ${
                    isActive ? "text-fg/65" : "text-muted/70"
                  }`}>
                    {idx % 2 === 0
                      ? `${Math.floor(idx / 2) + 1}.`
                      : filter === "black"
                        ? `${Math.floor(idx / 2) + 1}…`
                        : ""}
                  </span>

                  {/* SAN */}
                  <span className={`min-w-[2.4rem] font-mono ${classification ? CLASSIFICATION_COLORS[classification] : ""}`}>
                    {move.san}
                  </span>

                  {/* Classification glyph — separated right of SAN */}
                  {classification && (
                    <span
                      aria-label={classification}
                      className={`text-[10px] font-bold ml-0.5 ${CLASSIFICATION_COLORS[classification]}`}
                    >
                      {CLASSIFICATION_LABELS[classification]}
                    </span>
                  )}

                  {/* Annotation indicator */}
                  {hasAnnotation && (
                    <span className="text-blue-400 text-[10px] leading-none">💬</span>
                  )}

                  {/* Annotation button (hover) */}
                  {onAnnotationClick && isHovered && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        onAnnotationClick(moveNum, annotations[moveNum] || "");
                      }}
                      className={`ml-auto p-0.5 rounded transition-colors ${
                        hasAnnotation
                          ? "text-blue-400 hover:text-blue-300"
                          : "text-muted/70 hover:text-fg/65"
                      }`}
                      title={hasAnnotation ? "Edit note" : "Add note"}
                    >
                      <MessageSquare size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MoveList;
