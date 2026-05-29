/**
 * Server-side proxy for chess.com's internal game-data endpoint.
 *
 * Chess.com's callback API returns moves as TCN (tightly-compressed notation)
 * and has no CORS headers, so we can't hit it from the browser. This route
 * fetches it server-side, decodes TCN → UCI moves, and replays them through
 * chess.js to produce a SAN PGN.
 */
import { Chess } from "chess.js";
import { NextResponse } from "next/server";
import { decodeTcn } from "@/lib/chesscomTcn";

export const dynamic = "force-dynamic";

function buildPgn(headers: Record<string, string>, moves: string[]): string {
  const headerOrder = [
    "Event",
    "Site",
    "Date",
    "Round",
    "White",
    "Black",
    "Result",
    "WhiteElo",
    "BlackElo",
    "TimeControl",
    "Termination",
    "ECO",
    "Link",
  ];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const k of headerOrder) {
    if (headers[k] !== undefined) {
      lines.push(`[${k} "${String(headers[k]).replace(/"/g, "'")}"]`);
      seen.add(k);
    }
  }
  for (const [k, v] of Object.entries(headers)) {
    if (!seen.has(k)) lines.push(`[${k} "${String(v).replace(/"/g, "'")}"]`);
  }
  // Move text — keep it simple, one line per six full moves.
  const moveText: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    if (i % 2 === 0) moveText.push(`${i / 2 + 1}.`);
    moveText.push(moves[i]);
  }
  const result = headers["Result"] || "*";
  moveText.push(result);
  return lines.join("\n") + "\n\n" + moveText.join(" ") + "\n";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = (url.searchParams.get("id") || "").replace(/[^0-9]/g, "");
  const kindParam = (url.searchParams.get("kind") || "auto").toLowerCase();
  if (!id) {
    return NextResponse.json({ error: "Missing game id" }, { status: 400 });
  }

  const kindsToTry = kindParam === "live" ? ["live"] : kindParam === "daily" ? ["daily"] : ["live", "daily"];

  let lastStatus = 404;
  let lastErrorMsg = `Game ${id} not found on chess.com`;
  let data: any = null;

  for (const kind of kindsToTry) {
    const target = `https://www.chess.com/callback/${kind}/game/${id}`;
    try {
      const upstream = await fetch(target, {
        headers: {
          // chess.com's callback API rejects requests without a browser-like UA.
          "User-Agent":
            "Mozilla/5.0 (compatible; ChessAnalyzer/1.0; +https://github.com/)",
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (upstream.ok) {
        try {
          const parsedData = await upstream.json();
          if (parsedData && parsedData.game) {
            data = parsedData;
            break;
          }
        } catch {
          // ignore parsing error and let loop continue
        }
      } else {
        lastStatus = upstream.status;
        if (lastStatus === 429) {
          return NextResponse.json(
            { error: "Chess.com is rate-limiting us. Try again in a minute." },
            { status: 429 }
          );
        }
        if (lastStatus === 403) {
          lastErrorMsg = "Chess.com refused — game might be private or restricted.";
        } else {
          lastErrorMsg = `Game ${id} not found or inaccessible on chess.com (${kind})`;
        }
      }
    } catch (e) {
      lastStatus = 502;
      lastErrorMsg = "Network error contacting chess.com: " + (e instanceof Error ? e.message : String(e));
    }
  }

  if (!data || !data.game) {
    return NextResponse.json({ error: lastErrorMsg }, { status: lastStatus });
  }

  const game = data.game;
  const tcn = game["moveList"] as string | undefined;
  const headers = (game["pgnHeaders"] as Record<string, string> | undefined) ?? {};
  if (!tcn) {
    return NextResponse.json({ error: "Game payload had no moves" }, { status: 502 });
  }

  // Decode TCN to UCI moves, then replay through chess.js for SAN.
  const tcnMoves = decodeTcn(tcn);
  const board = new Chess();
  const san: string[] = [];
  for (const m of tcnMoves) {
    try {
      const played = board.move({ from: m.from, to: m.to, promotion: m.promotion });
      if (!played) break;
      san.push(played.san);
    } catch {
      break;
    }
  }

  const pgn = buildPgn(headers, san);
  return new NextResponse(pgn, {
    status: 200,
    headers: { "Content-Type": "application/x-chess-pgn; charset=utf-8" },
  });
}
