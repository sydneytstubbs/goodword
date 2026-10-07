import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Friends under row-level security, against the real project (PRD F16.1,
// F16.6, F16.11 guardrail 9). Each acceptance criterion in F16.1 is a test
// here, plus what nobody else may see. Invented people only. Skipped without
// the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("row-level security: friends", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  let crew = "";

  async function signInAs(name: string): Promise<User> {
    const email = `${name}-friends-${run}@example.com`;
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

  const pair = (a: User, b: User) => ({ low: a.id < b.id ? a.id : b.id, high: a.id < b.id ? b.id : a.id });

  async function friendshipAsAdmin(a: User, b: User) {
    const { low, high } = pair(a, b);
    const { data } = await admin.from("friendships").select("status, requested_by").eq("user_low", low).eq("user_high", high).maybeSingle();
    return data as { status: string; requested_by: string } | null;
  }

  async function activityOf(user: User, type: string, actor: User) {
    const { data } = await admin.from("activity_items").select("id").eq("user_id", user.id).eq("type", type).eq("actor_id", actor.id);
    return data ?? [];
  }

  async function linkOf(user: User): Promise<string> {
    const { data, error } = await user.client.rpc("my_friend_link");
    if (error) throw error;
    return data as string;
  }

  async function acceptLink(user: User, code: string) {
    const { data, error } = await user.client.rpc("accept_friend_link", { p_code: code });
    if (error) throw error;
    return (data as Array<{ status: string; friend_id: string | null }>)[0];
  }

  beforeAll(async () => {
    for (const name of ["priya", "jonah", "tess", "mo", "luis", "bea"]) people[name] = await signInAs(name);
    // Tess and Mo share College crew; Bea and Luis share nothing.
    crew = randomUUID();
    const created = await people.tess.client.rpc("create_group", { p_id: crew, p_name: "College crew", p_color: 1 });
    if (created.error) throw created.error;
    const { data: invite } = await admin.from("invites").select("code").eq("group_id", crew).is("revoked_at", null).single();
    const joined = await people.mo.client.rpc("join_group", { p_code: invite!.code });
    if (joined.error) throw joined.error;
  }, 90_000);

  afterAll(async () => {
    await admin.from("groups").delete().in("owner_id", Object.values(people).map((p) => p.id));
    for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
  });

  it("makes friends both ways from a friend link, and tells the link's person", async () => {
    const code = await linkOf(people.priya);
    expect(code).toMatch(/^[A-Za-z0-9_-]{24}$/);
    // The same link each time until it's reset.
    expect(await linkOf(people.priya)).toBe(code);

    expect(await acceptLink(people.jonah, code)).toEqual({ status: "friends", friend_id: people.priya.id });
    expect((await friendshipAsAdmin(people.priya, people.jonah))?.status).toBe("accepted");
    for (const [me, other] of [[people.priya, people.jonah], [people.jonah, people.priya]] as const) {
      const { data } = await me.client.from("friendships").select("status").or(`user_low.eq.${other.id},user_high.eq.${other.id}`);
      expect(data).toEqual([{ status: "accepted" }]);
    }
    expect(await activityOf(people.priya, "friend_accepted", people.jonah)).toHaveLength(1);
    expect(await acceptLink(people.jonah, code)).toEqual({ status: "already_friends", friend_id: people.priya.id });
    expect((await acceptLink(people.priya, code)).status).toBe("self");
  });

  it("stops an old link working once it's reset, and makes no friendship from it", async () => {
    const old = await linkOf(people.luis);
    const { data: fresh, error } = await people.luis.client.rpc("reset_friend_link");
    expect(error).toBeNull();
    expect(fresh).not.toBe(old);
    expect((await acceptLink(people.bea, old)).status).toBe("expired");
    expect(await friendshipAsAdmin(people.bea, people.luis)).toBeNull();
    expect((await acceptLink(people.bea, "not-a-real-code-at-all-000")).status).toBe("invalid");
  });

  it("sends a request to someone from your groups, who can accept it", async () => {
    const { data } = await people.tess.client.rpc("request_friend", { p_user: people.mo.id });
    expect(data).toBe("requested");
    expect(await activityOf(people.mo, "friend_request", people.tess)).toHaveLength(1);
    expect((await people.tess.client.rpc("request_friend", { p_user: people.mo.id })).data).toBe("already_requested");

    expect((await people.mo.client.rpc("respond_friend_request", { p_user: people.tess.id, p_accept: true })).data).toBe("friends");
    expect((await friendshipAsAdmin(people.tess, people.mo))?.status).toBe("accepted");
    expect(await activityOf(people.tess, "friend_accepted", people.mo)).toHaveLength(1);
    // The answered request leaves Mo's Activity.
    expect(await activityOf(people.mo, "friend_request", people.tess)).toHaveLength(0);
  });

  it("gives no way to find or ask someone you share no group with", async () => {
    const { data } = await people.bea.client.rpc("request_friend", { p_user: people.luis.id });
    expect(data).toBe("not_allowed");
    expect(await friendshipAsAdmin(people.bea, people.luis)).toBeNull();
    expect(await activityOf(people.luis, "friend_request", people.bea)).toHaveLength(0);
    // And no profile to read.
    const { data: profile } = await people.bea.client.from("profiles").select("user_id").eq("user_id", people.luis.id);
    expect(profile).toEqual([]);
  });

  it("removes a friend without telling either person, both ways", async () => {
    const before = (await admin.from("activity_items").select("id").in("user_id", [people.priya.id, people.jonah.id])).data!.length;
    expect((await people.priya.client.rpc("remove_friend", { p_user: people.jonah.id })).data).toBe(true);
    expect(await friendshipAsAdmin(people.priya, people.jonah)).toBeNull();
    const after = (await admin.from("activity_items").select("id").in("user_id", [people.priya.id, people.jonah.id])).data!.length;
    expect(after).toBe(before);
    const { data } = await people.jonah.client.from("friendships").select("id").or(`user_low.eq.${people.priya.id},user_high.eq.${people.priya.id}`);
    expect(data).toEqual([]);
  });

  it("declines silently, like Instagram, and lets them ask again (open question 13)", async () => {
    // Tess and Mo are friends from the earlier test; start them over.
    await people.tess.client.rpc("remove_friend", { p_user: people.mo.id });
    await admin.from("activity_items").delete().in("user_id", [people.tess.id, people.mo.id]);

    expect((await people.tess.client.rpc("request_friend", { p_user: people.mo.id })).data).toBe("requested");
    expect((await people.mo.client.rpc("respond_friend_request", { p_user: people.tess.id, p_accept: false })).data).toBe("declined");
    expect(await friendshipAsAdmin(people.tess, people.mo)).toBeNull();
    // Nobody is told, and the request leaves Mo's Activity.
    const { data: tessItems } = await admin.from("activity_items").select("type").eq("user_id", people.tess.id);
    expect(tessItems).toEqual([]);
    expect(await activityOf(people.mo, "friend_request", people.tess)).toHaveLength(0);
    // Tess can ask again, and it reaches Mo as before.
    expect((await people.tess.client.rpc("request_friend", { p_user: people.mo.id })).data).toBe("requested");
    expect(await activityOf(people.mo, "friend_request", people.tess)).toHaveLength(1);
  });

  it("cancels a sent request silently, taking it out of their Activity", async () => {
    expect((await people.tess.client.rpc("cancel_friend_request", { p_user: people.mo.id })).data).toBe(true);
    expect(await friendshipAsAdmin(people.tess, people.mo)).toBeNull();
    expect(await activityOf(people.mo, "friend_request", people.tess)).toHaveLength(0);
    // Only the person who asked can cancel.
    await people.tess.client.rpc("request_friend", { p_user: people.mo.id });
    expect((await people.mo.client.rpc("cancel_friend_request", { p_user: people.tess.id })).data).toBe(false);
    expect((await friendshipAsAdmin(people.tess, people.mo))?.status).toBe("pending");
  });

  it("asking someone who already asked you makes you friends", async () => {
    // Tess asked Mo in the last test.
    expect((await people.mo.client.rpc("request_friend", { p_user: people.tess.id })).data).toBe("friends");
    expect((await friendshipAsAdmin(people.tess, people.mo))?.status).toBe("accepted");
  });

  it("never shows a friendship, a friend link, or friend names to anyone else", async () => {
    // Priya and Bea become friends; Luis is a stranger to both.
    await acceptLink(people.bea, await linkOf(people.priya));
    const { data: rows } = await people.luis.client.from("friendships").select("id");
    expect(rows).toEqual([]);
    const priyaCode = await linkOf(people.priya);
    expect((await people.luis.client.from("invites").select("code").eq("code", priyaCode)).data).toEqual([]);
    const { data: links } = await people.luis.client.from("invites").select("created_by").eq("kind", "friend");
    expect(links).toEqual([{ created_by: people.luis.id }]); // Only Luis's own link.
    const { data: names } = await people.luis.client.from("profiles").select("user_id").in("user_id", [people.priya.id, people.bea.id]);
    expect(names).toEqual([]);
    // Friends can read each other's names.
    const { data: friendName } = await people.bea.client.from("profiles").select("display_name").eq("user_id", people.priya.id);
    expect(friendName).toEqual([{ display_name: "Priya" }]);
  });

  it("keeps friend_ids internal, so nobody can list someone's friends", async () => {
    const { error } = await people.luis.client.rpc("friend_ids", { p_user: people.priya.id });
    expect(error).not.toBeNull();
    const { error: signedOut } = await createClient(url!, anon!).rpc("my_friend_link");
    expect(signedOut).not.toBeNull();
  });

  it("never lets a friend link join a group", async () => {
    const code = await linkOf(people.priya);
    const { data } = await people.luis.client.rpc("join_group", { p_code: code });
    expect((data as Array<{ status: string }>)[0].status).toBe("invalid");
  });

  it("shows friend requests in Activity, whatever the old launch flag says (the flip, F16.10)", async () => {
    await admin.from("activity_items").delete().eq("user_id", people.mo.id);
    await people.tess.client.rpc("remove_friend", { p_user: people.mo.id });
    await people.tess.client.rpc("request_friend", { p_user: people.mo.id });
    const types = async () => ((await people.mo.client.rpc("my_activity", {})).data as Array<{ type: string }>).map((a) => a.type);
    expect(await types()).toContain("friend_request");
    await admin.from("profiles").update({ home_enabled: false }).eq("user_id", people.mo.id);
    expect(await types()).toContain("friend_request");
    await admin.from("profiles").update({ home_enabled: true }).eq("user_id", people.mo.id);
  });

  it("removes friendships when an account is deleted", async () => {
    const extra = await signInAs("tess2");
    await acceptLink(extra, await linkOf(people.jonah));
    expect((await friendshipAsAdmin(extra, people.jonah))?.status).toBe("accepted");
    await admin.auth.admin.deleteUser(extra.id);
    expect(await friendshipAsAdmin(extra, people.jonah)).toBeNull();
  });
});
