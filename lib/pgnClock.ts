/**
 * Parse `[%clk H:MM:SS]` annotations from PGN move text into per-ply
 * remaining-time arrays (in seconds). Used to compute time spent on each
 * move and surface clock blunders.
 */

export interface ClockData {
  /** Per-ply remaining time at start of move, seconds. clocks[0] is white's */
  remaining: (number | null)[];
  /** Per-ply elapsed time on that move, in seconds. */
  spent: (number | null)[];
  /** Whether the PGN contained any [%clk] tags at all. */
  hasClocks: boolean;
}

/**
 * Extract clock annotations from move text. Walks through the PGN body
 * and pairs each move number with its clock comment, in play order.
 */
export function parseClocks(pgn: string, plyCount: number): ClockData {
  // Strip headers and result tokens — keep only the move text.
  const body = pgn
    .replace(/^\s*\[[^\]]*\]\s*\n?/gm, "") // headers
    .replace(/\{[^{}]*?\[%clk\s+([0-9:.]+)\][^{}]*?\}/g, "{__CLK__$1}") // normalize clk
    .replace(/\$\d+/g, "") // NAGs
    .replace(/\([^()]*\)/g, " "); // strip variations (one level)

  // Walk through tokens, picking up clk after each move-like token.
  const clocks: (number | null)[] = new Array(plyCount).fill(null);
  let plyIdx = 0;
  const tokens = body.split(/\s+/);
  for (let i = 0; i < tokens.length && plyIdx < plyCount; i++) {
    const t = tokens[i];
    if (!t) continue;
    if (/^\d+\.+$/.test(t)) continue; // move numbers
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)) continue;
    // SAN move?
    if (/^[KQRBN]?[a-h]?[1-8]?[x-]?[a-h][1-8](=[QRBN])?[+#]?$|^O-O(-O)?[+#]?$/.test(t)) {
      // Look ahead for a {__CLK__...} comment associated with this ply.
      for (let j = i + 1; j < Math.min(i + 4, tokens.length); j++) {
        const m = tokens[j].match(/\{__CLK__([0-9:.]+)/);
        if (m) {
          clocks[plyIdx] = clkToSeconds(m[1]);
          break;
        }
        if (/^[KQRBN]?[a-h]?[1-8]?[x-]?[a-h][1-8]/.test(tokens[j])) break;
      }
      plyIdx++;
    }
  }

  // Compute time spent per ply: difference between this player's previous
  // remaining time and current remaining time. Increment counts as spent
  // before increment is added; we don't have base time so we just use deltas.
  const spent: (number | null)[] = new Array(plyCount).fill(null);
  for (let i = 0; i < plyCount; i++) {
    const cur = clocks[i];
    if (cur === null) continue;
    // Find this side's previous clock (i-2)
    const prev = i >= 2 ? clocks[i - 2] : null;
    if (prev !== null) {
      const delta = prev - cur;
      // Negative would mean the player gained time (increment) — clamp to 0
      // since we don't know the increment value.
      spent[i] = delta >= 0 ? delta : 0;
    }
  }

  const hasClocks = clocks.some((c) => c !== null);
  return { remaining: clocks, spent, hasClocks };
}

function clkToSeconds(s: string): number {
  const parts = s.split(":").map((p) => parseFloat(p));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

/** Format a duration in s as a short string. "1m 02s", "47s", "3h 5m". */
export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem.toString().padStart(2, "0")}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
