"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isTablebaseEligible,
  queryTablebase,
  type TbResult,
} from "@/lib/tablebase";

interface State {
  loading: boolean;
  data: TbResult | null;
  /** Was the position eligible for tablebase lookup at all? */
  eligible: boolean;
  /** Non-null when the lookup failed (timeout / network / parse error). */
  error: string | null;
}

interface UseTablebaseReturn extends State {
  /** Re-run the lookup for the current FEN. */
  retry: () => void;
}

const initial: State = {
  loading: false,
  data: null,
  eligible: false,
  error: null,
};

/** Fetches Lichess Syzygy data for a position when it's tablebase-eligible. */
export function useTablebase(
  fen: string | null | undefined
): UseTablebaseReturn {
  const [state, setState] = useState<State>(initial);
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!fen) {
      setState(initial);
      return;
    }
    if (!isTablebaseEligible(fen)) {
      setState({ loading: false, data: null, eligible: false, error: null });
      return;
    }
    const ctrl = new AbortController();
    setState({ loading: true, data: null, eligible: true, error: null });
    queryTablebase(fen, ctrl.signal).then((data) => {
      if (ctrl.signal.aborted) return;
      // lib/tablebase.ts collapses all failure modes to `null`. Since Syzygy
      // is authoritative for ≤7-piece positions, treat any null-after-eligible
      // as a service-unavailable signal for the UI.
      setState({
        loading: false,
        data,
        eligible: true,
        error: data ? null : "Tablebase service unavailable",
      });
    });
    return () => ctrl.abort();
  }, [fen, nonce]);

  return { ...state, retry };
}
