import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  user_id: string;
  display_name: string | null;
  region: string;
  timezone: string | null;
  onboarded_at: string | null;
};

const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("user_id, display_name, region, timezone, onboarded_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data as Profile | null;
});

/** A signed-in user, or a redirect to sign-in that returns to `next`. */
export async function requireUser(next: string) {
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return { user, profile: await getProfile(user.id) };
}

/** A signed-in user who has chosen a name; new users go to /welcome first. */
export async function requireOnboardedUser(next: string) {
  const { user, profile } = await requireUser(next);
  if (!profile?.onboarded_at || !profile.display_name) redirect(`/welcome?next=${encodeURIComponent(next)}`);
  return { user, profile: profile as Profile & { display_name: string } };
}

/** After sign-in: /welcome for someone new, otherwise where they were headed. */
export async function landingPath(userId: string, next: string) {
  const profile = await getProfile(userId);
  if (!profile?.onboarded_at) return `/welcome?next=${encodeURIComponent(next)}`;
  return next;
}
