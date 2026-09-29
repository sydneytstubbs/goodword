import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Email preferences and what the email job sees (PRD F7, 8), against the
// real project. Priya owns College crew (Jonah, Tess); Bea owns The girls,
// which Priya isn't in. Addresses are @example.com, which the sender never
// mails, and every due-list call is limited to these people so real
// accounts are never touched. Invented people and titles only. Skipped
// without the Supabase env vars. Needs the step 7 migration applied.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };
type DigestGroup = { id: string; name: string; total: number; titles: Array<{ title: string; vouchers: string[]; note: string | null }>; comments: number };
type Digest = { good_words: number; groups: DigestGroup[] } | null;
type MentionRow = { user_id: string; group_id: string; item_ids: string[]; comments: Array<{ id: string; body: string | null; is_spoiler: boolean }> };

describe.skipIf(!enabled)("email: preferences and due lists", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 910_000_000 + Math.floor(Math.random() * 80_000_000);
  let ferry = "";
  let moth = "";
  let crew = "";
  let girls = "";
  const only = () => Object.values(people).map((p) => p.id);

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    await admin
      .from("profiles")
      .update({ display_name: name[0].toUpperCase() + name.slice(1), onboarded_at: new Date().toISOString(), timezone: "America/New_York" })
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

  async function vouch(user: User, title: string, groups: string[], note: string | null = null) {
    const { error } = await user.client.rpc("put_good_word", { p_title: title, p_note: note, p_groups: groups, p_source: "organic" });
    if (error) throw error;
  }

  async function post(user: User, group: string, title: string, body: string, spoiler = false) {
    const id = randomUUID();
    const { data, error } = await user.client.rpc("post_comment", { p_id: id, p_group: group, p_title: title, p_body: body, p_spoiler: spoiler });
    if (error) throw error;
    expect(data).toBe("created");
    return id;
  }

  async function digestFor(user: User): Promise<Digest> {
    const { data, error } = await admin.rpc("digest_content", { p_user: user.id });
    if (error) throw error;
    return data as Digest;
  }

  async function mentionsDue(): Promise<MentionRow[]> {
    const { data, error } = await admin.rpc("email_mentions_due", { p_window: "0 minutes", p_only: only() });
    if (error) throw error;
    return data as MentionRow[];
  }

  beforeAll(async () => {
    for (const name of ["priya", "jonah", "tess", "bea"]) people[name] = await signInAs(name);
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
    girls = await createGroup(people.bea, "The girls");
    await joinGroup(people.jonah, crew);
    await joinGroup(people.tess, crew);
    await vouch(people.jonah, ferry, [crew], "ep 3 is where it gets you");
    await vouch(people.tess, ferry, [crew]);
    await vouch(people.bea, moth, [girls], "only for The girls");
  }, 90_000);

  afterAll(async () => {
    const ids = only();
    await admin.from("good_words").delete().in("user_id", ids);
    await admin.from("groups").delete().in("owner_id", ids);
    await admin.from("titles").delete().in("tmdb_id", [base, base + 1]);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("gives everyone preferences with every email on", async () => {
    const { data } = await people.priya.client.from("notification_prefs").select("digest, mention_email, group_joins").single();
    expect(data).toEqual({ digest: true, mention_email: true, group_joins: true });
  });

  it("lets you read and change only your own preferences", async () => {
    const { data: others } = await people.priya.client.from("notification_prefs").select("user_id");
    expect(others?.map((r) => r.user_id)).toEqual([people.priya.id]);

    const { data: ok } = await people.jonah.client.rpc("set_notification_pref", { p_key: "group_joins", p_on: false });
    expect(ok).toBe(true);
    const { data: jonah } = await people.jonah.client.from("notification_prefs").select("group_joins").single();
    expect(jonah?.group_joins).toBe(false);

    const { data: bad } = await people.jonah.client.rpc("set_notification_pref", { p_key: "user_id", p_on: false });
    expect(bad).toBe(false);
    const direct = await people.jonah.client.from("notification_prefs").update({ digest: false }).eq("user_id", people.jonah.id).select();
    expect(direct.data ?? []).toEqual([]);
  });

  it("keeps the email job's functions and log from signed-in people", async () => {
    for (const fn of ["digest_content", "email_digests_due", "email_mentions_due", "email_joins_due", "claim_email_items", "run_email_job", "send_test_digest", "email_job_secret"]) {
      const { error } = await people.priya.client.rpc(fn, fn === "digest_content" ? { p_user: people.jonah.id } : {});
      expect(error, fn).not.toBeNull();
    }
    const { data } = await people.priya.client.from("notification_log").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("builds a digest from other people's good words in your groups only", async () => {
    const digest = await digestFor(people.priya);
    expect(digest?.good_words).toBe(2);
    expect(digest?.groups.map((g) => g.name)).toEqual(["College crew"]);
    const titles = digest!.groups[0].titles;
    expect(titles.map((t) => t.title)).toEqual(["The Night Ferry"]);
    expect(titles[0].vouchers.sort()).toEqual(["Jonah", "Tess"]);
    expect(titles[0].note).toBe("ep 3 is where it gets you");
    // Nothing from The girls, which Priya isn't in.
    expect(JSON.stringify(digest)).not.toContain("only for The girls");
  });

  it("sends no digest when only you put in good words", async () => {
    expect(await digestFor(people.bea)).toBeNull();
  });

  it("finds this week's digest only when it's due, and a forced one any time", async () => {
    const forced = await admin.rpc("email_digests_due", { p_only: [people.priya.id], p_force: true });
    expect(forced.error).toBeNull();
    expect((forced.data as Array<{ user_id: string }>).map((r) => r.user_id)).toEqual([people.priya.id]);
    const unforcedAll = await admin.rpc("email_digests_due", { p_only: null, p_force: true });
    expect(unforcedAll.data).toEqual([]);

    const { data: slot } = await admin.rpc("digest_slot", { p_tz: "America/New_York", p_at: "2026-10-01T21:30:00Z" });
    expect(slot).toBe("2026-10-01"); // Thursday 5:30pm in New York
    const { data: early } = await admin.rpc("digest_slot", { p_tz: "America/New_York", p_at: "2026-10-01T20:30:00Z" });
    expect(early).toBeNull(); // 4:30pm: last week's slot has passed its 24 hours
    const { data: quiet } = await admin.rpc("email_quiet", { p_tz: "America/New_York", p_at: "2026-10-02T02:00:00Z" });
    expect(quiet).toBe(true); // 10pm
  });

  it("summarizes conversations in the digest without any comment text", async () => {
    await post(people.jonah, crew, ferry, "the lighthouse scene", true);
    const digest = await digestFor(people.priya);
    expect(digest!.groups[0].comments).toBe(1);
    expect(JSON.stringify(digest)).not.toContain("lighthouse");
  });

  it("emails a mention once, without spoiler text, and not once it's read", async () => {
    const plain = await post(people.jonah, crew, moth, `<@${people.tess.id}> you'd love this`);
    const spoiler = await post(people.jonah, crew, moth, `<@${people.tess.id}> the heist fails`, true);
    const due = (await mentionsDue()).filter((r) => r.user_id === people.tess.id);
    expect(due).toHaveLength(1);
    expect(due[0].comments.map((c) => c.id)).toEqual([plain, spoiler]);
    expect(due[0].comments[0].body).toContain("@Tess");
    expect(due[0].comments[1].body).toBeNull();
    expect(JSON.stringify(due)).not.toContain("heist fails");

    // Opening the conversation first means no email.
    const { error } = await people.tess.client.rpc("mark_conversation_read", { p_group: crew, p_title: moth, p_up_to: new Date().toISOString() });
    expect(error).toBeNull();
    expect((await mentionsDue()).filter((r) => r.user_id === people.tess.id)).toEqual([]);
  });

  it("claims a batch once, and releases it for a retry", async () => {
    await post(people.tess, crew, ferry, `<@${people.jonah.id}> see this`);
    const due = (await mentionsDue()).filter((r) => r.user_id === people.jonah.id);
    expect(due).toHaveLength(1);
    const ids = due[0].item_ids;
    expect((await admin.rpc("claim_email_items", { p_ids: ids })).data).toBe(true);
    expect((await admin.rpc("claim_email_items", { p_ids: ids })).data).toBe(false);
    expect((await mentionsDue()).filter((r) => r.user_id === people.jonah.id)).toEqual([]);
    await admin.rpc("release_email_items", { p_ids: ids });
    expect((await mentionsDue()).filter((r) => r.user_id === people.jonah.id)).toHaveLength(1);
  });

  it("doesn't email a mention after mention emails are turned off", async () => {
    await people.jonah.client.rpc("set_notification_pref", { p_key: "mention_email", p_on: false });
    expect((await mentionsDue()).filter((r) => r.user_id === people.jonah.id)).toEqual([]);
  });

  it("tells owners who joined, respecting the preference", async () => {
    const { data, error } = await admin.rpc("email_joins_due", { p_only: only() });
    expect(error).toBeNull();
    const rows = data as Array<{ user_id: string; joins: Array<{ name: string; group_name: string }> }>;
    // Priya is the owner, so only she hears; outside quiet hours only.
    const { data: quietNow } = await admin.rpc("email_quiet", { p_tz: "America/New_York" });
    if (quietNow) {
      expect(rows).toEqual([]);
    } else {
      const priya = rows.find((r) => r.user_id === people.priya.id);
      expect(priya?.joins.map((j) => j.name).sort()).toEqual(["Jonah", "Tess"]);
    }
    expect(rows.find((r) => r.user_id === people.jonah.id)).toBeUndefined();
  });
});
