import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Events and /admin/metrics (PRD 11, 8), against the real project. Nobody
// reads events but the metrics function, and the metrics function answers
// admins only. Mo is made an admin for the test, then removed. Skipped
// without the Supabase env vars. Needs the step 9 migration applied.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };
type Week = { week_start: string; invite_opens: number; joins: number; good_words_created: number; source_organic: number; median_log_seconds: number | null };

describe.skipIf(!enabled)("measurement: events and metrics", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const verified = await client.auth.verifyOtp({ type: "email", token_hash: link.data.properties.hashed_token });
    if (verified.error) throw verified.error;
    return { id: created.data.user.id, client };
  }

  const thisWeek = async (client: SupabaseClient): Promise<Week> => {
    const { data, error } = await client.rpc("admin_metrics", { p_weeks: 1 });
    if (error) throw error;
    return (data as Week[])[0];
  };

  beforeAll(async () => {
    people.mo = await signInAs("mo");
    people.bea = await signInAs("bea");
    const { error } = await admin.from("app_admins").insert({ user_id: people.mo.id });
    if (error) throw error;
  }, 60_000);

  afterAll(async () => {
    for (const person of Object.values(people)) await admin.auth.admin.deleteUser(person.id);
  });

  it("keeps events out of reach of signed-in people", async () => {
    await admin.from("events").insert({ user_id: people.bea.id, name: "title_viewed", properties: {} });
    const { data } = await people.bea.client.from("events").select("id");
    expect(data ?? []).toEqual([]);
    const insert = await people.bea.client.from("events").insert({ user_id: people.bea.id, name: "title_viewed", properties: {} });
    expect(insert.error).not.toBeNull();
  });

  it("answers metrics for admins only", async () => {
    expect((await people.bea.client.rpc("is_app_admin")).data).toBe(false);
    const { data } = await people.bea.client.rpc("admin_metrics", { p_weeks: 8 });
    expect(data ?? []).toEqual([]);
    expect((await people.mo.client.rpc("is_app_admin")).data).toBe(true);
    const { data: weeks } = await people.mo.client.rpc("admin_metrics", { p_weeks: 8 });
    expect(weeks).toHaveLength(8);
  });

  it("counts this week's events into the metrics", async () => {
    const before = await thisWeek(people.mo.client);
    const { error } = await admin.from("events").insert([
      { user_id: null, name: "invite_link_opened", properties: { signed_in: false } },
      { user_id: people.bea.id, name: "group_joined", properties: { via: "invite" } },
      { user_id: people.bea.id, name: "good_word_created", properties: { source: "organic", ms_from_add_opened: 6000 } },
    ]);
    expect(error).toBeNull();
    const after = await thisWeek(people.mo.client);
    expect(after.invite_opens - before.invite_opens).toBe(1);
    expect(after.joins - before.joins).toBe(1);
    expect(after.good_words_created - before.good_words_created).toBe(1);
    expect(after.source_organic - before.source_organic).toBe(1);
    expect(after.median_log_seconds).not.toBeNull();
  });

  it("deletes a person's events with their account", async () => {
    const extra = await signInAs("luis");
    await admin.from("events").insert({ user_id: extra.id, name: "activity_opened", properties: { unread_count: 1 } });
    await admin.auth.admin.deleteUser(extra.id);
    const { data } = await admin.from("events").select("id").eq("user_id", extra.id);
    expect(data).toEqual([]);
  });
});
