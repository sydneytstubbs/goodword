import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteOrigin } from "@/lib/origin";
import { requireOnboardedUser } from "@/lib/auth/session";
import { getGroup, listMyGroups } from "@/lib/groups/queries";
import { GroupDetails } from "./group-details";

export const metadata: Metadata = { title: "Group details · Good Word" };

// Invite card first, then members, then owner settings, then leave or delete (F2.5).
export default async function GroupDetailsPage({ params }: PageProps<"/groups/[groupId]">) {
  const { groupId } = await params;
  const { user } = await requireOnboardedUser(`/groups/${groupId}`);
  const [group, groups] = await Promise.all([getGroup(groupId, user.id), listMyGroups(user.id)]);
  if (!group) notFound();

  return (
    <GroupDetails
      group={group}
      meId={user.id}
      inviteLink={group.inviteCode ? `${await siteOrigin()}/join/${group.inviteCode}` : null}
      otherNames={groups.filter((g) => g.id !== group.id).map((g) => g.name)}
    />
  );
}
