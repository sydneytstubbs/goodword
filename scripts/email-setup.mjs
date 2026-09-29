// Stores the email job's address and secret in Supabase Vault, where
// public.run_email_job reads them (PRD 9.5). Run once per project, and again
// after rotating the service role key or changing APP_URL:
//
//   pnpm email:setup
//
// Needs SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_SERVICE_ROLE_KEY,
// and APP_URL (the production address, e.g. https://www.goodwordfriends.com).
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";

/** Must match emailJobSecret() in lib/email/secrets.ts. */
export function emailJobSecret(serviceRoleKey) {
  return createHmac("sha256", `good-word-email-job:${serviceRoleKey}`).update("v1").digest("base64url");
}

const literal = (value) => `'${String(value).replace(/'/g, "''")}'`;

async function main() {
  const { SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_SERVICE_ROLE_KEY, APP_URL } = process.env;
  const missing = Object.entries({ SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_SERVICE_ROLE_KEY, APP_URL })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error(`Missing ${missing.join(", ")}.`);
    process.exit(1);
  }
  const url = `${APP_URL.replace(/\/$/, "")}/api/email/run`;
  const query = `
    delete from vault.secrets where name in ('email_job_url', 'email_job_secret');
    select vault.create_secret(${literal(url)}, 'email_job_url');
    select vault.create_secret(${literal(emailJobSecret(SUPABASE_SERVICE_ROLE_KEY))}, 'email_job_secret');
  `;
  const response = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    console.error(`Supabase responded ${response.status}: ${await response.text()}`);
    process.exit(1);
  }
  console.log(`The email job will call ${url} every 5 minutes.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
