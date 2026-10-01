import { createHash, randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 11 (PRD F15): Add recs and the review deck. The parsing route is
// stubbed in the browser (the pipeline itself is unit-tested with a fake
// model), and imports are seeded straight into the database with invented
// titles. Priya owns College crew with Jonah; Grandma's Heist is already on
// Priya's list.

const base = 880_000_000 + Math.floor(Math.random() * 90_000_000);
const titles = {
  ferry: { tmdbId: base, type: "tv", name: "The Night Ferry", year: 2024 },
  mothShow: { tmdbId: base + 1, type: "tv", name: "Moth Season", year: 2021 },
  mothFilm: { tmdbId: base + 2, type: "movie", name: "Moth Season", year: 1999 },
  lowTide: { tmdbId: base + 3, type: "movie", name: "Low Tide Club", year: 2023 },
  heist: { tmdbId: base + 4, type: "movie", name: "Grandma's Heist", year: 2022 },
} as const;
const candidate = (t: (typeof titles)[keyof typeof titles]) => ({ type: t.type, tmdbId: t.tmdbId, name: t.name, year: t.year, posterPath: null });
const ndjson = (...lines: object[]) => lines.map((l) => JSON.stringify(l)).join("\n") + "\n";

test("Add recs is signed-in only", async ({ page }) => {
  await page.goto("/you/import");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fyou%2Fimport$/);
});

