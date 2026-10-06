import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Marks lists as viewed (PRD F5.5), when you leave a list or after 10
// seconds on it. A route rather than a server action so it can be sent with
// `keepalive` as the page closes. Same-origin only; it only ever touches the
// caller's own memberships (mark_shelves_viewed).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") !== "same-origin" && request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { groups?: unknown } | null;
  const groups = Array.isArray(body?.groups) ? body.groups.filter((g): g is string => typeof g === "string" && UUID.test(g)).slice(0, 50) : [];
  if (groups.length === 0) return new NextResponse(null, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return new NextResponse(null, { status: 401 });
  const { error } = await supabase.rpc("mark_shelves_viewed", { p_groups: groups });
  if (error) {
    console.error("mark lists viewed failed", error.code);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
