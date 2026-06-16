"use client";

import { FC } from "react";
import { Smartphone, X } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KEYBOARD: { keys: string[]; label: string }[] = [
  { keys: ["←", "→"], label: "Previous / next move" },
  { keys: ["Home", "End"], label: "Jump to start / end" },
  { keys: ["Space"], label: "Auto-play / pause" },
  { keys: ["F"], label: "Flip board" },
  { keys: ["B"], label: "Next blunder / mistake" },
  { keys: ["Shift", "B"], label: "Previous blunder / mistake" },
  { keys: ["?"], label: "Show this overlay" },
  { keys: ["Esc"], label: "Close modals" },
];

const TOUCH: { gesture: string; label: string }[] = [
  { gesture: "Swipe left", label: "Next move" },
  { gesture: "Swipe right", label: "Previous move" },
  { gesture: "Bottom bar →", label: "Step forward / back" },
  { gesture: "Bottom bar ▶", label: "Auto-play / pause" },
  { gesture: "Bottom bar ⚠", label: "Jump to next mistake" },
  { gesture: "Tap move (Moves tab)", label: "Jump to that position" },
  { gesture: "Tap coach strip", label: "Expand move explanation" },
];

const Kbd: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-bg/60 ring-1 ring-muted/30 rounded text-fg/90">
    {children}
  </span>
);

const ShortcutsModal: FC<ShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface ring-1 ring-muted/40 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-5 animate-[slide-up_220ms_ease-out_both] max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-fg">Controls & shortcuts</p>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Mobile gestures */}
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Smartphone size={11} className="text-muted/70" />
            <p className="text-[10px] text-muted uppercase tracking-wider font-medium">Touch / mobile</p>
          </div>
          <div className="space-y-1">
            {TOUCH.map((s) => (
              <div
                key={s.gesture}
                className="flex items-center justify-between gap-3 px-2 py-1.5 rounded-md hover:bg-bg/40 transition-colors"
              >
                <span className="text-xs text-fg/80">{s.label}</span>
                <span className="text-[11px] font-medium text-muted/80 shrink-0 text-right">
                  {s.gesture}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Keyboard shortcuts — hidden on mobile, no physical keyboard */}
        <div className="hidden md:block">
          <div className="h-px bg-muted/15 mb-4" />
          <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-2">Keyboard</p>
          <div className="space-y-1">
            {KEYBOARD.map((s, i) => (
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
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
