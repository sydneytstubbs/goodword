import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseColor } from "./contrast";
import { badgeCount, compactNames, nameList, relativeTime, runtime } from "./format";
import { resolveGenreAccent } from "./genre-accent";
import { t } from "./messages";
import { peopleTone } from "./people-color";

describe("messages", () => {
  it("interpolates and picks plural forms", () => {
    expect(t("search.results", { count: 1 })).toBe("1 result");
    expect(t("search.results", { count: 6 })).toBe("6 results");
    expect(t("composer.placeholder", { group: "College crew" })).toBe("Say something to College crew…");
  });
});

describe("format (DS 6.4)", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it("formats relative time", () => {
    expect(relativeTime(ago(10_000), now)).toBe("just now");
    expect(relativeTime(ago(5 * 60_000), now)).toBe("5m ago");
    expect(relativeTime(ago(2 * 3_600_000), now)).toBe("2h ago");
    expect(relativeTime(ago(30 * 3_600_000), now)).toBe("yesterday");
    expect(relativeTime(ago(3 * 86_400_000), now)).toBe("3d ago");
    expect(relativeTime(new Date("2026-09-12T12:00:00Z"), now)).toBe("Sep 12");
    expect(relativeTime(new Date("2025-09-12T12:00:00Z"), now)).toBe("Sep 12, 2025");
  });
  it("formats name lists", () => {
    expect(nameList(["Priya"])).toBe("Priya");
    expect(nameList(["Priya", "Jonah"])).toBe("Priya and Jonah");
    expect(nameList(["Priya", "Jonah", "Tess"])).toBe("Priya, Jonah, and Tess");
    expect(nameList(["Priya", "Jonah", "Tess", "Mo", "Bea"])).toBe("Priya, Jonah, and 3 others");
    expect(compactNames(["Priya", "Jonah", "Tess"])).toBe("Priya, Jonah +1");
  });
  it("caps badge counts and formats runtime", () => {
    expect(badgeCount(7)).toBe("7");
    expect(badgeCount(120)).toBe("99+");
    expect(runtime(112)).toBe("1h 52m");
    expect(runtime(45)).toBe("45m");
  });
});

describe("colors", () => {
  it("assigns people tones deterministically", () => {
    expect(peopleTone("priya")).toBe(peopleTone("priya"));
    const tones = new Set(["priya", "jonah", "tess", "mo", "luis", "bea", "a", "b"].map(peopleTone));
    expect(tones.size).toBeGreaterThan(1);
  });
  it("maps the first genre to an accent (DS 4.2.1)", () => {
    expect(resolveGenreAccent(["Comedy", "Drama"], "1")).toBe("ochre");
    expect(resolveGenreAccent(["Crime"], "1")).toBe("moss");
    expect(resolveGenreAccent(["Unknown"], "42")).toBe(resolveGenreAccent([], "42"));
  });
});

describe("contrast (DS 3.1.3)", () => {
  const ratio = (a: string, b: string) => Number(contrastRatio(parseColor(a)!, parseColor(b)!).toFixed(1));
  it("reproduces the documented light values", () => {
    expect(ratio("#0A0A0A", "#FAFAF9")).toBe(19.0);
    expect(ratio("#6B6B6B", "#F3F3F1")).toBe(4.8);
    expect(ratio("#FFFFFF", "#2B4BFF")).toBe(5.9);
    expect(ratio("#15803D", "#F3F3F1")).toBe(4.5);
    expect(ratio("#8A8A87", "#F3F3F1")).toBe(3.1);
  });
  it("composites translucent colors", () => {
    expect(ratio("rgb(255 255 255 / 0.72)", "#0A0A0A")).toBeGreaterThan(4.5);
  });
});

describe("type tokens (DS 3.2.2)", () => {
  it("never sets Instrument Serif below 24px", () => {
    const tokens = readFileSync("styles/tokens.css", "utf8");
    const typography = readFileSync("styles/typography.css", "utf8");
    const blocks = typography.match(/@utility [\w-]+ \{[^}]+\}/g) ?? [];
    const serif = blocks.filter((b) => b.includes("--font-display"));
    expect(serif.length).toBeGreaterThan(0);
    for (const block of serif) {
      const sizeVar = block.match(/font-size: var\((--[\w-]+)\)/)![1];
      const value = tokens.match(new RegExp(`${sizeVar}: ([^;]+);`))![1];
      // The smallest size a token can reach: the rem value, or a clamp() minimum.
      const min = parseFloat(value.startsWith("clamp(") ? value.slice(6) : value);
      expect(min * 16, `${sizeVar} = ${value}`).toBeGreaterThanOrEqual(24);
    }
  });
});
