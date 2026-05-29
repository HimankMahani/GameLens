"use client";

import { FC, useEffect, useState } from "react";
import { AnalyzedMove } from "@/lib/analysis";
import {
  CLASSIFICATION_BG,
  CLASSIFICATION_COLORS,
  CLASSIFICATION_HEADLINES,
  CLASSIFICATION_LABELS,
  CLASSIFICATION_NAMES,
  CLASSIFICATION_RING,
} from "@/lib/moveClass";
import { Play, Pause, ChevronLeft, ChevronRight, AlertTriangle, Target, Sparkles, Loader2, RefreshCw, Copy, Check } from "lucide-react";
import { useGeminiCoach } from "@/hooks/useGeminiCoach";
import { loadGeminiSettings, type CoachInput } from "@/lib/gemini";

interface MoveCoachCardProps {
  move: AnalyzedMove | null;
  /** ply we're currently on (0 = starting position) */
  currentPly: number;
  totalPlies: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPrevBlunder?: () => void;
  onNextBlunder?: () => void;
  hasPrevBlunder?: boolean;
  hasNextBlunder?: boolean;
  onStartPuzzle?: () => void;
  /** Seconds spent on this move (from PGN [%clk]). */
  spentSeconds?: number | null;
  /** Detected opening name, used as extra context for the Gemini coach. */
  opening?: string;
  /** Bumped when settings change so we re-read enable state. */
  geminiSettingsRev?: number;
  /** When the user has no key configured, opens Settings. */
  onOpenSettings?: () => void;
}

function fmtCp(cp: number, mate: number | null): string {
  if (mate !== null && mate !== 0) return `M${Math.abs(mate)}${mate > 0 ? "" : ""}`;
  const v = cp / 100;
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}

