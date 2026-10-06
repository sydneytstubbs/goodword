import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, createUser, deleteUsers, live, openMagicLink, type TestUser } from "./helpers/accounts";

// Copy link in the group invite sheet (DS 4.2.7) copies the link, with the
// Clipboard API, without it (in-app browsers), and when it's refused.
test.describe("copy the group invite link", () => {
  test.skip(!live, "needs the Supabase project");
  const users: TestUser[] = [];
  const crew = randomUUID();
  const code = randomUUID().replaceAll("-", "");
  let priya: TestUser;

  test.beforeAll(async () => {
    priya = await createUser("Priya");
    users.push(priya);
    await admin().from("groups").insert({ id: crew, name: "College crew", owner_id: priya.id, color: 1 });
    await admin().from("group_members").insert({ group_id: crew, user_id: priya.id, role: "owner", welcome_seen_at: new Date().toISOString() });
    await admin().from("invites").insert({ group_id: crew, code, created_by: priya.id });
  });

  test.afterAll(async () => {
    await deleteUsers(users);
  });

  for (const mode of ["api", "missing", "refused"] as const) {
    test(`from the sheet on a group's list, clipboard ${mode}`, async ({ page, context, baseURL }) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });
      await page.addInitScript((m) => {
        const read = navigator.clipboard.readText.bind(navigator.clipboard);
        (window as unknown as { readClipboard: () => Promise<string> }).readClipboard = read;
        if (m === "missing") Object.defineProperty(navigator, "clipboard", { value: undefined });
        if (m === "refused") navigator.clipboard.writeText = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
      }, mode);
      await openMagicLink(page, priya, `/list/${crew}`);
      await page.waitForURL(`**/list/${crew}`);
      await page.getByRole("button", { name: "Invite to College crew" }).first().click();
      const sheet = page.getByRole("dialog");
      await sheet.getByRole("button", { name: "Copy link" }).click();
      await expect(page.getByText("Link copied. Send it to someone whose taste you trust.")).toBeVisible();
      const copied = await page.evaluate(() => (window as unknown as { readClipboard: () => Promise<string> }).readClipboard());
      expect(copied).toMatch(new RegExp(`/join/${code}$`));
    });
  }
});
