"use client";

import { FC } from "react";
import { BookOpen } from "lucide-react";

interface OpeningBadgeProps {
  name: string | null;
}

const OpeningBadge: FC<OpeningBadgeProps> = ({ name }) => {
  if (!name) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-surface/50 rounded-lg ring-1 ring-muted/20">
        <BookOpen size={12} className="text-muted/70" />
        <span className="text-xs text-muted/70 italic">Unknown opening</span>
      </div>
    );
  }

  return (
    <div
      key={name}
      className="flex items-center gap-2 px-3 py-2 rounded-lg animate-[pop-in_380ms_cubic-bezier(0.34,1.56,0.64,1)_both]"
      style={{
        background: "color-mix(in srgb, var(--main) 12%, transparent)",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--main) 35%, transparent)",
      }}
    >
      <BookOpen size={12} style={{ color: "var(--main)" }} />
      <span className="text-xs font-medium" style={{ color: "var(--main)" }}>{name}</span>
    </div>
  );
};

export default OpeningBadge;
