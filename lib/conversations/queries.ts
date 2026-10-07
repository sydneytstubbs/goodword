import "server-only";
import { cache } from "react";
import type { TitleType } from "@/components/domain/types";
import type { GroupSummary } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";
import { recordToTitle, type TitleRecord } from "@/lib/tmdb/normalize";
import { collapseActivity, unreadCount, type ActivityRecord, type ActivityType } from "./activity";
import { decodeBody } from "./body";
import type { CommentCount, ConversationComment, ConversationKey, ConversationPage, ConversationPreview, WordConversation } from "./types";

// Conversation and Activity reads (PRD F13, F14). Everything runs as the
// signed-in user through database functions that check membership, withhold
// other people's spoiler text, and keep the names of people who've left
// (supabase/migrations/…_conversations.sql).

export type CommentRow = {
  id: string;
  user_id: string;
  author_name: string;
  body: string | null;
  mentions: Array<{ id: string; name: string }> | null;
  is_spoiler: boolean;
  created_at: string;
  edited_at: string | null;
};

export function toComment(row: CommentRow, viewerId: string): ConversationComment {
  const covered = row.is_spoiler && row.user_id !== viewerId && row.body === null;
  return {
    id: row.id,
    author: { id: row.user_id, name: row.author_name },
    body: row.body === null ? [] : decodeBody(row.body, row.mentions ?? []),
    at: new Date(row.created_at),
    ...(row.edited_at ? { edited: true } : {}),
    ...(row.is_spoiler ? { spoiler: true } : {}),
    covered,
  };
}

/** The title's row id, if anyone has viewed it (the title cache is readable when signed in). */
export const cachedTitleId = cache(async (type: TitleType, tmdbId: number): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("titles").select("id").eq("media_type", type).eq("tmdb_id", tmdbId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
});

type PreviewRow = {
  group_id: string;
  comment_count: number;
  latest_at: string | null;
  on_shelf: boolean;
  recent: CommentRow[];
};

/**
 * Title detail's conversation preview (F6, DS 5.17): one per group you're in,
 * in the order of `groups`. Any title can have a conversation in any of them.
 */
export async function conversationPreviews(titleId: string | null, groups: GroupSummary[], viewerId: string): Promise<ConversationPreview[]> {
  const rows = new Map<string, PreviewRow>();
  if (titleId) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("conversation_previews", { p_title: titleId });
    if (error) throw new Error(`conversation previews: ${error.code}`);
    for (const row of (data ?? []) as PreviewRow[]) rows.set(row.group_id, row);
  }
  return groups.map((g) => {
    const row = rows.get(g.id);
    return {
      group: { id: g.id, name: g.name, memberCount: g.members.length },
      count: row?.comment_count ?? 0,
      ...(row?.latest_at ? { latestAt: new Date(row.latest_at) } : {}),
      onList: row?.on_shelf ?? false,
      recent: (row?.recent ?? []).map((c) => toComment(c, viewerId)),
    };
  });
}

/**
 * Which group's conversation to show (DS 5.17): the one asked for, then the
 * one with the most recent comment, then one whose list the title is on,
 * then the most recently joined.
 */
export function defaultGroupId(previews: ConversationPreview[], asked?: string | null): string | null {
  if (asked && previews.some((p) => p.group.id === asked)) return asked;
  const latest = previews
    .filter((p) => p.latestAt)
    .sort((a, b) => b.latestAt!.getTime() - a.latestAt!.getTime())[0];
  return latest?.group.id ?? previews.find((p) => p.onList)?.group.id ?? previews[0]?.group.id ?? null;
}

const PAGE = 30;
const CONTEXT = 10;
const MAX_UNSEEN = 200;

type StateRow = { comment_count: number; last_read_at: string | null; first_unseen_at: string | null };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** A comment as conversation_comment returns it: which conversation it's in, too. */
export type LiveCommentRow = CommentRow & { group_id: string | null; title_id: string; good_word_id: string | null };

/** Whether a comment belongs to this conversation. */
export function inConversation(row: LiveCommentRow, key: ConversationKey): boolean {
  return key.kind === "group" ? row.group_id === key.groupId && row.title_id === key.titleId : row.good_word_id === key.goodWordId;
}

