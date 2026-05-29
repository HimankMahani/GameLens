/**
 * Persistent puzzle queue built from the user's own mistakes.
 *
 * When a game is analyzed, every blunder/mistake/miss becomes a puzzle entry
 * keyed by FEN-before-move. Each entry tracks attempts, last seen, and an
 * "ease" used for an SRS-lite scheduling: failed → soon, solved → pushed back.
 */

const DB_NAME = "chess-analyzer";
const STORE = "puzzles";
const VERSION = 2; // bump from gameCache.ts version 1; we add a new store

export interface PuzzleEntry {
  /** FEN before the move — primary key. */
  fen: string;
  /** Game cache key the puzzle was sourced from (so we can link back). */
  gameKey: string;
  /** Move number / ply within the source game. */
  ply: number;
  /** SAN of the move that was actually played (the mistake). */
  playedSan: string;
  /** Engine's recommended UCI / SAN. */
  bestUci: string;
  bestSan: string | null;
  /** Engine PV (UCI), so we can show the line after solving. */
  bestPv: string[];
  /** Classification at time of save. */
  classification: "blunder" | "mistake" | "miss";
  /** Side to move at this position. */
  side: "w" | "b";
  /** Centipawn loss vs best, side-to-move POV. */
  cpLoss: number;
  /** Source player names so the user remembers the game. */
  white: string;
  black: string;
  /** When the puzzle was first added. */
  addedAt: number;
  /** Last time the user attempted it. 0 = never. */
  lastSeenAt: number;
  /** When the puzzle is next due (ms epoch). 0 = ASAP. */
  dueAt: number;
  attempts: number;
  solves: number;
  /** Streak of solves; resets to 0 on fail. */
  streak: number;
  /** Higher = harder. Drives spacing. */
  ease: number;
  /** Additional UCIs treated as equally correct (engine multipv). */
  acceptedUcis?: string[];
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("games")) db.createObjectStore("games", { keyPath: "key" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: "fen" });
        s.createIndex("dueAt", "dueAt");
        s.createIndex("addedAt", "addedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listPuzzles(): Promise<PuzzleEntry[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as PuzzleEntry[]) ?? []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function countPuzzles(): Promise<{ total: number; due: number }> {
  const all = await listPuzzles();
  const now = Date.now();
  return { total: all.length, due: all.filter((p) => p.dueAt <= now).length };
}

export async function getDuePuzzles(limit = 50): Promise<PuzzleEntry[]> {
  const all = await listPuzzles();
  const now = Date.now();
  const due = all.filter((p) => p.dueAt <= now);
  // Most-overdue first; addedAt as tiebreaker (newer mistakes first).
  due.sort((a, b) => (a.dueAt - b.dueAt) || (b.addedAt - a.addedAt));
  return due.slice(0, limit);
}

export async function upsertPuzzle(entry: PuzzleEntry): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const get = store.get(entry.fen);
      get.onsuccess = () => {
        const existing = get.result as PuzzleEntry | undefined;
        if (existing) {
          // Don't overwrite attempt history — just refresh source-game info.
          existing.gameKey = entry.gameKey;
          existing.ply = entry.ply;
          existing.playedSan = entry.playedSan;
          existing.bestUci = entry.bestUci;
          existing.bestSan = entry.bestSan;
          existing.bestPv = entry.bestPv;
          existing.classification = entry.classification;
          existing.cpLoss = entry.cpLoss;
          existing.white = entry.white;
          existing.black = entry.black;
          store.put(existing);
        } else {
          store.put(entry);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

export async function deletePuzzle(fen: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(fen);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

/** Apply a solve outcome and reschedule. */
export async function recordAttempt(fen: string, solved: boolean): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const get = store.get(fen);
      get.onsuccess = () => {
        const p = get.result as PuzzleEntry | undefined;
        if (!p) {
          resolve();
          return;
        }
        const now = Date.now();
        p.attempts += 1;
        p.lastSeenAt = now;
        if (solved) {
          p.solves += 1;
          p.streak += 1;
          p.ease = Math.min(p.ease + 0.15, 2.5);
          // Spacing: 1d, 3d, 7d, 14d, 30d ... capped
          const days = Math.min(365, Math.max(1, Math.round(Math.pow(2, p.streak) * p.ease)));
          p.dueAt = now + days * 24 * 60 * 60 * 1000;
        } else {
          p.streak = 0;
          p.ease = Math.max(p.ease - 0.2, 1.0);
          p.dueAt = now + 30 * 60 * 1000; // 30 min cooldown
        }
        store.put(p);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

/** Push a puzzle ~1 day forward without affecting streak/ease/attempts/solves. */
export async function skipPuzzle(id: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const get = store.get(id);
      get.onsuccess = () => {
        const p = get.result as PuzzleEntry | undefined;
        if (!p) {
          resolve();
          return;
        }
        p.dueAt = Date.now() + 24 * 60 * 60 * 1000;
        store.put(p);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

export function isAcceptableMove(p: PuzzleEntry, uci: string): boolean {
  if (uci === p.bestUci) return true;
  return Array.isArray(p.acceptedUcis) && p.acceptedUcis.includes(uci);
}

export function newPuzzleFromMistake(args: {
  fen: string;
  gameKey: string;
  ply: number;
  playedSan: string;
  bestUci: string;
  bestSan: string | null;
  bestPv: string[];
  classification: "blunder" | "mistake" | "miss";
  side: "w" | "b";
  cpLoss: number;
  white: string;
  black: string;
  acceptedUcis?: string[];
}): PuzzleEntry {
  const now = Date.now();
  // stagger so a 25-game import doesn't flood the "due" badge.
  const dueAt = now + Math.floor(Math.random() * 7) * 86400_000;
  return {
    ...args,
    addedAt: now,
    lastSeenAt: 0,
    dueAt,
    attempts: 0,
    solves: 0,
    streak: 0,
    ease: 1.5,
  };
}

/** Drop puzzles whose source game has been pruned from the cache. */
export async function pruneOrphans(validGameKeys: Set<string>): Promise<void> {
  const all = await listPuzzles();
  for (const p of all) {
    if (!validGameKeys.has(p.gameKey)) await deletePuzzle(p.fen);
  }
}
