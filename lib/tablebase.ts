/**
 * Lichess Syzygy tablebase wrapper.
 *
 * Free, CORS-friendly endpoint that returns perfect-play info for any standard
 * position with ≤ 7 pieces (kings included). We hit it directly from the
 * browser, cache the result by FEN, and expose a small React-friendly loader.
 */

const ENDPOINT = "https://tablebase.lichess.ovh/standard";
const CACHE_LIMIT = 256;
const FETCH_TIMEOUT_MS = 5000;

/**
 * Fetch with a hard timeout. Aborts the request after `ms` milliseconds, and
 * also forwards an externally-provided abort signal so callers can cancel
 * (e.g. when the hook unmounts or the FEN changes).
 */
async function fetchWithTimeout(
  url: string,
  ms: number,
  external?: AbortSignal
): Promise<Response> {
  const ctl = new AbortController();
  const onExternalAbort = () => ctl.abort();
  if (external) {
    if (external.aborted) ctl.abort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { signal: ctl.signal });
  } finally {
    clearTimeout(t);
    if (external) external.removeEventListener("abort", onExternalAbort);
  }
}

export type TbCategory =
  | "win"
  | "cursed-win"
  | "maybe-win"
  | "draw"
  | "blessed-loss"
  | "maybe-loss"
  | "loss"
  | "unknown";

export interface TbMove {
  uci: string;
  san: string;
  category: TbCategory;
  dtz: number | null;
  dtm: number | null;
  zeroing: boolean;
  checkmate: boolean;
  stalemate: boolean;
}

export interface TbResult {
  category: TbCategory;
  dtz: number | null;
  dtm: number | null;
  checkmate: boolean;
  stalemate: boolean;
  moves: TbMove[];
}

const cache = new Map<string, TbResult>();

/** Count non-empty squares in a FEN's piece field. */
export function pieceCount(fen: string): number {
  const board = fen.split(" ")[0] ?? "";
  let n = 0;
  for (const c of board) {
    if (c === "/") continue;
    if (/[1-8]/.test(c)) continue;
    n++;
  }
  return n;
}

/** True if the position has few enough pieces to query the tablebase. */
export function isTablebaseEligible(fen: string): boolean {
  return pieceCount(fen) <= 7;
}

interface RawMove {
  uci: string;
  san: string;
  category: TbCategory;
  dtz: number | null;
  dtm: number | null;
  zeroing?: boolean;
  checkmate?: boolean;
  stalemate?: boolean;
}

interface RawResponse {
  category: TbCategory;
  dtz: number | null;
  dtm: number | null;
  checkmate?: boolean;
  stalemate?: boolean;
  moves?: RawMove[];
}

export async function queryTablebase(
  fen: string,
  signal?: AbortSignal
): Promise<TbResult | null> {
  if (!isTablebaseEligible(fen)) return null;
  const cached = cache.get(fen);
  if (cached) return cached;

  const url = `${ENDPOINT}?fen=${encodeURIComponent(fen)}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, signal);
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let data: RawResponse;
  try {
    data = (await res.json()) as RawResponse;
  } catch {
    return null;
  }

  const result: TbResult = {
    category: data.category ?? "unknown",
    dtz: data.dtz ?? null,
    dtm: data.dtm ?? null,
    checkmate: !!data.checkmate,
    stalemate: !!data.stalemate,
    moves: (data.moves ?? []).map((m) => ({
      uci: m.uci,
      san: m.san,
      category: m.category ?? "unknown",
      dtz: m.dtz ?? null,
      dtm: m.dtm ?? null,
      zeroing: !!m.zeroing,
      checkmate: !!m.checkmate,
      stalemate: !!m.stalemate,
    })),
  };

  if (cache.size >= CACHE_LIMIT) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(fen, result);
  return result;
}

export const CATEGORY_LABEL: Record<TbCategory, string> = {
  win: "Winning",
  "cursed-win": "Cursed win (50-move rule)",
  "maybe-win": "Maybe winning",
  draw: "Drawn",
  "blessed-loss": "Blessed loss (50-move rule)",
  "maybe-loss": "Maybe losing",
  loss: "Losing",
  unknown: "Unknown",
};

export const CATEGORY_TONE: Record<TbCategory, string> = {
  win: "text-emerald-300",
  "cursed-win": "text-emerald-400/80",
  "maybe-win": "text-emerald-400/60",
  draw: "text-zinc-300",
  "blessed-loss": "text-orange-400/80",
  "maybe-loss": "text-orange-400/60",
  loss: "text-red-400",
  unknown: "text-muted",
};
