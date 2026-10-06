import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Marks Home viewed (PRD F16.3), when you leave it or after 10 seconds on it,
// the way lists are (F5.5). A route so it can be sent with `keepalive` as the
// page closes. Same-origin only; it only ever touches the caller's profile.
export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") !== "same-origin" && request.headers.get("origin") !== request.nextUrl.origin) {
    return new NextResponse(null, { status: 403 });
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return new NextResponse(null, { status: 401 });
  const { error } = await supabase.rpc("mark_home_viewed");
  if (error) {
    console.error("mark home viewed failed", error.code);
    return new NextResponse(null, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
