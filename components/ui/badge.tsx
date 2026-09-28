import { cn } from "@/lib/cn";
import { badgeCount } from "@/lib/format";
import { t } from "@/lib/messages";

// Badges (DESIGN-SYSTEM.md 4.1.11). Always with a text equivalent.

/** Count badge: unread Activity, new comments. Never above "99+". */
export function CountBadge({ count, label, className }: { count: number; label?: string; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-pill bg-action px-1 text-caption font-semibold text-on-action tabular-nums fc-edge",
        className,
      )}
    >
      <span aria-hidden="true">{badgeCount(count)}</span>
      <span className="sr-only">{label ?? t("count.unread", { count })}</span>
    </span>
  );
}

/** Label badge: "New" on cards. */
export function LabelBadge({ children, className }: { children?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-pill bg-action-wash px-2 text-caption font-semibold text-action-text fc-edge",
        className,
      )}
    >
      {children ?? t("common.new")}
    </span>
  );
}

/** Unread dot: a 6 or 8px action dot, with its meaning in words for screen readers. */
export function UnreadDot({ size = 8, label, className }: { size?: 6 | 8; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex", className)}>
      <span aria-hidden="true" className={cn("rounded-pill bg-action fc-edge", size === 6 ? "size-1.5" : "size-2")} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}
