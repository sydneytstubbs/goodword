import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Row-level security on the title cache (PRD 8): readable by any signed-in
// user, writable only by the server. Against the real project; skipped
// without the Supabase env vars. Uses an invented title id range no real
// TMDB title uses, and removes it afterward.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

describe.skipIf(!enabled)("row-level security: titles", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const tmdbId = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  let userId = "";
  let priya: SupabaseClient;

  beforeAll(async () => {
    const email = `priya-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    userId = created.data.user.id;
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    priya = createClient(url!, anon!, { auth: { persistSession: false } });
    const verified = await priya.auth.verifyOtp({ type: "email", token_hash: link.data.properties.hashed_token });
    if (verified.error) throw verified.error;
    const { error } = await admin.from("titles").insert({
      tmdb_id: tmdbId,
      media_type: "tv",
      title: "The Night Ferry",
      year: 2024,
      genres: [{ id: 18, name: "Drama" }],
      accent: "plum",
    });
    if (error) throw error;
  });

  afterAll(async () => {
    await admin.from("titles").delete().eq("tmdb_id", tmdbId);
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  it("lets signed-in people read cached titles", async () => {
    const { data } = await priya.from("titles").select("title, accent").eq("tmdb_id", tmdbId);
    expect(data).toEqual([{ title: "The Night Ferry", accent: "plum" }]);
  });

  it("hides the cache from signed-out visitors", async () => {
    const anonymous = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data } = await anonymous.from("titles").select("title").eq("tmdb_id", tmdbId);
    expect(data ?? []).toEqual([]);
  });

  it("never lets people write titles directly", async () => {
    const insert = await priya.from("titles").insert({ tmdb_id: tmdbId + 1, media_type: "movie", title: "Moth Season", accent: "clay" });
    expect(insert.error).not.toBeNull();
    await priya.from("titles").update({ title: "Not the Night Ferry" }).eq("tmdb_id", tmdbId);
    await priya.from("titles").delete().eq("tmdb_id", tmdbId);
    const { data } = await admin.from("titles").select("title").eq("tmdb_id", tmdbId);
    expect(data).toEqual([{ title: "The Night Ferry" }]);
  });

  it("keeps the accent from the first save when a title is refreshed", async () => {
    const { error } = await admin
      .from("titles")
      .upsert({ tmdb_id: tmdbId, media_type: "tv", title: "The Night Ferry", genres: [{ id: 35, name: "Comedy" }], accent: "ochre" }, { onConflict: "tmdb_id,media_type" });
    expect(error).toBeNull();
    const { data } = await admin.from("titles").select("accent, genres").eq("tmdb_id", tmdbId).single();
    expect(data).toEqual({ accent: "plum", genres: [{ id: 35, name: "Comedy" }] });
  });

  it("allows one row per title and type", async () => {
    const dupe = await admin.from("titles").insert({ tmdb_id: tmdbId, media_type: "tv", title: "Again", accent: "moss" });
    expect(dupe.error).not.toBeNull();
    const otherType = await admin.from("titles").insert({ tmdb_id: tmdbId, media_type: "movie", title: "Moth Season", accent: "clay" });
    expect(otherType.error).toBeNull();
  });
});
