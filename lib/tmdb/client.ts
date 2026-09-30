import "server-only";
import type { Title, TitleType } from "@/components/domain/types";
import {
  detailsToRecord,
  NO_PROVIDERS,
  providersForRegion,
  regionProviders,
  searchResultsToTitles,
  type Provider,
  type TitleRecord,
  type WatchProviders,
} from "./normalize";

// TMDB, server-side only (PRD 9.1). The read token never reaches the browser:
// the browser calls the app's own routes, which call TMDB from here.

const API = "https://api.themoviedb.org/3";
const TIMEOUT_MS = 5000;
// English titles for now (DS 10); one language until more are added.
const LANGUAGE = "en-US";

export class TmdbError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "TmdbError";
  }
}

async function get(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
  /** Seconds to keep the response in Next's data cache; fresh every time if unset. */
  revalidate?: number,
): Promise<Record<string, unknown>> {
  const token = process.env.TMDB_API_READ_TOKEN;
  if (!token) throw new TmdbError("TMDB_API_READ_TOKEN is not set");
  const url = new URL(`${API}${path}`);
  Object.entries({ language: LANGUAGE, ...params }).forEach(([k, v]) => url.searchParams.set(k, v));
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      ...(revalidate ? { next: { revalidate } } : { cache: "no-store" as const }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new TmdbError(`TMDB request failed: ${(error as Error).name}`);
  }
  if (!res.ok) throw new TmdbError(`TMDB responded ${res.status}`, res.status);
  return (await res.json()) as Record<string, unknown>;
}

/** Multi-search, movies and shows only, in TMDB's relevance order (PRD F3). */
export async function searchTitles(query: string, signal?: AbortSignal): Promise<Title[]> {
  const data = await get("/search/multi", { query, include_adult: "false", page: "1" }, signal);
  return searchResultsToTitles(data.results);
}

/** Details for one movie or show, or null if TMDB doesn't have it (or it's adult). */
export async function fetchTitleDetails(type: TitleType, tmdbId: number): Promise<TitleRecord | null> {
  try {
    return detailsToRecord(type, await get(`/${type}/${tmdbId}`, {}));
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return null;
    throw error;
  }
}

/** Where to watch a title in one region (PRD 9.2). Nothing, if TMDB doesn't have the title. */
export async function fetchWatchProviders(type: TitleType, tmdbId: number, region: string): Promise<WatchProviders> {
  try {
    return providersForRegion(await get(`/${type}/${tmdbId}/watch/providers`, {}), region);
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return NO_PROVIDERS;
    throw error;
  }
}

/** The streaming services in a region, for Settings (P1). The list changes rarely: kept a day. */
export async function fetchRegionProviders(region: string): Promise<Provider[]> {
  const params = { watch_region: region };
  const [movie, tv] = await Promise.all([
    get("/watch/providers/movie", params, undefined, 86_400),
    get("/watch/providers/tv", params, undefined, 86_400),
  ]);
  return regionProviders(region, movie, tv);
}
