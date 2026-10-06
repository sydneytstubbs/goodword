import "server-only";
import { cache } from "react";
import { redirect, unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  user_id: string;
  display_name: string | null;
  region: string;
  timezone: string | null;
  onboarded_at: string | null;
  /** The Home and friends launch flag (PRD F16.10), on for test accounts until the flip. */
  home_enabled: boolean;
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
    .select("user_id, display_name, region, timezone, onboarded_at, home_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  return data as Profile | null;
});

/**
 * The signed-in user, or null. For pages anyone can see that change for
 * signed-in people (the 404), so it never throws: without Supabase configured
 * (CI builds, a fresh checkout) or if auth fails, nobody is signed in.
 */
export async function currentUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    return await getUser();
  } catch (error) {
    // Next's own signals (rendering per request because of cookies) must pass through.
    unstable_rethrow(error);
    return null;
  }
}

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
