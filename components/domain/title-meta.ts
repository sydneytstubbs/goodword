import { compactNames, nameList, runtime } from "@/lib/format";
import { t } from "@/lib/messages";
import type { GoodWord, Title } from "./types";

// Meta lines (DESIGN-SYSTEM.md 6.4): "Series · 2024", "Film · 2023 · 1h 52m".
export function titleMeta(title: Pick<Title, "type" | "year" | "runtime">, withRuntime = false): string {
  const type = t(`title.${title.type}`);
  const year = String(title.year);
  if (withRuntime && title.runtime) return t("title.metaRuntime", { type, year, runtime: runtime(title.runtime) });
  return t("title.meta", { type, year });
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
  const base = t("title.accessibleName", {
    title: title.name,
    type: t(`title.${title.type}`).toLocaleLowerCase("en"),
    year: String(title.year),
  });
  if (goodWords.length === 0) return base;
  return `${base} ${t("title.vouchedFor", { names: nameList(vouchNames(goodWords, viewerId)) })}`;
}
