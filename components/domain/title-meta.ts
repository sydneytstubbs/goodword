import { compactNames, nameList, runtime } from "@/lib/format";
import { t } from "@/lib/messages";
import type { GoodWord, Title } from "./types";

// Meta lines (DESIGN-SYSTEM.md 6.4): "Series · 2024", "Film · 2023 · 1h 52m",
// "Series · 2024 · 3 seasons" (PRD F6). The year is left out when TMDB has none.
export function titleMeta(title: Pick<Title, "type" | "year" | "runtime" | "seasons">, withDetail = false): string {
  const parts = [t(`title.${title.type}`)];
  if (title.year) parts.push(String(title.year));
  if (withDetail && title.type === "movie" && title.runtime) parts.push(runtime(title.runtime));
  if (withDetail && title.type === "tv" && title.seasons) parts.push(t("title.seasons", { count: title.seasons }));
  return parts.join(t("title.metaSeparator"));
}

/** Names on a vouched-by row. Your own good word is listed as "You", first. */
export function vouchNames(goodWords: GoodWord[], viewerId?: string): string[] {
  const mine = goodWords.filter((g) => g.person.id === viewerId).map(() => t("common.you"));
  const others = goodWords.filter((g) => g.person.id !== viewerId).map((g) => g.person.name);
  return [...mine, ...others];
}

export function vouchedByCompact(goodWords: GoodWord[], viewerId?: string): string {
  return compactNames(vouchNames(goodWords, viewerId));
}

/** "The Night Ferry, series, 2024. Vouched for by Priya and Jonah." (DS 4.2.2) */
export function cardAccessibleName(title: Title, goodWords: GoodWord[], viewerId?: string): string {
  const type = t(`title.${title.type}`).toLocaleLowerCase("en");
  const base = title.year
    ? t("title.accessibleName", { title: title.name, type, year: String(title.year) })
    : t("title.accessibleNameNoYear", { title: title.name, type });
  if (goodWords.length === 0) return base;
  return `${base} ${t("title.vouchedFor", { names: nameList(vouchNames(goodWords, viewerId)) })}`;
}
