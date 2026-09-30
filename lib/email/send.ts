import "server-only";
import type { Email } from "@/emails/layout";

// Product email through Resend's API (PRD 9.4). Sign-in links go through
// Supabase Auth's SMTP instead. No open-tracking pixels; links carry ref
// parameters. Reserved test domains (example.com, *.test, ...) are never
// sent to, so test accounts can't cost the domain its reputation.

export const EMAIL_FROM = "Good Word <hello@mail.goodwordfriends.com>";

export type OutgoingEmail = Email & {
  to: string;
  /** RFC 8058 one-click unsubscribe URL (POST). Every product email has one; internal notes (feedback) don't. */
  oneClickUnsubscribe?: string;
  replyTo?: string;
  /** Resend drops a repeat with the same key within 24 hours. */
  idempotencyKey: string;
};

export type SendResult = { ok: true; skipped?: boolean } | { ok: false; error: string };
export type Sender = (email: OutgoingEmail) => Promise<SendResult>;

const RESERVED = /(^|\.)(example\.(com|net|org)|test|invalid|localhost|example)$/i;

export function isReservedAddress(address: string): boolean {
  const domain = address.split("@")[1] ?? "";
  return domain === "" || RESERVED.test(domain);
}

export const sendWithResend: Sender = async (email) => {
  if (isReservedAddress(email.to)) return { ok: true, skipped: true };
  const key = process.env.EMAIL_API_KEY;
  if (!key) return { ok: false, error: "EMAIL_API_KEY is not set" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": email.idempotencyKey,
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(email.replyTo ? { reply_to: email.replyTo } : {}),
        ...(email.oneClickUnsubscribe
          ? {
              headers: {
                "List-Unsubscribe": `<${email.oneClickUnsubscribe}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }
          : {}),
      }),
    });
    if (response.ok) return { ok: true };
    // Log the status only: the body can echo the address (PRD 10.5).
    return { ok: false, error: `Resend responded ${response.status}` };
  } catch {
    return { ok: false, error: "Resend unreachable" };
  }
};
