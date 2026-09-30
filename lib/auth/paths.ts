// Route access (PRD 6.4). Only /, /privacy, /terms are indexable; the rest of
// these routes send noindex. Later steps add their routes to the list.
const PROTECTED_PREFIXES = ["/shelf", "/welcome", "/you", "/groups", "/activity", "/settings", "/title", "/person", "/admin"];

export function isProtectedPath(pathname: string): boolean {
  if (/^\/join\/[^/]+\/accept$/.test(pathname)) return true;
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Routes that aren't signed-in only but still send noindex: sign-in, auth callbacks, invite landings, unsubscribe, shared shelves. */
export function isNoindexPath(pathname: string): boolean {
  return isProtectedPath(pathname) || pathname === "/sign-in" || pathname.startsWith("/sign-in/") || pathname.startsWith("/auth/") || pathname.startsWith("/join/") || pathname === "/unsubscribe" || pathname.startsWith("/s/");
}

/** The group id in /shelf/<id>, remembered per device as the last viewed shelf (PRD 6.2). */
export function shelfGroupId(pathname: string): string | null {
  const match = pathname.match(/^\/shelf\/([0-9a-f-]{36})$/i);
  return match ? match[1] : null;
}

export const LAST_SHELF_COOKIE = "gw_shelf";

/**
 * Where to go after signing in. Only same-site paths are honored, so a
 * crafted ?next= can't send someone to another site.
 */
export function safeNext(value: string | null | undefined, fallback = "/shelf"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
