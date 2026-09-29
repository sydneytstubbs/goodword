"use client";

import { useState } from "react";
import type { SwitcherGroup } from "@/components/domain/group-switcher";
import { InviteCard } from "@/components/domain/invite-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/messages";
import { ShelfBar } from "../shelf-bar";
import { WelcomeBanner } from "./welcome-banner";

// A group's shelf. In step 2 every shelf is empty: good words arrive with the
// core loop (step 4), which adds "Put in a good word" to this empty state.
export function GroupShelf({
  groups,
  group,
  inviteLink,
  showWelcome,
}: {
  groups: SwitcherGroup[];
  group: SwitcherGroup;
  inviteLink: string | null;
  showWelcome: boolean;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const openInvite = inviteLink ? () => setInviteOpen(true) : undefined;

  return (
    <>
      <ShelfBar groups={groups} currentId={group.id} onInvite={openInvite} />
      {showWelcome && <WelcomeBanner groupId={group.id} groupName={group.name} />}
      <EmptyState
        showShelf
        headingLevel={2}
        title={t("shelf.groupEmptyTitle")}
        body={t("shelf.groupEmptyBody")}
        action={
          openInvite && (
            <Button variant="primary" size="lg" icon="share" onClick={openInvite}>
              {t("shelf.inviteFriends")}
            </Button>
          )
        }
      />
      {inviteLink && (
        <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title={t("groups.details.inviteHeading")}>
          <InviteCard group={group} members={group.members} link={inviteLink} inviterName="" />
        </Sheet>
      )}
    </>
  );
}
