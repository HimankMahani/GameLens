"use client";

import { createPool, EnginePool } from "./enginePool";

/** Stockfish Skill Level (0-20) for a given target Elo. Rough mapping. */
export function skillForElo(elo: number): number {
  if (elo <= 800) return 0;
  if (elo <= 1100) return 2;
  if (elo <= 1400) return 5;
  if (elo <= 1700) return 8;
  if (elo <= 2000) return 11;
  if (elo <= 2300) return 14;
  if (elo <= 2600) return 17;
  return 20;
}

export const ELO_PRESETS = [1100, 1400, 1700, 2000, 2400, 2800] as const;
export type EloPreset = (typeof ELO_PRESETS)[number];

let livePool: EnginePool | null = null;

/** Get the shared single-worker play pool. Lazily created. */
function getPool(): EnginePool {
  if (!livePool) livePool = createPool(1);
  return livePool;
}

/** Ask the engine for a move at the given fen, dialed to the target Elo. */
export async function requestEngineMove(fen: string, elo: number): Promise<string> {
  const pool = getPool();
  await pool.ready;
  const res = await pool.analyze(fen, {
    depth: 12,
    multipv: 1,
    skill: skillForElo(elo),
  });
  return res.bestMove;
}

export function terminatePlayPool() {
  if (livePool) {
    livePool.terminate();
    livePool = null;
  }
}
