"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { IconButton } from "./icon-button";
import { useToast } from "./toast";

// Milestone moment (DESIGN-SYSTEM.md 4.1.20): a quiet card for the few
// moments worth marking. Fades and rises into place once, and is announced
// once. No confetti, stickers, badges, or sounds.

export function Milestone({
  line,
  body,
  onDismiss,
  className,
}: {
  /** "Your first good word." */
  line: string;
  body: string;
  onDismiss: () => void;
  className?: string;
}) {
  const { announce } = useToast();
  const announced = useRef(false);

  useEffect(() => {
    if (announced.current) return;
    announced.current = true;
    announce(t("milestone.announce", { text: line }));
  }, [announce, line]);

  return (
    <section
      aria-label={line}
      className={cn(
        "relative rounded-card border border-subtle bg-surface-raised p-6 pe-16 shadow-sm fc-edge motion-ok:animate-rise",
        className,
      )}
    >
      <p className="text-display-m text-default">{line}</p>
      <p className="mt-2 text-body text-muted">{body}</p>
      <div className="absolute top-2 end-2">
        <IconButton icon="close" label={t("common.close")} tone="muted" onClick={onDismiss} />
      </div>
    </section>
  );
}
