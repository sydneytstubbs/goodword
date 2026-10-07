import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Friends as an audience (PRD F16.2), behind the home_enabled flag (F16.10).
// Priya has the flag and a friend (Jonah) and is in College crew with Tess;
// Bea has no flag and is in The girls with Tess. Invented titles go straight
// into the title cache, with TMDB ids no real title uses.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const titles = {
  ferry: { id: `tv-${base}`, type: "tv", tmdbId: base, name: "The Night Ferry", year: 2024, genres: ["Drama"], accent: "plum" },
  moth: { id: `movie-${base + 1}`, type: "movie", tmdbId: base + 1, name: "Moth Season", year: 2023, genres: ["Horror"], accent: "clay" },
};

test.describe("friends as an audience", () => {
  test.skip(!live, "needs the Supabase project");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  let tess: TestUser;
  let bea: TestUser;
  const crew = randomUUID();
  const girls = randomUUID();

  async function group(id: string, name: string, owner: TestUser, members: TestUser[]) {
    await admin().from("groups").insert({ id, name, owner_id: owner.id, color: 1 });
    await admin()
      .from("group_members")
      .insert([owner, ...members].map((u, i) => ({ group_id: id, user_id: u.id, role: i === 0 ? "owner" : "member", welcome_seen_at: new Date().toISOString() })));
    await admin().from("invites").insert({ group_id: id, code: randomUUID().replaceAll("-", ""), created_by: owner.id });
  }

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    tess = await createUser("Tess");
    bea = await createUser("Bea");
    users.push(priya, jonah, tess, bea);
    await admin().from("profiles").update({ home_enabled: true }).in("user_id", [priya.id, jonah.id]);
    const [low, high] = [priya.id, jonah.id].sort();
    await admin().from("friendships").insert({ user_low: low, user_high: high, status: "accepted", requested_by: priya.id, accepted_at: new Date().toISOString() });
    await group(crew, "College crew", priya, [tess]);
    await group(girls, "The girls", bea, [tess]);
    const { error } = await admin()
      .from("titles")
      .insert(
        Object.values(titles).map((t) => ({
          tmdb_id: t.tmdbId,
          media_type: t.type,
          title: t.name,
          year: t.year,
          genres: t.genres.map((name, i) => ({ id: i + 1, name })),
          accent: t.accent,
        })),
      );
    if (error) throw error;
  });

  test.afterAll(async () => {
    await deleteUsers(users);
    await admin().from("titles").delete().in("tmdb_id", [base, base + 1]);
  });

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    await page.waitForURL((u) => u.pathname === next);
    await page.route("**/api/titles/search?**", (route) =>
      route.fulfill({ json: { results: Object.values(titles), annotations: { mine: {}, friends: {} } } }),
    );
    return page;
  }

  // The Add sheet keeps one dialog; its title changes as you move between steps.
  async function pick(page: Page, name: string) {
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("combobox").fill("ni");
    await sheet.getByRole("option", { name: new RegExp(name) }).click();
    return sheet;
  }

  test("with the flag: Friends on and groups off, the toast names friends, and My list shows it", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/list/${crew}`);
    await page.getByRole("main").getByRole("button", { name: "Put in a good word" }).click();
    const sheet = await pick(page, "The Night Ferry");
    // Friends on, groups off (decision 5); friends are never counted.
    const line = sheet.getByRole("button", { name: /^Visible to your friends\./ });
    await expect(line).toBeVisible();
    await expectNoViolations(page);

    // Friends first in the picker, then each group.
    await line.click();
    await expect(sheet.getByRole("checkbox", { name: /Your friends/ })).toBeChecked();
    await expect(sheet.getByRole("checkbox", { name: /College crew/ })).not.toBeChecked();
    await expectNoViolations(page);
    await sheet.getByRole("checkbox", { name: /College crew/ }).check();
    await expect(sheet.getByText("Visible to your friends and College crew")).toBeVisible();
    await sheet.getByRole("button", { name: "Done" }).click();
    await sheet.getByRole("button", { name: "Put in a good word" }).click();

    await expect(page.getByText("Your friends and College crew can see this.").filter({ visible: true })).toBeVisible();
    await expect
      .poll(async () => (await admin().from("good_words").select("friends_shared_at").eq("user_id", priya.id).maybeSingle()).data?.friends_shared_at)
      .not.toBeNull();

    // My list: the Friends chip beside the group chip.
    await page.goto("/you");
    const card = page.getByRole("link", { name: /^The Night Ferry, series, 2024\. .*Shared with your friends\. On College crew\./ });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Friends");
    await expectNoViolations(page);
  });

  test("with the flag: Change who sees it turns friends off", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/title/tv/${base}`);
    await page.getByRole("button", { name: "Your good word" }).click();
    await page.getByRole("menuitem", { name: "Change who sees it" }).click();
    const sheet = page.getByRole("dialog", { name: "Who can see it" });
    await sheet.getByRole("checkbox", { name: /Your friends/ }).uncheck();
    await expect(sheet.getByText("Visible to College crew · 2 people")).toBeVisible();
    await sheet.getByRole("button", { name: "Done" }).click();
    await expect
      .poll(async () => (await admin().from("good_words").select("friends_shared_at").eq("user_id", priya.id).single()).data?.friends_shared_at)
      .toBeNull();
  });

  test("with everything off, it's on My list only", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/list/${crew}`);
    // The tab bar's Add on phones, the rail's button on desktop.
    await page.getByRole("button", { name: /^(Add|Put in a good word)$/ }).filter({ visible: true }).first().click();
    const sheet = await pick(page, "Moth Season");
    await sheet.getByRole("button", { name: /^Visible to your friends\./ }).click();
    await sheet.getByRole("checkbox", { name: /Your friends/ }).uncheck();
    await expect(sheet.getByText("Only you, for now")).toBeVisible();
    await sheet.getByRole("button", { name: "Done" }).click();
    await sheet.getByRole("button", { name: "Put in a good word" }).click();
    await expect(page.getByText("On your list. Only you can see it for now.").filter({ visible: true })).toBeVisible();
  });

});
