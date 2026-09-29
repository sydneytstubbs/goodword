import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const RESEND_SECONDS = 30;
export const HOURLY_LIMIT = 5;
const COOKIE = "gw_signin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string) {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

const hashEmail = (email: string) => createHash("sha256").update(email).digest("hex");

export type SendResult = "sent" | "too-many" | "too-soon" | "failed";

/** Emails a sign-in link, enforcing 5 per address per hour (PRD F1). */
export async function sendSignInLink(rawEmail: string, next: string): Promise<SendResult> {
  const email = rawEmail.trim().toLowerCase();
  const admin = createAdminClient();
  const emailHash = hashEmail(email);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count, error: countError } = await admin
    .from("sign_in_requests")
    .select("id", { count: "exact", head: true })
    .eq("email_hash", emailHash)
    .gte("created_at", since);
  if (countError) return "failed";
  if ((count ?? 0) >= HOURLY_LIMIT) return "too-many";

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = host ? `${proto}://${host}` : process.env.APP_URL!;

  await admin.from("sign_in_requests").insert({ email_hash: emailHash });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return error.status === 429 ? "too-soon" : "failed";

  const store = await cookies();
  store.set(COOKIE, JSON.stringify({ email, sentAt: Date.now() }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  return "sent";
}

/** The address a link was last sent to from this browser, and how long until Resend opens. */
export async function readSignInRequest(): Promise<{ email: string; secondsLeft: number } | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const { email, sentAt } = JSON.parse(raw) as { email: string; sentAt: number };
    if (typeof email !== "string" || typeof sentAt !== "number") return null;
    const secondsLeft = Math.max(0, Math.ceil((sentAt + RESEND_SECONDS * 1000 - Date.now()) / 1000));
    return { email, secondsLeft };
  } catch {
    return null;
  }
}

export async function clearSignInRequest() {
  (await cookies()).delete(COOKIE);
}
