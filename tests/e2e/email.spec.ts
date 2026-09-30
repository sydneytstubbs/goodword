import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { unsubscribeToken } from "../../lib/email/secrets";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 7 (PRD F7.7, slice 7): Settings › Notifications, unsubscribing signed
// out with Undo, and good words from a digest link recording source
// "digest". Priya is in College crew with Jonah. The invented title has a
// TMDB id no real title uses. Needs the step 7 migration applied.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);

test.describe("email preferences", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let priya: TestUser;
  let jonah: TestUser;
  const crew = randomUUID();

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    jonah = await createUser("Jonah");
    users.push(priya, jonah);
    await admin().from("groups").insert({ id: crew, name: "College crew", owner_id: priya.id, color: 1 });
    await admin()
      .from("group_members")
      .insert([
        { group_id: crew, user_id: priya.id, role: "owner", welcome_seen_at: new Date().toISOString() },
        { group_id: crew, user_id: jonah.id, role: "member", welcome_seen_at: new Date().toISOString() },
      ]);
    await admin().from("invites").insert({ group_id: crew, code: randomUUID().replaceAll("-", ""), created_by: priya.id });
    const { error } = await admin()
      .from("titles")
      .insert({ tmdb_id: base, media_type: "tv", title: "The Night Ferry", year: 2024, genres: [{ id: 1, name: "Drama" }], accent: "plum" });
    if (error) throw error;
  });

  test.afterAll(async () => {
    await deleteUsers(users);
    await admin().from("titles").delete().eq("tmdb_id", base);
  });

  async function signedIn(browser: Browser, user: TestUser, next: string): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, user, next);
    return page;
  }

  const prefs = async (user: TestUser) =>
    (await admin().from("notification_prefs").select("digest, mention_email, group_joins").eq("user_id", user.id).single()).data;

  test("Settings › Notifications: switches save immediately and survive a refresh", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/you");
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/you\/settings$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
    const digest = page.getByRole("switch", { name: "Weekly digest" });
    await expect(digest).toHaveAttribute("aria-checked", "true");
    await expectNoViolations(page);

    await digest.click();
    await expect(digest).toHaveAttribute("aria-checked", "false");
    await expect.poll(async () => (await prefs(priya))?.digest).toBe(false);
    await page.reload();
    await expect(page.getByRole("switch", { name: "Weekly digest" })).toHaveAttribute("aria-checked", "false");

    // Keyboard: Space toggles the focused switch.
    await page.getByRole("switch", { name: "Weekly digest" }).focus();
    await page.keyboard.press("Space");
    await expect.poll(async () => (await prefs(priya))?.digest).toBe(true);
  });

  test("a failed save rolls back with Retry", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/you/settings");
    const mentions = page.getByRole("switch", { name: "Mentions" });
    await expect(mentions).toHaveAttribute("aria-checked", "true");
    await page.context().setOffline(true);
    await mentions.click();
    await expect(page.getByText("That didn't save. Check your connection and try again.").filter({ visible: true })).toBeVisible();
    await expect(mentions).toHaveAttribute("aria-checked", "true");
    await page.context().setOffline(false);
    await page.getByRole("button", { name: "Retry" }).click();
    await expect(mentions).toHaveAttribute("aria-checked", "false");
    await expect.poll(async () => (await prefs(priya))?.mention_email).toBe(false);
  });

  test("unsubscribe works signed out, confirms, and offers Undo", async ({ page }) => {
    await admin().from("notification_prefs").update({ digest: true }).eq("user_id", jonah.id);
    await page.goto(`/unsubscribe?token=${encodeURIComponent(unsubscribeToken(jonah.id, "digest"))}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're unsubscribed from the weekly digest.");
    await expect.poll(async () => (await prefs(jonah))?.digest).toBe(false);
    await expectNoViolations(page);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("You're getting the weekly digest again.");
    await expect.poll(async () => (await prefs(jonah))?.digest).toBe(true);
  });

  test("one-click unsubscribe from a mail app (RFC 8058)", async ({ request }) => {
    const token = encodeURIComponent(unsubscribeToken(jonah.id, "mention_email"));
    const response = await request.post(`/api/unsubscribe?token=${token}`, { form: { "List-Unsubscribe": "One-Click" } });
    expect(response.status()).toBe(200);
    expect((await prefs(jonah))?.mention_email).toBe(false);
    expect((await request.post("/api/unsubscribe?token=nonsense")).status()).toBe(400);
  });

  test("a bad unsubscribe link explains itself and changes nothing", async ({ page }) => {
    await page.goto(`/unsubscribe?token=${jonah.id}.digest.forged`);
    await expect(page.getByRole("heading", { name: "This link doesn't work" }).first()).toBeVisible();
    await expectNoViolations(page);
  });

  test("the email job refuses callers without the secret", async ({ request }) => {
    expect((await request.post("/api/email/run")).status()).toBe(401);
    expect((await request.post("/api/email/run", { headers: { Authorization: "Bearer guess" } })).status()).toBe(401);
  });

  test("a good word put in from a digest link records source digest", async ({ browser }) => {
    const page = await signedIn(browser, jonah, `/title/tv/${base}?ref=digest`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("The Night Ferry");
    // The parameter is kept for the session, then dropped from the address.
    await expect(page).toHaveURL(new RegExp(`/title/tv/${base}$`));
    await page.getByRole("main").getByRole("button", { name: "Put in a good word" }).click();
    const sheet = page.getByRole("dialog", { name: "Put in a good word" });
    await sheet.getByRole("button", { name: "Put in a good word" }).click();
    await expect(page.getByRole("button", { name: "Your good word" })).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => (await admin().from("good_words").select("source").eq("user_id", jonah.id).maybeSingle()).data?.source)
      .toBe("digest");
  });
});