const MoveCoachCard: FC<MoveCoachCardProps> = ({
  move,
  currentPly,
  totalPlies,
  isPlaying,
  onTogglePlay,
  onPrev,
  onNext,
  onPrevBlunder,
  onNextBlunder,
  hasPrevBlunder,
  hasNextBlunder,
  onStartPuzzle,
  spentSeconds,
  opening,
  geminiSettingsRev,
  onOpenSettings,
}) => {
  const coach = useGeminiCoach();
  const [copied, setCopied] = useState(false);
  // Re-read settings on prop bump (settings modal saved) and when the move changes.
  const geminiEnabled = (() => {
    if (typeof window === "undefined") return false;
    const s = loadGeminiSettings();
    return s.enabled && !!s.key;
  })();
  // Reset coach output when the user navigates to a different move.
  useEffect(() => {
    coach.reset();
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move?.index, geminiSettingsRev]);

  // Revert the "Copied" tooltip after 1.5s.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    if (!coach.text) return;
    try {
      await navigator.clipboard.writeText(coach.text);
      setCopied(true);
    } catch {
      // Clipboard can fail in non-secure contexts; surface nothing — silent.
    }
  };

  if (!move) {
    return (
      <div className="bg-surface/60 rounded-2xl ring-1 ring-muted/20 p-6 flex flex-col items-center justify-center text-center min-h-[250px]">
        <p className="text-xs text-muted uppercase tracking-wider mb-2">Game Review</p>
        <p className="text-base text-fg/85">Starting position</p>
        <p className="text-sm text-muted/75 mt-1">Press play or → to begin</p>
        <Controls
          isPlaying={isPlaying}
          onTogglePlay={onTogglePlay}
          onPrev={onPrev}
          onNext={onNext}
          currentPly={currentPly}
          totalPlies={totalPlies}
          onPrevBlunder={onPrevBlunder}
          onNextBlunder={onNextBlunder}
          hasPrevBlunder={hasPrevBlunder}
          hasNextBlunder={hasNextBlunder}
        />
      </div>
    );
  }

  const cls = move.classification;
  const ringClass = CLASSIFICATION_RING[cls];
  const isBad = cls === "blunder" || cls === "miss";
  const entryAnim = isBad
    ? "shake-x 480ms ease-out both, fade-in 240ms ease-out both"
    : "fade-in 240ms ease-out both";

  const coachInput: CoachInput = {
    playedSan: move.san,
    bestSan: move.bestMoveSan,
    classification: CLASSIFICATION_NAMES[cls],
    side: move.color === "w" ? "White" : "Black",
    evalBefore: fmtCp(move.cpBefore, move.mateBefore),
    evalAfter: fmtCp(move.cpAfter, move.mateAfter),
    evalIfBest: fmtCp(move.cpBest, null),
    cpLoss: Math.round(move.cpLoss),
    fenBefore: move.fenBefore,
    bestPv: move.bestPv,
    opening,
  };

  return (
    <div
      key={move.index}
      className={`relative bg-surface/70 rounded-2xl ring-2 ${ringClass} p-5 overflow-visible min-h-[250px]`}
      style={{ animation: entryAnim }}
    >
      {/* Side ribbon */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${CLASSIFICATION_BG[cls]} animate-[grow-vertical_320ms_ease-out_both]`}
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-muted uppercase tracking-[0.18em] font-medium">
              {move.color === "w" ? "White" : "Black"} · move {Math.ceil(move.index / 2)}
            </span>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-fg font-mono">{move.san}</span>
            <span
              className={`text-base font-bold ${CLASSIFICATION_COLORS[cls]} inline-block animate-[pop-in_420ms_cubic-bezier(0.34,1.56,0.64,1)_both]`}
            >
              {CLASSIFICATION_LABELS[cls]}
            </span>
          </div>
          <div className={`mt-0.5 text-sm font-medium ${CLASSIFICATION_COLORS[cls]}`}>
            {CLASSIFICATION_NAMES[cls]}
          </div>
        </div>

        {/* Eval delta */}
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted/70 uppercase tracking-wider">Eval</p>
          <div className="flex items-center justify-end gap-1.5 font-mono text-xs">
            <span className="text-muted">{fmtCp(move.cpBefore, move.mateBefore)}</span>
            <span className="text-muted/40">→</span>
            <span className="text-fg/90">{fmtCp(move.cpAfter, move.mateAfter)}</span>
          </div>
          {move.cpLoss > 0 && (
            <p className={`text-[10px] mt-0.5 ${CLASSIFICATION_COLORS[cls]}`}>
              −{(move.cpLoss / 100).toFixed(2)} ({move.winPctLoss.toFixed(1)}%)
            </p>
          )}
          {typeof spentSeconds === "number" && spentSeconds >= 0 && (
            <p className="text-[10px] text-muted/70 mt-0.5 tabular-nums">
              {spentSeconds < 60
                ? `${Math.round(spentSeconds)}s spent`
                : `${Math.floor(spentSeconds / 60)}m ${Math.round(spentSeconds % 60)}s spent`}
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm text-fg/80 leading-snug">
        {CLASSIFICATION_HEADLINES[cls]}
      </p>

      {/* Best alternative */}
      {move.bestMoveSan && move.bestMoveUci !== move.uci && cls !== "best" && cls !== "brilliant" && cls !== "great" && (
        <div className="mt-4 px-3 py-3 rounded-lg bg-surface/60 ring-1 ring-muted/30">
          <p className="text-[10px] text-muted uppercase tracking-wider">Engine recommends</p>
          <div className="flex items-baseline gap-2 mt-1 min-w-0">
            <span className="text-emerald-300 font-mono font-semibold">{move.bestMoveSan}</span>
            {move.bestPv.length > 1 && (
              <span className="text-xs text-muted break-words">
                {move.bestPv.slice(1, 6).join(" ")}
              </span>
            )}
          </div>
        </div>
      )}

      {onStartPuzzle && (
        <button
          onClick={onStartPuzzle}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 ring-1 ring-cyan-500/30 text-cyan-300 text-xs font-medium transition-colors"
        >
          <Target size={12} /> Try yourself: find the best move
        </button>
      )}

      {/* Gemini "Why?" coach */}
      <div className="mt-3">
        {!coach.text && !coach.error && (
          <button
            onClick={() => {
              if (!geminiEnabled) {
                onOpenSettings?.();
                return;
              }
              coach.ask(coachInput);
            }}
            disabled={coach.loading}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 ring-1 ring-violet-500/30 text-violet-200 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-wait"
            title={geminiEnabled ? "Ask Gemini why" : "Add a Gemini API key in Settings"}
          >
            {coach.loading ? (
              <><Loader2 size={11} className="animate-spin" /> Thinking…</>
            ) : (
              <><Sparkles size={12} /> {geminiEnabled ? "Why?" : "Why? (set up Gemini)"}</>
            )}
          </button>
        )}
        {coach.text && (
          <div className="rounded-lg bg-violet-500/8 ring-1 ring-violet-500/25 px-3 py-2.5 animate-[fade-in_220ms_ease-out]">
            <div className="flex items-center justify-between mb-1 gap-2">
              <span className="text-[10px] uppercase tracking-wider text-violet-300/90 flex items-center gap-1">
                <Sparkles size={10} /> Gemini coach
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => coach.regenerate()}
                  disabled={coach.loading}
                  className="grid place-items-center h-5 w-5 rounded text-muted hover:text-fg/90 hover:bg-violet-500/15 transition-colors disabled:opacity-40 disabled:cursor-wait"
                  aria-label="Regenerate"
                  title="Regenerate"
                >
                  {coach.loading ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <RefreshCw size={11} />
                  )}
                </button>
                <button
                  onClick={handleCopy}
                  className="grid place-items-center h-5 w-5 rounded text-muted hover:text-fg/90 hover:bg-violet-500/15 transition-colors"
                  aria-label={copied ? "Copied" : "Copy"}
                  title={copied ? "Copied" : "Copy"}
                >
                  {copied ? <Check size={11} className="text-emerald-300" /> : <Copy size={11} />}
                </button>
                <button
                  onClick={coach.reset}
                  className="text-[10px] text-muted hover:text-fg/90 transition-colors px-1"
                >
                  Hide
                </button>
              </div>
            </div>
            <p className="text-[12px] text-fg/85 leading-relaxed whitespace-pre-wrap">{coach.text}</p>
          </div>
        )}
        {coach.error && (
          <div className="rounded-lg bg-red-500/8 ring-1 ring-red-500/25 px-3 py-2 animate-[fade-in_220ms_ease-out]">
            <p className="text-[11px] text-red-300 leading-snug">{coach.error.message}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <button
                onClick={coach.reset}
                className="text-[10px] text-muted hover:text-fg/90 transition-colors"
              >
                Dismiss
              </button>
              {coach.error.retryable && (
                <button
                  onClick={() => coach.ask(coachInput)}
                  disabled={coach.loading}
                  className="text-[10px] text-violet-300 hover:text-violet-200 transition-colors disabled:opacity-40 disabled:cursor-wait inline-flex items-center gap-1"
                >
                  {coach.loading ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
                  Retry
                </button>
              )}
              {coach.error.kind === "key" && onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="text-[10px] text-violet-300 hover:text-violet-200 transition-colors"
                >
                  Open settings
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <Controls
        isPlaying={isPlaying}
        onTogglePlay={onTogglePlay}
        onPrev={onPrev}
        onNext={onNext}
        currentPly={currentPly}
        totalPlies={totalPlies}
        onPrevBlunder={onPrevBlunder}
        onNextBlunder={onNextBlunder}
        hasPrevBlunder={hasPrevBlunder}
        hasNextBlunder={hasNextBlunder}
      />
    </div>
  );
};

const Controls: FC<{
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentPly: number;
  totalPlies: number;
  onPrevBlunder?: () => void;
  onNextBlunder?: () => void;
  hasPrevBlunder?: boolean;
  hasNextBlunder?: boolean;
}> = ({ isPlaying, onTogglePlay, onPrev, onNext, currentPly, totalPlies, onPrevBlunder, onNextBlunder, hasPrevBlunder, hasNextBlunder }) => (
  <div className="mt-5 space-y-2">
    <div className="flex items-center gap-2">
      <button
        onClick={onPrev}
        disabled={currentPly <= 0}
        className="grid h-9 w-9 place-items-center rounded-lg text-fg/65 hover:text-fg hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Previous move"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={onTogglePlay}
        disabled={currentPly >= totalPlies}
        className="flex-1 flex h-10 items-center justify-center gap-2 px-3 rounded-lg bg-[var(--main)] text-bg hover:brightness-110 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {isPlaying ? <><Pause size={13} /> Pause</> : <><Play size={13} /> Auto-play</>}
      </button>
      <button
        onClick={onNext}
        disabled={currentPly >= totalPlies}
        className="grid h-9 w-9 place-items-center rounded-lg text-fg/65 hover:text-fg hover:bg-surface disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Next move"
      >
        <ChevronRight size={16} />
      </button>
      <span className="text-xs text-muted/70 tabular-nums w-12 text-right">
        {currentPly}/{totalPlies}
      </span>
    </div>
    {(onPrevBlunder || onNextBlunder) && (
      <div className="flex items-center gap-1">
        <button
          onClick={onPrevBlunder}
          disabled={!hasPrevBlunder}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-orange-300 hover:text-orange-200 bg-orange-500/5 hover:bg-orange-500/15 ring-1 ring-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={11} /> <AlertTriangle size={10} /> prev mistake
        </button>
        <button
          onClick={onNextBlunder}
          disabled={!hasNextBlunder}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] text-orange-300 hover:text-orange-200 bg-orange-500/5 hover:bg-orange-500/15 ring-1 ring-orange-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <AlertTriangle size={10} /> next mistake <ChevronRight size={11} />
        </button>
      </div>
    )}
  </div>
);

export default MoveCoachCard;
