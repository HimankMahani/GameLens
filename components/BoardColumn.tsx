"use client";

import { CSSProperties, FC, useEffect, useMemo, useState } from "react";
import { Chess, type Square } from "chess.js";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import Board, { BoardArrow } from "./Board";
import EvalBar from "./EvalBar";
import EvalGraph from "./EvalGraph";
import ClockGraph from "./ClockGraph";
import TurnIndicator from "./TurnIndicator";
import MaterialBalance from "./MaterialBalance";
import type { MoveClassification } from "@/lib/analysis";
import { findHangingSquares } from "@/lib/hangingPieces";

const CLASSIFICATION_HEX: Record<MoveClassification, string> = {
  brilliant: "#22d3ee",
  great: "#60a5fa",
  best: "#34d399",
  excellent: "#34d399",
  good: "#a1a1aa",
  book: "#f59e0b",
  inaccuracy: "#eab308",
  mistake: "#fb923c",
  blunder: "#ef4444",
  miss: "#f43f5e",
  forced: "#a1a1aa",
};

interface BoardColumnProps {
  fen: string;
  reviewMode: boolean;
  cp: number | null;
  mate: number | null;
  boardOrientation: "white" | "black";
  boardTheme: string;
  showCoordinates: boolean;
  showAnimations: boolean;
  movable: boolean;
  onPieceDrop?: (from: string, to: string, promotion?: string) => boolean;
  arrows: BoardArrow[];
  lastMove?: { from: string; to: string; classification?: MoveClassification };

  currentIndex: number;
  totalPlies: number;
  canGoBack: boolean;
  canGoForward: boolean;
  goToStart: () => void;
  goBack: () => void;
  goForward: () => void;
  goToEnd: () => void;
  goToPly: (i: number) => void;

  cpsByPly: (number | null)[];
  classificationsByPly?: Record<number, MoveClassification>;
  gameOver?: "checkmate" | "stalemate" | "draw" | null;
  turnOverride?: string;
  clockSpent?: (number | null)[];
  onArrowsChange?: (arrows: BoardArrow[]) => void;
  showHanging?: boolean;
  /** SAN of the move just played (for the corner badge). */
  currentSan?: string;
  currentClassification?: MoveClassification;
}

