"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { prefersReducedMotion } from "@/lib/hooks";

// Shared behavior for sheets and dialogs (DESIGN-SYSTEM.md 4.1.13), built on
// the native <dialog>: showModal() traps focus and makes the page inert.
// Focus moves to the first meaningful element, Esc and scrim tap close
// (unless the scrim is disabled), focus returns to the trigger, and body
// scroll locks. Exits play their faster animation before closing.

const EXIT_MS = 200;

export function useModal({
  open,
  onClose,
  dismissOnScrim = true,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  dismissOnScrim?: boolean;
  initialFocus?: () => HTMLElement | null | undefined;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const finishClose = useCallback(() => {
    const dialog = ref.current;
    if (!dialog) return;
    delete dialog.dataset.closing;
    if (dialog.open) dialog.close();
    delete document.documentElement.dataset.scrollLock;
    returnFocus.current?.focus();
    returnFocus.current = null;
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      document.documentElement.dataset.scrollLock = "";
      const target = initialFocus?.() ?? dialog.querySelector<HTMLElement>("[data-autofocus]");
      target?.focus();
    } else if (!open && dialog.open) {
      if (prefersReducedMotion()) {
        finishClose();
        return;
      }
      // data-closing plays the exit animation (a DOM attribute, not React state).
      dialog.dataset.closing = "";
      const timer = setTimeout(finishClose, EXIT_MS);
      return () => clearTimeout(timer);
    }
  }, [open, finishClose, initialFocus]);

  // Never leave the page scroll-locked if the component unmounts while open.
  useEffect(() => () => void delete document.documentElement.dataset.scrollLock, []);

  const dialogProps = {
    ref: ref as RefObject<HTMLDialogElement>,
    onCancel: (e: React.SyntheticEvent) => {
      // Esc: animate out through the parent's state instead of closing instantly.
      e.preventDefault();
      onClose();
    },
    onClick: (e: React.MouseEvent<HTMLDialogElement>) => {
      // A click on the <dialog> itself (not its content) is a click on the scrim.
      if (dismissOnScrim && e.target === e.currentTarget) onClose();
    },
  };

  return { dialogProps, ref };
}
