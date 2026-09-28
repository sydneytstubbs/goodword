"use client";

import NextLink from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { peopleTone, toneBg, type PeopleTone } from "@/lib/people-color";
import { Icon } from "../icon";

// Chips (DESIGN-SYSTEM.md 4.1.9). Group chip says which shelf; filter chip
// narrows what's shown. Visual height 32px, hit area 44px.

export type Group = { id: string; name: string };

export function GroupDot({
  group,
  tone,
  className,
}: {
  group: Pick<Group, "id">;
  /** Normally derived from the group id; set it to pin a tone (marketing mockups). */
  tone?: PeopleTone;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 rounded-pill", toneBg[tone ?? peopleTone(group.id)], className)}
    />
  );
}

const groupChipClass =
  "relative inline-flex h-8 items-center gap-2 rounded-pill bg-surface-sunken px-3 text-caption font-medium text-default fc-edge";

/** Not interactive, unless `href` makes it a link to that shelf. */
export function GroupChip({ group, href }: { group: Group; href?: string }) {
  const content = (
    <>
      <GroupDot group={group} />
      {group.name}
    </>
  );
  if (!href) return <span className={groupChipClass}>{content}</span>;
  return (
    <NextLink
      href={href}
      className={cn(
        groupChipClass,
        "transition duration-fast ease-standard hover:bg-surface-hover active:bg-surface-pressed before:absolute before:inset-x-0 before:-inset-y-1.5",
      )}
    >
      {content}
    </NextLink>
  );
}

export type FilterChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  label: string;
  selected: boolean;
  /** Optional count, e.g. "Netflix 12". */
  count?: number;
};

export function FilterChip({ label, selected, count, className, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "relative inline-flex h-8 shrink-0 items-center gap-1 rounded-pill px-3 text-label font-medium transition duration-fast ease-standard",
        "before:absolute before:inset-x-0 before:-inset-y-1.5 motion-ok:active:scale-98 fc-edge",
        selected
          ? "bg-inverse text-inverse fc-selected"
          : "border border-subtle bg-surface-raised text-default hover:bg-surface-hover active:bg-surface-pressed",
        className,
      )}
      {...props}
    >
      {selected && <Icon name="vouched" size={16} />}
      {label}
      {count !== undefined && (
        <span className={cn("tabular-nums", selected ? "text-inverse" : "text-muted")}>{count}</span>
      )}
    </button>
  );
}
