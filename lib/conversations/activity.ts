import type { CommentSegment, Person, Title } from "@/components/domain/types";

// Activity (PRD F14, DS 4.2.13, 5.17). Comment items for the same
// conversation within an hour collapse into one entry ("Jonah and Tess
// commented on The Night Ferry"); the bell counts unread entries.

export type ActivityType = "mention" | "comment" | "conversation_started" | "group_join";

export type ActivityRecord = {
  id: string;
  type: ActivityType;
  actor: Person;
  group: { id: string; name: string };
  title?: Title;
  commentId?: string;
  /** The comment, unless it's a spoiler. */
  quote?: CommentSegment[];
  spoiler: boolean;
  at: Date;
  read: boolean;
};

export type ActivityEntry = {
  /** The newest item's id. */
  key: string;
  ids: string[];
  type: ActivityType;
  /** Newest first, each person once. */
  actors: Person[];
  group: { id: string; name: string };
  title?: Title;
  /** The comment to land on: the earliest in a collapsed run. */
  commentId?: string;
  quote?: CommentSegment[];
  spoiler: boolean;
  /** The newest item's time. */
  at: Date;
  unread: boolean;
};

const HOUR = 60 * 60 * 1000;

/** Collapses records (newest first) into entries (newest first). */
export function collapseActivity(records: ActivityRecord[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  // The open run of comment items per conversation, and when its oldest item was.
  const open = new Map<string, { entry: ActivityEntry; oldest: Date }>();
  for (const record of records) {
    const conversation = record.title ? `${record.group.id}:${record.title.id}` : null;
    const run = record.type === "comment" && conversation ? open.get(conversation) : undefined;
    if (run && run.oldest.getTime() - record.at.getTime() <= HOUR) {
      run.entry.ids.push(record.id);
      if (!run.entry.actors.some((a) => a.id === record.actor.id)) run.entry.actors.push(record.actor);
      run.entry.commentId = record.commentId ?? run.entry.commentId;
      run.entry.unread ||= !record.read;
      run.oldest = record.at;
      continue;
    }
    const entry: ActivityEntry = {
      key: record.id,
      ids: [record.id],
      type: record.type,
      actors: [record.actor],
      group: record.group,
      title: record.title,
      commentId: record.commentId,
      quote: record.quote,
      spoiler: record.spoiler,
      at: record.at,
      unread: !record.read,
    };
    entries.push(entry);
    if (record.type === "comment" && conversation) open.set(conversation, { entry, oldest: record.at });
    else if (conversation) open.delete(conversation);
  }
  return entries;
}

export function unreadCount(entries: ActivityEntry[]): number {
  return entries.filter((e) => e.unread).length;
}

export type ActivitySection = "today" | "week" | "earlier";

/** Today, This week (the last 7 days), and Earlier (DS 5.17). */
export function activitySection(at: Date, now: Date = new Date()): ActivitySection {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (at.getTime() >= startOfToday) return "today";
  if (at.getTime() >= startOfToday - 6 * 24 * HOUR) return "week";
  return "earlier";
}
