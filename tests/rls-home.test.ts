import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Home under row-level security, against the real project (PRD F16.3 and
// its acceptance criteria, F16.6). Invented people and titles only. Skipped
// without the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };
type Card = { title: string; vouchers: Array<{ user_id: string; name: string; note: string | null }>; is_new: boolean; via_group: string | null };

describe.skipIf(!enabled)("row-level security: Home", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  const titles: Record<string, string> = {};
  let crew = "";

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-home-${run}@example.com`;
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

  async function put(user: User, title: string, note: string | null, groups: string[], friends: boolean, source = "organic") {
    const { error } = await user.client.rpc("put_good_word", { p_title: titles[title], p_note: note, p_groups: groups, p_source: source, p_friends: friends });
    if (error) throw error;
  }

  async function home(user: User): Promise<Card[]> {
    const { data, error } = await user.client.rpc("title_cards", { p_scope: "home" });
    if (error) throw error;
    return data as Card[];
  }

  const names = (card: Card | undefined) => card?.vouchers.map((v) => v.name);

  beforeAll(async () => {
    // Priya is friends with Jonah, Tess, and Luis. Mo is in College crew with
    // Jonah and Priya but is nobody's friend. Bea knows nobody.
    for (const name of ["priya", "jonah", "tess", "mo", "luis", "bea"]) people[name] = await signInAs(name);
    await befriend(people.priya, people.jonah);
    await befriend(people.priya, people.tess);
    await befriend(people.priya, people.luis);
    crew = randomUUID();
    await people.jonah.client.rpc("create_group", { p_id: crew, p_name: "College crew", p_color: 1 });
    const { data: invite } = await admin.from("invites").select("code").eq("group_id", crew).is("revoked_at", null).single();
    await people.priya.client.rpc("join_group", { p_code: invite!.code });
    await people.mo.client.rpc("join_group", { p_code: invite!.code });
    const list = ["The Night Ferry", "Low Tide Club", "Grandma's Heist", "Moth Season"];
    const { data } = await admin
      .from("titles")
      .insert(list.map((title, i) => ({ tmdb_id: base + i, media_type: "tv", title, year: 2024, genres: [], accent: "plum" })))
      .select("id, title");
    for (const row of data!) titles[row.title as string] = row.id as string;

    await put(people.jonah, "The Night Ferry", "the ferry scene", [], true);
    await new Promise((r) => setTimeout(r, 50));
    await put(people.tess, "The Night Ferry", "ep 3 is where it gets you", [], true);
    await put(people.jonah, "Low Tide Club", "college crew only", [crew], false);
    await put(people.priya, "Moth Season", null, [], true);
  }, 90_000);

  afterAll(async () => {
    await admin.from("imports").delete().eq("user_id", people.luis.id);
    await admin.from("groups").delete().in("owner_id", Object.values(people).map((p) => p.id));
    for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
    await admin.from("titles").delete().in("id", Object.values(titles));
  });

  it("shows one card per title naming everyone, with the newest note first", async () => {
    const cards = await home(people.priya);
    const ferry = cards.find((c) => c.title === "The Night Ferry");
    expect(names(ferry)).toEqual(["Tess", "Jonah"]);
    expect(ferry!.vouchers[0].note).toBe("ep 3 is where it gets you");
    expect(ferry!.via_group).toBeNull();
  });

  it("never shows a title only you vouched for", async () => {
    expect((await home(people.priya)).map((c) => c.title)).not.toContain("Moth Season");
  });

  it("leaves a group-only good word off a friend's Home, and chips it for the group's members", async () => {
    // Jonah shared Low Tide Club only with College crew. Priya is in it too, so she sees it with the chip;
    // Luis (Jonah's friend? no: Priya's) never does, and Mo (in the crew, nobody's friend) sees it with the chip.
    expect((await home(people.luis)).map((c) => c.title)).not.toContain("Low Tide Club");
    const moCard = (await home(people.mo)).find((c) => c.title === "Low Tide Club");
    expect(moCard?.via_group).toBe(crew);
    // Mo isn't a friend of Jonah or Tess, so their friends-only Night Ferry never reaches him.
    expect((await home(people.mo)).map((c) => c.title)).not.toContain("The Night Ferry");
  });

  it("shows nothing to someone who knows nobody", async () => {
    expect(await home(people.bea)).toEqual([]);
  });

  it("marks New only after your last visit", async () => {
    await admin.from("profiles").update({ home_viewed_at: new Date(Date.now() - 3_600_000).toISOString() }).eq("user_id", people.priya.id);
    expect((await home(people.priya)).find((c) => c.title === "The Night Ferry")?.is_new).toBe(true);
    await people.priya.client.rpc("mark_home_viewed");
    expect((await home(people.priya)).find((c) => c.title === "The Night Ferry")?.is_new).toBe(false);
  });

  it("keeps imports quiet: no card each, one roll-up line counting only what you can see", async () => {
    // Luis imports Grandma's Heist (friends) and Moth Season (only him).
    const { data: imp } = await admin
      .from("imports")
      .insert({ user_id: people.luis.id, method: "text", input_hash: "c".repeat(64), status: "done", share_with_friends: true })
      .select("id")
      .single();
    await put(people.luis, "Grandma's Heist", null, [], true, "import");
    await put(people.luis, "Moth Season", null, [], false, "import");
    const card = (title: string, i: number) => ({
      import_id: imp!.id,
      user_id: people.luis.id,
      position: i + 1,
      query: title,
      confidence: "high",
      candidates: [{ type: "tv", tmdbId: base, name: title }],
      decision: "added",
      decided_at: new Date().toISOString(),
      added_type: "tv",
      added_tmdb_id: base + Object.keys(titles).indexOf(title),
      created_good_word: true,
    });
    const { error } = await admin.from("import_cards").insert([card("Grandma's Heist", 0), card("Moth Season", 1)]);
    if (error) throw error;

    expect((await home(people.priya)).map((c) => c.title)).not.toContain("Grandma's Heist");
    const { data: rollups } = await people.priya.client.rpc("home_import_rollups");
    expect(rollups).toEqual([expect.objectContaining({ user_id: people.luis.id, name: "Luis", added_count: 1 })]);
    // Someone who can see none of it gets no line at all.
    expect((await people.bea.client.rpc("home_import_rollups")).data).toEqual([]);
    // And your own imports never roll up for you.
    expect((await people.luis.client.rpc("home_import_rollups")).data).toEqual([]);
  });

  it("lists an imported good word on a card someone else made", async () => {
    await put(people.tess, "Grandma's Heist", "the grandma steals it", [], true);
    const heist = (await home(people.priya)).find((c) => c.title === "Grandma's Heist");
    expect(names(heist)).toEqual(expect.arrayContaining(["Tess", "Luis"]));
  });

  it("lets only a person's friends listen for their good words live", async () => {
    // Jonah is Priya's friend; Mo shares a group with Jonah but isn't his friend.
    expect((await people.priya.client.rpc("can_hear", { p_topic: `friends:${people.jonah.id}` })).data).toBe(true);
    expect((await people.mo.client.rpc("can_hear", { p_topic: `friends:${people.jonah.id}` })).data).toBe(false);
    expect((await people.bea.client.rpc("can_hear", { p_topic: `friends:${people.priya.id}` })).data).toBe(false);
    expect((await people.priya.client.rpc("can_hear", { p_topic: "friends:not-a-uuid" })).data).toBe(false);
  });

  it("isn't callable signed out", async () => {
    const signedOut = createClient(url!, anon!);
    expect((await signedOut.rpc("home_import_rollups")).error).not.toBeNull();
    expect((await signedOut.rpc("latest_comments", { p_titles: [] })).error).not.toBeNull();
  });
});
