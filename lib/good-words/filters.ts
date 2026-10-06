// List sorting and filtering (PRD F5.4, 6.3; DS 5.6). Pure, so the URL
// parsing, the filter logic, and the chip counts are unit tested, and the
// browser filters a loaded list instantly, even offline.
import type { Service, ListCard, TitleType } from "@/components/domain/types";

export type TypeFilter = "all" | TitleType;
export type Sort = "newest" | "vouched";
/** Under 30 minutes, or under 2 hours (movie runtime, or typical episode runtime). */
export type Length = 30 | 120;

export type Filters = {
  type: TypeFilter;
  /** TMDB provider ids. OR within services. */
  services: number[];
  /** TMDB genre names. OR within genres. */
  genres: string[];
  length: Length | null;
  sort: Sort;
  /** My list only: group ids it's shared into. OR within groups. */
  groups: string[];
  /** On my services (P1): only titles on a streaming service the viewer has. */
  mine: boolean;
  /** The viewer's services in their region, from Settings. Not part of the URL. */
  myServices: number[];
};

export const DEFAULT_FILTERS: Filters = { type: "all", services: [], genres: [], length: null, sort: "newest", groups: [], mine: false, myServices: [] };

export const PAGE_SIZE = 24;
export const TOP_SERVICES = 5;

type Params = { get(name: string): string | null };

const list = (value: string | null) => (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
const unique = <T,>(values: T[]) => [...new Set(values)];

/** Filters from the query string. Anything malformed is ignored, never an error. */
export function parseFilters(params: Params): Filters {
  const type = params.get("type");
  const sort = params.get("sort");
  const length = Number(params.get("length"));
  return {
    type: type === "movie" || type === "tv" ? type : "all",
    services: unique(list(params.get("services")).filter((v) => /^[1-9]\d{0,8}$/.test(v)).map(Number)),
    genres: unique(list(params.get("genres")).filter((v) => v.length <= 40)),
    length: length === 30 || length === 120 ? length : null,
    sort: sort === "vouched" ? "vouched" : "newest",
    groups: unique(list(params.get("groups")).filter((v) => /^[0-9a-f-]{36}$/i.test(v))),
    mine: params.get("mine") === "1",
    myServices: [],
  };
}

/** The query string for filters, defaults left out, in a stable order (6.3). */
export function filtersToQuery(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.services.length) params.set("services", filters.services.join(","));
  if (filters.genres.length) params.set("genres", filters.genres.join(","));
  if (filters.length) params.set("length", String(filters.length));
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (filters.groups.length) params.set("groups", filters.groups.join(","));
  if (filters.mine) params.set("mine", "1");
  const query = params.toString().replace(/%2C/g, ",");
  return query ? `?${query}` : "";
}

/** Anything narrowing the list (sort doesn't). */
export function isFiltered(filters: Filters): boolean {
  return (
    filters.type !== "all" ||
    filters.services.length > 0 ||
    filters.genres.length > 0 ||
    filters.length !== null ||
    filters.groups.length > 0 ||
    filters.mine
  );
}

export function clearFilters(filters: Filters): Filters {
  return { ...DEFAULT_FILTERS, sort: filters.sort, myServices: filters.myServices };
}

export function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

type Category = "type" | "services" | "genres" | "length" | "groups" | "mine";

const test: Record<Category, (card: ListCard, f: Filters) => boolean> = {
  type: (card, f) => f.type === "all" || card.title.type === f.type,
  services: (card, f) => f.services.length === 0 || f.services.some((id) => card.services?.includes(id)),
  genres: (card, f) => f.genres.length === 0 || f.genres.some((g) => card.title.genres.includes(g)),
  // Unknown runtime never matches a length filter (F5.4).
  length: (card, f) => f.length === null || (card.title.runtime !== undefined && card.title.runtime <= f.length),
  groups: (card, f) => f.groups.length === 0 || f.groups.some((id) => card.groupIds?.includes(id)),
  // A title whose providers aren't known yet matches no service (F5.4).
  mine: (card, f) => !f.mine || f.myServices.some((id) => card.services?.includes(id)),
};