async function conversationState(supabase: Supabase, key: ConversationKey): Promise<StateRow | undefined> {
  const { data, error } =
    key.kind === "group"
      ? await supabase.rpc("conversation_state", { p_group: key.groupId, p_title: key.titleId })
      : await supabase.rpc("word_conversation_state", { p_good_word: key.goodWordId });
  if (error) throw new Error(`conversation state: ${error.code}`);
  return (data as StateRow[] | null)?.[0];
}

async function commentRows(supabase: Supabase, key: ConversationKey, args: { p_before?: string; p_from?: string; p_limit: number }) {
  const { data, error } =
    key.kind === "group"
      ? await supabase.rpc("conversation_comments", { p_group: key.groupId, p_title: key.titleId, ...args })
      : await supabase.rpc("word_comments", { p_good_word: key.goodWordId, ...args });
  if (error) throw new Error(`conversation comments: ${error.code}`);
  return (data ?? []) as CommentRow[];
}

/**
 * The conversation under a good word, if the viewer can see it (PRD F16.5):
 * only good words shared with friends have one (open question 14). Null
 * otherwise, with nothing to say why (F16.6 rule 4).
 */
export async function wordConversation(goodWordId: string): Promise<WordConversation | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("word_conversation_state", { p_good_word: goodWordId });
  if (error) throw new Error(`word conversation: ${error.code}`);
  const row = (data as Array<{ author_id: string; author_name: string; title_id: string }> | null)?.[0];
  return row ? { goodWordId, titleId: row.title_id, author: { id: row.author_id, name: row.author_name } } : null;
}

/** People you can mention under a good word: those who can see it and whom you already know (DS 4.2.11). */
export async function wordMentionPeople(goodWordId: string): Promise<Array<{ id: string; name: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("word_mention_people", { p_good_word: goodWordId });
  if (error) throw new Error(`mention people: ${error.code}`);
  return (data ?? []) as Array<{ id: string; name: string }>;
}

/**
 * A conversation to open (F13, F16.5, DS 5.17): from a linked comment (with
 * some context above it), or from the first unseen comment below the New
 * divider, or the latest page. Empty for someone who can't see it.
 */
export async function loadConversation(key: ConversationKey, viewerId: string, linkedCommentId?: string): Promise<ConversationPage> {
  const supabase = await createClient();
  const state = await conversationState(supabase, key);
  if (!state) return { comments: [], hasOlder: false, count: 0 };

  const fetch = (args: { p_before?: string; p_from?: string; p_limit: number }) => commentRows(supabase, key, args);

  let anchor: string | null = null;
  if (linkedCommentId) {
    const { data } = await supabase.rpc("conversation_comment", { p_id: linkedCommentId });
    const linked = (data as LiveCommentRow[] | null)?.[0];
    if (linked && inConversation(linked, key)) anchor = linked.created_at;
  }
  anchor ??= state.first_unseen_at;

  let rows: CommentRow[] = [];
  if (anchor) {
    const [before, from] = await Promise.all([fetch({ p_before: anchor, p_limit: CONTEXT }), fetch({ p_from: anchor, p_limit: MAX_UNSEEN })]);
    // Too much to show at once: open at the latest page instead.
    if (from.length < MAX_UNSEEN) rows = [...before, ...from];
  }
  if (rows.length === 0 && state.comment_count > 0) rows = await fetch({ p_limit: PAGE });

  const comments = rows.map((r) => toComment(r, viewerId));
  const unseenAt = state.first_unseen_at ? new Date(state.first_unseen_at).getTime() : null;
  const firstUnseen = unseenAt === null ? undefined : comments.find((c) => c.at.getTime() >= unseenAt && c.author.id !== viewerId);
  return {
    comments,
    hasOlder: state.comment_count > comments.length,
    count: state.comment_count,
    ...(firstUnseen ? { firstUnseenId: firstUnseen.id } : {}),
  };
}

/** The page of comments before `before` (scrolling up), oldest first. */
export async function olderComments(key: ConversationKey, before: string, viewerId: string) {
  const rows = await commentRows(await createClient(), key, { p_before: before, p_limit: PAGE });
  return { comments: rows.map((r) => toComment(r, viewerId)), hasOlder: rows.length === PAGE };
}

