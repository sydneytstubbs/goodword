import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { recordEvent } from "@/lib/events/server";
import { setNotice } from "@/lib/notice";
import { getInvitePreview } from "./queries";

// Joins are rate limited per IP and per code (F2.4).
const WINDOW_MS = 10 * 60 * 1000;
const PER_IP = 20;
const PER_CODE = 60;

async function rateLimited(code: string): Promise<boolean> {
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(forwarded).digest("hex");
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const admin = createAdminClient();
  const [byIp, byCode] = await Promise.all([
    admin.from("join_attempts").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since),
    admin.from("join_attempts").select("id", { count: "exact", head: true }).eq("code", code).gte("created_at", since),
  ]);
  if ((byIp.count ?? 0) >= PER_IP || (byCode.count ?? 0) >= PER_CODE) return true;
  await admin.from("join_attempts").insert({ ip_hash: ipHash, code });
  return false;
}

/** Joins the signed-in user to the group behind `code`, and says where to go next. */
export async function joinWithCode(code: string): Promise<string> {
  const landing = `/join/${encodeURIComponent(code)}`;
  if (await rateLimited(code)) return `${landing}?error=slow`;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_group", { p_code: code });
  if (error) return `${landing}?error=failed`;
  const result = (data as Array<{ status: string; group_id: string | null }>)[0];

  switch (result?.status) {
    case "joined":
      await recordEvent("group_joined", { group_id: result.group_id ?? undefined, via: "invite" });
      return `/list/${result.group_id}`;
    case "already_member": {
      const preview = await getInvitePreview(code);
      if (preview.status === "active") await setNotice("alreadyMember", { group: preview.groupName });
      return `/list/${result.group_id}`;
    }
    case "group_full":
      return `${landing}?error=full`;
    case "too_many_groups":
      return `${landing}?error=too-many`;
    default:
      return landing;
  }
}
