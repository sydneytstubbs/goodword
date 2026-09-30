import "server-only";
import { isReservedAddress, sendWithResend } from "@/lib/email/send";

// Send feedback (PRD F11): stored in the database, then emailed to Sydney.
// Only an internal note, so it's plain text; the reply-to is the sender's
// address only when they said it's OK to follow up.
export const FEEDBACK_TO = "sydneytstubbs@gmail.com";

export async function emailFeedback(input: { id: string; name: string; email: string | null; message: string; mayContact: boolean }) {
  // Test accounts (example.com and the like) never email Sydney.
  if (!input.email || isReservedAddress(input.email)) return { ok: true as const, skipped: true };
  const lines = [
    `From: ${input.name}${input.mayContact && input.email ? ` <${input.email}>` : ""}`,
    `OK to follow up by email: ${input.mayContact ? "yes" : "no"}`,
    "",
    input.message,
  ];
  return sendWithResend({
    to: FEEDBACK_TO,
    subject: `Good Word feedback from ${input.name}`,
    html: `<pre style="font-family:inherit;white-space:pre-wrap;">${lines.map(escape).join("\n")}</pre>`,
    text: lines.join("\n"),
    idempotencyKey: `feedback:${input.id}`,
    ...(input.mayContact && input.email ? { replyTo: input.email } : {}),
  });
}

function escape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
