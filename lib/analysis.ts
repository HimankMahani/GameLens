import { Chess, Move } from "chess.js";
import { AnalysisResult } from "@/hooks/useStockfish";

export type MoveClassification =
  | "brilliant"
  | "great"
  | "best"
  | "excellent"
  | "good"
  | "book"
  | "inaccuracy"
  | "mistake"
  | "blunder"
  | "miss"
  | "forced";

export interface AnalyzedMove {
  /** ply index, 1-based (matches positions[index]) */
  index: number;
  san: string;
  uci: string;
  color: "w" | "b";
  fenBefore: string;
  fenAfter: string;
  /** centipawns from white's POV before move */
  cpBefore: number;
  /** centipawns from white's POV after move */
  cpAfter: number;
  /** mate in N before / after, white POV */
  mateBefore: number | null;
  mateAfter: number | null;
  /** engine's best move at fenBefore (UCI) */
  bestMoveUci: string;
  /** engine's best move SAN if computable */
  bestMoveSan: string | null;
  /** PV after engine's recommended move (UCI) */
  bestPv: string[];
  /** Eval if best move had been played, white POV */
  cpBest: number;
  /** win probability % from moving side's POV — before */
  winPctBefore: number;
  /** win probability % from moving side's POV — after the played move */
  winPctAfter: number;
  /** loss in win-% from moving side's POV (positive = bad) */
  winPctLoss: number;
  /** centipawn loss vs best, side-to-move POV */
  cpLoss: number;
  classification: MoveClassification;
  isBookMove: boolean;
}

export interface GameSummary {
  white: SideSummary;
  black: SideSummary;
  totalMoves: number;
}

export interface SideSummary {
  /** 0-100 chess.com-style accuracy */
  accuracy: number;
  /** Average centipawn loss */
  acpl: number;
  counts: Record<MoveClassification, number>;
}

const ALL_CLASSES: MoveClassification[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "blunder",
  "miss",
  "forced",
];

