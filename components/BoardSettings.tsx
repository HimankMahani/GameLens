"use client";

import { FC, useState } from "react";
import { Settings, RotateCcw, Grid3x3, FlipHorizontal, Volume2, VolumeX, AlertTriangle } from "lucide-react";
import ThemePicker from "./ThemePicker";

interface BoardTheme {
  id: string;
  label: string;
}

interface BoardSettingsProps {
  boardOrientation: "white" | "black";
  showCoordinates: boolean;
  showAnimations: boolean;
  onOrientationChange: (o: "white" | "black") => void;
  onCoordinatesChange: (c: boolean) => void;
  onAnimationsChange: (a: boolean) => void;
  onFlipBoard: () => void;
  onReset: () => void;
  boardThemes?: BoardTheme[];
  currentTheme?: string;
  onThemeChange?: (theme: string) => void;
  engineDepth?: number;
  onDepthChange?: (d: number) => void;
  soundEnabled?: boolean;
  onSoundChange?: (enabled: boolean) => void;
  showHanging?: boolean;
  onShowHangingChange?: (enabled: boolean) => void;
}

const BoardSettings: FC<BoardSettingsProps> = ({
  boardOrientation,
  showCoordinates,
  showAnimations,
  onOrientationChange,
  onCoordinatesChange,
  onAnimationsChange,
  onFlipBoard,
  onReset,
  boardThemes = [],
  currentTheme = "dark",
  onThemeChange,
  engineDepth = 12,
  onDepthChange,
  soundEnabled = false,
  onSoundChange,
  showHanging = false,
  onShowHangingChange,
}) => {
  const [open, setOpen] = useState(false);
  const depths = [12, 18, 24];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-2 rounded-lg text-muted hover:text-fg/90 hover:bg-surface transition-colors"
      >
        <Settings size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-muted/40 rounded-xl shadow-xl z-20 overflow-hidden">
            <div className="p-3 space-y-3">
              {/* Flip board */}
              <button
                onClick={() => { onFlipBoard(); setOpen(false); }}
                className="flex items-center gap-3 w-full px-2 py-2 text-sm text-fg/80 hover:text-fg hover:bg-surface rounded-lg transition-colors"
              >
                <FlipHorizontal size={15} /> Flip Board
              </button>

              {/* Coordinates toggle */}
              <button
                onClick={() => { onCoordinatesChange(!showCoordinates); }}
                className="flex items-center justify-between w-full px-2 py-2 text-sm hover:bg-surface rounded-lg transition-colors"
              >
                <span className="flex items-center gap-3 text-fg/80">
                  <Grid3x3 size={15} /> Coordinates
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${showCoordinates ? "bg-emerald-500/20 text-emerald-400" : "bg-surface text-muted/70"}`}>
                  {showCoordinates ? "ON" : "OFF"}
                </span>
              </button>

              {/* Animations toggle */}
              <button
                onClick={() => { onAnimationsChange(!showAnimations); }}
                className="flex items-center justify-between w-full px-2 py-2 text-sm hover:bg-surface rounded-lg transition-colors"
              >
                <span className="flex items-center gap-3 text-fg/80">Animations</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${showAnimations ? "bg-emerald-500/20 text-emerald-400" : "bg-surface text-muted/70"}`}>
                  {showAnimations ? "ON" : "OFF"}
                </span>
              </button>

              {/* Sound toggle */}
              {onSoundChange && (
                <button
                  onClick={() => onSoundChange(!soundEnabled)}
                  className="flex items-center justify-between w-full px-2 py-2 text-sm hover:bg-surface rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-3 text-fg/80">
                    {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />} Sound effects
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${soundEnabled ? "bg-emerald-500/20 text-emerald-400" : "bg-surface text-muted/70"}`}>
                    {soundEnabled ? "ON" : "OFF"}
                  </span>
                </button>
              )}

              {/* Hanging pieces toggle */}
              {onShowHangingChange && (
                <button
                  onClick={() => onShowHangingChange(!showHanging)}
                  className="flex items-center justify-between w-full px-2 py-2 text-sm hover:bg-surface rounded-lg transition-colors"
                >
                  <span className="flex items-center gap-3 text-fg/80">
                    <AlertTriangle size={15} /> Hanging pieces
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${showHanging ? "bg-emerald-500/20 text-emerald-400" : "bg-surface text-muted/70"}`}>
                    {showHanging ? "ON" : "OFF"}
                  </span>
                </button>
              )}

              {/* Theme picker */}
              {onThemeChange && (
                <div className="border-t border-muted/25 pt-2 mt-1">
                  <p className="text-xs text-muted/70 px-2 mb-2">Theme</p>
                  <ThemePicker current={currentTheme} onChange={onThemeChange} />
                </div>
              )}

              {/* Engine depth */}
              {onDepthChange && (
                <div className="border-t border-muted/25 pt-2 mt-1">
                  <p className="text-xs text-muted/70 px-2 mb-2">Engine Depth</p>
                  <div className="flex gap-1">
                    {depths.map(d => (
                      <button
                        key={d}
                        onClick={() => { onDepthChange(d); setOpen(false); }}
                        className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition-colors ${
                          d === engineDepth
                            ? "bg-[var(--main)] text-bg"
                            : "text-muted hover:bg-surface"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Side indicator */}
              <button
                onClick={() => { onOrientationChange(boardOrientation === "white" ? "black" : "white"); setOpen(false); }}
                className="flex items-center gap-3 w-full px-2 py-2 text-sm text-fg/80 hover:text-fg hover:bg-surface rounded-lg transition-colors"
              >
                <RotateCcw size={15} /> Side: {boardOrientation === "white" ? "White" : "Black"}
              </button>

              <div className="border-t border-muted/25 pt-2 mt-1">
                <button
                  onClick={() => { onReset(); setOpen(false); }}
                  className="flex items-center gap-3 w-full px-2 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-surface rounded-lg transition-colors"
                >
                  Reset Game
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BoardSettings;
