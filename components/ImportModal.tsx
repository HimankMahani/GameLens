"use client";

import { FC, useState } from "react";
import { ClipboardPaste, Sparkles, Hash, Link as LinkIcon, Loader2, X, Upload } from "lucide-react";
import { detectSource, fetchPgn } from "@/lib/pgnFetch";
import UserGamesPanel from "./UserGamesPanel";
import RecentGames from "./RecentGames";
import type { CachedGame } from "@/lib/gameCache";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (pgn: string, opts: { depth: number }) => void;
  onExplore?: (fen: string) => void;
  onOpenCached?: (game: CachedGame) => void;
  onBulkDone?: (info: { puzzlesAdded: number; analyzed: number; fromCache: number }) => void;
  defaultDepth?: 12 | 14 | 18;
}

const ImportModal: FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onStart,
  onExplore,
  onOpenCached,
  onBulkDone,
  defaultDepth = 14,
}) => {
  const [tab, setTab] = useState<"pgn" | "fen">("pgn");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [depth, setDepth] = useState<12 | 14 | 18>(defaultDepth);
  const [fetching, setFetching] = useState(false);

  if (!isOpen) return null;

  const close = () => {
    setInput("");
    setError("");
    onClose();
  };

  const handleStart = async () => {
    setError("");
    const v = input.trim();
    if (!v) {
      setError("Paste a PGN or game URL first.");
      return;
    }
    if (tab === "fen") {
      if (onExplore) {
        onExplore(v);
        close();
      } else {
        setError("FEN exploration is not enabled.");
      }
      return;
    }
    if (detectSource(v)) {
      setFetching(true);
      try {
        const { pgn } = await fetchPgn(v);
        onStart(pgn, { depth });
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setFetching(false);
      }
      return;
    }
    onStart(v, { depth });
    close();
  };

  const handlePaste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setInput(t);
    } catch {
      setError("Couldn't read clipboard. Paste manually.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto py-6 sm:py-10">
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-surface ring-1 ring-muted/40 rounded-2xl shadow-2xl w-full max-w-xl mx-4 p-5 animate-[slide-up_220ms_ease-out_both]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Upload size={14} className="text-fg/65" />
            <p className="text-sm font-semibold text-fg">Import a game</p>
          </div>
          <button onClick={close} className="text-muted hover:text-fg transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <p className="text-[11px] text-muted/85 mb-3 leading-relaxed">
          Your current game stays open — closing this dialog returns you to it.
        </p>

        <div className="flex items-center gap-1 mb-2">
          {(["pgn", "fen"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              className={`h-8 px-3 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                tab === t ? "bg-[var(--main)] text-bg" : "text-muted hover:text-fg/90 hover:bg-bg/50"
              }`}
            >
              {t === "pgn" ? <><LinkIcon size={11} /> PGN / URL</> : <><Hash size={11} /> FEN</>}
            </button>
          ))}
          <div className="flex-1" />
          {tab === "pgn" && (
            <button
              onClick={handlePaste}
              className="h-8 px-2.5 text-[11px] text-muted hover:text-fg/90 hover:bg-bg/40 rounded-md transition-colors flex items-center gap-1"
              title="Paste from clipboard"
            >
              <ClipboardPaste size={11} /> Paste
            </button>
          )}
        </div>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            tab === "pgn"
              ? "Paste PGN or a chess.com / lichess game URL…"
              : "Paste a FEN to explore…"
          }
          className="w-full h-32 p-3 text-sm bg-bg/60 ring-1 ring-muted/25 rounded-lg text-fg placeholder-muted/50 focus:outline-none focus:ring-muted/55 font-mono resize-none"
          spellCheck={false}
        />

        {error && (
          <p className="text-red-400 text-xs mt-2 animate-[fade-in_180ms_ease-out]">{error}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {tab === "pgn" && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-muted/70">Depth</span>
              {([12, 14, 18] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`h-7 px-2 text-[11px] rounded-md transition-colors ${
                    d === depth
                      ? "bg-[var(--main)]/20 text-fg ring-1 ring-[var(--main)]/40"
                      : "text-muted hover:text-fg/90 hover:bg-bg/40"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <div className="flex-1" />
          <button
            onClick={handleStart}
            disabled={fetching}
            className="h-9 px-4 bg-[var(--main)] text-bg text-xs font-medium rounded-lg hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {fetching && <Loader2 size={11} className="animate-spin" />}
            {fetching ? "Fetching…" : tab === "pgn" ? "Analyze" : "Explore"}
          </button>
        </div>

        {tab === "pgn" && (
          <div className="mt-5 pt-4 border-t border-muted/20">
            <UserGamesPanel
              onPick={(pgn) => {
                onStart(pgn, { depth });
                close();
              }}
              onBulkDone={(info) => {
                onBulkDone?.(info);
              }}
              bulkDepth={depth}
            />
          </div>
        )}

        {tab === "pgn" && onOpenCached && (
          <RecentGames
            onOpen={(g) => {
              onOpenCached(g);
              close();
            }}
          />
        )}

        <p className="text-center text-[10px] text-muted/70 mt-4 flex items-center justify-center gap-1">
          <Sparkles size={9} /> Bulk-analyzing builds a personal puzzle queue from your blunders.
        </p>
      </div>
    </div>
  );
};

export default ImportModal;
