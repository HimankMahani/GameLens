"use client";

import { FC, useState } from "react";
import { Chess } from "chess.js";
import { ChevronDown, ChevronUp, Cpu, Database } from "lucide-react";
import { EvaluationResult, MultiPvLine } from "@/hooks/useStockfish";
import { useTablebase } from "@/hooks/useTablebase";
import { CATEGORY_LABEL, CATEGORY_TONE } from "@/lib/tablebase";

interface EnginePanelProps {
  isReady: boolean;
  evaluation: EvaluationResult | null;
  bestMove: string | null;
  topLines?: MultiPvLine[];
  depth?: number;
  onDepthChange?: (d: number) => void;
  multiPv?: number;
  onMultiPvChange?: (n: number) => void;
  /** Current FEN — enables Syzygy tablebase lookup when ≤ 7 pieces. */
  fen?: string | null;
}

const fmtScore = (cp: number, mate: number | null): string => {
  if (mate !== null) return `M${Math.abs(mate)}`;
  const v = cp / 100;
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
};

const scoreColor = (cp: number, mate: number | null): string => {
  if (mate !== null) return "text-amber-300";
  if (cp > 50) return "text-emerald-400";
  if (cp < -50) return "text-red-400";
  return "text-fg/80";
};

/**
 * Convert a single UCI token (e.g. "e2e4", "e7e8q") to SAN at the given
 * starting FEN. Returns the original UCI on illegal/malformed input.
 */
function uciToSan(fen: string, uci: string): string {
  try {
    const c = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;
    const m = c.move({ from, to, promotion });
    return m ? m.san : uci;
  } catch {
    return uci;
  }
}

/**
 * Convert a space-separated UCI line to a SAN line, stepping a chess.js
 * instance from `fen`. If a token is illegal we keep that token in UCI and
 * stop converting — engine PVs sometimes go stale mid-line.
 */
function uciLineToSan(fen: string | null | undefined, uciLine: string): string {
  if (!fen) return uciLine;
  try {
    const c = new Chess(fen);
    const tokens = uciLine.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let bailed = false;
    for (const u of tokens) {
      if (bailed) {
        out.push(u);
        continue;
      }
      const from = u.slice(0, 2);
      const to = u.slice(2, 4);
      const promotion = u.length > 4 ? u[4] : undefined;
      try {
        const m = c.move({ from, to, promotion });
        if (m) {
          out.push(m.san);
        } else {
          out.push(u);
          bailed = true;
        }
      } catch {
        out.push(u);
        bailed = true;
      }
    }
    return out.join(" ");
  } catch {
    return uciLine;
  }
}

