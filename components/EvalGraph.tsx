"use client";

import { FC, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, ReferenceLine, Scatter, XAxis, YAxis, Tooltip, ComposedChart } from "recharts";
import type { MoveClassification } from "@/lib/analysis";

interface EvalGraphProps {
  /** centipawns from white's POV, indexed by ply (0 = before move 1) */
  cps: (number | null)[];
  currentPly: number;
  onPlyClick?: (ply: number) => void;
  /** Map of ply (1-based) → classification. Mistakes/blunders/miss become markers. */
  classificationsByPly?: Record<number, MoveClassification>;
}

const MARKER_COLOR: Partial<Record<MoveClassification, string>> = {
  blunder: "#ef4444",
  mistake: "#f97316",
  miss: "#f43f5e",
  inaccuracy: "#eab308",
  brilliant: "#22d3ee",
  great: "#60a5fa",
};

const EvalGraph: FC<EvalGraphProps> = ({ cps, currentPly, onPlyClick, classificationsByPly = {} }) => {
  // Dynamic Y domain: clip to ±10 by default, but expand if needed for unusual evals.
  const yDomain = useMemo<[number, number]>(() => {
    let max = 3;
    for (const cp of cps) {
      if (cp === null) continue;
      const v = Math.abs(cp / 100);
      if (v > max) max = v;
    }
    const padded = Math.min(10, Math.ceil(max + 0.5));
    return [-padded, padded];
  }, [cps]);

  const data = useMemo(() => {
    const limit = yDomain[1];
    return cps.map((cp, i) => {
      const cls = classificationsByPly[i];
      const evalVal = cp === null ? 0 : Math.max(-limit, Math.min(limit, cp / 100));
      return {
        ply: i,
        eval: evalVal,
        rawCp: cp,
        markerY: cls && MARKER_COLOR[cls] ? evalVal : null,
        markerColor: cls ? MARKER_COLOR[cls] : null,
        classification: cls,
      };
    });
  }, [cps, yDomain, classificationsByPly]);

  if (cps.length <= 1) {
    return (
      <div className="bg-surface/60 rounded-2xl ring-1 ring-muted/20 p-4 h-full flex items-center justify-center">
        <p className="text-xs text-muted/70">No eval data</p>
      </div>
    );
  }

  return (
    <div className="bg-surface/60 rounded-2xl ring-1 ring-muted/20 overflow-hidden animate-[fade-in_400ms_ease-out]">
      <div className="px-3 py-2 border-b border-muted/25 flex items-center justify-between">
        <p className="text-[10px] text-muted uppercase tracking-[0.18em] font-medium">Evaluation</p>
        <span className="text-[10px] text-muted/70">
          ply {currentPly} / {cps.length - 1}
        </span>
      </div>
      <div className="p-2" style={{ height: 130 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 0, left: -22 }}
            onClick={(e) => {
              if (!onPlyClick) return;
              const ev = e as unknown as { activePayload?: Array<{ payload: { ply: number } }> } | null;
              const p = ev?.activePayload?.[0]?.payload?.ply;
              if (typeof p === "number") onPlyClick(p);
            }}
          >
            <defs>
              <linearGradient id="evalUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--text)" stopOpacity={0.45} />
                <stop offset="100%" stopColor="var(--text)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <XAxis dataKey="ply" tick={{ fontSize: 9, fill: "var(--sub)" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--sub)" }} tickLine={false} axisLine={false} domain={yDomain} />
            <ReferenceLine y={0} stroke="var(--sub)" strokeOpacity={0.4} strokeWidth={1} />
            <ReferenceLine x={currentPly} stroke="var(--text)" strokeOpacity={0.7} strokeWidth={1} strokeDasharray="2 2" />
            <Tooltip
              cursor={{ stroke: "var(--sub)", strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: "var(--sub-alt)",
                border: "1px solid var(--sub)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--text)",
              }}
              labelStyle={{ color: "var(--sub)" }}
              itemStyle={{ color: "var(--text)" }}
              formatter={(v, name, ctx) => {
                if (name === "markerY") return null;
                const n = typeof v === "number" ? v : 0;
                const cls = (ctx?.payload as { classification?: string } | undefined)?.classification;
                const label = cls ? `${n >= 0 ? "+" : ""}${n.toFixed(2)} (${cls})` : `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
                return [label, "eval"];
              }}
              labelFormatter={(p) => `ply ${p}`}
            />
            <Area
              type="monotone"
              dataKey="eval"
              stroke="var(--text)"
              strokeOpacity={0.75}
              strokeWidth={1.5}
              fill="url(#evalUp)"
              isAnimationActive
              animationDuration={500}
            />
            <Scatter
              dataKey="markerY"
              isAnimationActive={false}
              shape={(props: unknown) => {
                const p = props as { cx: number; cy: number; payload: { markerColor?: string } };
                if (!p.payload.markerColor) return <g />;
                return (
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={3.5}
                    fill={p.payload.markerColor}
                    stroke="var(--bg)"
                    strokeWidth={1}
                  />
                );
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EvalGraph;
