import { NextResponse, type NextRequest } from "next/server";
import { EVENTS, isEventName } from "@/lib/events/schema";
import { recordEvent } from "@/lib/events/server";
import { RateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Events from the browser (PRD 11): only the ones marked `client` in the
// schema, from this site, from signed-in people, and at most 120 a minute
// each. Sent with sendBeacon, so it answers 204 and nothing else.
const limit = new RateLimit(120, 60_000);

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") !== "same-origin" && request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { name?: unknown; props?: unknown } | null;
  if (!body || !isEventName(body.name) || !EVENTS[body.name].client) return new NextResponse(null, { status: 400 });

  const { data } = await (await createClient()).auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) return new NextResponse(null, { status: 401 });
  if (!limit.take(userId)) return new NextResponse(null, { status: 429 });

  await recordEvent(body.name, body.props as never, userId);
  return new NextResponse(null, { status: 204 });
}
