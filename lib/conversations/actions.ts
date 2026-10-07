"use server";

import type { CommentSegment } from "@/components/domain/types";
import { lengthBucket } from "@/lib/events/schema";
import { recordEvent } from "@/lib/events/server";
import { createClient } from "@/lib/supabase/server";
import { COMMENT_MAX, decodeBody, encodeBody, plainText, trimSegments } from "./body";
import {
  inConversation,
  newerComments,
  olderComments as loadOlder,
  toComment,
  unreadActivityCount,
  type CommentRow,
  type LiveCommentRow,
} from "./queries";
import type { ConversationComment, ConversationKey } from "./types";

// Conversation writes and the reads screens make after load (PRD F13, F14,
// F16.5). Each calls a database function that checks who can see the
// conversation, limits, and mentions. A conversation is a group's about a
// title, or the one under a good word (ConversationKey). The screens apply writes optimistically first and roll back on
// failure (DS 5.10). Nothing here refreshes the router: the conversation keeps
// its own list, and lists pick up counts on their next load (F13).

export type CommentWriteResult = { ok: true } | { ok: false; error: "failed" | "rateLimited" | "tooLong" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const valid = (...ids: string[]) => ids.every((id) => UUID.test(id));
const validKey = (key: ConversationKey) =>
  key.kind === "group" ? valid(key.groupId, key.titleId) : key.kind === "word" && valid(key.goodWordId, key.titleId);

async function viewerId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.sub as string | undefined) ?? null;
}

function cleanBody(body: CommentSegment[]): string | null {
  const segments = trimSegments(body);
  const text = plainText(segments);
  if (text.length === 0 || text.length > COMMENT_MAX) return null;
  return encodeBody(segments);
}

export async function postComment(input: {
  id: string;
  conversation: ConversationKey;
  body: CommentSegment[];
  spoiler: boolean;
}): Promise<CommentWriteResult> {
  if (!valid(input.id) || !validKey(input.conversation)) return { ok: false, error: "failed" };
  const body = cleanBody(input.body);
  if (!body) return { ok: false, error: "tooLong" };
  const supabase = await createClient();
  const key = input.conversation;
  const { data, error } =
    key.kind === "group"
      ? await supabase.rpc("post_comment", { p_id: input.id, p_group: key.groupId, p_title: key.titleId, p_body: body, p_spoiler: input.spoiler })
      : await supabase.rpc("post_word_comment", { p_id: input.id, p_good_word: key.goodWordId, p_body: body, p_spoiler: input.spoiler });
  if (error) return { ok: false, error: "failed" };
  if (data === "created") await recordComment(supabase, input, plainText(trimSegments(input.body)).length);
  if (data === "created" || data === "exists") return { ok: true };
  if (data === "rate_limited") return { ok: false, error: "rateLimited" };
  if (data === "too_long") return { ok: false, error: "tooLong" };
  return { ok: false, error: "failed" };
}

/**
 * comment_created, and a mention_notified (in Activity) for each person the
 * database kept as mentioned (PRD 11.2, H7). Never the comment's text.
 */
async function recordComment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: { id: string; conversation: ConversationKey; spoiler: boolean },
  length: number,
) {
  const { data: mentions } = await supabase.from("comment_mentions").select("mentioned_user_id").eq("comment_id", input.id);
  const mentioned = (mentions ?? []).map((m) => m.mentioned_user_id as string);
  const key = input.conversation;
  await recordEvent("comment_created", {
    scope: key.kind === "group" ? "group" : "good_word",
    ...(key.kind === "group" ? { group_id: key.groupId } : {}),
    title_id: key.titleId,
    length_bucket: lengthBucket(length),
    mention_count: mentioned.length,
    is_spoiler: input.spoiler,
  });
  for (const person of mentioned) await recordEvent("mention_notified", { channel: "activity" }, person);
}

