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
  align = "center",
}: {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
  /** "end" keeps tooltips on edge controls (top bar icons) inside the viewport. */
  align?: "center" | "end";
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
          "pointer-events-none absolute z-toast hidden whitespace-nowrap rounded-control bg-inverse px-2 py-1 text-caption text-inverse shadow-md fc-edge",
          // Out of layout until shown, so hidden tooltips never widen the page.
          "opacity-0 transition-discrete transition duration-fast ease-standard starting:opacity-0",
          "pointer-fine:group-hover/tip:block pointer-fine:group-hover/tip:opacity-100 pointer-fine:group-hover/tip:delay-500 pointer-fine:group-hover/tip:pointer-events-auto",
          "pointer-fine:group-focus-within/tip:block pointer-fine:group-focus-within/tip:opacity-100 pointer-fine:group-focus-within/tip:delay-0",
          "group-data-dismissed/tip:hidden",
          align === "center" ? "left-1/2 -translate-x-1/2" : "end-0",
          side === "bottom" ? "top-full mt-1" : "bottom-full mb-1",
        )}
      >
        {content}
      </span>
    </span>
  );
}
