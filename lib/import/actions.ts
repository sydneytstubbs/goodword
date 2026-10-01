"use server";

import { refresh } from "next/cache";
import type { TitleType } from "@/components/domain/types";
import { putGoodWord, takeBackGoodWord, type Milestone, type TitleRef } from "@/lib/good-words/actions";
import { recordEvent } from "@/lib/events/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CardCandidate } from "./match";

// The review deck's writes (PRD F15.3). Add puts in a good word with source
// `import` into the import's groups (the ones you're still in), then records
// the decision; Skip only records it; Undo reverses both. Every card is read
// through RLS, so only its owner can act on it.

export type DeckResult =
  | { ok: true; left: number; created: boolean; milestone?: Milestone }
  | { ok: false; error: "failed" | "rateLimited" | "notFound" };

type CardRow = {
  id: string;
  import_id: string;
  candidates: CardCandidate[];
  added_type: TitleType | null;
  added_tmdb_id: number | null;
  created_good_word: boolean;
  imports: { group_ids: string[]; created_at: string; duplicate_count: number };
};

const FAILED: DeckResult = { ok: false, error: "failed" };

async function loadCard(cardId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("import_cards")
    .select("id, import_id, candidates, added_type, added_tmdb_id, created_good_word, imports!inner(group_ids, created_at, duplicate_count)")
    .eq("id", cardId)
    .maybeSingle<CardRow>();
  return { supabase, card: data };
}

async function decide(
  supabase: Awaited<ReturnType<typeof createClient>>,
  card: CardRow,
  decision: "added" | "skipped" | "pending",
  chosen: number,
  note: string | null,
  opened: boolean,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("decide_import_card", {
    p_card: card.id,
    p_decision: decision,
    p_chosen: chosen,
    p_note: note,
    p_opened: opened,
  });
  if (error || typeof data !== "number" || data < 0) return null;
  return data;
}

async function finishedEvent(supabase: Awaited<ReturnType<typeof createClient>>, card: CardRow) {
  const { data } = await supabase.from("import_cards").select("decision").eq("import_id", card.import_id);
  const rows = data ?? [];
  await recordEvent("import_finished", {
    added_count: rows.filter((r) => r.decision === "added").length,
    skipped_count: rows.filter((r) => r.decision === "skipped").length,
    duplicate_count: card.imports.duplicate_count,
    ms_from_start: Date.now() - new Date(card.imports.created_at).getTime(),
  });
}

/** Groups from the import that you're still a member of. */
async function currentGroups(supabase: Awaited<ReturnType<typeof createClient>>, groupIds: string[]): Promise<string[]> {
  if (groupIds.length === 0) return [];
  const { data } = await supabase.from("groups").select("id").in("id", groupIds);
  const still = new Set((data ?? []).map((g) => g.id as string));
  return groupIds.filter((id) => still.has(id));
}

/**
 * Add: the chosen candidate, or `searched` (a title picked with Search
 * instead). Already on your list counts as added, without a second good word.
 */
export async function addImportCard(
  cardId: string,
  input: { chosen: number; note: string; opened: boolean; bulk?: boolean; searched?: TitleRef },
): Promise<DeckResult> {
  const { supabase, card } = await loadCard(cardId);
  if (!card) return { ok: false, error: "notFound" };
  const picked = card.candidates[input.chosen] ?? card.candidates[0];
  const ref: TitleRef = input.searched ?? { type: picked.type as TitleType, tmdbId: picked.tmdbId };

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub as string | undefined;
  if (!userId) return FAILED;
  const { data: already } = await supabase
    .from("good_words")
    .select("id, titles!inner(tmdb_id, media_type)")
    .eq("user_id", userId)
    .eq("titles.tmdb_id", ref.tmdbId)
    .eq("titles.media_type", ref.type)
    .maybeSingle();

  let milestone: Milestone | undefined;
  if (!already) {
    const put = await putGoodWord(ref, {
      note: input.note,
      groupIds: await currentGroups(supabase, card.imports.group_ids),
      source: "import",
    });
    if (!put.ok) return put;
    milestone = put.milestone;
  }
  const left = await decide(supabase, card, "added", input.searched ? 0 : input.chosen, input.note, input.opened || Boolean(input.searched));
  if (left === null) return FAILED;
  // What was added, so Undo takes back only a good word this import created.
  // The card was read through RLS above, so it's this person's.
  await createAdminClient()
    .from("import_cards")
    .update({ added_type: ref.type, added_tmdb_id: ref.tmdbId, created_good_word: !already })
    .eq("id", card.id);
  await recordEvent("import_card_decided", { decision: "added", opened_alternatives: input.opened, bulk: input.bulk ?? false });
  if (left === 0) await finishedEvent(supabase, card);
  if (already) refresh();
  return { ok: true, left, created: !already, ...(milestone ? { milestone } : {}) };
}

export async function skipImportCard(cardId: string, input: { chosen: number; note: string; opened: boolean }): Promise<DeckResult> {
  const { supabase, card } = await loadCard(cardId);
  if (!card) return { ok: false, error: "notFound" };
  const left = await decide(supabase, card, "skipped", input.chosen, input.note, input.opened);
  if (left === null) return FAILED;
  await recordEvent("import_card_decided", { decision: "skipped", opened_alternatives: input.opened, bulk: false });
  if (left === 0) await finishedEvent(supabase, card);
  refresh();
  return { ok: true, left, created: false };
}

/** Undo: takes back the good word Add created (only if it created one), and the card is pending again. */
export async function undoImportCard(cardId: string): Promise<DeckResult> {
  const { supabase, card } = await loadCard(cardId);
  if (!card) return { ok: false, error: "notFound" };
  if (card.created_good_word && card.added_type && card.added_tmdb_id) {
    const back = await takeBackGoodWord({ type: card.added_type, tmdbId: card.added_tmdb_id });
    if (!back.ok) return back;
  }
  const left = await decide(supabase, card, "pending", -1, null, false);
  if (left === null) return FAILED;
  await createAdminClient()
    .from("import_cards")
    .update({ added_type: null, added_tmdb_id: null, created_good_word: false })
    .eq("id", card.id);
  refresh();
  return { ok: true, left, created: false };
}

/** Add all remaining: every pending high-confidence card, in order, with its note. */
export async function addAllRemaining(importId: string): Promise<{ ok: boolean; added: number; left: number; rateLimited: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("import_cards")
    .select("id, note, chosen")
    .eq("import_id", importId)
    .eq("decision", "pending")
    .eq("confidence", "high")
    .order("position");
  let added = 0;
  let left = -1;
  for (const row of data ?? []) {
    const result = await addImportCard(row.id, { chosen: row.chosen, note: row.note, opened: false, bulk: true });
    if (!result.ok) return { ok: false, added, left, rateLimited: result.error === "rateLimited" };
    added++;
    left = result.left;
  }
  if (left < 0) {
    const { count } = await supabase
      .from("import_cards")
      .select("id", { count: "exact", head: true })
      .eq("import_id", importId)
      .eq("decision", "pending");
    left = count ?? 0;
  }
  return { ok: true, added, left, rateLimited: false };
}
