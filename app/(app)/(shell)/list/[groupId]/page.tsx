import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { recordEvent } from "@/lib/events/server";
import { filterKeys, newCount } from "@/lib/events/shelf";
import { siteOrigin } from "@/lib/origin";
import { requireOnboardedUser } from "@/lib/auth/session";
import { groupShelf, hasGoodWordIn } from "@/lib/good-words/queries";
import { getGroup, listMyGroups } from "@/lib/groups/queries";
import { GroupShelf } from "./group-shelf";

export async function generateMetadata({ params }: PageProps<"/shelf/[groupId]">): Promise<Metadata> {
  const { groupId } = await params;
  const { user } = await requireOnboardedUser(`/shelf/${groupId}`);
  const group = await getGroup(groupId, user.id);
  // "College crew · Good Word" (DS 7.2). A group you're not in is never named.
  return { title: group ? `${group.name} · Good Word` : "Good Word" };
}

export default async function GroupShelfPage({ params, searchParams }: PageProps<"/shelf/[groupId]">) {
  const { groupId } = await params;
  const { user, profile } = await requireOnboardedUser(`/shelf/${groupId}`);
  const [group, groups] = await Promise.all([getGroup(groupId, user.id), listMyGroups(user.id)]);
  const summary = groups.find((g) => g.id === groupId);
  if (!group || !summary) notFound();
  const [shelf, vouchedHere] = await Promise.all([
    groupShelf(groupId, user.id, profile.region),
    hasGoodWordIn(groupId, user.id),
  ]);
  await recordEvent("shelf_viewed", { shelf: "group", filters: filterKeys(await searchParams), new_count: newCount(shelf.cards) }, user.id);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 pb-12">
      <GroupShelf
        groups={groups}
        group={summary}
        shelf={shelf}
        inviteLink={group.inviteCode ? `${await siteOrigin()}/join/${group.inviteCode}` : null}
        showWelcome={!group.me.welcomeSeenAt}
        showJoinPrompt={!vouchedHere && !group.me.joinPromptDismissedAt}
      />
    </main>
  );
}
