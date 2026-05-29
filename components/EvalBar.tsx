"use client";

import { FC } from "react";

interface EvalBarProps {
  /** centipawns from white's perspective, or null if unknown */
  cp: number | null;
  /** mate in N from white's perspective, or null */
  mate: number | null;
  /** flip if board is from black's POV */
  flipped?: boolean;
  /** Fixed pixel height. Default tracks viewport on small screens. */
  height?: number | string;
}

const EvalBar: FC<EvalBarProps> = ({ cp, mate, flipped = false, height = "min(500px, calc(100vw - 3.5rem))" }) => {
  const pct = (() => {
    if (mate !== null) return mate > 0 ? 100 : 0;
    if (cp === null) return 50;
    // Map cp [-1000, 1000] roughly via tanh-like curve for nicer ramp.
    const v = Math.max(-1000, Math.min(1000, cp));
    const t = 50 + (50 * (2 / (1 + Math.exp(-v / 250)) - 1));
    return Math.max(2, Math.min(98, t));
  })();

  const label = (() => {
    if (mate !== null) return `M${Math.abs(mate)}`;
    if (cp === null) return "—";
    const v = cp / 100;
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}`;
  })();

  // When flipped, white-advantage region grows from the bottom.
  const whitePct = flipped ? 100 - pct : pct;
  const labelPct = flipped ? 100 - pct : pct;
  const labelOnLight = labelPct <= whitePct;

  return (
    <div
      className="relative w-14 shrink-0"
      style={{ height }}
    >
      <div
        className="absolute left-2 top-0 h-full w-3.5 overflow-hidden rounded-full ring-1 ring-muted/20 sm:w-4"
        style={{ background: "#0a0a0a" }}
      >
        {/* black side */}
        <div className="absolute inset-0 bg-surface" />
        {/* white advantage block */}
        <div
          className="absolute left-0 right-0 bg-zinc-100 transition-[top,height] duration-500 ease-out"
          style={
            flipped
              ? { bottom: 0, height: `${whitePct}%`, top: "auto" }
              : { top: 0, height: `${whitePct}%` }
          }
        />
      </div>

      {/* Keep the score readable without clipping inside the narrow bar. */}
      <div
        className="absolute left-7 min-w-8 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-center text-[10px] font-mono font-bold leading-none shadow-sm ring-1 transition-[top,color,background-color] duration-500 ease-out select-none"
        style={{
          top: `clamp(12px, ${labelPct}%, calc(100% - 12px))`,
          color: labelOnLight ? "#f4f4f5" : "#18181b",
          backgroundColor: labelOnLight ? "rgba(24, 24, 27, 0.88)" : "rgba(244, 244, 245, 0.92)",
          borderColor: labelOnLight ? "rgba(244, 244, 245, 0.18)" : "rgba(24, 24, 27, 0.18)",
          transform: "translate(-50%, -50%)",
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default EvalBar;
