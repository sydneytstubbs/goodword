import { createBrowserClient } from "@supabase/ssr";

/** Supabase in the browser. Used only to start Google sign-in (the PKCE verifier lives in this browser). */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
