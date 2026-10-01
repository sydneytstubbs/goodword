import { describe, expect, it } from "vitest";
import type { ShelfCard, Title } from "@/components/domain/types";
import {
  article,
  barServices,
  clearFilters,
  DEFAULT_FILTERS,
  filterShelf,
  filtersToQuery,
  genreCounts,
  isFiltered,
  noResultsSubject,
  parseFilters,
  serviceCounts,
  toggle,
  type Filters,
} from "./filters";

// Invented titles and people only (CLAUDE.md). Netflix is 8 and Hulu is 15, as on TMDB.
const NETFLIX = 8;
const HULU = 15;
const services = [
  { id: NETFLIX, name: "Netflix" },
  { id: HULU, name: "Hulu" },
  { id: 337, name: "Disney Plus" },
];

function card(name: string, type: Title["type"], opts: Partial<Title> & { services?: number[]; people?: number; at?: string; groupIds?: string[] } = {}): ShelfCard {
  const { services: s, people = 1, at = "2026-09-01T00:00:00Z", groupIds, ...title } = opts;
  return {
    title: { id: `${type}-${name.length}${name[0]}`, type, name, genres: [], accent: "plum", ...title },
    goodWords: Array.from({ length: people }, (_, i) => ({ person: { id: `p${i}`, name: `Person ${i}` }, at: new Date(at) })),
    ...(s ? { services: s } : {}),
    ...(groupIds ? { groupIds } : {}),
  };
}

const shelf: ShelfCard[] = [
  card("The Night Ferry", "tv", { genres: ["Drama", "Mystery"], runtime: 52, services: [NETFLIX], at: "2026-09-05T00:00:00Z", groupIds: ["g1"] }),
  card("Low Tide Club", "movie", { genres: ["Comedy"], runtime: 104, services: [NETFLIX, HULU], people: 3, at: "2026-09-04T00:00:00Z", groupIds: ["g2"] }),
  card("Grandma's Heist", "movie", { genres: ["Comedy", "Crime"], runtime: 131, services: [HULU], people: 2, at: "2026-09-03T00:00:00Z" }),
  card("Moth Season", "movie", { genres: ["Horror"], services: [NETFLIX], people: 3, at: "2026-09-02T00:00:00Z", groupIds: ["g1", "g2"] }),
  card("Bea's Kitchen", "tv", { genres: ["Comedy"], runtime: 24, at: "2026-09-01T00:00:00Z" }),
];

const names = (cards: ShelfCard[]) => cards.map((c) => c.title.name);
const params = (query: string) => new URLSearchParams(query);
const f = (partial: Partial<Filters>): Filters => ({ ...DEFAULT_FILTERS, ...partial });

describe("URL state (PRD 6.3)", () => {
  it("round-trips every filter, leaving defaults out", () => {
    const filters = f({ type: "movie", services: [NETFLIX, HULU], genres: ["Comedy", "Action & Adventure"], length: 120, sort: "vouched" });
    const query = filtersToQuery(filters);
    expect(query).toBe("?type=movie&services=8,15&genres=Comedy,Action+%26+Adventure&length=120&sort=vouched");
    expect(parseFilters(params(query))).toEqual(filters);
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
  });

  it("ignores anything malformed rather than failing", () => {
    expect(parseFilters(params("type=cartoon&services=netflix,0,8,8&length=45&sort=oldest&groups=nope"))).toEqual(
      f({ services: [NETFLIX] }),
    );
  });

  it("clears filters but keeps the sort", () => {
    const filters = f({ type: "tv", services: [HULU], sort: "vouched" });
    expect(isFiltered(filters)).toBe(true);
    expect(clearFilters(filters)).toEqual(f({ sort: "vouched" }));
    expect(isFiltered(f({ sort: "vouched" }))).toBe(false);
  });

  it("toggles a chip on and off", () => {
    expect(toggle([NETFLIX], HULU)).toEqual([NETFLIX, HULU]);
    expect(toggle([NETFLIX, HULU], NETFLIX)).toEqual([HULU]);
  });
});

