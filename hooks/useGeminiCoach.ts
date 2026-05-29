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
      const text = await explainMove(input, settings, {
        signal: ctl.signal,
        bypassCache: options.bypassCache,
      });
      if (ctl.signal.aborted) return;
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
