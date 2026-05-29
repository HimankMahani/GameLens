"use client";

import { FC } from "react";

interface TurnIndicatorProps {
  /** Current FEN — side to move is read from this. */
  fen: string;
  /** "checkmate" / "stalemate" / "draw" / null */
  gameOver?: "checkmate" | "stalemate" | "draw" | null;
  /** Optional override text — e.g. "Engine thinking…" */
  override?: string;
}

const TurnIndicator: FC<TurnIndicatorProps> = ({ fen, gameOver, override }) => {
  const stm = fen?.split(" ")[1] === "b" ? "b" : "w";
  const isWhite = stm === "w";

  let label: string;
  let dotClass: string;
  if (override) {
    label = override;
    dotClass = "bg-[var(--main)] animate-pulse";
  } else if (gameOver === "checkmate") {
    label = isWhite ? "Checkmate — Black wins" : "Checkmate — White wins";
    dotClass = "bg-[var(--error)]";
  } else if (gameOver === "stalemate") {
    label = "Stalemate · draw";
    dotClass = "bg-muted/70";
  } else if (gameOver === "draw") {
    label = "Draw";
    dotClass = "bg-muted/70";
  } else {
    label = isWhite ? "White to move" : "Black to move";
    dotClass = isWhite ? "bg-fg ring-1 ring-muted/40" : "bg-bg ring-1 ring-fg/30";
  }

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-fg/80 font-medium">
      <span className={`inline-block w-2 h-2 rounded-full ${dotClass}`} />
      <span className="tabular-nums">{label}</span>
    </div>
  );
};

export default TurnIndicator;
