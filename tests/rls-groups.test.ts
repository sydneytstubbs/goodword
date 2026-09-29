import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Groups, members, and invites under row-level security, against the real
// project (PRD F2, CLAUDE.md: never leak across groups; test it explicitly).
// Invented people only. Skipped without the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };

describe.skipIf(!enabled)("row-level security: groups", () => {
  const admin = createClient(url!, service!, { auth: { persistSession: false } });
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};

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
    const { data, error } = await user.client.rpc("create_group", { p_id: id, p_name: name, p_color: 1 });
    if (error) throw error;
    return { id, status: data as string };
  }

  async function activeCode(groupId: string) {
    const { data } = await admin.from("invites").select("code").eq("group_id", groupId).is("revoked_at", null).single();
    return data!.code as string;
  }

  async function join(user: User, code: string) {
    const { data, error } = await user.client.rpc("join_group", { p_code: code });
    if (error) throw error;
    return (data as Array<{ status: string; group_id: string | null }>)[0];
  }

  let crew = "";
  let girls = "";

  beforeAll(async () => {
    for (const name of ["priya", "jonah", "tess", "mo"]) people[name] = await signInAs(name);
    crew = (await createGroup(people.priya, "College crew")).id;
    girls = (await createGroup(people.tess, "The girls")).id;
  }, 60_000);

  afterAll(async () => {
    await admin.from("groups").delete().in("owner_id", Object.values(people).map((p) => p.id));
    for (const p of Object.values(people)) await admin.auth.admin.deleteUser(p.id);
  });

  it("makes the creator the owner and only member, with one active invite", async () => {
    const { data: members } = await people.priya.client.from("group_members").select("user_id, role").eq("group_id", crew);
    expect(members).toEqual([{ user_id: people.priya.id, role: "owner" }]);
    const { data: invites } = await people.priya.client.from("invites").select("code").eq("group_id", crew);
    expect(invites).toHaveLength(1);
    expect(invites![0].code).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it("hides a group, its members, and its invite from non-members", async () => {
    for (const table of ["groups", "group_members", "invites"] as const) {
      const column = table === "groups" ? "id" : "group_id";
      const { data } = await people.jonah.client.from(table).select("*").eq(column, crew);
      expect(data, table).toEqual([]);
    }
    const { data: profiles } = await people.jonah.client.from("profiles").select("user_id").eq("user_id", people.priya.id);
    expect(profiles).toEqual([]);
  });

  it("gives nothing to signed-out visitors", async () => {
    const anonymous = createClient(url!, anon!, { auth: { persistSession: false } });
    for (const table of ["groups", "group_members", "invites", "join_attempts"] as const) {
      const { data } = await anonymous.from(table).select("*");
      expect(data ?? [], table).toEqual([]);
    }
    const { error } = await anonymous.rpc("join_group", { p_code: await activeCode(crew) });
    expect(error).not.toBeNull();
  });

  it("rejects direct writes to groups, members, and invites", async () => {
    const insert = await people.jonah.client.from("group_members").insert({ group_id: crew, user_id: people.jonah.id });
    expect(insert.error).not.toBeNull();
    await people.priya.client.from("groups").update({ name: "Renamed directly" }).eq("id", crew);
    await people.priya.client.from("group_members").update({ role: "member" }).eq("group_id", crew);
    const { data } = await admin.from("groups").select("name").eq("id", crew).single();
    expect(data!.name).toBe("College crew");
    const { data: role } = await admin.from("group_members").select("role").eq("group_id", crew).eq("user_id", people.priya.id).single();
    expect(role!.role).toBe("owner");
  });

  it("joins with a valid code, once", async () => {
    expect(await join(people.jonah, await activeCode(crew))).toEqual({ status: "joined", group_id: crew });
    expect(await join(people.jonah, await activeCode(crew))).toEqual({ status: "already_member", group_id: crew });
    expect((await join(people.jonah, "not-a-real-code")).status).toBe("invalid");
  });

  it("shows members to each other, and nothing from groups they don't share", async () => {
    const { data: members } = await people.jonah.client.from("group_members").select("user_id").eq("group_id", crew);
    expect(members!.map((m) => m.user_id).sort()).toEqual([people.priya.id, people.jonah.id].sort());
    const { data: profile } = await people.jonah.client.from("profiles").select("display_name").eq("user_id", people.priya.id).single();
    expect(profile!.display_name).toBe("Priya");
    // Jonah and Tess share nothing.
    const { data: groups } = await people.jonah.client.from("groups").select("id");
    expect(groups!.map((g) => g.id)).toEqual([crew]);
    const { data: tess } = await people.jonah.client.from("profiles").select("user_id").eq("user_id", people.tess.id);
    expect(tess).toEqual([]);
  });

  it("keeps owner actions for the owner", async () => {
    expect((await people.jonah.client.rpc("rename_group", { p_group: crew, p_name: "Mine now" })).data).toBe(false);
    expect((await people.jonah.client.rpc("reset_invite", { p_group: crew })).data).toBeNull();
    expect((await people.jonah.client.rpc("remove_member", { p_group: crew, p_user: people.priya.id })).data).toBe(false);
    expect((await people.jonah.client.rpc("delete_group", { p_group: crew })).data).toBe(false);
    expect((await people.tess.client.rpc("delete_group", { p_group: crew })).data).toBe(false);
    const { data } = await admin.from("groups").select("name").eq("id", crew).single();
    expect(data!.name).toBe("College crew");
  });

  it("renames, and resetting the link kills the old one immediately", async () => {
    expect((await people.priya.client.rpc("rename_group", { p_group: crew, p_name: "  College crew  " })).data).toBe(true);
    const old = await activeCode(crew);
    const { data: fresh } = await people.priya.client.rpc("reset_invite", { p_group: crew });
    expect(fresh).not.toBe(old);
    expect((await join(people.mo, old)).status).toBe("expired");
    expect((await join(people.mo, fresh as string)).status).toBe("joined");
  });

  it("removes a member, who then loses access at once", async () => {
    expect((await people.priya.client.rpc("remove_member", { p_group: crew, p_user: people.mo.id })).data).toBe(true);
    const { data } = await people.mo.client.from("groups").select("id").eq("id", crew);
    expect(data).toEqual([]);
    const { data: members } = await people.mo.client.from("group_members").select("id").eq("group_id", crew);
    expect(members).toEqual([]);
  });

  it("hands ownership to the longest-standing member when the owner leaves", async () => {
    expect((await people.priya.client.rpc("leave_group", { p_group: crew })).data).toBe("left");
    const { data } = await admin.from("groups").select("owner_id").eq("id", crew).single();
    expect(data!.owner_id).toBe(people.jonah.id);
    const { data: role } = await admin.from("group_members").select("role").eq("group_id", crew).eq("user_id", people.jonah.id).single();
    expect(role!.role).toBe("owner");
    const { data: gone } = await people.priya.client.from("groups").select("id").eq("id", crew);
    expect(gone).toEqual([]);
  });

  it("deletes the group when the last member leaves", async () => {
    expect((await people.tess.client.rpc("leave_group", { p_group: girls })).data).toBe("deleted");
    const { data } = await admin.from("groups").select("id").eq("id", girls);
    expect(data).toEqual([]);
  });

  it("caps each person at 20 groups", async () => {
    for (let i = 0; i < 20; i++) expect((await createGroup(people.tess, `Sunday book club ${i}`)).status).toBe("created");
    expect((await createGroup(people.tess, "One too many")).status).toBe("too_many_groups");
    // Someone already in 20 groups can't join a 21st.
    const other = await createGroup(people.mo, "Moth Season fans");
    expect((await join(people.tess, await activeCode(other.id))).status).toBe("too_many_groups");
  }, 60_000);
});
