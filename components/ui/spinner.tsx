import { cn } from "@/lib/cn";

// Spinner (DESIGN-SYSTEM.md 4.1.17): only inside buttons and small inline
// actions, never for a content region. Static under reduced motion.
export function Spinner({ size = 16, className }: { size?: 16 | 20; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={cn("motion-ok:animate-spin", className)}
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M18 10a8 8 0 0 0-8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
