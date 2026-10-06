import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isNoindexPath, isProtectedPath, LAST_LIST_COOKIE, listGroupId } from "@/lib/auth/paths";

/**
 * Refreshes the session cookie on every request, then applies the access rules
 * (PRD 6.4): signed-out visitors to a signed-in route go to /sign-in?next=<route>;
 * signed-in visitors to /sign-in or / go to /list (the last viewed list).
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname, search } = request.nextUrl;

  // Without Supabase configured (CI builds, a fresh checkout) nobody can be signed in.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (!isProtectedPath(pathname)) return response;
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  const redirect = (to: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    Object.entries(params ?? {}).forEach(([k, v]) => url.searchParams.set(k, v));
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirected.cookies.set(c));
    return redirected;
  };

  if (!signedIn && isProtectedPath(pathname)) return redirect("/sign-in", { next: pathname + search });
  if (signedIn && (pathname === "/sign-in" || pathname === "/")) return redirect("/list");

  if (isNoindexPath(pathname)) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  const groupId = listGroupId(pathname);
  if (signedIn && groupId) {
    response.cookies.set(LAST_LIST_COOKIE, groupId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  }
  return response;
}
