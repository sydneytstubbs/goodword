import type { NextRequest } from "next/server";
import { RateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { searchTitles } from "@/lib/tmdb/client";
import { MAX_QUERY, MIN_QUERY, normalizeQuery } from "@/lib/tmdb/normalize";
import { SearchCache } from "@/lib/tmdb/search-cache";

// Title search (PRD F3): GET /api/titles/search?q=night. Signed-in only. The
// browser never talks to TMDB; this route does, with a 5-minute cache per
// normalized query and a limit of 60 searches per person per minute (10.4).

const cache = new SearchCache();
const limit = new RateLimit(60, 60_000);

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  // Without Supabase configured (CI builds, a fresh checkout) nobody can be signed in.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return Response.json({ error: "signed_out" }, { status: 401, headers });
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return Response.json({ error: "signed_out" }, { status: 401, headers });

  const query = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (query.length < MIN_QUERY || query.length > MAX_QUERY) {
    return Response.json({ error: "bad_query" }, { status: 400, headers });
  }
  if (!limit.take(userId)) return Response.json({ error: "rate_limited" }, { status: 429, headers });

  const hit = cache.get(query);
  if (hit) return Response.json({ results: hit }, { headers });

  try {
    const results = await searchTitles(query, request.signal);
    cache.set(query, results);
    return Response.json({ results }, { headers });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499, headers });
    // Never log the query text (PRD 11.1).
    console.error("search: TMDB failed", (error as Error).message);
    return Response.json({ error: "unavailable" }, { status: 502, headers });
  }
}
