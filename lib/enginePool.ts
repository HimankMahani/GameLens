/**
 * Transient Stockfish worker pool for batch analysis.
 *
 * Spawns N workers, parses UCI output, runs positions in parallel.
 * Caller is responsible for terminating the pool when done.
 */
import type { AnalysisResult, MultiPvLine } from "@/hooks/useStockfish";

interface PoolJob {
  fen: string;
  depth: number;
  multipv: number;
  /** Stockfish Skill Level option, 0-20. If set, applied before `go`. */
  skill?: number;
  resolve: (r: AnalysisResult) => void;
  reject: (err: Error) => void;
}

interface WorkerSlot {
  worker: Worker;
  ready: boolean;
  busy: boolean;
  current: PoolJob | null;
  partial: Map<number, MultiPvLine>;
  multipv: number;
  skill: number;
  sideToMove: "w" | "b";
}

export interface EnginePool {
  analyze(fen: string, opts: { depth: number; multipv: number; skill?: number }): Promise<AnalysisResult>;
  terminate(): void;
  ready: Promise<void>;
  size: number;
}

export function createPool(size: number): EnginePool {
  const slots: WorkerSlot[] = [];
  const queue: PoolJob[] = [];
  let terminated = false;

  const readyResolvers: Array<() => void> = [];
  const readyRejecters: Array<(err: Error) => void> = [];
  let readyCount = 0;
  let readySettled = false;
  const readyPromise = new Promise<void>((resolve, reject) => {
    readyResolvers.push(resolve);
    readyRejecters.push(reject);
  });
  const rejectReady = (err: Error) => {
    if (readySettled) return;
    readySettled = true;
    readyRejecters.forEach((r) => r(err));
  };
  const resolveReady = () => {
    if (readySettled) return;
    readySettled = true;
    readyResolvers.forEach((r) => r());
  };

  const loadTimeout = setTimeout(() => {
    rejectReady(new Error("Engine load timed out"));
  }, 15000);

  for (let i = 0; i < size; i++) {
    const worker = new Worker("/stockfish/stockfish.js");
    const slot: WorkerSlot = {
      worker,
      ready: false,
      busy: false,
      current: null,
      partial: new Map(),
      multipv: 1,
      skill: 20,
      sideToMove: "w",
    };
    slots.push(slot);

    worker.onerror = () => {
      rejectReady(new Error("Engine worker failed to load"));
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
        if (!slot.ready) {
          slot.ready = true;
          readyCount++;
          if (readyCount === size) {
            clearTimeout(loadTimeout);
            resolveReady();
          }
          pump();
        }
        return;
      }

      if (line.startsWith("info ") && line.includes(" pv ")) {
        const parsed = parseInfo(line, slot.sideToMove);
        if (parsed) slot.partial.set(parsed.pvNum, parsed);
        return;
      }

      if (line.startsWith("bestmove") && slot.current) {
        const match = line.match(/^bestmove\s+(\S+)/);
        const bm = match ? match[1] : "";
        const job = slot.current;
        const lines: MultiPvLine[] = [];
        for (let i = 1; i <= job.multipv; i++) {
          const l = slot.partial.get(i);
          if (l) lines.push(l);
        }
        const best = lines[0];
        if (best) {
          job.resolve({ best, lines, bestMove: bm });
        } else {
          job.reject(new Error("Stockfish returned no PV"));
        }
        slot.current = null;
        slot.busy = false;
        slot.partial.clear();
        pump();
      }
    };

    worker.postMessage("uci");
  }

  function pump() {
    if (terminated) return;
    for (const slot of slots) {
      if (!slot.ready || slot.busy) continue;
      const job = queue.shift();
      if (!job) return;
      slot.busy = true;
      slot.current = job;
      slot.sideToMove = job.fen.split(" ")[1] === "b" ? "b" : "w";
      if (slot.multipv !== job.multipv) {
        slot.worker.postMessage("setoption name MultiPV value " + job.multipv);
        slot.multipv = job.multipv;
      }
      const wantSkill = job.skill ?? 20;
      if (slot.skill !== wantSkill) {
        slot.worker.postMessage("setoption name Skill Level value " + wantSkill);
        slot.skill = wantSkill;
      }
      slot.worker.postMessage("ucinewgame");
      slot.worker.postMessage("position fen " + job.fen);
      slot.worker.postMessage("go depth " + job.depth);
    }
  }

  return {
    size,
    ready: readyPromise,
    analyze(fen, opts) {
      if (terminated) return Promise.reject(new Error("Pool terminated"));
      return new Promise<AnalysisResult>((resolve, reject) => {
        queue.push({
          fen,
          depth: opts.depth,
          multipv: opts.multipv,
          skill: opts.skill,
          resolve,
          reject,
        });
        pump();
      });
    },
    terminate() {
      terminated = true;
      clearTimeout(loadTimeout);
      for (const slot of slots) slot.worker.terminate();
      // Reject any jobs still waiting
      for (const job of queue) job.reject(new Error("Pool terminated"));
      queue.length = 0;
    },
  };
}

function parseInfo(line: string, sideToMove: "w" | "b"): MultiPvLine | null {
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
