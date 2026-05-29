"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  explainMove,
  GeminiError,
  loadGeminiSettings,
  type CoachInput,
  type GeminiErrorKind,
} from "@/lib/gemini";

export interface CoachError {
  message: string;
  kind: GeminiErrorKind | "disabled";
  retryable: boolean;
}

interface State {
  loading: boolean;
  text: string | null;
  error: CoachError | null;
}

interface AskOptions {
  bypassCache?: boolean;
}

const RETRY_DELAYS_MS = [700, 1400];

export function useGeminiCoach() {
  const [state, setState] = useState<State>({ loading: false, text: null, error: null });
  const controllerRef = useRef<AbortController | null>(null);
  const lastInputRef = useRef<CoachInput | null>(null);

  const ask = useCallback(async (input: CoachInput, options: AskOptions = {}) => {
    lastInputRef.current = input;
    const settings = loadGeminiSettings();
    if (!settings.enabled || !settings.key) {
      setState({
        loading: false,
        text: null,
        error: {
          message: "Gemini coach isn't enabled — open Settings to add your free API key.",
          kind: "disabled",
          retryable: false,
        },
      });
      return;
    }

    // Cancel any in-flight request before starting a new one.
    controllerRef.current?.abort();
    const ctl = new AbortController();
    controllerRef.current = ctl;

    setState({ loading: true, text: null, error: null });
    try {
      let text: string | null = null;
      let lastError: unknown;
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
          text = await explainMove(input, settings, {
            signal: ctl.signal,
            bypassCache: options.bypassCache || attempt > 0,
          });
          break;
        } catch (e) {
          lastError = e;
          if (ctl.signal.aborted || !isRetryableGeminiError(e) || attempt === RETRY_DELAYS_MS.length) {
            throw e;
          }
          await wait(RETRY_DELAYS_MS[attempt], ctl.signal);
        }
      }
      if (ctl.signal.aborted) return;
      if (!text) throw lastError ?? new Error("Gemini returned no text.");
      setState({ loading: false, text, error: null });
    } catch (e) {
      // Drop aborted requests silently — a newer ask() (or unmount) won.
      if (ctl.signal.aborted) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof Error && e.name === "AbortError") return;

      if (e instanceof GeminiError) {
        setState({
          loading: false,
          text: null,
          error: { message: e.message, kind: e.kind, retryable: e.retryable },
        });
        return;
      }
      const message = e instanceof Error ? e.message : String(e);
      setState({
        loading: false,
        text: null,
        error: { message, kind: "unknown", retryable: false },
      });
    }
  }, []);

  const regenerate = useCallback(() => {
    const last = lastInputRef.current;
    if (!last) return;
    return ask(last, { bypassCache: true });
  }, [ask]);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState({ loading: false, text: null, error: null });
  }, []);

  // Cancel any in-flight request on unmount.
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  return { ...state, ask, regenerate, reset };
}

function isRetryableGeminiError(error: unknown): boolean {
  if (error instanceof GeminiError) return error.retryable;
  if (error instanceof TypeError) return true;
  return false;
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}
