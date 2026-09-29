// TMDB poster URLs (PRD 9.1, DESIGN-SYSTEM.md 9). The base is the
// `images.secure_base_url` from TMDB's /configuration, which has been stable
// for years; it's kept here so no request waits on fetching it.
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/";

export type PosterWidth = 154 | 342 | 500;

const WIDTHS: PosterWidth[] = [154, 342, 500];

export function posterSrc(path: string, width: PosterWidth = 342): string {
  return `${TMDB_IMAGE_BASE}w${width}${path}`;
}

/** All three variants: w154 for rows, w342 for grid cards, w500 for detail. */
export function posterSrcSet(path: string): string {
  return WIDTHS.map((w) => `${posterSrc(path, w)} ${w}w`).join(", ");
}
