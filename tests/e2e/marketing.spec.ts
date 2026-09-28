import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Marketing page acceptance (good-word-marketing-page-spec.md 8, 10).

test("no axe violations", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
});

test("one h1, the hero headline, and the spec's metadata", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Take your friends' word for it.");
  await expect(page).toHaveTitle("Good Word: show and movie recs from your friends");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "A private shelf of shows and movies your friends vouch for. No algorithm, no strangers.",
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
});

test("skip link is the first focusable element", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("FAQ opens and closes from the keyboard", async ({ page }) => {
  await page.goto("/");
  const question = page.locator("summary", { hasText: "Is it public?" });
  await question.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("No. Groups are private and invite-only.", { exact: false })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByText("No. Groups are private and invite-only.", { exact: false })).toBeHidden();
});

test("no third-party requests", async ({ page, baseURL }) => {
  const origins = new Set<string>();
  page.on("request", (r) => origins.add(new URL(r.url()).origin));
  await page.goto("/", { waitUntil: "load" });
  expect([...origins]).toEqual([new URL(baseURL!).origin]);
});

test("reduced motion shows every section in its final state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const hidden = await page.evaluate(
    () => [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity !== "1").length,
  );
  expect(hidden).toBe(0);
});

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test.describe("mobile menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, traps focus, closes with Esc, and returns focus", async ({ page }) => {
    await page.goto("/");
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    const overlay = page.getByRole("dialog", { name: "Sections" });
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole("button", { name: "Close" })).toBeFocused();
    await expect(overlay.getByRole("link", { name: "How it works" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
    await expect(menu).toBeFocused();
  });

  test("a link closes the menu and moves to its section", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("dialog", { name: "Sections" }).getByRole("link", { name: "FAQ" }).click();
    await expect(page.getByRole("dialog", { name: "Sections" })).toBeHidden();
    await expect(page.locator("#faq")).toBeFocused();
    await expect(page.getByRole("heading", { name: "Questions" })).toBeInViewport();
  });
});

test("visual snapshot", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page).toHaveScreenshot("marketing.png", { fullPage: true });
});
