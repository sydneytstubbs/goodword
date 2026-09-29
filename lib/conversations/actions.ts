"use server";

import type { CommentSegment } from "@/components/domain/types";
import { createClient } from "@/lib/supabase/server";
import { COMMENT_MAX, decodeBody, encodeBody, plainText, trimSegments } from "./body";
import { newerComments, olderComments as loadOlder, toComment, unreadActivityCount, type CommentRow } from "./queries";
import type { ConversationComment } from "./types";

// Conversation writes and the reads screens make after load (PRD F13, F14).
// Each calls a database function that checks membership, limits, and
// mentions. The screens apply writes optimistically first and roll back on
// failure (DS 5.10). Nothing here refreshes the router: the conversation keeps
// its own list, and shelves pick up counts on their next load (F13).

export type CommentWriteResult = { ok: true } | { ok: false; error: "failed" | "rateLimited" | "tooLong" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const valid = (...ids: string[]) => ids.every((id) => UUID.test(id));

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
  groupId: string;
  titleId: string;
  body: CommentSegment[];
  spoiler: boolean;
}): Promise<CommentWriteResult> {
  if (!valid(input.id, input.groupId, input.titleId)) return { ok: false, error: "failed" };
  const body = cleanBody(input.body);
  if (!body) return { ok: false, error: "tooLong" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_comment", {
    p_id: input.id,
    p_group: input.groupId,
    p_title: input.titleId,
    p_body: body,
    p_spoiler: input.spoiler,
  });
  if (error) return { ok: false, error: "failed" };
  if (data === "created" || data === "exists") return { ok: true };
  if (data === "rate_limited") return { ok: false, error: "rateLimited" };
  if (data === "too_long") return { ok: false, error: "tooLong" };
  return { ok: false, error: "failed" };
}

export async function editComment(id: string, body: CommentSegment[], spoiler: boolean): Promise<CommentWriteResult> {
  if (!valid(id)) return { ok: false, error: "failed" };
  const cleaned = cleanBody(body);
  if (!cleaned) return { ok: false, error: "tooLong" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("edit_comment", { p_id: id, p_body: cleaned, p_spoiler: spoiler });
  if (error || data !== "updated") return { ok: false, error: data === "too_long" ? "tooLong" : "failed" };
  return { ok: true };
}

export async function deleteComment(id: string): Promise<CommentWriteResult> {
  if (!valid(id)) return { ok: false, error: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_comment", { p_id: id });
  return error || data !== true ? { ok: false, error: "failed" } : { ok: true };
}

export async function restoreComment(id: string): Promise<CommentWriteResult> {
  if (!valid(id)) return { ok: false, error: "failed" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_comment", { p_id: id });
  return error || data !== true ? { ok: false, error: "failed" } : { ok: true };
}

type LiveRow = CommentRow & { group_id: string; title_id: string };

/**
 * One comment as the viewer may see it, for live updates (DS 5.17). Null if
 * it's gone or not in this conversation.
 */
export async function fetchComment(id: string, groupId: string, titleId: string): Promise<ConversationComment | null> {
  if (!valid(id, groupId, titleId)) return null;
  const supabase = await createClient();
  const [{ data }, viewer] = await Promise.all([supabase.rpc("conversation_comment", { p_id: id }), viewerId(supabase)]);
  const row = (data as LiveRow[] | null)?.[0];
  if (!row || !viewer || row.group_id !== groupId || row.title_id !== titleId) return null;
  return toComment(row, viewer);
}

/** A spoiler's text, when someone taps to reveal it (DS 4.2.12). Null if it can't be read. */
export async function revealComment(id: string): Promise<CommentSegment[] | null> {
  if (!valid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("conversation_comment", { p_id: id, p_reveal: true });
  const row = (data as CommentRow[] | null)?.[0];
  if (error || !row || row.body === null) return null;
  return decodeBody(row.body, row.mentions ?? []);
}

export async function fetchOlderComments(
  groupId: string,
  titleId: string,
  before: string,
): Promise<{ comments: ConversationComment[]; hasOlder: boolean } | null> {
  if (!valid(groupId, titleId) || Number.isNaN(Date.parse(before))) return null;
  const supabase = await createClient();
  const viewer = await viewerId(supabase);
  if (!viewer) return null;
  try {
    return await loadOlder(groupId, titleId, before, viewer);
  } catch {
    return null;
  }
}

/** Comments from `from` on, to catch up after the live connection drops (DS 5.17). */
export async function fetchNewerComments(groupId: string, titleId: string, from: string): Promise<ConversationComment[] | null> {
  if (!valid(groupId, titleId) || Number.isNaN(Date.parse(from))) return null;
  const supabase = await createClient();
  const viewer = await viewerId(supabase);
  if (!viewer) return null;
  try {
    return await newerComments(groupId, titleId, from, viewer);
  } catch {
    return null;
  }
}

/** Marks what was shown as seen, and its Activity items read (F13, F14). */
export async function markConversationRead(groupId: string, titleId: string, upTo: string): Promise<void> {
  if (!valid(groupId, titleId) || Number.isNaN(Date.parse(upTo))) return;
  const supabase = await createClient();
  await supabase.rpc("mark_conversation_read", { p_group: groupId, p_title: titleId, p_up_to: upTo });
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
