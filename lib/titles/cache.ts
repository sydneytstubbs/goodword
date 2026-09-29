import "server-only";
import { cache } from "react";
import type { Title, TitleType } from "@/components/domain/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchTitleDetails } from "@/lib/tmdb/client";
import { recordToTitle, type TitleRecord } from "@/lib/tmdb/normalize";

// The title cache (PRD 8, 9.1). A title is saved the first time anyone views
// it, and refreshed from TMDB when it's older than 7 days. If TMDB is down,
// the cached copy is used however old it is, so the app keeps working.

export const TITLE_TTL_MS = 7 * 24 * 60 * 60_000;

const COLUMNS =
  "tmdb_id, media_type, title, original_title, year, poster_path, genres, runtime_minutes, seasons, overview, accent, fetched_at";

export type CachedTitle = Title & { overview?: string; originalTitle?: string };

type Row = TitleRecord & { fetched_at: string };

function toCachedTitle(row: Row): CachedTitle {
  return {
    ...recordToTitle(row),
    ...(row.overview ? { overview: row.overview } : {}),
    ...(row.original_title && row.original_title !== row.title ? { originalTitle: row.original_title } : {}),
  };
}

export function isFresh(fetchedAt: string, now = Date.now()): boolean {
  return now - new Date(fetchedAt).getTime() < TITLE_TTL_MS;
}

/**
 * A movie or show, from the cache or TMDB. Null when TMDB has no such title.
 * Throws only when TMDB fails and nothing is cached.
 */
export const getTitle = cache(async (type: TitleType, tmdbId: number): Promise<CachedTitle | null> => {
  // Titles are writable only by the server (PRD 8), so this uses the service role.
  const admin = createAdminClient();
  const { data: cached, error: readError } = await admin
    .from("titles")
    .select(COLUMNS)
    .eq("media_type", type)
    .eq("tmdb_id", tmdbId)
    .maybeSingle<Row>();
  if (readError) console.error("titles: cache read failed", readError.code);
  if (cached && isFresh(cached.fetched_at)) return toCachedTitle(cached);

  let record: TitleRecord | null;
  try {
    record = await fetchTitleDetails(type, tmdbId);
  } catch (error) {
    if (cached) return toCachedTitle(cached);
    throw error;
  }
  if (!record) return null;

  // On conflict the database keeps the accent from the first save (DS 4.2.1).
  const { data: saved, error } = await admin
    .from("titles")
    .upsert({ ...record, fetched_at: new Date().toISOString() }, { onConflict: "tmdb_id,media_type" })
    .select(COLUMNS)
    .single<Row>();
  if (error || !saved) {
    console.error("titles: cache write failed", error?.code);
    return toCachedTitle({ ...record, accent: cached?.accent ?? record.accent, fetched_at: new Date().toISOString() });
  }
  return toCachedTitle(saved);
});
