import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_SHELF_COOKIE } from "@/lib/auth/paths";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { NoGroups } from "./no-groups";

export const metadata: Metadata = { title: "Shelf · Good Word" };

// The Shelf tab: the last viewed shelf on this device, else the most recently
// joined group, else the no-groups empty state (PRD 6.1, F10).
export default async function ShelfPage({ searchParams }: PageProps<"/shelf">) {
  const { user } = await requireOnboardedUser("/shelf");
  const groups = await listMyGroups(user.id);
  const last = (await cookies()).get(LAST_SHELF_COOKIE)?.value;
  const target = groups.find((g) => g.id === last) ?? groups[0];
  // Keep ref=digest from an email's "Open Good Word" through the redirect.
  const { ref } = await searchParams;
  if (target) redirect(`/shelf/${target.id}${typeof ref === "string" ? `?${new URLSearchParams({ ref })}` : ""}`);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-12">
      <h1 className="sr-only">{t("nav.shelf")}</h1>
      <NoGroups />
    </main>
  );
}
