import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The flip (PRD F16.10), against the real project: "Share your list with
// friends?" shows once, only to accounts from before the flip with a friend
// and something to share; answering shares exactly what was asked and
// nothing else; and nothing becomes more visible without its author.
// Invented people and titles only. Skipped without the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("the flip: Share your list with friends?", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  const titles: string[] = [];
  const words: Record<string, string> = {};

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-flip-${run}@example.com`;
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

  const shared = async (user: User) =>
    (await admin.from("good_words").select("id").eq("user_id", user.id).not("friends_shared_at", "is", null)).data!.map((r) => r.id).sort();
  const wanted = async (user: User) => (await user.client.rpc("share_prompt_wanted")).data;

  beforeAll(async () => {
    // Priya and Jonah had accounts before the flip and are friends; Tess is new since.
    for (const name of ["Priya", "Jonah", "Tess"]) people[name.toLowerCase()] = await signInAs(name);
    await admin.from("profiles").update({ share_prompt_due: true }).in("user_id", [people.priya.id, people.jonah.id]);
    const [low, high] = [people.priya.id, people.jonah.id].sort();
    await admin.from("friendships").insert({ user_low: low, user_high: high, status: "accepted", requested_by: low, accepted_at: new Date().toISOString(), seeded: true });
    const [low2, high2] = [people.priya.id, people.tess.id].sort();
    await admin.from("friendships").insert({ user_low: low2, user_high: high2, status: "accepted", requested_by: low2, accepted_at: new Date().toISOString() });
    const { data } = await admin
      .from("titles")
      .insert(["The Night Ferry", "Low Tide Club", "Moth Season"].map((title, i) => ({ tmdb_id: base + i, media_type: "tv", title, accent: "plum" })))
      .select("id");
    titles.push(...data!.map((r) => r.id as string));
    for (const [who, i] of [["priya", 0], ["priya", 1], ["jonah", 2], ["tess", 0]] as const) {
      const { data: gw } = await admin.from("good_words").insert({ user_id: people[who].id, title_id: titles[i] }).select("id").single();
      words[`${who}${i}`] = gw!.id;
    }
  }, 90_000);

  afterAll(async () => {
    for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
    await admin.from("titles").delete().in("id", titles);
  });

  it("starts new accounts with Home on and no prompt", async () => {
    const { data } = await admin.from("profiles").select("home_enabled, share_prompt_due").eq("user_id", people.tess.id).single();
    expect(data).toEqual({ home_enabled: true, share_prompt_due: false });
    expect(await wanted(people.tess)).toBe(false);
  });

  it("changes nothing until you answer: existing good words aren't shared with friends", async () => {
    expect(await wanted(people.priya)).toBe(true);
    expect(await shared(people.priya)).toEqual([]);
    // And her friend can't see them.
    expect((await people.jonah.client.from("good_words").select("id").eq("user_id", people.priya.id)).data).toEqual([]);
  });

  it("Choose shares only the good words picked, and only your own", async () => {
    const { data } = await people.priya.client.rpc("answer_share_prompt", { p_action: "choose", p_good_words: [words.priya1, words.jonah2] });
    expect(data).toBe(1);
    expect(await shared(people.priya)).toEqual([words.priya1]);
    expect(await shared(people.jonah)).toEqual([]);
    expect((await people.jonah.client.from("good_words").select("id").eq("user_id", people.priya.id)).data).toEqual([{ id: words.priya1 }]);
  });

  it("doesn't come back once answered", async () => {
    expect(await wanted(people.priya)).toBe(false);
  });

  it("Not now shares nothing and doesn't come back; Share all would share everything", async () => {
    expect(await wanted(people.jonah)).toBe(true);
    await people.jonah.client.rpc("answer_share_prompt", { p_action: "not_now" });
    expect(await shared(people.jonah)).toEqual([]);
    expect(await wanted(people.jonah)).toBe(false);
  });

  it("Share all shares every good word not shared yet", async () => {
    await admin.from("profiles").update({ share_prompt_answered_at: null }).eq("user_id", people.jonah.id);
    expect(await people.jonah.client.rpc("answer_share_prompt", { p_action: "share_all" })).toMatchObject({ data: 1 });
    expect(await shared(people.jonah)).toEqual([words.jonah2]);
  });

  it("refuses anything else, and isn't callable signed out", async () => {
    expect((await people.tess.client.rpc("answer_share_prompt", { p_action: "everyone" })).data).toBeNull();
    expect((await createClient(url!, anon!).rpc("answer_share_prompt", { p_action: "share_all" })).error).not.toBeNull();
  });
});