describe("filter logic (DS 5.6)", () => {
  it("ORs within a category and ANDs across them", () => {
    expect(names(filterShelf(shelf, f({ services: [NETFLIX, HULU] })).cards)).toEqual([
      "The Night Ferry",
      "Low Tide Club",
      "Grandma's Heist",
      "Moth Season",
    ]);
    expect(names(filterShelf(shelf, f({ type: "movie", services: [NETFLIX] })).cards)).toEqual(["Low Tide Club", "Moth Season"]);
    expect(names(filterShelf(shelf, f({ type: "movie", services: [NETFLIX], genres: ["Comedy"], length: 120 })).cards)).toEqual([
      "Low Tide Club",
    ]);
  });

  it("uses episode runtime for shows, and leaves out unknown runtimes, counting them", () => {
    const under30 = filterShelf(shelf, f({ length: 30 }));
    expect(names(under30.cards)).toEqual(["Bea's Kitchen"]);
    expect(under30.unknownLength).toBe(1);
    expect(filterShelf(shelf, f({ length: 30, type: "tv" })).unknownLength).toBe(0);
    expect(filterShelf(shelf, f({})).unknownLength).toBe(0);
  });

  it("never matches a service filter while a title's services are unknown", () => {
    expect(names(filterShelf(shelf, f({ services: [337] })).cards)).toEqual([]);
  });

  it("shows only titles on one of your services with On my services (P1)", () => {
    const mine = f({ mine: true, myServices: [HULU] });
    expect(names(filterShelf(shelf, mine).cards)).toEqual(["Low Tide Club", "Grandma's Heist"]);
    expect(names(filterShelf(shelf, f({ mine: true, myServices: [] })).cards)).toEqual([]);
    expect(isFiltered(mine)).toBe(true);
    expect(filtersToQuery(mine)).toBe("?mine=1");
    expect(parseFilters(params("mine=1")).mine).toBe(true);
    expect(clearFilters(mine)).toEqual(f({ myServices: [HULU] }));
  });

  it("filters My Recs by the groups a good word is shared into", () => {
    expect(names(filterShelf(shelf, f({ groups: ["g2"] })).cards)).toEqual(["Low Tide Club", "Moth Season"]);
  });

  it("sorts by most vouched, ties broken by newest", () => {
    expect(names(filterShelf(shelf, f({ sort: "vouched" })).cards)).toEqual([
      "Low Tide Club",
      "Moth Season",
      "Grandma's Heist",
      "The Night Ferry",
      "Bea's Kitchen",
    ]);
  });
});

describe("chip counts (PRD F5.4)", () => {
  it("ranks services by how common they are on the shelf, counting under the other filters", () => {
    const counts = serviceCounts(shelf, services, f({ type: "movie", services: [NETFLIX] }));
    expect(counts.map((s) => [s.name, s.total, s.count])).toEqual([
      ["Netflix", 3, 2],
      ["Hulu", 2, 2],
    ]);
  });

  it("shows five services, plus any other that's selected", () => {
    const ranked = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, name: `Service ${i + 1}` }));
    expect(barServices(ranked, f({})).map((s) => s.id)).toEqual([1, 2, 3, 4, 5]);
    expect(barServices(ranked, f({ services: [7, 2] })).map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 7]);
  });

  it("lists genres present on the shelf, most common first", () => {
    expect(genreCounts(shelf, f({ type: "movie" }))).toEqual([
      { name: "Comedy", count: 2 },
      { name: "Crime", count: 1 },
      { name: "Drama", count: 0 },
      { name: "Horror", count: 1 },
      { name: "Mystery", count: 0 },
    ]);
  });
});

describe("no-results copy (DS 6.6)", () => {
  const words = {
    movie: "movie",
    tv: "show",
    anythingOn: (s: string) => `anything on ${s}`,
    a: (noun: string) => `${article(noun)} ${noun}`,
  };
  const name = (id: number) => services.find((s) => s.id === id)?.name;

  it("names what was excluded", () => {
    expect(noResultsSubject(f({ type: "movie", services: [NETFLIX] }), name, words)).toBe("a Netflix movie");
    expect(noResultsSubject(f({ type: "tv", services: [NETFLIX, HULU] }), name, words)).toBe("a Netflix or Hulu show");
    expect(noResultsSubject(f({ type: "movie" }), name, words)).toBe("a movie");
    expect(noResultsSubject(f({ services: [HULU] }), name, words)).toBe("anything on Hulu");
  });

  it("falls back when genres or length are on, or a service is unknown", () => {
    expect(noResultsSubject(f({ type: "movie", genres: ["Comedy"] }), name, words)).toBeNull();
    expect(noResultsSubject(f({ length: 30 }), name, words)).toBeNull();
    expect(noResultsSubject(f({ services: [999] }), name, words)).toBeNull();
    expect(noResultsSubject(f({ type: "movie", mine: true }), name, words)).toBeNull();
  });

  it("picks a or an", () => {
    expect(article("Apple TV+ movie")).toBe("an");
    expect(article("Netflix movie")).toBe("a");
  });
});
