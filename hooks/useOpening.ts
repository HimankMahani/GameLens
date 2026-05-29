"use client";

import { useEffect, useState } from "react";

type EcoEntry = { name: string; eco: string };
type EcoTable = Record<string, EcoEntry>;

let TABLE: EcoTable | null = null;
let loading: Promise<EcoTable> | null = null;

/** Lazily import the 473KB ECO json on first need. */
export async function loadEcoTable(): Promise<EcoTable> {
  if (TABLE) return TABLE;
  if (!loading) {
    loading = import("@/lib/eco.json").then((m) => {
      TABLE = m.default as EcoTable;
      return TABLE;
    });
  }
  return loading;
}

/** Key uses board+stm+castling; drops en-passant and clocks for stability. */
function key(fen: string): string {
  return fen.split(" ").slice(0, 3).join(" ");
}

/**
 * Synchronous book check. Returns false until the table has been loaded.
 * Call ensureEcoLoaded() once before relying on this in a hot loop.
 */
export function isBookFen(fen: string): boolean {
  if (!TABLE) return false;
  return key(fen) in TABLE;
}

export function openingFor(fen: string): EcoEntry | null {
  if (!TABLE) return null;
  return TABLE[key(fen)] ?? null;
}

export async function ensureEcoLoaded(): Promise<void> {
  await loadEcoTable();
}

export function useOpening(fen: string): string | null {
  // Reactive name: re-renders once the table arrives.
  const [, setReady] = useState(!!TABLE);
  useEffect(() => {
    if (TABLE) return;
    let cancelled = false;
    loadEcoTable().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  return openingFor(fen)?.name ?? null;
}

export function useOpeningEco(fen: string): EcoEntry | null {
  const [, setReady] = useState(!!TABLE);
  useEffect(() => {
    if (TABLE) return;
    let cancelled = false;
    loadEcoTable().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  return openingFor(fen);
}
