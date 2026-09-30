import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 5 acceptance (PRD F5.4, F5.5, F6, slice 5): J4 end to end, filters
// that survive refresh and Back, paging, New badges and counts, and title
// detail with good words, group chips, and where to watch. Tess and Priya are
// in College crew; Priya is also in The girls. Invented titles are saved
// straight into the title cache, with fresh where-to-watch rows, and TMDB ids
// no real title uses, so TMDB is never asked about them.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const NETFLIX = { id: 8, name: "Netflix", logo: null };
const HULU = { id: 15, name: "Hulu", logo: null };
const APPLE = { id: 2, name: "Apple TV Store", logo: null };

type Seed = { key: string; type: "movie" | "tv"; name: string; genres: string[]; runtime: number | null; stream: Array<typeof NETFLIX> };
const named: Seed[] = [
  { key: "lowTide", type: "movie", name: "Low Tide Club", genres: ["Comedy"], runtime: 104, stream: [NETFLIX] },
  { key: "heist", type: "movie", name: "Grandma's Heist", genres: ["Comedy", "Crime"], runtime: 131, stream: [NETFLIX] },
  { key: "moth", type: "movie", name: "Moth Season", genres: ["Horror"], runtime: 98, stream: [NETFLIX] },
  { key: "ferry", type: "tv", name: "The Night Ferry", genres: ["Drama"], runtime: 52, stream: [NETFLIX, HULU] },
];
// Enough to page: 30 more titles for The girls' shelf.
const filler: Seed[] = Array.from({ length: 30 }, (_, i) => ({
  key: `extra${i}`,
  type: "movie",
  name: `Moth Season ${i + 2}`,
  genres: ["Horror"],
  runtime: 90,
  stream: [],
}));
const seeds = [...named, ...filler].map((s, i) => ({ ...s, tmdbId: base + i }));
const byKey = Object.fromEntries(seeds.map((s) => [s.key, s]));

