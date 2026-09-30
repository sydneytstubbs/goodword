import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { digestEmail } from "@/emails/digest";
import { groupJoinEmail } from "@/emails/group-join";
import { mentionEmail } from "@/emails/mention";
import { weekendPromptEmail } from "@/emails/weekend-prompt";
import type { EmailLinks, DigestContent, JoinBatch, MentionBatch } from "@/emails/types";
import { recordEvent } from "@/lib/events/server";
import { unsubscribeToken, type EmailPref } from "./secrets";
import type { Sender } from "./send";

// The scheduled email job (PRD 9.5), run every 5 minutes by pg_cron. The
// database decides what's due (quiet hours, caps, preferences, what was
// already read or deleted); this renders and sends it. Each email is claimed
// before sending and released if sending fails, so overlapping runs never
// send twice and a failure is retried on the next run.
//
// Digests go before join emails and the weekend prompt, so the one-a-day cap
// favors the digest.
// Mentions are exempt from the cap.

export type JobOptions = {
  admin: SupabaseClient;
  send: Sender;
  origin: string;
  /** Only these people (tests, and sending one person a digest now). */
  only?: string[];
  /** Send `only` their digest now, whatever the day. */
  digestNow?: boolean;
  mentionWindowMinutes?: number;
  /** Resend allows 2 requests a second; stay under it. */
  pauseMs?: number;
  maxPerRun?: number;
  /** Record email_sent events (off in unit tests, which have no request). */
  record?: boolean;
};

export type JobResult = { digests: number; mentions: number; joins: number; weekend: number; skipped: number; failed: number };

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runEmailJob(options: JobOptions): Promise<JobResult> {
  const { admin, send, origin, only, digestNow = false, mentionWindowMinutes = 10, pauseMs = 550, maxPerRun = 60, record = true } = options;
  const result: JobResult = { digests: 0, mentions: 0, joins: 0, weekend: 0, skipped: 0, failed: 0 };
  let sent = 0;
  const p_only = only && only.length > 0 ? only : null;

  const links = (userId: string, pref: EmailPref) => {
    const token = unsubscribeToken(userId, pref);
    const unsubscribe: EmailLinks = { origin, unsubscribe: `${origin}/unsubscribe?token=${encodeURIComponent(token)}` };
    return { unsubscribe, oneClick: `${origin}/api/unsubscribe?token=${encodeURIComponent(token)}` };
  };

  // Returns true when the email went (or was deliberately skipped). Emails
  // that really went are recorded (PRD 11.2); nothing about their content is.
  const deliver = async (email: Parameters<Sender>[0], userId: string, type: "digest" | "mention" | "group_join" | "weekend_prompt"): Promise<boolean> => {
    if (sent > 0) await pause(pauseMs);
    const outcome = await send(email);
    sent++;
    if (!outcome.ok) {
      result.failed++;
      console.error(`email: ${email.idempotencyKey} failed: ${outcome.error}`);
      return false;
    }
    if (outcome.skipped) result.skipped++;
    else if (record) {
      await recordEvent("email_sent", { type }, userId);
      if (type === "mention") await recordEvent("mention_notified", { channel: "email" }, userId);
    }
    return true;
  };

  const log = (userId: string, type: string, ref: string) =>
    admin.from("notification_log").insert({ user_id: userId, type, payload_ref: ref });

  // 1. Digests.
  const digests = await admin.rpc("email_digests_due", { p_only, p_force: digestNow && Boolean(p_only) });
  if (digests.error) throw new Error(`email_digests_due: ${digests.error.message}`);
  for (const row of (digests.data ?? []) as Array<{ user_id: string; email: string; slot: string; content: DigestContent }>) {
    if (sent >= maxPerRun) break;
    const ref = digestNow ? `test:${new Date().toISOString()}` : row.slot;
    const claimed = await log(row.user_id, "digest", ref);
    if (claimed.error) continue; // Another run has it.
    const { unsubscribe, oneClick } = links(row.user_id, "digest");
    const email = digestEmail(row.content, unsubscribe);
    const ok = await deliver({ ...email, to: row.email, oneClickUnsubscribe: oneClick, idempotencyKey: `digest:${row.user_id}:${ref}` }, row.user_id, "digest");
    if (ok) result.digests++;
    else await admin.from("notification_log").delete().match({ user_id: row.user_id, type: "digest", payload_ref: ref });
  }
  if (digestNow) return result;

  // 2. Mentions.
  const mentions = await admin.rpc("email_mentions_due", { p_window: `${mentionWindowMinutes} minutes`, p_only });
  if (mentions.error) throw new Error(`email_mentions_due: ${mentions.error.message}`);
  for (const row of (mentions.data ?? []) as Array<MentionBatch & { user_id: string; email: string; item_ids: string[] }>) {
    if (sent >= maxPerRun) break;
    const claimed = await admin.rpc("claim_email_items", { p_ids: row.item_ids });
    if (claimed.error || claimed.data !== true) continue;
    const { unsubscribe, oneClick } = links(row.user_id, "mention_email");
    const email = mentionEmail(row, unsubscribe);
    const ok = await deliver({ ...email, to: row.email, oneClickUnsubscribe: oneClick, idempotencyKey: `mention:${row.item_ids[0]}` }, row.user_id, "mention");
    if (ok) {
      result.mentions++;
      await log(row.user_id, "mention", row.item_ids[0]);
    } else {
      await admin.rpc("release_email_items", { p_ids: row.item_ids });
    }
  }

  // 3. Someone joined your group.
  const joins = await admin.rpc("email_joins_due", { p_only });
  if (joins.error) throw new Error(`email_joins_due: ${joins.error.message}`);
  for (const row of (joins.data ?? []) as Array<{ user_id: string; email: string; item_ids: string[]; joins: JoinBatch }>) {
    if (sent >= maxPerRun) break;
    const claimed = await admin.rpc("claim_email_items", { p_ids: row.item_ids });
    if (claimed.error || claimed.data !== true) continue;
    const { unsubscribe, oneClick } = links(row.user_id, "group_joins");
    const email = groupJoinEmail(row.joins, unsubscribe);
    const ok = await deliver({ ...email, to: row.email, oneClickUnsubscribe: oneClick, idempotencyKey: `join:${row.item_ids[0]}` }, row.user_id, "group_join");
    if (ok) {
      result.joins++;
      await log(row.user_id, "group_join", row.item_ids[0]);
    } else {
      await admin.rpc("release_email_items", { p_ids: row.item_ids });
    }
  }

  // 4. The weekend prompt (F7.2), claimed by its Sunday like the digest.
  const weekend = await admin.rpc("email_weekend_due", { p_only });
  if (weekend.error) throw new Error(`email_weekend_due: ${weekend.error.message}`);
  for (const row of (weekend.data ?? []) as Array<{ user_id: string; email: string; slot: string }>) {
    if (sent >= maxPerRun) break;
    const claimed = await log(row.user_id, "weekend_prompt", row.slot);
    if (claimed.error) continue;
    const { unsubscribe, oneClick } = links(row.user_id, "weekend_prompt");
    const email = weekendPromptEmail(unsubscribe);
    const ok = await deliver({ ...email, to: row.email, oneClickUnsubscribe: oneClick, idempotencyKey: `weekend:${row.user_id}:${row.slot}` }, row.user_id, "weekend_prompt");
    if (ok) result.weekend++;
    else await admin.from("notification_log").delete().match({ user_id: row.user_id, type: "weekend_prompt", payload_ref: row.slot });
  }

  return result;
}
