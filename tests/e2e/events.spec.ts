import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 9 (PRD 11, slice 9): events fire from their flows, and /admin/metrics
// shows them to admins only. Priya owns College crew; Jonah joins from the
// invite link. Invented people and titles; the title has a TMDB id no real
// title uses. Needs the step 9 migration applied.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);

test.describe("measurement", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  const crew = randomUUID();
  const code = randomUUID().replaceAll("-", "");

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    users.push(priya, jonah);
    await admin().from("groups").insert({ id: crew, name: "College crew", owner_id: priya.id, color: 1 });
    const member = await admin()
      .from("group_members")
      .insert({ group_id: crew, user_id: priya.id, role: "owner", welcome_seen_at: new Date().toISOString(), joined_at: new Date().toISOString() });
    if (member.error) throw member.error;
    await admin().from("invites").insert({ group_id: crew, code, created_by: priya.id });
    const { error } = await admin()
      .from("titles")
      .insert({ tmdb_id: base, media_type: "tv", title: "The Night Ferry", year: 2024, genres: [{ id: 1, name: "Drama" }], accent: "plum" });
    if (error) throw error;
  });

  test.afterAll(async () => {
    await admin().from("app_admins").delete().in("user_id", users.map((u) => u.id));
    await deleteUsers(users);
    await admin().from("titles").delete().eq("tmdb_id", base);
  });

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    return page;
  }

  /** The events a person has, newest first (the write happens just after each response). */
  const eventsOf = async (user: TestUser | null, name: string) => {
    let query = admin().from("events").select("properties").eq("name", name).order("occurred_at", { ascending: false });
    query = user ? query.eq("user_id", user.id) : query.is("user_id", null);
    return ((await query).data ?? []).map((row) => row.properties as Record<string, unknown>);
  };

  test("invite opened signed out, sign-in, and joining", async ({ browser, page }) => {
    await page.goto(`/join/${code}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("College crew");
    await expect.poll(async () => (await eventsOf(null, "invite_link_opened")).some((p) => p.group_id === crew && p.signed_in === false)).toBe(true);

    const jonahPage = await signedIn(browser, jonah, `/join/${code}/accept`);
    await expect(jonahPage).toHaveURL(new RegExp(`/list/${crew}`));
    await expect.poll(async () => await eventsOf(jonah, "sign_in_completed")).toContainEqual({ method: "magic_link", new_user: false });
    await expect.poll(async () => await eventsOf(jonah, "group_joined")).toContainEqual({ group_id: crew, via: "invite" });
    await expect.poll(async () => (await eventsOf(jonah, "list_viewed"))[0]).toMatchObject({ list: "group" });
  });

  test("a good word: Add opened from the title, time to log, and source", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/title/tv/${base}?ref=digest`);
    await expect.poll(async () => await eventsOf(priya, "title_viewed")).toContainEqual({ from: "digest" });
    await page.getByRole("main").getByRole("button", { name: "Put in a good word" }).click();
    const sheet = page.getByRole("dialog", { name: "Put in a good word" });
    await sheet.getByRole("button", { name: "Put in a good word" }).click();
    await expect(page.getByRole("button", { name: "Your good word" })).toHaveAttribute("aria-pressed", "true");

    await expect.poll(async () => await eventsOf(priya, "add_opened")).toContainEqual({ entry_point: "title" });
    await expect.poll(async () => (await eventsOf(priya, "good_word_created"))[0]).toMatchObject({ groups_count: 1, has_note: false, source: "digest" });
    const [created] = await eventsOf(priya, "good_word_created");
    expect(created.ms_from_add_opened).toEqual(expect.any(Number));
    expect(JSON.stringify(created)).not.toContain("Night Ferry");
    await expect.poll(async () => await eventsOf(priya, "email_clicked")).toContainEqual({ type: "digest", target: "title" });
  });

  test("Activity and notification settings", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/activity");
    await expect.poll(async () => (await eventsOf(priya, "activity_opened")).length).toBeGreaterThan(0);
    await page.goto("/you/settings");
    await page.getByRole("switch", { name: "Weekly digest" }).click();
    await expect.poll(async () => await eventsOf(priya, "notification_pref_changed")).toContainEqual({ type: "digest", enabled: false });
  });

  test("the browser can't send server-only events", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/you");
    const status = await page.evaluate(async () => {
      const response = await fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "good_word_created", props: {} }) });
      return response.status;
    });
    expect(status).toBe(400);
  });

  test("/admin/metrics: not found for members, tables for admins", async ({ browser }) => {
    const jonahPage = await signedIn(browser, jonah, "/admin/metrics");
    await expect(jonahPage.getByRole("heading", { name: "Metrics" })).toHaveCount(0);

    await admin().from("app_admins").insert({ user_id: priya.id });
    const page = await signedIn(browser, priya, "/admin/metrics");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Metrics");
    await expect(page.getByRole("heading", { name: "Invites become members (H1)" })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(7);
    await expectNoViolations(page);
  });
});
