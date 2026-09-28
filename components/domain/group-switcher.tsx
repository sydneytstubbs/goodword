"use client";

import NextLink from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { AvatarStack } from "../ui/avatar";
import { GroupDot } from "../ui/chip";
import { Sheet } from "../ui/sheet";
import { TextLink } from "../ui/text-link";
import type { Group, Person } from "./types";

// Group switcher (DESIGN-SYSTEM.md 4.2.5): the top-bar control naming the
// current shelf. "All groups" is an explicit, labeled choice.

export type SwitcherGroup = Group & { members: Person[] };

export const ALL_GROUPS = "all";

export function GroupSwitcher({
  groups,
  currentId,
  hrefFor,
  onSelect,
}: {
  /** Sorted by recent activity. */
  groups: SwitcherGroup[];
  /** A group id, or ALL_GROUPS. */
  currentId: string;
  hrefFor: (groupId: string) => string;
  onSelect?: (groupId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = currentId === ALL_GROUPS ? t("groups.allGroups") : groups.find((g) => g.id === currentId)?.name;
  const rows = [{ id: ALL_GROUPS, name: t("groups.allGroups"), members: [] as Person[] }, ...groups];

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("groups.switcherLabel", { name: current ?? "" })}
        onClick={() => setOpen(true)}
        className="-ms-2 inline-flex min-h-target min-w-0 items-center gap-1 rounded-control px-2 text-heading text-default transition duration-fast ease-standard hover:bg-surface-hover active:bg-surface-pressed"
      >
        <span className="truncate">{current}</span>
        <Icon name="switcher" size={20} className="shrink-0" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("groups.sheetTitle")}>
        <ul className="flex flex-col">
          {rows.map((group) => {
            const isCurrent = group.id === currentId;
            return (
              <li key={group.id}>
                <NextLink
                  href={hrefFor(group.id)}
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={(e) => {
                    if (onSelect) {
                      e.preventDefault();
                      onSelect(group.id);
                    }
                    setOpen(false);
                  }}
                  className={cn(
                    "-mx-2 flex min-h-14 items-center gap-3 rounded-control px-2 transition duration-fast ease-standard hover:bg-surface-hover",
                    isCurrent && "bg-surface-sunken fc-selected",
                  )}
                >
                  {group.id === ALL_GROUPS ? (
                    <Icon name="group" size={20} className="text-muted" />
                  ) : (
                    <span className="grid size-5 place-items-center">
                      <GroupDot group={group} />
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn("truncate text-body text-default", isCurrent && "font-semibold")}>
                      {group.name}
                    </span>
                    {group.members.length > 0 && (
                      <span className="text-caption text-muted">
                        {t("groups.members", { count: group.members.length })}
                      </span>
                    )}
                  </span>
                  {group.members.length > 0 && <AvatarStack people={group.members} size={24} ring="surface-raised" />}
                  {isCurrent && <Icon name="vouched" size={20} className="text-default" />}
                </NextLink>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 border-t border-subtle pt-3">
          <TextLink href="/groups/new" variant="standalone" className="gap-2">
            <Icon name="add" size={20} />
            {t("groups.createGroup")}
          </TextLink>
        </div>
      </Sheet>
    </>
  );
}
