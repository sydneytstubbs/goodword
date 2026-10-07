import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Friends (PRD F16.1, J8 steps 1 and 2), behind the home_enabled flag
// (F16.10). Two people on two "phones": a friend link from one, accepted by
// the other; a request from a group, accepted from Activity; and nothing new
// for anyone without the flag.
test.describe("friends", () => {
  test.skip(!live, "needs the Supabase project");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  let tess: TestUser;
  let mo: TestUser;
  let bea: TestUser;
  const crew = randomUUID();

  async function flagOn(...people: TestUser[]) {
    await admin().from("profiles").update({ home_enabled: true }).in("user_id", people.map((p) => p.id));
  }

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    await page.waitForURL((u) => u.pathname === next.split("?")[0]);
    return page;
  }

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    tess = await createUser("Tess");
    mo = await createUser("Mo");
    bea = await createUser("Bea");
    users.push(priya, jonah, tess, mo, bea);
    await flagOn(priya, jonah, tess, mo);
    // Tess and Mo share College crew; Bea is in it too, without the flag.
    await admin().from("groups").insert({ id: crew, name: "College crew", owner_id: tess.id, color: 1 });
    await admin()
      .from("group_members")
      .insert([tess, mo, bea].map((u, i) => ({ group_id: crew, user_id: u.id, role: i === 0 ? "owner" : "member", welcome_seen_at: new Date().toISOString() })));
    await admin().from("invites").insert({ group_id: crew, code: randomUUID().replaceAll("-", ""), created_by: tess.id });
  });

  test.afterAll(async () => {
    await deleteUsers(users);
  });

  test("J8: a friend link makes two people friends in under 90 seconds", async ({ browser }) => {
    const started = Date.now();
    const priyaPage = await signedIn(browser, priya, "/you/friends");
    await expect(priyaPage.getByRole("heading", { level: 1, name: "Friends" })).toBeVisible();
    await expect(priyaPage.getByRole("heading", { name: "No friends yet" })).toBeVisible();
    await expectNoViolations(priyaPage);
    const link = await priyaPage.getByRole("textbox", { name: "Friend link", exact: true }).inputValue();
    expect(link).toMatch(/\/join\/[A-Za-z0-9_-]{24}$/);

    // Jonah opens it signed out, on his own phone.
    const jonahPage = await (await browser.newContext()).newPage();
    await jonahPage.goto(new URL(link).pathname);
    await expect(jonahPage.getByRole("heading", { level: 1, name: "Priya wants to be friends on Good Word" })).toBeVisible();
    await expectNoViolations(jonahPage);
    await jonahPage.getByRole("link", { name: "Add Priya as a friend" }).click();
    await expect(jonahPage.getByText("Adding Priya as a friend")).toBeVisible();

    // He signs in from the email; the link is remembered.
    await openMagicLink(jonahPage, jonah, `${new URL(link).pathname}/accept`);
    // He lands on Home (DS 5.20), and Priya is on his Friends screen.
    await jonahPage.waitForURL("**/home");
    await expect(jonahPage.getByText("You and Priya are friends now.")).toBeVisible();
    await jonahPage.goto("/you/friends");
    await expect(jonahPage.getByRole("region", { name: "Your friends" }).getByText("Priya", { exact: true })).toBeVisible();
    expect(Date.now() - started).toBeLessThan(90_000);

    // Priya hears about it in Activity, and sees Jonah on her Friends screen.
    await priyaPage.goto("/activity");
    await expect(priyaPage.getByRole("link", { name: /Jonah accepted your friend request/ })).toBeVisible();
    await priyaPage.goto("/you/friends");
    await expect(priyaPage.getByRole("region", { name: "Your friends" }).getByText("Jonah", { exact: true })).toBeVisible();
  });

  test("a request from your groups, accepted from Activity", async ({ browser }) => {
    const tessPage = await signedIn(browser, tess, "/you/friends");
    const fromGroups = tessPage.getByRole("region", { name: "People from your groups" });
    await expect(fromGroups.getByText("In College crew").first()).toBeVisible();
    await fromGroups.getByRole("button", { name: "Add Mo" }).click();
    await expect(tessPage.getByText("Request sent to Mo.")).toBeVisible();
    await expect(tessPage.getByRole("region", { name: "Requested" }).getByText("Mo", { exact: true })).toBeVisible();

    const moPage = await signedIn(browser, mo, "/activity");
    await expect(moPage.getByText("Tess wants to be friends").first()).toBeVisible();
    await expectNoViolations(moPage);
    await moPage.getByRole("button", { name: "Accept Tess" }).click();
    await expect(moPage.getByText("You and Tess are friends now.")).toBeVisible();

    await tessPage.reload();
    await expect(tessPage.getByRole("region", { name: "Your friends" }).getByText("Mo", { exact: true })).toBeVisible();
    await expect(tessPage.getByRole("region", { name: "Requested" })).toHaveCount(0);
  });

  test("removing a friend asks first, and is quiet", async ({ browser }) => {
    const tessPage = await signedIn(browser, tess, "/you/friends");
    await tessPage.getByRole("button", { name: "More actions for Mo" }).click();
    await tessPage.getByRole("menuitem", { name: "Remove friend" }).click();
    const dialog = tessPage.getByRole("dialog", { name: "Remove Mo as a friend?" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Remove friend" }).click();
    await expect(tessPage.getByText("Removed Mo as a friend.")).toBeVisible();
    // Mo shares a group with Tess, so he's back under People from your groups.
    await tessPage.reload();
    await expect(tessPage.getByRole("region", { name: "People from your groups" }).getByRole("button", { name: "Add Mo" })).toBeVisible();
  });

  test("with the flag, a group's list offers its people once", async ({ browser }) => {
    const moPage = await signedIn(browser, mo, `/list/${crew}`);
    const prompt = moPage.getByRole("complementary", { name: "Add friends from College crew" });
    await expect(prompt).toBeVisible();
    await expect(prompt.getByText("Add the people here you're not friends with yet.")).toBeVisible();
    await prompt.getByRole("button", { name: "Not now" }).click();
    await expect(prompt).toHaveCount(0);
    await moPage.reload();
    await expect(moPage.getByRole("complementary", { name: "Add friends from College crew" })).toHaveCount(0);
  });
});