test.describe("choosing", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let tess: TestUser;
  const crew = randomUUID();
  const girls = randomUUID();
  const rowId: Record<string, string> = {};
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();

  async function group(id: string, name: string, owner: TestUser, members: TestUser[]) {
    await admin().from("groups").insert({ id, name, owner_id: owner.id, color: 1 });
    await admin()
      .from("group_members")
      .insert([
        { group_id: id, user_id: owner.id, role: "owner", welcome_seen_at: hourAgo, joined_at: hourAgo, join_prompt_dismissed_at: hourAgo },
        ...members.map((m) => ({ group_id: id, user_id: m.id, role: "member", welcome_seen_at: hourAgo, joined_at: hourAgo, join_prompt_dismissed_at: hourAgo })),
      ]);
  }

  /** A good word straight into the database, shared into groups at a given time. */
  async function vouch(user: TestUser, key: string, note: string | null, groups: string[], at: string) {
    const { data, error } = await admin()
      .from("good_words")
      .insert({ user_id: user.id, title_id: rowId[key], note, created_at: at })
      .select("id")
      .single();
    if (error) throw error;
    if (groups.length) await admin().from("good_word_groups").insert(groups.map((g) => ({ good_word_id: data.id, group_id: g, shared_at: at })));
  }

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    tess = await createUser("Tess");
    users.push(priya, tess);
    await group(crew, "College crew", priya, [tess]);
    await group(girls, "The girls", priya, []);
    const { data, error } = await admin()
      .from("titles")
      .insert(
        seeds.map((s) => ({
          tmdb_id: s.tmdbId,
          media_type: s.type,
          title: s.name,
          year: 2024,
          genres: s.genres.map((name, i) => ({ id: i + 1, name })),
          runtime_minutes: s.runtime,
          accent: "plum",
        })),
      )
      .select("id, tmdb_id");
    if (error) throw error;
    for (const row of data) rowId[seeds.find((s) => s.tmdbId === row.tmdb_id)!.key] = row.id;
    const providers = await admin()
      .from("watch_providers")
      .insert(
        seeds.map((s) => ({
          title_id: rowId[s.key],
          region: "US",
          providers: { stream: s.stream, rent: s.key === "lowTide" ? [APPLE] : [], buy: [] },
          link: s.stream.length ? `https://www.themoviedb.org/movie/${s.tmdbId}/watch?locale=US` : null,
        })),
      );
    if (providers.error) throw providers.error;

    const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    // Before Tess last looked: not New.
    await vouch(priya, "heist", "the grandma steals every scene", [crew], minutesAgo(50));
    await vouch(priya, "moth", null, [crew], minutesAgo(45));
    await vouch(priya, "ferry", "ep 3 is where it gets you", [crew, girls], minutesAgo(40));
    await admin().from("group_members").update({ last_viewed_at: minutesAgo(30) }).eq("group_id", crew).eq("user_id", tess.id);
    // Since then: New for Tess.
    await vouch(priya, "lowTide", "comfort rewatch, every time", [crew], minutesAgo(10));
    await vouch(tess, "lowTide", "the finale", [crew], minutesAgo(5));
    for (const [i, s] of filler.entries()) await vouch(priya, s.key, null, [girls], minutesAgo(100 + i));
  });

  test.afterAll(async () => {
    await deleteUsers(users);
    await admin().from("titles").delete().in("tmdb_id", seeds.map((s) => s.tmdbId));
  });

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    return page;
  }

  const cards = (page: Page) => page.getByRole("list").filter({ has: page.getByRole("link", { name: /Vouched for by/ }) }).getByRole("listitem");

  test("New since your last visit: badges on cards and a count in the switcher", async ({ browser }) => {
    const page = await signedIn(browser, tess, `/shelf/${crew}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("College crew");
    await expect(page.getByRole("link", { name: /^Low Tide Club, film, 2024\. .* New\.$/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Grandma's Heist, .*\.$/ })).not.toHaveAccessibleName(/New\./);
    await page.getByRole("button", { name: /Switch shelf/ }).click();
    const sheet = page.getByRole("dialog", { name: "Your shelves" });
    await expect(sheet.getByRole("link", { name: /College crew/ })).toContainText("1 new good word");
  });

  test("J4: Movies, then Netflix, then More filters; the URL keeps it through refresh and Back", async ({ browser }) => {
    const page = await signedIn(browser, tess, `/shelf/${crew}`);
    await expect(cards(page)).toHaveCount(4);

    await page.getByRole("radio", { name: "Movies" }).click();
    await expect(page).toHaveURL(/\?type=movie$/);
    await expect(cards(page)).toHaveCount(3);

    const bar = page.getByRole("group", { name: "Filter the shelf" });
    await bar.getByRole("button", { name: /^Netflix/ }).click();
    await expect(page).toHaveURL(/\?type=movie&services=8$/);
    await expect(bar.getByRole("status")).toHaveText("3 good words");

    await bar.getByRole("button", { name: /More filters/ }).click();
    const sheet = page.getByRole("dialog", { name: "Filters" });
    await sheet.getByRole("button", { name: /^Comedy/ }).click();
    await sheet.getByRole("button", { name: "Under 2 hours" }).click();
    await sheet.getByRole("button", { name: "Show 1 good word" }).click();
    await expect(page).toHaveURL(/\?type=movie&services=8&genres=Comedy&length=120$/);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Low Tide Club");
    await expectNoViolations(page);

    await page.reload();
    await expect(cards(page)).toHaveCount(1);
    await expect(bar.getByRole("button", { name: "Comedy" })).toHaveAttribute("aria-pressed", "true");

    // Chips replace the entry; the segmented control pushed one, so Back undoes Movies and everything after.
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/shelf/${crew}$`));
    await expect(cards(page)).toHaveCount(4);
  });

  test("no results names what was excluded, and Clear filters brings the shelf back", async ({ browser }) => {
    const page = await signedIn(browser, tess, `/shelf/${crew}?type=tv&services=8&length=30`);
    await expect(page.getByRole("heading", { name: "Nobody's vouched for anything like that yet." })).toBeVisible();
    await page.goto(`/shelf/${crew}?type=movie&services=15`);
    await expect(page.getByRole("heading", { name: "Nobody's vouched for a Hulu movie yet." })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(cards(page)).toHaveCount(4);
  });

  test("sort by most vouched", async ({ browser }) => {
    const page = await signedIn(browser, tess, `/shelf/${crew}?sort=vouched`);
    await expect(cards(page).first()).toContainText("Low Tide Club");
    await expect(page.getByRole("button", { name: "Sort: Most vouched" })).toBeVisible();
  });

  test("paging: 24 at a time, more on scroll, then the end of the shelf", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/shelf/${girls}`);
    await expect(cards(page)).toHaveCount(24);
    await page.getByRole("button", { name: "Load more" }).scrollIntoViewIfNeeded();
    await expect(cards(page)).toHaveCount(31);
    await expect(page.getByText("That's the whole shelf.").filter({ visible: true })).toBeVisible();
  });

  test("title detail: good words with your groups, where to watch, and JustWatch", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/title/movie/${byKey.lowTide.tmdbId}`);
    await expect(page).toHaveTitle("Low Tide Club · Good Word");
    const goodWords = page.getByRole("region", { name: "Good words" });
    await expect(goodWords.getByRole("figure").first()).toContainText("You");
    await expect(goodWords.getByRole("figure").first()).toContainText("comfort rewatch, every time");
    await expect(goodWords.getByRole("figure").nth(1)).toContainText("Tess");
    await expect(goodWords.getByRole("figure").nth(1)).toContainText("College crew");

    const netflix = page.getByRole("link", { name: /^Netflix/ });
    await expect(netflix).toHaveAttribute("href", `https://www.themoviedb.org/movie/${byKey.lowTide.tmdbId}/watch?locale=US`);
    await expect(netflix).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("heading", { name: "Rent" })).toBeVisible();
    await expect(page.getByRole("link", { name: /JustWatch/ })).toBeVisible();
    await expectNoViolations(page);
  });

  test("title detail: nothing streaming in your region", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/title/movie/${byKey.extra0.tmdbId}`);
    // Scoped to main: a streamed section briefly has a hidden copy outside it.
    await expect(page.getByRole("main").getByText("Not streaming in your region right now.").filter({ visible: true })).toBeVisible();
  });
});
