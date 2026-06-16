"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, Move } from "chess.js";
import {
  Copy,
  Check,
  ArrowLeftRight,
  Gauge,
  HelpCircle,
  Info,
  Keyboard,
  KeyRound,
  Share2,
  BarChart3,
  Upload,
  Target,
} from "lucide-react";
import BoardColumn from "@/components/BoardColumn";
import MobileNavBar from "@/components/MobileNavBar";
import MoveList from "@/components/MoveList";
import EnginePanel from "@/components/EnginePanel";
import PlayVsEnginePanel from "@/components/PlayVsEnginePanel";
import GameReview from "@/components/GameReview";
import CriticalMoments from "@/components/CriticalMoments";
import MoveCoachCard from "@/components/MoveCoachCard";
import PuzzlePanel from "@/components/PuzzlePanel";
import PromotionPicker from "@/components/PromotionPicker";
import Landing from "@/components/Landing";
import AnalyzingScreen from "@/components/AnalyzingScreen";
import AnnotationModal from "@/components/AnnotationModal";
import OpeningBadge from "@/components/OpeningBadge";
import BoardSettings from "@/components/BoardSettings";
import Toast, { ToastData } from "@/components/Toast";
import { BOARD_THEMES, DEFAULT_THEME, applyTheme } from "@/lib/themes";
import { useStockfish } from "@/hooks/useStockfish";
import { createPool } from "@/lib/enginePool";
import { ELO_PRESETS, requestEngineMove } from "@/lib/enginePlay";
import { ensureEcoLoaded, isBookFen, useOpening } from "@/hooks/useOpening";
import {
  clearLastGame,
  hashKey,
  loadGame,
  loadLastGame,
  pruneCache,
  saveGame,
} from "@/lib/gameCache";
import { parsePgnHeaders, splitPgnGames, type PgnHeaders } from "@/lib/pgnFetch";
import { parseClocks, type ClockData } from "@/lib/pgnClock";
import GameChooser from "@/components/GameChooser";
import ShortcutsModal from "@/components/ShortcutsModal";
import SettingsModal from "@/components/SettingsModal";
import FeedbackModal from "@/components/FeedbackModal";
import ImportModal from "@/components/ImportModal";
import MarathonModal from "@/components/MarathonModal";
import InsightsModal from "@/components/InsightsModal";
import { buildAnnotatedPgn } from "@/lib/pgnExport";
import { buildShareUrl, clearShareHash, readShareHash } from "@/lib/shareUrl";
import { sfx } from "@/lib/sounds";
import { isAnalyzablePgn } from "@/lib/bulkAnalyze";
import { usePreferences, useAnnotations } from "@/hooks/useAnnotations";
import { useUserArrows } from "@/hooks/useUserArrows";
import {
  AnalyzedMove,
  GameSummary,
  analyzeGame,
  MoveClassification,
} from "@/lib/analysis";

type Phase = "landing" | "analyzing" | "review" | "explore";

interface PositionEntry {
  fen: string;
  move: Move | null;
}

// classification → arrow color for engine recommendation
const ARROW_COLOR: Record<MoveClassification, string> = {
  brilliant: "rgba(34, 211, 238, 0.85)",
  great: "rgba(96, 165, 250, 0.85)",
  best: "rgba(52, 211, 153, 0.85)",
  excellent: "rgba(52, 211, 153, 0.7)",
  good: "rgba(161, 161, 170, 0.7)",
  book: "rgba(245, 158, 11, 0.85)",
  inaccuracy: "rgba(250, 204, 21, 0.9)",
  mistake: "rgba(249, 115, 22, 0.9)",
  blunder: "rgba(239, 68, 68, 0.9)",
  miss: "rgba(244, 63, 94, 0.9)",
  forced: "rgba(161, 161, 170, 0.7)",
};

