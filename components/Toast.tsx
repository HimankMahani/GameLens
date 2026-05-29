"use client";

import { FC, useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ToastKind = "error" | "success" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastData {
  kind: ToastKind;
  msg: string;
  action?: ToastAction;
}

const ICON = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
};

const COLORS: Record<ToastKind, string> = {
  error: "bg-red-500/10 ring-red-500/40 text-red-300",
  success: "bg-emerald-500/10 ring-emerald-500/40 text-emerald-300",
  info: "bg-surface ring-muted/40 text-fg/90",
};

interface ToastProps {
  toast: ToastData | null;
  onDismiss: () => void;
  /** ms before auto-dismissing. 0 = never. */
  duration?: number;
}

export const Toast: FC<ToastProps> = ({ toast, onDismiss, duration = 4500 }) => {
  useEffect(() => {
    if (!toast || duration <= 0) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [toast, duration, onDismiss]);

  if (!toast) return null;
  const Icon = ICON[toast.kind];
  const isError = toast.kind === "error";

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none max-w-[calc(100vw-2rem)]">
      <div
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        aria-atomic="true"
        className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl ring-1 backdrop-blur-md shadow-2xl ${COLORS[toast.kind]} animate-[slide-in-right_240ms_cubic-bezier(0.34,1.56,0.64,1)_both]`}
      >
        <Icon size={14} />
        <span className="text-xs font-medium">{toast.msg}</span>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick();
              onDismiss();
            }}
            className="ml-1 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
