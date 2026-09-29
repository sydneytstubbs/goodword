/** The existing group name this one matches, ignoring case and spacing, if any. */
export function duplicateOf(name: string, existing: string[], except?: string): string | null {
  const key = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
  const target = key(name);
  if (!target) return null;
  return existing.find((n) => key(n) === target && n !== except) ?? null;
}
