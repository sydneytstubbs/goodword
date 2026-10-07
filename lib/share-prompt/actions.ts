"use server";

import { recordEvent } from "@/lib/events/server";
import { createClient } from "@/lib/supabase/server";

// Answering "Share your list with friends?" (PRD F16.10): Share all, Choose
// (just these good words), or Not now. Either way it doesn't come back.

export type SharePromptAction = "share_all" | "choose" | "not_now";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** How many good words your friends can see now, or null if it didn't save. */
export async function answerSharePrompt(action: SharePromptAction, goodWordIds: string[], friendsCount: number): Promise<number | null> {
  if (!["share_all", "choose", "not_now"].includes(action)) return null;
  const ids = action === "choose" ? goodWordIds.filter((id) => UUID.test(id)).slice(0, 1000) : [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("answer_share_prompt", { p_action: action, p_good_words: ids });
  if (error || typeof data !== "number") return null;
  await recordEvent("share_prompt", {
    action,
    friends_count_bucket: friendsCount <= 1 ? "1" : friendsCount <= 5 ? "2_5" : "6_plus",
  });
  return data;
}
