import "server-only";
import type { Person, Title } from "@/components/domain/types";
import { friendIds } from "@/lib/friends/queries";
import { createClient } from "@/lib/supabase/server";
import { recordToTitle, type TitleRecord } from "@/lib/tmdb/normalize";

// "Share your list with friends?" (PRD F16.10, DS 5.20): once, after the flip,
// for people who had an account before it, have a friend, and have good words
// their friends can't see yet. The database decides whether it's due.

export type SharePromptData = {
  /** Your friends, by name. */
  friends: Person[];
  /** Your good words not shared with friends, newest first, for Choose. */
  goodWords: Array<{ id: string; title: Title }>;
};

type Row = { id: string; titles: Omit<TitleRecord, "overview" | "original_title"> & { id: string } };

export async function sharePrompt(userId: string): Promise<SharePromptData | null> {
  const supabase = await createClient();
  const { data: wanted, error } = await supabase.rpc("share_prompt_wanted");
  if (error || wanted !== true) return null;
  const ids = await friendIds(userId);
  const [{ data: names }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("user_id, display_name").in("user_id", ids),
    supabase
      .from("good_words")
      .select("id, titles(id, tmdb_id, media_type, title, year, poster_path, genres, runtime_minutes, seasons, accent)")
      .eq("user_id", userId)
      .is("friends_shared_at", null)
      .order("created_at", { ascending: false })
      .returns<Row[]>(),
  ]);
  const friends = (names ?? [])
    .map((p) => ({ id: p.user_id as string, name: (p.display_name as string | null) ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const goodWords = (rows ?? []).map((r) => ({ id: r.id, title: recordToTitle(r.titles) }));
  if (friends.length === 0 || goodWords.length === 0) return null;
  return { friends, goodWords };
}
