import { NextResponse } from "next/server";
import { exportAccount } from "@/lib/account/export";
import { createClient } from "@/lib/supabase/server";

// Settings › Download my data (PRD F1): generated on demand, downloaded directly.
export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return new NextResponse(null, { status: 401 });
  try {
    const body = await exportAccount(data.user.id, data.user.email ?? null);
    const date = body.exported_at.slice(0, 10);
    return new NextResponse(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="good-word-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    console.error("export failed");
    return new NextResponse(null, { status: 500 });
  }
}