const NavButton: FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({
  onClick,
  disabled,
  children,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="grid h-8 w-8 place-items-center rounded-lg text-fg/65 hover:text-fg hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95"
  >
    {children}
  </button>
);

const BoardColumn: FC<BoardColumnProps> = ({
  fen,
  cp,
  mate,
  boardOrientation,
  boardTheme,
  showCoordinates,
  showAnimations,
  movable,
  onPieceDrop,
  arrows,
  lastMove,
  currentIndex,
  totalPlies,
  canGoBack,
  canGoForward,
  goToStart,
  goBack,
  goForward,
  goToEnd,
  goToPly,
  cpsByPly,
  classificationsByPly,
  gameOver,
  turnOverride,
  clockSpent,
  onArrowsChange,
  showHanging,
  currentSan,
  currentClassification,
}) => {
  // Click-to-select-piece OR hover-to-preview: highlights legal destinations.
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  // Hover wins when a piece is under the cursor; otherwise we show click selection.
  const focused = useMemo<string | null>(() => {
    if (!fen) return null;
    if (hovered) {
      try {
        const probe = new Chess(fen);
        if (probe.get(hovered as Square)) return hovered;
      } catch { /* ignore */ }
    }
    return selected;
  }, [hovered, selected, fen]);

  const moveTargets = useMemo<Set<string>>(() => {
    if (!focused || !fen) return new Set();
    try {
      const g = new Chess(fen);
      const moves = g.moves({ square: focused as Square, verbose: true });
      return new Set(moves.map((m) => m.to));
    } catch {
      return new Set();
    }
  }, [focused, fen]);

  const hangingSquares = useMemo<Square[]>(() => {
    if (!showHanging || !fen) return [];
    return findHangingSquares(fen);
  }, [showHanging, fen]);

  const squareStyles = useMemo<Record<string, CSSProperties>>(() => {
    const out: Record<string, CSSProperties> = {};
    if (showHanging) {
      for (const sq of hangingSquares) {
        out[sq] = {
          boxShadow: "inset 0 0 0 9999px rgba(239, 68, 68, 0.18)",
        };
      }
    }
    if (focused) {
      out[focused] = {
        boxShadow: "inset 0 0 0 9999px color-mix(in srgb, var(--main) 25%, transparent)",
      };
      for (const sq of moveTargets) {
        out[sq] = {
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--main) 55%, transparent) 18%, transparent 22%)",
        };
      }
    }
    return out;
  }, [focused, moveTargets, hangingSquares, showHanging]);

  const handleSquareClick = (square: string) => {
    if (!fen) return;
    if (selected === square) { setSelected(null); return; }
    try {
      const g = new Chess(fen);
      const piece = g.get(square as Square);
      if (piece) {
        setSelected(square);
        return;
      }
    } catch { /* ignore */ }
    setSelected(null);
  };

  // Clear selection on board position change.
  useEffect(() => { setSelected(null); setHovered(null); }, [fen]);

  return (
    <div className="flex gap-2 sm:gap-3 items-start animate-[slide-up_320ms_ease-out_both] w-full lg:w-auto [--board-size:min(calc(100vw-5.5rem),520px)] lg:[--board-size:clamp(360px,calc(100vh-280px),400px)] xl:[--board-size:clamp(420px,calc(100vh-260px),480px)] 2xl:[--board-size:clamp(460px,calc(100vh-250px),520px)]">
      <EvalBar cp={cp} mate={mate} flipped={boardOrientation === "black"} height="var(--board-size)" />
      <div className="flex flex-col gap-2.5 sm:gap-3 min-w-0 w-[var(--board-size)] max-w-full shrink-0">
        <TurnIndicator fen={fen} gameOver={gameOver} override={turnOverride} />
        <div className="relative">
          <Board
            fen={fen}
            onPieceDrop={onPieceDrop}
            boardOrientation={boardOrientation}
            theme={boardTheme}
            coordinates={showCoordinates}
            animation={showAnimations}
            movable={movable}
            arrows={arrows}
            squareStyles={squareStyles}
            onSquareClick={handleSquareClick}
            onSquareHover={setHovered}
            onArrowsChange={onArrowsChange}
            lastMove={lastMove}
          />
          {currentSan && (
            <div
              key={currentSan + (currentClassification ?? "")}
              className="absolute top-2 right-2 px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-bg/70 backdrop-blur-sm ring-1 ring-muted/30 pointer-events-none animate-[pop-in_240ms_cubic-bezier(0.34,1.56,0.64,1)_both]"
              style={{
                color: currentClassification
                  ? CLASSIFICATION_HEX[currentClassification]
                  : "var(--text)",
              }}
            >
              {currentSan}
            </div>
          )}
        </div>
        <MaterialBalance fen={fen} />

        <p className="text-[11px] text-muted/75 text-center -mt-0.5">
          Right-click + drag to draw arrows
        </p>

        <div className="flex items-center justify-center gap-1.5 bg-surface/60 ring-1 ring-muted/20 rounded-xl px-2 py-2">
          <NavButton onClick={goToStart} disabled={!canGoBack}><ChevronsLeft size={16} /></NavButton>
          <NavButton onClick={goBack} disabled={!canGoBack}><ChevronLeft size={16} /></NavButton>
          <span className="text-xs text-muted tabular-nums px-2 min-w-[4rem] text-center">
            {currentIndex} / {totalPlies}
          </span>
          <NavButton onClick={goForward} disabled={!canGoForward}><ChevronRight size={16} /></NavButton>
          <NavButton onClick={goToEnd} disabled={!canGoForward}><ChevronsRight size={16} /></NavButton>
        </div>

        <EvalGraph
          cps={cpsByPly}
          currentPly={currentIndex}
          onPlyClick={goToPly}
          classificationsByPly={classificationsByPly}
        />
        {clockSpent && (
          <ClockGraph
            spent={clockSpent}
            currentPly={currentIndex}
            onPlyClick={goToPly}
            classificationsByPly={classificationsByPly}
          />
        )}
      </div>
    </div>
  );
};

export default BoardColumn;
