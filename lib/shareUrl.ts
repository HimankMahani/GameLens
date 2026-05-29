/**
 * URL-encoded share links. Encodes PGN + depth in the URL hash so it never
 * hits the server, and decodes on page load.
 *
 * Hash format: `#g=<base64-utf8-pgn>&d=<depth>`
 */

function toBase64Utf8(s: string): string {
  // btoa requires latin-1; round-trip through TextEncoder for UTF-8 safety.
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Utf8(s: string): string {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function buildShareUrl(pgn: string, depth: number): string {
  if (typeof window === "undefined") return "";
  const origin = window.location.origin + window.location.pathname;
  return `${origin}#g=${toBase64Utf8(pgn)}&d=${depth}`;
}

export function readShareHash(): { pgn: string; depth: number } | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hash;
  if (!h.startsWith("#")) return null;
  const params = new URLSearchParams(h.slice(1));
  const g = params.get("g");
  if (!g) return null;
  try {
    const pgn = fromBase64Utf8(g);
    const d = parseInt(params.get("d") ?? "14", 10);
    return { pgn, depth: Number.isFinite(d) ? d : 14 };
  } catch {
    return null;
  }
}

export function clearShareHash() {
  if (typeof window === "undefined") return;
  history.replaceState(null, "", window.location.pathname);
}
