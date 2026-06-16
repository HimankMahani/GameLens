"use client";

import { FC } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Pause,
  Play,
} from "lucide-react";

interface MobileNavBarProps {
  currentIndex: number;
  totalPlies: number;
  canGoBack: boolean;
  canGoForward: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  goToStart: () => void;
  goBack: () => void;
  goForward: () => void;
  goToEnd: () => void;
  onNextBlunder?: () => void;
  hasNextBlunder?: boolean;
}

const MobileNavBar: FC<MobileNavBarProps> = ({
  currentIndex,
  totalPlies,
  canGoBack,
  canGoForward,
  isPlaying,
  onTogglePlay,
  goToStart,
  goBack,
  goForward,
  goToEnd,
  onNextBlunder,
  hasNextBlunder,
}) => {
  return (
    <div
      className="lg:hidden fixed inset-x-0 bottom-0 z-30"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="mx-2 mb-2 rounded-2xl px-1.5 py-1.5 flex items-center gap-1"
        style={{
          background: "rgba(20,20,22,0.92)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 -8px 24px -8px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <button
          onClick={goToStart}
          disabled={!canGoBack}
          aria-label="First move"
          className="grid h-11 w-11 place-items-center rounded-xl text-fg/70 active:bg-white/10 disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronsLeft size={18} />
        </button>
        <button
          onClick={goBack}
          disabled={!canGoBack}
          aria-label="Previous move"
          className="grid h-11 w-11 place-items-center rounded-xl text-fg/80 active:bg-white/10 disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={onTogglePlay}
          disabled={currentIndex >= totalPlies}
          aria-label={isPlaying ? "Pause" : "Auto-play"}
          className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-[var(--main)] text-bg font-semibold text-sm active:brightness-110 disabled:opacity-40 disabled:pointer-events-none"
        >
          {isPlaying ? (
            <>
              <Pause size={15} /> Pause
            </>
          ) : (
            <>
              <Play size={15} />
              <span className="tabular-nums">
                {currentIndex}/{totalPlies}
              </span>
            </>
          )}
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          aria-label="Next move"
          className="grid h-11 w-11 place-items-center rounded-xl text-fg/80 active:bg-white/10 disabled:opacity-25 disabled:pointer-events-none"
        >
          <ChevronRight size={20} />
        </button>
        {onNextBlunder ? (
          <button
            onClick={onNextBlunder}
            disabled={!hasNextBlunder}
            aria-label="Next mistake"
            className="grid h-11 w-11 place-items-center rounded-xl text-orange-300 active:bg-orange-500/15 disabled:opacity-25 disabled:pointer-events-none"
          >
            <AlertTriangle size={16} />
          </button>
        ) : (
          <button
            onClick={goToEnd}
            disabled={!canGoForward}
            aria-label="Last move"
            className="grid h-11 w-11 place-items-center rounded-xl text-fg/70 active:bg-white/10 disabled:opacity-25 disabled:pointer-events-none"
          >
            <ChevronsRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default MobileNavBar;
