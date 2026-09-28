"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { IconButton } from "./icon-button";
import { useModal } from "./use-modal";

// Sheet (DESIGN-SYSTEM.md 4.1.13, 8.1): mobile tasks and pickers. Slides up
// from the bottom; 560px wide and centered on tablets; a centered modal up to
// 480px on desktop. Header and primary action stay pinned; content scrolls.
// Swipe down on the header to dismiss; the close button is the visible alternative.

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Pinned to the bottom, e.g. the sheet's primary action. */
  footer?: ReactNode;
  className?: string;
};

const DISMISS_DISTANCE = 96;

export function Sheet({ open, onClose, title, children, footer, className }: SheetProps) {
  const titleId = useId();
  const bodyRef = useRef<HTMLDivElement>(null);
  const initialFocus = useCallback(
    () => bodyRef.current?.querySelector<HTMLElement>("input, textarea, select, [data-autofocus]"),
    [],
  );
  const { dialogProps, ref } = useModal({ open, onClose, initialFocus });

  // Keep the sheet above the iOS keyboard (8.2).
  useEffect(() => {
    const viewport = window.visualViewport;
    const dialog = ref.current;
    if (!open || !viewport || !dialog) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      dialog.style.setProperty("--keyboard-inset", `${inset}px`);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [open, ref]);

  // Swipe-to-dismiss on the header (touch only; below the desktop breakpoint).
  const drag = useRef<{ startY: number; dy: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== "touch" || window.matchMedia("(min-width: 64rem)").matches) return;
    drag.current = { startY: e.clientY, dy: 0 };
  }
  function onPointerMove(e: React.PointerEvent) {
    const dialog = ref.current;
    if (!drag.current || !dialog) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.startY);
    dialog.style.translate = `0 ${drag.current.dy}px`;
  }
  function onPointerEnd() {
    const dialog = ref.current;
    if (!drag.current || !dialog) return;
    const dismissed = drag.current.dy > DISMISS_DISTANCE;
    drag.current = null;
    dialog.style.translate = "";
    if (dismissed) onClose();
  }

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      className={cn(
        "fixed inset-x-0 top-auto bottom-0 m-0 mx-auto mb-keyboard flex w-full max-w-none max-h-sheet flex-col overflow-hidden p-0",
        "rounded-t-sheet bg-surface-raised text-default shadow-lg fc-edge backdrop:bg-scrim",
        "not-open:hidden overscroll-contain md:max-w-140",
        "lg:top-0 lg:mb-auto lg:mt-auto lg:max-w-120 lg:rounded-card",
        "motion-ok:open:animate-sheet-in motion-ok:data-closing:animate-sheet-out",
        "lg:motion-ok:open:animate-dialog-in lg:motion-ok:data-closing:animate-dialog-out",
        "motion-ok:backdrop:animate-fade-in",
        className,
      )}
    >
      <div
        className="shrink-0 touch-none px-5 pt-2 pb-3 lg:pt-5"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-9 rounded-pill bg-subtle lg:hidden" />
        <div className="flex items-center justify-between gap-3">
          <h2 id={titleId} className="text-title-m text-default">
            {title}
          </h2>
          <IconButton icon="close" label={t("common.close")} onClick={onClose} className="-me-3" />
        </div>
      </div>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        {children}
      </div>
      {footer && <div className="shrink-0 border-t border-subtle px-5 pt-3 pb-safe-footer">{footer}</div>}
    </dialog>
  );
}
