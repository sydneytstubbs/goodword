import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 4 acceptance (PRD F4, F5, slice 4): put in a good word from Add and
// from a title, one card per title per group, edit, change groups, take back
// with Undo, the milestone, zero groups, a failed write, and the
// first-good-word prompt. Priya is in College crew (with Jonah) and The girls
// (with Tess). Invented titles are saved straight into the title cache, with
// TMDB ids no real title uses, so TMDB is never asked about them.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const titles = {
  ferry: { id: `tv-${base}`, type: "tv", tmdbId: base, name: "The Night Ferry", year: 2024, genres: ["Drama"], accent: "plum" },
  lowTide: { id: `movie-${base + 1}`, type: "movie", tmdbId: base + 1, name: "Low Tide Club", year: 2023, genres: ["Comedy"], accent: "ochre" },
  moth: { id: `movie-${base + 2}`, type: "movie", tmdbId: base + 2, name: "Moth Season", genres: ["Horror"], accent: "clay" },
};

test.describe("the core loop", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  let tess: TestUser;
  let mo: TestUser;
  const crew = randomUUID();
  const girls = randomUUID();

  async function group(id: string, name: string, owner: TestUser, members: TestUser[]) {
    await admin().from("groups").insert({ id, name, owner_id: owner.id, color: 1 });
    await admin()
      .from("group_members")
      .insert([
        { group_id: id, user_id: owner.id, role: "owner", welcome_seen_at: new Date().toISOString() },
        ...members.map((m) => ({ group_id: id, user_id: m.id, role: "member", welcome_seen_at: new Date().toISOString() })),
      ]);
    await admin().from("invites").insert({ group_id: id, code: randomUUID().replaceAll("-", ""), created_by: owner.id });
  }

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    tess = await createUser("Tess");
    mo = await createUser("Mo");
    users.push(priya, jonah, tess, mo);
    await group(crew, "College crew", priya, [jonah]);
    await group(girls, "The girls", priya, [tess]);
    const { error } = await admin()
      .from("titles")
      .insert(
        Object.values(titles).map((t) => ({
          tmdb_id: t.tmdbId,
          media_type: t.type,
          title: t.name,
          year: "year" in t ? t.year : null,
          genres: t.genres.map((name, i) => ({ id: i + 1, name })),
          accent: t.accent,
        })),
      );
    if (error) throw error;
  });

  test.afterAll(async () => {
    await deleteUsers(users);
    await admin().from("titles").delete().in("tmdb_id", [base, base + 1, base + 2]);
  });

  async function signedIn(browser: Browser, user: TestUser, next = "/shelf"): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    // Search returns the invented titles (the live route is tested in titles.spec).
    await page.route("**/api/titles/search?**", (route) =>
      route.fulfill({ json: { results: Object.values(titles), annotations: { mine: {}, friends: {} } } }),
    );
    return page;
  }

  async function pick(page: Page, name: string) {
    const sheet = page.getByRole("dialog", { name: "Put in a good word" });
    await sheet.getByRole("combobox").fill("ni");
    await sheet.getByRole("option", { name: new RegExp(name) }).click();
    return sheet;
  }

  test("J3: put in a good word from Add, see it on both shelves, with the audience named", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/shelf/${crew}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("College crew");
    await expect(page.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("main").getByRole("button", { name: "Put in a good word" }).click();
    const sheet = await pick(page, "The Night Ferry");
    const note = sheet.getByLabel("Anything to add? (optional)");
    await expect(note).toBeFocused();
    // Defaults to all your groups (DS 5.4).
    await expect(sheet.getByRole("button", { name: /Visible to 2 groups · 3 people/ })).toBeVisible();
    await expectNoViolations(page);
    await note.fill("ep 3 is where it gets you");
    await sheet.getByRole("button", { name: "Put in a good word" }).click();

    await expect(sheet).toBeHidden();
    // Names follow group order, which the docs leave open.
    await expect(page.getByText(/On your shelf\. (Jonah and Tess|Tess and Jonah) will see it\./).filter({ visible: true })).toBeVisible();
    const card = page.getByRole("link", { name: "The Night Ferry, series, 2024. Vouched for by You." });
    await expect(card).toBeVisible();
    await expect(card).toContainText("“ep 3 is where it gets you”");
    // The first good word ever is marked once (DS 4.1.20).
    await expect(page.getByRole("region", { name: "Your first good word." })).toBeVisible();
    await expectNoViolations(page);

    // Saved, on both shelves, as organic.
    await page.reload();
    await expect(card).toBeVisible();
    await page.goto(`/shelf/${girls}`);
    await expect(page.getByRole("link", { name: /^The Night Ferry, series, 2024/ })).toBeVisible();
    const { data } = await admin().from("good_words").select("note, source, good_word_groups(group_id)").eq("user_id", priya.id).single();
    expect(data!.note).toBe("ep 3 is where it gets you");
    expect(data!.source).toBe("organic");
    expect((data!.good_word_groups as Array<{ group_id: string }>).map((g) => g.group_id).sort()).toEqual([crew, girls].sort());
  });

  test("J2: a friend adds the same title from its page and joins the same card", async ({ browser }) => {
    const page = await signedIn(browser, jonah, `/shelf/${crew}`);
    await expect(page.getByRole("link", { name: "The Night Ferry, series, 2024. Vouched for by Priya." })).toBeVisible();
    await page.getByRole("link", { name: /^The Night Ferry/ }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Night Ferry");
    await expect(page.getByText("“ep 3 is where it gets you”").filter({ visible: true })).toBeVisible();
    await expectNoViolations(page);
    await page.getByRole("main").getByRole("button", { name: "Put in a good word" }).click();
    const sheet = page.getByRole("dialog", { name: "Put in a good word" });
    await expect(sheet.getByRole("button", { name: /Visible to College crew · 2 people/ })).toBeVisible();
    await sheet.getByRole("button", { name: "Put in a good word" }).click();
    await expect(page.getByText("On your shelf. Priya will see it.").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Your good word" })).toHaveAttribute("aria-pressed", "true");

    await page.goto(`/shelf/${crew}`);
    const cards = page.getByRole("link", { name: /^The Night Ferry/ });
    await expect(cards).toHaveCount(1);
    await expect(cards).toHaveAccessibleName("The Night Ferry, series, 2024. Vouched for by You and Priya.");
  });

  test("All groups shows one card with each person once; other groups never see Jonah", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/shelf/all");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("All groups");
    // Jonah's good word arrived after Priya last looked, so the card is New (F5.5).
    await expect(page.getByRole("link", { name: /^The Night Ferry/ })).toHaveAccessibleName(
      "The Night Ferry, series, 2024. Vouched for by You and Jonah. New.",
    );
    await expectNoViolations(page);

    const tessPage = await signedIn(browser, tess, `/title/tv/${base}`);
    await expect(tessPage.getByText("Priya", { exact: true }).filter({ visible: true })).toBeVisible();
    await expect(tessPage.getByText("Jonah")).toHaveCount(0);
  });

  test("edit note, change groups, take back, and Undo from the vouch menu", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/title/tv/${base}`);
    const vouch = page.getByRole("button", { name: "Your good word" });

    await vouch.click();
    await page.getByRole("menuitem", { name: "Edit note" }).click();
    const edit = page.getByRole("dialog", { name: "Edit note" });
    await edit.getByLabel("Anything to add? (optional)").fill("the ferry scene");
    await edit.getByRole("button", { name: "Save note" }).click();
    await expect(page.getByRole("main").getByText("“the ferry scene”").filter({ visible: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("main").getByText("“the ferry scene”").filter({ visible: true })).toBeVisible();

    await vouch.click();
    await page.getByRole("menuitem", { name: "Change groups" }).click();
    const picker = page.getByRole("dialog", { name: "Who can see it" });
    await picker.getByRole("checkbox", { name: /The girls/ }).uncheck();
    await expect(picker.getByText("Visible to College crew · 2 people").filter({ visible: true })).toBeVisible();
    await picker.getByRole("button", { name: "Done" }).click();
    await page.goto(`/shelf/${girls}`);
    await expect(page.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeVisible();

    await page.goto(`/title/tv/${base}`);
    await vouch.click();
    await page.getByRole("menuitem", { name: "Take it back" }).click();
    await expect(page.getByText("Taken back.").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("button", { name: "Put in a good word" })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(vouch).toBeVisible();
    await page.reload();
    await expect(page.getByRole("main").getByText("“the ferry scene”").filter({ visible: true })).toBeVisible();
    const { data } = await admin().from("good_words").select("note, good_word_groups(group_id)").eq("user_id", priya.id).single();
    expect(data).toEqual({ note: "the ferry scene", good_word_groups: [{ group_id: crew }] });
  });

  test("with no groups: only you, for now, and an Invite action", async ({ browser }) => {
    const page = await signedIn(browser, mo, "/you");
    await expect(page.getByRole("heading", { level: 2, name: "Your shelf is empty" })).toBeVisible();
    await page.getByRole("main").getByRole("button", { name: "Put in a good word" }).click();
    const sheet = await pick(page, "Moth Season");
    await expect(sheet.getByText("Only you, for now").filter({ visible: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Put in a good word" }).click();
    await expect(page.getByText("On your shelf. Invite friends to share it.").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Moth Season, film. Vouched for by You. Only you." })).toBeVisible();
    await expectNoViolations(page);
  });

  test("a failed write reverts, offers Retry, and keeps the note", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/shelf/${crew}`);
    // Server actions post to the page with a Next-Action header.
    await page.route("**/*", (route) => (route.request().headers()["next-action"] ? route.abort() : route.fallback()));
    await page.getByRole("button", { name: /^(Add|Put in a good word)$/ }).filter({ visible: true }).first().click();
    const sheet = await pick(page, "Low Tide Club");
    await sheet.getByLabel("Anything to add? (optional)").fill("so funny");
    await sheet.getByRole("button", { name: "Put in a good word" }).click();
    await expect(page.getByText("That didn't save. Check your connection and try again.").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^Low Tide Club/ })).toHaveCount(0);

    // The note is still there when the title is opened again, and it goes through once the network's back.
    await page.unroute("**/*");
    await page.getByRole("button", { name: /^(Add|Put in a good word)$/ }).filter({ visible: true }).first().click();
    const again = await pick(page, "Low Tide Club");
    await expect(again.getByLabel("Anything to add? (optional)")).toHaveValue("so funny");
    await again.getByRole("button", { name: "Put in a good word" }).click();
    await expect(page.getByRole("link", { name: /^Low Tide Club/ })).toBeVisible();
  });

  test("the first-good-word prompt appears after 20 seconds and stays dismissed", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.clock.install();
    await openMagicLink(page, tess, `/shelf/${girls}`);
    await expect(page.getByRole("link", { name: /^Low Tide Club/ })).toBeVisible();
    const prompt = page.getByRole("complementary", { name: "What's something you'd tell these folks to watch?" });
    await expect(prompt).toHaveCount(0);
    // The prompt's timer starts once the page hydrates, which can be after
    // the server-rendered cards show; keep the clock moving until it fires.
    await expect(async () => {
      await page.clock.fastForward(20_000);
      await expect(prompt).toBeVisible({ timeout: 1_000 });
    }).toPass();
    await expectNoViolations(page);
    await prompt.getByRole("button", { name: "Close" }).click();
    await expect(prompt).toHaveCount(0);
    await page.waitForLoadState("networkidle");
    await page.reload();
    await page.clock.fastForward(20_000);
    await expect(page.getByRole("link", { name: /^Low Tide Club/ })).toBeVisible();
    await expect(prompt).toHaveCount(0);
  });
});
