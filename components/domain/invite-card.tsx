"use client";

import { t } from "@/lib/messages";
import { AvatarStack } from "../ui/avatar";
import { Banner } from "../ui/banner";
import { Button } from "../ui/button";
import { TextField } from "../ui/text-field";
import { useToast } from "../ui/toast";
import type { Group, Person } from "./types";

// Invite card (DESIGN-SYSTEM.md 4.2.7). Share uses the Web Share API, with
// copy as the fallback. States: link active, link reset (owner), expired.

export type InviteState = "active" | "reset" | "expired";

export function InviteCard({
  group,
  members,
  link,
  state = "active",
  inviterName,
}: {
  group: Group;
  members: Person[];
  link: string;
  state?: InviteState;
  /** Who to ask for a new link when this one has expired. */
  inviterName: string;
}) {
  const { showToast } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      showToast({ message: t("invite.copied") });
    } catch {
      showToast({ message: t("invite.copyFailed") });
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("invite.shareText", { group: group.name }), url: link });
      } catch {
        // Dismissing the share sheet isn't an error.
      }
      return;
    }
    await copy();
  }

  return (
    <section
      aria-label={group.name}
      className="flex flex-col gap-4 rounded-card border border-subtle bg-surface-raised p-5 shadow-sm fc-edge"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-heading text-default">{group.name}</h3>
          <p className="text-caption text-muted">{t("groups.members", { count: members.length })}</p>
        </div>
        <AvatarStack people={members} size={32} ring="surface-raised" />
      </div>
      {state === "expired" ? (
        <Banner tone="warning">{t("invite.expired", { name: inviterName })}</Banner>
      ) : (
        <>
          {state === "reset" && <Banner>{t("invite.reset")}</Banner>}
          <TextField label={t("invite.linkLabel")} value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
          <div className="flex flex-col gap-3 md:flex-row">
            <Button variant="secondary" size="lg" icon="copyLink" fullWidth onClick={copy}>
              {t("invite.copy")}
            </Button>
            <Button variant="primary" size="lg" icon="share" fullWidth onClick={share}>
              {t("invite.share")}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
