import "server-only";
import { recordEvent } from "@/lib/events/server";
import { rateLimited } from "@/lib/groups/join";
import { getInvitePreview } from "@/lib/groups/queries";
import { setNotice } from "@/lib/notice";
import { createClient } from "@/lib/supabase/server";

// Accepting someone's friend link (PRD F16.1): you're friends both ways at
// once, and you land on Home with a toast (DS 5.20); without the home_enabled
// flag there's no Home yet, so you land on your lists.
export async function acceptFriendLink(code: string): Promise<string> {
  const landing = `/join/${encodeURIComponent(code)}`;
  if (await rateLimited(code)) return `${landing}?error=slow`;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_friend_link", { p_code: code });
  if (error) return `${landing}?error=failed`;
  const result = (data as Array<{ status: string; friend_id: string | null }>)[0];
  const preview = await getInvitePreview(code);
  const name = preview.status === "active" && preview.kind === "friend" ? preview.inviter.name : "";
  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("home_enabled").eq("user_id", auth.user?.id ?? "").maybeSingle();
  const next = profile?.home_enabled ? "/home" : "/list";

  switch (result?.status) {
    case "friends":
      await recordEvent("friend_added", { via: "link" });
      await setNotice("nowFriends", { name });
      return next;
    case "already_friends":
      await setNotice("alreadyFriends", { name });
      return next;
    case "self":
      await setNotice("ownFriendLink", {});
      return next;
    default:
      return landing;
  }
}
