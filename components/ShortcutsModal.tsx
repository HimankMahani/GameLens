"use client";

import { FC } from "react";
import { X, Keyboard } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ["←", "→"], label: "Previous / next move" },
  { keys: ["Home", "End"], label: "Jump to start / end" },
  { keys: ["Space"], label: "Auto-play / pause" },
  { keys: ["F"], label: "Flip board" },
  { keys: ["B"], label: "Next blunder / mistake" },
  { keys: ["Shift", "B"], label: "Previous blunder / mistake" },
  { keys: ["?"], label: "Show this overlay" },
  { keys: ["Esc"], label: "Close modals" },
];

const Kbd: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-bg/60 ring-1 ring-muted/30 rounded text-fg/90">
    {children}
  </span>
);

const ShortcutsModal: FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface ring-1 ring-muted/40 rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-[slide-up_220ms_ease-out_both]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard size={14} className="text-fg/65" />
            <p className="text-sm font-semibold text-fg">Keyboard shortcuts</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1.5">
          {SHORTCUTS.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-bg/40 transition-colors"
            >
              <span className="text-xs text-fg/80">{s.label}</span>
              <span className="flex items-center gap-1 shrink-0">
                {s.keys.map((k, j) => (
                  <Kbd key={j}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-muted/70 mt-3 text-center">
          Press <Kbd>?</Kbd> any time
        </p>
      </div>
    </div>
  );
};

export default ShortcutsModal;
