import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Feedback and account deletion (PRD F1, F11, 8, 10.4), against the real
// project. Priya owns College crew (with Jonah, who joined first, and Tess)
// and Sunday book club (just her). Bea owns The girls, with Priya. Invented
// people and titles only. Skipped without the Supabase env vars. Needs the
// step 8 migration applied.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("settings: feedback and deleting an account", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 920_000_000 + Math.floor(Math.random() * 70_000_000);
  let ferry = "";
  let crew = "";
  let bookClub = "";
  let girls = "";

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    await admin
      .from("profiles")
      .update({ display_name: name[0].toUpperCase() + name.slice(1), onboarded_at: new Date().toISOString() })
      .eq("user_id", created.data.user.id);
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

  beforeAll(async () => {
    for (const name of ["priya", "jonah", "tess", "bea"]) people[name] = await signInAs(name);
    const { data, error } = await admin
      .from("titles")
      .insert({ tmdb_id: base, media_type: "tv", title: "The Night Ferry", accent: "plum" })
      .select("id")
      .single();
    if (error) throw error;
    ferry = data.id;
    crew = await createGroup(people.priya, "College crew");
    bookClub = await createGroup(people.priya, "Sunday book club");
    girls = await createGroup(people.bea, "The girls");
    await joinGroup(people.jonah, crew);
    await joinGroup(people.tess, crew);
    await joinGroup(people.priya, girls);
    const put = await people.priya.client.rpc("put_good_word", { p_title: ferry, p_note: "ep 3 is where it gets you", p_groups: [crew, bookClub, girls], p_source: "organic" });
    if (put.error) throw put.error;
    const comment = await people.priya.client.rpc("post_comment", { p_id: randomUUID(), p_group: crew, p_title: ferry, p_body: "the lighthouse", p_spoiler: false });
    if (comment.error) throw comment.error;
  }, 90_000);

  afterAll(async () => {
    const ids = Object.values(people).map((p) => p.id);
    await admin.from("good_words").delete().in("user_id", ids);
    await admin.from("groups").delete().in("owner_id", ids);
    await admin.from("titles").delete().eq("tmdb_id", base);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("stores feedback, and nobody can read it back", async () => {
    const id = randomUUID();
    const { data } = await people.tess.client.rpc("send_feedback", { p_id: id, p_message: "Love the shelf", p_may_contact: true });
    expect(data).toBe("sent");
    // A retry with the same id doesn't duplicate it.
    await people.tess.client.rpc("send_feedback", { p_id: id, p_message: "Love the shelf", p_may_contact: true });
    const { data: stored } = await admin.from("feedback").select("message, may_contact").eq("user_id", people.tess.id);
    expect(stored).toEqual([{ message: "Love the shelf", may_contact: true }]);
    const { data: readBack } = await people.tess.client.from("feedback").select("id");
    expect(readBack ?? []).toEqual([]);
    const { data: empty } = await people.tess.client.rpc("send_feedback", { p_id: randomUUID(), p_message: "   ", p_may_contact: false });
    expect(empty).toBe("empty");
  });

  it("limits feedback to 10 a day", async () => {
    const results: string[] = [];
    for (let i = 0; i < 11; i++) {
      const { data } = await people.jonah.client.rpc("send_feedback", { p_id: randomUUID(), p_message: `note ${i}`, p_may_contact: false });
      results.push(data as string);
    }
    expect(results.slice(0, 10).every((r) => r === "sent")).toBe(true);
    expect(results[10]).toBe("rate_limited");
  });

  it("keeps account deletion from signed-out callers", async () => {
    const outsider = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await outsider.rpc("prepare_account_deletion");
    expect(error).not.toBeNull();
  });

  it("deleting an account passes groups on, deletes solo groups, and removes everything of theirs", async () => {
    const { error } = await people.priya.client.rpc("prepare_account_deletion");
    expect(error).toBeNull();
    const deleted = await admin.auth.admin.deleteUser(people.priya.id);
    expect(deleted.error).toBeNull();

    // College crew goes to Jonah, who joined before Tess.
    const { data: crewRow } = await admin.from("groups").select("owner_id").eq("id", crew).single();
    expect(crewRow?.owner_id).toBe(people.jonah.id);
    const { data: jonahRole } = await admin.from("group_members").select("role").eq("group_id", crew).eq("user_id", people.jonah.id).single();
    expect(jonahRole?.role).toBe("owner");
    // Sunday book club had only Priya: it's gone.
    const { data: club } = await admin.from("groups").select("id").eq("id", bookClub);
    expect(club).toEqual([]);
    // The girls stays Bea's, without Priya.
    const { data: girlsMembers } = await admin.from("group_members").select("user_id").eq("group_id", girls);
    expect(girlsMembers?.map((m) => m.user_id)).toEqual([people.bea.id]);

    for (const table of ["profiles", "good_words", "comments", "group_members", "notification_prefs", "activity_items"]) {
      const { data } = await admin.from(table).select("user_id").eq("user_id", people.priya.id);
      expect(data, table).toEqual([]);
    }
    const { data: shelf } = await admin.from("good_word_groups").select("group_id").in("group_id", [crew, girls]);
    expect(shelf).toEqual([]);
    delete people.priya;
  });
});
