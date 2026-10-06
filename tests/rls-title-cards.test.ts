import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The one card query under row-level security (PRD F16.11 guardrails 2, 3,
// and 9): title_cards only ever returns what the person asking can see, in
// every scope. Invented people and titles only. Skipped without the env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };
type Card = { title: string; vouchers: Array<{ user_id: string; name: string; note: string | null }>; is_new: boolean; group_ids: string[] | null; friends: boolean | null };

describe.skipIf(!enabled)("row-level security: title_cards", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  const titles: Record<string, string> = {};
  let crew = "";
  let girls = "";

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-cards-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    await admin.from("profiles").update({ display_name: name[0].toUpperCase() + name.slice(1), onboarded_at: new Date().toISOString() }).eq("user_id", created.data.user.id);
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const verified = await client.auth.verifyOtp({ type: "email", token_hash: link.data.properties.hashed_token });
    if (verified.error) throw verified.error;
    return { id: created.data.user.id, client };
  }

  async function group(owner: User, name: string, members: User[]) {
    const id = randomUUID();
    await owner.client.rpc("create_group", { p_id: id, p_name: name, p_color: 1 });
    const { data } = await admin.from("invites").select("code").eq("group_id", id).is("revoked_at", null).single();
    for (const m of members) await m.client.rpc("join_group", { p_code: data!.code });
    return id;
  }

  async function put(user: User, title: string, groups: string[], friends?: boolean) {
    const args: Record<string, unknown> = { p_title: titles[title], p_note: `${title} note`, p_groups: groups, p_source: "organic" };
    if (friends !== undefined) args.p_friends = friends;
    const { error } = await user.client.rpc("put_good_word", args);
    if (error) throw error;
  }

  async function cards(user: User, scope: string, extra: Record<string, string> = {}): Promise<Card[]> {
    const { data, error } = await user.client.rpc("title_cards", { p_scope: scope, ...extra });
    if (error) throw error;
    return data as Card[];
  }

  const summary = (list: Card[]) => list.map((c) => `${c.title}: ${c.vouchers.map((v) => v.name).join(", ")}`).sort();

  beforeAll(async () => {
    // College crew: Priya, Jonah, Tess. The girls: Tess, Bea. Priya and Mo are friends.
    for (const name of ["priya", "jonah", "tess", "mo", "bea"]) people[name] = await signInAs(name);
    crew = await group(people.priya, "College crew", [people.jonah, people.tess]);
    girls = await group(people.tess, "The girls", [people.bea]);
    const { data: code } = await people.priya.client.rpc("my_friend_link");
    await people.mo.client.rpc("accept_friend_link", { p_code: code });
    const names = ["The Night Ferry", "Low Tide Club", "Grandma's Heist", "Moth Season"];
    const { data } = await admin
      .from("titles")
      .insert(names.map((title, i) => ({ tmdb_id: base + i, media_type: "tv", title, year: 2024, genres: [], accent: "plum" })))
      .select("id, title");
    for (const row of data!) titles[row.title as string] = row.id as string;

    await put(people.jonah, "The Night Ferry", [crew]);
    await put(people.tess, "The Night Ferry", [crew, girls]);
    await put(people.bea, "Low Tide Club", [girls]);
    await put(people.priya, "Grandma's Heist", [], true); // friends only
    await put(people.priya, "Moth Season", []); // only her
  }, 90_000);

  afterAll(async () => {
    await admin.from("groups").delete().in("owner_id", Object.values(people).map((p) => p.id));
    for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
    await admin.from("titles").delete().in("id", Object.values(titles));
  });

  it("builds a group's list from that group only, one card per title", async () => {
    expect(summary(await cards(people.priya, "group", { p_group: crew }))).toEqual(["The Night Ferry: Tess, Jonah"]);
    expect(summary(await cards(people.tess, "group", { p_group: girls }))).toEqual(["Low Tide Club: Bea", "The Night Ferry: Tess"]);
  });

  it("returns nothing for a group you're not in", async () => {
    expect(await cards(people.bea, "group", { p_group: crew })).toEqual([]);
    expect(await cards(people.mo, "group", { p_group: girls })).toEqual([]);
  });

  it("merges all your groups with each person once (All groups)", async () => {
    expect(summary(await cards(people.tess, "groups"))).toEqual(["Low Tide Club: Bea", "The Night Ferry: Tess, Jonah"]);
    // Friends-only good words are never on a group list.
    expect(summary(await cards(people.mo, "groups"))).toEqual([]);
  });

  it("shows My list with groups and friends, and only your own", async () => {
    const mine = await cards(people.priya, "mine");
    expect(summary(mine)).toEqual(["Grandma's Heist: Priya", "Moth Season: Priya"]);
    expect(mine.find((c) => c.title === "Grandma's Heist")).toMatchObject({ group_ids: [], friends: true });
    expect(mine.find((c) => c.title === "Moth Season")).toMatchObject({ group_ids: [], friends: false });
  });

  it("shows a person's good words you can see, and nothing else of theirs", async () => {
    // Bea sees Tess's good word through The girls; Jonah's is in College crew, which Bea isn't in.
    expect(summary(await cards(people.bea, "person", { p_person: people.tess.id }))).toEqual(["The Night Ferry: Tess"]);
    expect(await cards(people.bea, "person", { p_person: people.jonah.id })).toEqual([]);
    // Mo, Priya's friend, sees her friends-only good word but not her private one.
    expect(summary(await cards(people.mo, "person", { p_person: people.priya.id }))).toEqual(["Grandma's Heist: Priya"]);
    // Jonah shares a group with Priya but isn't her friend: neither.
    expect(await cards(people.jonah, "person", { p_person: people.priya.id })).toEqual([]);
  });

  it("marks New only for someone else's good word since you last looked", async () => {
    await admin.from("group_members").update({ last_viewed_at: new Date(Date.now() - 86_400_000).toISOString() }).eq("user_id", people.priya.id);
    const list = await cards(people.priya, "group", { p_group: crew });
    expect(list.find((c) => c.title === "The Night Ferry")?.is_new).toBe(true);
    await admin.from("group_members").update({ last_viewed_at: new Date(Date.now() + 60_000).toISOString() }).eq("user_id", people.priya.id);
    expect((await cards(people.priya, "group", { p_group: crew })).find((c) => c.title === "The Night Ferry")?.is_new).toBe(false);
  });

  it("isn't callable signed out", async () => {
    const { error } = await createClient(url!, anon!).rpc("title_cards", { p_scope: "groups" });
    expect(error).not.toBeNull();
  });
});
