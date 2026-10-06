"use client";

import { useId } from "react";
import { track } from "@/lib/events/client";
import { t } from "@/lib/messages";
import { Avatar } from "../ui/avatar";
import { Banner } from "../ui/banner";
import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";
import { Menu } from "../ui/menu";
import { TextField } from "../ui/text-field";
import { useToast } from "../ui/toast";
import type { Person } from "./types";

// Invite card, friend link variant (DESIGN-SYSTEM.md 4.2.7, 5.20): your name
// and avatar instead of a group's, Copy link and Share, and Reset link in a
// menu. Share is the Friends screen's one primary action.

export function FriendLinkCard({
  me,
  link,
  justReset = false,
  onReset,
}: {
  me: Person;
  link: string;
  /** Shows the "link reset" note after a reset. */
  justReset?: boolean;
  /** Opens the reset confirmation; absent in previews. */
  onReset?: () => void;
}) {
  const { showToast } = useToast();
  const headingId = useId();
  const nameId = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      showToast({ message: t("invite.copied") });
      track("friend_link_shared", { method: "copy" });
    } catch {
      showToast({ message: t("invite.copyFailed") });
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("friends.shareText"), url: link });
        track("friend_link_shared", { method: "share_sheet" });
      } catch {
        // Dismissing the share sheet isn't an error.
      }
      return;
    }
    await copy();
  }

  return (
    <section
      aria-labelledby={`${headingId} ${nameId}`}
      className="flex flex-col gap-4 rounded-card border border-subtle bg-surface-raised p-5 shadow-sm fc-edge"
    >
      <div className="flex items-center gap-3">
        <Avatar person={me} size={40} decorative />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id={headingId} className="truncate text-heading text-default">
            {t("friends.linkHeading")}
          </h2>
          <p id={nameId} className="truncate text-caption text-muted">
            {me.name}
          </p>
        </div>
        {onReset && (
          <Menu
            label={t("friends.linkMenu")}
            items={[{ label: t("friends.resetLink"), icon: "edit", onSelect: onReset }]}
            trigger={(props) => <IconButton icon="more" tone="muted" label={t("friends.linkMenu")} tooltipAlign="end" {...props} />}
          />
        )}
      </div>
      {justReset && <Banner>{t("friends.resetDone")}</Banner>}
      <TextField label={t("friends.linkLabel")} value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-col gap-3 md:flex-row">
        <Button variant="secondary" size="lg" icon="copyLink" fullWidth onClick={copy}>
          {t("invite.copy")}
        </Button>
        <Button variant="primary" size="lg" icon="share" fullWidth onClick={share}>
          {t("invite.share")}
        </Button>
      </div>
    </section>
  );
}
