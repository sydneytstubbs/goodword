import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 20 acceptance (PRD F16.10, slice 20): an account from before the flip
// lands on Home and gets "Share your list with friends?" once; nothing is
// shared until its author says so. Priya and Jonah are friends; Priya has two
// good words her friends can't see yet. Invented titles go straight into the
// title cache.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const titles = [
  { tmdb_id: base, media_type: "tv", title: "The Night Ferry", year: 2024, accent: "plum" },
  { tmdb_id: base + 1, media_type: "movie", title: "Moth Season", year: 2023, accent: "clay" },
];

test.describe("the flip", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  const words: string[] = [];
  const pages: Page[] = [];

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    users.push(priya, jonah);
    // From before the flip.
    await admin().from("profiles").update({ share_prompt_due: true }).in("user_id", [priya.id, jonah.id]);
    const [low, high] = [priya.id, jonah.id].sort();
    await admin().from("friendships").insert({ user_low: low, user_high: high, status: "accepted", requested_by: low, accepted_at: new Date().toISOString(), seeded: true });
    const { data, error } = await admin().from("titles").insert(titles).select("id");
    if (error) throw error;
    for (const t of data) {
      const { data: gw } = await admin().from("good_words").insert({ user_id: priya.id, title_id: t.id }).select("id").single();
      words.push(gw!.id);
    }
  });

  test.afterAll(async () => {
    for (const page of pages) await page.context().close();
    await deleteUsers(users);
    await admin().from("titles").delete().in("tmdb_id", [base, base + 1]);
  });

  async function signIn(browser: Browser, user: TestUser): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    pages.push(page);
    // Signing in with no destination lands on Home.
    await openMagicLink(page, user, "/");
    await page.waitForURL((u) => u.pathname === "/home");
    return page;
  }

  test("lands on Home and asks once; Choose shares only what's picked", async ({ browser }) => {
    const page = await signIn(browser, priya);
    const sheet = page.getByRole("dialog", { name: "Share your list with friends?" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Jonah");
    await expectNoViolations(page);

    await sheet.getByRole("button", { name: "Choose" }).click();
    const chooser = page.getByRole("dialog", { name: "Choose what to share" });
    await expect(chooser.getByRole("checkbox")).toHaveCount(2);
    await chooser.getByRole("button", { name: "Share", exact: true }).click();
    await expect(chooser.getByRole("alert")).toHaveText("Choose at least one good word to share.");
    await chooser.getByRole("checkbox", { name: /Moth Season/ }).check();
    await expectNoViolations(page);
    await chooser.getByRole("button", { name: "Share 1" }).click();
    await expect(page.getByText("Your friends can see 1 of your good words.").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const { data } = await admin().from("good_words").select("id, friends_shared_at").in("id", words);
    expect(data!.filter((w) => w.friends_shared_at).map((w) => w.id)).toEqual([words[1]]);

    // Once answered, it doesn't come back.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeAttached();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Not now changes nothing and doesn't come back", async ({ browser }) => {
    await admin().from("profiles").update({ share_prompt_answered_at: null }).eq("user_id", priya.id);
    await admin().from("good_words").update({ friends_shared_at: null }).eq("user_id", priya.id);
    const page = await signIn(browser, priya);
    await page.getByRole("dialog", { name: "Share your list with friends?" }).getByRole("button", { name: "Not now" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect
      .poll(async () => (await admin().from("profiles").select("share_prompt_answered_at").eq("user_id", priya.id).single()).data?.share_prompt_answered_at)
      .not.toBeNull();
    const { data } = await admin().from("good_words").select("friends_shared_at").eq("user_id", priya.id);
    expect(data!.every((w) => w.friends_shared_at === null)).toBe(true);
    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("Jonah, with nothing of his own to share, isn't asked", async ({ browser }) => {
    const page = await signIn(browser, jonah);
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeAttached();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
