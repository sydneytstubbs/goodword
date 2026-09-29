import { createHmac, timingSafeEqual } from "node:crypto";

// Secrets for email (PRD F7.7, 9.5), derived from the service role key so
// there's nothing extra to configure: each purpose gets its own HMAC key.
// Rotating the service role key invalidates old unsubscribe links and the
// scheduled job's secret (rerun `pnpm email:setup`).

export type EmailPref = "digest" | "mention_email" | "group_joins";
export const EMAIL_PREFS: EmailPref[] = ["digest", "mention_email", "group_joins"];

function serverKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return key;
}

function hmac(purpose: string, value: string, key = serverKey()): string {
  return createHmac("sha256", `${purpose}:${key}`).update(value).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The bearer secret pg_cron sends to /api/email/run. */
export function emailJobSecret(key?: string): string {
  return hmac("good-word-email-job", "v1", key);
}

export function isEmailJobRequest(authorization: string | null): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  return safeEqual(authorization.slice("Bearer ".length), emailJobSecret());
}

/**
 * An unsubscribe token: who and which email, signed. It never expires, so an
 * old email's link still works, and it carries only ids (PRD 10.4).
 */
export function unsubscribeToken(userId: string, pref: EmailPref): string {
  const payload = `${userId}.${pref}`;
  return `${payload}.${hmac("good-word-unsubscribe", payload)}`;
}

export function readUnsubscribeToken(token: string | null | undefined): { userId: string; pref: EmailPref } | null {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) return null;
  const [userId, pref, signature] = parts;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(userId)) return null;
  if (!EMAIL_PREFS.includes(pref as EmailPref)) return null;
  if (!safeEqual(signature, hmac("good-word-unsubscribe", `${userId}.${pref}`))) return null;
  return { userId, pref: pref as EmailPref };
}
