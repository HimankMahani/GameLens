/**
 * Decoder for chess.com's "TCN" (tightly compressed notation) move list.
 *
 * Each move is 2 chars from the alphabet below. First char is the source
 * square index (0=a1, 63=h8). Second char is the destination — values
 * above 63 encode a promotion (piece + diagonal offset).
 */
const TCN_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#$,./&-*++=";
const PROMOTION_PIECES = "qnrbkp";

export interface TcnMove {
  from: string;
  to: string;
  promotion?: string;
}

function squareFromIndex(i: number): string {
  return "abcdefgh"[i % 8] + String(Math.floor(i / 8) + 1);
}

export function decodeTcn(encoded: string): TcnMove[] {
  const moves: TcnMove[] = [];
  for (let i = 0; i + 1 < encoded.length; i += 2) {
    const from = TCN_ALPHABET.indexOf(encoded[i]);
    let to = TCN_ALPHABET.indexOf(encoded[i + 1]);
    if (from < 0 || to < 0) continue;
    let promotion: string | undefined;
    if (to > 63) {
      promotion = PROMOTION_PIECES[Math.floor((to - 64) / 3)];
      to = from + (from < 16 ? -8 : 8) + ((to - 64) % 3) - 1;
    }
    moves.push({ from: squareFromIndex(from), to: squareFromIndex(to), promotion });
  }
  return moves;
}
