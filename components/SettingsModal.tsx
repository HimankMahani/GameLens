"use client";

import { FC, useEffect, useState } from "react";
import { Eye, EyeOff, ExternalLink, Settings as SettingsIcon, X, Sparkles, Trash2, Check, Loader2, AlertCircle } from "lucide-react";
import {
  GEMINI_MODELS,
  loadGeminiSettings,
  saveGeminiSettings,
  clearGeminiKey,
  validateGeminiKey,
} from "@/lib/gemini";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called whenever Gemini settings change so parents can re-render the Why button. */
  onChange?: () => void;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok" }
  | { status: "error"; message: string };

const SettingsModal: FC<SettingsModalProps> = ({ isOpen, onClose, onChange }) => {
  const [key, setKey] = useState("");
  const [model, setModel] = useState<string>(GEMINI_MODELS[0].id);
  const [enabled, setEnabled] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  useEffect(() => {
    if (!isOpen) return;
    const s = loadGeminiSettings();
    setKey(s.key);
    setModel(s.model);
    setEnabled(s.enabled);
    setShowKey(false);
    setSaved(false);
    setTest({ status: "idle" });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyChange = (value: string) => {
    setKey(value);
    // Reset any prior test result — it's stale once the key changes.
    if (test.status !== "idle") setTest({ status: "idle" });
    // Auto-enable when the user types a key, but only if they haven't already
    // opted out by un-ticking the box themselves this session.
    if (!enabled && value.trim().length > 0) setEnabled(true);
  };

  const handleSave = () => {
    saveGeminiSettings({ key: key.trim(), model, enabled: enabled && !!key.trim() });
    setSaved(true);
    onChange?.();
    setTimeout(() => setSaved(false), 1400);
  };

  const handleClear = () => {
    clearGeminiKey();
    setKey("");
    setEnabled(false);
    setTest({ status: "idle" });
    onChange?.();
  };

  const handleTest = async () => {
    if (!key.trim() || test.status === "testing") return;
    setTest({ status: "testing" });
    const result = await validateGeminiKey(key.trim(), model);
    if (result.ok) setTest({ status: "ok" });
    else setTest({ status: "error", message: result.error });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface ring-1 ring-muted/40 rounded-2xl shadow-2xl w-full max-w-md p-5 animate-[slide-up_220ms_ease-out_both] mx-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SettingsIcon size={14} className="text-fg/65" />
            <p className="text-sm font-semibold text-fg">Settings</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="rounded-xl bg-bg/40 ring-1 ring-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-cyan-300" />
            <p className="text-xs font-medium text-fg/90">Gemini "Why?" coach</p>
          </div>
          <p className="text-[11px] text-muted/85 leading-relaxed">
            Add your free Google AI Studio API key to get plain-English explanations of any move.
            The key is stored only in your browser — requests go directly to Google.{" "}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 hover:text-cyan-200 inline-flex items-center gap-0.5"
            >
              Get a key <ExternalLink size={9} />
            </a>
          </p>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted/70 font-medium">API key</label>
            <div className="relative mt-1">
              <input
                type={showKey ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="AIzaSy…"
                className="w-full h-10 pl-3 pr-10 text-sm bg-bg/70 ring-1 ring-muted/30 rounded-lg text-fg placeholder-muted/40 focus:outline-none focus:ring-muted/55 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-fg/90 transition-colors"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={handleTest}
                disabled={!key.trim() || test.status === "testing"}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 ring-1 ring-cyan-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {test.status === "testing" ? (
                  <><Loader2 size={10} className="animate-spin" /> Testing…</>
                ) : (
                  <>Test key</>
                )}
              </button>
              {test.status === "ok" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                  <Check size={11} /> Key works
                </span>
              )}
              {test.status === "error" && (
                <span className="inline-flex items-start gap-1 text-[11px] text-red-300 leading-snug">
                  <AlertCircle size={11} className="mt-px shrink-0" />
                  <span>{test.message}</span>
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted/70 font-medium">Model</label>
            <select
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                if (test.status !== "idle") setTest({ status: "idle" });
              }}
              className="mt-1 w-full h-10 px-2 text-sm bg-bg/70 ring-1 ring-muted/30 rounded-lg text-fg focus:outline-none focus:ring-muted/55"
            >
              {GEMINI_MODELS.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="accent-cyan-400"
            />
            <span className="text-xs text-fg/85">Enable Why coach button on move cards</span>
          </label>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={handleClear}
            disabled={!key}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 size={11} /> Forget key
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-fg/90 hover:bg-surface transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[var(--main)] text-bg text-xs font-medium rounded-lg hover:brightness-110 transition-all"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
