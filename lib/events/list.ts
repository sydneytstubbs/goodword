import type { ShelfCard } from "@/components/domain/types";

// What shelf_viewed records (PRD 11.2): which filters are on, by name only
// (never their values), and how many cards are New.
const FILTER_KEYS = ["type", "services", "genres", "length", "sort", "mine", "groups"];

export function filterKeys(params: Record<string, string | string[] | undefined>): string[] {
  return FILTER_KEYS.filter((key) => params[key] !== undefined && params[key] !== "");
}

export function newCount(cards: ShelfCard[]): number {
  return cards.filter((card) => card.isNew).length;
}
