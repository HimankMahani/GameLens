/**
 * Fetch a user's recent games from Lichess or chess.com.
 * Both APIs are CORS-friendly so we run client-side; no proxy needed.
 */

export type Source = "lichess" | "chesscom";

export interface UserGameSummary {
  id: string;
  white: string;
  black: string;
  whiteElo?: number;
  blackElo?: number;
  result: string;
  end: number; // ms timestamp
  pgn: string;
  source: Source;
  timeControl?: string;
}

/** Lichess: PGN-only export. We split the response into individual games. */
export async function fetchLichessGames(username: string, max = 20): Promise<UserGameSummary[]> {
  const url = `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${max}&pgnInJson=false&clocks=true&evals=false&literate=false`;
  const res = await fetch(url, { headers: { Accept: "application/x-chess-pgn" } });
  if (!res.ok) {
    if (res.status === 404) throw new Error(`Lichess: no user "${username}"`);
    throw new Error(`Lichess: ${res.status}`);
  }
  const text = await res.text();
  const games: UserGameSummary[] = [];
  // Split at each blank line preceding a [Event ...] header.
  const chunks = text.split(/\n\n(?=\[Event)/g);
  for (const chunk of chunks) {
    if (!chunk.trim()) continue;
    const headers = parseHeaders(chunk);
    games.push({
      id: headers.Site?.split("/").pop() || `lichess-${games.length}`,
      white: headers.White || "?",
      black: headers.Black || "?",
      whiteElo: headers.WhiteElo ? parseInt(headers.WhiteElo, 10) : undefined,
      blackElo: headers.BlackElo ? parseInt(headers.BlackElo, 10) : undefined,
      result: headers.Result || "*",
      end: headers.UTCDate ? Date.parse(`${headers.UTCDate.replace(/\./g, "-")}T${headers.UTCTime || "00:00:00"}Z`) || 0 : 0,
      pgn: chunk.trim(),
      source: "lichess",
      timeControl: headers.TimeControl,
    });
  }
  return games;
}

/**
 * Chess.com: month-by-month archive. We grab the most recent month and
 * (if needed) the previous one to get up to `max` games.
 */
export async function fetchChesscomGames(username: string, max = 20): Promise<UserGameSummary[]> {
  const archivesRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(username)}/games/archives`, {
    headers: { Accept: "application/json" },
  });
  if (!archivesRes.ok) {
    if (archivesRes.status === 404) throw new Error(`Chess.com: no user "${username}"`);
    throw new Error(`Chess.com: ${archivesRes.status}`);
  }
  const { archives = [] } = (await archivesRes.json()) as { archives: string[] };
  if (archives.length === 0) return [];

  const out: UserGameSummary[] = [];
  for (let i = archives.length - 1; i >= 0 && out.length < max; i--) {
    const monthRes = await fetch(archives[i], { headers: { Accept: "application/json" } });
    if (!monthRes.ok) continue;
    const { games = [] } = (await monthRes.json()) as { games: ChesscomGame[] };
    for (let j = games.length - 1; j >= 0 && out.length < max; j--) {
      const g = games[j];
      if (!g.pgn) continue;
      out.push({
        id: g.uuid || g.url || `cc-${out.length}`,
        white: g.white?.username || "?",
        black: g.black?.username || "?",
        whiteElo: g.white?.rating,
        blackElo: g.black?.rating,
        result:
          g.white?.result === "win" ? "1-0" : g.black?.result === "win" ? "0-1" : "1/2-1/2",
        end: (g.end_time ?? 0) * 1000,
        pgn: g.pgn,
        source: "chesscom",
        timeControl: g.time_control,
      });
    }
  }
  return out.sort((a, b) => b.end - a.end).slice(0, max);
}

interface ChesscomGame {
  uuid?: string;
  url?: string;
  pgn?: string;
  end_time?: number;
  time_control?: string;
  white?: { username?: string; rating?: number; result?: string };
  black?: { username?: string; rating?: number; result?: string };
}

function parseHeaders(pgn: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /\[(\w+)\s+"([^"]*)"\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pgn))) out[m[1]] = m[2];
  return out;
}
