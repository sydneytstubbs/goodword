import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LAST_LIST_COOKIE } from "@/lib/auth/paths";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { NoGroups } from "./no-groups";

export const metadata: Metadata = { title: "List · Good Word" };

// The List tab: the last viewed list on this device, else the most recently
// joined group, else the no-groups empty state (PRD 6.1, F10).
export default async function ListPage({ searchParams }: PageProps<"/list">) {
  const { user } = await requireOnboardedUser("/list");
  const groups = await listMyGroups(user.id);
  const last = (await cookies()).get(LAST_LIST_COOKIE)?.value;
  const target = groups.find((g) => g.id === last) ?? groups[0];
  // Keep an email's ref=digest (and the weekend prompt's add=1, which opens
  // Add) through the redirect.
  const { ref, add } = await searchParams;
  const keep = new URLSearchParams({ ...(add === "1" ? { add } : {}), ...(typeof ref === "string" ? { ref } : {}) }).toString();
  if (target) redirect(`/list/${target.id}${keep ? `?${keep}` : ""}`);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-8 px-4 py-12">
      <h1 className="sr-only">{t("nav.groups")}</h1>
      <NoGroups />
    </main>
  );
}
