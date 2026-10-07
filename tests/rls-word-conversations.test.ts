import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Conversations under a good word, under row-level security, against the
// real project (PRD F16.5, F16.6 rules 2 and 4, open questions 14 and 16).
// Invented people and titles only. Skipped without the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("row-level security: conversations under a good word", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  let ferry = "";
  let lowTide = "";
  let crew = "";
  const words: Record<string, string> = {};

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-words-${run}@example.com`;
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

  async function comment(user: User, word: string, body: string) {
    const id = randomUUID();
    const { data, error } = await user.client.rpc("post_word_comment", { p_id: id, p_good_word: word, p_body: body, p_spoiler: false });
    if (error) throw error;
    return { id, status: data as string };
  }

  async function read(user: User, word: string): Promise<Array<{ id: string; user_id: string; body: string }>> {
    const { data, error } = await user.client.rpc("word_comments", { p_good_word: word });
    if (error) throw error;
    return data;
  }

  beforeAll(async () => {
    // Priya, Jonah, and Tess are all friends. Mo is Jonah's friend only. Bea
    // knows nobody. Luis is in College crew with Jonah, and nobody's friend.
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
    // Jonah's Low Tide Club is in College crew only.
    words.jonahGroupOnly = await vouch(people.jonah, lowTide, false, [crew]);
  }, 120_000);

  afterAll(async () => {
    await admin.from("groups").delete().in("owner_id", Object.values(people).map((p) => p.id));
    for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
    await admin.from("titles").delete().in("id", [ferry, lowTide]);
  });

  it("lets friends talk under each other's good words", async () => {
    expect((await comment(people.tess, words.jonah, "the lighthouse bit")).status).toBe("created");
    expect((await comment(people.priya, words.jonah, "agreed")).status).toBe("created");
    for (const name of ["priya", "jonah", "tess"]) {
      expect((await read(people[name], words.jonah)).map((c) => c.body)).toEqual(["the lighthouse bit", "agreed"]);
    }
  });

  it("shows Mo, Jonah's friend only, everything under Jonah's good word, including Priya's comment, and nothing under Priya's", async () => {
    expect((await read(people.mo, words.jonah)).map((c) => c.user_id)).toContain(people.priya.id);
    await comment(people.jonah, words.priya, "ep 3");
    expect(await read(people.mo, words.priya)).toEqual([]);
    expect((await people.mo.client.rpc("word_conversation_state", { p_good_word: words.priya })).data).toEqual([]);
    expect((await comment(people.mo, words.priya, "hi")).status).toBe("not_visible");
    expect((await people.mo.client.rpc("can_hear", { p_topic: `word:${words.priya}` })).data).toBe(false);
    expect((await people.mo.client.rpc("can_hear", { p_topic: `word:${words.jonah}` })).data).toBe(true);
  });

  it("leaks nothing to someone who can't see the good word, by function or by table", async () => {
    expect(await read(people.bea, words.jonah)).toEqual([]);
    const { data: rows } = await people.bea.client.from("comments").select("id").eq("title_id", ferry);
    expect(rows).toEqual([]);
    const { data: conversations } = await people.bea.client.from("conversations").select("id").eq("title_id", ferry);
    expect(conversations).toEqual([]);
    // Bea sees the conversation under her own good word, and only that.
    await comment(people.bea, words.bea, "nobody here yet");
    const { data: own } = await people.bea.client.from("conversations").select("good_word_id").eq("title_id", ferry);
    expect(own).toEqual([{ good_word_id: words.bea }]);
  });

  it("counts on Home only the comments you can see", async () => {
    const count = async (user: User) =>
      ((await user.client.rpc("home_conversations", { p_titles: [ferry] })).data as Array<{ comment_count: number }>)[0]?.comment_count ?? 0;
    // Mo sees Jonah's conversation only; Bea sees her own only.
    expect(await count(people.mo)).toBe((await read(people.mo, words.jonah)).length);
    expect(await count(people.bea)).toBe(1);
  });

  it("gives a good word shared only into groups no conversation of its own (question 14)", async () => {
    expect((await comment(people.luis, words.jonahGroupOnly, "hello")).status).toBe("not_visible");
    expect(await read(people.luis, words.jonahGroupOnly)).toEqual([]);
  });

  it("keeps mentions to people who can see the good word, and never reveals a stranger's name", async () => {
    const kept = await comment(people.mo, words.jonah, `<@${people.priya.id}> good call`);
    const dropped = await comment(people.mo, words.jonah, `<@${people.bea.id}> you'd like this`);
    const { data: mentions } = await admin.from("comment_mentions").select("comment_id, mentioned_user_id").in("comment_id", [kept.id, dropped.id]);
    expect(mentions).toEqual([{ comment_id: kept.id, mentioned_user_id: people.priya.id }]);
    const { data: body } = await admin.from("comments").select("body").eq("id", dropped.id).single();
    expect(body!.body).toBe("@ you'd like this");
  });

  it("suggests only people you already know who can see it", async () => {
    // Mo knows Jonah; he's seen Priya and Tess comment there; Bea can't see it.
    const { data } = await people.mo.client.rpc("word_mention_people", { p_good_word: words.jonah });
    expect((data as Array<{ name: string }>).map((p) => p.name).sort()).toEqual(["Jonah", "Priya", "Tess"]);
    // Luis can't see Jonah's friends-only good word at all.
    expect((await people.luis.client.rpc("word_mention_people", { p_good_word: words.jonah })).data).toEqual([]);
  });

  it("tells the good word's author in Activity, and mentioned people once", async () => {
    const { data } = await people.jonah.client.rpc("my_activity");
    const items = (data as Array<{ type: string; good_word_id: string | null; actor_id: string }>).filter((a) => a.good_word_id === words.jonah);
    expect(items.filter((a) => a.type === "comment").map((a) => a.actor_id)).toEqual(expect.arrayContaining([people.tess.id, people.priya.id, people.mo.id]));
    const { data: priya } = await people.priya.client.rpc("my_activity");
    const mentions = (priya as Array<{ type: string; good_word_id: string | null }>).filter((a) => a.type === "mention" && a.good_word_id === words.jonah);
    expect(mentions).toHaveLength(1);
  });

  it("lets only the comment's author and the good word's author delete it (question 16)", async () => {
    const mine = await comment(people.mo, words.jonah, "delete me");
    expect((await people.tess.client.rpc("delete_comment", { p_id: mine.id })).data).toBe(false);
    expect((await people.jonah.client.rpc("delete_comment", { p_id: mine.id })).data).toBe(true);
    expect((await read(people.mo, words.jonah)).map((c) => c.id)).not.toContain(mine.id);
    expect((await people.jonah.client.rpc("restore_comment", { p_id: mine.id })).data).toBe(true);
    const own = await comment(people.mo, words.jonah, "mine to delete");
    expect((await people.mo.client.rpc("delete_comment", { p_id: own.id })).data).toBe(true);
  });

  it("hides the conversation when the good word stops being shared with friends, and brings it back", async () => {
    await people.jonah.client.rpc("set_good_word_audience", { p_title: ferry, p_groups: [], p_friends: false });
    expect(await read(people.mo, words.jonah)).toEqual([]);
    await people.jonah.client.rpc("set_good_word_audience", { p_title: ferry, p_groups: [], p_friends: true });
    expect((await read(people.mo, words.jonah)).length).toBeGreaterThan(0);
  });

  it("keeps the comments through taking a good word back and Undo", async () => {
    const before = (await read(people.priya, words.jonah)).length;
    const { data: snapshot } = await admin.from("good_words").select("created_at, friends_shared_at").eq("id", words.jonah).single();
    await people.jonah.client.rpc("take_back_good_word", { p_title: ferry });
    const { data: restored, error } = await people.jonah.client.rpc("restore_good_word", {
      p_title: ferry,
      p_note: null,
      p_source: "organic",
      p_created_at: snapshot!.created_at,
      p_groups: [],
      p_shared_at: [],
      p_friends_shared_at: snapshot!.friends_shared_at,
    });
    if (error) throw error;
    expect(restored).toBe("restored");
    const { data: again } = await admin.from("good_words").select("id").eq("user_id", people.jonah.id).eq("title_id", ferry).single();
    words.jonah = again!.id;
    expect(await read(people.priya, words.jonah)).toHaveLength(before);
  });

  it("ends access both ways when friends are removed", async () => {
    await people.priya.client.rpc("remove_friend", { p_user: people.jonah.id });
    expect(await read(people.priya, words.jonah)).toEqual([]);
    expect(await read(people.jonah, words.priya)).toEqual([]);
  });

  it("isn't callable signed out", async () => {
    const signedOut = createClient(url!, anon!);
    expect((await signedOut.rpc("word_comments", { p_good_word: words.tess })).error).not.toBeNull();
    expect((await signedOut.rpc("post_word_comment", { p_id: randomUUID(), p_good_word: words.tess, p_body: "x", p_spoiler: false })).error).not.toBeNull();
  });
});
