import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { recordEvent } from "@/lib/events/server";
import { filterKeys } from "@/lib/events/list";
import { personList } from "@/lib/good-words/queries";
import { friendIds } from "@/lib/friends/queries";
import { listMyGroups } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/messages";
import { PersonList } from "./person-list";

export const metadata: Metadata = { title: "Good Word" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Person view (PRD F8): someone's good words that you can see, with the usual
// filters: in the groups you share, and, with the home_enabled flag, the ones
// they shared with friends if you're their friend. Never their other groups,
// and nothing at all for someone who's neither (not even their name).
export default async function PersonPage({ params, searchParams }: PageProps<"/people/[userId]">) {
  const { userId } = await params;
  const { user, profile } = await requireOnboardedUser(`/people/${userId}`);
  if (!UUID.test(userId)) notFound();
  if (userId === user.id) redirect("/you");

  const [groups, friends] = await Promise.all([listMyGroups(user.id), profile.home_enabled ? friendIds(user.id) : ([] as string[])]);
  const shared = groups.filter((g) => g.members.some((m) => m.id === userId));
  const friend = friends.includes(userId);
  let name = shared.flatMap((g) => g.members).find((m) => m.id === userId)?.name;
  if (!name && friend) {
    // Friends can read each other's names (PRD 8).
    const { data } = await (await createClient()).from("profiles").select("display_name").eq("user_id", userId).maybeSingle();
    name = (data?.display_name as string | null | undefined) ?? undefined;
  }

  if ((shared.length === 0 && !friend) || !name) {
    return (
      <main className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-12">
        <h1 className="text-title-l text-default">{t("people.notSharedTitle")}</h1>
        <p className="text-body text-muted">{t("people.notShared")}</p>
      </main>
    );
  }

  // Their good words you can see, and only them on each card (the one card query, PRD F16.11).
  const list = await personList(
    userId,
    shared.map((g) => g.id),
    profile.region,
  );
  await recordEvent("list_viewed", { list: "person", filters: filterKeys(await searchParams), new_count: 0 }, user.id);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-8">
      <PersonList name={name} groups={shared.map(({ id, name }) => ({ id, name }))} friend={friend} list={list} />
    </main>
  );
}
