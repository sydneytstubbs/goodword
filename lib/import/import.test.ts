import { describe, expect, it, vi } from "vitest";
import type { Title } from "@/components/domain/types";
import { costMicrodollars } from "./cost";
import { scoreResults } from "./match";
import { runImport, type PipelineDeps } from "./pipeline";
import { cleanLine, isPlainTitle, lengthBucket, matchKey, normalizeTitle, splitText, splitYear, tidyCandidate } from "./text";

// Build your list (PRD F15.2): reading lists, matching titles, and the whole
// pipeline with a fake model and a fake TMDB. Invented titles only.

const t = (tmdbId: number, name: string, type: "movie" | "tv", year?: number): Title => ({
  id: `${type}-${tmdbId}`,
  type,
  tmdbId,
  name,
  ...(year ? { year } : {}),
  genres: [],
  accent: "plum",
});

describe("reading a list", () => {
  it("strips bullets, numbering, checkboxes, emoji, and quotes", () => {
    expect(cleanLine("- The Night Ferry")).toBe("The Night Ferry");
    expect(cleanLine("  3. Low Tide Club 🌊")).toBe("Low Tide Club");
    expect(cleanLine("• [x] “Moth Season”")).toBe("Moth Season");
    expect(cleanLine("🍿🍿")).toBe("");
  });

  it("tells a bare title from one with a comment", () => {
    expect(isPlainTitle("The Night Ferry")).toBe(true);
    expect(isPlainTitle("Moth Season (2021)")).toBe(true);
    expect(isPlainTitle("Grandma's Heist: The Return")).toBe(true);
    expect(isPlainTitle("Low Tide Club, so good")).toBe(false);
    expect(isPlainTitle("Moth Season - the second season especially")).toBe(false);
    expect(isPlainTitle("you have to watch the one about the ferry and the lighthouse keeper")).toBe(false);
  });

  it("reads a year off the end", () => {
    expect(splitYear("Moth Season (2021)")).toEqual({ title: "Moth Season", year: 2021 });
    expect(splitYear("The Night Ferry")).toEqual({ title: "The Night Ferry", year: null });
  });

  it("splits a pasted list into bare titles and the rest", () => {
    const split = splitText("My recs\n- The Night Ferry\n- Low Tide Club, so good\n\n2. Moth Season (2021)");
    expect(split.plain.map((c) => [c.title, c.year])).toEqual([
      ["My recs", null],
      ["The Night Ferry", null],
      ["Moth Season", 2021],
    ]);
    expect(split.messy).toBe("Low Tide Club, so good");
  });

  it("sends a dictated paragraph to the model whole", () => {
    const text = "okay so the night ferry is great, also low tide club, and grandma's heist if you want something light";
    expect(splitText(text)).toEqual({ plain: [], messy: text });
  });

  it("caps text at 5,000 characters", () => {
    const split = splitText("x".repeat(6000));
    expect(split.messy.length).toBe(5000);
  });

  it("normalizes titles for comparison", () => {
    expect(normalizeTitle("The Night Ferry!")).toBe(normalizeTitle("night ferry"));
    expect(normalizeTitle("Grandma & Me")).toBe("grandma and me");
    expect(normalizeTitle("Café Société")).toBe("cafe societe");
    expect(matchKey({ title: "The Night Ferry", year: 2024, type: "tv" })).toBe("night ferry|2024|tv");
  });

  it("tidies what the model returns", () => {
    expect(tidyCandidate({ title: " Low Tide Club ", year: 2023, type: "unknown", note: " so good ", confident: true })).toEqual({
      title: "Low Tide Club",
      year: 2023,
      type: null,
      note: "so good",
      confident: true,
    });
    expect(tidyCandidate({ title: "  ", year: null, type: "tv", note: null, confident: true })).toBeNull();
    expect(tidyCandidate({ title: "Moth Season", year: 3024, type: "tv", note: "x".repeat(300), confident: false })?.year).toBeNull();
    expect(tidyCandidate({ title: "Moth Season", year: null, type: "tv", note: "x".repeat(300), confident: false })?.note).toHaveLength(140);
  });

  it("buckets text length without keeping the text", () => {
    expect([0, 100, 1000, 4000].map(lengthBucket)).toEqual(["none", "short", "medium", "long"]);
  });

  it("prices Haiku tokens in microdollars", () => {
    expect(costMicrodollars(1000, 200)).toBe(2000);
  });
});

