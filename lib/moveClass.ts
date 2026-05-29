import type { MoveClassification } from "./analysis";
export type { MoveClassification } from "./analysis";

export const CLASSIFICATION_COLORS: Record<MoveClassification, string> = {
  brilliant: "text-cyan-300",
  great: "text-blue-300",
  best: "text-emerald-300",
  excellent: "text-emerald-400",
  good: "text-zinc-300",
  book: "text-amber-300",
  inaccuracy: "text-yellow-400",
  mistake: "text-orange-400",
  blunder: "text-red-400",
  miss: "text-rose-400",
  forced: "text-zinc-400",
};

export const CLASSIFICATION_BG: Record<MoveClassification, string> = {
  brilliant: "bg-cyan-400",
  great: "bg-blue-400",
  best: "bg-emerald-400",
  excellent: "bg-emerald-500",
  good: "bg-zinc-500",
  book: "bg-amber-400",
  inaccuracy: "bg-yellow-500",
  mistake: "bg-orange-500",
  blunder: "bg-red-500",
  miss: "bg-rose-500",
  forced: "bg-zinc-500",
};

export const CLASSIFICATION_RING: Record<MoveClassification, string> = {
  brilliant: "ring-cyan-400/60",
  great: "ring-blue-400/60",
  best: "ring-emerald-400/60",
  excellent: "ring-emerald-500/50",
  good: "ring-zinc-500/40",
  book: "ring-amber-400/50",
  inaccuracy: "ring-yellow-500/50",
  mistake: "ring-orange-500/60",
  blunder: "ring-red-500/70",
  miss: "ring-rose-500/70",
  forced: "ring-zinc-500/40",
};

export const CLASSIFICATION_LABELS: Record<MoveClassification, string> = {
  brilliant: "!!",
  great: "!",
  best: "★",
  excellent: "✓",
  good: "·",
  book: "📖",
  inaccuracy: "?!",
  mistake: "?",
  blunder: "??",
  miss: "✗",
  forced: "□",
};

export const CLASSIFICATION_NAMES: Record<MoveClassification, string> = {
  brilliant: "Brilliant",
  great: "Great move",
  best: "Best move",
  excellent: "Excellent",
  good: "Good",
  book: "Book",
  inaccuracy: "Inaccuracy",
  mistake: "Mistake",
  blunder: "Blunder",
  miss: "Miss",
  forced: "Forced",
};

/** Short, one-line teaching headline for a classification. */
export const CLASSIFICATION_HEADLINES: Record<MoveClassification, string> = {
  brilliant: "Brilliant — a difficult, sacrificing best move.",
  great: "Great move — only this kept the advantage.",
  best: "Best move — the engine agrees.",
  excellent: "Excellent move.",
  good: "A solid move.",
  book: "A known opening move.",
  inaccuracy: "Inaccurate — a stronger move was available.",
  mistake: "Mistake — this gives up real advantage.",
  blunder: "Blunder — this drops material or the position.",
  miss: "Missed win — a better continuation was winning.",
  forced: "Only legal move.",
};

/**
 * Legacy helper kept for any caller still using a raw eval-difference
 * classifier. New code should use `classify()` from `lib/analysis.ts`.
 */
export function classifyMove(evalDiff: number): MoveClassification {
  if (evalDiff <= 0.2) return "good";
  if (evalDiff <= 0.5) return "inaccuracy";
  if (evalDiff <= 1.5) return "mistake";
  return "blunder";
}
