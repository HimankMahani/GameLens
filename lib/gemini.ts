/**
 * Browser-side wrapper around Google's Generative Language API (Gemini).
 *
 * The API key is supplied by the user, kept in localStorage, and sent as a
 * URL query parameter on requests directly to generativelanguage.googleapis.com.
 * Nothing transits our own server — we never see the key.
 */

const KEY_STORAGE_KEY = "chess-analyzer.gemini-key";
const MODEL_STORAGE_KEY = "chess-analyzer.gemini-model";
const ENABLED_STORAGE_KEY = "chess-analyzer.gemini-enabled";
const DEFAULT_MODEL = "gemini-2.5-flash";

export const GEMINI_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (recommended)" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro (slower, stronger)" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
] as const;

export interface GeminiSettings {
  key: string;
  model: string;
  enabled: boolean;
}

export function loadGeminiSettings(): GeminiSettings {
  if (typeof localStorage === "undefined") {
    return { key: "", model: DEFAULT_MODEL, enabled: false };
  }
  return {
    key: localStorage.getItem(KEY_STORAGE_KEY) ?? "",
    model: localStorage.getItem(MODEL_STORAGE_KEY) ?? DEFAULT_MODEL,
    enabled: localStorage.getItem(ENABLED_STORAGE_KEY) === "1",
  };
}

export function saveGeminiSettings(s: GeminiSettings): void {
  if (typeof localStorage === "undefined") return;
  if (s.key) localStorage.setItem(KEY_STORAGE_KEY, s.key);
  else localStorage.removeItem(KEY_STORAGE_KEY);
  localStorage.setItem(MODEL_STORAGE_KEY, s.model || DEFAULT_MODEL);
  localStorage.setItem(ENABLED_STORAGE_KEY, s.enabled ? "1" : "0");
}

export function clearGeminiKey(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY_STORAGE_KEY);
  localStorage.setItem(ENABLED_STORAGE_KEY, "0");
}

export interface CoachInput {
  /** SAN of the move that was actually played. */
  playedSan: string;
  /** SAN of the engine's recommendation, if known. */
  bestSan: string | null;
  /** Move classification name (e.g. "Blunder"). */
  classification: string;
  /** Side that just moved. */
  side: "White" | "Black";
  /** Eval before the move, white POV, in pawns. */
  evalBefore: string;
  /** Eval after the move, white POV, in pawns. */
  evalAfter: string;
  /** Eval if best had been played, white POV, in pawns. */
  evalIfBest: string;
  /** Centipawn loss vs best, side-to-move POV. */
  cpLoss: number;
  /** FEN immediately before the played move. */
  fenBefore: string;
  /** Up to 5 plies of engine principal variation in SAN/UCI mix. */
  bestPv: string[];
  /** Detected opening name when known. */
  opening?: string;
}

const SYSTEM_PROMPT = `You are a friendly chess coach. Given a position, the move that was played, the engine's recommendation, and the evaluation swing, explain in 2-4 short sentences:
1. What the played move is doing wrong (or right) in concrete terms — pieces, squares, threats.
2. What the engine's move accomplishes that the played move missed.
Use plain language a club player understands. Avoid hedging. Don't list candidate moves the user didn't ask about. Don't restate the eval numbers — interpret them.`;

function buildPrompt(input: CoachInput): string {
  const lines: string[] = [];
  lines.push(`Side to move: ${input.side}`);
  if (input.opening) lines.push(`Opening: ${input.opening}`);
  lines.push(`FEN: ${input.fenBefore}`);
  lines.push(`Played: ${input.playedSan}  (classification: ${input.classification})`);
  if (input.bestSan) {
    lines.push(`Engine best: ${input.bestSan}`);
    if (input.bestPv.length > 1) {
      lines.push(`Engine line: ${input.bestPv.slice(0, 5).join(" ")}`);
    }
  }
  lines.push(
    `Eval before: ${input.evalBefore}  → after played: ${input.evalAfter}  (if best had been played: ${input.evalIfBest})`
  );
  lines.push(`Centipawn loss vs best (side-to-move POV): ${input.cpLoss}`);
  lines.push("");
  lines.push("Explain why the played move is rated this way and what the better move accomplishes.");
  return lines.join("\n");
}

export type GeminiErrorKind = "key" | "rate_limit" | "server" | "network" | "blocked" | "unknown";

export class GeminiError extends Error {
  kind: GeminiErrorKind;
  retryable: boolean;
  status?: number;
  details?: string;
  constructor(
    message: string,
    kind: GeminiErrorKind,
    retryable: boolean,
    opts?: { status?: number; details?: string }
  ) {
    super(message);
    this.name = "GeminiError";
    this.kind = kind;
    this.retryable = retryable;
    this.status = opts?.status;
    this.details = opts?.details;
  }
}

