import { NextResponse, type NextRequest } from "next/server";
import { runEmailJob } from "@/lib/email/job";
import { isEmailJobRequest } from "@/lib/email/job-auth";
import { sendWithResend } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

// The scheduled email job (PRD 9.5). pg_cron calls this every 5 minutes with
// the job secret from Vault (see public.run_email_job). `{ "digestNow": "<user id>" }`
// sends that person this week's digest now, for reviewing it on a phone.

export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  const admin = createAdminClient();
  if (!(await isEmailJobRequest(request.headers.get("authorization"), admin))) return new NextResponse(null, { status: 401 });
  if (!process.env.EMAIL_API_KEY || !process.env.APP_URL) {
    console.error("email job: EMAIL_API_KEY or APP_URL is not set");
    return new NextResponse(null, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { digestNow?: unknown };
  const digestNow = typeof body.digestNow === "string" && UUID.test(body.digestNow) ? body.digestNow : null;

  try {
    const result = await runEmailJob({
      admin,
      send: sendWithResend,
      origin: process.env.APP_URL.replace(/\/$/, ""),
      ...(digestNow ? { only: [digestNow], digestNow: true } : {}),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("email job failed", error instanceof Error ? error.message : "unknown");
    return new NextResponse(null, { status: 500 });
  }
}
