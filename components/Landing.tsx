"use client";

import { DragEvent, FC, useRef, useState } from "react";
import { ClipboardPaste, Sparkles, FileText, Hash, Link as LinkIcon, Loader2 } from "lucide-react";
import { detectSource, fetchPgn } from "@/lib/pgnFetch";
import { parsePgnHeaders } from "@/lib/pgnFetch";
import RecentGames from "./RecentGames";
import UserGamesPanel from "./UserGamesPanel";
import type { CachedGame } from "@/lib/gameCache";

const SAMPLE_PGN = `[Event "Casual Game"]
[Site "?"]
[Date "????.??.??"]
[White "You"]
[Black "Opponent"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O
9. h3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 Nc6 13. d5 Nd8 14. a4 Rb8 15. axb5 axb5
16. Nf1 Nd7 17. Ng3 Nb7 18. Nh2 g6 19. Nhf1 Bf6 *`;

interface LandingProps {
  onStart: (pgn: string, opts: { depth: number }) => void;
  onExplore?: (fen: string) => void;
  onOpenCached?: (game: CachedGame) => void;
  onBulkDone?: (info: { puzzlesAdded: number; analyzed: number; fromCache: number }) => void;
}

const Landing: FC<LandingProps> = ({ onStart, onExplore, onOpenCached, onBulkDone }) => {
  const [tab, setTab] = useState<"pgn" | "fen">("pgn");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [depth, setDepth] = useState<12 | 14 | 18>(14);
  const [fetching, setFetching] = useState(false);
  const [dragging, setDragging] = useState(false);

  // If the input looks like a URL, show the headers we know we can resolve;
  // otherwise parse headers out of the pasted PGN.
  const isUrl = !!detectSource(input);
  const headers = !isUrl && input.length > 0 ? parsePgnHeaders(input) : null;
  const hasHeaders = !!(headers?.white || headers?.black || headers?.event);

  const handleStart = async () => {
    setError("");
    const v = input.trim();
    if (!v) {
      setError("Please paste a PGN or game URL first.");
      return;
    }
    if (tab === "fen") {
      if (onExplore) onExplore(v);
      else setError("FEN exploration is not enabled.");
      return;
    }
    // URL → fetch first
    if (detectSource(v)) {
      setFetching(true);
      try {
        const { pgn } = await fetchPgn(v);
        onStart(pgn, { depth });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setFetching(false);
      }
      return;
    }
    onStart(v, { depth });
  };

  const isSampleLoaded = input.trim() === SAMPLE_PGN.trim();
  const sampleButtonLabel =
    input.length > 0 && !isSampleLoaded ? "Replace with sample" : "Use sample";

  const handleSampleClick = () => {
    setError("");
    setTab("pgn");
    // Empty input or already-the-sample → go straight to a real review.
    if (input.length === 0 || isSampleLoaded) {
      setInput(SAMPLE_PGN);
      onStart(SAMPLE_PGN, { depth });
      return;
    }
    // User has their own content — just refill, no auto-submit.
    setInput(SAMPLE_PGN);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) {
        setInput(t);
        setError("");
      }
    } catch {
      setError("Clipboard access denied. Paste manually.");
    }
  };

  const dragDepth = useRef(0);

  const isFileDrag = (e: DragEvent<HTMLDivElement>) =>
    Array.from(e.dataTransfer.types || []).includes("Files");

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    dragDepth.current += 1;
    setDragging(true);
  };
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (!isFileDrag(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pgn") && file.type !== "application/x-chess-pgn") {
      setError("Drop a .pgn file");
      return;
    }
    const text = await file.text();
    setInput(text);
    setTab("pgn");
    setError("");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: "var(--bg)" }}
      onDragEnter={handleDragEnter}
      onDragOver={(e) => { if (isFileDrag(e)) e.preventDefault(); }}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div
          className="absolute inset-0 z-30 ring-4 ring-inset flex items-center justify-center pointer-events-none animate-[fade-in_120ms_ease-out]"
          style={{
            background: "color-mix(in srgb, var(--main) 10%, transparent)",
            boxShadow: "inset 0 0 0 4px color-mix(in srgb, var(--main) 40%, transparent)",
          }}
        >
          <div
            className="px-5 py-3 rounded-xl bg-surface/90 text-sm"
            style={{
              color: "var(--main)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--main) 50%, transparent)",
            }}
          >
            Drop .pgn file to analyze
          </div>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(115deg, color-mix(in srgb, var(--main) 12%, transparent), transparent 34%, color-mix(in srgb, var(--main) 7%, transparent) 78%, transparent)",
        }}
      />

      <div className="relative w-full max-w-3xl">
        <div className="text-center mb-6 sm:mb-7 animate-[fade-in_500ms_ease-out]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface/80 ring-1 ring-muted/20 text-[10px] uppercase tracking-[0.2em] text-fg/70 mb-4">
            <Sparkles size={11} style={{ color: "var(--main)" }} /> Powered by Stockfish 18
          </div>
          <h1 className="text-4xl sm:text-5xl font-semibold text-fg tracking-tight">
            GameLens
          </h1>
          <p className="text-sm sm:text-base text-muted mt-3 max-w-lg mx-auto leading-relaxed">
            Paste a game, drop a PGN, or load your last 25 from chess.com or Lichess.
            Move-by-move review, blunder puzzles built from your own mistakes — all in
            your browser.
          </p>
        </div>

        <div className="bg-surface/80 backdrop-blur-sm ring-1 ring-muted/20 rounded-xl shadow-2xl p-4 sm:p-5 animate-[slide-up_500ms_ease-out_120ms_both]">
          <div className="flex gap-1.5 mb-3">
            <button
              onClick={() => { setTab("pgn"); setError(""); }}
              className={`flex h-9 items-center gap-2 px-3 rounded-lg text-sm font-medium transition-all ${
                tab === "pgn" ? "bg-surface text-fg ring-1 ring-muted/40" : "text-muted hover:text-fg/80"
              }`}
            >
              <FileText size={14} /> PGN
            </button>
            <button
              onClick={() => { setTab("fen"); setError(""); }}
              className={`flex h-9 items-center gap-2 px-3 rounded-lg text-sm font-medium transition-all ${
                tab === "fen" ? "bg-surface text-fg ring-1 ring-muted/40" : "text-muted hover:text-fg/80"
              }`}
            >
              <Hash size={14} /> FEN (explore)
            </button>
            <div className="flex-1" />
            <button
              onClick={handlePasteFromClipboard}
              className="flex h-9 items-center gap-1.5 px-3 rounded-lg text-sm text-fg/65 hover:text-fg hover:bg-surface transition-colors"
              title="Paste from clipboard"
            >
              <ClipboardPaste size={14} /> Paste
            </button>
          </div>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={tab === "pgn"
              ? "Paste PGN, drop a .pgn file, or paste a lichess.org game URL…\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 ..."
              : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}
            spellCheck={false}
            className="w-full h-44 sm:h-48 bg-bg/60 border border-muted/25 focus:border-muted/55 rounded-xl p-3.5 text-sm font-mono text-fg/90 placeholder-muted/50 resize-none focus:outline-none focus:ring-2 focus:ring-muted/30 transition-all"
          />

          {isUrl && tab === "pgn" && (
            <div className="mt-2 flex items-center gap-2 text-xs text-cyan-300 animate-[fade-in_180ms_ease-out]">
              <LinkIcon size={12} />
              <span>Detected a {detectSource(input)!.source} game URL — we&apos;ll fetch the PGN on analyze.</span>
            </div>
          )}

          {hasHeaders && tab === "pgn" && (
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-fg/65 animate-[fade-in_180ms_ease-out]">
              {headers!.white && (
                <span>
                  <span className="text-fg">{headers!.white}</span>
                  {headers!.whiteElo && <span className="text-muted/70"> ({headers!.whiteElo})</span>}
                </span>
              )}
              {headers!.white && headers!.black && <span className="text-muted/40">vs</span>}
              {headers!.black && (
                <span>
                  <span className="text-fg">{headers!.black}</span>
                  {headers!.blackElo && <span className="text-muted/70"> ({headers!.blackElo})</span>}
                </span>
              )}
              {headers!.result && <span className="text-muted/70">· {headers!.result}</span>}
              {headers!.eco && <span className="text-muted/70">· {headers!.eco}</span>}
            </div>
          )}

          {error && (
            <p className="text-red-400 text-xs mt-2 animate-[fade-in_180ms_ease-out]">{error}</p>
          )}

          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {tab === "pgn" && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <span>Depth</span>
                <div className="flex gap-0.5 ml-1">
                  {([12, 14, 18] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDepth(d)}
                      className={`min-h-8 min-w-8 px-2 rounded-md text-xs font-mono transition-all ${
                        depth === d
                          ? "bg-muted/30 text-fg"
                          : "text-muted hover:text-fg/80 hover:bg-surface"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1" />
            <button
              onClick={handleSampleClick}
              className="h-9 px-3 rounded-lg text-sm text-muted hover:text-fg/90 hover:bg-surface ring-1 ring-transparent hover:ring-muted/20 transition-colors"
            >
              {sampleButtonLabel}
            </button>
            <button
              onClick={handleStart}
              disabled={fetching}
              className="h-10 px-5 bg-[var(--main)] text-bg text-sm font-medium rounded-lg hover:brightness-110 transition-all active:scale-[0.98] shadow-lg shadow-black/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {fetching && <Loader2 size={13} className="animate-spin" />}
              {fetching ? "Fetching…" : tab === "pgn" ? "Analyze game →" : "Explore →"}
            </button>
          </div>
        </div>

        <UserGamesPanel
          onPick={(pgn) => onStart(pgn, { depth })}
          onBulkDone={onBulkDone}
          bulkDepth={depth}
        />

        {onOpenCached && <RecentGames onOpen={onOpenCached} />}

        <p className="text-center text-[10px] text-muted/70 mt-6 animate-[fade-in_700ms_ease-out_300ms_both]">
          Runs entirely in your browser. Nothing leaves your device.
        </p>
      </div>
    </div>
  );
};

export default Landing;
