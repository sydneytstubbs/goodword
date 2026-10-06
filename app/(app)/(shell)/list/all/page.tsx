import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { allGroupsList } from "@/lib/good-words/queries";
import { recordEvent } from "@/lib/events/server";
import { filterKeys, newCount } from "@/lib/events/list";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { NoGroups } from "../no-groups";
import { AllGroupsList } from "./all-groups-list";

export const metadata: Metadata = { title: "All groups · Good Word" };

export default async function AllGroupsPage({ searchParams }: PageProps<"/list/all">) {
  const { user, profile } = await requireOnboardedUser("/list/all");
  // Home replaces All groups (PRD F16.8).
  if (profile.home_enabled) redirect("/home");
  const groups = await listMyGroups(user.id);
  if (groups.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-12">
        <h1 className="sr-only">{t("groups.allGroups")}</h1>
        <NoGroups />
      </main>
    );
  }
  const list = await allGroupsList(
    groups.map((g) => g.id),
    user.id,
    profile.region,
  );
  await recordEvent("list_viewed", { list: "all", filters: filterKeys(await searchParams), new_count: newCount(list.cards) }, user.id);
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 pb-12">
      <AllGroupsList groups={groups} list={list} />
    </main>
  );
}
