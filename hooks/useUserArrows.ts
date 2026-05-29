"use client";

import { useCallback } from "react";

const KEY = "chess-analyzer-arrows-v1";

export interface UserArrow {
  startSquare: string;
  endSquare: string;
  color: string;
}

/** Map: gameKey → ply → arrows[]. Lives entirely in localStorage. */
type AllArrows = Record<string, Record<number, UserArrow[]>>;

function readAll(): AllArrows {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(all: AllArrows) {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function useUserArrows() {
  const loadArrowsForPly = useCallback((gameKey: string | null, ply: number): UserArrow[] => {
    if (!gameKey) return [];
    const all = readAll();
    return all[gameKey]?.[ply] ?? [];
  }, []);

  const saveArrowsForPly = useCallback((gameKey: string | null, ply: number, arrows: UserArrow[]) => {
    if (!gameKey) return;
    const all = readAll();
    if (!all[gameKey]) all[gameKey] = {};
    if (arrows.length === 0) {
      delete all[gameKey][ply];
      if (Object.keys(all[gameKey]).length === 0) delete all[gameKey];
    } else {
      all[gameKey][ply] = arrows;
    }
    writeAll(all);
  }, []);

  return { loadArrowsForPly, saveArrowsForPly };
}
