"use client";

import { FC, useEffect, useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import { CachedGame, deleteGame, listGames } from "@/lib/gameCache";
import { parsePgnHeaders } from "@/lib/pgnFetch";

interface RecentGamesProps {
  onOpen: (game: CachedGame) => void;
  /** bump to trigger a reload */
  refreshKey?: number;
}

function fmtAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString();
}

function accuracyTone(acc: number): string {
  if (acc >= 90) return "text-cyan-300";
  if (acc >= 80) return "text-emerald-300";
  if (acc >= 70) return "text-emerald-400";
  if (acc >= 60) return "text-yellow-400";
  if (acc >= 50) return "text-orange-400";
  return "text-red-400";
}

const RecentGames: FC<RecentGamesProps> = ({ onOpen, refreshKey = 0 }) => {
  const [games, setGames] = useState<CachedGame[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = async () => {
    const list = await listGames();
    setGames(list);
    setLoaded(true);
  };

  useEffect(() => {
    reload();
  }, [refreshKey]);

  const handleDelete = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    await deleteGame(key);
    reload();
  };

  if (!loaded) return null;
  if (games.length === 0) return null;

  return (
    <div className="mt-6 animate-[fade-in_400ms_ease-out_200ms_both]">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium flex items-center gap-1.5">
          <Clock size={11} /> Recent games
        </p>
        <span className="text-[10px] text-muted/70">{games.length}</span>
      </div>
      <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
        {games.map((g) => {
          const h = parsePgnHeaders(g.pgn);
          const wAcc = g.summary?.white.accuracy ?? null;
          const bAcc = g.summary?.black.accuracy ?? null;
          return (
            <div
              key={g.key}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(g)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(g); } }}
              className="group w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-surface/50 hover:bg-surface/80 ring-1 ring-muted/20 hover:ring-muted/40 transition-colors text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-muted/40"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-fg truncate">
                  {h.white || "?"}
                  {h.whiteElo && <span className="text-muted"> ({h.whiteElo})</span>}
                  <span className="text-muted/70 px-1.5">vs</span>
                  {h.black || "?"}
                  {h.blackElo && <span className="text-muted"> ({h.blackElo})</span>}
                </p>
                <p className="text-[10px] text-muted/70 truncate">
                  {h.result || "*"} · {g.moves.length} moves · d{g.depth} · {fmtAgo(g.savedAt)}
                  {h.eco && <span> · {h.eco}</span>}
                </p>
              </div>
              {wAcc !== null && bAcc !== null && (
                <span className="flex items-center gap-1 text-[10px] font-mono tabular-nums shrink-0" title="White / Black accuracy">
                  <span className={accuracyTone(wAcc)}>{wAcc.toFixed(1)}</span>
                  <span className="text-muted/40">/</span>
                  <span className={accuracyTone(bAcc)}>{bAcc.toFixed(1)}</span>
                </span>
              )}
              <button
                onClick={(e) => handleDelete(e, g.key)}
                className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 transition-opacity"
                title="Delete"
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentGames;
