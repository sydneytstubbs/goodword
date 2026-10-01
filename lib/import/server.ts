import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TitleType } from "@/components/domain/types";
import { getTitle } from "@/lib/titles/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchTitles } from "@/lib/tmdb/client";
import { titleKey } from "@/lib/tmdb/normalize";
import { extractTitles } from "./ai";
import { toCardCandidate } from "./match";
import type { CachedMatch, PipelineDeps } from "./pipeline";

// The real dependencies for an import (PRD F15.2): TMDB, the model, the
// shared match cache, and the person's own list for duplicates.

/** "tv-1396" keys for every title already on this person's list. */
export async function existingKeys(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("good_words")
    .select("titles!inner(tmdb_id, media_type)")
    .eq("user_id", userId)
    .returns<Array<{ titles: { tmdb_id: number; media_type: TitleType } }>>();
  return new Set((data ?? []).map((row) => titleKey(row.titles.media_type, row.titles.tmdb_id)));
}

export function importDeps(existing: Set<string>): PipelineDeps {
  const admin = createAdminClient();
  return {
    extract: extractTitles,
    search: (query, signal) => searchTitles(query, signal),
    cachedMatches: async (keys) => {
      const map = new Map<string, CachedMatch>();
      if (keys.length === 0) return map;
      const { data } = await admin.from("title_matches").select("query_key, media_type, tmdb_id").in("query_key", [...new Set(keys)]);
      for (const row of data ?? []) map.set(row.query_key, { type: row.media_type, tmdbId: row.tmdb_id });
      return map;
    },
    saveMatches: async (rows) => {
      if (rows.length === 0) return;
      const unique = new Map(rows.map((r) => [r.key, r]));
      await admin
        .from("title_matches")
        .upsert(
          [...unique.values()].map((r) => ({ query_key: r.key, media_type: r.type, tmdb_id: r.tmdbId })),
          { onConflict: "query_key", ignoreDuplicates: true },
        );
    },
    titleFor: async (match) => {
      const title = await getTitle(match.type, match.tmdbId).catch(() => null);
      return title ? toCardCandidate(title) : null;
    },
    existing,
  };
}
