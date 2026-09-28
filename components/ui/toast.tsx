"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/hooks";

// Toast (DESIGN-SYSTEM.md 4.1.15, 7.2). One polite live region, created at
// app load (not on demand, which some screen readers miss). Max one toast;
// a new one replaces the old. 5s, or 8s with an action; the timer pauses on
// hover and focus. Bottom-center above the tab bar; bottom-left on desktop.

export type ToastOptions = {
  message: string;
  action?: { label: string; onAction: () => void };
};

type ToastState = ToastOptions & { id: number; leaving: boolean };

type ToastContextValue = {
  showToast: (toast: ToastOptions) => void;
  dismissToast: () => void;
  /** Screen-reader-only status message through the same polite region. */
  announce: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>");
  return context;
}

const EXIT_MS = 120;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const nextId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const remaining = useRef(0);
  const startedAt = useRef(0);

  const remove = useCallback(() => {
    clearTimeout(timer.current);
    if (prefersReducedMotion()) {
      setToast(null);
      return;
    }
    setToast((current) => (current ? { ...current, leaving: true } : null));
    setTimeout(() => setToast((current) => (current?.leaving ? null : current)), EXIT_MS);
  }, []);

  const start = useCallback(
    (ms: number) => {
      clearTimeout(timer.current);
      remaining.current = ms;
      startedAt.current = Date.now();
      timer.current = setTimeout(remove, ms);
    },
    [remove],
  );

  const showToast = useCallback(
    (options: ToastOptions) => {
      nextId.current += 1;
      setToast({ ...options, id: nextId.current, leaving: false });
      start(options.action ? 8000 : 5000);
    },
    [start],
  );

  const announce = useCallback((message: string) => {
    // Clear first so repeating the same message is announced again.
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(message));
  }, []);

  function pause() {
    clearTimeout(timer.current);
    remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
  }

  function resume() {
    if (toast && !toast.leaving) start(Math.max(remaining.current, 1500));
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast: remove, announce }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-toast z-toast flex justify-center px-5 lg:bottom-6 lg:justify-start lg:px-6"
      >
        {toast && (
          <div key={toast.id} onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume}>
            <ToastView
              message={toast.message}
              action={toast.action ? { label: toast.action.label, onAction: () => { toast.action?.onAction(); remove(); } } : undefined}
              className={cn(
                "pointer-events-auto",
                toast.leaving ? "motion-ok:animate-toast-out" : "motion-ok:animate-toast-in",
              )}
            />
          </div>
        )}
        <span className="sr-only">{announcement}</span>
      </div>
    </ToastContext.Provider>
  );
}

/** The toast's visual. Exported so /styleguide can show it statically. */
export function ToastView({
  message,
  action,
  className,
}: {
  message: string;
  action?: { label: string; onAction: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-12 max-w-reading items-center gap-4 rounded-control bg-inverse px-4 py-3 text-body text-inverse shadow-lg fc-edge",
        className,
      )}
    >
      <p className="flex-1">{message}</p>
      {action && (
        <button
          type="button"
          onClick={action.onAction}
          className="relative -my-2 min-h-target shrink-0 px-1 font-semibold text-inverse underline decoration-inverse underline-offset-3"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
