import { expect, test, type Browser, type Page } from "@playwright/test";
import { admin, createUser, deleteUsers, expectNoViolations, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Step 3 acceptance (PRD F3, slice 3): the Add search sheet in every state,
// the TMDB search route, the title cache, and typographic fallback posters.
// State tests mock the app's own search route with invented titles; the live
// tests hit TMDB through it and assert only on shape, never on real titles.
const tmdb = Boolean(process.env.TMDB_API_READ_TOKEN);

const invented = [
  { id: "tv-101", type: "tv", tmdbId: 101, name: "The Night Ferry", year: 2024, genres: ["Drama", "Mystery"], accent: "plum" },
  { id: "movie-202", type: "movie", tmdbId: 202, name: "Moth Season", genres: ["Horror"], accent: "clay" },
];

async function openAdd(page: Page) {
  // The tab bar's Add below 1024px; the rail's button from 1024px.
  await page.getByRole("button", { name: /^(Add|Put in a good word)$/ }).filter({ visible: true }).click();
  const sheet = page.getByRole("dialog", { name: "Put in a good word" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test("the search route is for signed-in people only", async ({ request }) => {
  const res = await request.get("/api/titles/search?q=night");
  expect(res.status()).toBe(401);
});

test.describe("titles", () => {
  test.skip(!live, "needs the Supabase environment variables");
  test.describe.configure({ mode: "serial" });

  const users: TestUser[] = [];
  let bea: TestUser;

  test.beforeAll(async () => {
    bea = await createUser("Bea");
    users.push(bea);
  });

  test.afterAll(async () => deleteUsers(users));

  async function signedIn(browser: Browser, next = "/shelf"): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await openMagicLink(page, bea, next);
    return page;
  }

  test("search states: loading, results with fallback posters, no results, error and Retry", async ({ browser }) => {
    const page = await signedIn(browser);
    let mode: "slow" | "results" | "none" | "error" = "slow";
    await page.route("**/api/titles/search?**", async (route) => {
      if (mode === "error") return route.fulfill({ status: 502, json: { error: "unavailable" } });
      if (mode === "slow") await new Promise((r) => setTimeout(r, 1200));
      return route.fulfill({ json: { results: mode === "none" ? [] : invented } });
    });

    const sheet = await openAdd(page);
    const search = sheet.getByRole("combobox", { name: "Search for a show or movie" });
    await expect(search).toBeFocused();

    await search.fill("ni");
    await expect(sheet.getByText("Searching")).toBeAttached();
    const results = sheet.getByRole("option");
    await expect(results).toHaveCount(2);
    await expect(sheet.getByText("2 results")).toBeAttached();

    // No posters from TMDB: typographic fallbacks, never an image.
    await expect(results.first()).toContainText("The Night Ferry");
    await expect(results.first()).toContainText("Series · 2024");
    await expect(results.nth(1)).toContainText("Film");
    await expect(sheet.locator("img")).toHaveCount(0);
    await expectNoViolations(page);

    mode = "none";
    await search.fill("zzz");
    await expect(sheet.getByText("Nothing for “zzz”. Check the spelling, or try the original title.")).toBeVisible();

    mode = "error";
    await search.fill("nite ferry");
    await expect(sheet.getByRole("alert")).toHaveText(/Search isn't working right now. Try again./);
    mode = "results";
    await sheet.getByRole("button", { name: "Retry" }).click();
    await expect(results).toHaveCount(2);

    // Arrows move, Esc clears, then closes.
    await search.press("ArrowDown");
    await expect(results.nth(1)).toHaveAttribute("aria-selected", "true");
    await search.press("Escape");
    await expect(search).toHaveValue("");
    await search.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("Back closes the sheet and stays on the page", async ({ browser }) => {
    const page = await signedIn(browser);
    await expect(page).toHaveURL(/\/shelf$/);
    await openAdd(page);
    await page.goBack();
    await expect(page.getByRole("dialog", { name: "Put in a good word" })).toBeHidden();
    await expect(page).toHaveURL(/\/shelf$/);
    await expect(page.getByRole("heading", { name: "No groups yet" })).toBeVisible();
  });

  test("searching “night” returns movies and shows with posters in under a second", async ({ browser }) => {
    test.skip(!tmdb, "needs TMDB_API_READ_TOKEN");
    const page = await signedIn(browser);
    const sheet = await openAdd(page);
    const response = page.waitForResponse((r) => r.url().includes("/api/titles/search"));
    await sheet.getByRole("combobox").fill("night");
    const res = await response;
    expect(res.status()).toBe(200);
    const timing = res.request().timing();
    expect(timing.responseEnd).toBeLessThan(1000);

    const body = (await res.json()) as { results: Array<{ type: string; posterPath?: string }> };
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results.every((r) => r.type === "movie" || r.type === "tv")).toBe(true);
    expect(new Set(body.results.map((r) => r.type))).toEqual(new Set(["movie", "tv"]));

    const options = sheet.getByRole("option");
    await expect(options.first()).toBeVisible();
    for (const meta of await options.locator(".text-caption").allTextContents()) expect(meta).toMatch(/^(Film|Series)/);
    const poster = sheet.locator("img").first();
    await expect(poster).toHaveAttribute("srcset", /image\.tmdb\.org\/t\/p\/w154\/.+ 154w/);
    await expect(poster).toHaveAttribute("sizes", "48px");
    await expectNoViolations(page);
  });

  test("picking a result opens the confirm step; its title page saves it to the cache with an accent", async ({ browser }) => {
    test.skip(!tmdb, "needs TMDB_API_READ_TOKEN");
    const page = await signedIn(browser);
    const sheet = await openAdd(page);
    const response = page.waitForResponse((r) => r.url().includes("/api/titles/search"));
    await sheet.getByRole("combobox").fill("night");
    const body = (await (await response).json()) as { results: Array<{ type: string; tmdbId: number; name: string }> };
    const first = sheet.getByRole("option").first();
    const name = (await first.locator(".text-card-title").textContent())!;
    await first.click();

    // Step 4: a result opens the confirm step in the same sheet (DS 5.4).
    await expect(sheet.getByLabel("Anything to add? (optional)")).toBeFocused();
    await expect(sheet.getByText(name, { exact: true })).toBeVisible();
    await expect(sheet.getByText("Only you, for now")).toBeVisible();
    await expect(page).toHaveURL(/\/shelf$/);

    // Back returns to where Add was opened, with the sheet closed.
    await page.goBack();
    await expect(page).toHaveURL(/\/shelf$/);
    await expect(page.getByRole("dialog", { name: "Put in a good word" })).toBeHidden();

    const { type, tmdbId } = body.results.find((r) => r.name === name)!;
    await page.goto(`/title/${type}/${tmdbId}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page).toHaveTitle(`${name} · Good Word`);
    await expect(page.getByText("None of your groups have vouched for this yet.")).toBeVisible();
    await expectNoViolations(page);
    const { data } = await admin().from("titles").select("title, accent").eq("media_type", type).eq("tmdb_id", tmdbId).single();
    expect(data?.title).toBe(name);
    expect(data?.accent).toMatch(/^(clay|ochre|moss|plum)$/);

    // The search is remembered on this device.
    await page.goBack();
    const again = await openAdd(page);
    await expect(again.getByRole("heading", { name: "Recent searches" })).toBeVisible();
    await again.getByRole("button", { name: "night" }).click();
    await expect(again.getByRole("combobox")).toHaveValue("night");
    await again.getByRole("combobox").fill("");
    await again.getByRole("button", { name: "Clear", exact: true }).click();
    await expect(again.getByRole("heading", { name: "Recent searches" })).toBeHidden();
  });

  test("a title that doesn't exist says so", async ({ browser }) => {
    const page = await signedIn(browser, "/title/book/1");
    await expect(page.getByRole("heading", { level: 2, name: "We couldn't find that title" })).toBeVisible();
    await expectNoViolations(page);
    if (!tmdb) return;
    // A well-formed link to a title TMDB doesn't have.
    await page.goto("/title/movie/999999999");
    await expect(page.getByRole("heading", { level: 2, name: "We couldn't find that title" })).toBeVisible();
  });
});
