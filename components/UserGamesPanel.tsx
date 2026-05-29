"use client";

import { FC, useState, useEffect, useRef } from "react";
import { Search, Loader2, ChevronRight, Sparkles, X, AlertCircle, CheckCircle2, Target } from "lucide-react";
import { fetchChesscomGames, fetchLichessGames, type Source, type UserGameSummary } from "@/lib/userGames";
import { bulkAnalyze, type BulkProgress } from "@/lib/bulkAnalyze";

interface UserGamesPanelProps {
  /** Single-game selection — opens the existing analyze flow. */
  onPick: (pgn: string) => void;
  /** Optional: where to send the user after a successful bulk run (e.g. open Insights). */
  onBulkDone?: (info: { puzzlesAdded: number; analyzed: number; fromCache: number }) => void;
  /** Default depth for bulk analysis. */
  bulkDepth?: number;
}

const COUNTS = [10, 15, 25] as const;

const fmtAgo = (ms: number) => {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(ms).toLocaleDateString();
};

const HANDLE_KEY_LICHESS = "chess-analyzer.handle.lichess";
const HANDLE_KEY_CC = "chess-analyzer.handle.chesscom";

const UserGamesPanel: FC<UserGamesPanelProps> = ({ onPick, onBulkDone, bulkDepth = 14 }) => {
  const [source, setSource] = useState<Source>("lichess");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<UserGameSummary[] | null>(null);
  const [error, setError] = useState("");
  const [bulkCount, setBulkCount] = useState<(typeof COUNTS)[number]>(15);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [bulkSummary, setBulkSummary] = useState<{ analyzed: number; fromCache: number; failed: number; puzzlesAdded: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Recall the last handle the user typed for each source.
  useEffect(() => {
    const saved = source === "lichess"
      ? localStorage.getItem(HANDLE_KEY_LICHESS)
      : localStorage.getItem(HANDLE_KEY_CC);
    setName(saved ?? "");
    setError("");
  }, [source]);

  // Auto-load on mount if a handle was previously saved for the current source.
  // Runs once — switching source after mount stays a manual action.
  useEffect(() => {
    const saved = source === "lichess"
      ? localStorage.getItem(HANDLE_KEY_LICHESS)
      : localStorage.getItem(HANDLE_KEY_CC);
    if (saved && saved.trim()) {
      void load(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (override?: string) => {
    const handle = (override ?? name).trim();
    if (!handle) return;
    setLoading(true);
    setError("");
    setGames(null);
    setBulkSummary(null);
    try {
      const g = source === "lichess"
        ? await fetchLichessGames(handle, 25)
        : await fetchChesscomGames(handle, 25);
      if (g.length === 0) setError(`No games found for "${handle}"`);
      else setGames(g);
      localStorage.setItem(
        source === "lichess" ? HANDLE_KEY_LICHESS : HANDLE_KEY_CC,
        handle
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const startBulk = async () => {
    if (!games || games.length === 0) return;
    const handle = name.trim();
    const slice = games.slice(0, bulkCount).map((g) => g.pgn);
    abortRef.current = new AbortController();
    setBulkRunning(true);
    setBulkProgress(null);
    setBulkSummary(null);
    try {
      const r = await bulkAnalyze(slice, {
        depth: bulkDepth,
        player: handle || undefined,
        signal: abortRef.current.signal,
        onProgress: setBulkProgress,
      });
      setBulkSummary({
        analyzed: r.analyzed,
        fromCache: r.fromCache,
        failed: r.failed,
        puzzlesAdded: r.puzzlesAdded,
      });
      onBulkDone?.({ puzzlesAdded: r.puzzlesAdded, analyzed: r.analyzed, fromCache: r.fromCache });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBulkRunning(false);
      setBulkProgress(null);
      abortRef.current = null;
    }
  };

  const cancelBulk = () => {
    abortRef.current?.abort();
  };

  const overallPct = bulkProgress
    ? Math.round(
        ((bulkProgress.gameIndex +
          (bulkProgress.currentTotal > 0
            ? bulkProgress.current / bulkProgress.currentTotal
            : 0)) /
          Math.max(1, bulkProgress.total)) *
          100
      )
    : 0;

  return (
    <div className="mt-4 animate-[fade-in_300ms_ease-out_140ms_both]">
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {(["lichess", "chesscom"] as Source[]).map((s) => (
          <button
            key={s}
            onClick={() => { setSource(s); setGames(null); setError(""); }}
            className={`h-8 px-3 rounded-md text-xs font-medium transition-colors ${
              source === s ? "bg-[var(--main)] text-bg" : "text-muted hover:text-fg/90 hover:bg-surface"
            }`}
          >
            {s === "lichess" ? "Lichess" : "Chess.com"}
          </button>
        ))}
        <p className="basis-full sm:basis-auto text-xs text-muted/70 sm:ml-2">Load recent games by username</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/70 pointer-events-none" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(); }}
            placeholder={source === "lichess" ? "your-lichess-handle" : "your-chess-com-handle"}
            disabled={bulkRunning}
            className="w-full h-10 pl-9 pr-3 text-sm bg-bg/60 ring-1 ring-muted/25 rounded-lg text-fg placeholder-muted/50 focus:outline-none focus:ring-muted/55 disabled:opacity-60"
          />
        </div>
        <button
          onClick={() => load()}
          disabled={loading || bulkRunning || !name.trim()}
          className="h-10 px-4 bg-[var(--main)] text-bg text-sm font-medium rounded-lg hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Load
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-xs mt-2 animate-[fade-in_180ms_ease-out]">{error}</p>
      )}

      {/* Bulk-analyze action — appears once games are loaded. */}
      {games && games.length > 0 && !bulkRunning && !bulkSummary && (
        <div className="mt-3 p-3 rounded-lg bg-violet-500/8 ring-1 ring-violet-500/25 animate-[fade-in_220ms_ease-out]">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-violet-300" />
            <p className="text-xs font-medium text-violet-200">Build a puzzle set from your mistakes</p>
          </div>
          <p className="text-[11px] text-muted/85 leading-relaxed">
            Analyze multiple recent games in the background. Every blunder, mistake, and miss
            you made is added to a personal puzzle queue you can grind in Marathon mode.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-[10px] uppercase tracking-wider text-muted/70">Count</span>
            <div className="flex gap-0.5">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBulkCount(c)}
                  className={`h-7 px-2.5 text-[11px] rounded-md transition-colors ${
                    bulkCount === c
                      ? "bg-violet-500/30 text-violet-100 ring-1 ring-violet-400/40"
                      : "text-muted hover:text-fg/90 hover:bg-surface"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-muted/60">depth {bulkDepth}</span>
            <div className="flex-1" />
            <button
              onClick={startBulk}
              className="h-9 px-4 rounded-lg bg-violet-500/30 hover:bg-violet-500/40 ring-1 ring-violet-400/40 text-violet-50 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Target size={12} /> Analyze {Math.min(bulkCount, games.length)} games
            </button>
          </div>
        </div>
      )}

      {/* Live progress UI */}
      {bulkRunning && bulkProgress && (
        <div className="mt-3 p-3 rounded-lg bg-bg/40 ring-1 ring-muted/25 animate-[fade-in_180ms_ease-out]">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-medium text-fg/85 flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin text-violet-300" />
              Analyzing game {bulkProgress.gameIndex + 1} / {bulkProgress.total}
              {bulkProgress.cachedHit && <span className="text-[9px] text-emerald-300/80">(cached)</span>}
            </p>
            <button
              onClick={cancelBulk}
              className="text-[10px] text-muted hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <X size={10} /> Cancel
            </button>
          </div>
          <p className="text-[10px] text-muted/70 truncate mb-1.5">
            {bulkProgress.white ?? "?"} vs {bulkProgress.black ?? "?"}
            {bulkProgress.currentTotal > 0 && (
              <span> · ply {bulkProgress.current} / {bulkProgress.currentTotal}</span>
            )}
          </p>
          <div className="h-1.5 rounded-full bg-bg overflow-hidden">
            <div
              className="h-full bg-violet-400/70 transition-all"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary after bulk done */}
      {bulkSummary && !bulkRunning && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-500/8 ring-1 ring-emerald-500/30 animate-[fade-in_220ms_ease-out]">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="text-emerald-300 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-200">
                Done — {bulkSummary.analyzed} analyzed, {bulkSummary.fromCache} from cache
                {bulkSummary.failed > 0 && (
                  <span className="text-orange-300"> · {bulkSummary.failed} skipped</span>
                )}
              </p>
              <p className="text-[11px] text-muted/85 mt-0.5">
                {bulkSummary.puzzlesAdded > 0
                  ? `${bulkSummary.puzzlesAdded} puzzle${bulkSummary.puzzlesAdded === 1 ? "" : "s"} added to your queue.`
                  : "No new puzzles — clean games!"}
              </p>
            </div>
            <button
              onClick={() => setBulkSummary(null)}
              className="text-muted hover:text-fg/90 transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {games && games.length > 0 && (
        <div className="mt-2 space-y-1 max-h-60 overflow-y-auto pr-1">
          {games.map((g, i) => (
            <div
              key={g.id}
              role="button"
              tabIndex={0}
              onClick={() => onPick(g.pgn)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(g.pgn); } }}
              className={`group flex items-center gap-3 px-3 py-2 rounded-lg bg-surface/50 hover:bg-surface/80 ring-1 ring-muted/20 hover:ring-muted/40 transition-colors text-left cursor-pointer ${
                bulkRunning && bulkProgress && i === bulkProgress.gameIndex ? "ring-violet-400/40 bg-violet-500/5" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-fg truncate">
                  {g.white}{g.whiteElo && <span className="text-muted"> ({g.whiteElo})</span>}
                  <span className="text-muted/70 px-1.5">vs</span>
                  {g.black}{g.blackElo && <span className="text-muted"> ({g.blackElo})</span>}
                </p>
                <p className="text-[10px] text-muted/70 truncate">
                  {g.result} {g.timeControl ? `· ${g.timeControl}` : ""} {g.end ? `· ${fmtAgo(g.end)}` : ""}
                </p>
              </div>
              <ChevronRight size={13} className="text-muted/40 group-hover:text-fg transition-colors shrink-0" />
            </div>
          ))}
        </div>
      )}

      {games && games.length === 0 && !error && (
        <div className="mt-2 p-3 rounded-lg bg-surface/30 ring-1 ring-muted/20 text-[11px] text-muted/85 flex items-center gap-2">
          <AlertCircle size={12} /> No games loaded yet.
        </div>
      )}
    </div>
  );
};

export default UserGamesPanel;
