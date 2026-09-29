"use server";

import { setPrefFromToken } from "@/lib/email/unsubscribe";

export type UnsubscribeState = { status: "idle" | "off" | "on" | "failed"; lastOn?: boolean };

/** Turns the email in the token off (or back on, for Undo). No sign-in needed (PRD F7.7). */
export async function applyUnsubscribe(_prev: UnsubscribeState, formData: FormData): Promise<UnsubscribeState> {
  const on = formData.get("on") === "true";
  const pref = await setPrefFromToken(String(formData.get("token") ?? ""), on);
  if (!pref) return { status: "failed", lastOn: on };
  return { status: on ? "on" : "off" };
}
