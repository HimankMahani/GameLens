"use client";

import { FC } from "react";

interface PromotionPickerProps {
  isOpen: boolean;
  color: "w" | "b";
  onPick: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}

const PIECES: { key: "q" | "r" | "b" | "n"; w: string; b: string; label: string }[] = [
  { key: "q", w: "♕", b: "♛", label: "Queen" },
  { key: "r", w: "♖", b: "♜", label: "Rook" },
  { key: "b", w: "♗", b: "♝", label: "Bishop" },
  { key: "n", w: "♘", b: "♞", label: "Knight" },
];

const PromotionPicker: FC<PromotionPickerProps> = ({ isOpen, color, onPick, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface ring-1 ring-muted/40 rounded-2xl shadow-2xl p-4 animate-[pop-in_240ms_cubic-bezier(0.34,1.56,0.64,1)_both]">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-medium mb-2 text-center">Promote to</p>
        <div className="flex gap-1.5">
          {PIECES.map((p) => (
            <button
              key={p.key}
              onClick={() => onPick(p.key)}
              className="flex flex-col items-center gap-0.5 w-16 h-20 rounded-xl bg-bg/40 hover:bg-[var(--main)]/20 ring-1 ring-muted/30 hover:ring-[var(--main)]/50 transition-all hover:scale-105"
              title={p.label}
            >
              <span className="text-4xl leading-none mt-2" style={{ color: "var(--text)" }}>
                {color === "w" ? p.w : p.b}
              </span>
              <span className="text-[10px] text-muted">{p.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PromotionPicker;