export async function editComment(id: string, body: CommentSegment[], spoiler: boolean): Promise<CommentWriteResult> {
  if (!valid(id)) return { ok: false, error: "failed" };
  const cleaned = cleanBody(body);
  if (!cleaned) return { ok: false, error: "tooLong" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("edit_comment", { p_id: id, p_body: cleaned, p_spoiler: spoiler });
  if (error || data !== "updated") return { ok: false, error: data === "too_long" ? "tooLong" : "failed" };
  await recordEvent("comment_edited");
  return { ok: true };
}

export async function deleteComment(id: string): Promise<CommentWriteResult> {
  if (!valid(id)) return { ok: false, error: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_comment", { p_id: id });
  if (error || data !== true) return { ok: false, error: "failed" };
  await recordEvent("comment_deleted", { undone: false });
  return { ok: true };
}

export async function restoreComment(id: string): Promise<CommentWriteResult> {
  if (!valid(id)) return { ok: false, error: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_comment", { p_id: id });
  if (error || data !== true) return { ok: false, error: "failed" };
  await recordEvent("comment_deleted", { undone: true });
  return { ok: true };
}

/**
 * One comment as the viewer may see it, for live updates (DS 5.17). Null if
 * it's gone or not in this conversation.
 */
export async function fetchComment(id: string, conversation: ConversationKey): Promise<ConversationComment | null> {
  if (!valid(id) || !validKey(conversation)) return null;
  const supabase = await createClient();
  const [{ data }, viewer] = await Promise.all([supabase.rpc("conversation_comment", { p_id: id }), viewerId(supabase)]);
  const row = (data as LiveCommentRow[] | null)?.[0];
  if (!row || !viewer || !inConversation(row, conversation)) return null;
  return toComment(row, viewer);
}

/** A spoiler's text, when someone taps to reveal it (DS 4.2.12). Null if it can't be read. */
export async function revealComment(id: string): Promise<CommentSegment[] | null> {
  if (!valid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("conversation_comment", { p_id: id, p_reveal: true });
  const row = (data as CommentRow[] | null)?.[0];
  if (error || !row || row.body === null) return null;
  await recordEvent("spoiler_revealed");
  return decodeBody(row.body, row.mentions ?? []);
}

export async function fetchOlderComments(
  conversation: ConversationKey,
  before: string,
): Promise<{ comments: ConversationComment[]; hasOlder: boolean } | null> {
  if (!validKey(conversation) || Number.isNaN(Date.parse(before))) return null;
  const supabase = await createClient();
  const viewer = await viewerId(supabase);
  if (!viewer) return null;
  try {
    return await loadOlder(conversation, before, viewer);
  } catch {
    return null;
  }
}

/** Comments from `from` on, to catch up after the live connection drops (DS 5.17). */
export async function fetchNewerComments(conversation: ConversationKey, from: string): Promise<ConversationComment[] | null> {
  if (!validKey(conversation) || Number.isNaN(Date.parse(from))) return null;
  const supabase = await createClient();
  const viewer = await viewerId(supabase);
  if (!viewer) return null;
  try {
    return await newerComments(conversation, from, viewer);
  } catch {
    return null;
  }
}

/** Marks what was shown as seen, and its Activity items read (F13, F14). */
export async function markConversationRead(conversation: ConversationKey, upTo: string): Promise<void> {
  if (!validKey(conversation) || Number.isNaN(Date.parse(upTo))) return;
  const supabase = await createClient();
  if (conversation.kind === "group") {
    await supabase.rpc("mark_conversation_read", { p_group: conversation.groupId, p_title: conversation.titleId, p_up_to: upTo });
  } else {
    await supabase.rpc("mark_word_read", { p_good_word: conversation.goodWordId, p_up_to: upTo });
  }
}

export async function markSpoilerHintSeen(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_spoiler_hint_seen");
}

/** The bell's unread count (F14). */
export async function activityCount(): Promise<number> {
  return unreadActivityCount();
}

export async function markActivityRead(ids: string[]): Promise<void> {
  if (!valid(...ids)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_activity_read", { p_ids: ids });
}

export async function markAllActivityRead(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_all_activity_read");
  return !error;
}

/** Opening a group's details marks its join items read (F14). */
export async function markGroupJoinsRead(groupId: string): Promise<void> {
  if (!valid(groupId)) return;
  const supabase = await createClient();
  await supabase.rpc("mark_group_joins_read", { p_group: groupId });
}
