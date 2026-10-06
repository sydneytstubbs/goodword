"use client";

import { t } from "@/lib/messages";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";
import { Menu } from "../ui/menu";
import type { Person } from "./types";

// Person row (DESIGN-SYSTEM.md 4.2.16): one person on the Friends screen. A
// request to you (Accept, Decline), one you sent (Cancel), someone from your
// groups (Add), or a friend (a menu with Remove friend). Never any counts.

export type PersonRowVariant = "incoming" | "sent" | "fromGroup" | "friend";

export function PersonRow({
  person,
  variant,
  groupName,
  busy = false,
  onAccept,
  onDecline,
  onCancel,
  onAdd,
  onRemove,
}: {
  person: Person;
  variant: PersonRowVariant;
  /** For someone from your groups: the group you share ("In College crew"). */
  groupName?: string;
  /** While a write for this row is in flight. */
  busy?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onCancel?: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
}) {
  const caption =
    variant === "incoming"
      ? t("friends.wantsToBeFriends")
      : variant === "sent"
        ? t("friends.requested")
        : variant === "fromGroup" && groupName
          ? t("friends.inGroup", { group: groupName })
          : null;

  return (
    <li className="flex min-h-14 flex-wrap items-center gap-3 py-3">
      <Avatar person={person} size={40} decorative />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body-strong text-default">{person.name}</span>
        {caption && <span className="text-caption text-muted">{caption}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {variant === "incoming" && (
          <>
            <Button variant="ghost" aria-label={t("friends.declineName", { name: person.name })} disabled={busy} onClick={onDecline}>
              {t("friends.decline")}
            </Button>
            <Button variant="secondary" aria-label={t("friends.acceptName", { name: person.name })} disabled={busy} onClick={onAccept}>
              {t("friends.accept")}
            </Button>
          </>
        )}
        {variant === "sent" && onCancel && (
          <Button variant="ghost" aria-label={t("friends.cancelName", { name: person.name })} disabled={busy} onClick={onCancel}>
            {t("friends.cancel")}
          </Button>
        )}
        {variant === "fromGroup" && (
          <Button variant="secondary" icon="add" aria-label={t("friends.addName", { name: person.name })} disabled={busy} onClick={onAdd}>
            {t("friends.add")}
          </Button>
        )}
        {variant === "friend" && onRemove && (
          <Menu
            label={t("friends.menu", { name: person.name })}
            items={[{ label: t("friends.remove"), icon: "remove", destructive: true, onSelect: onRemove }]}
            trigger={(props) => <IconButton icon="more" tone="muted" label={t("friends.menu", { name: person.name })} tooltipAlign="end" {...props} />}
          />
        )}
      </div>
    </li>
  );
}
