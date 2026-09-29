import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { ShelfBar } from "../shelf-bar";

export const metadata: Metadata = { title: "All groups · Good Word" };

// Step 2 stub so the switcher's "All groups" row lands somewhere true. The
// real All groups shelf arrives with the core loop (step 4).
export default async function AllGroupsPage() {
  const { user } = await requireOnboardedUser("/shelf/all");
  const groups = await listMyGroups(user.id);
  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 pb-12">
      <h1 className="sr-only">{t("groups.allGroups")}</h1>
      <ShelfBar groups={groups} currentId="all" />
      <EmptyState showShelf headingLevel={2} title={t("shelf.allEmptyTitle")} body={t("shelf.allEmptyBody")} />
    </main>
  );
}
