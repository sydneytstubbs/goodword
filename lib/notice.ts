import "server-only";
import { cookies } from "next/headers";

// A one-time toast that survives a redirect ("You're already in College crew.").
// The client reads and clears it (components/domain/notice-toast.tsx).
export const NOTICE_COOKIE = "gw_notice";
export type NoticeKey = "alreadyMember" | "left" | "deleted" | "accountDeleted";

export async function setNotice(key: NoticeKey, vars: Record<string, string>) {
  // Readable by the page (not httpOnly) and not sensitive: a message key and a group name.
  (await cookies()).set(NOTICE_COOKIE, JSON.stringify({ key, vars }), { path: "/", maxAge: 60, sameSite: "lax" });
}
