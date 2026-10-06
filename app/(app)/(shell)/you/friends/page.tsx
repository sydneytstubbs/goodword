import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { markFriendActivityRead } from "@/lib/friends/actions";
import { friendsOverview } from "@/lib/friends/queries";
import { siteOrigin } from "@/lib/origin";
import { FriendsScreen } from "./friends-screen";

export const metadata: Metadata = { title: "Friends · Good Word" };

// Friends (PRD F16.1, DS 5.20): your friend link, requests to you, people from
// your groups, your friends, and requests you've sent. Behind the home_enabled
// flag until the flip (F16.10): without it, there's no such page.
export default async function FriendsPage() {
  const { user, profile } = await requireOnboardedUser("/you/friends");
  if (!profile.home_enabled) notFound();
  const [overview, origin] = await Promise.all([friendsOverview(user.id), siteOrigin()]);
  // Opening Friends marks friend Activity items read (like a group's joins).
  await markFriendActivityRead();
  return <FriendsScreen me={{ id: user.id, name: profile.display_name }} overview={overview} link={`${origin}/join/${overview.linkCode}`} />;
}