describe("matching a title", () => {
  const ferry = { title: "The Night Ferry", year: null, type: null, confident: true };

  it("is sure of a single exact title", () => {
    const match = scoreResults(ferry, [t(1, "The Night Ferry", "tv", 2024), t(2, "Night Ferry Diaries", "movie", 2019)]);
    expect(match?.confidence).toBe("high");
    expect(match?.candidates.map((c) => c.tmdbId)).toEqual([1, 2]);
  });

  it("isn't sure when a remake has the same title", () => {
    const match = scoreResults(ferry, [t(1, "The Night Ferry", "tv", 2024), t(3, "The Night Ferry", "movie", 1987)]);
    expect(match?.confidence).toBe("low");
  });

  it("uses the year to pick between remakes, and then is sure", () => {
    const match = scoreResults({ ...ferry, year: 1987 }, [t(1, "The Night Ferry", "tv", 2024), t(3, "The Night Ferry", "movie", 1987)]);
    expect(match?.candidates[0].tmdbId).toBe(3);
    expect(match?.confidence).toBe("high");
  });

  it("uses the type to pick between a show and a film", () => {
    const match = scoreResults({ ...ferry, type: "tv" }, [t(3, "The Night Ferry", "movie", 1987), t(1, "The Night Ferry", "tv", 2024)]);
    expect(match?.candidates[0].tmdbId).toBe(1);
    expect(match?.confidence).toBe("high");
  });

  it("isn't sure without an exact title, or when the parser wasn't", () => {
    expect(scoreResults(ferry, [t(2, "Night Ferry Diaries", "movie", 2019)])?.confidence).toBe("low");
    expect(scoreResults({ ...ferry, confident: false }, [t(1, "The Night Ferry", "tv", 2024)])?.confidence).toBe("low");
  });

  it("offers at most 4 candidates, and nothing for no results", () => {
    const many = [1, 2, 3, 4, 5, 6].map((n) => t(n, `Moth Season ${n}`, "tv", 2020));
    expect(scoreResults({ title: "Moth Season", year: null, type: null, confident: true }, many)?.candidates).toHaveLength(4);
    expect(scoreResults(ferry, [])).toBeNull();
  });
});