function geminiErrorFromStatus(status: number, apiMessage?: string): GeminiError {
  if (status === 400 || status === 401 || status === 403) {
    return new GeminiError(
      "Your Gemini API key looks invalid — check it in Settings.",
      "key",
      false,
      { status, details: apiMessage }
    );
  }
  if (status === 429) {
    return new GeminiError(
      "Gemini rate limit hit — try again in a moment.",
      "rate_limit",
      true,
      { status, details: apiMessage }
    );
  }
  if (status >= 500) {
    return new GeminiError(
      "Gemini is having trouble — try again.",
      "server",
      true,
      { status, details: apiMessage }
    );
  }
  return new GeminiError(
    apiMessage || `HTTP ${status}`,
    "unknown",
    false,
    { status, details: apiMessage }
  );
}

// Simple LRU response cache. Keyed by `${model}|${fenBefore}|${playedSan}`.
const RESPONSE_CACHE_LIMIT = 64;
const responseCache = new Map<string, string>();

function cacheKey(model: string, fenBefore: string, playedSan: string): string {
  return `${model}|${fenBefore}|${playedSan}`;
}

function cacheGet(key: string): string | undefined {
  const hit = responseCache.get(key);
  if (hit === undefined) return undefined;
  // Move-to-front: delete + reinsert keeps Map insertion order in LRU shape.
  responseCache.delete(key);
  responseCache.set(key, hit);
  return hit;
}

function cacheSet(key: string, value: string): void {
  if (responseCache.has(key)) responseCache.delete(key);
  else if (responseCache.size >= RESPONSE_CACHE_LIMIT) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey !== undefined) responseCache.delete(firstKey);
  }
  responseCache.set(key, value);
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; code?: number; status?: string };
}

export interface ExplainMoveOptions {
  signal?: AbortSignal;
  /** When true, ignore any cached response for this (model, fen, played) tuple. */
  bypassCache?: boolean;
}

export async function explainMove(
  input: CoachInput,
  settings: GeminiSettings,
  options: ExplainMoveOptions = {}
): Promise<string> {
  if (!settings.key) {
    throw new GeminiError(
      "Add your Gemini API key in Settings to use the Why coach.",
      "key",
      false
    );
  }
  const model = settings.model || DEFAULT_MODEL;
  const key = cacheKey(model, input.fenBefore, input.playedSan);
  if (!options.bypassCache) {
    const hit = cacheGet(key);
    if (hit !== undefined) return hit;
  }

  const text = await generateContent(buildPrompt(input), settings, {
    signal: options.signal,
    systemPrompt: SYSTEM_PROMPT,
    temperature: 0.4,
    topP: 0.9,
    maxOutputTokens: 320,
  });
  cacheSet(key, text);
  return text;
}

interface GenerateContentOptions {
  signal?: AbortSignal;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
}

/**
 * Low-level wrapper around `generateContent`. Throws a friendly `GeminiError`
 * on failure. Used by `explainMove` and `validateGeminiKey`.
 */
export async function generateContent(
  prompt: string,
  settings: GeminiSettings,
  options: GenerateContentOptions = {}
): Promise<string> {
  if (!settings.key) {
    throw new GeminiError(
      "Add your Gemini API key in Settings to use the Why coach.",
      "key",
      false
    );
  }
  const model = settings.model || DEFAULT_MODEL;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(settings.key)}`;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      topP: options.topP ?? 0.9,
      maxOutputTokens: options.maxOutputTokens ?? 320,
    },
  };
  if (options.systemPrompt) {
    body.systemInstruction = { role: "system", parts: [{ text: options.systemPrompt }] };
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // fetch throws TypeError on network failure.
    throw new GeminiError(
      "Network error — check your connection.",
      "network",
      true,
      { details: e instanceof Error ? e.message : String(e) }
    );
  }

  let parsed: GeminiResponse;
  try {
    parsed = (await res.json()) as GeminiResponse;
  } catch {
    if (!res.ok) throw geminiErrorFromStatus(res.status);
    throw new GeminiError(
      `Gemini returned non-JSON (HTTP ${res.status})`,
      "unknown",
      false,
      { status: res.status }
    );
  }

  if (!res.ok) {
    throw geminiErrorFromStatus(res.status, parsed.error?.message);
  }
  if (parsed.promptFeedback?.blockReason) {
    throw new GeminiError(
      "Gemini blocked the response — try a different move.",
      "blocked",
      false,
      { details: parsed.promptFeedback.blockReason }
    );
  }
  const finishReason = parsed.candidates?.[0]?.finishReason;
  if (finishReason === "SAFETY") {
    throw new GeminiError(
      "Gemini blocked the response — try a different move.",
      "blocked",
      false,
      { details: finishReason }
    );
  }
  const text = parsed.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!text) {
    throw new GeminiError("Gemini returned no text.", "unknown", false);
  }
  return text;
}

/**
 * Cheap probe to confirm a key works. Returns a discriminated result rather
 * than throwing so callers can render inline UI without a try/catch.
 */
export async function validateGeminiKey(
  key: string,
  model?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = key.trim();
  if (!trimmed) return { ok: false, error: "Enter an API key first." };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8_000);
  try {
    await generateContent(
      "Hi",
      { key: trimmed, model: model || DEFAULT_MODEL, enabled: true },
      { signal: ctl.signal, maxOutputTokens: 8, temperature: 0 }
    );
    return { ok: true };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, error: "Test timed out — check your connection." };
    }
    if (e instanceof GeminiError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}
