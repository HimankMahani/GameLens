/**
 * Background batch analysis: take N PGNs, run them through a Stockfish pool,
 * persist each result to the IndexedDB game cache, and feed the user's blunders
 * into the puzzle queue.
 *
 * Designed to be cancellable and to surface progress at both levels:
 *  - which game out of N
 *  - within the current game, plies done
 */

import { Chess } from "chess.js";
import { analyzeGame, type AnalyzedMove } from "@/lib/analysis";
import { createPool } from "@/lib/enginePool";
import { ensureEcoLoaded, isBookFen } from "@/hooks/useOpening";
import { hashKey, loadGame, saveGame, type CachedGame } from "@/lib/gameCache";
import { parsePgnHeaders } from "@/lib/pgnFetch";
import { newPuzzleFromMistake, upsertPuzzle } from "@/lib/puzzleQueue";

export interface BulkProgress {
  gameIndex: number;
  total: number;
  current: number;
  currentTotal: number;
  cachedHit: boolean;
  /** Headers of the current game for nice progress UI. */
  white?: string;
  black?: string;
}

export interface BulkResult {
  analyzed: number;
  fromCache: number;
  failed: number;
  puzzlesAdded: number;
  /** Game keys that were added or refreshed. */
  gameKeys: string[];
}

export interface BulkOptions {
  depth: number;
  /** Username whose mistakes should populate the puzzle queue. Case-insensitive. */
  player?: string;
  onProgress?: (p: BulkProgress) => void;
  signal?: AbortSignal;
}

const PUZZLE_CLASSES = new Set<AnalyzedMove["classification"]>([
  "blunder",
  "mistake",
  "miss",
]);

function pickPlayerSide(headers: ReturnType<typeof parsePgnHeaders>, player?: string): "w" | "b" | null {
  if (!player) return null;
  const p = player.toLowerCase();
  if (headers.white?.toLowerCase() === p) return "w";
  if (headers.black?.toLowerCase() === p) return "b";
  return null;
}

export async function bulkAnalyze(
  pgns: string[],
  opts: BulkOptions
): Promise<BulkResult> {
  const result: BulkResult = {
    analyzed: 0,
    fromCache: 0,
    failed: 0,
    puzzlesAdded: 0,
    gameKeys: [],
  };
  if (pgns.length === 0) return result;

  const poolSize = Math.min(3, Math.max(1, (navigator.hardwareConcurrency ?? 4) - 1));
  const pool = createPool(poolSize);
  let cancelled = false;
  const onAbort = () => {
    cancelled = true;
    pool.terminate();
  };
  opts.signal?.addEventListener("abort", onAbort);

  try {
    await Promise.all([pool.ready, ensureEcoLoaded()]);

    for (let i = 0; i < pgns.length; i++) {
      if (cancelled) break;
      const pgn = pgns[i];
      const headers = parsePgnHeaders(pgn);
      const cacheKey = hashKey(pgn, opts.depth);
      const playerSide = pickPlayerSide(headers, opts.player);

      // Cache hit
      const cached = await loadGame(cacheKey);
      if (cached) {
        result.fromCache += 1;
        result.gameKeys.push(cached.key);
        opts.onProgress?.({
          gameIndex: i,
          total: pgns.length,
          current: cached.moves.length,
          currentTotal: cached.moves.length,
          cachedHit: true,
          white: headers.white,
          black: headers.black,
        });
        result.puzzlesAdded += await feedPuzzles(cached, playerSide);
        continue;
      }

      try {
        const game = await analyzeGame(
          { kind: "pgn", pgn },
          (fen, o) => pool.analyze(fen, { depth: o.depth, multipv: o.multipv }),
          {
            depth: opts.depth,
            multipv: 2,
            concurrency: poolSize,
            isBookFen: (fen) => isBookFen(fen),
            signal: opts.signal,
            onProgress: (p) =>
              opts.onProgress?.({
                gameIndex: i,
                total: pgns.length,
                current: p.current,
                currentTotal: p.total,
                cachedHit: false,
                white: headers.white,
                black: headers.black,
              }),
          }
        );
        if (cancelled) break;
        const cachedGame: CachedGame = {
          key: cacheKey,
          pgn,
          depth: opts.depth,
          positions: game.positions,
          moves: game.moves,
          summary: game.summary,
          savedAt: Date.now(),
        };
        await saveGame(cachedGame);
        result.analyzed += 1;
        result.gameKeys.push(cacheKey);
        result.puzzlesAdded += await feedPuzzles(cachedGame, playerSide);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("bulkAnalyze: skipped a game", e);
        result.failed += 1;
      }
    }
  } finally {
    opts.signal?.removeEventListener("abort", onAbort);
    pool.terminate();
  }
  return result;
}

async function feedPuzzles(game: CachedGame, playerSide: "w" | "b" | null): Promise<number> {
  const headers = parsePgnHeaders(game.pgn);
  const white = headers.white ?? "?";
  const black = headers.black ?? "?";
  let added = 0;
  for (const m of game.moves) {
    if (!PUZZLE_CLASSES.has(m.classification)) continue;
    if (playerSide && m.color !== playerSide) continue;
    if (!m.bestMoveUci) continue;
    await upsertPuzzle(
      newPuzzleFromMistake({
        fen: m.fenBefore,
        gameKey: game.key,
        ply: m.index,
        playedSan: m.san,
        bestUci: m.bestMoveUci,
        bestSan: m.bestMoveSan,
        bestPv: m.bestPv,
        classification: m.classification as "blunder" | "mistake" | "miss",
        side: m.color,
        cpLoss: Math.round(m.cpLoss),
        white,
        black,
        // TODO: populate acceptedUcis from multipv (AnalyzedMove only retains cpSecond, not the 2nd PV's first UCI).
      })
    );
    added += 1;
  }
  return added;
}

/** chess.js sanity check that a PGN is loadable. Returns true if usable. */
export function isAnalyzablePgn(pgn: string): boolean {
  try {
    const g = new Chess();
    g.loadPgn(pgn);
    return g.history().length > 0;
  } catch {
    return false;
  }
}
