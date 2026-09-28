"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// Phone frame (spec 7.6): a simple device outline around real HTML built
// from DS components at 390px wide, scaled to fit. Never a screenshot. The
// screen is inert (not focusable, hidden from assistive tech); `label`
// describes what it shows instead.

export function PhoneFrame({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  const viewport = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      el.style.setProperty("--phone-scale", String(entry.contentRect.width / 390));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div role="img" aria-label={label} className={cn("w-full", className)}>
      <div className="rounded-device border-10 border-default bg-default shadow-lg">
        <div ref={viewport} className="phone-viewport relative overflow-hidden rounded-device-screen bg-surface">
          <div inert className="phone-screen absolute top-0 left-0 bg-surface">
            {children}
          </div>
          <div aria-hidden="true" className="absolute top-2 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-pill bg-default" />
        </div>
      </div>
    </div>
  );
}
