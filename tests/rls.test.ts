import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Row-level security on the tables from step 1, against the real project.
// Needs the Supabase env vars; skipped without them. Creates two invented
// users (Priya, Jonah) and removes them afterward.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

describe.skipIf(!enabled)("row-level security: profiles and sign_in_requests", () => {
  // Collected even when skipped, so only build a client when configured.
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const users: Record<string, { id: string; client: SupabaseClient }> = {};

  async function signInAs(name: string) {
    const email = `${name}-${run}@example.com`;
    const created = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (created.error) throw created.error;
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const verified = await client.auth.verifyOtp({ type: "email", token_hash: link.data.properties.hashed_token });
    if (verified.error) throw verified.error;
    users[name] = { id: created.data.user.id, client };
  }

  beforeAll(async () => {
    await signInAs("priya");
    await signInAs("jonah");
  });

  afterAll(async () => {
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  it("creates a profile when someone first signs in", async () => {
    const { data } = await admin.from("profiles").select("user_id, region, onboarded_at").eq("user_id", users.priya.id).single();
    expect(data).toMatchObject({ user_id: users.priya.id, region: "US", onboarded_at: null });
  });

  it("lets people read only their own profile", async () => {
    const { data } = await users.priya.client.from("profiles").select("user_id");
    expect(data).toEqual([{ user_id: users.priya.id }]);
  });

  it("lets people update their own profile", async () => {
    const { error } = await users.priya.client.from("profiles").update({ display_name: "Priya" }).eq("user_id", users.priya.id);
    expect(error).toBeNull();
    const { data } = await admin.from("profiles").select("display_name").eq("user_id", users.priya.id).single();
    expect(data?.display_name).toBe("Priya");
  });

  it("never lets one person change another's profile", async () => {
    await users.jonah.client.from("profiles").update({ display_name: "Not Priya" }).eq("user_id", users.priya.id);
    const { data } = await admin.from("profiles").select("display_name").eq("user_id", users.priya.id).single();
    expect(data?.display_name).toBe("Priya");
  });

  it("won't let a person hand their profile to someone else", async () => {
    const { error } = await users.jonah.client.from("profiles").update({ user_id: users.priya.id }).eq("user_id", users.jonah.id);
    expect(error).not.toBeNull();
  });

  it("rejects direct inserts and deletes", async () => {
    const insert = await users.jonah.client.from("profiles").insert({ user_id: randomUUID() });
    expect(insert.error).not.toBeNull();
    await users.jonah.client.from("profiles").delete().eq("user_id", users.jonah.id);
    const { data } = await admin.from("profiles").select("user_id").eq("user_id", users.jonah.id);
    expect(data).toHaveLength(1);
  });

  it("keeps sign-in request records out of reach of signed-in users", async () => {
    await admin.from("sign_in_requests").insert({ email_hash: `test-${run}` });
    const { data } = await users.priya.client.from("sign_in_requests").select("id");
    expect(data ?? []).toEqual([]);
    const anonymous = createClient(url!, anon!, { auth: { persistSession: false } });
    const anonRead = await anonymous.from("profiles").select("user_id");
    expect(anonRead.data ?? []).toEqual([]);
    await admin.from("sign_in_requests").delete().eq("email_hash", `test-${run}`);
  });
});