/** Everything from `from` on (catching up after the live connection drops), oldest first. */
export async function newerComments(key: ConversationKey, from: string, viewerId: string) {
  const rows = await commentRows(await createClient(), key, { p_from: from, p_limit: MAX_UNSEEN });
  return rows.map((r) => toComment(r, viewerId));
}

/**
 * Comment counts for list cards (DS 4.2.2), by title row id: summed over
 * `groupIds`, and whether any has comments you haven't seen. Empty (no
 * counts) if they can't be read, rather than failing the list.
 */
export async function commentCounts(groupIds: string[]): Promise<Map<string, CommentCount>> {
  const counts = new Map<string, CommentCount>();
  if (groupIds.length === 0) return counts;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("comment_counts", { p_groups: groupIds });
  if (error) {
    console.error("comment counts failed", error.code);
    return counts;
  }
  for (const row of (data ?? []) as Array<{ title_id: string; comment_count: number; unseen: boolean }>) {
    const current = counts.get(row.title_id) ?? { count: 0, unseen: false };
    counts.set(row.title_id, { count: current.count + row.comment_count, unseen: current.unseen || row.unseen });
  }
  return counts;
}

type ActivityRow = {
  id: string;
  type: ActivityType;
  actor_id: string;
  actor_name: string;
  group_id: string | null;
  group_name: string | null;
  title_id: string | null;
  comment_id: string | null;
  body: string | null;
  mentions: Array<{ id: string; name: string }> | null;
  is_spoiler: boolean;
  created_at: string;
  read_at: string | null;
  good_word_id: string | null;
  word_author_id: string | null;
  word_author_name: string | null;
};

type TitleRow = Omit<TitleRecord, "overview" | "original_title"> & { id: string };

/** Your Activity, newest first (F14). */
export async function activityRecords(options: { unreadOnly?: boolean } = {}): Promise<ActivityRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_activity", { p_limit: 200, p_unread_only: options.unreadOnly ?? false });
  if (error) throw new Error(`activity: ${error.code}`);
  const rows = (data ?? []) as ActivityRow[];
  const titleIds = [...new Set(rows.flatMap((r) => (r.title_id ? [r.title_id] : [])))];
  const titles = new Map<string, ReturnType<typeof recordToTitle>>();
  if (titleIds.length > 0 && !options.unreadOnly) {
    const { data: titleRows } = await supabase
      .from("titles")
      .select("id, tmdb_id, media_type, title, year, poster_path, genres, runtime_minutes, seasons, accent")
      .in("id", titleIds)
      .returns<TitleRow[]>();
    for (const row of titleRows ?? []) titles.set(row.id, recordToTitle(row));
  }
  return rows.map((r) => {
    const title = r.title_id ? titles.get(r.title_id) : undefined;
    return {
      id: r.id,
      type: r.type,
      actor: { id: r.actor_id, name: r.actor_name },
      group: r.group_id ? { id: r.group_id, name: r.group_name ?? "" } : null,
      ...(r.good_word_id && r.word_author_id
        ? { word: { goodWordId: r.good_word_id, author: { id: r.word_author_id, name: r.word_author_name ?? "" } } }
        : {}),
      // Unread-only reads (the bell) only need something to group by.
      ...(r.title_id ? { title: title ?? { id: r.title_id, type: "movie" as const, name: "", genres: [], accent: "clay" as const } } : {}),
      ...(r.comment_id ? { commentId: r.comment_id } : {}),
      ...(r.body !== null && r.comment_id ? { quote: decodeBody(r.body, r.mentions ?? []) } : {}),
      spoiler: r.is_spoiler,
      at: new Date(r.created_at),
      read: r.read_at !== null,
    };
  });
}

/** The bell's count: unread Activity entries, after collapsing (F14). Zero if it can't be read. */
export async function unreadActivityCount(): Promise<number> {
  try {
    return unreadCount(collapseActivity(await activityRecords({ unreadOnly: true })));
  } catch (error) {
    console.error("activity count failed", (error as Error).message);
    return 0;
  }
}
