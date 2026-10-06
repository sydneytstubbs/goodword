import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { recordEvent } from "@/lib/events/server";
import { filterKeys, newCount } from "@/lib/events/list";
import { siteOrigin } from "@/lib/origin";
import { requireOnboardedUser } from "@/lib/auth/session";
import { groupList, hasGoodWordIn } from "@/lib/good-words/queries";
import { getGroup, listMyGroups } from "@/lib/groups/queries";
import { GroupList } from "./group-list";

export async function generateMetadata({ params }: PageProps<"/list/[groupId]">): Promise<Metadata> {
  const { groupId } = await params;
  const { user } = await requireOnboardedUser(`/list/${groupId}`);
  const group = await getGroup(groupId, user.id);
  // "College crew · Good Word" (DS 7.2). A group you're not in is never named.
  return { title: group ? `${group.name} · Good Word` : "Good Word" };
}

export default async function GroupListPage({ params, searchParams }: PageProps<"/list/[groupId]">) {
  const { groupId } = await params;
  const { user, profile } = await requireOnboardedUser(`/list/${groupId}`);
  const [group, groups] = await Promise.all([getGroup(groupId, user.id), listMyGroups(user.id)]);
  const summary = groups.find((g) => g.id === groupId);
  if (!group || !summary) notFound();
  const [list, vouchedHere] = await Promise.all([
    groupList(groupId, user.id, profile.region),
    hasGoodWordIn(groupId, user.id),
  ]);
  await recordEvent("list_viewed", { list: "group", filters: filterKeys(await searchParams), new_count: newCount(list.cards) }, user.id);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 pb-12">
      <GroupList
        groups={groups}
        group={summary}
        list={list}
        inviteLink={group.inviteCode ? `${await siteOrigin()}/join/${group.inviteCode}` : null}
        showWelcome={!group.me.welcomeSeenAt}
        showJoinPrompt={!vouchedHere && !group.me.joinPromptDismissedAt}
      />
    </main>
  );
}
