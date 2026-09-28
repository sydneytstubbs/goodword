"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { t } from "@/lib/messages";
import { Icon } from "../icon";

// Spoiler cover (DESIGN-SYSTEM.md 4.2.12). The body isn't rendered until
// revealed (never a blur over real text), so screen readers and
// find-in-page can't expose it. Revealing lasts for the session.
//
// `children` is a render function so the body isn't even created before
// reveal. In the app, it'll fetch the body on reveal (step 6).

export function SpoilerCover({
  authorName,
  children,
  revealed: revealedProp,
  onReveal,
}: {
  authorName: string;
  children: () => ReactNode;
  revealed?: boolean;
  onReveal?: () => void;
}) {
  const [revealedState, setRevealed] = useState(false);
  const revealed = revealedProp ?? revealedState;
  const bodyRef = useRef<HTMLDivElement>(null);
  const justRevealed = useRef(false);

  useEffect(() => {
    if (revealed && justRevealed.current) {
      justRevealed.current = false;
      bodyRef.current?.focus();
    }
  }, [revealed]);

  if (revealed) {
    return (
      <div ref={bodyRef} tabIndex={-1} className="rounded-control">
        {children()}
      </div>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={false}
      onClick={() => {
        justRevealed.current = true;
        setRevealed(true);
        onReveal?.();
      }}
      className="flex min-h-target w-full items-center gap-2 rounded-control border border-dashed border-strong bg-surface-sunken px-3 py-2 text-start text-caption text-muted transition duration-fast ease-standard hover:bg-surface-hover"
    >
      <Icon name="spoiler" size={16} className="shrink-0" />
      {t("spoiler.cover", { name: authorName })}
    </button>
  );
}
