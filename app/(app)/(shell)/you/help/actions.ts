"use server";

import { emailFeedback } from "@/lib/feedback";
import { createClient } from "@/lib/supabase/server";

export type FeedbackResult = { status: "sent" | "empty" | "too_long" | "rate_limited" | "failed" };

/**
 * Send feedback (PRD F11). Saved first, then emailed to Sydney; if the email
 * fails it's still saved, so it still counts as sent. The id comes from the
 * client, so a retried send never makes a duplicate.
 */
export async function sendFeedback(id: string, message: string, mayContact: boolean): Promise<FeedbackResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { status: "failed" };
  const { data, error } = await supabase.rpc("send_feedback", { p_id: id, p_message: message, p_may_contact: mayContact });
  if (error) return { status: "failed" };
  if (data !== "sent") return { status: data as FeedbackResult["status"] };

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", auth.user.id).single();
  const emailed = await emailFeedback({
    id,
    name: (profile?.display_name as string | null) ?? "Someone",
    email: auth.user.email ?? null,
    message: message.trim(),
    mayContact,
  });
  if (!emailed.ok) console.error("feedback email failed", emailed.error);
  return { status: "sent" };
}
