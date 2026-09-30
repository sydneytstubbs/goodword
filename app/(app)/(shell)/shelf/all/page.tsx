import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { allGroupsShelf } from "@/lib/good-words/queries";
import { recordEvent } from "@/lib/events/server";
import { filterKeys, newCount } from "@/lib/events/shelf";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { NoGroups } from "../no-groups";
import { AllGroupsShelf } from "./all-groups-shelf";

export const metadata: Metadata = { title: "All groups · Good Word" };

export default async function AllGroupsPage({ searchParams }: PageProps<"/shelf/all">) {
  const { user, profile } = await requireOnboardedUser("/shelf/all");
  const groups = await listMyGroups(user.id);
  if (groups.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-12">
        <h1 className="sr-only">{t("groups.allGroups")}</h1>
        <NoGroups />
      </main>
    );
  }
  const shelf = await allGroupsShelf(
    groups.map((g) => g.id),
    user.id,
    profile.region,
  );
  await recordEvent("shelf_viewed", { shelf: "all", filters: filterKeys(await searchParams), new_count: newCount(shelf.cards) }, user.id);
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 pb-12">
      <AllGroupsShelf groups={groups} shelf={shelf} />
    </main>
  );
}
