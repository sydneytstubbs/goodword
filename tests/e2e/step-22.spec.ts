import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, groupsOn, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 22 (PRD v1.6.0): the image-first Home card, earlier good words always
// on Home, the title page's order with its collapsed sections, and groups
// behind a flag that's off by default (F16.7). Priya is friends with Jonah,
// and both are in College crew. Invented titles go straight into the title
// cache, with TMDB ids no real title uses.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const titles = {
  ferry: { type: "tv", tmdbId: base, name: "The Night Ferry", year: 2024, accent: "plum", genres: ["Drama"], overview: "A night ferry crosses the same water every evening." },
  heist: { type: "movie", tmdbId: base + 1, name: "Grandma's Heist", year: 2023, accent: "clay", genres: ["Comedy"], overview: null },
};
const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

test.describe("step 22", () => {
  test.skip(!live, "needs the Supabase project");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  const crew = randomUUID();
  const invite = randomUUID().replaceAll("-", "");
  const ids: Record<string, string> = {};

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    users.push(priya, jonah);
    // Priya's last visit is after every good word: nothing is new.
    await admin().from("profiles").update({ home_viewed_at: new Date(Date.now() + 60_000).toISOString() }).eq("user_id", priya.id);
    const [low, high] = [priya.id, jonah.id].sort();
    await admin().from("friendships").insert({ user_low: low, user_high: high, status: "accepted", requested_by: jonah.id, accepted_at: new Date().toISOString() });
    await admin().from("groups").insert({ id: crew, name: "College crew", owner_id: jonah.id, color: 1 });
    await admin()
      .from("group_members")
      .insert([jonah, priya].map((u, i) => ({ group_id: crew, user_id: u.id, role: i === 0 ? "owner" : "member", welcome_seen_at: new Date().toISOString() })));
    await admin().from("invites").insert({ group_id: crew, code: invite, created_by: jonah.id });
    const { data, error } = await admin()
      .from("titles")
      .insert(Object.values(titles).map((t) => ({ tmdb_id: t.tmdbId, media_type: t.type, title: t.name, year: t.year, genres: t.genres, accent: t.accent, overview: t.overview })))
      .select("id, tmdb_id");
    if (error) throw error;
    for (const [key, t] of Object.entries(titles)) ids[key] = data.find((r) => r.tmdb_id === t.tmdbId)!.id as string;
    // Jonah's friends-shared good word from last week, and one shared only into College crew.
    await admin().from("good_words").insert({ user_id: jonah.id, title_id: ids.ferry, note: "strange and perfect", source: "organic", created_at: ago(170), friends_shared_at: ago(170) });
    const { data: gw } = await admin()
      .from("good_words")
      .insert({ user_id: jonah.id, title_id: ids.heist, note: "the grandma steals it", source: "organic", created_at: ago(200), friends_shared_at: null })
      .select("id")
      .single();
    await admin().from("good_word_groups").insert({ good_word_id: gw!.id, group_id: crew, shared_at: ago(200) });
  });

  test.afterAll(async () => {
    await deleteUsers(users);
    await admin().from("titles").delete().in("tmdb_id", Object.values(titles).map((t) => t.tmdbId));
  });

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    await page.waitForURL((u) => u.pathname === next);
    return page;
  }

  test("Home keeps earlier good words on screen, image-first, with no title data", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/home");
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 2, name: "You're all caught up" })).toBeVisible();
    // Nothing is new, and the earlier card shows without a tap.
    const ferry = main.getByRole("article", { name: "Jonah vouched for The Night Ferry" });
    await expect(ferry).toBeVisible();
    await expect(ferry.getByRole("link", { name: "The Night Ferry" }).first()).toHaveAttribute("href", `/title/tv/${titles.ferry.tmdbId}`);
    // The note reads as the first comment; no type, year, or where to watch.
    await expect(ferry).toContainText("Jonah strange and perfect");
    await expect(ferry).not.toContainText("2024");
    await expect(ferry).not.toContainText("Series");
    await expect(ferry.getByRole("link", { name: /Where to watch/ })).toHaveCount(0);
    await expect(ferry.getByRole("link", { name: /Add a comment/ })).toBeVisible();
    await expect(ferry.getByRole("button", { name: "Vouch too The Night Ferry" })).toBeVisible();
    await expectNoViolations(page);
  });

  test("the title page: poster, title, preview, good words, then collapsed sections", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/title/tv/${titles.ferry.tmdbId}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1, name: "The Night Ferry" })).toBeVisible();
    await expect(main.getByText(titles.ferry.overview!)).toBeVisible();
    await expect(main.getByText("strange and perfect")).toBeVisible();
    await expect(main.getByRole("link", { name: /Add a comment/ })).toBeVisible();

    const where = main.getByRole("button", { name: "Where to watch" });
    const details = main.getByRole("button", { name: "Details" });
    await expect(where).toHaveAttribute("aria-expanded", "false");
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await expect(main.getByText("Drama")).toBeHidden();
    await details.click();
    await expect(details).toHaveAttribute("aria-expanded", "true");
    await expect(main.getByText("Drama")).toBeVisible();
    await expectNoViolations(page);

    // The conversation comes before the title's data.
    const noteBox = await main.getByText("strange and perfect").boundingBox();
    const whereBox = await where.boundingBox();
    expect(noteBox!.y).toBeLessThan(whereBox!.y);

    // A link to #where-to-watch opens that section.
    await page.goto(`/title/tv/${titles.ferry.tmdbId}#where-to-watch`);
    await expect(main.getByRole("button", { name: "Where to watch" })).toHaveAttribute("aria-expanded", "true");
  });

  test("with groups off, no group entry point shows and group routes are 404s", async ({ browser }) => {
    test.skip(groupsOn, "the groups flag is on in this build");
    const page = await signedIn(browser, priya, "/home");
    const main = page.getByRole("main");
    // No switcher, no group chip; the group-only good word still reaches her.
    await expect(page.getByRole("button", { name: /Switch list/ })).toHaveCount(0);
    const heist = main.getByRole("article", { name: "Jonah vouched for Grandma's Heist" });
    await expect(heist).toBeVisible();
    await expect(heist).not.toContainText("College crew");
    // No Groups section in the rail.
    await expect(page.getByRole("heading", { name: "Groups" })).toHaveCount(0);

    // The audience picker offers only Friends.
    await page.getByRole("button", { name: "Vouch too The Night Ferry" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: /Change who can see it/ }).click();
    await expect(sheet.getByRole("checkbox", { name: /Your friends/ })).toBeVisible();
    await expect(sheet.getByRole("checkbox", { name: /College crew/ })).toHaveCount(0);

    // My list has no groups section; group screens and group invites are 404s.
    await page.goto("/you");
    await expect(page.getByRole("heading", { name: "Your groups" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Create a group/ })).toHaveCount(0);
    for (const path of ["/groups/new", `/groups/${crew}`, `/list/${crew}`, `/join/${invite}`]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
    // Nothing was deleted.
    const { data } = await admin().from("group_members").select("user_id").eq("group_id", crew);
    expect(data).toHaveLength(2);
  });
});
