"use client";

import { FC } from "react";
import { Cpu } from "lucide-react";
import type { PgnHeaders } from "@/lib/pgnFetch";

interface AnalyzingScreenProps {
  current: number;
  total: number;
  depth: number;
  onCancel?: () => void;
  headers?: PgnHeaders | null;
  opening?: string | null;
}

const AnalyzingScreen: FC<AnalyzingScreenProps> = ({ current, total, depth, onCancel, headers, opening }) => {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-md bg-surface/70 ring-1 ring-muted/20 rounded-2xl p-8 animate-[fade-in_300ms_ease-out]">
        <div className="flex items-center gap-2 mb-1">
          <Cpu
            size={14}
            style={{ color: "var(--main)", animation: "float 1.8s ease-in-out infinite, glow-pulse 1.8s ease-in-out infinite" }}
          />
          <p className="text-[10px] text-muted uppercase tracking-[0.2em] font-medium">
            Analyzing with Stockfish
          </p>
        </div>
        <p className="text-2xl font-semibold text-fg tracking-tight">
          Reviewing your game…
        </p>
        {(headers?.white || headers?.black || opening) && (
          <div className="mt-2 text-xs text-fg/70 animate-[fade-in_400ms_ease-out_120ms_both]">
            {(headers?.white || headers?.black) && (
              <p className="truncate">
                <span className="text-fg">{headers?.white || "?"}</span>
                {headers?.whiteElo && <span className="text-muted"> ({headers.whiteElo})</span>}
                <span className="text-muted/70 px-1.5">vs</span>
                <span className="text-fg">{headers?.black || "?"}</span>
                {headers?.blackElo && <span className="text-muted"> ({headers.blackElo})</span>}
              </p>
            )}
            {opening && (
              <p className="text-[11px] mt-0.5" style={{ color: "var(--main)" }}>
                {opening}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted mt-1">
          {total > 0
            ? `Depth ${depth} · ${current} / ${total} positions`
            : "Loading engine… (first load can take up to a minute)"}
        </p>

        <div className="mt-6 h-1.5 w-full rounded-full bg-surface overflow-hidden relative">
          <div
            className="h-full rounded-full transition-[width] duration-300 ease-out relative overflow-hidden"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, var(--main), color-mix(in srgb, var(--main) 60%, white))",
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.6s linear infinite",
              }}
            />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted">
          <span className="tabular-nums">{pct}%</span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-muted hover:text-fg/90 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {[
            { dot: "bg-emerald-400", label: "Best moves" },
            { dot: "bg-yellow-400", label: "Inaccuracies" },
            { dot: "bg-red-400", label: "Blunders" },
          ].map((s, i) => (
            <div
              key={s.label}
              className="flex items-center gap-1.5 text-[10px] text-muted"
              style={{ animation: `fade-in 600ms ease-out both`, animationDelay: `${200 + i * 90}ms` }}
            >
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
              {s.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyzingScreen;
