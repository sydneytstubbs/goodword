// Import routes (PRD 6.1, F15): /you/import and /you/import/[importId].

/** The review deck hides the tab bar and header below 1024px, so its action bar sits at the bottom (DS 5.18). */
export function isImportDeckPath(pathname: string): boolean {
  return /^\/you\/import\/[0-9a-f-]{36}$/i.test(pathname);
}

export function deckHref(importId: string, card?: number): string {
  return card ? `/you/import/${importId}?card=${card}` : `/you/import/${importId}`;
}
