// Intl-based formatting (DESIGN-SYSTEM.md 6.4). Never string concatenation.
import { t } from "./messages";

const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const shortDateYear = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
const fullDateTime = new Intl.DateTimeFormat("en", { dateStyle: "full", timeStyle: "short" });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5m ago", "2h ago", "yesterday", "3d ago", then "Sep 12" (with a year if not this year). */
export function relativeTime(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return t("time.justNow");
  if (diff < HOUR) return t("time.minutesAgo", { count: Math.floor(diff / MINUTE) });
  if (diff < DAY) return t("time.hoursAgo", { count: Math.floor(diff / HOUR) });
  const days = Math.floor(diff / DAY);
  if (days === 1) return t("time.yesterday");
  if (days < 7) return t("time.daysAgo", { count: days });
  return date.getFullYear() === now.getFullYear() ? shortDate.format(date) : shortDateYear.format(date);
}

/** Full date and time for accessible names and `title`s. */
export function fullTime(date: Date): string {
  return fullDateTime.format(date);
}

/**
 * "Priya", "Priya and Jonah", "Priya, Jonah, and Tess", "Priya, Jonah, and 3 others".
 * Four or more names show the first two and a count.
 */
export function nameList(names: string[]): string {
  if (names.length <= 3) return listFormat.format(names);
  const others = t("people.others", { count: names.length - 2 });
  return listFormat.format([names[0], names[1], others]);
}

/** Compact vouched-by names: "Priya", "Priya, Jonah", "Priya, Jonah +1". */
export function compactNames(names: string[], max = 2): string {
  const shown = names.slice(0, max).join(", ");
  const rest = names.length - max;
  return rest > 0 ? t("people.compactOverflow", { names: shown, count: rest }) : shown;
}

/** Badge counts cap at 99+. */
export function badgeCount(count: number): string {
  return count > 99 ? t("count.cap") : new Intl.NumberFormat("en").format(count);
}

/** Runtime in minutes to "1h 52m" / "45m". */
export function runtime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return t("time.runtimeMinutes", { m });
  return m === 0 ? t("time.runtimeHours", { h }) : t("time.runtime", { h, m });
}
