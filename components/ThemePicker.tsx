"use client";

import { FC, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { THEME_NAMES, getTheme, prettyName } from "@/lib/themes";

interface ThemePickerProps {
  current: string;
  onChange: (id: string) => void;
}

const ThemePicker: FC<ThemePickerProps> = ({ current, onChange }) => {
  const [query, setQuery] = useState("");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? THEME_NAMES.filter((id) => id.toLowerCase().includes(q))
      : THEME_NAMES;
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${THEME_NAMES.length} themes…`}
          className="w-full pl-7 pr-2 py-1.5 text-xs bg-bg/60 ring-1 ring-muted/20 rounded-md text-fg/90 placeholder-muted/40 focus:outline-none focus:ring-muted/50 transition-colors"
        />
      </div>
      <div className="max-h-72 overflow-y-auto pr-1 space-y-0.5">
        {list.map((id) => {
          const t = getTheme(id);
          const active = id === current;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-left transition-colors ${
                active ? "bg-surface ring-1 ring-muted/40" : "hover:bg-surface/70"
              }`}
            >
              <div className="flex shrink-0 rounded-sm overflow-hidden ring-1 ring-black/40" style={{ width: 38, height: 14 }}>
                <span style={{ background: t.bg, flex: 1 }} />
                <span style={{ background: t.subAlt, flex: 1 }} />
                <span style={{ background: t.main, flex: 1 }} />
                <span style={{ background: t.text, flex: 1 }} />
              </div>
              <span className="flex-1 truncate" style={{ color: active ? t.text : undefined }}>
                {prettyName(id)}
              </span>
              {active && <Check size={11} className="text-emerald-400 shrink-0" />}
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="text-xs text-muted/70 text-center py-3">No theme matches</p>
        )}
      </div>
    </div>
  );
};

export default ThemePicker;
