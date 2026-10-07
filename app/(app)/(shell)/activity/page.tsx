import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { collapseActivity, unreadCount } from "@/lib/conversations/activity";
import { recordEvent } from "@/lib/events/server";
import { activityRecords } from "@/lib/conversations/queries";
import { ActivityList } from "./activity-list";

export const metadata: Metadata = { title: "Activity · Good Word" };

// Activity (PRD F14, F16.9, DS 5.17): mentions, new comments in conversations
// you're part of (including under good words), conversations started in your
// groups, and joins to groups you own, newest first. Opening an item marks it
// read; opening the screen doesn't.
export default async function ActivityPage() {
  const { user } = await requireOnboardedUser("/activity");
  const entries = collapseActivity(await activityRecords());
  await recordEvent("activity_opened", { unread_count: unreadCount(entries) }, user.id);
  return (
    <main className="mx-auto flex w-full max-w-detail flex-col gap-6 px-4 pt-1 pb-12">
      <ActivityList entries={entries} viewerId={user.id} />
    </main>
  );
}
