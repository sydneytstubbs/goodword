import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 19 (PRD F16.4, and F16.6's acceptance criteria by page and URL): one
// title page, showing each viewer only what they may see, behind the
// home_enabled flag. Priya, Jonah, and Tess are all friends; Mo is Jonah's
// friend only; Bea is nobody's friend. Each shared The Night Ferry with
// friends, and Priya commented under Jonah's. Tess has no flag.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const ferry = { type: "tv", tmdbId: base, name: "The Night Ferry" };
const path = `/title/${ferry.type}/${ferry.tmdbId}`;

test.describe("the title page", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  let tess: TestUser;
  let mo: TestUser;
  let bea: TestUser;
  const words: Record<string, string> = {};
  const pages: Page[] = [];

  async function befriend(a: TestUser, b: TestUser) {
    const [low, high] = [a.id, b.id].sort();
    await admin().from("friendships").insert({ user_low: low, user_high: high, status: "accepted", requested_by: a.id, accepted_at: new Date().toISOString() });
  }

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    tess = await createUser("Tess");
    mo = await createUser("Mo");
    bea = await createUser("Bea");
    users.push(priya, jonah, tess, mo, bea);
    await admin().from("profiles").update({ home_enabled: true }).in("user_id", [priya.id, jonah.id, mo.id, bea.id]);
    await befriend(priya, jonah);
    await befriend(priya, tess);
    await befriend(jonah, tess);
    await befriend(jonah, mo);
    const { data, error } = await admin()
      .from("titles")
      .insert({ tmdb_id: ferry.tmdbId, media_type: ferry.type, title: ferry.name, year: 2024, genres: [{ id: 18, name: "Drama" }], accent: "plum" })
      .select("id")
      .single();
    if (error) throw error;
    const notes: Record<string, string> = { priya: "ep 3 is where it gets you", jonah: "the ferry scene", tess: "strange and perfect", bea: "the lighthouse" };
    for (const [name, user] of Object.entries({ priya, jonah, tess, bea })) {
      const at = new Date(Date.now() - 3_600_000 * (Object.keys(words).length + 1)).toISOString();
      const { data: gw } = await admin()
        .from("good_words")
        .insert({ user_id: user.id, title_id: data.id, note: notes[name], created_at: at, friends_shared_at: at })
        .select("id")
        .single();
      words[name] = gw!.id;
    }
    // Priya's comment under Jonah's good word, through the app's own function.
    const conversation = await admin()
      .from("conversations")
      .insert({ title_id: data.id, scope: "good_word", good_word_id: words.jonah, author_id: jonah.id })
      .select("id")
      .single();
    await admin()
      .from("comments")
      .insert({ id: randomUUID(), title_id: data.id, user_id: priya.id, body: "the lighthouse bit got me", conversation_id: conversation.data!.id });
  });

  test.afterAll(async () => {
    for (const page of pages) await page.context().close();
    await deleteUsers(users);
    await admin().from("titles").delete().eq("tmdb_id", ferry.tmdbId);
  });

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    pages.push(page);
    await openMagicLink(page, user, next);
    await page.waitForURL((u) => u.pathname === next);
    return page;
  }

  const goodWords = (page: Page) => page.getByRole("group", { name: "Good words" });

  test("Priya sees all three good words, hers first, and the conversation under Jonah's opens in place", async ({ browser }) => {
    const page = await signedIn(browser, priya, path);
    const section = goodWords(page);
    await expect(section.getByRole("listitem").filter({ has: page.getByRole("figure") })).toHaveCount(3);
    await expect(section.getByRole("figure").first()).toContainText("You");
    await expect(section).toContainText("the ferry scene");
    await expect(section).toContainText("strange and perfect");
    await expect(section).not.toContainText("the lighthouse”");
    // Where to watch comes with the title, before the good words (DS 5.7).
    const order = await page.getByRole("heading", { name: /^(Where to watch|Good words)$/ }).allTextContents();
    expect(order).toEqual(["Where to watch", "Good words"]);

    const toggle = section.getByRole("button", { name: /^1 comment.*Under Jonah's good word/ });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expectNoViolations(page);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(section.getByRole("list", { name: "Comments" })).toContainText("the lighthouse bit got me");
    await section.getByRole("link", { name: "See 1 comment" }).click();
    await expect(page).toHaveURL(new RegExp(`conversation\\?word=${words.jonah}`));
  });

  test("Bea sees only her own, with no count or hint of anyone else's", async ({ browser }) => {
    const page = await signedIn(browser, bea, path);
    const section = goodWords(page);
    await expect(section.getByRole("figure")).toHaveCount(1);
    await expect(section).toContainText("Nobody you know has vouched for this yet.");
    const text = await page.locator("body").innerText();
    for (const hidden of ["Priya", "Jonah", "Tess", "the ferry scene", "the lighthouse bit got me"]) expect(text).not.toContain(hidden);
    // And not by URL either.
    await page.goto(`${path}/conversation?word=${words.jonah}`);
    await expect(page.getByRole("heading", { level: 1, name: "We couldn't find that page" })).toBeAttached();
  });

  test("Mo sees Jonah's good word and Priya's comment under it, and neither Priya's nor Tess's", async ({ browser }) => {
    const page = await signedIn(browser, mo, path);
    const section = goodWords(page);
    await expect(section.getByRole("figure")).toHaveCount(1);
    await expect(section).toContainText("the ferry scene");
    await expect(section).not.toContainText("ep 3 is where it gets you");
    await expect(section).not.toContainText("strange and perfect");
    await section.getByRole("button", { name: /1 comment/ }).click();
    await expect(section.getByRole("list", { name: "Comments" })).toContainText("the lighthouse bit got me");

    // Jonah's name opens his person view: his good words Mo can see.
    await section.getByRole("link", { name: "Jonah" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Jonah's good words" })).toBeVisible();
    await expect(page.getByText("Your friend")).toBeVisible();
    await expect(page.getByRole("link", { name: /^The Night Ferry/ })).toBeVisible();
  });

});
