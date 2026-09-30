import "server-only";
import { headers } from "next/headers";

// Where a view came from, for title_viewed and conversation_opened (PRD
// 11.2): the path of the page that linked here, when it's this site.
// In-app navigations send the current page as the Referer.
export async function referrerPath(): Promise<string | null> {
  const h = await headers();
  const referer = h.get("referer");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!referer || !host) return null;
  try {
    const url = new URL(referer);
    return url.host === host ? url.pathname : null;
  } catch {
    return null;
  }
}
