import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Build your list (PRD F15, slice 11), against the real project: imports and
// their cards are private to their owner, groups are narrowed to ones you're
// in, there's no daily limit, the same input is reused, and decisions keep the
// import's status in step. Priya owns College crew; Jonah is in no group.
// Invented people and titles only. Skipped without the Supabase env vars.
// Needs the step 11 migration applied.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const enabled = Boolean(url && anon && service);

type User = { id: string; client: SupabaseClient };
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

describe.skipIf(!enabled)("imports: private cards, limits, reuse", () => {
  const admin = enabled ? createClient(url!, service!, { auth: { persistSession: false } }) : (null as unknown as SupabaseClient);
  const run = randomUUID().slice(0, 8);
  const people: Record<string, User> = {};
  let crew = "";
  let importId = "";
  let cards: string[] = [];

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

  const candidate = (tmdbId: number, name: string) => ({ type: "tv", tmdbId, name, year: 2024, posterPath: null });

  beforeAll(async () => {
    for (const name of ["priya", "jonah"]) people[name] = await signInAs(name);
    crew = randomUUID();
    const created = await people.priya.client.rpc("create_group", { p_id: crew, p_name: "College crew", p_color: 1 });
    if (created.error) throw created.error;
  }, 60_000);

  afterAll(async () => {
    const ids = Object.values(people).map((p) => p.id);
    await admin.from("imports").delete().in("user_id", ids);
    await admin.from("groups").delete().in("owner_id", ids);
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  });

  it("starts an import with only the groups you're in", async () => {
    const { data, error } = await people.priya.client.rpc("start_import", {
      p_method: "text",
      p_hash: hash(`The Night Ferry ${run}`),
      p_groups: [crew, randomUUID()],
    });
    expect(error).toBeNull();
    expect(data[0].status).toBe("started");
    expect(data[0].reuse).toBeNull();
    importId = data[0].import_id;
    const { data: row } = await people.priya.client.from("imports").select("group_ids, status").eq("id", importId).single();
    expect(row).toEqual({ group_ids: [crew], status: "parsing" });
  });

  it("keeps imports and cards to their owner", async () => {
    // The server writes cards with the service role once titles are matched.
    const { data: inserted, error } = await admin
      .from("import_cards")
      .insert([
        { import_id: importId, user_id: people.priya.id, position: 1, query: "the night ferry", note: "", confidence: "high", candidates: [candidate(1, "The Night Ferry")] },
        { import_id: importId, user_id: people.priya.id, position: 2, query: "moth season", note: "so good", confidence: "low", candidates: [candidate(2, "Moth Season"), candidate(3, "Moth Season")] },
      ])
      .select("id");
    expect(error).toBeNull();
    cards = inserted!.map((c) => c.id);
    await admin.from("imports").update({ status: "reviewing", extracted: [{ title: "The Night Ferry" }] }).eq("id", importId);

    const { data: mine } = await people.priya.client.from("import_cards").select("id").eq("import_id", importId);
    expect(mine).toHaveLength(2);
    for (const table of ["imports", "import_cards"] as const) {
      const { data: theirs } = await people.jonah.client.from(table).select("id");
      expect(theirs ?? []).toEqual([]);
    }
    // Nobody writes directly, and nobody reads the shared match cache.
    await people.priya.client.from("import_cards").update({ decision: "added" }).eq("id", cards[0]);
    const { data: after } = await admin.from("import_cards").select("decision").eq("id", cards[0]).single();
    expect(after!.decision).toBe("pending");
    const { data: matches } = await people.priya.client.from("title_matches").select("query_key");
    expect(matches ?? []).toEqual([]);
  });

  it("decides cards, only your own, and finishes the import when none are pending", async () => {
    const { data: notYours } = await people.jonah.client.rpc("decide_import_card", {
      p_card: cards[0], p_decision: "added", p_chosen: 0, p_note: "", p_opened: false,
    });
    expect(notYours).toBe(-1);

    const { data: left } = await people.priya.client.rpc("decide_import_card", {
      p_card: cards[0], p_decision: "added", p_chosen: 0, p_note: "  the lighthouse episode  ", p_opened: false,
    });
    expect(left).toBe(1);
    const { data: done } = await people.priya.client.rpc("decide_import_card", {
      p_card: cards[1], p_decision: "skipped", p_chosen: 1, p_note: null, p_opened: true,
    });
    expect(done).toBe(0);
    const { data: finished } = await people.priya.client.from("imports").select("status, completed_at").eq("id", importId).single();
    expect(finished!.status).toBe("done");
    expect(finished!.completed_at).not.toBeNull();
    const { data: rows } = await people.priya.client.from("import_cards").select("note, chosen, opened_alternatives").order("position");
    expect(rows).toEqual([
      { note: "the lighthouse episode", chosen: 0, opened_alternatives: false },
      { note: "so good", chosen: 1, opened_alternatives: true },
    ]);

    // Undo puts the card back, and the import back in review.
    const { data: undone } = await people.priya.client.rpc("decide_import_card", {
      p_card: cards[1], p_decision: "pending", p_chosen: 1, p_note: null, p_opened: false,
    });
    expect(undone).toBe(1);
    const { data: again } = await people.priya.client.from("imports").select("status, completed_at").eq("id", importId).single();
    expect(again).toEqual({ status: "reviewing", completed_at: null });
  });

  it("reuses what the same input found, without parsing it again", async () => {
    const { data } = await people.priya.client.rpc("start_import", {
      p_method: "text", p_hash: hash(`The Night Ferry ${run}`), p_groups: [],
    });
    expect(data[0].status).toBe("started");
    expect(data[0].reuse).toEqual([{ title: "The Night Ferry" }]);
    // Someone else's same input isn't reused.
    const { data: other } = await people.jonah.client.rpc("start_import", {
      p_method: "text", p_hash: hash(`The Night Ferry ${run}`), p_groups: [crew],
    });
    expect(other[0].reuse).toBeNull();
    const { data: row } = await people.jonah.client.from("imports").select("group_ids").eq("id", other[0].import_id).single();
    expect(row!.group_ids).toEqual([]);
  });

  it("cancels only your own import while it's finding titles", async () => {
    const { data } = await people.jonah.client.rpc("start_import", { p_method: "screenshots", p_hash: hash(`shots ${run}`), p_groups: [] });
    const id = data[0].import_id;
    const { data: byPriya } = await people.priya.client.rpc("cancel_import", { p_import: id });
    expect(byPriya).toBe(false);
    const { data: byJonah } = await people.jonah.client.rpc("cancel_import", { p_import: id });
    expect(byJonah).toBe(true);
  });

  it("has no daily limit, and stays signed-in only", async () => {
    // Jonah has started 2 so far; 10 more all start (PRD F15.4, v1.3.2).
    for (let i = 0; i < 10; i++) {
      const { data } = await people.jonah.client.rpc("start_import", { p_method: "text", p_hash: hash(`${run} ${i}`), p_groups: [] });
      expect(data[0].status).toBe("started");
    }
    const signedOut = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error } = await signedOut.rpc("start_import", { p_method: "text", p_hash: hash("x"), p_groups: [] });
    expect(error).not.toBeNull();
  });
});
