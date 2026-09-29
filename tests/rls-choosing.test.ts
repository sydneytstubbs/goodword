import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Step 5 under row-level security, against the real project (PRD 8, F5.5;
// CLAUDE.md: never leak across groups, test it explicitly). Where-to-watch
// rows are readable when signed in and written only by the server. New
// counts and "last viewed" only ever cover your own groups. Priya is in
// College crew with Jonah; Mo is not. Invented people and titles only.
// Skipped without the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("row-level security: choosing", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const tmdbId = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  let ferry = "";
  let crew = "";

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    await admin.from("profiles").update({ display_name: name, onboarded_at: new Date().toISOString() }).eq("user_id", created.data.user.id);
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const verified = await client.auth.verifyOtp({ type: "email", token_hash: link.data.properties.hashed_token });
    if (verified.error) throw verified.error;
    return { id: created.data.user.id, client };
  }

  beforeAll(async () => {
    for (const name of ["priya", "jonah", "mo"]) people[name] = await signInAs(name);
    crew = randomUUID();
    const { error } = await people.priya.client.rpc("create_group", { p_id: crew, p_name: "College crew", p_color: 1 });
    if (error) throw error;
    const { data: invite } = await admin.from("invites").select("code").eq("group_id", crew).single();
    await people.jonah.client.rpc("join_group", { p_code: invite!.code });
    const { data: title, error: titleError } = await admin
      .from("titles")
      .insert({ tmdb_id: tmdbId, media_type: "tv", title: "The Night Ferry", accent: "plum" })
      .select("id")
      .single();
    if (titleError) throw titleError;
    ferry = title.id;
    await admin.from("watch_providers").insert({
      title_id: ferry,
      region: "US",
      providers: { stream: [{ id: 8, name: "Netflix", logo: null }], rent: [], buy: [] },
      link: "https://www.themoviedb.org/",
    });
  });

  afterAll(async () => {
    await admin.from("groups").delete().eq("id", crew);
    await admin.from("titles").delete().eq("tmdb_id", tmdbId);
    for (const user of Object.values(people)) await admin.auth.admin.deleteUser(user.id);
  });

  it("lets any signed-in user read where to watch, and nobody else", async () => {
    const { data } = await people.mo.client.from("watch_providers").select("region, link").eq("title_id", ferry);
    expect(data).toEqual([{ region: "US", link: "https://www.themoviedb.org/" }]);
    const signedOut = createClient(url!, anon!, { auth: { persistSession: false } });
    expect((await signedOut.from("watch_providers").select("id").eq("title_id", ferry)).data ?? []).toEqual([]);
  });

  it("lets only the server write where to watch", async () => {
    const insert = await people.priya.client.from("watch_providers").insert({ title_id: ferry, region: "GB" });
    expect(insert.error).not.toBeNull();
    await people.priya.client.from("watch_providers").update({ link: "https://example.com/" }).eq("title_id", ferry);
    await people.priya.client.from("watch_providers").delete().eq("title_id", ferry);
    const { data } = await admin.from("watch_providers").select("link").eq("title_id", ferry);
    expect(data).toEqual([{ link: "https://www.themoviedb.org/" }]);
  });

  it("counts new good words from others since you last looked, in your groups only", async () => {
    const put = await people.jonah.client.rpc("put_good_word", { p_title: ferry, p_note: "strange and perfect", p_groups: [crew], p_source: "organic" });
    expect(put.error).toBeNull();

    const priyaCounts = await people.priya.client.rpc("new_good_word_counts");
    expect(priyaCounts.data).toEqual([{ group_id: crew, new_count: 1 }]);
    // Your own good words are never new to you.
    expect((await people.jonah.client.rpc("new_good_word_counts")).data).toEqual([]);
    // Mo isn't in College crew: nothing, not even the group's id.
    expect((await people.mo.client.rpc("new_good_word_counts")).data).toEqual([]);
  });

  it("marks only your own memberships viewed", async () => {
    // Mo can't mark College crew viewed for anyone.
    await people.mo.client.rpc("mark_shelves_viewed", { p_groups: [crew] });
    expect((await people.priya.client.rpc("new_good_word_counts")).data).toEqual([{ group_id: crew, new_count: 1 }]);

    const marked = await people.priya.client.rpc("mark_shelves_viewed", { p_groups: [crew] });
    expect(marked.error).toBeNull();
    expect((await people.priya.client.rpc("new_good_word_counts")).data).toEqual([]);
    const { data } = await admin.from("group_members").select("user_id, last_viewed_at").eq("group_id", crew);
    const byUser = new Map((data ?? []).map((m) => [m.user_id, m.last_viewed_at]));
    expect(byUser.get(people.priya.id)).not.toBeNull();
    expect(byUser.get(people.jonah.id)).toBeNull();
  });

  it("can't be called signed out", async () => {
    const signedOut = createClient(url!, anon!, { auth: { persistSession: false } });
    expect((await signedOut.rpc("new_good_word_counts")).error).not.toBeNull();
    expect((await signedOut.rpc("mark_shelves_viewed", { p_groups: [crew] })).error).not.toBeNull();
  });
});
