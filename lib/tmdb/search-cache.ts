// Search results cached briefly per normalized query (PRD F3, 9.1): 5 minutes,
// to stay well inside TMDB's limits. In memory, per server instance.
import type { Title } from "@/components/domain/types";

export const SEARCH_TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 500;

export class SearchCache {
  private entries = new Map<string, { at: number; titles: Title[] }>();

  constructor(
    private ttl = SEARCH_TTL_MS,
    private max = MAX_ENTRIES,
  ) {}

  get(key: string, now = Date.now()): Title[] | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (now - hit.at > this.ttl) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.titles;
  }

  set(key: string, titles: Title[], now = Date.now()) {
    this.entries.delete(key);
    this.entries.set(key, { at: now, titles });
    // Maps keep insertion order, so the first key is the oldest.
    while (this.entries.size > this.max) this.entries.delete(this.entries.keys().next().value!);
  }
}
