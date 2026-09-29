import { NextResponse, type NextRequest } from "next/server";
import { setPrefFromToken } from "@/lib/email/unsubscribe";

// RFC 8058 one-click unsubscribe (PRD 9.4): mail apps POST here from their own
// Unsubscribe button. The signed token is the only credential. The link in
// the email's footer opens /unsubscribe instead, which confirms and offers Undo.
export async function POST(request: NextRequest) {
  const pref = await setPrefFromToken(request.nextUrl.searchParams.get("token"), false);
  return new NextResponse(null, { status: pref ? 200 : 400 });
}
