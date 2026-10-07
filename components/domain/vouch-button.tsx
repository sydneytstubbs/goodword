"use client";

import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { buttonBase, buttonSizes, buttonVariants } from "../ui/button";
import { Menu } from "../ui/menu";

// Vouch button (DESIGN-SYSTEM.md 4.2.3), the signature component.
// Not vouched: opens the confirm sheet. Vouched: a small menu with Edit note,
// Change groups (Change who sees it, when friends are an audience: PRD F16.2),
// and Take it back (immediate, with an Undo toast).
// The icon cross-fades from Plus to Check on success.

export type VouchButtonProps = {
  vouched: boolean;
  /** lg on title detail (where it's the primary action), md in rows. */
  size?: "lg" | "md";
  /** primary on title detail; secondary in rows. */
  emphasis?: "primary" | "secondary";
  onPut: () => void;
  onEditNote: () => void;
  onChangeGroups: () => void;
  onTakeBack: () => void;
  /** Friends are an audience: the menu says "Change who sees it". */
  withFriends?: boolean;
  fullWidth?: boolean;
  /**
   * The title, for rows. Below 768px a row's button just says "Add", and the
   * title completes its accessible name ("Add The Night Ferry").
   */
  titleName?: string;
  /** Home's card says "Vouch too" before you've vouched (DS 4.2.2 home). */
  putLabel?: string;
};

function CrossFadeIcon({ vouched }: { vouched: boolean }) {
  return (
    <span className="relative grid size-5 place-items-center" aria-hidden="true">
      <Icon
        name="add"
        size={20}
        className={cn("absolute transition-opacity duration-base ease-enter", vouched ? "opacity-0" : "opacity-100")}
      />
      <Icon
        name="vouched"
        size={20}
        className={cn("absolute transition-opacity duration-base ease-enter", vouched ? "opacity-100" : "opacity-0")}
      />
    </span>
  );
}

export function VouchButton({
  vouched,
  size = "md",
  emphasis = "secondary",
  onPut,
  onEditNote,
  onChangeGroups,
  onTakeBack,
  withFriends = false,
  fullWidth,
  titleName,
  putLabel,
}: VouchButtonProps) {
  const base = cn(buttonBase, buttonSizes[size], fullWidth && "w-full");

  if (!vouched) {
    return (
      <button type="button" aria-pressed={false} onClick={onPut} className={cn(base, buttonVariants[emphasis])}>
        <CrossFadeIcon vouched={false} />
        {putLabel ? (
          <>
            {putLabel}
            {titleName && <span className="sr-only"> {titleName}</span>}
          </>
        ) : size === "md" && titleName ? (
          <>
            <span className="md:hidden">
              {t("vouch.putShort")}
              <span className="sr-only"> {titleName}</span>
            </span>
            <span className="hidden md:inline">{t("vouch.put")}</span>
          </>
        ) : (
          t("vouch.put")
        )}
      </button>
    );
  }

  return (
    <Menu
      label={t("vouch.menuLabel")}
      align="start"
      items={[
        { label: t("vouch.editNote"), icon: "edit", onSelect: onEditNote },
        { label: withFriends ? t("vouch.changeAudience") : t("vouch.changeGroups"), icon: "group", onSelect: onChangeGroups },
        { label: t("vouch.takeBack"), icon: "remove", onSelect: onTakeBack, destructive: true },
      ]}
      trigger={(props) => (
        <button
          type="button"
          aria-pressed={true}
          {...props}
          className={cn(base, "bg-action-wash text-action-text fc-selected hover:bg-action-wash active:bg-action-wash")}
        >
          <CrossFadeIcon vouched />
          {t("vouch.yours")}
        </button>
      )}
    />
  );
}
