// A sliding-window rate limit kept in memory, for cheap, high-frequency
// requests like search (PRD 10.4: 60 per user per minute). Per server
// instance, so it stops scripts rather than counting exactly.
export class RateLimit {
  private hits = new Map<string, number[]>();

  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  /** Records a hit for `key`; false when it's over the limit. */
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((at) => now - at < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [key, times] of this.hits) {
      if (times.every((at) => now - at >= this.windowMs)) this.hits.delete(key);
    }
  }
}
