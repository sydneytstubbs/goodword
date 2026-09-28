"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// Tooltip (DESIGN-SYSTEM.md 4.1.14): desktop only, supplementary only. It
// mirrors an icon-only button's label, so it's hidden from assistive tech.
// Appears after 500ms on hover, immediately on focus; Esc dismisses; the
// pointer can move onto it without it disappearing (WCAG 1.4.13).

export function Tooltip({
  content,
  children,
  side = "bottom",
}: {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const [dismissed, setDismissed] = useState(false);

  return (
    <span
      className="group/tip relative inline-flex"
      data-dismissed={dismissed || undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !dismissed) {
          setDismissed(true);
          e.stopPropagation();
        }
      }}
      onMouseLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-1/2 z-toast hidden -translate-x-1/2 whitespace-nowrap rounded-control bg-inverse px-2 py-1 text-caption text-inverse shadow-md fc-edge",
          "invisible opacity-0 transition duration-fast ease-standard",
          "pointer-fine:block group-hover/tip:visible group-hover/tip:opacity-100 group-hover/tip:delay-500 group-hover/tip:pointer-events-auto",
          "group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-focus-within/tip:delay-0",
          "group-data-dismissed/tip:invisible group-data-dismissed/tip:opacity-0",
          side === "bottom" ? "top-full mt-1" : "bottom-full mb-1",
        )}
      >
        {content}
      </span>
    </span>
  );
}
