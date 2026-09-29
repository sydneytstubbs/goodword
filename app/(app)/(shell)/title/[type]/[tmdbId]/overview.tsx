"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";

// The overview, collapsed to three lines with More when it's longer (DS 5.7).
// The full text is always in the DOM, so screen readers and find-in-page get it all.
export function Overview({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <div className="flex max-w-reading flex-col items-start gap-1">
      <p ref={ref} id="overview" className={cn("text-body text-default", !expanded && "line-clamp-3")}>
        {text}
      </p>
      {overflows && !expanded && (
        <button
          type="button"
          aria-expanded={false}
          aria-controls="overview"
          onClick={() => setExpanded(true)}
          className="-mx-1 inline-flex min-h-target items-center rounded-control px-1 text-label font-medium text-action-text hover:underline hover:underline-offset-3"
        >
          {t("title.more")}
        </button>
      )}
    </div>
  );
}
