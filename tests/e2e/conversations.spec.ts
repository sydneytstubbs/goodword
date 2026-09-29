import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 6 acceptance (PRD F13, F14, J6, slice 6): on two devices, a mention
// shows in Activity within seconds, a spoiler stays covered (and out of the
// page) until revealed, comments arrive live, and a member of another group
// can't see or reach the conversation. Also: any title can have a
// conversation, edit, delete with Undo, and a comment that didn't send.
// Priya owns College crew (Jonah, Tess) and The girls (Bea). Invented titles
// go straight into the title cache, so TMDB is never asked about them.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);
const ferry = { type: "tv", tmdbId: base, name: "The Night Ferry" };
const moth = { type: "movie", tmdbId: base + 1, name: "Moth Season" };

test.describe("conversations", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  let tess: TestUser;
  let bea: TestUser;
  const crew = randomUUID();
  const girls = randomUUID();
  const pages: Page[] = [];

  async function group(id: string, name: string, owner: TestUser, members: TestUser[]) {
    await admin().from("groups").insert({ id, name, owner_id: owner.id, color: 1 });
    await admin()
      .from("group_members")
      .insert({ group_id: id, user_id: owner.id, role: "owner", welcome_seen_at: new Date().toISOString() });
    // Members join after the owner, as they would through an invite.
    await admin()
      .from("group_members")
      .insert(members.map((m) => ({ group_id: id, user_id: m.id, role: "member", welcome_seen_at: new Date().toISOString() })));
    await admin().from("invites").insert({ group_id: id, code: randomUUID().replaceAll("-", ""), created_by: owner.id });
  }

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    tess = await createUser("Tess");
    bea = await createUser("Bea");
    users.push(priya, jonah, tess, bea);
    await group(crew, "College crew", priya, [jonah, tess]);
    await group(girls, "The girls", priya, [bea]);
    const { data, error } = await admin()
      .from("titles")
      .insert([
        { tmdb_id: ferry.tmdbId, media_type: ferry.type, title: ferry.name, year: 2024, genres: [{ id: 18, name: "Drama" }], accent: "plum" },
        { tmdb_id: moth.tmdbId, media_type: moth.type, title: moth.name, year: 2023, genres: [{ id: 27, name: "Horror" }], accent: "clay" },
      ])
      .select("id, tmdb_id");
    if (error) throw error;
    const ferryId = data!.find((t) => t.tmdb_id === ferry.tmdbId)!.id;
    // Priya vouched for The Night Ferry in both groups.
    const { data: gw } = await admin().from("good_words").insert({ user_id: priya.id, title_id: ferryId, note: "ep 3 is where it gets you" }).select("id").single();
    await admin().from("good_word_groups").insert([
      { good_word_id: gw!.id, group_id: crew },
      { good_word_id: gw!.id, group_id: girls },
    ]);
  });

  test.afterAll(async () => {
    for (const page of pages) await page.context().close();
    await deleteUsers(users);
    await admin().from("titles").delete().in("tmdb_id", [ferry.tmdbId, moth.tmdbId]);
  });

  async function signedIn(browser: Browser, user: TestUser, next: string, viewport?: { width: number; height: number }): Promise<Page> {
    const page = await (await browser.newContext(viewport ? { viewport } : {})).newPage();
    pages.push(page);
    await openMagicLink(page, user, next);
    return page;
  }

  const titlePath = (t: { type: string; tmdbId: number }) => `/title/${t.type}/${t.tmdbId}`;

  /** The bell (below 1024px) or the rail's Activity link, with its unread count. */
  function activityLink(page: Page, count: number) {
    return page.getByRole("link", { name: new RegExp(`^Activity,? ${count} unread$`) }).filter({ visible: true });
  }

  async function mention(page: Page, typed: string, name: string) {
    const field = page.getByRole("textbox", { name: "Comment" });
    await field.pressSequentially(typed);
    await page.getByRole("option", { name }).click();
  }

  test("J6: a mention reaches Activity within seconds, and a spoiler stays covered until revealed", async ({ browser }) => {
    const priyaPage = await signedIn(browser, priya, titlePath(ferry));
    // Jonah and Tess joined College crew, and Bea joined The girls.
    await expect(activityLink(priyaPage, 3)).toBeVisible();
    // Priya is in both groups: a chip for each conversation.
    await expect(priyaPage.getByRole("list", { name: "Conversations in your groups" }).getByRole("link")).toHaveText(["College crew", "The girls"]);

    const tessPage = await signedIn(browser, tess, `${titlePath(ferry)}?group=${crew}`);
    await expect(tessPage.getByRole("heading", { name: "Talk about it in College crew" })).toBeVisible();
    await expect(tessPage.getByText("No one's said anything about this yet. Start the conversation.")).toBeVisible();
    await tessPage.getByRole("link", { name: "Add a comment…" }).click();
    await expect(tessPage).toHaveURL(/\/conversation\?group=.*compose=1/);
    await expect(tessPage.getByRole("textbox", { name: "Comment" })).toBeFocused();
    // A series: the one-time spoiler hint.
    await expect(tessPage.getByText("Talking about a specific episode? Mark it as a spoiler.")).toBeVisible();

    await tessPage.getByRole("textbox", { name: "Comment" }).pressSequentially("just finished ep 6, ");
    await tessPage.getByRole("textbox", { name: "Comment" }).pressSequentially("@Pri");
    // Only College crew, and never Tess herself.
    await expect(tessPage.getByRole("option")).toHaveCount(1);
    await expect(tessPage.getByRole("option", { name: "Priya" })).toBeVisible();
    await tessPage.getByRole("option", { name: "Priya" }).click();
    await tessPage.getByRole("textbox", { name: "Comment" }).pressSequentially("you were SO right");
    await tessPage.getByRole("button", { name: "Spoiler" }).click();
    await tessPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(tessPage.getByRole("article", { name: /^Tess/ })).toContainText("you were SO right");
    await expect(tessPage.getByText("Marked as spoiler")).toBeVisible();
    await expect(tessPage.getByText("Sending…")).toHaveCount(0);

    // Priya's bell updates live, without a reload.
    await expect(activityLink(priyaPage, 4)).toBeVisible({ timeout: 10_000 });
    await activityLink(priyaPage, 4).click();
    const item = priyaPage.getByRole("link", { name: /Tess mentioned you on The Night Ferry in College crew/ });
    await expect(item).toBeVisible();
    await expect(item).toContainText("a spoiler comment");
    expect(await priyaPage.content()).not.toContain("SO right");
    await expectNoViolations(priyaPage);

    await item.click();
    await expect(priyaPage).toHaveURL(/\/conversation\?group=.*comment=/);
    const cover = priyaPage.getByRole("button", { name: "Spoiler from Tess · Tap to reveal" });
    await expect(cover).toBeVisible();
    // Not in the page, not in the accessibility tree, until revealed.
    expect(await priyaPage.content()).not.toContain("SO right");
    await expectNoViolations(priyaPage);
    await cover.click();
    await expect(priyaPage.getByRole("article", { name: /^Tess/ })).toContainText("you were SO right");

    // Priya replies; Tess, still in the conversation, sees it arrive live.
    await mention(priyaPage, "@Te", "Tess");
    await priyaPage.getByRole("textbox", { name: "Comment" }).pressSequentially("the ferry scene");
    await priyaPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(tessPage.getByRole("article", { name: /^Priya/ })).toContainText("@Tess the ferry scene", { timeout: 5_000 });
    await expect(tessPage.getByText("Mentions you")).toBeAttached();
    // Opening it marked Priya's mention read.
    await priyaPage.goto("/activity");
    await expect(activityLink(priyaPage, 3)).toBeVisible();

    // Jonah sees "2 comments" on the card, and Tess's spoiler covered.
    const jonahPage = await signedIn(browser, jonah, `/shelf/${crew}`);
    await expect(jonahPage.getByRole("link", { name: /The Night Ferry.*2 comments\. New comments\./ })).toBeVisible();
    await jonahPage.getByRole("link", { name: /The Night Ferry/ }).first().click();
    await jonahPage.getByRole("link", { name: "See all 2 comments" }).click();
    await expect(jonahPage.getByRole("button", { name: "Spoiler from Tess · Tap to reveal" })).toBeVisible();
    await expect(jonahPage.getByRole("article", { name: /^Priya/ })).toContainText("the ferry scene");
    expect(await jonahPage.content()).not.toContain("SO right");
    await expectNoViolations(jonahPage);
  });

  test("a member of another group can't see or reach College crew's conversation", async ({ browser }) => {
    const beaPage = await signedIn(browser, bea, `${titlePath(ferry)}/conversation?group=${crew}`);
    await expect(beaPage.getByRole("heading", { level: 2, name: "You're not in this group" })).toBeVisible();
    expect(await beaPage.content()).not.toContain("College crew");
    expect(await beaPage.content()).not.toContain("the ferry scene");

    // Title detail shows only The girls' conversation, which is empty.
    await beaPage.goto(`${titlePath(ferry)}?group=${crew}`);
    await expect(beaPage.getByRole("heading", { name: "Talk about it in The girls" })).toBeVisible();
    await expect(beaPage.getByRole("list", { name: "Conversations in your groups" })).toHaveCount(0);
    expect(await beaPage.content()).not.toContain("College crew");
    await expect(beaPage.getByText("No one's said anything about this yet. Start the conversation.")).toBeVisible();
  });

  test("any title can have a conversation: the first comment tells the rest of the group", async ({ browser }) => {
    const jonahPage = await signedIn(browser, jonah, titlePath(moth));
    await expect(jonahPage.getByText("None of your groups have vouched for this yet.")).toBeVisible();
    await jonahPage.getByRole("link", { name: "Add a comment…" }).click();
    await jonahPage.getByRole("textbox", { name: "Comment" }).fill("anyone seen this?");
    await jonahPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(jonahPage.getByText("Sending…")).toHaveCount(0);

    const tessPage = await signedIn(browser, tess, "/activity");
    await expect(tessPage.getByRole("link", { name: /Jonah started a conversation about Moth Season in College crew/ })).toBeVisible();
    await expectNoViolations(tessPage);
  });

  test("edit shows edited, delete has Undo, and a comment that didn't send keeps its text", async ({ browser }) => {
    const jonahPage = await signedIn(browser, jonah, `${titlePath(moth)}/conversation?group=${crew}`);
    const mine = jonahPage.getByRole("article", { name: /^Jonah/ });
    await expect(mine).toContainText("anyone seen this?");

    await jonahPage.getByRole("button", { name: "More actions for Jonah's comment" }).click();
    await jonahPage.getByRole("menuitem", { name: "Edit" }).click();
    await jonahPage.getByRole("textbox", { name: "Edit your comment" }).fill("anyone seen this yet?");
    await jonahPage.getByRole("button", { name: "Save" }).click();
    await expect(mine).toContainText("anyone seen this yet?");
    await expect(mine).toContainText("edited");

    await jonahPage.getByRole("button", { name: "More actions for Jonah's comment" }).click();
    await jonahPage.getByRole("menuitem", { name: "Delete" }).click();
    await expect(mine).toHaveCount(0);
    await jonahPage.getByRole("button", { name: "Undo" }).click();
    await expect(mine).toContainText("anyone seen this yet?");
    await jonahPage.waitForTimeout(1000);
    await jonahPage.reload();
    await expect(jonahPage.getByRole("article", { name: /^Jonah/ })).toContainText("anyone seen this yet?");

    // Offline: "Didn't send." with Retry, and the text is kept.
    await jonahPage.context().setOffline(true);
    await jonahPage.getByRole("textbox", { name: "Comment" }).fill("ok starting it tonight");
    await jonahPage.getByRole("button", { name: "Send", exact: true }).click();
    await expect(jonahPage.getByText("Didn't send.")).toBeVisible();
    await jonahPage.context().setOffline(false);
    await jonahPage.getByRole("button", { name: "Retry" }).click();
    await expect(jonahPage.getByText("Didn't send.")).toHaveCount(0);
    await jonahPage.reload();
    await expect(jonahPage.getByText("ok starting it tonight")).toBeVisible();
    await expectNoViolations(jonahPage);
  });
});
