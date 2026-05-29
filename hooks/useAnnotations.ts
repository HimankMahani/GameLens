"use client";

import { useCallback } from "react";

const ANNOTATIONS_KEY = "chess-analyzer-annotations-v2";
const PREFERENCES_KEY = "chess-analyzer-preferences";

/** All annotations across all games. Keyed by gameKey → ply → text. */
type AllAnnotations = Record<string, Record<number, string>>;

export interface PreferencesData {
  boardOrientation: "white" | "black";
  showCoordinates: boolean;
  showAnimations: boolean;
  engineDepth: number;
  theme: string;
  soundEnabled: boolean;
  showHanging: boolean;
}

/** Migrate the legacy v1 store (flat ply → text) into a generic "global" bucket. */
function migrate(): AllAnnotations {
  try {
    const v2 = localStorage.getItem(ANNOTATIONS_KEY);
    if (v2) return JSON.parse(v2);
    const v1 = localStorage.getItem("chess-analyzer-annotations");
    if (v1) {
      const flat = JSON.parse(v1) as Record<number, string>;
      return { __legacy__: flat };
    }
  } catch {
    /* ignore */
  }
  return {};
}

function readAll(): AllAnnotations {
  try {
    const raw = localStorage.getItem(ANNOTATIONS_KEY);
    return raw ? JSON.parse(raw) : migrate();
  } catch {
    return {};
  }
}

function writeAll(all: AllAnnotations) {
  try {
    localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function useAnnotations() {
  const loadAnnotations = useCallback((gameKey: string | null): Record<number, string> => {
    if (!gameKey) return {};
    const all = readAll();
    return all[gameKey] ?? {};
  }, []);

  const saveAnnotations = useCallback((gameKey: string | null, annotations: Record<number, string>) => {
    if (!gameKey) return;
    const all = readAll();
    all[gameKey] = annotations;
    writeAll(all);
  }, []);

  return { loadAnnotations, saveAnnotations };
}

export function usePreferences() {
  const loadPreferences = useCallback((): PreferencesData => {
    try {
      const raw = localStorage.getItem(PREFERENCES_KEY);
      const defaults: PreferencesData = {
        boardOrientation: "white",
        showCoordinates: true,
        showAnimations: true,
        engineDepth: 12,
        theme: "default",
        soundEnabled: false,
        showHanging: false,
      };
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return {
        boardOrientation: "white",
        showCoordinates: true,
        showAnimations: true,
        engineDepth: 12,
        theme: "default",
        soundEnabled: false,
        showHanging: false,
      };
    }
  }, []);

  const savePreferences = useCallback((prefs: Partial<PreferencesData>) => {
    try {
      const current = loadPreferences();
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...current, ...prefs }));
    } catch {
      /* ignore */
    }
  }, [loadPreferences]);

  return { loadPreferences, savePreferences };
}
