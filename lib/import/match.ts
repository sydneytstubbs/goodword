import type { Title } from "@/components/domain/types";
import { resolveGenreAccent } from "@/lib/genre-accent";
import { normalizeTitle, type Candidate } from "./text";

// Picking TMDB's best match for one written title (PRD F15.2). Pure, so the
// rules are tested without TMDB.

export type CardCandidate = {
  type: "movie" | "tv";
  tmdbId: number;
  name: string;
  year: number | null;
  posterPath: string | null;
};

export type Match = {
  candidates: CardCandidate[];
  /** Show as a single card; otherwise the alternatives open with it. */
  confidence: "high" | "low";
};

const MAX_CANDIDATES = 4;

export function toCardCandidate(title: Title): CardCandidate | null {
  if (!title.tmdbId) return null;
  return { type: title.type, tmdbId: title.tmdbId, name: title.name, year: title.year ?? null, posterPath: title.posterPath ?? null };
}

/**
 * Orders TMDB's results for a written title: an exact title match first,
 * then the year (when one was given), then the type, then TMDB's own order.
 * High confidence needs the parser to be sure, an exact title, a year that
 * agrees, and no second exact title it could just as well be (a remake).
 */
export function scoreResults(candidate: Pick<Candidate, "title" | "year" | "type" | "confident">, results: Title[]): Match | null {
  const wanted = normalizeTitle(candidate.title);
  const scored = results
    .map((title, index) => {
      const exact = normalizeTitle(title.name) === wanted;
      let score = exact ? 100 : 0;
      if (candidate.year && title.year) {
        const off = Math.abs(candidate.year - title.year);
        score += off === 0 ? 30 : off === 1 ? 15 : -20;
      }
      if (candidate.type && candidate.type === title.type) score += 10;
      score += Math.max(0, 10 - index);
      return { title, exact, score };
    })
    .sort((a, b) => b.score - a.score);
  const candidates = scored
    .map((s) => toCardCandidate(s.title))
    .filter((c): c is CardCandidate => c !== null)
    .slice(0, MAX_CANDIDATES);
  if (candidates.length === 0) return null;
  const top = scored[0];
  const fitsYear = (title: Title) => !candidate.year || !title.year || Math.abs(candidate.year - title.year) <= 1;
  // Another exact title that fits just as well: a remake, or a show and a film.
  const rival = scored.some(
    (s) => s !== top && s.exact && fitsYear(s.title) && (!candidate.type || s.title.type === candidate.type),
  );
  const high = candidate.confident && top.exact && fitsYear(top.title) && !rival;
  return { candidates, confidence: high ? "high" : "low" };
}

/** A card candidate as a Title, for Poster and the meta line. */
export function candidateTitle(candidate: CardCandidate): Title {
  const id = `${candidate.type}-${candidate.tmdbId}`;
  return {
    id,
    type: candidate.type,
    tmdbId: candidate.tmdbId,
    name: candidate.name,
    ...(candidate.year ? { year: candidate.year } : {}),
    genres: [],
    accent: resolveGenreAccent([], id),
    ...(candidate.posterPath ? { posterPath: candidate.posterPath } : {}),
  };
}