test.describe("Add recs and the review deck", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  const crew = randomUUID();
  let titleIds: Record<string, string> = {};

  async function seedImport(user: TestUser, cards: Array<{ query: string; confidence: "high" | "low"; candidates: object[]; note?: string }>, duplicates = 0) {
    const { data, error } = await admin()
      .from("imports")
      .insert({
        user_id: user.id,
        method: "text",
        input_hash: createHash("sha256").update(randomUUID()).digest("hex"),
        group_ids: [crew],
        status: "reviewing",
        found_count: cards.length,
        duplicate_count: duplicates,
      })
      .select("id")
      .single();
    if (error) throw error;
    const inserted = await admin()
      .from("import_cards")
      .insert(cards.map((c, i) => ({ import_id: data.id, user_id: user.id, position: i + 1, query: c.query, note: c.note ?? "", confidence: c.confidence, candidates: c.candidates })));
    if (inserted.error) throw inserted.error;
    return data.id as string;
  }

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    users.push(priya, jonah);
    await admin().from("groups").insert({ id: crew, name: "College crew", owner_id: priya.id, color: 1 });
    const members = await admin()
      .from("group_members")
      .insert([
        { group_id: crew, user_id: priya.id, role: "owner", welcome_seen_at: new Date().toISOString() },
        { group_id: crew, user_id: jonah.id, role: "member", welcome_seen_at: new Date().toISOString() },
      ]);
    if (members.error) throw members.error;
    const { data, error } = await admin()
      .from("titles")
      .insert(Object.values(titles).map((t) => ({ tmdb_id: t.tmdbId, media_type: t.type, title: t.name, year: t.year, accent: "plum" })))
      .select("id, tmdb_id, media_type");
    if (error) throw error;
    titleIds = Object.fromEntries(data.map((r) => [`${r.media_type}-${r.tmdb_id}`, r.id]));
    const heist = await admin().from("good_words").insert({ user_id: priya.id, title_id: titleIds[`movie-${titles.heist.tmdbId}`] });
    if (heist.error) throw heist.error;
  });

  test.afterAll(async () => {
    await admin().from("imports").delete().in("user_id", users.map((u) => u.id));
    await admin().from("good_words").delete().in("user_id", users.map((u) => u.id));
    await deleteUsers(users);
    await admin().from("titles").delete().in("tmdb_id", Object.values(titles).map((t) => t.tmdbId));
  });

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    await expect(page).toHaveURL(new RegExp(`${next.replace(/[?/]/g, "\\$&")}`));
    return page;
  }

  test("the input screen: label, tip, disabled until there's input, no axe violations", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/you/import");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add recs");
    const box = page.getByLabel("List everything you'd recommend").filter({ visible: true });
    await expect(box).toBeVisible();
    await expect(page.getByText(/^Tip: /).filter({ visible: true })).toBeVisible();
    const submit = page.getByRole("button", { name: "Find my titles" });
    await expect(submit).toHaveAttribute("aria-disabled", "true");
    await expect(page.getByText("Add a list or a screenshot first.")).toBeVisible();
    await expect(page.getByRole("button", { name: /College crew/ })).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
    await expectNoViolations(page);
    await box.fill("The Night Ferry\nMoth Season, so eerie");
    await expect(submit).not.toHaveAttribute("aria-disabled", "true");
    await page.context().close();
  });

  test("nothing found, the daily limit, and errors keep the list", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/you/import");
    const box = page.getByLabel("List everything you'd recommend").filter({ visible: true });
    await box.fill("just some thoughts about the weekend");

    await page.route("**/api/import", (route) => route.fulfill({ status: 429, json: { error: "limited" } }));
    await page.getByRole("button", { name: "Find my titles" }).click();
    await expect(page.getByText("You've added a lot today. Try again tomorrow, or search for titles one at a time.")).toBeVisible();
    await expect(box).toHaveValue("just some thoughts about the weekend");

    await page.unroute("**/api/import");
    await page.route("**/api/import", (route) =>
      route.fulfill({ status: 200, contentType: "application/x-ndjson", body: ndjson({ type: "done", importId: randomUUID(), found: 0, duplicates: 0, truncated: false }) }),
    );
    await page.getByRole("button", { name: "Find my titles" }).click();
    await expect(page.getByRole("heading", { name: "We couldn't find titles in that" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Search instead" })).toBeVisible();
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.getByLabel("List everything you'd recommend").filter({ visible: true })).toHaveValue("just some thoughts about the weekend");
    await page.context().close();
  });

  test("finding titles streams a count, then opens the deck", async ({ browser }) => {
    const importId = await seedImport(priya, [{ query: "Low Tide Club", confidence: "high", candidates: [candidate(titles.lowTide)] }]);
    const page = await signedIn(browser, priya, "/you/import");
    await page.getByLabel("List everything you'd recommend").filter({ visible: true }).fill("Low Tide Club");
    await page.route("**/api/import", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: ndjson({ type: "found", count: 1 }, { type: "done", importId, found: 1, duplicates: 0, truncated: false }),
      }),
    );
    await page.getByRole("button", { name: "Find my titles" }).click();
    await expect(page).toHaveURL(new RegExp(`/you/import/${importId}\\?card=1$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Low Tide Club");
    await expect(page.getByText("1 of 1")).toBeVisible();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your recs are in");
    await expect(page.getByText("Nothing added this time.")).toBeVisible();
    await page.context().close();
  });

  test("review: add, undo, pick an alternative with a note, skip, and the done screen", async ({ browser }) => {
    const importId = await seedImport(
      priya,
      [
        { query: "the night ferry", confidence: "high", candidates: [candidate(titles.ferry)] },
        { query: "Moth Season", confidence: "low", candidates: [candidate(titles.mothShow), candidate(titles.mothFilm)], note: "so eerie" },
        { query: "Low Tide Club", confidence: "high", candidates: [candidate(titles.lowTide)] },
      ],
      1,
    );
    // Resume from My Recs.
    const page = await signedIn(browser, priya, "/you");
    await expect(page.getByText("You have 3 recs left to review.").filter({ visible: true })).toBeVisible();
    await page.getByRole("link", { name: "Finish" }).click();
    await expect(page).toHaveURL(new RegExp(`/you/import/${importId}\\?card=1$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Night Ferry");
    await expect(page.getByText("1 of 3")).toBeVisible();
    await expect(page.getByText(/Each one you add goes to|College crew/).first()).toBeVisible();
    await expectNoViolations(page);

    // Add, then Undo from the toast.
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("2 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Night Ferry");
    await expect(page.getByText("1 of 3")).toBeVisible();
    await expect.poll(async () => (await admin().from("good_words").select("id").eq("user_id", priya.id).eq("title_id", titleIds[`tv-${titles.ferry.tmdbId}`])).data?.length).toBe(0);

    await page.getByRole("button", { name: "Add", exact: true }).click();
    // A low-confidence card opens with its alternatives, and its note prefilled.
    await expect(page).toHaveURL(/card=2$/);
    await expect(page.getByRole("heading", { name: "Which one did you mean?" })).toBeVisible();
    await expect(page.getByText("We weren't sure about this one.")).toBeVisible();
    await expect(page.getByLabel("Anything to add?")).toHaveValue("so eerie");
    await expectNoViolations(page);
    await page.getByRole("radio", { name: /Film · 1999/ }).check();
    await page.getByLabel("Anything to add?").fill("eerie in the best way");
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText("3 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your recs are in");
    await expect(page.getByText("Added 2 recs. 1 was already in My Recs.")).toBeVisible();
    await expectNoViolations(page);

    const { data: words } = await admin()
      .from("good_words")
      .select("note, source, title_id, good_word_groups(group_id)")
      .eq("user_id", priya.id)
      .eq("source", "import");
    expect(words?.map((w) => [w.title_id, w.note, w.good_word_groups.map((g) => g.group_id)]).sort()).toEqual(
      [
        [titleIds[`tv-${titles.ferry.tmdbId}`], null, [crew]],
        [titleIds[`movie-${titles.mothFilm.tmdbId}`], "eerie in the best way", [crew]],
      ].sort(),
    );

    await page.getByRole("link", { name: "View My Recs" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("My Recs");
    await expect(page.getByText(/left to review/)).toHaveCount(0);
    await page.context().close();
  });

  test("someone else's import is a 404", async ({ browser }) => {
    const importId = await seedImport(priya, [{ query: "Low Tide Club", confidence: "high", candidates: [candidate(titles.lowTide)] }]);
    const page = await signedIn(browser, jonah, "/you");
    // Streamed, so the status is 200; the not-found page says so, with noindex.
    await page.goto(`/you/import/${importId}`);
    await expect(page.getByRole("heading", { level: 2, name: "We couldn't find that page" })).toBeVisible();
    await expect(page.getByText("Low Tide Club")).toHaveCount(0);
    await page.context().close();
  });

  test("desktop shortcuts: S skips, ← goes back, A adds", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "keyboard shortcuts are for desktop");
    const importId = await seedImport(jonah, [
      { query: "Low Tide Club", confidence: "high", candidates: [candidate(titles.lowTide)] },
      { query: "The Night Ferry", confidence: "high", candidates: [candidate(titles.ferry)] },
    ]);
    const page = await signedIn(browser, jonah, `/you/import/${importId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Low Tide Club");
    await page.keyboard.press("s");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Night Ferry");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Low Tide Club");
    await expect(page.getByText("Skipped", { exact: true }).first()).toBeVisible();
    await page.keyboard.press("a");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Night Ferry");
    await expect
      .poll(async () => (await admin().from("good_words").select("source").eq("user_id", jonah.id).eq("title_id", titleIds[`movie-${titles.lowTide.tmdbId}`])).data)
      .toEqual([{ source: "import" }]);
    await page.context().close();
  });
});
