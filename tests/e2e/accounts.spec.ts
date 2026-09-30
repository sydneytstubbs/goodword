import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// Step 1 acceptance (PRD F1, DS 5.3). The screens that need no sign-in run
// anywhere. The signed-in flow uses the real Supabase project through the
// service key (no email is sent) and is skipped without those variables.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const live = Boolean(url && service && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test.describe("signed out", () => {
  test("app routes go to sign-in and remember where you were going", async ({ page }) => {
    await page.goto("/shelf");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fshelf$/);
  });

  test("sign-in: one field, one primary action, noindex, no axe violations", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Welcome to Good Word");
    const email = page.getByLabel("Email");
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expectNoViolations(page);
  });

  test("an incomplete email gets the error from the copy guide", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("priya@example");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByText("That email looks incomplete. Check for a missing @ or dot.").filter({ visible: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expectNoViolations(page);
  });

  test("an expired link shows the banner, with no axe violations", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=not-a-real-token&next=%2Fshelf");
    await expect(page).toHaveURL(/\/sign-in\?error=expired&next=%2Fshelf$/);
    await expect(page.getByText("This sign-in link has expired. We can send a new one.").filter({ visible: true })).toBeVisible();
    await expectNoViolations(page);
  });

  test("a crafted next parameter can't leave the site", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=x&next=https%3A%2F%2Fevil.example");
    await expect(page).toHaveURL(/\/sign-in\?error=expired&next=%2Fshelf$/);
  });

  test("check-your-email: address shown, countdown, different email", async ({ page, context, baseURL }) => {
    await context.addCookies([
      {
        name: "gw_signin",
        value: JSON.stringify({ email: "priya@example.com", sentAt: Date.now() }),
        url: baseURL!,
      },
    ]);
    await page.goto("/sign-in/check-email?next=%2Fshelf");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Check your email");
    await expect(page.getByText("priya@example.com").filter({ visible: true })).toBeVisible();
    await expect(page.getByText("It works for 15 minutes.").filter({ visible: true })).toBeVisible();
    const resend = page.getByRole("button", { name: /Resend link in \d+s/ });
    await expect(resend).toHaveAttribute("aria-disabled", "true");
    await expectNoViolations(page);
    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fshelf$/);
  });

  test("check-your-email without a request goes back to sign-in", async ({ page }) => {
    await page.goto("/sign-in/check-email");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fshelf$/);
  });
});

test.describe("signed in", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const admin = live ? createClient(url!, service!, { auth: { persistSession: false } }) : null;
  const email = `tess-${randomUUID().slice(0, 8)}@example.com`;
  let userId = "";
  let tokenHash = "";

  test.beforeAll(async () => {
    const created = await admin!.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: "Tess" } });
    if (created.error) throw created.error;
    userId = created.data.user.id;
  });

  test.afterAll(async () => {
    if (userId) await admin!.auth.admin.deleteUser(userId);
  });

  test("a new user opens their link, names themselves, and lands on the shelf", async ({ page }) => {
    const link = await admin!.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    tokenHash = link.data.properties.hashed_token;

    await page.goto(`/auth/confirm?token_hash=${tokenHash}&next=%2Fshelf`);
    await expect(page).toHaveURL(/\/welcome\?next=%2Fshelf$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("What should friends call you?");
    // Prefilled from the account's name.
    await expect(page.getByLabel("Your name")).toHaveValue("Tess");
    await expectNoViolations(page);

    await page.getByLabel("Your name").fill("");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Add a name so friends know who's vouching.").filter({ visible: true })).toBeVisible();

    await page.getByLabel("Your name").fill("Tess");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/shelf$/);
    await expect(page.getByRole("heading", { level: 2, name: "No groups yet" })).toBeVisible();
    await expectNoViolations(page);

    const { data } = await admin!.from("profiles").select("display_name, region, timezone, onboarded_at").eq("user_id", userId).single();
    expect(data?.display_name).toBe("Tess");
    expect(data?.region).toMatch(/^[A-Z]{2}$/);
    expect(data?.timezone).toBeTruthy();
    expect(data?.onboarded_at).not.toBeNull();
  });

  test("a link is single use", async ({ page }) => {
    await page.goto(`/auth/confirm?token_hash=${tokenHash}&next=%2Fshelf`);
    await expect(page).toHaveURL(/\/sign-in\?error=expired/);
  });

  test("a signed-in user skips sign-in and welcome, and can sign out", async ({ page }) => {
    const link = await admin!.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) throw link.error;
    await page.goto(`/auth/confirm?token_hash=${link.data.properties.hashed_token}&next=%2Fyou`);
    await expect(page).toHaveURL(/\/you$/);
    await expect(page.getByText("Signed in as Tess").filter({ visible: true })).toBeVisible();
    await expectNoViolations(page);

    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/shelf$/);
    await page.goto("/welcome");
    await expect(page).toHaveURL(/\/shelf$/);

    // Sign out lives in Settings (PRD F11).
    await page.goto("/you/settings");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/shelf");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fshelf$/);
  });
});
