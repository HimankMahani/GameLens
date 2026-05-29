/**
 * Resolve a chess.com or Lichess game URL to its PGN.
 * Runs entirely client-side; both sites expose CORS-friendly PGN endpoints.
 */

const LICHESS_RE = /^(?:https?:\/\/)?(?:www\.)?lichess\.org\/([A-Za-z0-9]{8})(?:[\/?#].*)?$/;
const CHESSCOM_RE = /^(?:https?:\/\/)?(?:www\.)?chess\.com\/(?:game|analysis\/game)\/(live|daily)\/(\d+)\/?(?:[?#].*)?$/i;

export type PgnSource = "lichess" | "chesscom";

export interface DetectedSource {
  source: PgnSource;
  id: string;
  /** "live" or "daily" for chess.com, undefined for lichess */
  kind?: "live" | "daily";
}

export interface FetchedPgn {
  source: PgnSource;
  pgn: string;
}

/**
 * Decide if input is a game URL we should fetch. Strict: the entire trimmed
 * input must be a single-line URL. Avoids false positives from PGN headers
 * like `[Link "https://chess.com/game/live/123"]`.
 */
export function detectSource(input: string): DetectedSource | null {
  const trimmed = input.trim();
  if (/\s/.test(trimmed)) return null;
  let m = trimmed.match(LICHESS_RE);
  if (m) return { source: "lichess", id: m[1] };
  m = trimmed.match(CHESSCOM_RE);
  if (m) {
    return {
      source: "chesscom",
      kind: m[1].toLowerCase() as "live" | "daily",
      id: m[2],
    };
  }
  return null;
}

export async function fetchPgn(url: string): Promise<FetchedPgn> {
  const parsed = detectSource(url);
  if (!parsed) throw new Error("Not a chess.com or Lichess game URL");

  if (parsed.source === "lichess") {
    const res = await fetch(`https://lichess.org/game/export/${parsed.id}?clocks=0&evals=0&literate=0`, {
      headers: { Accept: "application/x-chess-pgn" },
    });
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Lichess game ${parsed.id} not found — is the URL correct?`);
      }
      if (res.status === 429) {
        throw new Error("Lichess is rate-limiting us. Try again in a minute.");
      }
      if (res.status === 403 || res.status === 401) {
        throw new Error(`Lichess refused (${res.status}) — game might be private or unrated.`);
      }
      throw new Error(`Lichess returned HTTP ${res.status}`);
    }
    return { source: "lichess", pgn: await res.text() };
  }

  // chess.com — proxied through our own /api/chesscom-pgn route, which
  // fetches their CORS-restricted callback endpoint server-side and decodes
  // the TCN-encoded move list into PGN.
  const kind = parsed.kind ?? "live";
  const res = await fetch(`/api/chesscom-pgn?id=${parsed.id}&kind=${kind}`);
  if (!res.ok) {
    let msg = `Chess.com: HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = `Chess.com: ${body.error}`;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return { source: "chesscom", pgn: await res.text() };
}

export interface PgnHeaders {
  white?: string;
  black?: string;
  whiteElo?: string;
  blackElo?: string;
  result?: string;
  date?: string;
  event?: string;
  eco?: string;
  termination?: string;
}

/**
 * Split a PGN string containing multiple games into individual game PGNs.
 * New games start at a `[Event ...]` tag that follows move text.
 */
export function splitPgnGames(pgn: string): string[] {
  const lines = pgn.split(/\r?\n/);
  const games: string[] = [];
  let current: string[] = [];
  let seenMoves = false;
  const isTag = (line: string) => /^\s*\[\w+\s+"/.test(line);

  for (const line of lines) {
    if (isTag(line) && seenMoves && current.length > 0) {
      const game = current.join("\n").trim();
      if (game) games.push(game);
      current = [];
      seenMoves = false;
    }
    if (line.trim() && !isTag(line)) seenMoves = true;
    current.push(line);
  }
  const last = current.join("\n").trim();
  if (last) games.push(last);
  return games.filter((g) => /\d+\./.test(g)); // must contain at least one move number
}

/** Parse [Tag "value"] headers out of a PGN string. */
export function parsePgnHeaders(pgn: string): PgnHeaders {
  const out: PgnHeaders = {};
  const re = /\[(\w+)\s+"([^"]*)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pgn))) {
    const k = m[1].toLowerCase();
    const v = m[2];
    if (k === "white") out.white = v;
    else if (k === "black") out.black = v;
    else if (k === "whiteelo") out.whiteElo = v;
    else if (k === "blackelo") out.blackElo = v;
    else if (k === "result") out.result = v;
    else if (k === "date") out.date = v;
    else if (k === "event") out.event = v;
    else if (k === "eco") out.eco = v;
    else if (k === "termination") out.termination = v;
  }
  return out;
}
