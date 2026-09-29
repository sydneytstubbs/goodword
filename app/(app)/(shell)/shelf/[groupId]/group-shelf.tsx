"use client";

import NextLink from "next/link";
import { useState } from "react";
import type { SwitcherGroup } from "@/components/domain/group-switcher";
import { InviteCard } from "@/components/domain/invite-card";
import type { ShelfCard } from "@/components/domain/types";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { useAdd } from "../../add";
import { useGoodWords } from "../../good-words";
import { ShelfBar } from "../shelf-bar";
import { ShelfCards } from "../shelf-cards";
import { JoinPrompt } from "./join-prompt";
import { WelcomeBanner } from "./welcome-banner";

// A group's shelf (PRD F5.1): the group name as the page title, its members
// beneath (linking to group details), then one card per title.
export function GroupShelf({
  groups,
  group,
  cards,
  inviteLink,
  showWelcome,
  showJoinPrompt,
}: {
  groups: SwitcherGroup[];
  group: SwitcherGroup;
  cards: ShelfCard[];
  inviteLink: string | null;
  showWelcome: boolean;
  /** No good words from you here yet, and the prompt hasn't been dismissed (F5.7). */
  showJoinPrompt: boolean;
}) {
  const { openAdd } = useAdd();
  const { overlays } = useGoodWords();
  const [inviteOpen, setInviteOpen] = useState(false);
  const openInvite = inviteLink ? () => setInviteOpen(true) : undefined;
  // Putting one in here, from anywhere, answers the prompt.
  const vouchedHere = overlays.some((o) => o.mine?.groupIds.includes(group.id));
  const long = group.name.length > 22;

  return (
    <>
      <ShelfBar groups={groups} currentId={group.id} onInvite={openInvite} />
      {showWelcome && <WelcomeBanner groupId={group.id} groupName={group.name} />}
      <header className="flex flex-col gap-3">
        <h1 className={cn("text-default", long ? "text-title-l-step" : "text-title-l")}>{group.name}</h1>
        <NextLink
          href={`/groups/${group.id}`}
          aria-label={t("shelf.membersLink", { names: nameList(group.members.map((m) => m.name)) })}
          className="-mx-1 inline-flex min-h-target items-center gap-2 self-start rounded-control px-1 text-caption text-muted transition duration-fast ease-standard hover:text-default"
        >
          <AvatarStack people={group.members} size={24} />
          {t("groups.members", { count: group.members.length })}
        </NextLink>
      </header>
      <ShelfCards
        cards={cards}
        scope={{ kind: "group", groupId: group.id }}
        empty={
          <EmptyState
            showShelf
            headingLevel={2}
            title={t("shelf.groupEmptyTitle")}
            body={t("shelf.groupEmptyBody")}
            action={
              <div className="flex flex-wrap gap-3 md:justify-center">
                <Button variant="primary" size="lg" icon="add" onClick={() => openAdd()}>
                  {t("vouch.put")}
                </Button>
                {openInvite && (
                  <Button variant="secondary" size="lg" icon="share" onClick={openInvite}>
                    {t("shelf.inviteFriends")}
                  </Button>
                )}
              </div>
            }
          />
        }
        after={showJoinPrompt && !vouchedHere ? <JoinPrompt groupId={group.id} /> : undefined}
      />
      {inviteLink && (
        <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title={t("groups.details.inviteHeading")}>
          <InviteCard group={group} members={group.members} link={inviteLink} inviterName="" />
        </Sheet>
      )}
    </>
  );
}
