import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 10 (PRD 12, slice 10): installable app, share my shelf (F9, J7), the
// person view (F8), and the weekend prompt's link opening Add (F7.2).
// Invented people and titles; Priya owns College crew with Jonah; Tess is in
// no group.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);

test("the app is installable: a manifest and its icons", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest).toMatchObject({ name: "Good Word", start_url: "/shelf", display: "standalone" });
  for (const icon of manifest.icons as Array<{ src: string }>) {
    const response = await request.get(icon.src);
    expect(response.status(), icon.src).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
});

test.describe("P1 extras", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  let tess: TestUser;
  const crew = randomUUID();

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    tess = await createUser("Tess");
    users.push(priya, jonah, tess);
    await admin().from("groups").insert({ id: crew, name: "College crew", owner_id: priya.id, color: 1 });
    const members = await admin()
      .from("group_members")
      .insert([
        { group_id: crew, user_id: priya.id, role: "owner", welcome_seen_at: new Date().toISOString(), joined_at: new Date(Date.now() - 60_000).toISOString() },
        { group_id: crew, user_id: jonah.id, role: "member", welcome_seen_at: new Date().toISOString(), joined_at: new Date().toISOString() },
      ]);
    if (members.error) throw members.error;
    await admin().from("invites").insert({ group_id: crew, code: randomUUID().replaceAll("-", ""), created_by: priya.id });
    const { data: title, error } = await admin()
      .from("titles")
      .insert({ tmdb_id: base, media_type: "tv", title: "The Night Ferry", year: 2024, genres: [{ id: 1, name: "Drama" }], accent: "plum" })
      .select("id")
      .single();
    if (error) throw error;
    const words = await admin()
      .from("good_words")
      .insert([
        { user_id: priya.id, title_id: title.id, note: "ep 3 is where it gets you" },
        { user_id: jonah.id, title_id: title.id, note: "the lighthouse episode" },
      ])
      .select("id");
    if (words.error) throw words.error;
    const shared = await admin().from("good_word_groups").insert(words.data.map((w) => ({ good_word_id: w.id, group_id: crew })));
    if (shared.error) throw shared.error;
  });

  test.afterAll(async () => {
    await deleteUsers(users.filter((u) => u.id));
    await admin().from("titles").delete().eq("tmdb_id", base);
  });

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    return page;
  }

  test("a share link that doesn't exist is a plain 404, and noindex", async ({ request }) => {
    const response = await request.get("/s/not-a-real-link-at-all");
    expect(response.status()).toBe(404);
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("share my shelf: off by default, read-only for anyone with the link, and off stops it", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/you/settings#share");
    const toggle = page.getByRole("switch", { name: "Share my shelf" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    const field = page.getByRole("textbox", { name: "Your link" });
    await expect(field).toHaveValue(/\/s\/[A-Za-z0-9_-]{24}$/);
    const link = new URL(await field.inputValue()).pathname;
    await expectNoViolations(page);

    // Someone outside Good Word opens it.
    const visitor = await (await browser.newContext()).newPage();
    const response = await visitor.goto(link);
    expect(response?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Priya's good words");
    await expect(visitor.getByRole("listitem").first()).toContainText("The Night Ferry");
    await expect(visitor.getByText("“ep 3 is where it gets you”").filter({ visible: true })).toBeVisible();
    await expect(visitor.getByText("lighthouse")).toHaveCount(0);
    await expect(visitor.getByText("College crew")).toHaveCount(0);
    await expect(visitor.getByRole("link", { name: "Made with Good Word" })).toHaveAttribute("href", "/");
    await expectNoViolations(visitor);

    // Priya sees it was opened, then turns it off: the link stops at once.
    await page.reload();
    await expect(page.getByText("Opened 1 time").filter({ visible: true })).toBeVisible();
    await page.getByRole("switch", { name: "Share my shelf" }).click();
    await expect(page.getByRole("textbox", { name: "Your link" })).toHaveCount(0);
    await expect.poll(async () => (await admin().from("share_links").select("enabled").eq("user_id", priya.id).single()).data?.enabled).toBe(false);
    expect((await visitor.goto(link))?.status()).toBe(404);
  });

  test("person view: someone's good words in groups you share, and nothing otherwise", async ({ browser }) => {
    const page = await signedIn(browser, jonah, `/people/${priya.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Priya's good words");
    await expect(page.getByRole("main").getByRole("link", { name: /^The Night Ferry/ })).toBeVisible();
    await expectNoViolations(page);

    const outsider = await signedIn(browser, tess, `/people/${priya.id}`);
    await expect(outsider.getByText("The Night Ferry")).toHaveCount(0);
    await expect(outsider.getByText("ep 3 is where it gets you")).toHaveCount(0);
  });

  test("the weekend prompt's button opens Add, once", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/shelf?add=1&ref=nudge_email");
    await expect(page.getByRole("dialog", { name: "Put in a good word" })).toBeVisible();
    await expect(page).not.toHaveURL(/add=1/);
    await expect(page).not.toHaveURL(/ref=/);
  });
});
