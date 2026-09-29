import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { CreateGroupForm } from "./create-group-form";

export const metadata: Metadata = { title: "Start a group · Good Word" };

// One field and one button (F2.2, DS 5.8). Nothing else is asked.
export default async function NewGroupPage() {
  const { user } = await requireOnboardedUser("/groups/new");
  const groups = await listMyGroups(user.id);
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-8 px-4 py-8">
      <h1 className="text-display-m text-default">{t("groups.new.title")}</h1>
      <CreateGroupForm existingNames={groups.map((g) => g.name)} />
    </main>
  );
}
