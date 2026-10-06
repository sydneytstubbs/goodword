import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Good words under row-level security, against the real project (PRD F4, 8;
// CLAUDE.md: never leak across groups, test it explicitly). Priya is in
// College crew with Jonah and in The girls with Tess; Mo is in neither.
// Invented people and titles only. Skipped without the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("row-level security: good words", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  // An invented TMDB id range no real title uses.
  const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  let ferry = "";
  let moth = "";
  let crew = "";
  let girls = "";

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-${run}@example.com`;
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

  async function createGroup(user: User, name: string) {
    const id = randomUUID();
    const { error } = await user.client.rpc("create_group", { p_id: id, p_name: name, p_color: 1 });
    if (error) throw error;
    return id;
  }

  async function joinGroup(user: User, groupId: string) {
    const { data } = await admin.from("invites").select("code").eq("group_id", groupId).is("revoked_at", null).single();
    const { error } = await user.client.rpc("join_group", { p_code: data!.code });
    if (error) throw error;
  }

  async function put(user: User, title: string, note: string | null, groups: string[], source = "organic") {
    const { data, error } = await user.client.rpc("put_good_word", { p_title: title, p_note: note, p_groups: groups, p_source: source });
    if (error) throw error;
    return (data as Array<{ status: string; milestone: string | null }>)[0];
  }

  beforeAll(async () => {
    for (const name of ["priya", "jonah", "tess", "mo"]) people[name] = await signInAs(name);
    const { data, error } = await admin
      .from("titles")
      .insert([
        { tmdb_id: base, media_type: "tv", title: "The Night Ferry", accent: "plum" },
        { tmdb_id: base + 1, media_type: "movie", title: "Moth Season", accent: "clay" },
      ])
      .select("id, title");
    if (error) throw error;
    ferry = data!.find((t) => t.title === "The Night Ferry")!.id;
    moth = data!.find((t) => t.title === "Moth Season")!.id;
    crew = await createGroup(people.priya, "College crew");
    girls = await createGroup(people.priya, "The girls");
    await joinGroup(people.jonah, crew);
    await joinGroup(people.tess, girls);
  }, 60_000);

  afterAll(async () => {
    const ids = Object.values(people).map((p) => p.id);
    await admin.from("good_words").delete().in("user_id", ids);
    await admin.from("groups").delete().in("owner_id", ids);
    await admin.from("titles").delete().in("tmdb_id", [base, base + 1]);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("puts in a good word on every chosen list, and the first one is a milestone once", async () => {
    expect(await put(people.priya, ferry, "  ep 3 is where it gets you ", [crew, girls])).toEqual({ status: "created", milestone: "first" });
    const { data } = await people.priya.client.from("good_words").select("note, source, good_word_groups(group_id)").eq("title_id", ferry).single();
    expect(data!.note).toBe("ep 3 is where it gets you");
    expect(data!.source).toBe("organic");
    expect((data!.good_word_groups as Array<{ group_id: string }>).map((g) => g.group_id).sort()).toEqual([crew, girls].sort());
  });

  it("keeps one good word per person per title: adding it again updates it", async () => {
    expect(await put(people.priya, ferry, "ep 3", [crew, girls])).toEqual({ status: "updated", milestone: null });
    const { data } = await people.priya.client.from("good_words").select("note").eq("title_id", ferry);
    expect(data).toEqual([{ note: "ep 3" }]);
  });

  it("allows zero groups: it lives only on My list", async () => {
    expect((await put(people.priya, moth, "", [])).status).toBe("created");
    const { data } = await people.priya.client.from("good_words").select("note, good_word_groups(group_id)").eq("title_id", moth).single();
    expect(data).toEqual({ note: null, good_word_groups: [] });
  });

  it("refuses lists you're not on", async () => {
    expect((await put(people.jonah, moth, null, [girls])).status).toBe("not_member");
    const { data } = await people.jonah.client.from("good_words").select("id").eq("user_id", people.jonah.id);
    expect(data).toEqual([]);
  });

  it("shows friends only good words shared into their groups, with only their groups' links", async () => {
    const { data: jonahSees } = await people.jonah.client.from("good_words").select("title_id, note");
    expect(jonahSees).toEqual([{ title_id: ferry, note: "ep 3" }]);
    const { data: links } = await people.jonah.client.from("good_word_groups").select("group_id");
    // The girls is never revealed to Jonah, not even its id.
    expect(links).toEqual([{ group_id: crew }]);
  });

  it("shows someone in no shared group nothing at all", async () => {
    const { data: words } = await people.mo.client.from("good_words").select("id");
    const { data: links } = await people.mo.client.from("good_word_groups").select("id");
    expect(words).toEqual([]);
    expect(links).toEqual([]);
  });

  it("never lets anyone write good words or lists directly", async () => {
    const insert = await people.jonah.client.from("good_words").insert({ user_id: people.jonah.id, title_id: moth });
    expect(insert.error).not.toBeNull();
    const { data: mine } = await people.priya.client.from("good_words").select("id").eq("title_id", ferry).single();
    const link = await people.jonah.client.from("good_word_groups").insert({ good_word_id: mine!.id, group_id: crew });
    expect(link.error).not.toBeNull();
    await people.jonah.client.from("good_words").update({ note: "not mine" }).eq("title_id", ferry);
    await people.jonah.client.from("good_words").delete().eq("title_id", ferry);
    const { data } = await admin.from("good_words").select("note").eq("id", mine!.id).single();
    expect(data!.note).toBe("ep 3");
  });

  it("only the author can take a good word back", async () => {
    const { data } = await people.jonah.client.rpc("take_back_good_word", { p_title: ferry });
    expect(data).toBe(false);
    const { count } = await admin.from("good_words").select("id", { count: "exact", head: true }).eq("title_id", ferry);
    expect(count).toBe(1);
  });

  it("edits the note and changes groups", async () => {
    expect((await people.priya.client.rpc("edit_good_word_note", { p_title: ferry, p_note: "the ferry scene" })).data).toBe(true);
    expect((await people.priya.client.rpc("set_good_word_groups", { p_title: ferry, p_groups: [crew] })).data).toBe("updated");
    const { data: tessSees } = await people.tess.client.from("good_words").select("id");
    expect(tessSees).toEqual([]);
    expect((await people.priya.client.rpc("set_good_word_groups", { p_title: ferry, p_groups: [crew, girls] })).data).toBe("updated");
  });

  it("takes a good word back and Undo restores its note, source, dates, and lists exactly", async () => {
    const { data: before } = await people.priya.client
      .from("good_words")
      .select("note, source, created_at, good_word_groups(group_id, shared_at)")
      .eq("title_id", ferry)
      .single();
    expect((await people.priya.client.rpc("take_back_good_word", { p_title: ferry })).data).toBe(true);
    const { data: gone } = await people.jonah.client.from("good_words").select("id");
    expect(gone).toEqual([]);

    const lists = before!.good_word_groups as Array<{ group_id: string; shared_at: string }>;
    const restored = await people.priya.client.rpc("restore_good_word", {
      p_title: ferry,
      p_note: before!.note,
      p_source: before!.source,
      p_created_at: before!.created_at,
      p_groups: lists.map((s) => s.group_id),
      p_shared_at: lists.map((s) => s.shared_at),
    });
    expect(restored.data).toBe("restored");
    const { data: after } = await people.priya.client
      .from("good_words")
      .select("note, source, created_at, good_word_groups(group_id, shared_at)")
      .eq("title_id", ferry)
      .single();
    const byGroup = (rows: unknown) => [...(rows as Array<{ group_id: string }>)].sort((a, b) => a.group_id.localeCompare(b.group_id));
    expect({ ...after, good_word_groups: byGroup(after!.good_word_groups) }).toEqual({
      ...before,
      good_word_groups: byGroup(before!.good_word_groups),
    });
  });

  it("takes a member's good words off a list when they leave, and keeps them on My list", async () => {
    await put(people.tess, ferry, "agree", [girls], "join_prompt");
    const { data: seen } = await people.priya.client.from("good_words").select("user_id").eq("user_id", people.tess.id);
    expect(seen).toHaveLength(1);
    expect((await people.tess.client.rpc("leave_group", { p_group: girls })).data).toBe("left");
    const { data: after } = await people.priya.client.from("good_words").select("user_id").eq("user_id", people.tess.id);
    expect(after).toEqual([]);
    const { data: own } = await people.tess.client.from("good_words").select("note, source, good_word_groups(group_id)");
    expect(own).toEqual([{ note: "agree", source: "join_prompt", good_word_groups: [] }]);
  });

  it("takes a removed member's good words off the list", async () => {
    await put(people.jonah, moth, null, [crew]);
    expect((await people.priya.client.rpc("remove_member", { p_group: crew, p_user: people.jonah.id })).data).toBe(true);
    const { data } = await people.priya.client.from("good_words").select("id").eq("user_id", people.jonah.id);
    expect(data).toEqual([]);
  });

  it("dismisses the first-good-word prompt for one group only", async () => {
    await people.priya.client.rpc("dismiss_join_prompt", { p_group: crew });
    const { data } = await people.priya.client
      .from("group_members")
      .select("group_id, join_prompt_dismissed_at")
      .eq("user_id", people.priya.id);
    const dismissed = Object.fromEntries((data ?? []).map((m) => [m.group_id, m.join_prompt_dismissed_at !== null]));
    expect(dismissed).toEqual({ [crew]: true, [girls]: false });
  });
});
