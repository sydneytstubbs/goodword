import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Conversations, mentions, spoilers, and Activity under row-level security,
// against the real project (PRD F13, F14, 8; CLAUDE.md: never leak across
// groups, test it explicitly). Priya owns College crew (Jonah, Tess) and The
// girls (Bea). Mo is in neither. Invented people and titles only. Skipped
// without the Supabase env vars.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };
type ActivityRow = { id: string; type: string; actor_id: string; group_id: string; title_id: string | null; comment_id: string | null; body: string | null; is_spoiler: boolean; read_at: string | null };
type CommentRow = { id: string; user_id: string; author_name: string; body: string | null; mentions: Array<{ id: string; name: string }>; is_spoiler: boolean };

describe.skipIf(!enabled)("row-level security: conversations and Activity", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
  let ferry = "";
  let moth = "";
  let crew = "";
  let girls = "";
  const mention = (user: User) => `<@${user.id}>`;

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

  async function post(user: User, group: string, title: string, body: string, spoiler = false, id = randomUUID()) {
    const { data, error } = await user.client.rpc("post_comment", { p_id: id, p_group: group, p_title: title, p_body: body, p_spoiler: spoiler });
    if (error) throw error;
    return { status: data as string, id };
  }

  async function comments(user: User, group: string, title: string): Promise<CommentRow[]> {
    const { data, error } = await user.client.rpc("conversation_comments", { p_group: group, p_title: title });
    if (error) throw error;
    return data as CommentRow[];
  }

  async function activity(user: User): Promise<ActivityRow[]> {
    const { data, error } = await user.client.rpc("my_activity", {});
    if (error) throw error;
    return data as ActivityRow[];
  }

  beforeAll(async () => {
    for (const name of ["priya", "jonah", "tess", "bea", "mo"]) people[name] = await signInAs(name);
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
    await joinGroup(people.tess, crew);
    await joinGroup(people.bea, girls);
    // Priya vouches for The Night Ferry in both groups: a participant in both conversations.
    const { error: putError } = await people.priya.client.rpc("put_good_word", { p_title: ferry, p_note: null, p_groups: [crew, girls], p_source: "organic" });
    if (putError) throw putError;
  }, 90_000);

  afterAll(async () => {
    const ids = Object.values(people).map((p) => p.id);
    await admin.from("good_words").delete().in("user_id", ids);
    await admin.from("groups").delete().in("owner_id", ids);
    await admin.from("titles").delete().in("tmdb_id", [base, base + 1]);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("tells the owner when someone joins their group", async () => {
    const joins = (await activity(people.priya)).filter((a) => a.type === "group_join");
    expect(joins.map((a) => a.actor_id).sort()).toEqual([people.jonah.id, people.tess.id, people.bea.id].sort());
    expect(await activity(people.jonah)).toEqual([]);
  });

  it("starts a conversation: mentions notify, and everyone else in the group hears it started", async () => {
    const first = await post(people.tess, crew, ferry, `just finished ep 6, ${mention(people.priya)} you were SO right`);
    expect(first.status).toBe("created");
    const priya = (await activity(people.priya)).filter((a) => a.comment_id === first.id);
    expect(priya.map((a) => a.type)).toEqual(["mention"]);
    const jonah = (await activity(people.jonah)).filter((a) => a.comment_id === first.id);
    expect(jonah.map((a) => a.type)).toEqual(["conversation_started"]);
    expect((await activity(people.tess)).filter((a) => a.comment_id === first.id)).toEqual([]);
    // The girls never hear about College crew's conversation.
    expect((await activity(people.bea)).filter((a) => a.comment_id)).toEqual([]);
  });

  it("notifies participants of later comments, never the author", async () => {
    const reply = await post(people.jonah, crew, ferry, "no spoilers please");
    const types = async (user: User) => (await activity(user)).filter((a) => a.comment_id === reply.id).map((a) => a.type);
    expect(await types(people.priya)).toEqual(["comment"]); // vouched for it here
    expect(await types(people.tess)).toEqual(["comment"]); // commented here
    expect(await types(people.jonah)).toEqual([]);
  });

  it("is idempotent: a retried send with the same id doesn't duplicate", async () => {
    const id = randomUUID();
    expect((await post(people.jonah, crew, ferry, "once", false, id)).status).toBe("created");
    expect((await post(people.jonah, crew, ferry, "once", false, id)).status).toBe("exists");
    expect((await post(people.tess, crew, ferry, "not mine", false, id)).status).toBe("not_member");
    const { count } = await admin.from("comments").select("id", { count: "exact", head: true }).eq("id", id);
    expect(count).toBe(1);
  });

  it("returns the conversation oldest first, with mention names, to members", async () => {
    const list = await comments(people.jonah, crew, ferry);
    expect(list.map((c) => c.author_name)).toEqual(["Tess", "Jonah", "Jonah"]);
    expect(list[0].mentions).toEqual([{ id: people.priya.id, name: "Priya" }]);
  });

  it("keeps College crew's conversation from The girls and from strangers entirely", async () => {
    for (const outsider of [people.bea, people.mo]) {
      const { data: rows } = await outsider.client.from("comments").select("id");
      expect(rows).toEqual([]);
      const { data: mentions } = await outsider.client.from("comment_mentions").select("id");
      expect(mentions).toEqual([]);
      expect(await comments(outsider, crew, ferry)).toEqual([]);
      const { data: state } = await outsider.client.rpc("conversation_state", { p_group: crew, p_title: ferry });
      expect(state).toEqual([]);
      const { data: counts } = await outsider.client.rpc("comment_counts", { p_groups: [crew] });
      expect(counts).toEqual([]);
      expect((await post(outsider, crew, ferry, "let me in")).status).toBe("not_member");
      const { data: hear } = await outsider.client.rpc("can_hear", { p_topic: `conversation:${crew}:${ferry}` });
      expect(hear).toBe(false);
    }
    // Bea's title detail shows only The girls, with nothing said there yet.
    const { data: previews } = await people.bea.client.rpc("conversation_previews", { p_title: ferry });
    expect(previews).toEqual([{ group_id: girls, comment_count: 0, latest_at: null, on_shelf: true, recent: [] }]);
    // Nobody hears someone else's Activity.
    const { data: others } = await people.bea.client.rpc("can_hear", { p_topic: `activity:${people.priya.id}` });
    expect(others).toBe(false);
    const { data: own } = await people.bea.client.rpc("can_hear", { p_topic: `activity:${people.bea.id}` });
    expect(own).toBe(true);
  });

  it("lets any title have a conversation, on the shelf or not", async () => {
    expect((await post(people.jonah, crew, moth, "anyone seen this?")).status).toBe("created");
    const { data } = await people.tess.client.rpc("conversation_previews", { p_title: moth });
    const crewPreview = (data as Array<{ group_id: string; comment_count: number; on_shelf: boolean }>).find((p) => p.group_id === crew);
    expect(crewPreview).toMatchObject({ comment_count: 1, on_shelf: false });
  });

  it("keeps only mentions of current members, never yourself, and never reveals a stranger's name", async () => {
    const { id } = await post(people.tess, crew, moth, `${mention(people.jonah)} ${mention(people.tess)} ${mention(people.bea)} hi`);
    const { data } = await admin.from("comments").select("body").eq("id", id).single();
    // Jonah stays a mention; Tess can't mention herself; Bea isn't in the group,
    // and Tess shares no group with her, so her name isn't revealed.
    expect(data!.body).toBe(`${mention(people.jonah)} @Tess @ hi`);
    const { data: mentions } = await admin.from("comment_mentions").select("mentioned_user_id").eq("comment_id", id);
    expect(mentions).toEqual([{ mentioned_user_id: people.jonah.id }]);
  });

  it("rejects empty and over-long comments", async () => {
    expect((await post(people.tess, crew, moth, "   ")).status).toBe("empty");
    expect((await post(people.tess, crew, moth, "x".repeat(501))).status).toBe("too_long");
    expect((await post(people.tess, crew, moth, "x".repeat(500))).status).toBe("created");
  });

  it("covers a spoiler everywhere until it's revealed, except for its author", async () => {
    const { id } = await post(people.tess, crew, ferry, `${mention(people.jonah)} the ferry scene`, true);
    const forJonah = (await comments(people.jonah, crew, ferry)).find((c) => c.id === id)!;
    expect(forJonah).toMatchObject({ body: null, mentions: [], is_spoiler: true, author_name: "Tess" });
    const forTess = (await comments(people.tess, crew, ferry)).find((c) => c.id === id)!;
    expect(forTess.body).toContain("the ferry scene");
    const inActivity = (await activity(people.jonah)).find((a) => a.comment_id === id)!;
    expect(inActivity).toMatchObject({ type: "mention", body: null, is_spoiler: true });
    const { data: previews } = await people.jonah.client.rpc("conversation_previews", { p_title: ferry });
    const recent = (previews as Array<{ group_id: string; recent: Array<{ id: string; body: string | null }> }>).find((p) => p.group_id === crew)!.recent;
    expect(recent.find((c) => c.id === id)!.body).toBeNull();
    const { data: live } = await people.jonah.client.rpc("conversation_comment", { p_id: id });
    expect((live as CommentRow[])[0].body).toBeNull();
    const { data: revealed } = await people.jonah.client.rpc("conversation_comment", { p_id: id, p_reveal: true });
    expect((revealed as CommentRow[])[0].body).toContain("the ferry scene");
    const { data: outsider } = await people.bea.client.rpc("conversation_comment", { p_id: id, p_reveal: true });
    expect(outsider).toEqual([]);
  });

  it("edits: new mentions notify once, dropped mentions retract unread items", async () => {
    const { id } = await post(people.tess, crew, moth, "who's in");
    const edit = (body: string) => people.tess.client.rpc("edit_comment", { p_id: id, p_body: body, p_spoiler: false });
    expect((await edit(`who's in ${mention(people.priya)}`)).data).toBe("updated");
    expect((await edit(`who's in ${mention(people.priya)} ${mention(people.jonah)}`)).data).toBe("updated");
    const mentionsOf = async (user: User) => (await activity(user)).filter((a) => a.comment_id === id && a.type === "mention").length;
    expect(await mentionsOf(people.priya)).toBe(1);
    expect(await mentionsOf(people.jonah)).toBe(1);
    expect((await edit(`who's in ${mention(people.jonah)}`)).data).toBe("updated");
    expect(await mentionsOf(people.priya)).toBe(0);
    const { data } = await admin.from("comments").select("edited_at").eq("id", id).single();
    expect(data!.edited_at).not.toBeNull();
    // Only the author edits.
    const { data: notMine } = await people.jonah.client.rpc("edit_comment", { p_id: id, p_body: "hijacked", p_spoiler: false });
    expect(notMine).toBe("missing");
  });

  it("deletes for the author or the owner, retracts Activity, and Undo brings it back", async () => {
    const { id } = await post(people.tess, crew, ferry, `${mention(people.jonah)} look`);
    expect((await people.jonah.client.rpc("delete_comment", { p_id: id })).data).toBe(false);
    expect((await people.priya.client.rpc("delete_comment", { p_id: id })).data).toBe(true);
    expect((await comments(people.jonah, crew, ferry)).some((c) => c.id === id)).toBe(false);
    expect((await activity(people.jonah)).some((a) => a.comment_id === id)).toBe(false);
    // Only whoever deleted it can undo.
    expect((await people.tess.client.rpc("restore_comment", { p_id: id })).data).toBe(false);
    expect((await people.priya.client.rpc("restore_comment", { p_id: id })).data).toBe(true);
    expect((await comments(people.jonah, crew, ferry)).some((c) => c.id === id)).toBe(true);
    expect((await activity(people.jonah)).some((a) => a.comment_id === id)).toBe(true);
  });

  it("marks a conversation read, with its Activity items and the card's unseen dot", async () => {
    const counts = async () => {
      const { data } = await people.jonah.client.rpc("comment_counts", { p_groups: [crew] });
      return (data as Array<{ title_id: string; comment_count: number; unseen: boolean }>).find((c) => c.title_id === ferry)!;
    };
    expect((await counts()).unseen).toBe(true);
    await people.jonah.client.rpc("mark_conversation_read", { p_group: crew, p_title: ferry, p_up_to: new Date().toISOString() });
    expect((await counts()).unseen).toBe(false);
    const items = (await activity(people.jonah)).filter((a) => a.group_id === crew && a.title_id === ferry);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((a) => a.read_at !== null)).toBe(true);
  });

  it("never lets anyone write conversations or Activity directly", async () => {
    const insert = await people.jonah.client
      .from("comments")
      .insert({ group_id: crew, title_id: ferry, user_id: people.jonah.id, body: "direct" });
    expect(insert.error).not.toBeNull();
    const item = await people.jonah.client
      .from("activity_items")
      .insert({ user_id: people.priya.id, type: "mention", group_id: crew });
    expect(item.error).not.toBeNull();
    await people.jonah.client.from("comments").update({ body: "changed" }).eq("group_id", crew);
    const { data } = await admin.from("comments").select("body").eq("group_id", crew).eq("body", "changed");
    expect(data).toEqual([]);
  });

  it("delivers new comments live to members listening on the conversation", async () => {
    await people.priya.client.realtime.setAuth();
    const received: string[] = [];
    const channel = people.priya.client.channel(`conversation:${crew}:${ferry}`, { config: { private: true } });
    await new Promise<void>((resolve, reject) => {
      channel.on("broadcast", { event: "comment" }, ({ payload }) => received.push((payload as { id: string }).id));
      channel.subscribe((status, err) => (status === "SUBSCRIBED" ? resolve() : status === "CHANNEL_ERROR" && reject(err ?? new Error(status))));
    });
    const { id } = await post(people.tess, crew, ferry, "live");
    // Delivery, not latency: generous under a parallel test run.
    const deadline = Date.now() + 10_000;
    while (!received.includes(id) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 100));
    await people.priya.client.removeChannel(channel);
    expect(received).toContain(id);
  });

  it("stops at 30 comments in 10 minutes", async () => {
    const solo = await createGroup(people.mo, "Sunday book club");
    for (let i = 0; i < 30; i++) expect((await post(people.mo, solo, moth, `comment ${i}`)).status).toBe("created");
    expect((await post(people.mo, solo, moth, "one more")).status).toBe("rate_limited");
  }, 60_000);

  it("after removal: no access or Activity, but earlier comments stay attributed", async () => {
    expect((await people.priya.client.rpc("remove_member", { p_group: crew, p_user: people.jonah.id })).data).toBe(true);
    expect(await comments(people.jonah, crew, ferry)).toEqual([]);
    expect(await activity(people.jonah)).toEqual([]);
    expect((await post(people.jonah, crew, ferry, "still here?")).status).toBe("not_member");
    const names = (await comments(people.tess, crew, ferry)).filter((c) => c.user_id === people.jonah.id).map((c) => c.author_name);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n === "Jonah")).toBe(true);
    // Later comments don't reach him.
    const { id } = await post(people.tess, crew, ferry, "after");
    const { data } = await admin.from("activity_items").select("id").eq("comment_id", id).eq("user_id", people.jonah.id);
    expect(data).toEqual([]);
  });
});
