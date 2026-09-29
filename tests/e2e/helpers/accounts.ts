import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

// Shared helpers for the signed-in e2e tests. Uses the real Supabase project
// through the service key, never sending email.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const live = Boolean(url && service && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let adminClient: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  adminClient ??= createClient(url!, service!, { auth: { persistSession: false } });
  return adminClient;
}

export type TestUser = { id: string; email: string; name: string };

/** An invented person. `onboarded` skips /welcome by setting their name up front. */
export async function createUser(name: string, { onboarded = true } = {}): Promise<TestUser> {
  const email = `${name.toLowerCase()}-${randomUUID().slice(0, 8)}@example.com`;
  const created = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;
  const id = created.data.user.id;
  if (onboarded) {
    await admin().from("profiles").update({ display_name: name, onboarded_at: new Date().toISOString() }).eq("user_id", id);
  }
  return { id, email, name };
}

export async function deleteUsers(users: TestUser[]) {
  const ids = users.map((u) => u.id);
  if (ids.length === 0) return;
  await admin().from("groups").delete().in("owner_id", ids);
  for (const id of ids) await admin().auth.admin.deleteUser(id);
}

/** Opens a fresh magic link for `user` in `page`, as if tapped from the email. */
export async function openMagicLink(page: Page, user: TestUser, next = "/shelf") {
  const link = await admin().auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (link.error) throw link.error;
  await page.goto(`/auth/confirm?token_hash=${link.data.properties.hashed_token}&next=${encodeURIComponent(next)}`);
}

export async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}
