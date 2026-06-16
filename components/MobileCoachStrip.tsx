"use client";

import { FC, useEffect, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Sparkles, Target } from "lucide-react";
import { AnalyzedMove } from "@/lib/analysis";
import {
  CLASSIFICATION_BG,
  CLASSIFICATION_COLORS,
  CLASSIFICATION_HEADLINES,
  CLASSIFICATION_LABELS,
  CLASSIFICATION_NAMES,
} from "@/lib/moveClass";
import { useGeminiCoach } from "@/hooks/useGeminiCoach";
import { loadGeminiSettings, type CoachInput } from "@/lib/gemini";

interface MobileCoachStripProps {
  move: AnalyzedMove | null;
  opening?: string;
  geminiSettingsRev?: number;
  onOpenSettings?: () => void;
  onStartPuzzle?: () => void;
}

function fmtCp(cp: number, mate: number | null): string {
  if (mate !== null && mate !== 0) return `M${Math.abs(mate)}`;
  const v = cp / 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}

const MobileCoachStrip: FC<MobileCoachStripProps> = ({
  move,
  opening,
  geminiSettingsRev,
  onOpenSettings,
  onStartPuzzle,
}) => {
  const [expanded, setExpanded] = useState(false);
  const coach = useGeminiCoach();
  const geminiEnabled = (() => {
    if (typeof window === "undefined") return false;
    const s = loadGeminiSettings();
    return s.enabled && !!s.key;
  })();

  // Collapse + reset when the move changes.
  useEffect(() => {
    setExpanded(false);
    coach.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [move?.index, geminiSettingsRev]);

  if (!move) {
    return (
      <div className="lg:hidden rounded-xl bg-surface/60 ring-1 ring-muted/20 px-3 py-2 text-center text-xs text-muted/80">
        Starting position — tap → to begin
      </div>
    );
  }

  const cls = move.classification;
  const headline = CLASSIFICATION_HEADLINES[cls];
  const isBad =
    cls === "blunder" || cls === "mistake" || cls === "miss" || cls === "inaccuracy";

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
      className="lg:hidden rounded-xl bg-surface/70 ring-1 ring-muted/20 overflow-hidden animate-[fade-in_220ms_ease-out]"
    >
      {/* Compact header row — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        <span className={`w-1 h-7 rounded-full ${CLASSIFICATION_BG[cls]} shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono font-semibold text-fg text-sm">
              {move.san}
            </span>
            <span className={`text-sm font-bold ${CLASSIFICATION_COLORS[cls]}`}>
              {CLASSIFICATION_LABELS[cls]}
            </span>
            <span className={`text-xs font-medium ${CLASSIFICATION_COLORS[cls]}`}>
              {CLASSIFICATION_NAMES[cls]}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-fg/70 leading-tight truncate">
            {headline}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[11px] text-muted">
            {fmtCp(move.cpBefore, move.mateBefore)}
          </div>
          <div className="font-mono text-[11px] text-fg/90">
            {fmtCp(move.cpAfter, move.mateAfter)}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`text-muted/70 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-muted/15 animate-[fade-in_200ms_ease-out]">
          {/* Best alternative inline */}
          {move.bestMoveSan &&
            move.bestMoveUci !== move.uci &&
            cls !== "best" &&
            cls !== "brilliant" &&
            cls !== "great" && (
              <div className="mt-2 px-2.5 py-2 rounded-lg bg-surface/60 ring-1 ring-muted/25">
                <p className="text-[10px] text-muted uppercase tracking-wider">
                  Engine recommends
                </p>
                <div className="flex items-baseline gap-2 mt-0.5 min-w-0">
                  <span className="text-emerald-300 font-mono font-semibold text-sm">
                    {move.bestMoveSan}
                  </span>
                  {move.bestPv.length > 1 && (
                    <span className="text-[11px] text-muted break-words">
                      {move.bestPv.slice(1, 5).join(" ")}
                    </span>
                  )}
                </div>
              </div>
            )}

          {isBad && onStartPuzzle && (
            <button
              onClick={onStartPuzzle}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/30 text-cyan-300 text-xs font-medium"
            >
              <Target size={12} /> Try yourself: find the best move
            </button>
          )}

          {/* Gemini "Why?" */}
          <div className="mt-2">
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
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/10 ring-1 ring-violet-500/30 text-violet-200 text-xs font-medium disabled:opacity-50"
              >
                {coach.loading ? (
                  <>
                    <Loader2 size={11} className="animate-spin" /> Thinking…
                  </>
                ) : (
                  <>
                    <Sparkles size={12} /> {geminiEnabled ? "Why?" : "Why? (set up Gemini)"}
                  </>
                )}
              </button>
            )}
            {coach.text && (
              <div className="rounded-lg bg-violet-500/8 ring-1 ring-violet-500/25 px-3 py-2 mt-1">
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-violet-300/90 flex items-center gap-1">
                    <Sparkles size={10} /> Coach
                  </span>
                  <button
                    onClick={() => coach.regenerate()}
                    disabled={coach.loading}
                    className="grid place-items-center h-5 w-5 rounded text-muted disabled:opacity-40"
                    aria-label="Regenerate"
                  >
                    {coach.loading ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <RefreshCw size={11} />
                    )}
                  </button>
                </div>
                <div className="text-[12px] text-fg/85 leading-snug whitespace-pre-wrap">
                  {coach.text}
                </div>
              </div>
            )}
            {coach.error && (
              <p className="text-[11px] text-red-300 leading-snug mt-1">
                {coach.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileCoachStrip;