/** AND across categories, OR within one (DS 5.6). `except` leaves one category out, for its chip counts. */
export function matches(card: ListCard, filters: Filters, except?: Category): boolean {
  return (Object.keys(test) as Category[]).every((c) => c === except || test[c](card, filters));
}

const latest = (card: ListCard) => Math.max(0, ...card.goodWords.map((g) => g.at.getTime()));

/** Newest good word first; or most people first, ties broken by newest (F5.4). */
export function sortCards(cards: ListCard[], sort: Sort): ListCard[] {
  if (sort === "newest") return cards;
  return [...cards].sort((a, b) => b.goodWords.length - a.goodWords.length || latest(b) - latest(a));
}

export type FilteredList = {
  cards: ListCard[];
  /** With a length filter on: titles left out only because their runtime is unknown. */
  unknownLength: number;
};

export function filterList(cards: ListCard[], filters: Filters): FilteredList {
  const shown = cards.filter((card) => matches(card, filters));
  const unknownLength =
    filters.length === null ? 0 : cards.filter((c) => c.title.runtime === undefined && matches(c, filters, "length")).length;
  return { cards: sortCards(shown, filters.sort), unknownLength };
}

/**
 * Every streaming service on the list, most common first (ties by name),
 * with how many cards each would show given the other filters.
 */
export function serviceCounts(cards: ListCard[], services: Service[], filters: Filters): Array<Service & { count: number; total: number }> {
  const others = cards.filter((card) => matches(card, filters, "services"));
  return services
    .map((service) => ({
      ...service,
      total: cards.filter((c) => c.services?.includes(service.id)).length,
      count: others.filter((c) => c.services?.includes(service.id)).length,
    }))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

/** Genres present on the list, most common first, with counts given the other filters. */
export function genreCounts(cards: ListCard[], filters: Filters): Array<{ name: string; count: number }> {
  const totals = new Map<string, number>();
  for (const card of cards) for (const g of card.title.genres) totals.set(g, (totals.get(g) ?? 0) + 1);
  const others = cards.filter((card) => matches(card, filters, "genres"));
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => ({ name, count: others.filter((c) => c.title.genres.includes(name)).length }));
}

/**
 * The service chips on the bar: the five most common on the list, in a
 * stable order so chips don't jump as filters change, plus any other
 * selected service, so every active filter stays visible (DS 5.6).
 */
export function barServices<T extends Service>(ranked: T[], filters: Filters): T[] {
  const top = ranked.slice(0, TOP_SERVICES);
  return [...top, ...ranked.filter((s) => !top.includes(s) && filters.services.includes(s.id))];
}

/**
 * What a no-results group list names: "a Netflix movie", "a Netflix or Hulu
 * show", "a movie", "anything on Netflix". Null when genres, length, or groups
 * are on too, which the filter bar above already shows.
 */
export function noResultsSubject(
  filters: Filters,
  serviceName: (id: number) => string | undefined,
  words: { movie: string; tv: string; anythingOn: (services: string) => string; a: (noun: string) => string },
): string | null {
  if (filters.genres.length || filters.length !== null || filters.groups.length || filters.mine) return null;
  const names = filters.services.map(serviceName).filter((n): n is string => Boolean(n));
  if (names.length !== filters.services.length) return null;
  const services = orList(names);
  if (filters.type === "all") return names.length ? words.anythingOn(services) : null;
  const noun = filters.type === "movie" ? words.movie : words.tv;
  return words.a(names.length ? `${services} ${noun}` : noun);
}

const disjunction = new Intl.ListFormat("en", { style: "long", type: "disjunction" });

export function orList(names: string[]): string {
  return disjunction.format(names);
}

/** "a" or "an", by the next word's first letter. Good enough for service names and "movie" or "show". */
export function article(phrase: string): "a" | "an" {
  return /^[aeiou]/i.test(phrase) ? "an" : "a";
}
