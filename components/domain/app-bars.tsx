"use client";

import NextLink from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { Icon, type IconName } from "../icon";
import { Button } from "../ui/button";
import { CountBadge, UnreadDot } from "../ui/badge";
import { GroupDot } from "../ui/chip";
import { IconButton } from "../ui/icon-button";
import { Tooltip } from "../ui/tooltip";
import type { Group } from "./types";
import { Wordmark } from "./wordmark";

// App bars and navigation (DESIGN-SYSTEM.md 4.2.8, 8.1). Top bar and tab bar
// on mobile and tablet; a 240px rail from 1024px. Add is a command (it opens
// the log sheet), not a destination. `placement="inline"` renders a bar in
// the page flow, for /styleguide.

type Placement = "fixed" | "inline";
export type Destination = "shelf" | "activity" | "you";

/** Icon-only link with the icon button's look (the Activity bell navigates). */
function IconLink({ href, icon, label, badge }: { href: string; icon: IconName; label: string; badge?: ReactNode }) {
  return (
    <Tooltip content={label} align="end">
      <NextLink
        href={href}
        aria-label={label}
        className="group relative grid size-target place-items-center rounded-control text-default"
      >
        <span
          aria-hidden="true"
          className="absolute inset-1 rounded-control transition duration-fast ease-standard group-hover:bg-surface-hover group-active:bg-surface-pressed"
        />
        <span className="relative">
          <Icon name={icon} size={24} />
          {badge && <span className="absolute -top-2 -right-2">{badge}</span>}
        </span>
      </NextLink>
    </Tooltip>
  );
}

/** The Activity bell with its unread count (4.2.8, 4.1.11). */
export function ActivityBell({ count = 0 }: { count?: number }) {
  return (
    <IconLink
      href="/activity"
      icon="activity"
      label={count > 0 ? t("nav.activityWithCount", { count }) : t("nav.activity")}
      badge={count > 0 ? <CountBadge count={count} label="" /> : undefined}
    />
  );
}

export function TopBar({
  switcher,
  groupName,
  activityCount = 0,
  onInvite,
  scrolled = false,
  placement = "fixed",
}: {
  /** The GroupSwitcher. */
  switcher: ReactNode;
  groupName: string;
  activityCount?: number;
  onInvite: () => void;
  /** A hairline appears only once content scrolls under the bar. */
  scrolled?: boolean;
  placement?: Placement;
}) {
  return (
    <header
      className={cn(
        "flex h-topbar items-center justify-between gap-2 bg-surface ps-5 pe-3",
        placement === "fixed" && "sticky top-0 z-nav pt-safe",
        scrolled ? "border-b border-subtle" : "border-b border-transparent",
      )}
    >
      <div className="min-w-0">{switcher}</div>
      <div className="flex items-center">
        <ActivityBell count={activityCount} />
        <IconButton
          icon="share"
          iconSize={24}
          label={t("nav.invite", { group: groupName })}
          onClick={onInvite}
          tooltipAlign="end"
        />
      </div>
    </header>
  );
}

const tabs: Array<{ id: Exclude<Destination, "activity">; href: string; icon: IconName; label: () => string }> = [
  { id: "shelf", href: "/shelf", icon: "shelf", label: () => t("nav.shelf") },
  { id: "you", href: "/you", icon: "you", label: () => t("nav.you") },
];

function TabLink({ tab, current, dot = false }: { tab: (typeof tabs)[number]; current: boolean; dot?: boolean }) {
  return (
    <NextLink
      href={tab.href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-target flex-1 flex-col items-center justify-center gap-0.5 text-caption transition duration-fast ease-standard",
        current ? "font-semibold text-default" : "text-muted hover:text-default",
      )}
    >
      <span className="relative">
        <Icon name={tab.icon} size={24} weight={current ? "fill" : "regular"} />
        {dot && <UnreadDot label={t("shelf.hasNew")} className="absolute -top-0.5 -right-1" />}
      </span>
      {tab.label()}
    </NextLink>
  );
}

