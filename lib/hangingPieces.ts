/**
 * Identify squares where a piece is attacked and not adequately defended.
 * Heuristic: a piece is "hanging" if (attackers > defenders) using piece counts,
 * AND the cheapest attacker is worth less than the attacked piece. This catches
 * the common cases without expensive SEE-style evaluation.
 */
import { Chess, type Square, type PieceSymbol } from "chess.js";

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 1000 };

const ALL_SQUARES: Square[] = (() => {
  const out: Square[] = [];
  for (let f = 0; f < 8; f++) {
    for (let r = 1; r <= 8; r++) {
      out.push((("abcdefgh"[f] + r) as Square));
    }
  }
  return out;
})();

export function findHangingSquares(fen: string): Square[] {
  let g: Chess;
  try {
    g = new Chess(fen);
  } catch {
    return [];
  }
  const out: Square[] = [];
  for (const sq of ALL_SQUARES) {
    const piece = g.get(sq);
    if (!piece || piece.type === "k") continue;
    const enemy = piece.color === "w" ? "b" : "w";
    const attackers = g.attackers(sq, enemy);
    if (attackers.length === 0) continue;
    const defenders = g.attackers(sq, piece.color);
    if (attackers.length <= defenders.length) {
      // Even exchange potentially favorable to defender → not hanging.
      // Still flag if the cheapest attacker is strictly cheaper than the piece.
      const minAttackerVal = Math.min(
        ...attackers.map((s) => VALUE[g.get(s)!.type])
      );
      if (minAttackerVal < VALUE[piece.type]) out.push(sq);
      continue;
    }
    // More attackers than defenders → likely losing material.
    out.push(sq);
  }
  return out;
}
