"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface EvaluationResult {
  depth: number;
  /** centipawns from white's perspective (mate -> ±100000) */
  cp: number;
  /** raw cp from side-to-move perspective, as parsed from UCI */
  cpStm: number;
  /** mate-in-N (positive: side to move mates; negative: mated) */
  mate: number | null;
  /** principal variation (UCI moves) */
  pv: string[];
}

export interface MultiPvLine extends EvaluationResult {
  pvNum: number;
}

export interface AnalysisResult {
  /** highest-depth main eval (PV 1) */
  best: EvaluationResult;
  /** all PV lines, sorted by pvNum */
  lines: MultiPvLine[];
  /** UCI bestmove returned by `bestmove` line */
  bestMove: string;
}

interface PendingRequest {
  fen: string;
  resolve: (r: AnalysisResult) => void;
  reject: (err: Error) => void;
  depth: number;
  multipv: number;
  // Latest snapshot of every PV
  partial: Map<number, MultiPvLine>;
  onProgress?: (line: MultiPvLine) => void;
  cancelled: boolean;
}

export function useStockfish() {
  const workerRef = useRef<Worker | null>(null);
  const queueRef = useRef<PendingRequest[]>([]);
  const activeRef = useRef<PendingRequest | null>(null);
  const readyRef = useRef(false);
  const setOptionMultiPvRef = useRef<number>(1);

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [bestMove, setBestMove] = useState<string | null>(null);
  const [topLines, setTopLines] = useState<MultiPvLine[]>([]);

  const sideToMoveRef = useRef<"w" | "b">("w");

  const runNext = useCallback(() => {
    if (activeRef.current || queueRef.current.length === 0) return;
    const w = workerRef.current;
    if (!w || !readyRef.current) return;

    const req = queueRef.current.shift()!;
    activeRef.current = req;
    sideToMoveRef.current = req.fen.split(" ")[1] === "b" ? "b" : "w";

    if (setOptionMultiPvRef.current !== req.multipv) {
      w.postMessage("setoption name MultiPV value " + req.multipv);
      setOptionMultiPvRef.current = req.multipv;
    }
    w.postMessage("ucinewgame");
    w.postMessage("position fen " + req.fen);
    w.postMessage("go depth " + req.depth);
  }, []);

  useEffect(() => {
    // stockfish.js is a dual-mode script. It auto-detects a Web Worker context
    // via `typeof onmessage !== 'undefined' && typeof window === 'undefined'`
    // so a plain URL is sufficient — no hash fragment needed.
    const worker = new Worker("/stockfish/stockfish.js");
    workerRef.current = worker;

    // 90s — first load compiles the WASM; subsequent loads hit the HTTP cache.
    const t = setTimeout(() => {
      if (!readyRef.current) setError("Engine load timed out — try a hard-refresh (Ctrl+Shift+R) or disable extensions.");
    }, 90000);

    worker.onerror = (e: ErrorEvent) => {
      // The WASM streaming-compile sometimes fires a non-fatal unhandled-rejection
      // that shows up here as an empty ErrorEvent (message/filename both "").
      // The engine recovers via its ArrayBuffer fallback, so we only treat it
      // as fatal when the event carries real detail.
      const detail = e.message || e.filename;
      if (detail) {
        console.error("Stockfish worker error:", e);
        setError("Engine failed to load: " + detail);
        setIsReady(false);
      } else {
        // Non-fatal — log at debug level and let the engine continue initializing.
        console.debug("Stockfish: non-fatal worker event (WASM streaming fallback)", e);
      }
    };

    worker.onmessage = (e) => {
      const line: string = typeof e.data === "string" ? e.data : "";
      if (!line) return;

      if (line === "uciok") {
        worker.postMessage("setoption name Threads value 1");
        worker.postMessage("setoption name Hash value 16");
        worker.postMessage("setoption name MultiPV value 1");
        worker.postMessage("isready");
        return;
      }
      if (line === "readyok") {
        readyRef.current = true;
        clearTimeout(t);
        setIsReady(true);
        runNext();
        return;
      }

      if (line.startsWith("info ") && line.includes(" pv ")) {
        const parsed = parseInfoLine(line, sideToMoveRef.current);
        if (!parsed) return;
        const req = activeRef.current;
        if (req) {
          req.partial.set(parsed.pvNum, parsed);
          req.onProgress?.(parsed);
        }
        if (parsed.pvNum === 1) {
          setEvaluation(parsed);
        }
        // top-lines snapshot
        const snapshot: MultiPvLine[] = [];
        const src = req?.partial ?? new Map<number, MultiPvLine>();
        for (let i = 1; i <= (req?.multipv ?? 1); i++) {
          const l = src.get(i);
          if (l) snapshot.push(l);
        }
        if (snapshot.length) setTopLines(snapshot);
        return;
      }

      if (line.startsWith("bestmove")) {
        const match = line.match(/^bestmove\s+(\S+)/);
        const bm = match ? match[1] : "";
        setBestMove(bm);

        const req = activeRef.current;
        if (req && !req.cancelled) {
          const lines: MultiPvLine[] = [];
          for (let i = 1; i <= req.multipv; i++) {
            const l = req.partial.get(i);
            if (l) lines.push(l);
          }
          const best = lines[0];
          if (best) {
            req.resolve({ best, lines, bestMove: bm });
          } else {
            req.reject(new Error("Stockfish returned no PV"));
          }
        }
        activeRef.current = null;
        runNext();
      }
    };

    worker.postMessage("uci");

    return () => {
      clearTimeout(t);
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
      activeRef.current = null;
      queueRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Promise API used by the batch analyzer. */
  const analyzePosition = useCallback(
    (
      fen: string,
      opts: { depth?: number; multipv?: number; onProgress?: (l: MultiPvLine) => void } = {}
    ): Promise<AnalysisResult> => {
      const depth = opts.depth ?? 16;
      const multipv = opts.multipv ?? 1;
      return new Promise((resolve, reject) => {
        const req: PendingRequest = {
          fen,
          depth,
          multipv,
          resolve,
          reject,
          partial: new Map(),
          onProgress: opts.onProgress,
          cancelled: false,
        };
        queueRef.current.push(req);
        runNext();
      });
    },
    [runNext]
  );

  /** Live evaluate for explore mode — replaces any pending live eval. */
  const evaluate = useCallback(
    (fen: string, depth = 16, multipv = 1) => {
      // Drop any queued live evals so we don't pile up
      queueRef.current = queueRef.current.filter((r) => !r.fen.startsWith("__live__"));
      // Stop any in-flight one
      if (activeRef.current) {
        activeRef.current.cancelled = true;
        workerRef.current?.postMessage("stop");
        activeRef.current = null;
      }
      setEvaluation(null);
      setTopLines([]);
      setBestMove(null);
      analyzePosition(fen, { depth, multipv })
        .then((r) => {
          setEvaluation(r.best);
          setTopLines(r.lines);
          setBestMove(r.bestMove);
        })
        .catch(() => {
          /* ignore cancellation */
        });
    },
    [analyzePosition]
  );

  const stop = useCallback(() => {
    workerRef.current?.postMessage("stop");
  }, []);

  return {
    isReady,
    error,
    evaluate,
    analyzePosition,
    stop,
    evaluation,
    bestMove,
    topLines,
  };
}

function parseInfoLine(line: string, sideToMove: "w" | "b"): MultiPvLine | null {
  const depthMatch = line.match(/\bdepth (\d+)/);
  const scoreMatch = line.match(/\bscore (cp|mate) (-?\d+)/);
  const pvMatch = line.match(/\bpv (.+?)$/);
  const multipvMatch = line.match(/\bmultipv (\d+)/);
  if (!depthMatch || !scoreMatch || !pvMatch) return null;

  const depth = parseInt(depthMatch[1], 10);
  const scoreType = scoreMatch[1];
  const scoreValue = parseInt(scoreMatch[2], 10);

  let cpStm: number;
  let mate: number | null = null;
  if (scoreType === "mate") {
    mate = scoreValue;
    cpStm = scoreValue >= 0 ? 100000 - scoreValue : -100000 - scoreValue;
  } else {
    cpStm = scoreValue;
  }
  // Normalize to white's POV
  const cp = sideToMove === "w" ? cpStm : -cpStm;
  const mateW = mate === null ? null : sideToMove === "w" ? mate : -mate;

  return {
    depth,
    cp,
    cpStm,
    mate: mateW,
    pv: pvMatch[1].split(/\s+/),
    pvNum: multipvMatch ? parseInt(multipvMatch[1], 10) : 1,
  };
}
