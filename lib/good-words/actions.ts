"use server";

import { refresh } from "next/cache";
import type { GoodWordSource, MyGoodWord, TitleType } from "@/components/domain/types";
import { recordEvent } from "@/lib/events/server";
import { createClient } from "@/lib/supabase/server";
import { titleRowId } from "./queries";

// Good word writes (PRD F4). Each calls a database function that checks
// membership and limits (supabase/migrations/…_good_words.sql), then refreshes
// the router so every shelf shows the change. The client applies it
// optimistically first and rolls back on failure (DS 5.10).

export type TitleRef = { type: TitleType; tmdbId: number };
export type Milestone = "first" | "tenth";
export type WriteResult =
  | { ok: true; milestone?: Milestone }
  | { ok: false; error: "failed" | "rateLimited" | "notFound" };

const FAILED: WriteResult = { ok: false, error: "failed" };

function validRef(ref: TitleRef): boolean {
  return (ref.type === "movie" || ref.type === "tv") && Number.isInteger(ref.tmdbId) && ref.tmdbId > 0;
}

async function resolve(ref: TitleRef): Promise<string | null | "failed"> {
  if (!validRef(ref)) return null;
  try {
    return await titleRowId(ref.type, ref.tmdbId);
  } catch {
    // TMDB is down and nobody has saved this title yet.
    return "failed";
  }
}

const note = (value: string) => value.trim().slice(0, 140);

export async function putGoodWord(
  ref: TitleRef,
  input: { note: string; groupIds: string[]; source: GoodWordSource; msFromAddOpened?: number },
): Promise<WriteResult> {
  const titleId = await resolve(ref);
  if (titleId === "failed") return FAILED;
  if (!titleId) return { ok: false, error: "notFound" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("put_good_word", {
    p_title: titleId,
    p_note: note(input.note),
    p_groups: input.groupIds,
    p_source: input.source,
  });
  const result = (data as Array<{ status: string; milestone: Milestone | null }> | null)?.[0];
  if (error || !result) return FAILED;
  if (result.status === "rate_limited") return { ok: false, error: "rateLimited" };
  if (result.status !== "created" && result.status !== "updated") return FAILED;
  // Putting in a good word you already have just changes its groups (F4).
  if (result.status === "created") {
    await recordEvent("good_word_created", {
      title_id: titleId,
      groups_count: input.groupIds.length,
      has_note: note(input.note).length > 0,
      source: input.source,
      ms_from_add_opened: input.msFromAddOpened,
    });
  } else await recordEvent("good_word_edited", { field: "groups" });
  refresh();
  return { ok: true, ...(result.milestone ? { milestone: result.milestone } : {}) };
}

export async function editGoodWordNote(ref: TitleRef, value: string): Promise<WriteResult> {
  const titleId = await resolve(ref);
  if (!titleId || titleId === "failed") return FAILED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("edit_good_word_note", { p_title: titleId, p_note: note(value) });
  if (error || data !== true) return FAILED;
  await recordEvent("good_word_edited", { field: "note" });
  refresh();
  return { ok: true };
}

export async function setGoodWordGroups(ref: TitleRef, groupIds: string[]): Promise<WriteResult> {
  const titleId = await resolve(ref);
  if (!titleId || titleId === "failed") return FAILED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_good_word_groups", { p_title: titleId, p_groups: groupIds });
  if (error || data !== "updated") return FAILED;
  await recordEvent("good_word_edited", { field: "groups" });
  refresh();
  return { ok: true };
}

export async function takeBackGoodWord(ref: TitleRef): Promise<WriteResult> {
  const titleId = await resolve(ref);
  if (!titleId || titleId === "failed") return FAILED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("take_back_good_word", { p_title: titleId });
  if (error) return FAILED;
  await recordEvent("good_word_taken_back", { undone: false });
  refresh();
  return { ok: true };
}

/**
 * Puts a good word back exactly as it was (Undo, F4): after taking it back,
 * the snapshot is restored; after an edit, the old note and groups return.
 */
export async function restoreGoodWord(ref: TitleRef, snapshot: MyGoodWord): Promise<WriteResult> {
  const titleId = await resolve(ref);
  if (!titleId || titleId === "failed") return FAILED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_good_word", {
    p_title: titleId,
    p_note: note(snapshot.note),
    p_source: snapshot.source,
    p_created_at: snapshot.createdAt,
    p_groups: snapshot.groupIds,
    p_shared_at: snapshot.groupIds.map((id) => snapshot.sharedAt[id] ?? snapshot.createdAt),
  });
  if (error) return FAILED;
  if (data === "exists") {
    const [edited, moved] = await Promise.all([
      supabase.rpc("edit_good_word_note", { p_title: titleId, p_note: note(snapshot.note) }),
      supabase.rpc("set_good_word_groups", { p_title: titleId, p_groups: snapshot.groupIds }),
    ]);
    if (edited.error || moved.error) return FAILED;
  } else if (data !== "restored") return FAILED;
  else await recordEvent("good_word_taken_back", { undone: true });
  refresh();
  return { ok: true };
}

/** The first-good-word prompt doesn't come back for this group (F5.7). */
export async function dismissJoinPrompt(groupId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("dismiss_join_prompt", { p_group: groupId });
}