export default function Home() {
  // ---- App-level state ----
  const [phase, setPhase] = useState<Phase>("landing");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [analyzeDepth, setAnalyzeDepth] = useState(14);

  const [positions, setPositions] = useState<PositionEntry[]>([
    { fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", move: null },
  ]);
  const [analyzedMoves, setAnalyzedMoves] = useState<AnalyzedMove[]>([]);
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // explore-mode mutable game
  const exploreGameRef = useRef<Chess>(new Chess());
  const [exploreEvals, setExploreEvals] = useState<(number | null)[]>([null]);

  // Annotations + preferences
  const [annotations, setAnnotations] = useState<Record<number, string>>({});
  const [annotationMove, setAnnotationMove] = useState<{ index: number; san: string; text: string } | null>(null);

  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [boardTheme, setBoardTheme] = useState(DEFAULT_THEME);
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [showAnimations, setShowAnimations] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [showHanging, setShowHanging] = useState(false);
  const [engineDepth, setEngineDepth] = useState(14);
  const [copiedPgn, setCopiedPgn] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [headers, setHeaders] = useState<PgnHeaders | null>(null);
  const [clocks, setClocks] = useState<ClockData | null>(null);
  const [currentGameKey, setCurrentGameKey] = useState<string | null>(null);
  const [currentPgn, setCurrentPgn] = useState<string | null>(null);
  const [pendingGames, setPendingGames] = useState<{ games: string[]; depth: number } | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settingsRev, setSettingsRev] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [marathonOpen, setMarathonOpen] = useState(false);
  const [puzzleQueueStats, setPuzzleQueueStats] = useState<{ total: number; due: number }>({ total: 0, due: 0 });
  const [puzzleStatsRev, setPuzzleStatsRev] = useState(0);
  // Snapshot of the analyzed review at the moment a stray drag branched off,
  // so the user can return to it instead of digging through Recent Games.
  const reviewSnapshotRef = useRef<{
    positions: PositionEntry[];
    moves: AnalyzedMove[];
    summary: GameSummary | null;
    index: number;
    pgn: string | null;
    gameKey: string | null;
  } | null>(null);
  // Play vs engine
  const [playSide, setPlaySide] = useState<"white" | "black" | null>(null);
  const [engineElo, setEngineElo] = useState<number>(1700);
  const [engineThinking, setEngineThinking] = useState(false);
  // Puzzle mode (re-attempt a blunder/mistake from review mode)
  const [puzzle, setPuzzle] = useState<{
    movePly: number;
    attempted: string | null;
    solved: boolean;
    failed: boolean;
    revealed: boolean;
  } | null>(null);
  const [puzzleSession, setPuzzleSession] = useState<{ solved: number; attempted: number }>({ solved: 0, attempted: 0 });
  // Mobile-only: which column to show (lg: breakpoint always shows all 3).
  const [mobileTab, setMobileTab] = useState<"board" | "moves" | "side">("board");
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);
  // Promotion picker — when a pawn drag would promote and no piece was specified.
  const [pendingPromotion, setPendingPromotion] = useState<{
    from: string;
    to: string;
    color: "w" | "b";
  } | null>(null);

  // User-drawn arrows for the current ply (loaded from / saved to localStorage)
  const [userArrows, setUserArrows] = useState<{ startSquare: string; endSquare: string; color: string }[]>([]);
  const { isReady, evaluate, analyzePosition, evaluation, bestMove, topLines } = useStockfish();
  const opening = useOpening(positions[currentIndex]?.fen || "");
  const { loadPreferences, savePreferences } = usePreferences();
  const { loadAnnotations, saveAnnotations } = useAnnotations();
  const { loadArrowsForPly, saveArrowsForPly } = useUserArrows();

  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktopLayout(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setUserArrows(loadArrowsForPly(currentGameKey, currentIndex));
  }, [currentGameKey, currentIndex, loadArrowsForPly]);

  const handleArrowsChange = useCallback(
    (arr: { startSquare: string; endSquare: string; color: string }[]) => {
      setUserArrows(arr);
      saveArrowsForPly(currentGameKey, currentIndex, arr);
    },
    [currentGameKey, currentIndex, saveArrowsForPly]
  );

  // Load puzzle queue counts for the header badge.
  useEffect(() => {
    let cancelled = false;
    import("@/lib/puzzleQueue").then(({ countPuzzles }) =>
      countPuzzles().then((c) => {
        if (!cancelled) setPuzzleQueueStats(c);
      })
    );
    return () => { cancelled = true; };
  }, [puzzleStatsRev]);

  // Hydrate prefs on mount.
  useEffect(() => {
    const p = loadPreferences();
    setBoardOrientation(p.boardOrientation);
    setShowCoordinates(p.showCoordinates);
    setShowAnimations(p.showAnimations);
    setEngineDepth(p.engineDepth);
    setBoardTheme(p.theme || DEFAULT_THEME);
    setSoundEnabled(p.soundEnabled);
    setShowHanging(p.showHanging);
    sfx.setMuted(!p.soundEnabled);
    applyTheme(p.theme || DEFAULT_THEME);
  }, [loadPreferences]);

  // Parse clocks whenever the active PGN changes.
  useEffect(() => {
    if (!currentPgn || analyzedMoves.length === 0) {
      setClocks(null);
      return;
    }
    setClocks(parseClocks(currentPgn, analyzedMoves.length));
  }, [currentPgn, analyzedMoves.length]);
  // Reload annotations when the active game changes.
  useEffect(() => {
    setAnnotations(loadAnnotations(currentGameKey));
  }, [currentGameKey, loadAnnotations]);

  useEffect(() => {
    savePreferences({ boardOrientation, showCoordinates, showAnimations, engineDepth, theme: boardTheme, soundEnabled, showHanging });
    applyTheme(boardTheme);
    sfx.setMuted(!soundEnabled);
  }, [boardOrientation, showCoordinates, showAnimations, engineDepth, boardTheme, soundEnabled, showHanging, savePreferences]);

  // ---- Restore on first mount: shared URL takes priority over last-game ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const shared = readShareHash();
      if (shared) {
        clearShareHash();
        setToast({ kind: "info", msg: "Loading shared game…" });
        handleAnalyzePgn(shared.pgn, { depth: shared.depth });
        return;
      }
      const last = await loadLastGame();
      if (cancelled || !last) return;
      setPositions(last.positions);
      setAnalyzedMoves(last.moves);
      setSummary(last.summary);
      setCurrentIndex(0);
      setAnalyzeDepth(last.depth);
      setHeaders(parsePgnHeaders(last.pgn));
      setCurrentGameKey(last.key);
      setCurrentPgn(last.pgn);
      setPhase("review");
      // Suppress the "restored" toast if it's been less than 5 minutes — feels
      // less spammy on rapid refreshes.
      const lastSeenKey = "chess-analyzer-last-seen";
      const prev = parseInt(sessionStorage.getItem(lastSeenKey) || "0", 10);
      const now = Date.now();
      if (!prev || now - prev > 5 * 60_000) {
        setToast({ kind: "info", msg: "Restored your last analyzed game" });
      }
      sessionStorage.setItem(lastSeenKey, String(now));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Analyze flow ----
  const handleAnalyzePgn = useCallback(
    async (pgn: string, opts: { depth: number }) => {
      // If user pasted a file with multiple games, let them choose one.
      const games = splitPgnGames(pgn);
      if (games.length > 1) {
        setPendingGames({ games, depth: opts.depth });
        return;
      }
      // Refuse non-standard variants (Chess960, atomic, crazyhouse, etc.).
      const variantMatch = pgn.match(/\[Variant\s+"([^"]+)"\]/i);
      if (variantMatch) {
        const v = variantMatch[1].trim().toLowerCase();
        const standardVariants = ["standard", "from position", "chess"];
        if (!standardVariants.includes(v)) {
          setToast({
            kind: "error",
            msg: `Variant "${variantMatch[1]}" isn't supported — only standard chess.`,
          });
          return;
        }
      }
      if (!isAnalyzablePgn(pgn)) {
        setToast({
          kind: "error",
          msg: "No moves found — is this a valid PGN?",
        });
        return;
      }
      const parsedHeaders = parsePgnHeaders(pgn);
      setHeaders(parsedHeaders);
      // Auto-orient board to the side the user played, when their handle matches.
      const myHandle = (
        localStorage.getItem("chess-analyzer.handle.lichess") ||
        localStorage.getItem("chess-analyzer.handle.chesscom") ||
        ""
      ).trim().toLowerCase();
      if (myHandle) {
        if (parsedHeaders.black?.toLowerCase() === myHandle) setBoardOrientation("black");
        else if (parsedHeaders.white?.toLowerCase() === myHandle) setBoardOrientation("white");
      }
      setCurrentPgn(pgn);
      // Fast path: check cache.
      const cacheKey = hashKey(pgn, opts.depth);
      setCurrentGameKey(cacheKey);
      const cached = await loadGame(cacheKey);
      if (cached) {
        setPositions(cached.positions);
        setAnalyzedMoves(cached.moves);
        setSummary(cached.summary);
        setCurrentIndex(0);
        setIsPlaying(false);
        setAnalyzeDepth(cached.depth);
        setPhase("review");
        setToast({ kind: "success", msg: "Loaded from cache (instant)" });
        await saveGame({ ...cached, savedAt: Date.now() }); // bump recency
        return;
      }

      setPhase("analyzing");
      setAnalyzeDepth(opts.depth);
      setProgress({ current: 0, total: 0 });
      const poolSize = Math.min(3, Math.max(1, (navigator.hardwareConcurrency ?? 4) - 1));
      const pool = createPool(poolSize);
      try {
        // Load ECO book in parallel with engine warmup.
        await Promise.all([pool.ready, ensureEcoLoaded()]);
        const result = await analyzeGame(
          { kind: "pgn", pgn },
          (fen, o) => pool.analyze(fen, { depth: o.depth, multipv: o.multipv }),
          {
            depth: opts.depth,
            multipv: 2,
            concurrency: poolSize,
            isBookFen: (fen) => isBookFen(fen),
            onProgress: (p) => setProgress({ current: p.current, total: p.total }),
          }
        );
        setPositions(result.positions);
        setAnalyzedMoves(result.moves);
        setSummary(result.summary);
        setCurrentIndex(0);
        setIsPlaying(false);
        setPhase("review");
        await saveGame({
          key: cacheKey,
          pgn,
          depth: opts.depth,
          positions: result.positions,
          moves: result.moves,
          summary: result.summary,
          savedAt: Date.now(),
        });
        pruneCache(20).catch(() => {});
      } catch (e) {
        console.error(e);
        setToast({ kind: "error", msg: "Couldn't analyze: " + (e instanceof Error ? e.message : String(e)) });
        setPhase("landing");
      } finally {
        pool.terminate();
      }
    },
    []
  );

  const handleOpenCached = useCallback(async (g: import("@/lib/gameCache").CachedGame) => {
    setPositions(g.positions);
    setAnalyzedMoves(g.moves);
    setSummary(g.summary);
    setHeaders(parsePgnHeaders(g.pgn));
    setCurrentGameKey(g.key);
    setCurrentPgn(g.pgn);
    setAnalyzeDepth(g.depth);
    setCurrentIndex(0);
    setIsPlaying(false);
    setPhase("review");
    await saveGame({ ...g, savedAt: Date.now() });
  }, []);

  const handleExploreFen = useCallback((fen: string) => {
    try {
      const g = new Chess(fen);
      exploreGameRef.current = g;
      setPositions([{ fen: g.fen(), move: null }]);
      setAnalyzedMoves([]);
      setSummary(null);
      setCurrentIndex(0);
      setPhase("explore");
    } catch {
      setToast({ kind: "error", msg: "Invalid FEN" });
    }
  }, []);

  // ---- Navigation ----
  const totalPlies = positions.length - 1;
  const canGoBack = currentIndex > 0;
  const canGoForward = currentIndex < totalPlies;
  const goBack = useCallback(() => setCurrentIndex((i) => Math.max(0, i - 1)), []);
  const goForward = useCallback(() => setCurrentIndex((i) => Math.min(totalPlies, i + 1)), [totalPlies]);
  const goToStart = useCallback(() => setCurrentIndex(0), []);
  const goToEnd = useCallback(() => setCurrentIndex(totalPlies), [totalPlies]);
  const goToPly = useCallback(
    (i: number) => setCurrentIndex(Math.max(0, Math.min(i, totalPlies))),
    [totalPlies]
  );

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return;
    if (currentIndex >= totalPlies) {
      setIsPlaying(false);
      return;
    }
    const t = setTimeout(() => setCurrentIndex((i) => Math.min(totalPlies, i + 1)), 1400);
    return () => clearTimeout(t);
  }, [isPlaying, currentIndex, totalPlies]);

  // Latest blunder nav targets, refs so the keyboard handler always sees fresh values.
  const blunderNavRef = useRef<{ next: number | null; prev: number | null }>({ next: null, prev: null });

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Always-active shortcuts:
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) { setShortcutsOpen((s) => !s); e.preventDefault(); return; }
      if (e.key === "Escape") {
        if (shortcutsOpen) setShortcutsOpen(false);
        if (annotationMove) setAnnotationMove(null);
        return;
      }
      if (phase === "landing" || phase === "analyzing") return;
      if (e.key === "ArrowLeft") { goBack(); e.preventDefault(); }
      if (e.key === "ArrowRight") { goForward(); e.preventDefault(); }
      if (e.key === "Home") { goToStart(); e.preventDefault(); }
      if (e.key === "End") { goToEnd(); e.preventDefault(); }
      if (e.key === " ") { setIsPlaying((p) => !p); e.preventDefault(); }
      if (e.key === "f" || e.key === "F") { setBoardOrientation((o) => (o === "white" ? "black" : "white")); }
      if (e.key === "b" || e.key === "B") {
        const target = e.shiftKey ? blunderNavRef.current.prev : blunderNavRef.current.next;
        if (target !== null) { goToPly(target); e.preventDefault(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, goBack, goForward, goToStart, goToEnd, goToPly, shortcutsOpen, annotationMove]);

  // Live engine eval for explore mode
  // Sound effects on move
  const lastSoundIndexRef = useRef(0);
  useEffect(() => {
    if (currentIndex === lastSoundIndexRef.current) return;
    if (currentIndex > lastSoundIndexRef.current) {
      const fen = positions[currentIndex]?.fen ?? "";
      const move = positions[currentIndex]?.move;
      if (move) {
        try {
          const probe = new Chess(fen);
          if (probe.isCheckmate()) sfx.mate();
          else if (probe.isCheck()) sfx.check();
          else if (move.captured) sfx.capture();
          else sfx.move();
        } catch {
          sfx.move();
        }
      }
    }
    lastSoundIndexRef.current = currentIndex;
  }, [currentIndex, positions]);

  // Live engine eval for any non-landing/analyzing position.
  useEffect(() => {
    if (phase === "landing" || phase === "analyzing") return;
    if (!isReady) return;
    const fen = positions[currentIndex]?.fen;
    if (fen) evaluate(fen, engineDepth, 3);
  }, [phase, isReady, currentIndex, positions, evaluate, engineDepth]);

  // Track explore evals for the graph
  useEffect(() => {
    if (phase !== "explore" || !evaluation) return;
    setExploreEvals((prev) => {
      const next = [...prev];
      while (next.length <= currentIndex) next.push(null);
      next[currentIndex] = evaluation.cp;
      return next;
    });
  }, [phase, evaluation, currentIndex]);

  // Reset explore evals when entering explore mode or when positions branch
  useEffect(() => {
    if (phase === "explore") {
      setExploreEvals(new Array(positions.length).fill(null));
    }
  }, [phase, positions.length]);

  // ---- Drag-and-drop handler (explore mode + puzzle mode + review branching) ----
  const onPieceDrop = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      // Detect pawn promotion that wasn't pre-supplied — pop picker, defer move.
      if (!promotion && (to[1] === "8" || to[1] === "1")) {
        const fenForCheck =
          phase === "explore"
            ? exploreGameRef.current.fen()
            : positions[currentIndex]?.fen;
        if (fenForCheck) {
          try {
            const probe = new Chess(fenForCheck);
            const piece = probe.get(from as never);
            if (piece && piece.type === "p") {
              setPendingPromotion({ from, to, color: piece.color });
              return false;
            }
          } catch { /* ignore */ }
        }
      }

      // Puzzle attempt during review
      if (phase === "review" && puzzle && !puzzle.solved) {
        const target = analyzedMoves[puzzle.movePly - 1];
        if (!target) return false;
        const tryFen = positions[puzzle.movePly - 1]?.fen;
        if (!tryFen) return false;
        const g = new Chess(tryFen);
        let attempted: { uci: string; san: string } | null = null;
        try {
          const m = g.move({ from, to, promotion: promotion || "q" });
          if (m) attempted = { uci: m.from + m.to + (m.promotion ?? ""), san: m.san };
        } catch {
          return false;
        }
        if (!attempted) return false;
        const correct = attempted.uci === target.bestMoveUci;
        setPuzzle({
          movePly: puzzle.movePly,
          attempted: attempted.san,
          solved: correct,
          failed: !correct,
          revealed: false,
        });
        // Only count first attempts toward session (not subsequent retries on same puzzle).
        if (!puzzle.attempted) {
          setPuzzleSession((s) => ({ solved: s.solved + (correct ? 1 : 0), attempted: s.attempted + 1 }));
        } else if (!puzzle.solved && correct) {
          // Solved on retry — count as solve only.
          setPuzzleSession((s) => ({ ...s, solved: s.solved + 1 }));
        }
        return false; // never mutate the board's position
      }

      // Branch off a review line: when the user drags a piece in review mode,
      // switch to explore starting from the current position. The analyzed
      // game stays cached and can be reopened from "Recent games".
      if (phase === "review") {
        const currentFen = positions[currentIndex]?.fen;
        if (!currentFen) return false;
        const g = new Chess(currentFen);
        try {
          const m = g.move({ from, to, promotion: promotion || "q" });
          if (!m) return false;
        } catch {
          return false;
        }
        // Snapshot review state so "Back to review" can restore it without a cache hit.
        reviewSnapshotRef.current = {
          positions,
          moves: analyzedMoves,
          summary,
          index: currentIndex,
          pgn: currentPgn,
          gameKey: currentGameKey,
        };
        exploreGameRef.current = g;
        const move = g.history({ verbose: true }).at(-1) as Move;
        const truncated = positions.slice(0, currentIndex + 1);
        setPositions([...truncated, { fen: g.fen(), move }]);
        setCurrentIndex(truncated.length);
        setAnalyzedMoves([]);
        setSummary(null);
        setPhase("explore");
        setToast({
          kind: "info",
          msg: "Branched off into explore mode",
          action: {
            label: "Back to review",
            onClick: () => {
              const snap = reviewSnapshotRef.current;
              if (!snap) return;
              setPositions(snap.positions);
              setAnalyzedMoves(snap.moves);
              setSummary(snap.summary);
              setCurrentIndex(snap.index);
              setCurrentPgn(snap.pgn);
              setCurrentGameKey(snap.gameKey);
              setPhase("review");
              reviewSnapshotRef.current = null;
            },
          },
        });
        return true;
      }

      if (phase !== "explore") return false;
      const g = exploreGameRef.current;
      try {
        const m = g.move({ from, to, promotion: promotion || "q" });
        if (!m) return false;
      } catch {
        return false;
      }
      setPositions((prev) => {
        const truncated = prev.slice(0, currentIndex + 1);
        return [...truncated, { fen: g.fen(), move: g.history({ verbose: true }).at(-1) as Move }];
      });
      setCurrentIndex((i) => i + 1);
      return true;
    },
    [phase, currentIndex, puzzle, analyzedMoves, positions, summary, currentPgn, currentGameKey]
  );

  // ---- Play vs engine: respond when it's the engine's turn ----
  useEffect(() => {
    if (phase !== "explore" || !playSide) return;
    const fen = positions[currentIndex]?.fen;
    if (!fen) return;
    // Only react when we're at the live tip of the explore game
    if (currentIndex !== positions.length - 1) return;
    const stm = fen.split(" ")[1] as "w" | "b";
    const engineSide: "w" | "b" = playSide === "white" ? "b" : "w";
    if (stm !== engineSide) return;
    // Don't move into a finished position
    const g = new Chess(fen);
    if (g.isGameOver()) return;

    let cancelled = false;
    setEngineThinking(true);
    (async () => {
      try {
        const uci = await requestEngineMove(fen, engineElo);
        if (cancelled) return;
        if (!uci || uci === "(none)") return;
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promo = uci.length > 4 ? uci.slice(4, 5) : undefined;
        const move = exploreGameRef.current.move({ from, to, promotion: promo });
        if (!move) return;
        setPositions((prev) => [
          ...prev,
          { fen: exploreGameRef.current.fen(), move },
        ]);
        setCurrentIndex((i) => i + 1);
      } finally {
        if (!cancelled) setEngineThinking(false);
      }
    })();
    return () => { cancelled = true; setEngineThinking(false); };
  }, [phase, playSide, engineElo, positions, currentIndex]);

  // ---- Derived data ----
  const moveHistory = useMemo(
    () => positions.filter((p) => p.move).map((p) => p.move!),
    [positions]
  );
  const classificationsByPly = useMemo<Record<number, MoveClassification>>(() => {
    const out: Record<number, MoveClassification> = {};
    for (const m of analyzedMoves) out[m.index] = m.classification;
    return out;
  }, [analyzedMoves]);

  const currentAnalyzed = currentIndex > 0 ? analyzedMoves[currentIndex - 1] ?? null : null;

  const gameOverState = useMemo<"checkmate" | "stalemate" | "draw" | null>(() => {
    const fen = positions[currentIndex]?.fen;
    if (!fen) return null;
    try {
      const g = new Chess(fen);
      if (g.isCheckmate()) return "checkmate";
      if (g.isStalemate()) return "stalemate";
      if (g.isDraw()) return "draw";
    } catch { /* ignore */ }
    return null;
  }, [positions, currentIndex]);

  // Mistake navigation — plies (1-based) where the move was bad enough to flag.
  const mistakePlies = useMemo(
    () =>
      analyzedMoves
        .filter((m) => m.classification === "blunder" || m.classification === "mistake" || m.classification === "miss")
        .map((m) => m.index),
    [analyzedMoves]
  );
  const nextBlunder = useMemo(
    () => mistakePlies.find((p) => p > currentIndex) ?? null,
    [mistakePlies, currentIndex]
  );
  const prevBlunder = useMemo(() => {
    let last: number | null = null;
    for (const p of mistakePlies) {
      if (p < currentIndex) last = p;
      else break;
    }
    return last;
  }, [mistakePlies, currentIndex]);

  // Keep the keyboard handler in sync with current blunder targets.
  useEffect(() => {
    blunderNavRef.current = { next: nextBlunder, prev: prevBlunder };
  }, [nextBlunder, prevBlunder]);

  // Eval at current position (white's POV centipawns) for the bar/graph
  const cpsByPly = useMemo<(number | null)[]>(() => {
    if (phase === "review") {
      if (analyzedMoves.length === 0) return [0];
      const arr: (number | null)[] = [analyzedMoves[0]?.cpBefore ?? 0];
      for (const m of analyzedMoves) arr.push(m.cpAfter);
      return arr;
    }
    if (phase === "explore") {
      return exploreEvals;
    }
    return [];
  }, [phase, analyzedMoves, exploreEvals]);
  const liveCp = phase === "explore" && evaluation ? evaluation.cp : null;
  const liveMate = phase === "explore" && evaluation ? evaluation.mate : null;
  const reviewCp = phase === "review" ? cpsByPly[currentIndex] ?? null : null;
  const reviewMate =
    phase === "review"
      ? currentIndex === 0
        ? null
        : analyzedMoves[currentIndex - 1]?.mateAfter ?? null
      : null;

  // Best-move arrow: for review, draw an arrow when player's move was suboptimal.
  const engineArrows = useMemo(() => {
    if (phase === "review" && currentAnalyzed) {
      const cls = currentAnalyzed.classification;
      const showArrow =
        cls !== "best" && cls !== "brilliant" && cls !== "great" && cls !== "book" && cls !== "forced" && currentAnalyzed.bestMoveUci && currentAnalyzed.bestMoveUci !== currentAnalyzed.uci;
      if (!showArrow) return [];
      const uci = currentAnalyzed.bestMoveUci;
      return [
        {
          startSquare: uci.slice(0, 2),
          endSquare: uci.slice(2, 4),
          color: ARROW_COLOR[cls],
        },
      ];
    }
    if (phase === "explore" && bestMove && bestMove.length >= 4 && bestMove !== "(none)") {
      return [
        {
          startSquare: bestMove.slice(0, 2),
          endSquare: bestMove.slice(2, 4),
          color: "rgba(52, 211, 153, 0.7)",
        },
      ];
    }
    return [];
  }, [phase, currentAnalyzed, bestMove]);

  const arrows = useMemo(() => [...engineArrows, ...userArrows], [engineArrows, userArrows]);

  const lastMove = useMemo(() => {
    const pos = positions[currentIndex];
    if (!pos?.move) return undefined;
    return {
      from: pos.move.from,
      to: pos.move.to,
      classification: classificationsByPly[currentIndex],
    };
  }, [positions, currentIndex, classificationsByPly]);

  // Annotations
  const handleAnnotationClick = (index: number, currentText: string) => {
    const move = positions[index]?.move;
    setAnnotationMove({ index, san: move?.san || "?", text: currentText });
  };
  const handleAnnotationSave = (text: string) => {
    if (!annotationMove) return;
    const updated = { ...annotations, [annotationMove.index]: text };
    setAnnotations(updated);
    saveAnnotations(currentGameKey, updated);
  };
  const handleAnnotationDelete = () => {
    if (!annotationMove) return;
    const updated = { ...annotations };
    delete updated[annotationMove.index];
    setAnnotations(updated);
    saveAnnotations(currentGameKey, updated);
  };

  // Export PGN — annotated when we have analysis, plain otherwise.
  const handleExportPgn = () => {
    try {
      let pgnText: string;
      if (phase === "review" && analyzedMoves.length > 0) {
        pgnText = buildAnnotatedPgn(analyzedMoves, annotations, headers);
      } else {
        const g = new Chess();
        for (const p of positions.slice(1)) {
          if (p.move) g.move(p.move);
        }
        pgnText = g.pgn();
      }
      navigator.clipboard.writeText(pgnText).then(() => {
        setCopiedPgn(true);
        setToast({ kind: "success", msg: "Annotated PGN copied" });
        setTimeout(() => setCopiedPgn(false), 1800);
      });
    } catch {
      /* ignore */
    }
  };

  const handleStartPuzzle = useCallback((ply: number) => {
    if (ply < 1) return;
    setPuzzle({ movePly: ply, attempted: null, solved: false, failed: false, revealed: false });
    setCurrentIndex(ply - 1); // position before the mistake
    setIsPlaying(false);
  }, []);
  const handleExitPuzzle = useCallback(() => {
    if (puzzle) setCurrentIndex(puzzle.movePly); // restore to after-the-move
    setPuzzle(null);
    setPuzzleSession({ solved: 0, attempted: 0 });
  }, [puzzle]);
  const handleRetryPuzzle = useCallback(() => {
    setPuzzle((p) => p && { ...p, attempted: null, solved: false, failed: false, revealed: false });
  }, []);
  const handleNextPuzzle = useCallback(() => {
    if (!puzzle) return;
    const next = analyzedMoves
      .filter(
        (m) =>
          m.index > puzzle.movePly &&
          (m.classification === "blunder" ||
            m.classification === "mistake" ||
            m.classification === "miss")
      )
      .map((m) => m.index)[0];
    if (next === undefined) {
      setToast({
        kind: "success",
        msg: `Session: ${puzzleSession.solved}/${puzzleSession.attempted} solved · No more puzzles`,
      });
      handleExitPuzzle();
      return;
    }
    handleStartPuzzle(next);
  }, [puzzle, analyzedMoves, puzzleSession, handleExitPuzzle, handleStartPuzzle]);

  const handleShare = useCallback(() => {
    if (!currentPgn) {
      setToast({ kind: "error", msg: "No analyzed game to share" });
      return;
    }
    const url = buildShareUrl(currentPgn, analyzeDepth);
    navigator.clipboard.writeText(url).then(() => {
      setToast({ kind: "success", msg: "Share link copied" });
    });
  }, [currentPgn, analyzeDepth]);

  const handleReanalyze = useCallback(() => {
    if (!currentPgn) {
      setToast({ kind: "error", msg: "No PGN in memory to re-analyze" });
      return;
    }
    const next = analyzeDepth < 14 ? 14 : analyzeDepth < 18 ? 18 : analyzeDepth < 22 ? 22 : 26;
    setToast({ kind: "info", msg: `Re-analyzing at depth ${next}…` });
    handleAnalyzePgn(currentPgn, { depth: next });
  }, [currentPgn, analyzeDepth, handleAnalyzePgn]);

  const handleNewGame = () => {
    setPhase("landing");
    setPositions([{ fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", move: null }]);
    setAnalyzedMoves([]);
    setSummary(null);
    setCurrentIndex(0);
    setIsPlaying(false);
    setCurrentGameKey(null);
    setCurrentPgn(null);
    setHeaders(null);
    clearLastGame().catch(() => {});
  };

  // ---- Render ----
  if (phase === "landing") {
    return (
      <>
        <Landing
          onStart={handleAnalyzePgn}
          onExplore={handleExploreFen}
          onOpenCached={handleOpenCached}
          onBulkDone={(info) => {
            setToast({
              kind: "success",
              msg: info.puzzlesAdded > 0
                ? `Added ${info.puzzlesAdded} puzzle${info.puzzlesAdded === 1 ? "" : "s"} to your queue`
                : `Imported ${info.analyzed + info.fromCache} game${info.analyzed + info.fromCache === 1 ? "" : "s"}`,
              action: info.puzzlesAdded > 0
                ? { label: "Start training →", onClick: () => setMarathonOpen(true) }
                : undefined,
            });
            setPuzzleStatsRev((r) => r + 1);
          }}
        />
        <Toast toast={toast} onDismiss={() => setToast(null)} />
        <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        {pendingGames && (
          <GameChooser
            games={pendingGames.games}
            onClose={() => setPendingGames(null)}
            onPick={(pgn) => {
              const d = pendingGames.depth;
              setPendingGames(null);
              handleAnalyzePgn(pgn, { depth: d });
            }}
          />
        )}
      </>
    );
  }
  if (phase === "analyzing") {
    return <AnalyzingScreen current={progress.current} total={progress.total} depth={analyzeDepth} onCancel={() => setPhase("landing")} headers={headers} opening={opening} />;
  }

  const showBoardColumn = isDesktopLayout || mobileTab === "board";
  const showMovesColumn = isDesktopLayout || mobileTab === "moves";
  const showSideColumn = isDesktopLayout || mobileTab === "side";

  return (
    <div
      className="min-h-screen px-3 py-3 sm:px-4 sm:py-4 xl:px-6 animate-[fade-in_300ms_ease-out] pb-24 lg:pb-3"
      style={{ background: "var(--bg)" }}
    >
      <div className="max-w-[1440px] mx-auto">
        {/* Header */}
        <header className="mb-4 xl:mb-5 rounded-2xl ring-1 ring-white/[0.06] overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(24,24,27,0.95) 0%, rgba(16,16,18,0.98) 100%)", backdropFilter: "blur(12px)" }}
        >
          {/* Subtle top accent line */}
          <div className="h-px w-full" style={{ background: "linear-gradient(90deg, transparent, rgba(16,185,129,0.35) 40%, rgba(6,182,212,0.25) 70%, transparent)" }} />

          <div className="flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-2.5">

            {/* ── LEFT: Brand + Title ── */}
            <div className="flex items-center gap-2.5 min-w-0 shrink-0">
              {/* Brand mark — uses the actual GameLens icon image */}
              <button
                onClick={handleNewGame}
                className="group flex items-center gap-2 shrink-0"
                title="New analysis"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/gamelens-icon.png"
                  alt="GameLens"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-xl ring-1 ring-white/10 transition-all group-hover:ring-emerald-400/40 object-cover"
                />
                <div className="flex flex-col leading-none">
                  <span className="text-[11px] font-semibold tracking-widest uppercase"
                    style={{ background: "linear-gradient(90deg, #10b981, #06b6d4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                  >GameLens</span>
                  <span className="text-[10px] mt-0.5" style={{ color: "rgba(113,113,122,0.7)" }}>
                    {phase === "review" ? "Game Review" : "Explore"}
                  </span>
                </div>
              </button>

              {/* Vertical divider + Meta strip — hidden on mobile */}
              <div className="hidden md:block h-7 w-px shrink-0 bg-white/[0.07]" />
              <div className="hidden md:flex items-center gap-2 min-w-0 overflow-hidden">
                {phase === "review" && headers && (headers.white || headers.black) ? (
                  <span className="text-xs truncate max-w-[18rem] font-medium" style={{ color: "rgba(244,244,245,0.65)" }}>
                    <span style={{ color: "rgba(244,244,245,0.9)" }}>{headers.white || "?"}</span>
                    {headers.whiteElo ? <span style={{ color: "rgba(113,113,122,0.7)", fontSize: "10px" }}> ({headers.whiteElo})</span> : null}
                    <span style={{ color: "rgba(113,113,122,0.5)", margin: "0 6px" }}>vs</span>
                    <span style={{ color: "rgba(244,244,245,0.9)" }}>{headers.black || "?"}</span>
                    {headers.blackElo ? <span style={{ color: "rgba(113,113,122,0.7)", fontSize: "10px" }}> ({headers.blackElo})</span> : null}
                    {headers.result ? <span style={{ color: "rgba(113,113,122,0.5)", marginLeft: "6px" }}>· {headers.result}</span> : null}
                  </span>
                ) : null}
                <OpeningBadge name={opening} />
                {phase === "review" && currentPgn && analyzeDepth < 22 && (
                  <button
                    onClick={handleReanalyze}
                    className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition-all"
                    style={{ color: "#67e8f9", background: "rgba(6,182,212,0.08)", boxShadow: "inset 0 0 0 1px rgba(6,182,212,0.2)" }}
                    title={`Re-analyze at deeper depth (currently ${analyzeDepth})`}
                  >
                    <Gauge size={10} />
                    Depth {analyzeDepth}
                  </button>
                )}
              </div>
            </div>

            {/* ── SPACER ── */}
            <div className="flex-1" />

            {/* ── RIGHT: Action buttons ── */}
            <div className="flex items-center gap-1">

              {/* DESKTOP ONLY: Tier 1 — Flip + PGN */}
              <div className="hidden md:flex items-center gap-1 mr-1">
                <button
                  onClick={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
                  className="shrink-0 inline-flex h-8 items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-all"
                  style={{ color: "rgba(244,244,245,0.6)", background: "rgba(255,255,255,0.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.9)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.6)"; }}
                  title="Flip board (F)"
                >
                  <ArrowLeftRight size={12} /> Flip
                </button>
                <button
                  onClick={handleExportPgn}
                  className="shrink-0 inline-flex h-8 items-center gap-1.5 px-2.5 rounded-lg text-xs font-medium transition-all"
                  style={{ color: "rgba(244,244,245,0.6)", background: "rgba(255,255,255,0.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.9)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.6)"; }}
                >
                  {copiedPgn ? <Check size={12} style={{ color: "#34d399" }} /> : <Copy size={12} />}
                  {copiedPgn ? "Copied" : "PGN"}
                </button>
              </div>

              {/* DESKTOP ONLY: separator */}
              <div className="hidden md:block h-5 w-px bg-white/[0.07] mx-0.5" />

              {/* DESKTOP ONLY: Tier 2 — Primary colored actions */}
              <div className="hidden md:flex items-center gap-1 mx-1">
                {phase === "review" && currentPgn && (
                  <button
                    onClick={handleShare}
                    className="shrink-0 inline-flex h-8 items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                    style={{ color: "#a7f3d0", background: "rgba(16,185,129,0.1)", boxShadow: "inset 0 0 0 1px rgba(16,185,129,0.2)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.18)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.1)"; }}
                    title="Copy a shareable link to this analysis"
                  >
                    <Share2 size={12} /> Share
                  </button>
                )}
                <button
                  onClick={() => setImportOpen(true)}
                  className="shrink-0 inline-flex h-8 items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                  style={{ color: "#bfdbfe", background: "rgba(99,102,241,0.1)", boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.2)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.18)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(99,102,241,0.1)"; }}
                  title="Import a new game without losing this one"
                >
                  <Upload size={12} /> Import
                </button>
                <button
                  onClick={() => setMarathonOpen(true)}
                  className="shrink-0 inline-flex h-8 items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all relative"
                  style={{ color: "#fde68a", background: "rgba(245,158,11,0.09)", boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.2)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.18)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(245,158,11,0.09)"; }}
                  title="Puzzle marathon from your mistakes"
                >
                  <Target size={12} /> Puzzles
                  {puzzleQueueStats.due > 0 && (
                    <span
                      className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 grid place-items-center rounded-full text-[9px] font-bold tabular-nums"
                      style={{ background: "#06b6d4", color: "#0a0a0a", boxShadow: "0 0 0 2px #0a0a0a" }}
                    >
                      {puzzleQueueStats.due > 99 ? "99+" : puzzleQueueStats.due}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setInsightsOpen(true)}
                  className="shrink-0 inline-flex h-8 items-center gap-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
                  style={{ color: "#c4b5fd", background: "rgba(139,92,246,0.09)", boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.2)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.18)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(139,92,246,0.09)"; }}
                  title="Insights across all your analyzed games"
                >
                  <BarChart3 size={12} /> Insights
                </button>
              </div>

              {/* DESKTOP ONLY: separator */}
              <div className="hidden md:block h-5 w-px bg-white/[0.07] mx-0.5" />

              {/* MOBILE: compact icon-only shortcuts — Import + Puzzles (Flip is in BoardSettings) */}
              <div className="flex md:hidden items-center gap-0.5 mr-1">
                <button
                  onClick={() => setImportOpen(true)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all"
                  style={{ color: "rgba(191,219,254,0.7)", background: "rgba(99,102,241,0.08)", boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.18)" }}
                  title="Import game"
                >
                  <Upload size={15} />
                </button>
                <button
                  onClick={() => setMarathonOpen(true)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-all relative"
                  style={{ color: "rgba(253,230,138,0.7)", background: "rgba(245,158,11,0.08)", boxShadow: "inset 0 0 0 1px rgba(245,158,11,0.18)" }}
                  title="Puzzles"
                >
                  <Target size={15} />
                  {puzzleQueueStats.due > 0 && (
                    <span
                      className="absolute -top-1 -right-1 h-4 min-w-[14px] px-0.5 grid place-items-center rounded-full text-[8px] font-bold tabular-nums"
                      style={{ background: "#06b6d4", color: "#0a0a0a", boxShadow: "0 0 0 1.5px #0a0a0a" }}
                    >
                      {puzzleQueueStats.due > 99 ? "99+" : puzzleQueueStats.due}
                    </span>
                  )}
                </button>
              </div>

              {/* ALL SIZES: Tier 3 — Utility icons */}
              <div className="flex items-center gap-0.5">
                {/* Gemini API key — hidden on mobile (reachable via Settings modal) */}
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="hidden md:grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all"
                  style={{ color: "rgba(244,244,245,0.4)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.9)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.4)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  title="Gemini API key"
                >
                  <KeyRound size={14} />
                </button>
                <button
                  onClick={() => setFeedbackOpen(true)}
                  className="grid h-9 w-9 md:h-8 md:w-8 shrink-0 place-items-center rounded-lg transition-all"
                  style={{ color: "rgba(244,244,245,0.5)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.9)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.5)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  title="Help & feedback"
                >
                  <HelpCircle size={15} />
                </button>
                <button
                  onClick={() => setShortcutsOpen(true)}
                  className="grid h-9 w-9 md:h-8 md:w-8 shrink-0 place-items-center rounded-lg transition-all"
                  style={{ color: "rgba(244,244,245,0.5)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.9)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(244,244,245,0.5)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  title="Controls & shortcuts"
                >
                  {/* On mobile show Info icon (touch guide); desktop shows Keyboard icon */}
                  <Info size={15} className="md:hidden" />
                  <Keyboard size={15} className="hidden md:block" />
                </button>
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all"
                  style={{ color: "rgba(244,244,245,0.4)" }}
                >
                  <BoardSettings
                    boardOrientation={boardOrientation}
                    showCoordinates={showCoordinates}
                    showAnimations={showAnimations}
                    onOrientationChange={setBoardOrientation}
                    onCoordinatesChange={setShowCoordinates}
                    onAnimationsChange={setShowAnimations}
                    onFlipBoard={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
                    onReset={handleNewGame}
                    boardThemes={BOARD_THEMES}
                    currentTheme={boardTheme}
                    onThemeChange={setBoardTheme}
                    engineDepth={engineDepth}
                    onDepthChange={setEngineDepth}
                    soundEnabled={soundEnabled}
                    onSoundChange={setSoundEnabled}
                    showHanging={showHanging}
                    onShowHangingChange={setShowHanging}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* MOBILE ONLY: secondary action row — Share, PGN, Insights */}
          <div className="md:hidden relative">
          <div className="flex items-center gap-1.5 px-3 pb-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {phase === "review" && currentPgn && (
              <button
                onClick={handleShare}
                className="shrink-0 inline-flex h-7 items-center gap-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{ color: "#a7f3d0", background: "rgba(16,185,129,0.1)", boxShadow: "inset 0 0 0 1px rgba(16,185,129,0.2)" }}
                title="Share"
              >
                <Share2 size={11} /> Share
              </button>
            )}
            <button
              onClick={handleExportPgn}
              className="shrink-0 inline-flex h-7 items-center gap-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{ color: "rgba(244,244,245,0.65)", background: "rgba(255,255,255,0.04)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)" }}
            >
              {copiedPgn ? <Check size={11} style={{ color: "#34d399" }} /> : <Copy size={11} />}
              {copiedPgn ? "Copied" : "PGN"}
            </button>
            <button
              onClick={() => setInsightsOpen(true)}
              className="shrink-0 inline-flex h-7 items-center gap-1.5 px-2.5 rounded-lg text-[11px] font-semibold transition-all"
              style={{ color: "#c4b5fd", background: "rgba(139,92,246,0.09)", boxShadow: "inset 0 0 0 1px rgba(139,92,246,0.2)" }}
            >
              <BarChart3 size={11} /> Insights
            </button>
            {phase === "review" && currentPgn && analyzeDepth < 22 && (
              <button
                onClick={handleReanalyze}
                className="shrink-0 inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition-all"
                style={{ color: "#67e8f9", background: "rgba(6,182,212,0.08)", boxShadow: "inset 0 0 0 1px rgba(6,182,212,0.2)" }}
                title={`Re-analyze at deeper depth (currently ${analyzeDepth})`}
              >
                <Gauge size={10} /> Depth {analyzeDepth}
              </button>
            )}
            <OpeningBadge name={opening} />
          </div>
          {/* Fade hint — signals the strip is scrollable */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6"
            style={{ background: "linear-gradient(to left, rgba(16,16,18,0.9), transparent)" }} />
          </div>
        </header>

        {/* Mobile tab strip */}
        <div className="lg:hidden flex items-center gap-1 mb-3 p-1.5 bg-surface/60 ring-1 ring-muted/20 rounded-xl">
          {([
            { id: "board", label: "Board" },
            { id: "moves", label: "Moves" },
            { id: "side", label: phase === "review" ? "Analysis" : "Engine" },
          ] as const).map((t) => {
            const active = mobileTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setMobileTab(t.id)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-[var(--main)] text-bg shadow-sm"
                    : "text-muted hover:text-fg/90 hover:bg-surface"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[auto_minmax(220px,260px)_minmax(300px,340px)] xl:grid-cols-[auto_minmax(240px,300px)_minmax(320px,360px)] 2xl:grid-cols-[auto_minmax(260px,320px)_minmax(340px,380px)] justify-center gap-4 xl:gap-5 items-start">
          {showBoardColumn && (
            <div className="justify-self-center lg:justify-self-auto">
              <BoardColumn
                fen={positions[currentIndex]?.fen || ""}
                reviewMode={phase === "review"}
                cp={phase === "review" ? reviewCp : liveCp}
                mate={phase === "review" ? reviewMate : liveMate}
                boardOrientation={boardOrientation}
                boardTheme={boardTheme}
                showCoordinates={showCoordinates}
                showAnimations={showAnimations}
                movable={phase === "explore" || phase === "review" || !!puzzle}
                onPieceDrop={phase === "explore" || phase === "review" || puzzle ? onPieceDrop : undefined}
                arrows={arrows}
                lastMove={lastMove}
                currentIndex={currentIndex}
                totalPlies={totalPlies}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                goToStart={goToStart}
                goBack={goBack}
                goForward={goForward}
                goToEnd={goToEnd}
                goToPly={goToPly}
                cpsByPly={cpsByPly}
                classificationsByPly={classificationsByPly}
                gameOver={gameOverState}
                turnOverride={engineThinking ? "Engine thinking…" : undefined}
                clockSpent={clocks?.spent}
                onArrowsChange={handleArrowsChange}
                showHanging={showHanging}
                currentSan={positions[currentIndex]?.move?.san}
                currentClassification={
                  currentIndex > 0 ? classificationsByPly[currentIndex] : undefined
                }
                currentAnalyzed={currentAnalyzed}
                opening={opening ?? undefined}
                geminiSettingsRev={settingsRev}
                onOpenSettings={() => setSettingsOpen(true)}
                onStartPuzzle={
                  currentAnalyzed &&
                  (currentAnalyzed.classification === "blunder" ||
                    currentAnalyzed.classification === "mistake" ||
                    currentAnalyzed.classification === "miss")
                    ? () => handleStartPuzzle(currentAnalyzed.index)
                    : undefined
                }
                onSwipeLeft={goForward}
                onSwipeRight={goBack}
              />
            </div>
          )}

          {/* Center: move list */}
          {showMovesColumn && (
            <div className="h-[64vh] min-h-[430px] lg:h-[calc(100vh-136px)] lg:min-h-[500px] lg:max-h-[680px] w-full animate-[fade-in_360ms_ease-out_80ms_both]">
              <MoveList
                moves={moveHistory}
                currentIndex={currentIndex}
                onMoveClick={(p) => {
                  goToPly(p);
                  if (!isDesktopLayout) setMobileTab("board");
                }}
                annotations={annotations}
                classifications={classificationsByPly}
                onAnnotationClick={handleAnnotationClick}
              />
            </div>
          )}

          {/* Right: review panels or engine panel */}
          {showSideColumn && (
            <div className="flex flex-col gap-3 pb-8 animate-[slide-in-right_320ms_ease-out_both]">
            {phase === "review" ? (
              <>
                {puzzle && analyzedMoves[puzzle.movePly - 1] ? (
                  <PuzzlePanel
                    move={analyzedMoves[puzzle.movePly - 1]}
                    attempted={puzzle.attempted}
                    solved={puzzle.solved}
                    failed={puzzle.failed}
                    revealed={puzzle.revealed}
                    onReveal={() => setPuzzle((p) => p && { ...p, revealed: true })}
                    onRetry={handleRetryPuzzle}
                    onExit={handleExitPuzzle}
                    onNext={handleNextPuzzle}
                    session={puzzleSession}
                  />
                ) : (
                  <MoveCoachCard
                    move={currentAnalyzed}
                    currentPly={currentIndex}
                    totalPlies={totalPlies}
                    isPlaying={isPlaying}
                    onTogglePlay={() => setIsPlaying((p) => !p)}
                    onPrev={goBack}
                    onNext={goForward}
                    onPrevBlunder={prevBlunder !== null ? () => goToPly(prevBlunder) : undefined}
                    onNextBlunder={nextBlunder !== null ? () => goToPly(nextBlunder) : undefined}
                    hasPrevBlunder={prevBlunder !== null}
                    hasNextBlunder={nextBlunder !== null}
                    opening={opening ?? undefined}
                    geminiSettingsRev={settingsRev}
                    onOpenSettings={() => setSettingsOpen(true)}
                    spentSeconds={
                      currentAnalyzed && clocks?.spent
                        ? clocks.spent[currentAnalyzed.index - 1] ?? null
                        : null
                    }
                    onStartPuzzle={
                      currentAnalyzed &&
                      (currentAnalyzed.classification === "blunder" ||
                        currentAnalyzed.classification === "mistake" ||
                        currentAnalyzed.classification === "miss")
                        ? () => handleStartPuzzle(currentAnalyzed.index)
                        : undefined
                    }
                  />
                )}
                {summary && (
                  <GameReview
                    summary={summary}
                    whiteName={headers?.white}
                    blackName={headers?.black}
                    onJumpToMove={goToPly}
                    classificationsByPly={classificationsByPly}
                  />
                )}
                <CriticalMoments moves={analyzedMoves} onJumpToMove={goToPly} />
                <EnginePanel
                  isReady={isReady}
                  evaluation={evaluation}
                  bestMove={bestMove}
                  topLines={topLines}
                  depth={engineDepth}
                  onDepthChange={setEngineDepth}
                  fen={positions[currentIndex]?.fen}
                />
              </>
            ) : (
              <>
                <PlayVsEnginePanel
                  playSide={playSide}
                  onPlaySideChange={(side) => {
                    setPlaySide(side);
                    if (side) setBoardOrientation(side);
                  }}
                  elo={engineElo}
                  onEloChange={setEngineElo}
                  thinking={engineThinking}
                />
                <EnginePanel
                  isReady={isReady}
                  evaluation={evaluation}
                  bestMove={bestMove}
                  topLines={topLines}
                  depth={engineDepth}
                  onDepthChange={setEngineDepth}
                  fen={positions[currentIndex]?.fen}
                />
              </>
            )}
            </div>
          )}
        </div>
      </div>

      <AnnotationModal
        isOpen={!!annotationMove}
        initialText={annotationMove?.text || ""}
        moveSan={annotationMove?.san}
        onSave={handleAnnotationSave}
        onDelete={handleAnnotationDelete}
        onClose={() => setAnnotationMove(null)}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <ShortcutsModal isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <FeedbackModal isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChange={() => setSettingsRev((r) => r + 1)}
      />
      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onStart={(pgn, opts) => handleAnalyzePgn(pgn, opts)}
        onExplore={(fen) => handleExploreFen(fen)}
        onOpenCached={(g) => handleOpenCached(g)}
        onBulkDone={(info) => {
          setToast({
            kind: "success",
            msg: info.puzzlesAdded > 0
              ? `Added ${info.puzzlesAdded} puzzle${info.puzzlesAdded === 1 ? "" : "s"} to your queue`
              : `Imported ${info.analyzed + info.fromCache} game${info.analyzed + info.fromCache === 1 ? "" : "s"}`,
            action: info.puzzlesAdded > 0
              ? { label: "Start training →", onClick: () => setMarathonOpen(true) }
              : undefined,
          });
          setPuzzleStatsRev((r) => r + 1);
        }}
      />
      <MarathonModal
        isOpen={marathonOpen}
        onClose={() => {
          setMarathonOpen(false);
          setPuzzleStatsRev((r) => r + 1);
        }}
        onOpenSourceGame={async (gameKey, ply) => {
          const cached = await import("@/lib/gameCache").then((m) => m.loadGame(gameKey));
          if (cached) {
            handleOpenCached(cached);
            setMarathonOpen(false);
            // jump to the puzzle position once moves are loaded
            setTimeout(() => setCurrentIndex(ply), 100);
          } else {
            setToast({ kind: "info", msg: "Source game is no longer cached." });
          }
        }}
        boardTheme={boardTheme}
        showCoordinates={showCoordinates}
        showAnimations={showAnimations}
      />
      <InsightsModal
        isOpen={insightsOpen}
        onClose={() => setInsightsOpen(false)}
        onOpenGame={(g) => {
          handleOpenCached(g);
          setInsightsOpen(false);
        }}
        onOpenMarathon={() => {
          setInsightsOpen(false);
          setMarathonOpen(true);
        }}
      />
      <MobileNavBar
        currentIndex={currentIndex}
        totalPlies={totalPlies}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying((p) => !p)}
        goToStart={goToStart}
        goBack={goBack}
        goForward={goForward}
        goToEnd={goToEnd}
        onNextBlunder={
          phase === "review" && nextBlunder !== null
            ? () => goToPly(nextBlunder)
            : undefined
        }
        hasNextBlunder={phase === "review" && nextBlunder !== null}
      />

      {pendingPromotion && (
        <PromotionPicker
          isOpen
          color={pendingPromotion.color}
          onCancel={() => setPendingPromotion(null)}
          onPick={(piece) => {
            const { from, to } = pendingPromotion;
            setPendingPromotion(null);
            onPieceDrop(from, to, piece);
          }}
        />
      )}
    </div>
  );
}