/** Lichess-style win-percentage from centipawns (POV of side to move). */
export function winPctFromCp(cp: number): number {
  // Clamp huge values from forced mates
  const clamped = Math.max(-2000, Math.min(2000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

/** Convert white-POV cp to side-to-move POV. */
export function cpStm(cpWhite: number, side: "w" | "b"): number {
  return side === "w" ? cpWhite : -cpWhite;
}

function cpFromAnalysis(r: AnalysisResult): { cp: number; mate: number | null } {
  return { cp: r.best.cp, mate: r.best.mate };
}

interface ClassifyInput {
  side: "w" | "b";
  cpBefore: number;
  cpAfter: number;
  cpBest: number;
  /** Eval (white POV) of the engine's 2nd-best alternative at fenBefore, if known. */
  cpSecond: number | null;
  mateBefore: number | null;
  mateAfter: number | null;
  isOnlyMove: boolean;
  isSacrifice: boolean;
  isBookMove: boolean;
  matchesBest: boolean;
}

export function classify(input: ClassifyInput): MoveClassification {
  const { side, cpBefore, cpAfter, cpBest, cpSecond, isOnlyMove, isSacrifice, isBookMove, matchesBest } = input;

  if (isBookMove) return "book";

  // Forced/only move: either the position legally has one move, OR the
  // engine's top line is ≥300cp better than the next-best line (so any
  // other choice is catastrophic).
  if (isOnlyMove) return "forced";
  if (matchesBest && cpSecond !== null) {
    const bestStm = cpStm(cpBest, side);
    const secondStm = cpStm(cpSecond, side);
    if (bestStm - secondStm >= 300) return "forced";
  }

  const winBefore = winPctFromCp(cpStm(cpBefore, side));
  const winAfter = winPctFromCp(cpStm(cpAfter, side));
  const winLoss = Math.max(0, winBefore - winAfter);

  // Brilliant: a real sacrifice that's still the best move, played from a
  // non-losing position. The `isSacrifice` heuristic already requires the
  // piece value to be ≥3 and net material loss ≥2 pawns — see
  // isSacrificeMove below.
  if (matchesBest && isSacrifice && winBefore > 30 && winLoss < 5) {
    return "brilliant";
  }

  // Great: matches best AND the 2nd-best line is significantly worse
  // (at least 100cp gap in side-to-move POV). This is the proper definition
  // — there was a real choice and the player found the only good move.
  if (matchesBest && cpSecond !== null) {
    const bestStm = cpStm(cpBest, side);
    const secondStm = cpStm(cpSecond, side);
    const gap = bestStm - secondStm;
    // Only flag when the gap meaningfully changes evaluation
    // and we weren't in a totally one-sided position already.
    if (gap >= 100 && Math.abs(bestStm) < 600) {
      return "great";
    }
  }

  // Miss: opponent had been winning OR you were winning and now you've
  // squandered the win — i.e. a major drop while the position was winning.
  if (winBefore >= 75 && winAfter < 55) return "miss";

  // Blunder/Mistake/Inaccuracy thresholds (chess.com-ish, in win-% loss).
  if (winLoss >= 20) return "blunder";
  if (winLoss >= 10) return "mistake";
  if (winLoss >= 5) return "inaccuracy";

  if (matchesBest) return "best";
  if (winLoss <= 1) return "excellent";
  return "good";
}

/**
 * Heuristic: was this move a real sacrifice?
 *  - Moved piece is at least a minor (not a pawn).
 *  - After the move, the destination square is attacked by the opponent.
 *    (A piece moved to an unattacked square isn't a sacrifice, even if you
 *    didn't capture anything — it's just development.)
 *  - The would-be net material exchange (if the opponent simply captures)
 *    loses ≥2 pawns of value.
 */
function isSacrificeMove(fenBefore: string, move: Move): boolean {
  const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const piece = move.piece.toLowerCase();
  const pieceValue = VAL[piece] ?? 0;
  if (pieceValue < 3) return false;

  const tmp = new Chess(fenBefore);
  try {
    tmp.move({ from: move.from, to: move.to, promotion: move.promotion });
  } catch {
    return false;
  }

  // Did the opponent attack the destination square?
  const attackers = tmp.attackers(move.to, tmp.turn());
  if (attackers.length === 0) return false;

  // Value the moving side put on the square minus what they captured.
  // If opponent takes, net loss = pieceValue − capturedValue
  // (ignoring further recapture sequences for simplicity).
  const captured = move.captured ? VAL[move.captured.toLowerCase()] ?? 0 : 0;
  const netLoss = pieceValue - captured;
  return netLoss >= 2;
}


/** Compute per-side accuracy (Lichess-style) from a list of analyzed moves. */
export function computeSummary(moves: AnalyzedMove[]): GameSummary {
  const init = (): SideSummary => ({
    accuracy: 100,
    acpl: 0,
    counts: ALL_CLASSES.reduce(
      (acc, c) => ({ ...acc, [c]: 0 }),
      {} as Record<MoveClassification, number>
    ),
  });
  const white = init();
  const black = init();

  const wAcc: number[] = [];
  const bAcc: number[] = [];
  const wLoss: number[] = [];
  const bLoss: number[] = [];

  for (const m of moves) {
    const target = m.color === "w" ? white : black;
    target.counts[m.classification] += 1;

    const moveAccuracy = movePctAccuracy(m.winPctBefore, m.winPctAfter);
    if (m.color === "w") {
      wAcc.push(moveAccuracy);
      wLoss.push(Math.max(0, m.cpLoss));
    } else {
      bAcc.push(moveAccuracy);
      bLoss.push(Math.max(0, m.cpLoss));
    }
  }

  white.accuracy = average(wAcc);
  black.accuracy = average(bAcc);
  white.acpl = Math.round(average(wLoss));
  black.acpl = Math.round(average(bLoss));

  return { white, black, totalMoves: moves.length };
}

/** Lichess move-accuracy formula: depends on win% delta (from moving side's POV). */
function movePctAccuracy(winBefore: number, winAfter: number): number {
  const delta = Math.max(0, winBefore - winAfter);
  // Lichess formula: 103.1668 * exp(-0.04354 * delta) - 3.1669
  const acc = 103.1668 * Math.exp(-0.04354 * delta) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

function average(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export interface AnalyzeProgress {
  current: number;
  total: number;
  fen: string;
}

export interface AnalyzeOptions {
  depth?: number;
  multipv?: number;
  /** Max in-flight evaluations. Pool callers should match this to worker count. */
  concurrency?: number;
  onProgress?: (p: AnalyzeProgress) => void;
  /** opening detector: returns name for a fen+ply, or null if not in book */
  isBookFen?: (fen: string, ply: number) => boolean;
  signal?: AbortSignal;
}

/**
 * Walk every position in the PGN and produce per-move analysis.
 * Engine evaluations are taken at fenBefore (best move + cpBefore)
 * and reused as cpAfter for the next move (Stockfish's eval after we
 * play move N is identical to its eval at fen of position N+1).
 */
export async function analyzeGame(
  pgnOrPositions:
    | { kind: "pgn"; pgn: string }
    | { kind: "positions"; fens: string[]; moves: Move[] },
  analyzePosition: (
    fen: string,
    opts: { depth: number; multipv: number }
  ) => Promise<AnalysisResult>,
  options: AnalyzeOptions = {}
): Promise<{ moves: AnalyzedMove[]; positions: { fen: string; move: Move | null }[]; summary: GameSummary }> {
  const depth = options.depth ?? 14;
  const multipv = options.multipv ?? 2;
  let fens: string[];
  let moves: Move[];
  if (pgnOrPositions.kind === "pgn") {
    const g = new Chess();
    g.loadPgn(pgnOrPositions.pgn, { strict: false });
    moves = g.history({ verbose: true }) as Move[];
    fens = [];
    const r = new Chess();
    fens.push(r.fen());
    for (const m of moves) {
      r.move(m);
      fens.push(r.fen());
    }
  } else {
    fens = pgnOrPositions.fens;
    moves = pgnOrPositions.moves;
  }

  // Determine which positions are still in the opening book — those get
  // skipped by Stockfish (huge speedup for the early game).
  const inBook: boolean[] = fens.map((f, i) => !!options.isBookFen?.(f, i));
  // We still need an eval on the *transition* position (last book ply +
  // its successor) so cpAfter for the last book move is meaningful. So a
  // position is "skippable" only if both it and its predecessor are book.
  const skip: boolean[] = fens.map((_, i) => inBook[i] && (i === 0 || inBook[i - 1]));

  type Eval = {
    cp: number;
    mate: number | null;
    cpSecond: number | null;
    bestMove: string;
    bestPv: string[];
  };
  const evals: Eval[] = new Array(fens.length);
  let done = 0;
  const total = fens.length;
  const concurrency = Math.max(1, options.concurrency ?? 1);

  const evalOne = async (i: number): Promise<void> => {
    if (skip[i]) {
      evals[i] = { cp: 0, mate: null, cpSecond: null, bestMove: "", bestPv: [] };
      return;
    }
    try {
      const res = await analyzePosition(fens[i], { depth, multipv });
      const { cp, mate } = cpFromAnalysis(res);
      const second = res.lines.find((l) => l.pvNum === 2) ?? null;
      evals[i] = {
        cp,
        mate,
        cpSecond: second ? second.cp : null,
        bestMove: res.bestMove,
        bestPv: res.best.pv,
      };
    } catch {
      const term = new Chess(fens[i]);
      const stm = term.turn();
      let cp = 0;
      let mate: number | null = null;
      if (term.isCheckmate()) {
        cp = stm === "w" ? -100000 : 100000;
        mate = 0;
      }
      evals[i] = { cp, mate, cpSecond: null, bestMove: "(none)", bestPv: [] };
    }
  };

  // Fire `concurrency` workers; each pulls the next index off a shared cursor.
  let cursor = 0;
  options.onProgress?.({ current: 0, total, fen: fens[0] });
  const workers: Promise<void>[] = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(
      (async () => {
        while (true) {
          if (options.signal?.aborted) throw new DOMException("aborted", "AbortError");
          const i = cursor++;
          if (i >= fens.length) return;
          await evalOne(i);
          done++;
          options.onProgress?.({ current: done, total, fen: fens[i] });
        }
      })()
    );
  }
  await Promise.all(workers);
  options.onProgress?.({ current: fens.length, total: fens.length, fen: fens[fens.length - 1] });

  // Build AnalyzedMove[] from consecutive evals.
  const out: AnalyzedMove[] = [];
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const fenBefore = fens[i];
    const fenAfter = fens[i + 1];
    const evBefore = evals[i];
    const evAfter = evals[i + 1];
    const side = move.color;
    const cpBefore = evBefore.cp;
    const cpAfter = evAfter.cp;
    // If we played the engine's top move, cpBest === cpAfter.
    // Otherwise we use cpBefore (best line's expected eval — the engine
    // already calculated PV from fenBefore which should equal what cp
    // would be if best move was played).
    const matchesBest = move.lan === evBefore.bestMove || move.from + move.to === evBefore.bestMove.slice(0, 4);
    const cpBest = matchesBest ? cpAfter : cpBefore; // engine's eval from fenBefore == eval-after-best-move
    const cpLoss = Math.max(0, cpStm(cpBest, side) - cpStm(cpAfter, side));

    const winPctBefore = winPctFromCp(cpStm(cpBefore, side));
    const winPctAfter = winPctFromCp(cpStm(cpAfter, side));
    const winPctLoss = Math.max(0, winPctBefore - winPctAfter);

    // "Only move" heuristic: engine has only 1 PV that's much better than
    // alternatives — we don't have alt scores easily here, so approximate
    // via legal-move count == 1.
    let isOnlyMove = false;
    try {
      const tmp = new Chess(fenBefore);
      isOnlyMove = tmp.moves().length === 1;
    } catch {
      /* ignore */
    }

    const isSacrifice = isSacrificeMove(fenBefore, move);
    const isBookMove = options.isBookFen?.(fenBefore, i) ?? false;

    const classification = classify({
      side,
      cpBefore,
      cpAfter,
      cpBest,
      cpSecond: evBefore.cpSecond,
      mateBefore: evBefore.mate,
      mateAfter: evAfter.mate,
      isOnlyMove,
      isSacrifice,
      isBookMove,
      matchesBest,
    });

    let bestMoveSan: string | null = null;
    try {
      const tmp = new Chess(fenBefore);
      const uci = evBefore.bestMove;
      if (uci && uci !== "(none)") {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promo = uci.length > 4 ? uci.slice(4, 5) : undefined;
        const m = tmp.move({ from, to, promotion: promo });
        if (m) bestMoveSan = m.san;
      }
    } catch {
      /* ignore */
    }

    out.push({
      index: i + 1,
      san: move.san,
      uci: move.lan,
      color: side,
      fenBefore,
      fenAfter,
      cpBefore,
      cpAfter,
      mateBefore: evBefore.mate,
      mateAfter: evAfter.mate,
      bestMoveUci: evBefore.bestMove,
      bestMoveSan,
      bestPv: evBefore.bestPv,
      cpBest,
      winPctBefore,
      winPctAfter,
      winPctLoss,
      cpLoss,
      classification,
      isBookMove,
    });
  }

  const summary = computeSummary(out);
  const positions: { fen: string; move: Move | null }[] = [{ fen: fens[0], move: null }];
  for (let i = 0; i < moves.length; i++) {
    positions.push({ fen: fens[i + 1], move: moves[i] });
  }

  return { moves: out, positions, summary };
}
