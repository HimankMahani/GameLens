/**
 * IndexedDB cache for analyzed games. Keyed by a hash of the PGN + analyze
 * depth, so the same game re-opens instantly without re-running Stockfish.
 *
 * Also stores the "last analyzed" pointer so a page refresh returns the
 * user to where they were.
 */
import type { AnalyzedMove, GameSummary } from "@/lib/analysis";

const DB_NAME = "chess-analyzer";
const STORE = "games";
const META = "meta";
const PUZZLES = "puzzles";
const VERSION = 2;
const LAST_KEY = "lastGameKey";

export interface CachedGame {
  key: string;
  pgn: string;
  depth: number;
  positions: { fen: string; move: import("chess.js").Move | null }[];
  moves: AnalyzedMove[];
  summary: GameSummary;
  savedAt: number;
}

async function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
      if (!db.objectStoreNames.contains(PUZZLES)) {
        const s = db.createObjectStore(PUZZLES, { keyPath: "fen" });
        s.createIndex("dueAt", "dueAt");
        s.createIndex("addedAt", "addedAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Fast non-crypto hash (djb2) — collisions unlikely for any reasonable cache size. */
export function hashKey(pgn: string, depth: number): string {
  let h = 5381;
  const s = pgn + "|d" + depth;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "g" + (h >>> 0).toString(36);
}

export async function listGames(): Promise<CachedGame[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => {
        const all = (req.result as CachedGame[]) ?? [];
        all.sort((a, b) => b.savedAt - a.savedAt);
        resolve(all);
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function deleteGame(key: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

export async function loadGame(key: string): Promise<CachedGame | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as CachedGame) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveGame(game: CachedGame): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE, META], "readwrite");
      tx.objectStore(STORE).put(game);
      tx.objectStore(META).put(game.key, LAST_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

export async function loadLastGame(): Promise<CachedGame | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    const key: string | undefined = await new Promise((resolve) => {
      const tx = db.transaction(META, "readonly");
      const req = tx.objectStore(META).get(LAST_KEY);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => resolve(undefined);
    });
    if (!key) return null;
    return loadGame(key);
  } catch {
    return null;
  }
}

export async function clearLastGame(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(META, "readwrite");
      tx.objectStore(META).delete(LAST_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}

/** Prune cache to N most recent games to bound storage. */
export async function pruneCache(keep = 20): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    const db = await openDb();
    const all: CachedGame[] = await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as CachedGame[]) ?? []);
      req.onerror = () => resolve([]);
    });
    if (all.length <= keep) return;
    all.sort((a, b) => b.savedAt - a.savedAt);
    const toDelete = all.slice(keep);
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      for (const g of toDelete) tx.objectStore(STORE).delete(g.key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