const EnginePanel: FC<EnginePanelProps> = ({
  isReady,
  evaluation,
  bestMove,
  topLines = [],
  depth = 14,
  onDepthChange,
  multiPv = 3,
  onMultiPvChange,
  fen,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showDepthPicker, setShowDepthPicker] = useState(false);
  const depths = [12, 14, 18, 22];
  const multiPvOptions = [1, 3, 5];
  const tb = useTablebase(fen ?? null);

  return (
    <div className="bg-surface/60 ring-1 ring-muted/20 rounded-2xl overflow-hidden animate-[fade-in_300ms_ease-out]">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <Cpu size={14} style={{ color: isReady ? "var(--main)" : undefined }} className={isReady ? "" : "text-muted/70 animate-pulse"} />
          <span className="text-xs text-fg/65 font-medium">Engine</span>
          {isReady ? (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold animate-[pulse-ring_2.4s_ease-out_infinite]"
              style={{
                color: "var(--main)",
                background: "color-mix(in srgb, var(--main) 12%, transparent)",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--main) 25%, transparent)",
              }}
            >
              ON
            </span>
          ) : (
            <span className="text-[10px] text-muted bg-surface px-1.5 py-0.5 rounded animate-pulse">…</span>
          )}
        </div>

        {!collapsed && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {onMultiPvChange && (
              <div className="flex items-center gap-0.5">
                {multiPvOptions.map((n) => (
                  <button
                    key={n}
                    onClick={() => onMultiPvChange(n)}
                    className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                      n === multiPv ? "bg-muted/30 text-fg/90" : "text-muted hover:text-fg/80"
                    }`}
                  >
                    {n}L
                  </button>
                ))}
              </div>
            )}
            {onDepthChange && (
              <div className="relative">
                <button
                  onClick={() => setShowDepthPicker((p) => !p)}
                  className="text-[10px] text-muted hover:text-fg/90 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-surface"
                >
                  d{depth} <ChevronDown size={10} />
                </button>
                {showDepthPicker && (
                  <div className="absolute right-0 top-full mt-1 bg-surface ring-1 ring-muted/40 rounded-lg overflow-hidden z-10 animate-[fade-in_140ms_ease-out]">
                    {depths.map((d) => (
                      <button
                        key={d}
                        onClick={() => { onDepthChange(d); setShowDepthPicker(false); }}
                        className={`block w-full text-left px-3 py-1.5 text-xs hover:bg-muted/30 ${
                          d === depth ? "text-fg" : "text-fg/65"
                        }`}
                      >
                        depth {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {collapsed ? <ChevronDown size={14} className="text-muted/70" /> : <ChevronUp size={14} className="text-muted/70" />}
      </div>

      {!collapsed && (
        <div className="px-4 pb-3 space-y-2">
          {tb.eligible && tb.data && (
            <div className="flex items-center justify-between rounded-lg px-2.5 py-1.5 bg-surface ring-1 ring-muted/25 animate-[fade-in_220ms_ease-out]">
              <div className="flex items-center gap-1.5">
                <Database size={11} className="text-muted/80" />
                <span className="text-[10px] text-muted/70 uppercase tracking-wider">
                  Tablebase
                </span>
                <span
                  className={`text-xs font-semibold ${CATEGORY_TONE[tb.data.category]}`}
                >
                  {CATEGORY_LABEL[tb.data.category]}
                </span>
              </div>
              <span className="text-[9px] text-muted/70 uppercase tracking-wider">
                perfect play
              </span>
            </div>
          )}

          {bestMove && bestMove !== "(none)" && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted/70 uppercase tracking-wider">Best</span>
              <span className="text-sm font-mono text-fg">
                {fen ? uciToSan(fen, bestMove) : bestMove}
              </span>
            </div>
          )}

          {evaluation && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted/70 uppercase tracking-wider">
                  {tb.eligible && tb.data ? "Engine guess" : "Eval"}
                </span>
                <span className={`text-sm font-mono font-semibold transition-colors ${scoreColor(evaluation.cp, evaluation.mate)}`}>
                  {fmtScore(evaluation.cp, evaluation.mate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted/70 uppercase tracking-wider">Depth</span>
                <span className="text-xs text-muted tabular-nums">{evaluation.depth}</span>
              </div>
            </>
          )}

          {topLines.length > 0 && (
            <div className="border-t border-muted/25 pt-2 space-y-1">
              <span className="text-[10px] text-muted/70 uppercase tracking-wider">Top lines</span>
              {topLines.map((line, i) => {
                const sanLine = uciLineToSan(fen, line.pv.join(" "));
                const sanTokens = sanLine.split(/\s+/).filter(Boolean);
                return (
                  <div
                    key={`${i}-${line.pvNum}`}
                    className="flex items-start gap-2 animate-[slide-in-right_220ms_ease-out_both]"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <span className="text-[9px] text-muted/70 w-3 mt-0.5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono text-fg/80 truncate">
                          {sanTokens.slice(0, 5).join(" ")}
                        </span>
                        <span className={`text-xs font-mono shrink-0 ${scoreColor(line.cp, line.mate)}`}>
                          {fmtScore(line.cp, line.mate)}
                        </span>
                      </div>
                      {sanTokens.length > 5 && (
                        <p className="text-[9px] text-muted/70 truncate">{sanTokens.slice(5, 10).join(" ")}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isReady && (
            <p className="text-xs text-muted/70 text-center py-2">Loading engine…</p>
          )}

          {tb.eligible && (
            <div className="border-t border-muted/25 pt-2 space-y-1.5 animate-[fade-in_220ms_ease-out]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted/70 uppercase tracking-wider flex items-center gap-1.5">
                  <Database size={10} /> Tablebase
                </span>
                {tb.loading && (
                  <span className="text-[9px] text-muted animate-pulse">querying…</span>
                )}
              </div>
              {tb.data && (
                <>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium ${CATEGORY_TONE[tb.data.category]}`}>
                      {CATEGORY_LABEL[tb.data.category]}
                    </span>
                    <span className="text-[10px] text-muted tabular-nums font-mono">
                      {tb.data.dtm !== null
                        ? `M${Math.abs(tb.data.dtm)}`
                        : tb.data.dtz !== null
                        ? `dtz ${tb.data.dtz}`
                        : ""}
                    </span>
                  </div>
                  {tb.data.moves.length > 0 && (
                    <div className="space-y-0.5">
                      {tb.data.moves.slice(0, 3).map((m, i) => (
                        <div
                          key={`${i}-${m.uci}`}
                          className="flex items-center justify-between text-[11px] font-mono"
                        >
                          <span className="text-fg/80">{m.san}</span>
                          <span className={`${CATEGORY_TONE[m.category]} tabular-nums`}>
                            {m.dtm !== null
                              ? `M${Math.abs(m.dtm)}`
                              : m.dtz !== null
                              ? `dtz ${m.dtz}`
                              : CATEGORY_LABEL[m.category]}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[9px] text-muted/60">
                    Perfect-play data via Lichess Syzygy
                  </p>
                </>
              )}
              {!tb.loading && !tb.data && tb.error && (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted/70">
                    Tablebase service unavailable
                  </p>
                  <button
                    type="button"
                    onClick={tb.retry}
                    className="text-[10px] text-fg/80 hover:text-fg underline underline-offset-2 decoration-muted/50 hover:decoration-fg/60"
                  >
                    Retry
                  </button>
                </div>
              )}
              {!tb.loading && !tb.data && !tb.error && (
                <p className="text-[10px] text-muted/70">
                  Position not in tablebase.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnginePanel;
