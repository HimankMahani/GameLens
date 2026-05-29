"use client";

import { FC, CSSProperties } from "react";
import { Chessboard, PieceDropHandlerArgs, SquareHandlerArgs } from "react-chessboard";
import { BOARD_THEMES } from "@/lib/themes";
import { MoveClassification } from "@/lib/analysis";

export interface BoardArrow {
  startSquare: string;
  endSquare: string;
  color: string;
}

interface BoardProps {
  fen: string;
  onPieceDrop?: (from: string, to: string, promotion?: string) => boolean;
  boardOrientation?: "white" | "black";
  theme?: string;
  coordinates?: boolean;
  animation?: boolean;
  movable?: boolean;
  arrows?: BoardArrow[];
  squareStyles?: Record<string, CSSProperties>;
  lastMove?: { from: string; to: string; classification?: MoveClassification };
  onSquareClick?: (square: string) => void;
  onSquareHover?: (square: string | null) => void;
  onArrowsChange?: (arrows: BoardArrow[]) => void;
}

const CLS_TINT: Record<MoveClassification, string> = {
  brilliant: "rgba(34, 211, 238, 0.55)", // cyan
  great: "rgba(59, 130, 246, 0.55)", // blue
  best: "rgba(16, 185, 129, 0.5)", // emerald
  excellent: "rgba(16, 185, 129, 0.45)",
  good: "rgba(161, 161, 170, 0.4)",
  book: "rgba(245, 158, 11, 0.5)",
  inaccuracy: "rgba(234, 179, 8, 0.5)",
  mistake: "rgba(249, 115, 22, 0.6)",
  blunder: "rgba(239, 68, 68, 0.65)",
  miss: "rgba(244, 63, 94, 0.6)",
  forced: "rgba(161, 161, 170, 0.35)",
};

const Board: FC<BoardProps> = ({
  fen,
  onPieceDrop,
  boardOrientation = "white",
  theme = "dark",
  coordinates = true,
  animation = true,
  movable = true,
  arrows = [],
  squareStyles,
  lastMove,
  onSquareClick,
  onSquareHover,
  onArrowsChange,
}) => {
  const handleDrop = (args: PieceDropHandlerArgs): boolean => {
    if (!onPieceDrop || !args.sourceSquare || !args.targetSquare) return false;
    return onPieceDrop(args.sourceSquare, args.targetSquare);
  };
  const handleSquareClick = onSquareClick
    ? ({ square }: SquareHandlerArgs) => {
        if (square) onSquareClick(square);
      }
    : undefined;
  const handleMouseOver = onSquareHover
    ? ({ square }: SquareHandlerArgs) => onSquareHover(square || null)
    : undefined;
  const handleMouseOut = onSquareHover
    ? () => onSquareHover(null)
    : undefined;

  const themeDef = BOARD_THEMES.find((t) => t.id === theme) || BOARD_THEMES[0];

  // Merge last-move highlights into squareStyles.
  const mergedStyles: Record<string, CSSProperties> = { ...(squareStyles || {}) };
  if (lastMove) {
    const tint = lastMove.classification ? CLS_TINT[lastMove.classification] : "rgba(255, 255, 0, 0.3)";
    const fromExisting = mergedStyles[lastMove.from] || {};
    const toExisting = mergedStyles[lastMove.to] || {};
    mergedStyles[lastMove.from] = {
      ...fromExisting,
      boxShadow: `inset 0 0 0 9999px ${tint}`,
    };
    mergedStyles[lastMove.to] = {
      ...toExisting,
      boxShadow: `inset 0 0 0 9999px ${tint}`,
    };
  }

  return (
    <div
      className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-muted/20 bg-surface transition-shadow"
      style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)" }}
    >
      <Chessboard
        options={{
          position: fen,
          onPieceDrop: movable ? handleDrop : undefined,
          allowDragging: movable,
          onSquareClick: handleSquareClick,
          onMouseOverSquare: handleMouseOver,
          onMouseOutSquare: handleMouseOut,
          boardOrientation,
          showNotation: coordinates,
          showAnimations: animation,
          animationDurationInMs: 220,
          arrows,
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          onArrowsChange: onArrowsChange
            ? ({ arrows: a }) => {
                onArrowsChange(
                  a.map((x) => ({
                    startSquare: x.startSquare,
                    endSquare: x.endSquare,
                    color: x.color,
                  }))
                );
              }
            : undefined,
          darkSquareStyle: { backgroundColor: themeDef.boardDark },
          lightSquareStyle: { backgroundColor: themeDef.boardLight },
          squareStyles: mergedStyles,
        }}
      />
    </div>
  );
};

export default Board;
