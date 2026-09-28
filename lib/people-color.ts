// Deterministic people tones for avatars, group dots, and fallback posters
// (DESIGN-SYSTEM.md 3.1.2, 4.1.10). A person or group always keeps its tone.

export type PeopleTone = 1 | 2 | 3 | 4;

/** FNV-1a: small, stable across runtimes, well spread for short ids. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function peopleTone(id: string): PeopleTone {
  return ((hash(id) % 4) + 1) as PeopleTone;
}

/** Class maps, so Tailwind sees every class name literally. */
export const toneBg: Record<PeopleTone, string> = {
  1: "bg-people-1",
  2: "bg-people-2",
  3: "bg-people-3",
  4: "bg-people-4",
};
