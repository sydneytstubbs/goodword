import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 18 acceptance (PRD F16.5, slice 18): conversations under a good word,
// on two phones, behind the home_enabled flag. Priya and Mo are each Jonah's
// friend, and not each other's; Bea knows nobody. Jonah shared The Night
// Ferry with friends. Invented titles go straight into the title cache.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const ferry = { type: "tv", tmdbId: base, name: "The Night Ferry" };

test.describe("conversations under a good word", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  let mo: TestUser;
  let bea: TestUser;
  let word = "";
  const pages: Page[] = [];

  async function befriend(a: TestUser, b: TestUser) {
    const [low, high] = [a.id, b.id].sort();
    await admin().from("friendships").insert({ user_low: low, user_high: high, status: "accepted", requested_by: a.id, accepted_at: new Date().toISOString() });
  }

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    mo = await createUser("Mo");
    bea = await createUser("Bea");
    users.push(priya, jonah, mo, bea);
    await admin().from("profiles").update({ home_enabled: true }).in("user_id", users.map((u) => u.id));
    await befriend(priya, jonah);
    await befriend(jonah, mo);
    const { data, error } = await admin()
      .from("titles")
      .insert({ tmdb_id: ferry.tmdbId, media_type: ferry.type, title: ferry.name, year: 2024, genres: [{ id: 18, name: "Drama" }], accent: "plum" })
      .select("id")
      .single();
    if (error) throw error;
    const at = new Date(Date.now() - 3_600_000).toISOString();
    const { data: gw } = await admin()
      .from("good_words")
      .insert({ user_id: jonah.id, title_id: data.id, note: "the ferry scene", created_at: at, friends_shared_at: at })
      .select("id")
      .single();
    word = gw!.id;
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
    return page;
  }

  const path = () => `/title/${ferry.type}/${ferry.tmdbId}/conversation?word=${word}`;

  test("on two phones: a friend comments under Jonah's good word, and he sees it", async ({ browser }) => {
    const jonahPage = await signedIn(browser, jonah, path());
    await expect(jonahPage.getByText("Your good word").filter({ visible: true }).first()).toBeVisible();
    await expect(jonahPage.getByText("Everyone who can see your good word will see this").first()).toBeVisible();

    const priyaPage = await signedIn(browser, priya, path());
    await expect(priyaPage.getByText("Jonah's good word").filter({ visible: true }).first()).toBeVisible();
    await expect(priyaPage.getByText("Everyone who can see Jonah's good word will see this").first()).toBeVisible();
    const field = priyaPage.getByRole("textbox", { name: "Comment" });
    await expect(field).toHaveAttribute("placeholder", "Say something about this…");
    await expectNoViolations(priyaPage);

    // Mentions offer only people Priya knows who can see it: Jonah, never Mo.
    await field.pressSequentially("@");
    await expect(priyaPage.getByRole("option")).toHaveCount(1);
    await priyaPage.getByRole("option", { name: "Jonah" }).click();
    await field.pressSequentially("the lighthouse bit got me");
    await priyaPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(priyaPage.getByText("Sending…")).toHaveCount(0);

    // Live delivery needs a websocket, which this test environment's proxy can't
    // open (J6 hits the same limit), so Jonah reloads here; on a phone it
    // arrives on its own. Who can listen is covered by tests/rls-word-conversations.
    await jonahPage.reload();
    await expect(jonahPage.getByRole("article", { name: /^Priya/ })).toContainText("the lighthouse bit got me");
  });

  test("Mo, Jonah's friend only, reads Priya's comment there and can mention her", async ({ browser }) => {
    const moPage = await signedIn(browser, mo, path());
    await expect(moPage.getByRole("article", { name: /^Priya/ })).toContainText("the lighthouse bit got me");
    const field = moPage.getByRole("textbox", { name: "Comment" });
    await field.pressSequentially("@Pri");
    await expect(moPage.getByRole("option", { name: "Priya" })).toBeVisible();
    await moPage.getByRole("option", { name: "Priya" }).click();
    await field.pressSequentially("agreed");
    await moPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(moPage.getByText("Sending…")).toHaveCount(0);
  });

  test("Jonah hears about it in Activity, and the item opens the conversation", async ({ browser }) => {
    const page = await signedIn(browser, jonah, "/activity");
    const item = page.getByRole("link", { name: /commented on your good word for The Night Ferry/ });
    await expect(item).toBeVisible();
    await expectNoViolations(page);
    await item.click();
    await expect(page).toHaveURL(new RegExp(`conversation\\?word=${word}`));

    // Priya was mentioned under someone else's good word.
    const priyaPage = await signedIn(browser, priya, "/activity");
    await expect(priyaPage.getByRole("link", { name: /Mo mentioned you on The Night Ferry, under Jonah's good word/ })).toBeVisible();
  });

  test("Jonah, whose good word it is, can delete anyone's comment under it", async ({ browser }) => {
    const page = await signedIn(browser, jonah, path());
    await page.getByRole("button", { name: "More actions for Mo's comment" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByText("Comment deleted.").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("article", { name: /^Mo/ })).toHaveCount(0);
  });

  test("Home's conversation row opens the conversation under the good word", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/home");
    const card = page.getByRole("article", { name: "Jonah vouched for The Night Ferry" });
    await expect(card).toContainText("Priya: @Jonah the lighthouse bit got me");
    await card.getByRole("link", { name: /1 comment/ }).click();
    await expect(page).toHaveURL(new RegExp(`conversation\\?word=${word}`));
  });

  test("someone who can't see the good word gets a plain 404", async ({ browser }) => {
    const page = await signedIn(browser, bea, "/you");
    await page.goto(path());
    await expect(page.getByRole("heading", { level: 1, name: "We couldn't find that page" })).toBeAttached();
    await expect(page.getByText("Jonah")).toHaveCount(0);
  });
});
