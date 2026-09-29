import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteOrigin } from "@/lib/origin";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getGroup, listMyGroups } from "@/lib/groups/queries";
import { GroupShelf } from "./group-shelf";

export const metadata: Metadata = { title: "Shelf · Good Word" };

export default async function GroupShelfPage({ params }: PageProps<"/shelf/[groupId]">) {
  const { groupId } = await params;
  const { user } = await requireOnboardedUser(`/shelf/${groupId}`);
  const [group, groups] = await Promise.all([getGroup(groupId, user.id), listMyGroups(user.id)]);
  const summary = groups.find((g) => g.id === groupId);
  if (!group || !summary) notFound();

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 pb-12">
      <h1 className="sr-only">{group.name}</h1>
      <GroupShelf
        groups={groups}
        group={summary}
        inviteLink={group.inviteCode ? `${await siteOrigin()}/join/${group.inviteCode}` : null}
        showWelcome={!group.me.welcomeSeenAt}
      />
    </main>
  );
}
