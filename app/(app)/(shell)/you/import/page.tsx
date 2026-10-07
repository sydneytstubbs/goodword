import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { friendCount } from "@/lib/friends/queries";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { AddRecsForm } from "./add-recs-form";

export const metadata: Metadata = { title: `${t("importRecs.title")} · Good Word` };

// Add recs (PRD F15.1): turn a list you already have into recs.
export default async function AddRecsPage() {
  const { user } = await requireOnboardedUser("/you/import");
  const groups = await listMyGroups(user.id);
  // Friends are an audience (PRD F16.2).
  const friends = { count: await friendCount(user.id) };
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-3">
        <h1 className="text-title-l text-default">{t("importRecs.title")}</h1>
        <p className="text-body text-muted">{t("importRecs.intro")}</p>
      </div>
      <AddRecsForm
        groups={groups.map((g) => ({ id: g.id, name: g.name, memberCount: g.members.length }))}
        peopleIn={Object.fromEntries(groups.map((g) => [g.id, g.members.map((m) => m.id)]))}
        friends={friends}
      />
    </main>
  );
}
