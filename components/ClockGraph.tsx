"use client";

import { FC, useMemo } from "react";
import { Bar, BarChart, ResponsiveContainer, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { Clock } from "lucide-react";
import { fmtDuration } from "@/lib/pgnClock";
import type { MoveClassification } from "@/lib/analysis";

interface ClockGraphProps {
  /** Per-ply seconds spent on the move. plies are 1-based — index 0 is unused. */
  spent: (number | null)[];
  currentPly: number;
  onPlyClick?: (ply: number) => void;
  classificationsByPly?: Record<number, MoveClassification>;
}

const ClockGraph: FC<ClockGraphProps> = ({ spent, currentPly, onPlyClick, classificationsByPly = {} }) => {
  const data = useMemo(() => {
    return spent.map((s, i) => {
      const cls = classificationsByPly[i];
      const bad = cls === "blunder" || cls === "mistake" || cls === "miss";
      return {
        ply: i,
        spent: s ?? 0,
        color: bad ? "var(--error)" : i % 2 === 1 ? "var(--text)" : "var(--sub)",
      };
    });
  }, [spent, classificationsByPly]);

  const hasAny = spent.some((s) => s !== null && s > 0);
  if (!hasAny) return null;

  return (
    <div className="bg-surface/60 rounded-2xl ring-1 ring-muted/20 overflow-hidden animate-[fade-in_400ms_ease-out]">
      <div className="px-3 py-2 border-b border-muted/25 flex items-center justify-between">
        <p className="text-[10px] text-muted uppercase tracking-[0.18em] font-medium flex items-center gap-1.5">
          <Clock size={10} /> Time per move
        </p>
        <span className="text-[10px] text-muted/70">seconds</span>
      </div>
      <div className="p-2" style={{ height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 0, left: -22 }}
            onClick={(e) => {
              if (!onPlyClick) return;
              const ev = e as unknown as { activePayload?: Array<{ payload: { ply: number } }> } | null;
              const p = ev?.activePayload?.[0]?.payload?.ply;
              if (typeof p === "number") onPlyClick(p);
            }}
          >
            <XAxis dataKey="ply" tick={{ fontSize: 9, fill: "var(--sub)" }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "var(--sub)" }} tickLine={false} axisLine={false} />
            <ReferenceLine x={currentPly} stroke="var(--text)" strokeOpacity={0.7} strokeWidth={1} strokeDasharray="2 2" />
            <Tooltip
              cursor={{ fill: "color-mix(in srgb, var(--text) 8%, transparent)" }}
              contentStyle={{
                backgroundColor: "var(--sub-alt)",
                border: "1px solid var(--sub)",
                borderRadius: 8,
                fontSize: 11,
                color: "var(--text)",
              }}
              labelStyle={{ color: "var(--sub)" }}
              itemStyle={{ color: "var(--text)" }}
              formatter={(v) => [fmtDuration(typeof v === "number" ? v : 0), "spent"]}
              labelFormatter={(p) => `ply ${p}`}
            />
            <Bar
              dataKey="spent"
              isAnimationActive
              animationDuration={500}
              shape={(props: unknown) => {
                const p = props as { x: number; y: number; width: number; height: number; payload: { color: string } };
                return <rect x={p.x} y={p.y} width={p.width} height={p.height} fill={p.payload.color} rx={1.5} />;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ClockGraph;
