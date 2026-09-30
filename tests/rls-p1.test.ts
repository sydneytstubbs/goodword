import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The P1 extras (PRD 12, slice 10), against the real project: streaming
// services, share my shelf, who hears a shelf's new good words, and the
// weekend prompt. Priya owns College crew with Jonah; Tess is in no group.
// Invented people and titles only. Skipped without the Supabase env vars.
// Needs the step 10 migration applied.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("P1: services, share my shelf, live shelves, weekend prompt", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 920_000_000 + Math.floor(Math.random() * 70_000_000);
  let ferry = "";
  let heist = "";
  let crew = "";

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

  beforeAll(async () => {
    for (const name of ["priya", "jonah", "tess"]) people[name] = await signInAs(name);
    const { data, error } = await admin
      .from("titles")
      .insert([
        { tmdb_id: base, media_type: "tv", title: "The Night Ferry", accent: "plum" },
        { tmdb_id: base + 1, media_type: "movie", title: "Grandma's Heist", accent: "plum" },
      ])
      .select("id, tmdb_id");
    if (error) throw error;
    ferry = data.find((r) => r.tmdb_id === base)!.id;
    heist = data.find((r) => r.tmdb_id === base + 1)!.id;
    crew = randomUUID();
    const created = await people.priya.client.rpc("create_group", { p_id: crew, p_name: "College crew", p_color: 1 });
    if (created.error) throw created.error;
    const { data: invite } = await admin.from("invites").select("code").eq("group_id", crew).is("revoked_at", null).single();
    const joined = await people.jonah.client.rpc("join_group", { p_code: invite!.code });
    if (joined.error) throw joined.error;
    for (const [who, title, note] of [
      [people.priya, ferry, "ep 3 is where it gets you"],
      [people.jonah, ferry, "the lighthouse episode"],
      [people.jonah, heist, "a perfect Sunday movie"],
    ] as const) {
      const put = await who.client.rpc("put_good_word", { p_title: title, p_note: note, p_groups: [crew], p_source: "organic" });
      if (put.error) throw put.error;
    }
  }, 90_000);

  afterAll(async () => {
    const ids = Object.values(people).map((p) => p.id);
    await admin.from("good_words").delete().in("user_id", ids);
    await admin.from("groups").delete().in("owner_id", ids);
    await admin.from("titles").delete().in("tmdb_id", [base, base + 1]);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("keeps your streaming services to yourself, per region", async () => {
    const { data: saved } = await people.priya.client.rpc("set_streaming_services", { p_region: "US", p_providers: [15, 8, 8, -1] });
    expect(saved).toBe(true);
    const { data: own } = await people.priya.client.from("streaming_services").select("region, provider_ids");
    expect(own).toEqual([{ region: "US", provider_ids: [8, 15] }]);
    const { data: others } = await people.jonah.client.from("streaming_services").select("user_id");
    expect(others ?? []).toEqual([]);
    const { data: bad } = await people.priya.client.rpc("set_streaming_services", { p_region: "usa", p_providers: [8] });
    expect(bad).toBe(false);
    const signedOut = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await signedOut.rpc("set_streaming_services", { p_region: "US", p_providers: [8] });
    expect(error).not.toBeNull();
  });

  it("shares only your own good words and notes, and only while the link is on", async () => {
    // Off by default: no link at all.
    const { data: none } = await people.priya.client.from("share_links").select("token");
    expect(none ?? []).toEqual([]);

    const { data: token } = await people.priya.client.rpc("set_share_link", { p_on: true });
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
    const { data: shared } = await admin.rpc("shared_shelf", { p_token: token });
    expect(shared).toHaveLength(1);
    expect(shared![0].owner_name).toBe("Priya");
    expect(shared![0].note).toBe("ep 3 is where it gets you");
    expect(shared![0].title).toMatchObject({ title: "The Night Ferry", media_type: "tv", tmdb_id: base });
    // Nothing about groups or anyone else.
    const text = JSON.stringify(shared);
    expect(text).not.toContain("College crew");
    expect(text).not.toContain("lighthouse");
    expect(text).not.toContain("Jonah");

    // Only the server can read a shared shelf, and nobody else reads your link.
    const signedOut = createClient(url!, anon!, { auth: { persistSession: false } });
    expect((await signedOut.rpc("shared_shelf", { p_token: token })).error).not.toBeNull();
    expect((await people.jonah.client.rpc("shared_shelf", { p_token: token })).error).not.toBeNull();
    const { data: peek } = await people.jonah.client.from("share_links").select("token");
    expect(peek ?? []).toEqual([]);

    // The owner sees the view count.
    const { data: row } = await people.priya.client.from("share_links").select("enabled, view_count").single();
    expect(row).toEqual({ enabled: true, view_count: 1 });

    // Off: the link stops working at once. On again: a new link.
    await people.priya.client.rpc("set_share_link", { p_on: false });
    expect((await admin.rpc("shared_shelf", { p_token: token })).data).toEqual([]);
    const { data: again } = await people.priya.client.rpc("set_share_link", { p_on: true });
    expect(again).not.toBe(token);
    expect((await admin.rpc("shared_shelf", { p_token: token })).data).toEqual([]);
    expect((await admin.rpc("shared_shelf", { p_token: again })).data).toHaveLength(1);

    // Reset: a new link; the old one stops.
    const { data: reset } = await people.priya.client.rpc("reset_share_link");
    expect(reset).not.toBe(again);
    expect((await admin.rpc("shared_shelf", { p_token: again })).data).toEqual([]);
    expect((await admin.rpc("shared_shelf", { p_token: reset })).data).toHaveLength(1);
  });

  it("lets only a group's members hear its shelf", async () => {
    expect((await people.jonah.client.rpc("can_hear", { p_topic: `shelf:${crew}` })).data).toBe(true);
    expect((await people.tess.client.rpc("can_hear", { p_topic: `shelf:${crew}` })).data).toBe(false);
    expect((await people.tess.client.rpc("can_hear", { p_topic: "shelf:nope" })).data).toBe(false);
  });

  it("times the weekend prompt for Sunday 10am local, for 24 hours", async () => {
    const slot = async (at: string, tz = "America/New_York") => (await admin.rpc("weekend_slot", { p_tz: tz, p_at: at })).data;
    // Sunday 4 October 2026, 10:30 in New York.
    expect(await slot("2026-10-04T14:30:00Z")).toBe("2026-10-04");
    expect(await slot("2026-10-04T13:30:00Z")).toBeNull(); // 9:30, too early
    expect(await slot("2026-10-05T13:59:00Z")).toBe("2026-10-04"); // Monday 9:59, still inside the day
    expect(await slot("2026-10-05T14:01:00Z")).toBeNull();
    expect(await slot("2026-10-03T14:30:00Z")).toBeNull(); // Saturday
  });

  it("never prompts someone who put in a good word lately, or anyone without a group", async () => {
    const { data, error } = await admin.rpc("email_weekend_due", { p_only: Object.values(people).map((p) => p.id) });
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: { user_id: string }) => r.user_id);
    expect(ids).not.toContain(people.priya.id);
    expect(ids).not.toContain(people.jonah.id);
    expect(ids).not.toContain(people.tess.id);
    expect((await people.priya.client.rpc("email_weekend_due", { p_only: null })).error).not.toBeNull();
  });
});
