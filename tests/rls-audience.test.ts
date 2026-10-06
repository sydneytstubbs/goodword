import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Friends as an audience under row-level security, against the real project
// (PRD F16.2, F16.6 rule 1, F16.11 guardrail 9). Invented people and titles
// only. Skipped without the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("row-level security: friends as an audience", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  const titles: Record<string, string> = {};
  let crew = "";

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-audience-${run}@example.com`;
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

  async function put(user: User, title: string, groups: string[], friends?: boolean) {
    const args: Record<string, unknown> = { p_title: title, p_note: "ep 3 is where it gets you", p_groups: groups, p_source: "organic" };
    if (friends !== undefined) args.p_friends = friends;
    const { data, error } = await user.client.rpc("put_good_word", args);
    if (error) throw error;
    return (data as Array<{ status: string }>)[0].status;
  }

  /** Whose good words on `title` this person can read. */
  async function seenBy(user: User, title: string): Promise<string[]> {
    const { data, error } = await user.client.from("good_words").select("user_id").eq("title_id", title);
    if (error) throw error;
    return (data ?? []).map((r) => r.user_id as string).sort();
  }

  beforeAll(async () => {
    // Priya, Jonah, and Tess are friends with each other; Mo is in College
    // crew with Jonah but friends with nobody; Bea knows nobody.
    for (const name of ["priya", "jonah", "tess", "mo", "bea"]) people[name] = await signInAs(name);
    await befriend(people.priya, people.jonah);
    await befriend(people.priya, people.tess);
    await befriend(people.jonah, people.tess);
    crew = randomUUID();
    await people.jonah.client.rpc("create_group", { p_id: crew, p_name: "College crew", p_color: 1 });
    const { data: invite } = await admin.from("invites").select("code").eq("group_id", crew).is("revoked_at", null).single();
    await people.mo.client.rpc("join_group", { p_code: invite!.code });
    const names = ["The Night Ferry", "Low Tide Club", "Grandma's Heist", "Moth Season"];
    const { data, error } = await admin
      .from("titles")
      .insert(names.map((title, i) => ({ tmdb_id: base + i, media_type: "tv", title, year: 2024, genres: [], accent: "plum" })))
      .select("id, title");
    if (error) throw error;
    for (const row of data!) titles[row.title as string] = row.id as string;
  }, 90_000);

  afterAll(async () => {
    await admin.from("groups").delete().in("owner_id", Object.values(people).map((p) => p.id));
    for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
    await admin.from("titles").delete().in("id", Object.values(titles));
  });

  it("shows a friends-shared good word to friends, and to nobody else (F16.2, F16.6 rule 1)", async () => {
    const ferry = titles["The Night Ferry"];
    expect(await put(people.jonah, ferry, [], true)).toBe("created");
    expect(await seenBy(people.priya, ferry)).toEqual([people.jonah.id]);
    expect(await seenBy(people.tess, ferry)).toEqual([people.jonah.id]);
    // Mo shares College crew with Jonah but isn't his friend; Bea knows nobody.
    expect(await seenBy(people.mo, ferry)).toEqual([]);
    expect(await seenBy(people.bea, ferry)).toEqual([]);
    // And it's on neither group's list: no group links at all.
    const { data: links } = await admin.from("good_word_groups").select("id").eq("good_word_id", (await admin.from("good_words").select("id").eq("title_id", ferry).single()).data!.id);
    expect(links).toEqual([]);
  });

  it("keeps a good word with everything off on My list only", async () => {
    const moth = titles["Moth Season"];
    expect(await put(people.priya, moth, [], false)).toBe("created");
    expect(await seenBy(people.priya, moth)).toEqual([people.priya.id]);
    expect(await seenBy(people.jonah, moth)).toEqual([]);
  });

  it("hides a narrowed good word from friends who lost access, and brings it back when widened", async () => {
    const lowTide = titles["Low Tide Club"];
    await put(people.jonah, lowTide, [], true);
    expect(await seenBy(people.priya, lowTide)).toEqual([people.jonah.id]);
    // Jonah narrows to College crew only: Priya (his friend, not in it) loses it; Mo (in it) gains it.
    expect((await people.jonah.client.rpc("set_good_word_audience", { p_title: lowTide, p_groups: [crew], p_friends: false })).data).toBe("updated");
    expect(await seenBy(people.priya, lowTide)).toEqual([]);
    expect(await seenBy(people.mo, lowTide)).toEqual([people.jonah.id]);
    // Widening again restores it.
    await people.jonah.client.rpc("set_good_word_audience", { p_title: lowTide, p_groups: [crew], p_friends: true });
    expect(await seenBy(people.priya, lowTide)).toEqual([people.jonah.id]);
  });

  it("leaves existing good words exactly as visible as before (F16.10)", async () => {
    const heist = titles["Grandma's Heist"];
    // Put in the way the app does without the flag: no friends argument.
    expect(await put(people.tess, heist, [])).toBe("created");
    expect(await seenBy(people.priya, heist)).toEqual([]);
    // Editing it without the flag doesn't share it either.
    expect(await put(people.tess, heist, [])).toBe("updated");
    expect(await seenBy(people.priya, heist)).toEqual([]);
    const { data } = await admin.from("good_words").select("friends_shared_at").eq("title_id", heist).eq("user_id", people.tess.id).single();
    expect(data!.friends_shared_at).toBeNull();
  });

  it("keeps the first friends-share time, and editing without friends doesn't change it", async () => {
    const ferry = titles["The Night Ferry"];
    const first = (await admin.from("good_words").select("friends_shared_at").eq("title_id", ferry).eq("user_id", people.jonah.id).single()).data!
      .friends_shared_at;
    await put(people.jonah, ferry, [], true);
    await put(people.jonah, ferry, []);
    const after = (await admin.from("good_words").select("friends_shared_at").eq("title_id", ferry).eq("user_id", people.jonah.id).single()).data!
      .friends_shared_at;
    expect(after).toBe(first);
  });

  it("restores friends sharing exactly after Undo", async () => {
    const ferry = titles["The Night Ferry"];
    const { data: before } = await admin.from("good_words").select("friends_shared_at, created_at").eq("title_id", ferry).eq("user_id", people.jonah.id).single();
    await people.jonah.client.rpc("take_back_good_word", { p_title: ferry });
    expect(await seenBy(people.priya, ferry)).toEqual([]);
    const { data } = await people.jonah.client.rpc("restore_good_word", {
      p_title: ferry,
      p_note: "ep 3 is where it gets you",
      p_source: "organic",
      p_created_at: before!.created_at,
      p_groups: [],
      p_shared_at: [],
      p_friends_shared_at: before!.friends_shared_at,
    });
    expect(data).toBe("restored");
    expect(await seenBy(people.priya, ferry)).toEqual([people.jonah.id]);
    const { data: after } = await admin.from("good_words").select("friends_shared_at").eq("title_id", ferry).eq("user_id", people.jonah.id).single();
    expect(new Date(after!.friends_shared_at as string).getTime()).toBe(new Date(before!.friends_shared_at as string).getTime());
  });

  it("removes access both ways when a friend is removed (F16.6)", async () => {
    const ferry = titles["The Night Ferry"];
    await people.priya.client.rpc("remove_friend", { p_user: people.jonah.id });
    expect(await seenBy(people.priya, ferry)).toEqual([]);
    await befriend(people.priya, people.jonah);
    expect(await seenBy(people.priya, ferry)).toEqual([people.jonah.id]);
  });

  it("only answers can_view_good_word for the person asking", async () => {
    const ferry = titles["The Night Ferry"];
    const { data: gw } = await admin.from("good_words").select("id").eq("title_id", ferry).eq("user_id", people.jonah.id).single();
    expect((await people.priya.client.rpc("can_view_good_word", { p_viewer: people.priya.id, p_good_word: gw!.id })).data).toBe(true);
    // Bea can't ask about Priya.
    expect((await people.bea.client.rpc("can_view_good_word", { p_viewer: people.priya.id, p_good_word: gw!.id })).data).toBe(false);
    expect((await createClient(url!, anon!).rpc("can_view_good_word", { p_viewer: people.priya.id, p_good_word: gw!.id })).error).not.toBeNull();
  });

  it("records an import's friends audience (F15.1, F16.2)", async () => {
    const hash = "a".repeat(63) + "1";
    const { data, error } = await people.tess.client.rpc("start_import", { p_method: "text", p_hash: hash, p_groups: [], p_friends: true });
    expect(error).toBeNull();
    const id = (data as Array<{ import_id: string }>)[0].import_id;
    const { data: row } = await people.tess.client.from("imports").select("share_with_friends").eq("id", id).single();
    expect(row!.share_with_friends).toBe(true);
    // Without the argument (the app without the flag), it stays off.
    const { data: plain } = await people.tess.client.rpc("start_import", { p_method: "text", p_hash: "b".repeat(64), p_groups: [] });
    const { data: plainRow } = await people.tess.client.from("imports").select("share_with_friends").eq("id", (plain as Array<{ import_id: string }>)[0].import_id).single();
    expect(plainRow!.share_with_friends).toBe(false);
  });
});
