// TMDB responses to Good Word's title shapes. Pure functions, so they're unit
// tested without the network. Only movies and shows pass; people and adult
// titles never do (PRD F3).
import type { Title, TitleType } from "@/components/domain/types";
import { resolveGenreAccent, type GenreAccent } from "@/lib/genre-accent";
import { movieGenres, tvGenres } from "./genres";

export type TmdbGenre = { id: number; name: string };

/** A row for the `titles` table (PRD 8). */
export type TitleRecord = {
  tmdb_id: number;
  media_type: TitleType;
  title: string;
  original_title: string | null;
  year: number | null;
  poster_path: string | null;
  genres: TmdbGenre[];
  runtime_minutes: number | null;
  seasons: number | null;
  overview: string | null;
  accent: GenreAccent;
};

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

export const MIN_QUERY = 2;
export const MAX_QUERY = 100;

/** Lowercased, trimmed, inner spaces collapsed: the cache key for a search. */
export function normalizeQuery(query: string): string {
  return query.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

export function titleKey(type: TitleType, tmdbId: number): string {
  return `${type}-${tmdbId}`;
}

export function yearOf(date: unknown): number | null {
  const match = typeof date === "string" ? date.match(/^(\d{4})-/) : null;
  return match ? Number(match[1]) : null;
}

function isType(v: unknown): v is TitleType {
  return v === "movie" || v === "tv";
}

/** One multi-search result, or null for people, adult titles, and anything malformed. */
export function searchResultToTitle(raw: Raw): Title | null {
  const type = raw.media_type;
  const tmdbId = num(raw.id);
  if (!isType(type) || !tmdbId || raw.adult === true) return null;
  const name = str(type === "movie" ? raw.title : raw.name);
  if (!name) return null;
  const names = type === "movie" ? movieGenres : tvGenres;
  const genres = (Array.isArray(raw.genre_ids) ? raw.genre_ids : [])
    .map((id) => names[id as number])
    .filter((g): g is string => Boolean(g));
  const id = titleKey(type, tmdbId);
  const year = yearOf(type === "movie" ? raw.release_date : raw.first_air_date);
  const posterPath = str(raw.poster_path);
  return {
    id,
    type,
    tmdbId,
    name,
    ...(year ? { year } : {}),
    genres,
    accent: resolveGenreAccent(genres, id),
    ...(posterPath ? { posterPath } : {}),
  };
}

export function searchResultsToTitles(results: unknown): Title[] {
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  const titles: Title[] = [];
  for (const raw of results) {
    if (!raw || typeof raw !== "object") continue;
    const title = searchResultToTitle(raw as Raw);
    if (title && !seen.has(title.id)) {
      seen.add(title.id);
      titles.push(title);
    }
  }
  return titles;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

/** Typical episode runtime: TMDB's listed runtimes, else the latest episode's. */
function episodeRuntime(raw: Raw): number | null {
  const listed = (Array.isArray(raw.episode_run_time) ? raw.episode_run_time : []).map(num).filter((n): n is number => n !== null);
  const fromList = median(listed);
  if (fromList) return fromList;
  const last = raw.last_episode_to_air as Raw | null | undefined;
  return num(last?.runtime) ?? null;
}

/** Movie or TV details to a `titles` row, or null for adult or malformed titles. */
export function detailsToRecord(type: TitleType, raw: Raw): TitleRecord | null {
  const tmdbId = num(raw.id);
  if (!tmdbId || raw.adult === true) return null;
  const title = str(type === "movie" ? raw.title : raw.name);
  if (!title) return null;
  const genres = (Array.isArray(raw.genres) ? raw.genres : [])
    .filter((g): g is TmdbGenre => Boolean(g) && typeof g.id === "number" && typeof g.name === "string")
    .map(({ id, name }) => ({ id, name }));
  return {
    tmdb_id: tmdbId,
    media_type: type,
    title,
    original_title: str(type === "movie" ? raw.original_title : raw.original_name),
    year: yearOf(type === "movie" ? raw.release_date : raw.first_air_date),
    poster_path: str(raw.poster_path),
    genres,
    runtime_minutes: type === "movie" ? num(raw.runtime) : episodeRuntime(raw),
    seasons: type === "tv" ? num(raw.number_of_seasons) : null,
    overview: str(raw.overview),
    accent: resolveGenreAccent(
      genres.map((g) => g.name),
      titleKey(type, tmdbId),
    ),
  };
}

/** A cached row to the shape components use. */
export function recordToTitle(record: Omit<TitleRecord, "overview" | "original_title">): Title {
  return {
    id: titleKey(record.media_type, record.tmdb_id),
    type: record.media_type,
    tmdbId: record.tmdb_id,
    name: record.title,
    ...(record.year ? { year: record.year } : {}),
    ...(record.runtime_minutes ? { runtime: record.runtime_minutes } : {}),
    ...(record.seasons ? { seasons: record.seasons } : {}),
    genres: record.genres.map((g) => g.name),
    accent: record.accent,
    ...(record.poster_path ? { posterPath: record.poster_path } : {}),
  };
}

/** A streaming service, rental store, or shop (TMDB watch providers, from JustWatch). */
export type Provider = { id: number; name: string; logo: string | null };

/** Where to watch one title in one region (PRD F6, 9.2): the `watch_providers` row. */
export type WatchProviders = {
  /** Included with a subscription, free, or free with ads. */
  stream: Provider[];
  rent: Provider[];
  buy: Provider[];
  /** TMDB's where-to-watch page for the title in this region. */
  link: string | null;
};

export const NO_PROVIDERS: WatchProviders = { stream: [], rent: [], buy: [], link: null };

function providerList(...lists: unknown[]): Provider[] {
  const seen = new Map<number, Provider & { priority: number }>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list as Raw[]) {
      const id = num(raw?.provider_id);
      const name = str(raw?.provider_name);
      if (!id || !name || seen.has(id)) continue;
      const priority = typeof raw.display_priority === "number" ? raw.display_priority : Number.MAX_SAFE_INTEGER;
      seen.set(id, { id, name, logo: str(raw.logo_path), priority });
    }
  }
  return [...seen.values()].sort((a, b) => a.priority - b.priority).map(({ id, name, logo }) => ({ id, name, logo }));
}

/** One region's providers from `/{type}/{id}/watch/providers`, in TMDB's display order. */
export function providersForRegion(raw: Raw, region: string): WatchProviders {
  const results = raw.results as Record<string, Raw> | undefined;
  const entry = results && typeof results === "object" ? results[region] : undefined;
  if (!entry || typeof entry !== "object") return NO_PROVIDERS;
  const link = str(entry.link);
  return {
    stream: providerList(entry.flatrate, entry.free, entry.ads),
    rent: providerList(entry.rent),
    buy: providerList(entry.buy),
    link: link && /^https:\/\//.test(link) ? link : null,
  };
}
