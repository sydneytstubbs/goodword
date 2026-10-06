import "server-only";
import { after } from "next/server";
import { cache } from "react";
import type { TitleType } from "@/components/domain/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWatchProviders } from "@/lib/tmdb/client";
import { NO_PROVIDERS, type Provider, type WatchProviders } from "@/lib/tmdb/normalize";

// Where to watch, cached per title per region (PRD 8, 9.1, 9.2) and
// refreshed when older than 24 hours. If TMDB is down, the cached copy is
// used however old it is. Writes use the service role: only the server
// writes this table.

export const PROVIDERS_TTL_MS = 24 * 60 * 60_000;
/** Titles fetched while a list waits; the rest fill in after the response. */
const WAIT_FOR = 24;
const CONCURRENCY = 6;

export type TitleRef = { rowId: string; type: TitleType; tmdbId: number };

type Row = { title_id: string; providers: Partial<Record<"stream" | "rent" | "buy", Provider[]>>; link: string | null; fetched_at: string };

export function safeRegion(region: string | null | undefined): string {
  return region && /^[A-Z]{2}$/.test(region) ? region : "US";
}

function fromRow(row: Row): WatchProviders {
  return {
    stream: row.providers.stream ?? [],
    rent: row.providers.rent ?? [],
    buy: row.providers.buy ?? [],
    link: row.link,
  };
}

const isFresh = (row: Row, now = Date.now()) => now - new Date(row.fetched_at).getTime() < PROVIDERS_TTL_MS;

async function readRows(rowIds: string[], region: string): Promise<Map<string, Row>> {
  if (rowIds.length === 0) return new Map();
  const { data, error } = await createAdminClient()
    .from("watch_providers")
    .select("title_id, providers, link, fetched_at")
    .eq("region", region)
    .in("title_id", rowIds)
    .returns<Row[]>();
  if (error) console.error("watch providers: cache read failed", error.code);
  return new Map((data ?? []).map((row) => [row.title_id, row]));
}

/** Fetches from TMDB and saves. Throws when TMDB fails. */
async function refresh(ref: TitleRef, region: string): Promise<WatchProviders> {
  const providers = await fetchWatchProviders(ref.type, ref.tmdbId, region);
  const { stream, rent, buy, link } = providers;
  const { error } = await createAdminClient()
    .from("watch_providers")
    .upsert(
      { title_id: ref.rowId, region, providers: { stream, rent, buy }, link, fetched_at: new Date().toISOString() },
      { onConflict: "title_id,region" },
    );
  if (error) console.error("watch providers: cache write failed", error.code);
  return providers;
}

async function pool<T>(items: T[], run: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await run(item);
    }),
  );
}

function refreshLater(refs: TitleRef[], region: string) {
  if (refs.length === 0) return;
  after(() =>
    pool(refs, async (ref) => {
      await refresh(ref, region).catch(() => undefined);
    }),
  );
}

/**
 * Where to watch one title (title detail, F6). Throws only when TMDB fails and
 * nothing is cached, so the section can show its own error state.
 */
export const getWatchProviders = cache(async (type: TitleType, tmdbId: number, region: string): Promise<WatchProviders> => {
  const { data: title } = await createAdminClient()
    .from("titles")
    .select("id")
    .eq("media_type", type)
    .eq("tmdb_id", tmdbId)
    .maybeSingle();
  if (!title) return NO_PROVIDERS;
  const ref = { rowId: title.id as string, type, tmdbId };
  const cached = (await readRows([ref.rowId], region)).get(ref.rowId);
  if (cached && isFresh(cached)) return fromRow(cached);
  try {
    return await refresh(ref, region);
  } catch (error) {
    if (cached) return fromRow(cached);
    throw error;
  }
});

/**
 * Streaming services for every title on a list (the services filter, F5.4),
 * by title row id. Stale entries are used and refreshed after the response;
 * missing ones are fetched now, up to a limit, so a large new list stays
 * fast. Titles still unknown are left out, and match no service filter.
 */
export async function listProviders(refs: TitleRef[], region: string): Promise<Map<string, WatchProviders>> {
  const rows = await readRows(
    refs.map((r) => r.rowId),
    region,
  );
  const result = new Map<string, WatchProviders>();
  const stale: TitleRef[] = [];
  const missing: TitleRef[] = [];
  for (const ref of refs) {
    const row = rows.get(ref.rowId);
    if (row) result.set(ref.rowId, fromRow(row));
    if (!row) missing.push(ref);
    else if (!isFresh(row)) stale.push(ref);
  }
  const now = missing.slice(0, WAIT_FOR);
  await pool(now, async (ref) => {
    try {
      result.set(ref.rowId, await refresh(ref, region));
    } catch {
      // TMDB is down: the list still loads, and this title matches no service.
    }
  });
  refreshLater([...stale, ...missing.slice(WAIT_FOR)], region);
  return result;
}

