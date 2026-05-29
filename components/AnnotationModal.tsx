"use client";

import { FC, useState, useRef, useEffect } from "react";
import { X, MessageSquare } from "lucide-react";

interface AnnotationModalProps {
  isOpen: boolean;
  initialText?: string;
  moveSan?: string;
  onSave: (text: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const AnnotationModal: FC<AnnotationModalProps> = ({
  isOpen,
  initialText = "",
  moveSan,
  onSave,
  onDelete,
  onClose,
}) => {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(initialText);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen, initialText]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = text.trim();
    if (trimmed) {
      onSave(trimmed);
    } else if (onDelete) {
      onDelete();
    }
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) onDelete();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-muted/40 rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-blue-400" />
            <span className="text-sm font-medium text-fg/90">
              {moveSan ? `Note — ${moveSan}` : "Add Note"}
            </span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-fg/90 transition-colors">
            <X size={16} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. Interesting tactical idea, but position is equal..."
          className="w-full h-28 bg-bg border border-muted/40 rounded-xl p-3 text-sm text-fg/90 placeholder-muted/40 resize-none focus:outline-none focus:ring-2 focus:ring-muted/50"
          onKeyDown={e => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
            if (e.key === "Escape") onClose();
          }}
        />

        <div className="flex items-center gap-2 mt-3">
          <p className="text-[10px] text-muted/70 flex-1">⌘↵ to save · Esc to cancel</p>
          {onDelete && (
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-[var(--main)] text-bg text-xs font-medium rounded-lg hover:brightness-110 transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnotationModal;
