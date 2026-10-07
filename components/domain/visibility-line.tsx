"use client";

import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { GroupDot } from "../ui/chip";
import { Sheet } from "../ui/sheet";
import type { Group } from "./types";

// Visibility line (DESIGN-SYSTEM.md 4.2.6): who will see it, wherever
// content is created or shared. Tapping it opens the audience picker.
// Friends are part of the audience (PRD F16.2); they are never counted (DS 5.14).

export type GroupWithCount = Group & { memberCount: number };

/** Friends as an audience: whether they're picked, and whether you have any. Absent without the flag. */
export type FriendsPick = { on: boolean; count: number };

export function visibilityText(groups: GroupWithCount[], peopleCount: number, friends?: FriendsPick): string {
  if (friends?.on) {
    if (groups.length === 0) return friends.count > 0 ? t("visibility.friends") : t("visibility.friendsNone");
    if (groups.length === 1) return t("visibility.friendsAndGroup", { group: groups[0].name });
    return t("visibility.friendsAndGroups", { groups: groups.length });
  }
  if (groups.length === 0) return t("visibility.noGroups");
  if (groups.length === 1) return t("visibility.oneGroup", { group: groups[0].name, count: groups[0].memberCount });
  return t("visibility.manyGroups", { groups: groups.length, people: peopleCount });
}

export function VisibilityLine({
  groups,
  peopleCount,
  friends,
  onChange,
  compact = false,
  className,
}: {
  /** The selected groups. */
  groups: GroupWithCount[];
  /** Unique people across the selected groups. */
  peopleCount: number;
  /** Friends as an audience (PRD F16.2). */
  friends?: FriendsPick;
  /** Opens the group picker. Omit where the audience is fixed (the composer). */
  onChange?: () => void;
  compact?: boolean;
  className?: string;
}) {
  const text = visibilityText(groups, peopleCount, friends);
  const content = (
    <>
      <Icon name="private" size={16} className="shrink-0" />
      <span>{text}</span>
    </>
  );
  const style = cn(
    "inline-flex items-center gap-2 text-muted",
    compact ? "text-caption" : "text-label font-medium",
    className,
  );
  if (!onChange) return <p className={style}>{content}</p>;
  return (
    <button
      type="button"
      onClick={onChange}
      aria-label={`${text}. ${t("visibility.change")}`}
      className={cn(style, "relative min-h-target rounded-control transition duration-fast ease-standard hover:text-default")}
    >
      {content}
    </button>
  );
}

/**
 * The audience picker's checkboxes, for a sheet of their own or a step inside
 * another sheet: Friends first when they're an option (PRD F16.2), then each
 * of your groups.
 */
export function GroupPickerFields({
  groups,
  selectedIds,
  onSelectedChange,
  friends,
  onFriendsChange,
}: {
  groups: GroupWithCount[];
  selectedIds: string[];
  onSelectedChange: (ids: string[]) => void;
  friends?: FriendsPick;
  onFriendsChange?: (on: boolean) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{t("visibility.pickerTitle")}</legend>
      {friends && onFriendsChange && (
        <Checkbox
          label={t("visibility.friendsOption")}
          description={friends.count > 0 ? t("visibility.friendsOptionBody") : t("visibility.friendsOptionNone")}
          leading={<Icon name="friends" size={20} className="text-muted" />}
          checked={friends.on}
          onChange={(e) => onFriendsChange(e.target.checked)}
        />
      )}
      {groups.map((group) => (
        <Checkbox
          key={group.id}
          label={group.name}
          description={t("groups.members", { count: group.memberCount })}
          leading={<GroupDot group={group} />}
          checked={selectedIds.includes(group.id)}
          onChange={(e) =>
            onSelectedChange(e.target.checked ? [...selectedIds, group.id] : selectedIds.filter((id) => id !== group.id))
          }
        />
      ))}
    </fieldset>
  );
}

/** The group picker: checkboxes in a sheet. The line updates live as groups are picked. */
export function GroupPicker({
  open,
  onClose,
  groups,
  selectedIds,
  onSelectedChange,
  peopleCount,
  friends,
  onFriendsChange,
}: {
  open: boolean;
  onClose: () => void;
  groups: GroupWithCount[];
  selectedIds: string[];
  onSelectedChange: (ids: string[]) => void;
  peopleCount: number;
  friends?: FriendsPick;
  onFriendsChange?: (on: boolean) => void;
}) {
  const selected = groups.filter((g) => selectedIds.includes(g.id));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("visibility.pickerTitle")}
      footer={
        <div className="flex flex-col gap-3">
          <VisibilityLine groups={selected} peopleCount={peopleCount} friends={friends} compact />
          <Button variant="primary" size="lg" fullWidth onClick={onClose}>
            {t("common.done")}
          </Button>
        </div>
      }
    >
      <GroupPickerFields
        groups={groups}
        selectedIds={selectedIds}
        onSelectedChange={onSelectedChange}
        friends={friends}
        onFriendsChange={onFriendsChange}
      />
    </Sheet>
  );
}
