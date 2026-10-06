import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Home (PRD F16.3, DS 5.19), behind the home_enabled flag (F16.10). Priya has
// the flag and three friends (Jonah, Tess, Luis), and is in College crew with
// Jonah. Bea has the flag and knows nobody; Mo has no flag. Invented titles
// go straight into the title cache, with TMDB ids no real title uses.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const titles = {
  ferry: { type: "tv", tmdbId: base, name: "The Night Ferry", year: 2024, accent: "plum" },
  lowTide: { type: "tv", tmdbId: base + 1, name: "Low Tide Club", year: 2022, accent: "plum" },
  heist: { type: "movie", tmdbId: base + 2, name: "Grandma's Heist", year: 2023, accent: "clay" },
  moth: { type: "movie", tmdbId: base + 3, name: "Moth Season", year: 2023, accent: "clay" },
};
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

test.describe("Home", () => {
  test.skip(!live, "needs the Supabase project");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  let tess: TestUser;
  let luis: TestUser;
  let bea: TestUser;
  let mo: TestUser;
  const crew = randomUUID();
  const ids: Record<string, string> = {};

  async function befriend(a: TestUser, b: TestUser) {
    const [low, high] = [a.id, b.id].sort();
    await admin().from("friendships").insert({ user_low: low, user_high: high, status: "accepted", requested_by: a.id, accepted_at: new Date().toISOString() });
  }

  async function goodWord(user: TestUser, title: keyof typeof titles, note: string | null, at: string, { friends = true, group = null as string | null, source = "organic" } = {}) {
    const { data, error } = await admin()
      .from("good_words")
      .insert({ user_id: user.id, title_id: ids[title], note, source, created_at: at, friends_shared_at: friends ? at : null })
      .select("id")
      .single();
    if (error) throw error;
    if (group) await admin().from("good_word_groups").insert({ good_word_id: data.id, group_id: group, shared_at: at });
  }

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    tess = await createUser("Tess");
    luis = await createUser("Luis");
    bea = await createUser("Bea");
    mo = await createUser("Mo");
    users.push(priya, jonah, tess, luis, bea, mo);
    await admin().from("profiles").update({ home_enabled: true, home_viewed_at: ago(5) }).in("user_id", [priya.id, bea.id]);
    await befriend(priya, jonah);
    await befriend(priya, tess);
    await befriend(priya, luis);
    await admin().from("groups").insert({ id: crew, name: "College crew", owner_id: jonah.id, color: 1 });
    await admin()
      .from("group_members")
      .insert([jonah, priya].map((u, i) => ({ group_id: crew, user_id: u.id, role: i === 0 ? "owner" : "member", welcome_seen_at: new Date().toISOString() })));
    await admin().from("invites").insert({ group_id: crew, code: randomUUID().replaceAll("-", ""), created_by: jonah.id });
    const { data, error } = await admin()
      .from("titles")
      .insert(Object.values(titles).map((t) => ({ tmdb_id: t.tmdbId, media_type: t.type, title: t.name, year: t.year, genres: [], accent: t.accent })))
      .select("id, tmdb_id");
    if (error) throw error;
    for (const [key, t] of Object.entries(titles)) ids[key] = data.find((r) => r.tmdb_id === t.tmdbId)!.id as string;

    // New since Priya's last visit: Jonah and Tess on The Night Ferry, and
    // Jonah's College crew-only Low Tide Club. Earlier: Tess's Grandma's Heist.
    await goodWord(jonah, "ferry", "the ferry scene", ago(2));
    await goodWord(tess, "ferry", "ep 3 is where it gets you", ago(1));
    await goodWord(jonah, "lowTide", "college crew only", ago(3), { friends: false, group: crew });
    await goodWord(tess, "heist", "the grandma steals it", ago(240));
    // Luis imports Moth Season, shared with friends: one roll-up line, no card.
    await goodWord(luis, "moth", null, ago(0.5), { source: "import" });
    const { data: imp } = await admin()
      .from("imports")
      .insert({ user_id: luis.id, method: "text", input_hash: createHash("sha256").update(randomUUID()).digest("hex"), status: "done", share_with_friends: true })
      .select("id")
      .single();
    const inserted = await admin().from("import_cards").insert({
      import_id: imp!.id,
      user_id: luis.id,
      position: 1,
      query: "Moth Season",
      confidence: "high",
      candidates: [{ type: "movie", tmdbId: titles.moth.tmdbId, name: titles.moth.name }],
      decision: "added",
      decided_at: ago(0.5),
      added_type: "movie",
      added_tmdb_id: titles.moth.tmdbId,
      created_good_word: true,
    });
    if (inserted.error) throw inserted.error;
  });

  test.afterAll(async () => {
    await admin().from("imports").delete().eq("user_id", luis.id);
    await deleteUsers(users);
    await admin().from("titles").delete().in("tmdb_id", Object.values(titles).map((t) => t.tmdbId));
  });

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    await page.waitForURL((u) => u.pathname === next);
    return page;
  }

  test("one card per title, new first, then caught up; earlier cards only on a tap", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/home");
    const main = page.getByRole("main");

    // One card naming both, with Tess's newer note.
    const ferry = main.getByRole("article", { name: "Tess and Jonah vouched for The Night Ferry" });
    await expect(ferry).toBeVisible();
    await expect(ferry).toContainText("“ep 3 is where it gets you”");
    await expect(ferry).not.toContainText("the ferry scene");
    await expect(ferry.getByRole("link", { name: "See all 2 good words" })).toBeVisible();
    await expect(ferry.getByRole("link", { name: /Say something/ })).toBeVisible();
    await expect(ferry.getByRole("button", { name: "Vouch too The Night Ferry" })).toBeVisible();

    // Reached only through College crew: the group's chip.
    const lowTide = main.getByRole("article", { name: "Jonah vouched for Low Tide Club" });
    await expect(lowTide).toContainText("College crew");
    await expect(ferry).not.toContainText("College crew");

    // The import is one line, not a card.
    await expect(main.getByRole("link", { name: /Luis added 1 title to their list/ })).toBeVisible();
    await expect(main.getByRole("article", { name: /Moth Season/ })).toHaveCount(0);

    // Then caught up, and older cards wait for a tap.
    await expect(main.getByRole("heading", { level: 2, name: "You're all caught up" })).toBeVisible();
    await expect(main.getByRole("article", { name: /Grandma's Heist/ })).toHaveCount(0);
    await expectNoViolations(page);
    await main.getByRole("button", { name: "Show earlier good words" }).click();
    await expect(main.getByRole("article", { name: "Tess vouched for Grandma's Heist" })).toBeVisible();
    await expect(main.getByText("That's everything from your friends")).toBeVisible();
    await expectNoViolations(page);

    // Home is the current tab (or rail row).
    await expect(page.getByRole("link", { name: "Home", exact: true }).filter({ visible: true }).first()).toHaveAttribute("aria-current", "page");
  });

  test("Vouch too opens the confirm sheet with the title chosen, and names you on the card", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/home");
    const main = page.getByRole("main");
    await main.getByRole("button", { name: "Vouch too The Night Ferry" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toContainText("The Night Ferry");
    await sheet.getByRole("button", { name: "Put in a good word" }).click();
    const card = main.getByRole("article", { name: "You, Tess and 1 more vouched for The Night Ferry" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: "Your good word" })).toBeVisible();
    await expect
      .poll(async () => (await admin().from("good_words").select("id").eq("user_id", priya.id).eq("title_id", ids.ferry)).data?.length)
      .toBe(1);
  });

  test("with nothing new, caught up sits at the top with Put in a good word", async ({ browser }) => {
    await admin().from("profiles").update({ home_viewed_at: new Date(Date.now() + 60_000).toISOString() }).eq("user_id", priya.id);
    const page = await signedIn(browser, priya, "/home");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 2, name: "You're all caught up" })).toBeVisible();
    await expect(main.getByRole("button", { name: "Put in a good word" })).toBeVisible();
    await expect(main.getByRole("article")).toHaveCount(0);
    await main.getByRole("button", { name: "Show earlier good words" }).click();
    await expect(main.getByRole("article", { name: /The Night Ferry/ })).toBeVisible();
    await expectNoViolations(page);
  });

  test("filters narrow the cards and live in the URL", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/home");
    const main = page.getByRole("main");
    await main.getByRole("button", { name: "Show earlier good words" }).click();
    await main.getByRole("radio", { name: "Movies" }).click();
    await expect(page).toHaveURL(/type=movie/);
    await expect(main.getByRole("article", { name: /Grandma's Heist/ })).toBeVisible();
    await expect(main.getByRole("article", { name: /The Night Ferry/ })).toHaveCount(0);
    // Home has no sort.
    await expect(main.getByRole("button", { name: /^Sort/ })).toHaveCount(0);
  });

  test("knowing nobody: Start your own list, with your friend link", async ({ browser }) => {
    const page = await signedIn(browser, bea, "/home");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 2, name: "Start your own list" })).toBeVisible();
    await expect(main.getByRole("region", { name: /Your friend link/ })).toBeVisible();
    await expectNoViolations(page);
  });

  test("with the flag, the switcher leads with Home and the Groups tab goes Home", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/you");
    await page.goto("/list");
    await page.waitForURL((u) => u.pathname === "/home");
    await page.getByRole("button", { name: "Switch list. Current: Home" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("link", { name: /^Home/ })).toHaveAttribute("aria-current", "true");
    await sheet.getByRole("link", { name: /College crew/ }).click();
    await page.waitForURL(`**/list/${crew}`);
    await page.getByRole("button", { name: "Switch list. Current: College crew" }).click();
    await page.getByRole("dialog").getByRole("link", { name: /^Home/ }).click();
    await page.waitForURL("**/home");
  });

  test("without the flag, there's no Home", async ({ browser }) => {
    const page = await signedIn(browser, mo, "/you");
    await page.goto("/home");
    await expect(page.getByRole("heading", { level: 1, name: "We couldn't find that page" })).toBeAttached();
    await page.goto("/list");
    await expect(page).not.toHaveURL(/\/home/);
    await expect(page.getByRole("link", { name: "Groups", exact: true }).filter({ visible: true }).first()).toBeVisible();
  });
});
