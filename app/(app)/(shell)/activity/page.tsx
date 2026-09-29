import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { collapseActivity } from "@/lib/conversations/activity";
import { activityRecords } from "@/lib/conversations/queries";
import { ActivityList } from "./activity-list";

export const metadata: Metadata = { title: "Activity · Good Word" };

// Activity (PRD F14, DS 5.17): mentions, new comments in conversations you're
// part of, conversations started in your groups, and joins to groups you own,
// newest first. Opening an item marks it read; opening the screen doesn't.
export default async function ActivityPage() {
  await requireOnboardedUser("/activity");
  const entries = collapseActivity(await activityRecords());
  return (
    <main className="mx-auto flex w-full max-w-detail flex-col gap-6 px-4 pt-1 pb-12">
      <ActivityList entries={entries} />
    </main>
  );
}
