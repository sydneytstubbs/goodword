import "server-only";
import type { TitleType } from "@/components/domain/types";
import { getTitle, type CachedTitle } from "@/lib/titles/cache";

// A title route's params (/title/[type]/[tmdbId]), and the title itself.

export function parseTitleParams(params: { type: string; tmdbId: string }): { type: TitleType; tmdbId: number } | null {
  if (params.type !== "movie" && params.type !== "tv") return null;
  if (!/^[1-9]\d{0,8}$/.test(params.tmdbId)) return null;
  return { type: params.type, tmdbId: Number(params.tmdbId) };
}

/** The title, null if TMDB has no such title, or `failed` if TMDB is down and it isn't cached. */
export async function loadTitle(type: TitleType, tmdbId: number): Promise<{ title: CachedTitle | null } | { failed: true }> {
  try {
    return { title: await getTitle(type, tmdbId) };
  } catch {
    return { failed: true };
  }
}
