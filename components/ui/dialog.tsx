"use client";

import { useCallback, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useModal } from "./use-modal";

// Dialog (DESIGN-SYSTEM.md 4.1.13, 5.11): decisions only. A title that asks
// the specific question, one sentence of consequence, then the safe action
// first and the committing action last. Irreversible dialogs ignore scrim taps.

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  /** Actions in reading order: safe first, committing last. */
  actions: ReactNode;
  /** Guarding an irreversible action: the scrim does nothing (Esc still cancels). */
  irreversible?: boolean;
};

export function Dialog({ open, onClose, title, description, actions, irreversible = false }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const initialFocus = useCallback(() => titleRef.current, []);
  const { dialogProps } = useModal({ open, onClose, dismissOnScrim: !irreversible, initialFocus });

  return (
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn(
        "m-auto w-dialog max-w-100 rounded-card bg-surface-raised p-6 text-default shadow-lg fc-edge backdrop:bg-scrim",
        "motion-ok:open:animate-dialog-in motion-ok:data-closing:animate-dialog-out motion-ok:backdrop:animate-fade-in",
      )}
    >
      <h2 ref={titleRef} id={titleId} tabIndex={-1} className="text-title-m text-default">
        {title}
      </h2>
      <p id={descriptionId} className="mt-2 text-body text-muted">
        {description}
      </p>
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-end">{actions}</div>
    </dialog>
  );
}
