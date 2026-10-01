import type { Title, TitleType } from "@/components/domain/types";
import type { Extract, ImageInput } from "./ai";
import { scoreResults, type CardCandidate, type Match } from "./match";
import { MAX_TITLES, matchKey, normalizeTitle, splitText, type Candidate } from "./text";

// One import, start to finish (PRD F15.2): bare-title lines go to TMDB first,
// the rest to one AI call, then every title is matched on TMDB, duplicates
// are dropped, and at most 100 cards come out. TMDB, the model, and the
// match cache are passed in, so tests run the whole thing with fakes.

export type CachedMatch = { type: TitleType; tmdbId: number };

export type PipelineDeps = {
  extract: Extract;
  search: (query: string, signal?: AbortSignal) => Promise<Title[]>;
  /** Shared match cache lookups, by matchKey. */
  cachedMatches: (keys: string[]) => Promise<Map<string, CachedMatch>>;
  saveMatches: (rows: Array<{ key: string } & CachedMatch>) => Promise<void>;
  /** A cached match's poster, name, and year. */
  titleFor: (match: CachedMatch) => Promise<CardCandidate | null>;
  /** "tv-1396" keys already on this person's list. */
  existing: Set<string>;
};

export type PipelineInput = {
  text: string;
  images: ImageInput[];
  /** What the same input found before: skip parsing, just match again. */
  reuse: Candidate[] | null;
};

export type CardDraft = {
  query: string;
  note: string;
  confidence: "high" | "low";
  candidates: CardCandidate[];
};

export type PipelineResult = {
  cards: CardDraft[];
  /** What parsing found, stored for reuse. */
  extracted: Candidate[];
  duplicates: number;
  truncated: boolean;
  aiUsed: boolean;
  inputTokens: number;
  outputTokens: number;
};

const CONCURRENCY = 6;

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const cardKey = (c: CardCandidate) => `${c.type}-${c.tmdbId}`;

export async function runImport(
  input: PipelineInput,
  deps: PipelineDeps,
  onFound: (count: number) => void = () => {},
  signal?: AbortSignal,
): Promise<PipelineResult> {
  const seen = new Set<string>();
  const cards: CardDraft[] = [];
  const newMatches: Array<{ key: string } & CachedMatch> = [];
  let duplicates = 0;
  let truncated = false;

  // Adds a matched card unless it's on their list already or a repeat.
  function keep(candidate: Candidate, match: Match) {
    const key = cardKey(match.candidates[0]);
    if (deps.existing.has(key)) {
      duplicates++;
      return;
    }
    if (seen.has(key)) return;
    if (cards.length >= MAX_TITLES) {
      truncated = true;
      return;
    }
    seen.add(key);
    cards.push({ query: candidate.title, note: candidate.note ?? "", confidence: match.confidence, candidates: match.candidates });
    onFound(cards.length);
  }

  async function match(candidates: Candidate[]): Promise<Array<Match | null>> {
    const cached = await deps.cachedMatches(candidates.map(matchKey));
    return mapLimited(candidates, CONCURRENCY, async (candidate) => {
      signal?.throwIfAborted();
      const hit = cached.get(matchKey(candidate));
      if (hit) {
        const title = await deps.titleFor(hit);
        if (title) return { candidates: [title], confidence: candidate.confident ? "high" : "low" } satisfies Match;
      }
      let results: Title[];
      try {
        results = await deps.search(candidate.title, signal);
      } catch (error) {
        if (signal?.aborted) throw error;
        return null;
      }
      const scored = scoreResults(candidate, results);
      if (scored?.confidence === "high") {
        const top = scored.candidates[0];
        newMatches.push({ key: matchKey(candidate), type: top.type, tmdbId: top.tmdbId });
      }
      return scored;
    });
  }

  let parsed: Candidate[];
  let aiUsed = false;
  let inputTokens = 0;
  let outputTokens = 0;

  if (input.reuse) {
    parsed = input.reuse;
  } else {
    // Bare titles first: an exact TMDB title needs no AI.
    const split = splitText(input.text);
    const plainMatches = await match(split.plain);
    const leftover: string[] = split.messy ? [split.messy] : [];
    parsed = [];
    split.plain.forEach((candidate, i) => {
      const m = plainMatches[i];
      if (m && normalizeTitle(m.candidates[0].name) === normalizeTitle(candidate.title)) {
        parsed.push(candidate);
        keep(candidate, m);
      } else leftover.push(candidate.year ? `${candidate.title} (${candidate.year})` : candidate.title);
    });
    if (leftover.length > 0 || input.images.length > 0) {
      aiUsed = true;
      const extraction = await deps.extract({ text: leftover.join("\n"), images: input.images }, signal);
      inputTokens = extraction.inputTokens;
      outputTokens = extraction.outputTokens;
      const matches = await match(extraction.candidates);
      extraction.candidates.forEach((candidate, i) => {
        parsed.push(candidate);
        const m = matches[i];
        if (m) keep(candidate, m);
      });
    }
    await deps.saveMatches(newMatches).catch(() => {});
    return { cards, extracted: parsed.slice(0, MAX_TITLES * 2), duplicates, truncated, aiUsed, inputTokens, outputTokens };
  }

  const matches = await match(parsed);
  parsed.forEach((candidate, i) => {
    const m = matches[i];
    if (m) keep(candidate, m);
  });
  await deps.saveMatches(newMatches).catch(() => {});
  return { cards, extracted: parsed, duplicates, truncated, aiUsed, inputTokens, outputTokens };
}
