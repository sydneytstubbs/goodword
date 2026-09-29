import { describe, expect, it } from "vitest";
import { RateLimit } from "@/lib/rate-limit";
import { posterSrc, posterSrcSet } from "./images";
import { detailsToRecord, normalizeQuery, recordToTitle, searchResultsToTitles, yearOf } from "./normalize";
import { SearchCache } from "./search-cache";

// TMDB shapes are invented here, with the project's sample titles (CLAUDE.md).

describe("search results", () => {
  const results = [
    { media_type: "tv", id: 101, name: "The Night Ferry", first_air_date: "2024-03-01", genre_ids: [18, 9648], poster_path: "/ferry.jpg" },
    { media_type: "movie", id: 202, title: "Moth Season", release_date: "2025-10-31", genre_ids: [27], poster_path: null },
    { media_type: "person", id: 303, name: "Priya" },
    { media_type: "movie", id: 404, title: "Not for here", adult: true, genre_ids: [] },
    { media_type: "movie", id: 505, title: "Grandma's Heist", release_date: "", genre_ids: [80, 35] },
    { media_type: "tv", id: 101, name: "The Night Ferry", first_air_date: "2024-03-01", genre_ids: [18] },
    { media_type: "movie", id: 606, title: "  ", genre_ids: [] },
  ];
  const titles = searchResultsToTitles(results);

  it("keeps only movies and shows, never people or adult titles", () => {
    expect(titles.map((t) => t.id)).toEqual(["tv-101", "movie-202", "movie-505"]);
  });

  it("keeps TMDB's relevance order and drops duplicates", () => {
    expect(titles[0].name).toBe("The Night Ferry");
    expect(titles.filter((t) => t.id === "tv-101")).toHaveLength(1);
  });

  it("maps genre ids to names by media type, and sets the accent from the first", () => {
    expect(titles[0]).toMatchObject({ type: "tv", tmdbId: 101, year: 2024, genres: ["Drama", "Mystery"], accent: "plum", posterPath: "/ferry.jpg" });
    expect(titles[1]).toMatchObject({ genres: ["Horror"], accent: "clay" });
    expect(titles[1].posterPath).toBeUndefined();
  });

  it("leaves the year out when TMDB has no date", () => {
    expect(titles[2].year).toBeUndefined();
    expect(yearOf("")).toBeNull();
    expect(yearOf("1999-10-15")).toBe(1999);
  });

  it("returns nothing for a malformed response", () => {
    expect(searchResultsToTitles(undefined)).toEqual([]);
    expect(searchResultsToTitles([null, 3, "x"])).toEqual([]);
  });
});

describe("details", () => {
  it("builds a titles row for a film", () => {
    const record = detailsToRecord("movie", {
      id: 505,
      title: "Grandma's Heist",
      original_title: "Grandma's Heist",
      release_date: "2022-05-06",
      runtime: 104,
      genres: [
        { id: 80, name: "Crime" },
        { id: 35, name: "Comedy" },
      ],
      poster_path: "/heist.jpg",
      overview: "A retiree plans one last job.",
    });
    expect(record).toEqual({
      tmdb_id: 505,
      media_type: "movie",
      title: "Grandma's Heist",
      original_title: "Grandma's Heist",
      year: 2022,
      poster_path: "/heist.jpg",
      genres: [
        { id: 80, name: "Crime" },
        { id: 35, name: "Comedy" },
      ],
      runtime_minutes: 104,
      seasons: null,
      overview: "A retiree plans one last job.",
      accent: "moss",
    });
  });

  it("uses a show's typical episode runtime, or its latest episode's", () => {
    const listed = detailsToRecord("tv", { id: 101, name: "The Night Ferry", episode_run_time: [52, 45, 60], number_of_seasons: 3, genres: [] });
    expect(listed).toMatchObject({ runtime_minutes: 52, seasons: 3 });
    const fromLast = detailsToRecord("tv", { id: 102, name: "Low Tide Club", episode_run_time: [], last_episode_to_air: { runtime: 24 }, genres: [] });
    expect(fromLast?.runtime_minutes).toBe(24);
    const unknown = detailsToRecord("tv", { id: 103, name: "Low Tide Club", episode_run_time: [], last_episode_to_air: null, genres: [] });
    expect(unknown?.runtime_minutes).toBeNull();
  });

  it("falls back to a tone from the title id when the genre isn't mapped", () => {
    const record = detailsToRecord("movie", { id: 707, title: "Moth Season", genres: [] });
    const again = detailsToRecord("movie", { id: 707, title: "Moth Season", genres: [] });
    expect(record?.accent).toMatch(/^(clay|ochre|moss|plum)$/);
    expect(again?.accent).toBe(record?.accent);
  });

  it("refuses adult and nameless titles", () => {
    expect(detailsToRecord("movie", { id: 1, title: "x", adult: true })).toBeNull();
    expect(detailsToRecord("movie", { id: 1 })).toBeNull();
  });

  it("round-trips a row to the shape components use, with the same id as search", () => {
    const record = detailsToRecord("tv", { id: 101, name: "The Night Ferry", first_air_date: "2024-03-01", number_of_seasons: 2, genres: [{ id: 18, name: "Drama" }], poster_path: "/f.jpg" })!;
    const [fromSearch] = searchResultsToTitles([{ media_type: "tv", id: 101, name: "The Night Ferry", first_air_date: "2024-03-01", genre_ids: [18] }]);
    const title = recordToTitle(record);
    expect(title).toMatchObject({ id: fromSearch.id, type: "tv", name: "The Night Ferry", year: 2024, seasons: 2, genres: ["Drama"], posterPath: "/f.jpg" });
    expect(title.accent).toBe(fromSearch.accent);
  });
});

describe("queries", () => {
  it("normalizes case and spacing for the cache key", () => {
    expect(normalizeQuery("  The   Night  FERRY ")).toBe("the night ferry");
  });
});

describe("search cache", () => {
  const titles = searchResultsToTitles([{ media_type: "tv", id: 101, name: "The Night Ferry", genre_ids: [] }]);

  it("serves a query for 5 minutes, then asks again", () => {
    const cache = new SearchCache();
    cache.set("night", titles, 0);
    expect(cache.get("night", 4 * 60_000)).toBe(titles);
    expect(cache.get("night", 5 * 60_000 + 1)).toBeUndefined();
  });

  it("drops the oldest queries past its size", () => {
    const cache = new SearchCache(60_000, 2);
    cache.set("a", titles, 0);
    cache.set("b", titles, 0);
    cache.set("c", titles, 0);
    expect(cache.get("a", 1)).toBeUndefined();
    expect(cache.get("c", 1)).toBe(titles);
  });
});

describe("rate limit", () => {
  it("allows 60 a minute per person, then refuses until the window moves", () => {
    const limit = new RateLimit(60, 60_000);
    for (let i = 0; i < 60; i++) expect(limit.take("priya", i)).toBe(true);
    expect(limit.take("priya", 100)).toBe(false);
    expect(limit.take("jonah", 100)).toBe(true);
    expect(limit.take("priya", 60_001)).toBe(true);
  });
});

describe("poster images", () => {
  it("builds TMDB size variants", () => {
    expect(posterSrc("/f.jpg")).toBe("https://image.tmdb.org/t/p/w342/f.jpg");
    expect(posterSrcSet("/f.jpg")).toBe(
      "https://image.tmdb.org/t/p/w154/f.jpg 154w, https://image.tmdb.org/t/p/w342/f.jpg 342w, https://image.tmdb.org/t/p/w500/f.jpg 500w",
    );
  });
});