describe("the import pipeline", () => {
  const catalog: Title[] = [
    t(1, "The Night Ferry", "tv", 2024),
    t(2, "Low Tide Club", "movie", 2023),
    t(3, "Moth Season", "tv", 2021),
    t(4, "Grandma's Heist", "movie", 2022),
  ];
  const search = vi.fn(async (query: string) => catalog.filter((c) => normalizeTitle(c.name).includes(normalizeTitle(query))));

  function deps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
    return {
      extract: vi.fn(async () => ({ candidates: [], inputTokens: 0, outputTokens: 0 })),
      search,
      cachedMatches: async () => new Map(),
      saveMatches: vi.fn(async () => {}),
      titleFor: async () => null,
      existing: new Set(),
      ...overrides,
    };
  }

  it("matches a clean list on TMDB with no AI call", async () => {
    const d = deps();
    const found: number[] = [];
    const result = await runImport(
      { text: "The Night Ferry\nLow Tide Club\nMoth Season", images: [], reuse: null },
      d,
      (n) => found.push(n),
    );
    expect(d.extract).not.toHaveBeenCalled();
    expect(result.aiUsed).toBe(false);
    expect(result.cards.map((c) => [c.candidates[0].name, c.confidence])).toEqual([
      ["The Night Ferry", "high"],
      ["Low Tide Club", "high"],
      ["Moth Season", "high"],
    ]);
    expect(found).toEqual([1, 2, 3]);
    expect(d.saveMatches).toHaveBeenCalledWith([
      { key: "night ferry||", type: "tv", tmdbId: 1 },
      { key: "low tide club||", type: "movie", tmdbId: 2 },
      { key: "moth season||", type: "tv", tmdbId: 3 },
    ]);
  });

  it("sends only messy and unmatched lines to the model, and keeps notes", async () => {
    const extract = vi.fn(async () => ({
      candidates: [
        { title: "Low Tide Club", year: null, type: "movie" as const, note: "so good", confident: true },
        { title: "Grandma's Heist", year: null, type: null, note: null, confident: true },
      ],
      inputTokens: 900,
      outputTokens: 120,
    }));
    const result = await runImport(
      { text: "The Night Ferry\nLow Tide Club, so good\nGrandmas Heyst", images: [], reuse: null },
      deps({ extract }),
    );
    expect(extract).toHaveBeenCalledWith({ text: "Low Tide Club, so good\nGrandmas Heyst", images: [] }, undefined);
    expect(result.cards.map((c) => [c.candidates[0].name, c.note])).toEqual([
      ["The Night Ferry", ""],
      ["Low Tide Club", "so good"],
      ["Grandma's Heist", ""],
    ]);
    expect(result).toMatchObject({ aiUsed: true, inputTokens: 900, outputTokens: 120 });
  });

  it("drops titles already on the list, and repeats, and counts the duplicates", async () => {
    const result = await runImport(
      { text: "The Night Ferry\nLow Tide Club\nThe Night Ferry", images: [], reuse: null },
      deps({ existing: new Set(["movie-2"]) }),
    );
    expect(result.cards.map((c) => c.candidates[0].tmdbId)).toEqual([1]);
    expect(result.duplicates).toBe(1);
  });

  it("reuses what the same input found, without the model", async () => {
    const d = deps();
    const result = await runImport(
      { text: "anything", images: [], reuse: [{ title: "Moth Season", year: 2021, type: "tv", note: "eerie", confident: true }] },
      d,
    );
    expect(d.extract).not.toHaveBeenCalled();
    expect(result.cards).toEqual([
      { query: "Moth Season", note: "eerie", confidence: "high", candidates: [{ type: "tv", tmdbId: 3, name: "Moth Season", year: 2021, posterPath: null }] },
    ]);
  });

  it("uses the shared match cache before searching", async () => {
    const searchSpy = vi.fn(search);
    const result = await runImport(
      { text: "Moth Season", images: [], reuse: null },
      deps({
        search: searchSpy,
        cachedMatches: async () => new Map([["moth season||", { type: "tv" as const, tmdbId: 3 }]]),
        titleFor: async () => ({ type: "tv", tmdbId: 3, name: "Moth Season", year: 2021, posterPath: null }),
      }),
    );
    expect(searchSpy).not.toHaveBeenCalled();
    expect(result.cards[0].confidence).toBe("high");
  });

  it("sends screenshots to the model", async () => {
    const extract = vi.fn(async () => ({
      candidates: [{ title: "The Night Ferry", year: 2024, type: "tv" as const, note: null, confident: true }],
      inputTokens: 1500,
      outputTokens: 40,
    }));
    const images = [{ mediaType: "image/jpeg" as const, base64: "AAAA" }];
    const result = await runImport({ text: "", images, reuse: null }, deps({ extract }));
    expect(extract).toHaveBeenCalledWith({ text: "", images }, undefined);
    expect(result.cards).toHaveLength(1);
  });

  it("stops at 100 cards and says so", async () => {
    const big = Array.from({ length: 120 }, (_, i) => t(100 + i, `Night Ferry ${i}`, "tv", 2020));
    const result = await runImport(
      { text: big.map((b) => b.name).join("\n"), images: [], reuse: null },
      deps({ search: async (q) => big.filter((b) => b.name === q) }),
    );
    expect(result.cards).toHaveLength(100);
    expect(result.truncated).toBe(true);
  });

  it("skips a title TMDB can't find, or can't reach", async () => {
    const result = await runImport(
      { text: "The Night Ferry\nSomething Nobody Made", images: [], reuse: null },
      deps({
        search: async (q) => {
          if (q === "Something Nobody Made") throw new Error("TMDB down");
          return catalog.filter((c) => c.name === q);
        },
        extract: async () => ({
          candidates: [{ title: "Something Nobody Made", year: null, type: null, note: null, confident: false }],
          inputTokens: 1,
          outputTokens: 1,
        }),
      }),
    );
    expect(result.cards.map((c) => c.candidates[0].name)).toEqual(["The Night Ferry"]);
  });
});
