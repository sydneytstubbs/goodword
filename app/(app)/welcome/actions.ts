"use server";

import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export type WelcomeState = { error?: "nameRequired" | "saveFailed"; name?: string };

function validRegion(value: string, fallback = "US") {
  return /^[A-Z]{2}$/.test(value) ? value : fallback;
}

function validTimezone(value: string) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return value;
  } catch {
    return null;
  }
}

export async function saveName(_prev: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 30);
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!name) return { error: "nameRequired", name };

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/sign-in?next=${encodeURIComponent("/welcome")}`);

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: name,
      region: validRegion(String(formData.get("region") ?? "")),
      timezone: validTimezone(String(formData.get("timezone") ?? "")),
      onboarded_at: new Date().toISOString(),
    })
    .eq("user_id", data.user.id);
  if (error) return { error: "saveFailed", name };

  redirect(next);
}
