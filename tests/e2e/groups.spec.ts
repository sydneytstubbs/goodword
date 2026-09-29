import { expect, test, type Browser, type Page } from "@playwright/test";
import { createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 2 acceptance (PRD F2, slice 2): one person creates and invites,
// another joins from the link; privacy between groups; owner actions.
test.describe("groups", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let tess: TestUser;
  let jonahEmail: TestUser;
  let groupId = "";
  let inviteLink = "";

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    tess = await createUser("Tess");
    jonahEmail = await createUser("Jonah", { onboarded: false });
    users.push(priya, tess, jonahEmail);
  });

  test.afterAll(async () => deleteUsers(users));

  async function signedIn(browser: Browser, user: TestUser, next = "/shelf"): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    return page;
  }

  test("with no groups, the shelf offers to start one", async ({ browser }) => {
    const page = await signedIn(browser, priya);
    await expect(page).toHaveURL(/\/shelf$/);
    await expect(page.getByRole("heading", { name: "No groups yet" })).toBeVisible();
    await expectNoViolations(page);
    await page.getByRole("link", { name: "Start a group" }).click();
    await expect(page).toHaveURL(/\/groups\/new$/);
  });

  test("create a group: one field, then the invite card", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/groups/new");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start a group");
    await expectNoViolations(page);

    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page.getByText("Give your group a name.")).toBeVisible();

    await page.getByLabel("Name your group").fill("College crew");
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
    groupId = page.url().split("/").pop()!;

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("College crew");
    await expect(page.getByRole("heading", { level: 2, name: "Invite your people" })).toBeVisible();
    inviteLink = await page.getByLabel("Invite link").inputValue();
    expect(inviteLink).toMatch(/^http:\/\/localhost:3100\/join\/[A-Za-z0-9_-]{24}$/);
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(page.getByText("Priya · You · Owner")).toBeVisible();
    await expectNoViolations(page);

    // My shelf is a main nav item, listing your groups (PRD F5.3).
    await page.getByRole("link", { name: "My shelf" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your shelf");
    await expect(page.getByRole("heading", { level: 2, name: "Your shelf is empty" })).toBeVisible();
    await expect(page.getByRole("link", { name: /College crew/ })).toHaveAttribute("href", `/shelf/${groupId}`);
    await expectNoViolations(page);
  });

  test("a signed-out friend joins from the link, through sign-in, onto the shelf", async ({ page }) => {
    const path = new URL(inviteLink).pathname;
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Priya invited you to College crew.");
    await expect(page.getByText("1 person is already sharing what they'd watch.")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expectNoViolations(page);

    await page.getByRole("link", { name: "Join College crew" }).click();
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await expect(page.getByText("Joining College crew")).toBeVisible();
    await expectNoViolations(page);

    // The email link, carrying the same next.
    const next = decodeURIComponent(new URL(page.url()).searchParams.get("next")!);
    await openMagicLink(page, jonahEmail, next);
    await expect(page).toHaveURL(/\/welcome/);
    await page.getByLabel("Your name").fill("Jonah");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL(new RegExp(`/shelf/${groupId}$`));
    await expect(page.getByText("You're in. Here's what College crew vouches for.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
    await expectNoViolations(page);

    // Shown once per group.
    await page.reload();
    await expect(page.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
    await expect(page.getByText("You're in. Here's what College crew vouches for.")).toHaveCount(0);
  });

  test("opening the link again as a member goes straight to the shelf", async ({ browser }) => {
    const page = await signedIn(browser, jonahEmail);
    await page.goto(new URL(inviteLink).pathname);
    await expect(page).toHaveURL(new RegExp(`/shelf/${groupId}$`));
    await expect(page.getByText("You're already in College crew.")).toBeVisible();
  });

  test("someone outside the group sees nothing of it", async ({ browser }) => {
    const page = await signedIn(browser, tess);
    for (const path of [`/shelf/${groupId}`, `/groups/${groupId}`]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 2, name: "You're not in this group" })).toBeVisible();
      const text = await page.locator("body").innerText();
      expect(text).not.toContain("College crew");
      expect(text).not.toContain("Priya");
      expect(text).not.toContain("Jonah");
      expect(await page.content()).not.toContain("College crew");
    }
    await expectNoViolations(page);
  });

  test("the switcher and invite sheet on the shelf", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/shelf/${groupId}`);
    await page.getByRole("button", { name: /Switch shelf/ }).click();
    await expect(page.getByRole("link", { name: /All groups/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Invite to College crew" }).click();
    await expect(page.getByRole("dialog", { name: "Invite your people" })).toBeVisible();
    await expect(page.getByLabel("Invite link")).toHaveValue(inviteLink);
    await expectNoViolations(page);
  });

  test("the owner renames, removes a member, and resets the link", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/groups/${groupId}`);
    await page.getByLabel("Group name").fill("College crew 2026");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("College crew 2026");

    await page.getByRole("button", { name: "Remove Jonah from College crew 2026" }).click();
    const remove = page.getByRole("dialog", { name: "Remove Jonah from College crew 2026?" });
    await expect(remove).toBeVisible();
    await expectNoViolations(page);
    await remove.getByRole("button", { name: "Remove Jonah" }).click();
    await expect(page.getByText("Jonah", { exact: true })).toHaveCount(0);

    const jonah = await signedIn(browser, jonahEmail);
    await jonah.goto(`/shelf/${groupId}`);
    await expect(jonah.getByRole("heading", { level: 2, name: "You're not in this group" })).toBeVisible();

    const old = inviteLink;
    await page.getByRole("button", { name: "Reset invite link" }).click();
    await page.getByRole("dialog", { name: "Reset the invite link?" }).getByRole("button", { name: "Reset link" }).click();
    await expect(page.getByText("Link reset. The old link no longer works.")).toBeVisible();
    await expect(page.getByLabel("Invite link")).not.toHaveValue(old);

    await jonah.goto(new URL(old).pathname);
    await expect(jonah.getByText("This invite link has expired. Ask Priya for a new one.")).toBeVisible();
    await expectNoViolations(jonah);
  });

  test("a link that never existed says so without naming anyone", async ({ page }) => {
    await page.goto("/join/aaaaaaaaaaaaaaaaaaaaaaaa");
    await expect(page.getByText("This invite link doesn't work. Ask whoever sent it for a new one.")).toBeVisible();
    await expectNoViolations(page);
  });

  test("the last member leaving deletes the group", async ({ browser }) => {
    const page = await signedIn(browser, priya, `/groups/${groupId}`);
    await page.getByRole("button", { name: "Leave group" }).click();
    const dialog = page.getByRole("dialog", { name: "Leave College crew 2026?" });
    await expect(dialog.getByText("You're the only member, so leaving deletes College crew 2026.", { exact: false })).toBeVisible();
    await dialog.getByRole("button", { name: "Leave and delete" }).click();
    await expect(page).toHaveURL(/\/shelf$/);
    await expect(page.getByText("College crew 2026 was deleted.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "No groups yet" })).toBeVisible();
  });

  test("the owner deletes a group with the danger dialog", async ({ browser }) => {
    const page = await signedIn(browser, tess, "/groups/new");
    await page.getByLabel("Name your group").fill("The girls");
    await page.getByRole("button", { name: "Create group" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The girls");
    await page.getByRole("button", { name: "Delete group" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete The girls?" });
    await expect(dialog.getByText("This removes the group for 1 person and can't be undone.")).toBeVisible();
    await dialog.getByRole("button", { name: "Delete The girls" }).click();
    await expect(page).toHaveURL(/\/shelf$/);
    await expect(page.getByText("The girls was deleted.")).toBeVisible();
  });
});
