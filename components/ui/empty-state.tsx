import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "../icon";

// Empty state (DESIGN-SYSTEM.md 4.1.18) and error state (4.1.19). Say why
// it's empty (or what failed) and what to do next. Left-aligned on mobile,
// centered on wide screens. No illustrations; at most three empty poster outlines.

type HeadingLevel = 2 | 3 | 4;

function Heading({ level, children }: { level: HeadingLevel; children: ReactNode }) {
  const Tag = `h${level}` as const;
  return <Tag className="text-title-m text-default">{children}</Tag>;
}

export function EmptyState({
  title,
  body,
  action,
  showShelf = false,
  headingLevel = 2,
  className,
}: {
  title: string;
  body: string;
  /** One primary action. */
  action?: ReactNode;
  /** Three dashed poster outlines: a shelf waiting to be filled. */
  showShelf?: boolean;
  headingLevel?: HeadingLevel;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-w-reading flex-col items-start gap-3 md:mx-auto md:items-center md:text-center",
        className,
      )}
    >
      {showShelf && (
        <div aria-hidden="true" className="mb-3 flex gap-3">
          {[0, 1, 2].map((i) => (
            <span key={i} className="aspect-2/3 w-16 rounded-poster border border-dashed border-subtle" />
          ))}
        </div>
      )}
      <Heading level={headingLevel}>{title}</Heading>
      <p className="text-body text-muted">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
  headingLevel = 2,
  className,
}: {
  title: string;
  body: string;
  /** The Retry button. */
  action: ReactNode;
  headingLevel?: HeadingLevel;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex max-w-reading flex-col items-start gap-3 md:mx-auto md:items-center md:text-center",
        className,
      )}
    >
      <Icon name="error" size={24} className="text-muted" />
      <Heading level={headingLevel}>{title}</Heading>
      <p className="text-body text-muted">{body}</p>
      <div className="mt-3">{action}</div>
    </div>
  );
}
