import "server-only";
import { headers } from "next/headers";

/** This deployment's origin, from the request (so previews and local dev link to themselves), else APP_URL. */
export async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return process.env.APP_URL!;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
