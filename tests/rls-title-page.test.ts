import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The title page under row-level security, by API (PRD F16.4, and F16.6's
// acceptance criteria). The page and URL sides are in
// tests/e2e/title-page.spec.ts. Invented people and titles only. Skipped
// without the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("row-level security: the title page", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  let ferry = "";
  let lowTide = "";
  let crew = "";
  const words: Record<string, string> = {};

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-titlepage-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    await admin
      .from("profiles")
      .update({ display_name: name[0].toUpperCase() + name.slice(1), onboarded_at: new Date().toISOString(), home_enabled: true })
      .eq("user_id", created.data.user.id);
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const verified = await client.auth.verifyOtp({ type: "email", token_hash: link.data.properties.hashed_token });
    if (verified.error) throw verified.error;
    return { id: created.data.user.id, client };
  }

  async function befriend(a: User, b: User) {
    const { data: code } = await a.client.rpc("my_friend_link");
    const { error } = await b.client.rpc("accept_friend_link", { p_code: code });
    if (error) throw error;
  }

  async function vouch(user: User, title: string, friends: boolean, groups: string[] = []) {
    const { error } = await user.client.rpc("put_good_word", { p_title: title, p_note: null, p_groups: groups, p_source: "organic", p_friends: friends });
    if (error) throw error;
    const { data } = await admin.from("good_words").select("id").eq("user_id", user.id).eq("title_id", title).single();
    return data!.id as string;
  }

  /** Whose good words for a title someone can read, straight from the table. */
  async function authors(user: User, title: string): Promise<string[]> {
    const { data, error } = await user.client.from("good_words").select("user_id").eq("title_id", title);
    if (error) throw error;
    const names = Object.fromEntries(Object.entries(people).map(([name, p]) => [p.id, name]));
    return data.map((r) => names[r.user_id as string]).sort();
  }

  /** Whose good words' conversations the title page shows them. */
  async function conversations(user: User, title: string): Promise<string[]> {
    const { data, error } = await user.client.rpc("title_word_conversations", { p_title: title });
    if (error) throw error;
    const byWord = Object.fromEntries(Object.entries(words).map(([name, id]) => [id, name]));
    return (data as Array<{ good_word_id: string }>).map((r) => byWord[r.good_word_id]).sort();
  }

  beforeAll(async () => {
    // Priya, Jonah, and Tess are all friends. Mo is Jonah's friend only. Bea
    // is nobody's friend. Luis is in College crew with Jonah.
    for (const name of ["priya", "jonah", "tess", "mo", "bea", "luis"]) people[name] = await signInAs(name);
    await befriend(people.priya, people.jonah);
    await befriend(people.priya, people.tess);
    await befriend(people.jonah, people.tess);
    await befriend(people.jonah, people.mo);
    crew = randomUUID();
    await people.jonah.client.rpc("create_group", { p_id: crew, p_name: "College crew", p_color: 1 });
    const { data: invite } = await admin.from("invites").select("code").eq("group_id", crew).is("revoked_at", null).single();
    await people.luis.client.rpc("join_group", { p_code: invite!.code });
    const { data } = await admin
      .from("titles")
      .insert([
        { tmdb_id: base, media_type: "tv", title: "The Night Ferry", year: 2024, genres: [], accent: "plum" },
        { tmdb_id: base + 1, media_type: "tv", title: "Low Tide Club", year: 2022, genres: [], accent: "plum" },
      ])
      .select("id, title");
    ferry = data!.find((r) => r.title === "The Night Ferry")!.id;
    lowTide = data!.find((r) => r.title === "Low Tide Club")!.id;
    for (const name of ["priya", "jonah", "tess", "bea"]) words[name] = await vouch(people[name], ferry, true);
    await vouch(people.jonah, lowTide, false, [crew]);
    await people.priya.client.rpc("post_word_comment", { p_id: randomUUID(), p_good_word: words.jonah, p_body: "ep 3", p_spoiler: false });
  }, 120_000);

  afterAll(async () => {
    await admin.from("groups").delete().in("owner_id", Object.values(people).map((p) => p.id));
    for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
    await admin.from("titles").delete().in("id", [ferry, lowTide]);
  });

  it("shows Priya, Jonah, and Tess all three good words and the conversation under each", async () => {
    for (const name of ["priya", "jonah", "tess"]) {
      expect(await authors(people[name], ferry)).toEqual(["jonah", "priya", "tess"]);
      expect(await conversations(people[name], ferry)).toEqual(["jonah", "priya", "tess"]);
    }
  });

  it("shows Bea only her own, with nothing to count or reach of theirs", async () => {
    expect(await authors(people.bea, ferry)).toEqual(["bea"]);
    expect(await conversations(people.bea, ferry)).toEqual(["bea"]);
    expect((await people.bea.client.rpc("word_comments", { p_good_word: words.jonah })).data).toEqual([]);
    expect((await people.bea.client.from("good_words").select("id").eq("id", words.priya)).data).toEqual([]);
  });

  it("shows Mo, Jonah's friend only, Jonah's good word and Priya's comment under it, and neither Priya's nor Tess's", async () => {
    expect(await authors(people.mo, ferry)).toEqual(["jonah"]);
    expect(await conversations(people.mo, ferry)).toEqual(["jonah"]);
    const { data } = await people.mo.client.rpc("title_word_conversations", { p_title: ferry });
    const recent = (data as Array<{ recent: Array<{ user_id: string; body: string }> }>)[0].recent;
    expect(recent).toEqual([expect.objectContaining({ user_id: people.priya.id, body: "ep 3" })]);
  });

  it("keeps a good word shared only with College crew off the page of a friend who isn't in it", async () => {
    expect(await authors(people.priya, lowTide)).toEqual([]);
    expect(await authors(people.luis, lowTide)).toEqual(["jonah"]);
    // In the group, but no conversation under it: it isn't shared with friends (question 14).
    expect(await conversations(people.luis, lowTide)).toEqual([]);
  });

  it("removes access both ways on the next load when Priya removes Jonah as a friend", async () => {
    await people.priya.client.rpc("remove_friend", { p_user: people.jonah.id });
    expect(await authors(people.priya, ferry)).toEqual(["priya", "tess"]);
    expect(await authors(people.jonah, ferry)).toEqual(["jonah", "tess"]);
    expect(await conversations(people.priya, ferry)).toEqual(["priya", "tess"]);
  });

  it("isn't callable signed out", async () => {
    expect((await createClient(url!, anon!).rpc("title_word_conversations", { p_title: ferry })).error).not.toBeNull();
  });
});
