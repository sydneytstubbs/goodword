import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { recordEvent } from "@/lib/events/server";
import { filterKeys } from "@/lib/events/list";
import { allGroupsList } from "@/lib/good-words/queries";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { PersonList } from "./person-list";

export const metadata: Metadata = { title: "Good Word" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Person view (PRD F8): someone's good words, only in the groups you share
// with them, with the usual filters. Never their other groups, and nothing
// at all for someone you share no group with (not even their name).
export default async function PersonPage({ params, searchParams }: PageProps<"/people/[userId]">) {
  const { userId } = await params;
  const { user, profile } = await requireOnboardedUser(`/people/${userId}`);
  if (!UUID.test(userId)) notFound();
  if (userId === user.id) redirect("/you");

  const groups = await listMyGroups(user.id);
  const shared = groups.filter((g) => g.members.some((m) => m.id === userId));
  const name = shared.flatMap((g) => g.members).find((m) => m.id === userId)?.name;

  if (shared.length === 0 || !name) {
    return (
      <main className="mx-auto flex w-full max-w-content flex-col gap-4 px-4 py-12">
        <h1 className="text-title-l text-default">{t("people.notSharedTitle")}</h1>
        <p className="text-body text-muted">{t("people.notShared")}</p>
      </main>
    );
  }

  const list = await allGroupsList(
    shared.map((g) => g.id),
    user.id,
    profile.region,
  );
  // Only their good words, and only who they are on each card.
  const cards = list.cards
    .map((card) => ({ ...card, goodWords: card.goodWords.filter((gw) => gw.person.id === userId), isNew: false }))
    .filter((card) => card.goodWords.length > 0);
  await recordEvent("list_viewed", { list: "person", filters: filterKeys(await searchParams), new_count: 0 }, user.id);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-8">
      <PersonList name={name} groups={shared.map(({ id, name }) => ({ id, name }))} list={{ ...list, cards }} />
    </main>
  );
}
