/**
 * Build an annotated PGN from analysis results.
 *  - NAGs ($1=!, $2=?, $3=!!, $4=??, $5=!?, $6=?!) on each classified move
 *  - {[%eval x.xx]} comments with the engine's white-POV evaluation
 *  - {user notes} after a move if present
 *  - Includes the analyzer's preferred PGN header set
 */
import type { AnalyzedMove, MoveClassification } from "@/lib/analysis";
import type { PgnHeaders } from "@/lib/pgnFetch";

const NAG: Partial<Record<MoveClassification, string>> = {
  brilliant: "$3", // !!
  great: "$1",     // !
  best: "$14",     // = better
  inaccuracy: "$6",// ?!
  mistake: "$2",   // ?
  blunder: "$4",   // ??
  miss: "$2",
  // book / good / excellent / forced — no NAG
};

function fmtEval(cp: number, mate: number | null): string {
  if (mate !== null) return `${mate >= 0 ? "" : "-"}#${Math.abs(mate)}`;
  return (cp / 100).toFixed(2);
}

/**
 * @param moves Per-ply analysis. moves[i].index is 1-based ply count.
 * @param annotations Map from ply → user note text.
 * @param headers PGN headers to emit at the top.
 * @param result PGN result string ("1-0" / "0-1" / "1/2-1/2" / "*").
 */
export function buildAnnotatedPgn(
  moves: AnalyzedMove[],
  annotations: Record<number, string>,
  headers: PgnHeaders | null,
  result = "*"
): string {
  const h = headers || {};
  const headerLines = [
    `[Event "${h.event ?? "Analysis"}"]`,
    `[Site "Chess Analyzer"]`,
    `[Date "${h.date ?? "????.??.??"}"]`,
    `[Round "?"]`,
    `[White "${h.white ?? "White"}"]`,
    `[Black "${h.black ?? "Black"}"]`,
    `[Result "${h.result ?? result}"]`,
  ];
  if (h.whiteElo) headerLines.push(`[WhiteElo "${h.whiteElo}"]`);
  if (h.blackElo) headerLines.push(`[BlackElo "${h.blackElo}"]`);
  if (h.eco) headerLines.push(`[ECO "${h.eco}"]`);
  if (h.termination) headerLines.push(`[Termination "${h.termination}"]`);
  headerLines.push("");

  const body: string[] = [];
  for (const m of moves) {
    const moveNum = Math.ceil(m.index / 2);
    const isWhite = m.color === "w";
    if (isWhite) body.push(`${moveNum}.`);
    body.push(m.san);
    const nag = NAG[m.classification];
    if (nag) body.push(nag);

    // Comment: eval (always), best alternative if not best, user note if any.
    const parts: string[] = [];
    parts.push(`[%eval ${fmtEval(m.cpAfter, m.mateAfter)}]`);
    if (
      m.bestMoveSan &&
      m.bestMoveUci !== m.uci &&
      (m.classification === "blunder" || m.classification === "mistake" || m.classification === "inaccuracy" || m.classification === "miss")
    ) {
      parts.push(`better was ${m.bestMoveSan}`);
    }
    const note = annotations[m.index];
    if (note) parts.push(note.replace(/[{}]/g, ""));
    body.push(`{ ${parts.join(" ")} }`);
  }
  body.push(h.result ?? result);

  return headerLines.join("\n") + "\n" + wrap(body.join(" "), 80) + "\n";
}

function wrap(text: string, width: number): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length + w.length + 1 > width) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + " " + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.join("\n");
}
