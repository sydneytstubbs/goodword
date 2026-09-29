import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOnboardedUser } from "@/lib/auth/session";
import { t } from "@/lib/messages";

export const metadata: Metadata = { title: "Shelf · Good Word" };

// Step 1 stub: everyone has no groups yet. Start a group (step 2) and
// Put in a good word (step 4) join this empty state when those steps land.
export default async function ShelfPage() {
  await requireOnboardedUser("/shelf");
  return (
    <main className="mx-auto w-full max-w-content px-4 py-12">
      <h1 className="sr-only">{t("nav.shelf")}</h1>
      <EmptyState showShelf headingLevel={2} title={t("shelf.noGroupsTitle")} body={t("shelf.noGroupsBody")} />
    </main>
  );
}
