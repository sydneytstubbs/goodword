import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 8 (PRD F1, F11, 10.4, slice 8): Settings (account, your data), Help
// (FAQ, shortcuts, feedback, About with attributions), download my data,
// delete account with ownership passing on, privacy and terms, and security
// headers. Invented people and titles; Priya owns College crew with Jonah.

const base = 900_000_000 + Math.floor(Math.random() * 90_000_000);

test.describe("public trust pages", () => {
  test("privacy and terms are public, indexable, and accessible", async ({ page }) => {
    for (const [path, title] of [["/privacy", "Privacy"], ["/terms", "Terms"]] as const) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(response?.headers()["x-robots-tag"]).toBeUndefined();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expectNoViolations(page);
    }
  });

  test("every response carries the security headers", async ({ request }) => {
    for (const path of ["/", "/privacy", "/sign-in"]) {
      const headers = (await request.get(path)).headers();
      expect(headers["content-security-policy"], path).toContain("frame-ancestors 'none'");
      expect(headers["content-security-policy"], path).toContain("https://image.tmdb.org");
      expect(headers["strict-transport-security"], path).toContain("max-age=");
      expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
      expect(headers["x-frame-options"], path).toBe("DENY");
    }
  });
});

test.describe("settings and help", () => {
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
    await admin()
      .from("group_members")
      .insert([
        { group_id: crew, user_id: priya.id, role: "owner", welcome_seen_at: new Date().toISOString(), joined_at: new Date(Date.now() - 60_000).toISOString() },
        { group_id: crew, user_id: jonah.id, role: "member", welcome_seen_at: new Date().toISOString() },
      ]);
    await admin().from("invites").insert({ group_id: crew, code: randomUUID().replaceAll("-", ""), created_by: priya.id });
    const { data: title, error } = await admin()
      .from("titles")
      .insert({ tmdb_id: base, media_type: "tv", title: "The Night Ferry", year: 2024, genres: [{ id: 1, name: "Drama" }], accent: "plum" })
      .select("id")
      .single();
    if (error) throw error;
    const { data: gw } = await admin().from("good_words").insert({ user_id: priya.id, title_id: title.id, note: "ep 3 is where it gets you" }).select("id").single();
    await admin().from("good_word_groups").insert({ good_word_id: gw!.id, group_id: crew });
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

  test("Settings › Account: rename and change region", async ({ browser }) => {
    const page = await signedIn(browser, tess, "/you/settings");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(tess.email);
    await expectNoViolations(page);

    const name = page.getByRole("textbox", { name: "Name" });
    await name.fill("");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Add a name so friends know it's you.")).toBeVisible();
    await name.fill("Tess B");
    await page.getByRole("button", { name: "Save name" }).click();
    await expect(page.getByText("Name saved.")).toBeVisible();

    await page.getByRole("combobox", { name: "Region" }).selectOption("GB");
    await expect(page.getByText("Region saved.")).toBeVisible();
    await expect
      .poll(async () => (await admin().from("profiles").select("display_name, region").eq("user_id", tess.id).single()).data)
      .toEqual({ display_name: "Tess B", region: "GB" });
  });

  test("download my data holds your good words and only your groups", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/you/settings");
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download my data" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^good-word-\d{4}-\d{2}-\d{2}\.json$/);
    const body = JSON.parse(readFileSync(await file.path(), "utf8"));
    expect(body.profile).toMatchObject({ name: "Priya", email: priya.email });
    expect(body.groups).toEqual([expect.objectContaining({ name: "College crew", role: "owner" })]);
    expect(body.good_words).toEqual([expect.objectContaining({ title: "The Night Ferry", note: "ep 3 is where it gets you", groups: ["College crew"] })]);
    expect(JSON.stringify(body)).not.toContain(jonah.email);
  });

  test("download needs a signed-in person", async ({ request }) => {
    expect((await request.get("/api/me/export")).status()).toBe(401);
  });

  test("Help: questions, shortcuts, attributions, and feedback", async ({ browser }) => {
    const page = await signedIn(browser, tess, "/you");
    await page.getByRole("link", { name: "Help" }).first().click();
    await expect(page).toHaveURL(/\/you\/help$/);
    await expect(page.getByRole("heading", { name: "What's a good word?" })).toBeVisible();
    await expect(page.getByRole("img", { name: "The Movie Database (TMDB)" })).toBeVisible();
    await expect(page.getByText("This product uses the TMDB API but is not endorsed or certified by TMDB.")).toBeVisible();
    await expect(page.getByRole("img", { name: "JustWatch" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    await expectNoViolations(page);

    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByText("Write something first, then send.")).toBeVisible();
    await page.getByRole("textbox", { name: "Your feedback" }).fill("The shelf is lovely");
    await page.getByRole("checkbox", { name: "OK to follow up by email" }).check();
    await page.getByRole("button", { name: "Send feedback" }).click();
    await expect(page.getByText("Thanks. Sydney reads every one.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Your feedback" })).toHaveValue("");
    await expect
      .poll(async () => (await admin().from("feedback").select("message, may_contact").eq("user_id", tess.id)).data)
      .toEqual([{ message: "The shelf is lovely", may_contact: true }]);
  });

  test("keyboard shortcuts: ? opens them, g then a goes to Activity", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "desktop shortcuts");
    const page = await signedIn(browser, tess, "/you");
    await page.keyboard.press("?");
    await expect(page).toHaveURL(/\/you\/help#shortcuts$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Help");
    await page.keyboard.press("g");
    await page.keyboard.press("a");
    await expect(page).toHaveURL(/\/activity$/);
  });

  test("delete my account: ownership passes on and the person is gone", async ({ browser }) => {
    const page = await signedIn(browser, priya, "/you/settings");
    await page.getByRole("button", { name: "Delete account" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your account?" });
    await expect(dialog).toContainText("Groups you own pass to the member who's been there longest.");
    await expectNoViolations(page);
    await dialog.getByRole("button", { name: "Delete my account" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByText("Your account is deleted.")).toBeVisible();

    const { data: group } = await admin().from("groups").select("owner_id").eq("id", crew).single();
    expect(group?.owner_id).toBe(jonah.id);
    expect((await admin().auth.admin.getUserById(priya.id)).data.user).toBeNull();
    const { data: goodWords } = await admin().from("good_words").select("id").eq("user_id", priya.id);
    expect(goodWords).toEqual([]);
    users.splice(users.indexOf(priya), 1);
  });
});
