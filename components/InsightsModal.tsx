"use client";

import { FC, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { BarChart3, X, Loader2, Target, BookOpen, TrendingUp } from "lucide-react";
import { listGames, type CachedGame } from "@/lib/gameCache";
import { parsePgnHeaders } from "@/lib/pgnFetch";
import { countPuzzles } from "@/lib/puzzleQueue";
import {
  CLASSIFICATION_NAMES,
} from "@/lib/moveClass";
import type { MoveClassification } from "@/lib/analysis";

interface InsightsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenGame?: (game: CachedGame) => void;
  onOpenMarathon?: () => void;
}

const TRACKED_CLASSES: MoveClassification[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "inaccuracy",
  "mistake",
  "blunder",
  "miss",
];

function detectDominantHandle(games: CachedGame[]): string | null {
  // Prefer a saved handle from previous imports.
  const lichessHandle = typeof localStorage !== "undefined"
    ? localStorage.getItem("chess-analyzer.handle.lichess")
    : null;
  const chesscomHandle = typeof localStorage !== "undefined"
    ? localStorage.getItem("chess-analyzer.handle.chesscom")
    : null;
  const candidates: string[] = [];
  if (lichessHandle) candidates.push(lichessHandle.toLowerCase());
  if (chesscomHandle) candidates.push(chesscomHandle.toLowerCase());

  // Fallback: most-common name across white/black headers.
  if (candidates.length === 0) {
    const counts = new Map<string, number>();
    for (const g of games) {
      const h = parsePgnHeaders(g.pgn);
      if (h.white) counts.set(h.white.toLowerCase(), (counts.get(h.white.toLowerCase()) ?? 0) + 1);
      if (h.black) counts.set(h.black.toLowerCase(), (counts.get(h.black.toLowerCase()) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 1;
    for (const [k, v] of counts) {
      if (v > bestN) { best = k; bestN = v; }
    }
    return best;
  }
  return candidates[0];
}

function pickSide(g: CachedGame, handle: string | null): "w" | "b" | null {
  if (!handle) return null;
  const h = parsePgnHeaders(g.pgn);
  if (h.white?.toLowerCase() === handle) return "w";
  if (h.black?.toLowerCase() === handle) return "b";
  return null;
}

function ecoOrName(pgn: string): string {
  const h = parsePgnHeaders(pgn);
  if (h.eco) return h.eco;
  if (h.event) return h.event;
  return "Unknown";
}

const InsightsModal: FC<InsightsModalProps> = ({
  isOpen,
  onClose,
  onOpenGame,
  onOpenMarathon,
}) => {
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<CachedGame[]>([]);
  const [puzzleStats, setPuzzleStats] = useState<{ total: number; due: number }>({ total: 0, due: 0 });

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([listGames(), countPuzzles()]).then(([g, p]) => {
      if (cancelled) return;
      setGames(g);
      setPuzzleStats(p);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen]);

  const handle = useMemo(() => detectDominantHandle(games), [games]);

  const summary = useMemo(() => {
    if (games.length === 0) return null;
    const accs: number[] = [];
    const acpls: number[] = [];
    const dist: Record<MoveClassification, number> = {
      brilliant: 0, great: 0, best: 0, excellent: 0, good: 0,
      book: 0, inaccuracy: 0, mistake: 0, blunder: 0, miss: 0, forced: 0,
    };
    let totalMoves = 0;
    let wins = 0, draws = 0, losses = 0;
    let withResult = 0;
    for (const g of games) {
      const side = pickSide(g, handle);
      const sideSummary = side === "b" ? g.summary.black : g.summary.white;
      const otherSummary = side === "b" ? g.summary.white : g.summary.black;
      // If we can't pin the side, average both — at least gives a baseline.
      if (side) {
        accs.push(sideSummary.accuracy);
        acpls.push(sideSummary.acpl);
      } else {
        accs.push((g.summary.white.accuracy + g.summary.black.accuracy) / 2);
        acpls.push((g.summary.white.acpl + g.summary.black.acpl) / 2);
      }
      const counts = side ? sideSummary.counts : g.summary.white.counts;
      for (const c of TRACKED_CLASSES) {
        dist[c] += counts[c] ?? 0;
      }
      totalMoves += g.summary.totalMoves;

      // Result tracking (only when we know the side).
      const h = parsePgnHeaders(g.pgn);
      if (side && h.result) {
        withResult += 1;
        if (h.result === "1-0") side === "w" ? wins++ : losses++;
        else if (h.result === "0-1") side === "b" ? wins++ : losses++;
        else if (h.result === "1/2-1/2") draws++;
        // unused; silences linter when otherSummary not referenced
        void otherSummary;
      }
    }
    return {
      gameCount: games.length,
      avgAcc: accs.reduce((a, b) => a + b, 0) / accs.length,
      avgAcpl: acpls.reduce((a, b) => a + b, 0) / acpls.length,
      dist,
      totalMoves,
      wins, draws, losses, withResult,
    };
  }, [games, handle]);

  // Time series of accuracy per game (oldest → newest)
  const timeSeries = useMemo(() => {
    const sorted = [...games].sort((a, b) => a.savedAt - b.savedAt);
    return sorted.map((g, i) => {
      const side = pickSide(g, handle);
      const acc = side === "b"
        ? g.summary.black.accuracy
        : side === "w"
        ? g.summary.white.accuracy
        : (g.summary.white.accuracy + g.summary.black.accuracy) / 2;
      const h = parsePgnHeaders(g.pgn);
      return {
        idx: i + 1,
        accuracy: Math.round(acc * 10) / 10,
        label: h.white && h.black ? `${h.white} vs ${h.black}` : `Game ${i + 1}`,
        date: new Date(g.savedAt).toLocaleDateString(),
      };
    });
  }, [games, handle]);

  // Classification distribution (filtered to high-signal classes)
  const distData = useMemo(() => {
    if (!summary) return [];
    return TRACKED_CLASSES.map((c) => ({
      name: CLASSIFICATION_NAMES[c],
      key: c,
      count: summary.dist[c] ?? 0,
    })).filter((d) => d.count > 0);
  }, [summary]);

  // Per-opening aggregation
  const openingStats = useMemo(() => {
    if (games.length === 0) return [];
    const map = new Map<string, { games: number; accSum: number; wins: number; losses: number; draws: number; }>();
    for (const g of games) {
      const key = ecoOrName(g.pgn);
      const side = pickSide(g, handle);
      const acc = side === "b"
        ? g.summary.black.accuracy
        : side === "w"
        ? g.summary.white.accuracy
        : (g.summary.white.accuracy + g.summary.black.accuracy) / 2;
      const cur = map.get(key) ?? { games: 0, accSum: 0, wins: 0, losses: 0, draws: 0 };
      cur.games += 1;
      cur.accSum += acc;
      const h = parsePgnHeaders(g.pgn);
      if (side && h.result) {
        if (h.result === "1-0") side === "w" ? cur.wins++ : cur.losses++;
        else if (h.result === "0-1") side === "b" ? cur.wins++ : cur.losses++;
        else if (h.result === "1/2-1/2") cur.draws++;
      }
      map.set(key, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        games: v.games,
        accuracy: Math.round((v.accSum / v.games) * 10) / 10,
        wins: v.wins,
        draws: v.draws,
        losses: v.losses,
      }))
      .sort((a, b) => b.games - a.games)
      .slice(0, 8);
  }, [games, handle]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 sm:py-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface ring-1 ring-muted/40 rounded-2xl shadow-2xl w-full max-w-3xl mx-4 p-5 animate-[slide-up_220ms_ease-out_both]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-cyan-300" />
            <p className="text-sm font-semibold text-fg">Your insights</p>
            {handle && (
              <span className="text-[10px] text-muted/80">as {handle}</span>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex items-center justify-center text-muted">
            <Loader2 size={16} className="animate-spin mr-2" /> Loading…
          </div>
        ) : games.length === 0 ? (
          <div className="py-10 text-center">
            <BarChart3 size={20} className="text-muted/60 mx-auto mb-2" />
            <p className="text-sm text-fg/85">No analyzed games yet.</p>
            <p className="text-[11px] text-muted/80 mt-1">
              Import or bulk-analyze games to populate your insights.
            </p>
          </div>
        ) : summary ? (
          <div className="space-y-4">
            {/* Top stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Stat label="Games" value={summary.gameCount.toString()} />
              <Stat label="Avg accuracy" value={summary.avgAcc.toFixed(1)} accent />
              <Stat label="Avg ACPL" value={Math.round(summary.avgAcpl).toString()} />
              <Stat
                label="Puzzle queue"
                value={`${puzzleStats.due} / ${puzzleStats.total}`}
                onClick={onOpenMarathon}
                hint={onOpenMarathon ? "open" : undefined}
              />
            </div>

            {summary.withResult >= 3 && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg/40 ring-1 ring-muted/20 text-[11px] text-fg/85">
                <TrendingUp size={11} className="text-emerald-300" />
                <span>
                  Record: <b className="text-emerald-300">{summary.wins}W</b>{" "}
                  <b className="text-zinc-300">{summary.draws}D</b>{" "}
                  <b className="text-red-300">{summary.losses}L</b> across {summary.withResult} games where we matched your handle.
                </span>
              </div>
            )}

            {/* Accuracy over time */}
            {timeSeries.length >= 2 && (
              <div className="rounded-xl bg-bg/40 ring-1 ring-muted/25 p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted/85 font-medium">Accuracy over time</p>
                  <p className="text-[10px] text-muted/70">{timeSeries.length} games</p>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="idx" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} width={28} />
                      <Tooltip
                        contentStyle={{ background: "rgba(20,20,28,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                        labelFormatter={(_, p) => p[0]?.payload?.label ?? ""}
                        formatter={(v) => [`${v ?? 0}%`, "Accuracy"]}
                      />
                      <Line type="monotone" dataKey="accuracy" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Classification distribution */}
            {distData.length > 0 && (
              <div className="rounded-xl bg-bg/40 ring-1 ring-muted/25 p-3">
                <p className="text-[11px] uppercase tracking-wider text-muted/85 font-medium mb-2">Move classifications {handle ? "(your moves)" : ""}</p>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={distData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={50} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} width={28} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "rgba(20,20,28,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                        {distData.map((d) => {
                          // Tailwind class → hex (approximate, matches CLASSIFICATION_BG visually).
                          const hex = classToHex(d.key);
                          return <Cell key={d.key} fill={hex} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Openings */}
            {openingStats.length > 0 && (
              <div className="rounded-xl bg-bg/40 ring-1 ring-muted/25 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <BookOpen size={11} className="text-amber-300" />
                  <p className="text-[11px] uppercase tracking-wider text-muted/85 font-medium">Openings</p>
                </div>
                <div className="space-y-1">
                  <div className="grid grid-cols-[1fr_60px_60px_60px] gap-2 text-[10px] uppercase tracking-wider text-muted/60 px-1.5">
                    <span>ECO / Event</span>
                    <span className="text-right">Games</span>
                    <span className="text-right">Acc</span>
                    <span className="text-right">W-D-L</span>
                  </div>
                  {openingStats.map((o) => (
                    <div
                      key={o.name}
                      className="grid grid-cols-[1fr_60px_60px_60px] gap-2 items-center text-[12px] px-1.5 py-1 rounded-md hover:bg-surface/50 transition-colors"
                    >
                      <span className="text-fg/85 truncate">{o.name}</span>
                      <span className="text-right text-muted tabular-nums">{o.games}</span>
                      <span className={`text-right tabular-nums ${o.accuracy >= 75 ? "text-emerald-300" : o.accuracy >= 60 ? "text-yellow-300" : "text-orange-300"}`}>{o.accuracy}</span>
                      <span className="text-right text-[11px] tabular-nums text-muted/85">
                        <b className="text-emerald-300">{o.wins}</b>-<b>{o.draws}</b>-<b className="text-red-300">{o.losses}</b>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {puzzleStats.total > 0 && onOpenMarathon && (
              <button
                onClick={() => { onOpenMarathon(); }}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 ring-1 ring-cyan-400/40 text-cyan-100 text-xs font-medium transition-colors"
              >
                <Target size={12} /> Practice {puzzleStats.due > 0 ? `${puzzleStats.due} due puzzle${puzzleStats.due === 1 ? "" : "s"}` : "your puzzle queue"}
              </button>
            )}

            {/* Recent games shortcut */}
            {onOpenGame && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted/85 hover:text-fg/95 transition-colors">
                  All {games.length} cached games
                </summary>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto pr-1">
                  {games.slice(0, 50).map((g) => {
                    const h = parsePgnHeaders(g.pgn);
                    const side = pickSide(g, handle);
                    const acc = side === "b" ? g.summary.black.accuracy : side === "w" ? g.summary.white.accuracy : null;
                    return (
                      <button
                        key={g.key}
                        onClick={() => { onOpenGame(g); onClose(); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface/60 transition-colors text-left"
                      >
                        <span className="flex-1 text-[11px] text-fg/85 truncate">
                          {h.white ?? "?"} vs {h.black ?? "?"} {h.result && <span className="text-muted/70">· {h.result}</span>}
                        </span>
                        {acc !== null && (
                          <span className="text-[11px] font-mono tabular-nums text-cyan-300/85">{acc.toFixed(1)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const Stat: FC<{ label: string; value: string; accent?: boolean; onClick?: () => void; hint?: string }> = ({ label, value, accent, onClick, hint }) => {
  const inner = (
    <>
      <p className="text-[10px] uppercase tracking-wider text-muted/70">{label}</p>
      <p className={`text-xl font-semibold tabular-nums ${accent ? "text-cyan-300" : "text-fg"}`}>{value}</p>
      {hint && <p className="text-[9px] text-muted/60 mt-0.5">{hint}</p>}
    </>
  );
  return onClick ? (
    <button
      onClick={onClick}
      className="rounded-xl bg-bg/40 ring-1 ring-muted/25 hover:ring-muted/45 px-3 py-2.5 text-left transition-colors"
    >
      {inner}
    </button>
  ) : (
    <div className="rounded-xl bg-bg/40 ring-1 ring-muted/25 px-3 py-2.5">{inner}</div>
  );
};

// recharts Cell needs a separate import
function classToHex(c: MoveClassification): string {
  // mirrors the Tailwind tones used elsewhere
  const m: Record<MoveClassification, string> = {
    brilliant: "#22d3ee",
    great: "#60a5fa",
    best: "#34d399",
    excellent: "#10b981",
    good: "#71717a",
    book: "#fbbf24",
    inaccuracy: "#facc15",
    mistake: "#f97316",
    blunder: "#ef4444",
    miss: "#fb7185",
    forced: "#71717a",
  };
  // referencing CLASSIFICATION_BG keeps the import live for future tweaks.
  return m[c];
}

export default InsightsModal;
