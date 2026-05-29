"use client";

import { FC, useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Loader2, X, RotateCcw, Eye, ChevronRight, Target, Trash2, Trophy, AlertCircle } from "lucide-react";
import Board from "./Board";
import {
  countPuzzles,
  deletePuzzle,
  getDuePuzzles,
  isAcceptableMove,
  recordAttempt,
  skipPuzzle,
  type PuzzleEntry,
} from "@/lib/puzzleQueue";

interface MarathonModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Open the source game in review mode by its IndexedDB key. */
  onOpenSourceGame?: (gameKey: string, ply: number) => void;
  /** Board theme + flip state from app prefs. */
  boardTheme: string;
  showCoordinates: boolean;
  showAnimations: boolean;
}

type Outcome = "idle" | "correct" | "wrong" | "revealed";

const MarathonModal: FC<MarathonModalProps> = ({
  isOpen,
  onClose,
  onOpenSourceGame,
  boardTheme,
  showCoordinates,
  showAnimations,
}) => {
  const [loading, setLoading] = useState(false);
  const [puzzles, setPuzzles] = useState<PuzzleEntry[]>([]);
  const [stats, setStats] = useState<{ total: number; due: number }>({ total: 0, due: 0 });
  const [idx, setIdx] = useState(0);
  const [boardFen, setBoardFen] = useState<string>("");
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [attemptedSan, setAttemptedSan] = useState<string | null>(null);
  const [session, setSession] = useState({ solved: 0, attempted: 0 });

  const current = puzzles[idx];

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    setSession({ solved: 0, attempted: 0 });
    setIdx(0);
    setOutcome("idle");
    setAttemptedSan(null);
    (async () => {
      const [list, c] = await Promise.all([getDuePuzzles(50), countPuzzles()]);
      if (cancelled) return;
      setPuzzles(list);
      setStats(c);
      setBoardFen(list[0]?.fen ?? "");
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isOpen]);

  // When idx changes, reset board to puzzle's starting FEN.
  useEffect(() => {
    if (!current) return;
    setBoardFen(current.fen);
    setOutcome("idle");
    setAttemptedSan(null);
  }, [current?.fen]);

  const orientation: "white" | "black" = current?.side === "b" ? "black" : "white";

  const onPieceDrop = (from: string, to: string, promotion?: string): boolean => {
    if (!current || outcome !== "idle") return false;
    const probe = new Chess(current.fen);
    let move;
    try {
      move = probe.move({ from, to, promotion: promotion || "q" });
    } catch {
      return false;
    }
    if (!move) return false;
    setBoardFen(probe.fen());
    setAttemptedSan(move.san);

    const userUci = move.from + move.to + (move.promotion || "");
    const correct = isAcceptableMove(current, userUci);
    setOutcome(correct ? "correct" : "wrong");
    setSession((s) => ({ solved: s.solved + (correct ? 1 : 0), attempted: s.attempted + 1 }));
    recordAttempt(current.fen, correct).catch(() => {});
    return true;
  };

  const handleReveal = () => {
    if (!current) return;
    // Don't double-record if already attempted.
    if (outcome === "idle") {
      setSession((s) => ({ solved: s.solved, attempted: s.attempted + 1 }));
      recordAttempt(current.fen, false).catch(() => {});
    }
    setBoardFen(current.fen);
    setOutcome("revealed");
  };

  const handleRetry = () => {
    if (!current) return;
    setBoardFen(current.fen);
    setOutcome("idle");
    setAttemptedSan(null);
  };

  const handleNext = () => {
    setIdx((i) => i + 1);
  };

  const handleSkip = async () => {
    if (current) {
      try {
        await skipPuzzle(current.fen);
      } catch {
        /* swallow — skip is best-effort */
      }
    }
    setIdx((i) => i + 1);
  };

  const handleRemove = async () => {
    if (!current) return;
    await deletePuzzle(current.fen);
    setPuzzles((arr) => arr.filter((_, i) => i !== idx));
    setIdx((i) => Math.min(i, puzzles.length - 2 < 0 ? 0 : puzzles.length - 2));
    setOutcome("idle");
  };

  const labelOpponent = useMemo(() => {
    if (!current) return "";
    return current.side === "w"
      ? `${current.white} (you) vs ${current.black}`
      : `${current.white} vs ${current.black} (you)`;
  }, [current]);

  if (!isOpen) return null;

  const hasMore = idx < puzzles.length - 1;
  const remaining = puzzles.length - idx;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto py-4 sm:py-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface ring-1 ring-muted/40 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 p-5 animate-[slide-up_220ms_ease-out_both]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target size={14} className="text-cyan-300" />
            <p className="text-sm font-semibold text-fg">Puzzle Marathon</p>
            {stats.total > 0 && (
              <span className="text-[10px] text-muted/80">
                {stats.due} due · {stats.total} total
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-muted">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading puzzles…
          </div>
        ) : puzzles.length === 0 ? (
          <div className="py-10 text-center">
            <AlertCircle size={20} className="text-muted/60 mx-auto mb-2" />
            <p className="text-sm text-fg/85">No puzzles in your queue yet.</p>
            <p className="text-[11px] text-muted/80 mt-1">
              Bulk-import games from chess.com or Lichess to build a queue from your own mistakes.
            </p>
          </div>
        ) : !current ? (
          <div className="py-10 text-center animate-[fade-in_240ms_ease-out]">
            <Trophy size={28} className="text-amber-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-fg">Marathon complete</p>
            <p className="text-[11px] text-muted/80 mt-1">
              {session.solved} / {session.attempted} solved this session.
            </p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-1.5 bg-[var(--main)] text-bg text-xs font-medium rounded-lg hover:brightness-110 transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-4">
            <div>
              <div className="aspect-square w-full max-w-md mx-auto">
                <Board
                  fen={boardFen}
                  onPieceDrop={onPieceDrop}
                  boardOrientation={orientation}
                  theme={boardTheme}
                  coordinates={showCoordinates}
                  animation={showAnimations}
                  movable={outcome === "idle"}
                />
              </div>
              <p className="text-[11px] text-muted/85 text-center mt-2 truncate">
                {labelOpponent}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="rounded-xl bg-bg/40 ring-1 ring-muted/25 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted/70">
                    {current.side === "w" ? "White" : "Black"} to move
                  </span>
                  <span className="text-[10px] text-muted/70 tabular-nums">
                    {idx + 1} / {puzzles.length}
                  </span>
                </div>

                {outcome === "idle" && (
                  <p className="text-[12px] text-fg/85 leading-snug">
                    You played <span className="font-mono text-orange-300">{current.playedSan}</span>{" "}
                    here ({current.classification}). Find the better move.
                  </p>
                )}
                {outcome === "correct" && (
                  <div className="text-emerald-300 text-[13px] font-medium">
                    Solved! Best move: <span className="font-mono">{current.bestSan ?? current.bestUci}</span>
                  </div>
                )}
                {outcome === "wrong" && (
                  <div className="text-orange-300 text-[12px]">
                    <p>Not quite — you tried <span className="font-mono">{attemptedSan}</span>.</p>
                    <p className="text-[11px] text-muted/85 mt-0.5">Try again or reveal.</p>
                  </div>
                )}
                {outcome === "revealed" && (
                  <div className="text-[12px] text-fg/85">
                    Engine's best:{" "}
                    <span className="font-mono text-emerald-300">
                      {current.bestSan ?? current.bestUci}
                    </span>
                    {current.bestPv.length > 1 && (
                      <p className="text-[11px] text-muted/80 mt-0.5 truncate">
                        {current.bestPv.slice(0, 5).join(" ")}
                      </p>
                    )}
                  </div>
                )}

                <div className="text-[10px] text-muted/70 mt-2 tabular-nums">
                  Session: {session.solved}/{session.attempted}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                {outcome === "idle" && (
                  <button
                    onClick={handleReveal}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg/40 hover:bg-bg/70 ring-1 ring-muted/30 text-xs text-fg/80 transition-colors"
                  >
                    <Eye size={12} /> Reveal
                  </button>
                )}
                {(outcome === "wrong" || outcome === "revealed") && (
                  <button
                    onClick={handleRetry}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg/40 hover:bg-bg/70 ring-1 ring-muted/30 text-xs text-fg/80 transition-colors"
                  >
                    <RotateCcw size={12} /> Retry
                  </button>
                )}
                {hasMore && outcome !== "idle" && (
                  <button
                    onClick={handleNext}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--main)] text-bg text-xs font-medium hover:brightness-110 transition-all"
                  >
                    Next puzzle <ChevronRight size={12} />
                  </button>
                )}
                {!hasMore && outcome !== "idle" && (
                  <button
                    onClick={() => setIdx(puzzles.length)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--main)] text-bg text-xs font-medium hover:brightness-110 transition-all"
                  >
                    Finish ({remaining - 1} left were skipped)
                  </button>
                )}
                {outcome === "idle" && (
                  <button
                    onClick={handleSkip}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg/30 hover:bg-bg/50 ring-1 ring-muted/20 text-[11px] text-muted hover:text-fg/85 transition-colors"
                  >
                    Skip
                  </button>
                )}
                {onOpenSourceGame && (
                  <button
                    onClick={() => {
                      onOpenSourceGame(current.gameKey, current.ply);
                      onClose();
                    }}
                    className="text-[10px] text-muted hover:text-fg/85 transition-colors text-center"
                  >
                    Open source game →
                  </button>
                )}
                <button
                  onClick={handleRemove}
                  className="flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-[10px] text-muted/70 hover:text-red-400 transition-colors"
                  title="Remove from queue"
                >
                  <Trash2 size={9} /> Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarathonModal;
