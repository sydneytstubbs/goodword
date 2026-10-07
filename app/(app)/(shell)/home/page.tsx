import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { recordEvent } from "@/lib/events/server";
import { filterKeys, newCount } from "@/lib/events/list";
import { friendIds, myFriendLinkCode } from "@/lib/friends/queries";
import { homeList } from "@/lib/good-words/queries";
import { listMyGroups } from "@/lib/groups/queries";
import { siteOrigin } from "@/lib/origin";
import { HomeScreen } from "./home-screen";

export const metadata: Metadata = { title: "Home · Good Word" };

// Home (PRD F16.3, DS 5.19): every title with a good word from someone else
// you can see, from the one card query. Behind the home_enabled flag until
// the flip (F16.10): without it, there's no such page.
export default async function HomePage({ searchParams }: PageProps<"/home">) {
  const { user, profile } = await requireOnboardedUser("/home");
  if (!profile.home_enabled) notFound();
  const groups = await listMyGroups(user.id);
  const [home, friends] = await Promise.all([homeList(user.id, profile.region), friendIds(user.id)]);
  const empty = home.list.cards.length === 0 && home.rollups.length === 0;
  // The empty states offer your friend link.
  const link = empty ? `${await siteOrigin()}/join/${await myFriendLinkCode()}` : null;
  await recordEvent("list_viewed", { list: "home", filters: filterKeys(await searchParams), new_count: newCount(home.list.cards) }, user.id);
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-4 pb-12">
      <HomeScreen
        groups={groups}
        cards={home.list.cards}
        services={home.list.services}
        rollups={home.rollups}
        mine={home.mine}
        friendIds={friends}
        link={link}
        hasPeople={groups.length > 0 || friends.length > 0}
      />
    </main>
  );
}
