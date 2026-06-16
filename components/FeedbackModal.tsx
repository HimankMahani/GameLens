"use client";

import { FC } from "react";
import { Bug, ExternalLink, Lightbulb, MessageCircle, X } from "lucide-react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEEDBACK_FORM_URL = "https://tally.so/r/q4N8G7";
const GITHUB_ISSUES_URL = "https://github.com/HimankMahani/GameLens/issues/new";

const FeedbackModal: FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface ring-1 ring-muted/40 rounded-2xl shadow-2xl w-full max-w-sm p-5 animate-[slide-up_220ms_ease-out_both]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MessageCircle size={14} className="text-fg/65" />
            <p className="text-sm font-semibold text-fg">Help & feedback</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-muted/85 mb-4 leading-snug">
          Found a bug, have an idea, or just want to say hi? Pick whichever feels easier.
        </p>

        <div className="space-y-2">
          <a
            href={FEEDBACK_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 px-3 py-3 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/25 hover:bg-emerald-500/15 transition-colors"
          >
            <Lightbulb size={16} className="text-emerald-300 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-200">Send feedback</p>
              <p className="text-[11px] text-emerald-100/65 leading-snug mt-0.5">
                Quick form — bugs, ideas, anything. No account needed.
              </p>
            </div>
          </a>

          <a
            href={GITHUB_ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 px-3 py-3 rounded-xl bg-white/[0.04] ring-1 ring-muted/25 hover:bg-white/[0.08] transition-colors"
          >
            <ExternalLink size={16} className="text-fg/70 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg/90">Open a GitHub issue</p>
              <p className="text-[11px] text-muted leading-snug mt-0.5">
                For developers — include PGN + steps to reproduce.
              </p>
            </div>
          </a>
        </div>

        <p className="text-[10px] text-muted/60 mt-4 text-center flex items-center justify-center gap-1.5">
          <Bug size={10} /> Thanks for helping make GameLens better
        </p>
      </div>
    </div>
  );
};

export default FeedbackModal;
