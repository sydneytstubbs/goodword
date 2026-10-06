"use client";

import NextLink from "next/link";
import { useState } from "react";
import { LiveList } from "../live-list";
import type { SwitcherGroup } from "@/components/domain/group-switcher";
import { InviteCard } from "@/components/domain/invite-card";
import type { List } from "@/components/domain/types";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { useAdd } from "../../add";
import { useGoodWords } from "../../good-words";
import { ListBar } from "../list-bar";
import { useMarkViewed } from "../../list-news";
import { ListCards } from "../list-cards";
import type { FriendPerson } from "@/lib/friends/queries";
import { FriendPrompt } from "./friend-prompt";
import { JoinPrompt } from "./join-prompt";
import { WelcomeBanner } from "./welcome-banner";

// A group's list (PRD F5.1): the group name as the page title, its members
// beneath (linking to group details), then one card per title.
export function GroupList({
  groups,
  group,
  list,
  inviteLink,
  showWelcome,
  showJoinPrompt,
  friendPrompt = [],
}: {
  groups: SwitcherGroup[];
  group: SwitcherGroup;
  list: List;
  inviteLink: string | null;
  showWelcome: boolean;
  /** No good words from you here yet, and the prompt hasn't been dismissed (F5.7). */
  showJoinPrompt: boolean;
  /** People here you could add as friends (PRD F16.1); empty unless the flag is on. */
  friendPrompt?: FriendPerson[];
}) {
  const { openAdd } = useAdd();
  const { overlays } = useGoodWords();
  const [inviteOpen, setInviteOpen] = useState(false);
  // The welcome shows for the group you arrived in and stays for this visit,
  // even when the page refreshes from the server after it's marked seen.
  const [welcomeFor, setWelcomeFor] = useState(showWelcome ? group.id : null);
  if (showWelcome && welcomeFor !== group.id) setWelcomeFor(group.id);
  useMarkViewed([group.id]);
  const openInvite = inviteLink ? () => setInviteOpen(true) : undefined;
  // Putting one in here, from anywhere, answers the prompt.
  const vouchedHere = overlays.some((o) => o.mine?.groupIds.includes(group.id));
  const long = group.name.length > 22;

  return (
    <>
      <ListBar groups={groups} currentId={group.id} onInvite={openInvite} />
      <LiveList groupIds={[group.id]} />
      {welcomeFor === group.id && <WelcomeBanner groupId={group.id} groupName={group.name} />}
      <FriendPrompt key={group.id} groupId={group.id} groupName={group.name} people={friendPrompt} />
      <header className="flex flex-col gap-3">
        <h1 className={cn("text-default", long ? "text-title-l-step" : "text-title-l")}>{group.name}</h1>
        <NextLink
          href={`/groups/${group.id}`}
          aria-label={t("list.membersLink", { names: nameList(group.members.map((m) => m.name)) })}
          className="-mx-1 inline-flex min-h-target items-center gap-2 self-start rounded-control px-1 text-caption text-muted transition duration-fast ease-standard hover:text-default"
        >
          <AvatarStack people={group.members} size={24} />
          {t("groups.members", { count: group.members.length })}
        </NextLink>
      </header>
      <ListCards
        cards={list.cards}
        services={list.services}
        scope={{ kind: "group", groupId: group.id }}
        empty={
          <EmptyState
            showList
            headingLevel={2}
            title={t("list.groupEmptyTitle")}
            body={t("list.groupEmptyBody")}
            action={
              <div className="flex flex-wrap gap-3 md:justify-center">
                <Button variant="primary" size="lg" icon="add" onClick={() => openAdd({ entryPoint: "empty_state" })}>
                  {t("vouch.put")}
                </Button>
                {openInvite && (
                  <Button variant="secondary" size="lg" icon="share" onClick={openInvite}>
                    {t("list.inviteFriends")}
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
