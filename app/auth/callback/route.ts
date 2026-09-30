import { NextResponse, type NextRequest } from "next/server";
import { landingPath } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/paths";
import { recordEvent } from "@/lib/events/server";
import { createClient } from "@/lib/supabase/server";

// Google sign-in landing: exchanges the code for a session.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const go = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  if (!code) return go(`/sign-in?error=google&next=${encodeURIComponent(next)}`);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) throw error;
    const landing = await landingPath(data.user.id, next);
    await recordEvent("sign_in_completed", { method: "google", new_user: landing.startsWith("/welcome") }, data.user.id);
    return go(landing);
  } catch {
    return go(`/sign-in?error=google&next=${encodeURIComponent(next)}`);
  }
}
