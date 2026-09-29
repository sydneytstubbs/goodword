import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { LAST_SHELF_COOKIE } from "@/lib/auth/paths";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";

export const metadata: Metadata = { title: "Shelf · Good Word" };

// The Shelf tab: the last viewed shelf on this device, else the most recently
// joined group, else the no-groups empty state (PRD 6.1, F10).
export default async function ShelfPage() {
  const { user } = await requireOnboardedUser("/shelf");
  const groups = await listMyGroups(user.id);
  const last = (await cookies()).get(LAST_SHELF_COOKIE)?.value;
  const target = groups.find((g) => g.id === last) ?? groups[0];
  if (target) redirect(`/shelf/${target.id}`);

  return (
    <main className="mx-auto w-full max-w-content px-4 py-12">
      <h1 className="sr-only">{t("nav.shelf")}</h1>
      <EmptyState
        showShelf
        headingLevel={2}
        title={t("shelf.noGroupsTitle")}
        body={t("shelf.noGroupsBody")}
        action={
          <ButtonLink href="/groups/new" variant="primary" size="lg" icon="add">
            {t("shelf.startGroup")}
          </ButtonLink>
        }
      />
    </main>
  );
}