export function TabBar({
  current,
  shelfDot = false,
  onAdd,
  placement = "fixed",
  label,
}: {
  current?: Exclude<Destination, "activity">;
  /** Some group has new good words since you last looked (PRD F5.5). */
  shelfDot?: boolean;
  onAdd: () => void;
  placement?: Placement;
  /** Landmark name; defaults to "Main". */
  label?: string;
}) {
  return (
    <nav
      aria-label={label ?? t("nav.main")}
      className={cn(
        "border-t border-subtle bg-surface pb-safe",
        placement === "fixed" && "fixed inset-x-0 bottom-0 z-nav lg:hidden",
      )}
    >
      <div className="flex h-tabbar items-center">
        <TabLink tab={tabs[0]} current={current === "shelf"} dot={shelfDot} />
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            onClick={onAdd}
            aria-label={t("nav.add")}
            className="grid size-11 place-items-center rounded-pill bg-action text-on-action shadow-md transition duration-fast ease-standard hover:bg-action-hover active:bg-action-hover motion-ok:active:scale-98 fc-edge"
          >
            <Icon name="add" size={24} />
          </button>
        </div>
        <TabLink tab={tabs[1]} current={current === "you"} />
      </div>
    </nav>
  );
}

const railLinks: Array<{ id: Destination; href: string; icon: IconName; label: () => string }> = [
  { id: "shelf", href: "/shelf", icon: "shelf", label: () => t("nav.shelf") },
  { id: "activity", href: "/activity", icon: "activity", label: () => t("nav.activity") },
  { id: "you", href: "/you", icon: "you", label: () => t("nav.you") },
];

const railRow =
  "flex h-10 items-center gap-3 rounded-control px-3 text-body transition duration-fast ease-standard hover:bg-surface-hover active:bg-surface-pressed";

export function Rail({
  current,
  activityCount = 0,
  newCounts = {},
  groups,
  currentGroupId,
  onAdd,
  placement = "fixed",
  label,
  hide = [],
}: {
  current?: Destination;
  activityCount?: number;
  /** New good words per group since you last looked (PRD F5.5). */
  newCounts?: Record<string, number>;
  groups: Group[];
  currentGroupId?: string;
  onAdd: () => void;
  placement?: Placement;
  /** Landmark name; defaults to "Main". */
  label?: string;
  /** Links to leave out while their screens are still being built. */
  hide?: Array<Destination | "help">;
}) {
  return (
    <nav
      aria-label={label ?? t("nav.main")}
      className={cn(
        "flex w-60 flex-col gap-6 border-e border-subtle bg-surface px-4 py-6",
        placement === "fixed" ? "fixed inset-y-0 start-0 z-nav hidden lg:flex" : "min-h-120",
      )}
    >
      <NextLink href="/shelf" className="self-start rounded-control px-2">
        <Wordmark />
      </NextLink>
      <Button variant="primary" size="md" icon="add" fullWidth onClick={onAdd}>
        {t("vouch.put")}
      </Button>
      <ul className="flex flex-col gap-1">
        {railLinks.filter((link) => !hide.includes(link.id)).map((link) => {
          const isCurrent = current === link.id;
          const count = link.id === "activity" ? activityCount : 0;
          // On a group's shelf the group row is the page; Shelf is the section it's in.
          const ariaCurrent = isCurrent ? (link.id === "shelf" && currentGroupId ? "true" : "page") : undefined;
          return (
            <li key={link.id}>
              <NextLink
                href={link.href}
                aria-current={ariaCurrent}
                className={cn(railRow, isCurrent ? "bg-surface-sunken font-semibold text-default fc-selected" : "text-default")}
              >
                <Icon name={link.icon} size={20} weight={isCurrent ? "fill" : "regular"} />
                <span className="flex-1">{link.label()}</span>
                {count > 0 && <CountBadge count={count} />}
                {link.id === "shelf" && Object.values(newCounts).some((n) => n > 0) && <UnreadDot label={t("shelf.hasNew")} />}
              </NextLink>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col gap-1">
        <h2 className="px-3 text-caption font-semibold text-muted">{t("groups.groupsHeading")}</h2>
        <ul className="flex flex-col gap-1">
          {groups.map((group) => {
            const isCurrent = group.id === currentGroupId;
            return (
              <li key={group.id}>
                <NextLink
                  href={`/shelf/${group.id}`}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(railRow, isCurrent ? "bg-surface-sunken font-semibold text-default fc-selected" : "text-default")}
                >
                  <GroupDot group={group} />
                  <span className="flex-1 truncate">{group.name}</span>
                  <CountBadge count={newCounts[group.id] ?? 0} label={t("shelf.newCount", { count: newCounts[group.id] ?? 0 })} />
                </NextLink>
              </li>
            );
          })}
        </ul>
      </div>
      {/* Help sits in the same place on every screen (DS 5.16, WCAG 3.2.6). */}
      <div className={cn("mt-auto", hide.includes("help") && "hidden")}>
        <NextLink href="/you/help" className={cn(railRow, "text-muted hover:text-default")}>
          <Icon name="help" size={20} />
          {t("nav.help")}
        </NextLink>
      </div>
    </nav>
  );
}
