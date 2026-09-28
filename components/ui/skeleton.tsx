import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Skeleton (DESIGN-SYSTEM.md 4.1.17): sunken blocks matching the final
// layout's shapes exactly, with a slow pulse (static under reduced motion).

export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block bg-surface-sunken motion-ok:animate-pulse", className)} />;
}

/** A content region that's loading: aria-busy plus a hidden "Loading shelf". */
export function SkeletonRegion({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
