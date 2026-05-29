"use client";

import MT from "./monkeyThemes.json";

/**
 * Color palette per theme.
 *  - bg / subAlt / sub / text / main map to MonkeyType's standard variables.
 *  - boardLight / boardDark are derived: subAlt (lightened) / sub (darkened),
 *    chosen so the board harmonizes with the chrome.
 */
export interface ThemePalette {
  bg: string;          // page background
  subAlt: string;      // raised surface (cards, panels)
  sub: string;         // muted accent
  main: string;        // primary accent (highlights, ON pill, etc.)
  text: string;        // foreground text
  error: string;       // error / blunder
  errorExtra: string;
  boardLight: string;
  boardDark: string;
}

const RAW = MT as Record<string, Omit<ThemePalette, "boardLight" | "boardDark">>;

/**
 * Original chess-analyzer palette — zinc-based dark UI with emerald accents.
 * Kept as the default so the app looks the way it did before themes were added.
 */
const DEFAULT_PALETTE: ThemePalette = {
  bg: "#0a0a0a",          // zinc-950
  subAlt: "#18181b",      // zinc-900 (cards, panels)
  sub: "#71717a",          // zinc-500 (muted text, borders)
  main: "#10b981",         // emerald-500 (accent)
  text: "#f4f4f5",         // zinc-100 (foreground)
  error: "#ef4444",
  errorExtra: "#b91c1c",
  boardLight: "#d0d0d0",
  boardDark: "#4a4a4a",
};

/** Convert "#rrggbb" → {r,g,b}. Returns null on bad input. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "");
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return null;
  return { r, g, b };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  return rgbToHex({
    r: ra.r + (rb.r - ra.r) * t,
    g: ra.g + (rb.g - ra.g) * t,
    b: ra.b + (rb.b - ra.b) * t,
  });
}

/** Lighten toward white; n in 0..1. */
function lighten(hex: string, n: number): string {
  return mix(hex, "#ffffff", n);
}

/** Darken toward black; n in 0..1. */
function darken(hex: string, n: number): string {
  return mix(hex, "#000000", n);
}

/** Build board colors from a theme palette. */
function deriveBoardColors(p: { bg: string; subAlt: string; sub: string; main: string }): {
  boardLight: string;
  boardDark: string;
} {
  // Use subAlt as light-square base, sub as dark-square base.
  // If they're too close, fall back to bg + main blends so the board still reads.
  const light = lighten(p.subAlt, 0.25);
  const dark = darken(p.sub, 0.15);
  // Ensure enough contrast between the two squares.
  const lRgb = hexToRgb(light);
  const dRgb = hexToRgb(dark);
  if (lRgb && dRgb) {
    const lum = (c: { r: number; g: number; b: number }) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
    if (Math.abs(lum(lRgb) - lum(dRgb)) < 35) {
      // Fall back to bg + main if subAlt/sub are too similar
      return { boardLight: lighten(p.bg, 0.18), boardDark: darken(p.main, 0.45) };
    }
  }
  return { boardLight: light, boardDark: dark };
}

/** Built-in non-MonkeyType themes prepended to the picker. */
const BUILTIN_NAMES = ["default"] as const;

export const THEME_NAMES: string[] = [
  ...BUILTIN_NAMES,
  ...Object.keys(RAW).sort(),
];

export function getTheme(name: string): ThemePalette {
  if (name === "default") return DEFAULT_PALETTE;
  const t = RAW[name];
  if (!t) return DEFAULT_PALETTE;
  const board = deriveBoardColors(t);
  return {
    bg: t.bg,
    subAlt: t.subAlt,
    sub: t.sub,
    main: t.main,
    text: t.text,
    error: t.error,
    errorExtra: t.errorExtra,
    ...board,
  };
}

/** Pretty display name: "serika_dark" → "serika dark" */
export function prettyName(id: string): string {
  if (id === "default") return "default (zinc)";
  return id.replace(/_/g, " ");
}

/** Relative luminance 0–255 of a hex color. */
function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
}

/** A theme counts as "light" if its background is brighter than mid-gray. */
export function isLightTheme(id: string): boolean {
  return luminance(getTheme(id).bg) > 150;
}

/** Apply a theme as CSS custom properties on document.documentElement. */
export function applyTheme(id: string) {
  if (typeof document === "undefined") return;
  const p = getTheme(id);
  const root = document.documentElement;
  const r = root.style;
  r.setProperty("--bg", p.bg);
  r.setProperty("--sub-alt", p.subAlt);
  r.setProperty("--sub", p.sub);
  r.setProperty("--main", p.main);
  r.setProperty("--text", p.text);
  r.setProperty("--error", p.error);
  r.setProperty("--error-extra", p.errorExtra);
  r.setProperty("--board-light", p.boardLight);
  r.setProperty("--board-dark", p.boardDark);

  // Mark light themes so we can swap bright pastel colors for darker variants.
  if (luminance(p.bg) > 150) root.setAttribute("data-light-theme", "true");
  else root.removeAttribute("data-light-theme");
}

/** Default theme — original zinc/emerald palette. */
export const DEFAULT_THEME = "default";

/**
 * Legacy BOARD_THEMES export — kept for the existing BoardSettings UI but
 * now sourced from the MonkeyType palette. Each "theme" pulls light/dark
 * squares from its derived board colors.
 */
export const BOARD_THEMES = THEME_NAMES.map((id) => {
  const t = getTheme(id);
  return {
    id,
    label: prettyName(id),
    boardDark: t.boardDark,
    boardLight: t.boardLight,
  };
});
