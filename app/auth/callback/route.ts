import { NextResponse, type NextRequest } from "next/server";
import { landingPath } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/paths";
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
    return go(await landingPath(data.user.id, next));
  } catch {
    return go(`/sign-in?error=google&next=${encodeURIComponent(next)}`);
  }
}
