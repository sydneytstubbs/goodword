import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except static files, images, and generated icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
