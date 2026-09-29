import { NextResponse, type NextRequest } from "next/server";
import { landingPath } from "@/lib/auth/session";
import { safeNext } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

// Magic link landing. Verifies the token hash, so the link works in any browser
// or on any device, not just the one that asked for it (DS 5.3).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const next = safeNext(searchParams.get("next"));

  const go = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));

  if (!tokenHash) return go(`/sign-in?error=expired&next=${encodeURIComponent(next)}`);

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
    if (error || !data.user) throw error;
    return go(await landingPath(data.user.id, next));
  } catch {
    // Expired, used, or unverifiable (including Supabase being unreachable): offer a new link.
    return go(`/sign-in?error=expired&next=${encodeURIComponent(next)}`);
  }
}
