"use client";

import { FC, useMemo } from "react";

interface MaterialBalanceProps {
  fen: string;
}

const VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const SYMBOL_W: Record<string, string> = { P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕" };
const SYMBOL_B: Record<string, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛" };

interface Counts { P: number; N: number; B: number; R: number; Q: number; p: number; n: number; b: number; r: number; q: number }

function countPieces(fen: string): Counts {
  const c: Counts = { P: 0, N: 0, B: 0, R: 0, Q: 0, p: 0, n: 0, b: 0, r: 0, q: 0 };
  const board = fen.split(" ")[0] || "";
  for (const ch of board) {
    if (ch === "/" || /\d/.test(ch)) continue;
    if (ch in c) (c as unknown as Record<string, number>)[ch]++;
  }
  return c;
}

const MaterialBalance: FC<MaterialBalanceProps> = ({ fen }) => {
  const data = useMemo(() => {
    const c = countPieces(fen);
    const wValue = c.P * VAL.p + c.N * VAL.n + c.B * VAL.b + c.R * VAL.r + c.Q * VAL.q;
    const bValue = c.p * VAL.p + c.n * VAL.n + c.b * VAL.b + c.r * VAL.r + c.q * VAL.q;
    const diff = wValue - bValue;
    // What white has captured (extras of black pieces missing) — used to
    // show the "captured pieces" strip per side.
    const wCaptured = [
      ...Array(Math.max(0, 8 - c.p)).fill("p"),
      ...Array(Math.max(0, 2 - c.n)).fill("n"),
      ...Array(Math.max(0, 2 - c.b)).fill("b"),
      ...Array(Math.max(0, 2 - c.r)).fill("r"),
      ...Array(Math.max(0, 1 - c.q)).fill("q"),
    ];
    const bCaptured = [
      ...Array(Math.max(0, 8 - c.P)).fill("P"),
      ...Array(Math.max(0, 2 - c.N)).fill("N"),
      ...Array(Math.max(0, 2 - c.B)).fill("B"),
      ...Array(Math.max(0, 2 - c.R)).fill("R"),
      ...Array(Math.max(0, 1 - c.Q)).fill("Q"),
    ];
    return { diff, wCaptured, bCaptured };
  }, [fen]);

  const { diff, wCaptured, bCaptured } = data;
  const aheadSide = diff > 0 ? "White" : diff < 0 ? "Black" : null;
  const absDiff = Math.abs(diff);

  if (absDiff === 0 && wCaptured.length === 0 && bCaptured.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-fg/80">
      {/* White captured (black pieces) */}
      <span className="flex items-center gap-0.5 text-fg/65">
        {wCaptured.map((p, i) => (
          <span key={i} className="font-mono leading-none" style={{ color: "var(--text)" }}>
            {SYMBOL_B[p]}
          </span>
        ))}
      </span>
      {aheadSide && (
        <span className="font-medium tabular-nums" style={{ color: "var(--main)" }}>
          {aheadSide} +{absDiff}
        </span>
      )}
      {/* Black captured (white pieces) */}
      <span className="flex items-center gap-0.5 text-fg/65 ml-auto">
        {bCaptured.map((p, i) => (
          <span key={i} className="font-mono leading-none" style={{ color: "var(--text)", opacity: 0.5 }}>
            {SYMBOL_W[p]}
          </span>
        ))}
      </span>
    </div>
  );
};

export default MaterialBalance;
