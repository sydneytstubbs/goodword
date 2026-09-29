import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { safeEqual } from "./secrets";

// The email job's secret is random and lives only in Supabase Vault (made by
// the step 7 migration). pg_cron sends it; this checks it against Vault.
export async function isEmailJobRequest(authorization: string | null, admin: SupabaseClient): Promise<boolean> {
  if (!authorization?.startsWith("Bearer ")) return false;
  const { data, error } = await admin.rpc("email_job_secret");
  if (error || typeof data !== "string" || data.length < 32) return false;
  return safeEqual(authorization.slice("Bearer ".length), data);
}
