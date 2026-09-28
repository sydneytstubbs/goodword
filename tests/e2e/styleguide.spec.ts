import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// DESIGN-SYSTEM.md 7.4: axe-core reports zero violations on /styleguide, in both themes.

async function open(page: Page, theme: "light" | "dark") {
  await page.goto(`/styleguide${theme === "dark" ? "?theme=dark" : ""}`);
  // The contrast table measures tokens after hydration.
  await expect(page.getByRole("status").filter({ hasText: /pairings pass|below threshold/ })).toBeVisible();
}

for (const theme of ["light", "dark"] as const) {
  test(`no axe violations (${theme})`, async ({ page }) => {
    await open(page, theme);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(summary).toEqual([]);
  });

  test(`every contrast pairing passes (${theme})`, async ({ page }) => {
    await open(page, theme);
    await expect(page.getByText(/^All \d+ pairings pass$/)).toBeVisible();
  });
}

test("no horizontal scrolling", async ({ page }) => {
  await open(page, "light");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("segmented control moves with arrow keys", async ({ page }) => {
  await open(page, "light");
  const group = page.getByRole("radiogroup", { name: "Show" });
  await group.getByRole("radio", { name: "All" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(group.getByRole("radio", { name: "Movies" })).toHaveAttribute("aria-checked", "true");
  await expect(group.getByRole("radio", { name: "Movies" })).toBeFocused();
});

test("dialog: focus goes to the title, Esc closes and returns focus", async ({ page }) => {
  await open(page, "light");
  const trigger = page.getByRole("button", { name: "Open the leave dialog" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Leave College crew?" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Leave College crew?" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("menu: arrow keys move, Esc closes and returns focus", async ({ page }) => {
  await open(page, "light");
  const trigger = page.getByRole("button", { name: "More actions for The Night Ferry" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "More actions for The Night Ferry" });
  await expect(menu.getByRole("menuitem", { name: "Edit note" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Change groups" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("spoilers aren't in the DOM until revealed", async ({ page }) => {
  await open(page, "light");
  expect(await page.content()).not.toContain("never actually leaves the harbor");
  await page.getByRole("button", { name: "Spoiler from Priya · Tap to reveal" }).click();
  await expect(page.getByText("the ferry never actually leaves the harbor")).toBeVisible();
});

test("composer offers only this group's members, and inserts a mention", async ({ page }) => {
  await open(page, "light");
  const box = page.getByRole("textbox", { name: "Comment" });
  await box.fill("hey @p");
  const list = page.getByRole("listbox", { name: "People in College crew" });
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(list.getByRole("option", { name: "Priya" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(box).toHaveValue("hey @Priya ");
});

test("title search: results, no results, and error", async ({ page }) => {
  await open(page, "light");
  const search = page.getByRole("combobox", { name: "Search for a show or movie" });
  await search.fill("night");
  await expect(page.getByRole("option", { name: /The Night Ferry/ })).toBeVisible();
  await search.fill("zzz");
  await expect(page.getByText("Nothing for “zzz”. Check the spelling, or try the original title.")).toBeVisible();
  await search.fill("error");
  await expect(page.getByText("Search isn't working right now. Try again.")).toBeVisible();
});

// Visual regression (DS 12.3): each section, in both themes, at 390 and 1440.
for (const theme of ["light", "dark"] as const) {
  test(`visual snapshots (${theme})`, async ({ page }) => {
    await open(page, theme);
    await page.addStyleTag({ content: "*{caret-color:transparent!important}" });
    for (const id of ["color", "type", "space", "motion", "icons", "primitives", "domain"]) {
      const section = page.locator(`section[aria-labelledby="${id}"]`);
      await expect(section).toHaveScreenshot(`${id}-${theme}.png`);
    }
  });
}
